// Integration test: the use case through the injection container and
// deterministic adapters (next-to-last floor of the test pyramid). The full
// path, access control and approval are verified.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createContainer } from "../src/infrastructure/container.ts";
import { CapturingLogger } from "../src/infrastructure/observability/logger.ts";
import {
  UnauthorizedError,
  ApprovalDeniedError,
} from "../src/infrastructure/errors.ts";

// Frozen clock for reproducible steps.
const fixedClock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

test("end to end: request -> plan -> tool -> model -> deterministic response", async () => {
  let n = 0;
  const logger = new CapturingLogger();
  const c = createContainer({
    logger,
    clock: fixedClock,
    newRequestId: () => `req_${++n}`,
  });

  const res = await c.useCase.handle({ prompt: "hello", role: "viewer" });

  assert.equal(res.requestId, "req_1");
  assert.equal(res.answer, "[fast] echo: hello"); // deterministic echo, fast tier
  assert.deepEqual(res.toolsUsed, ["word_count"]);

  // The expected cycle events were emitted (observability).
  const steps = logger.events.map((e) => e.step);
  assert.deepEqual(steps, [
    "request_received",
    "planned",
    "tool_called",
    "model_called",
    "done",
  ]);
  // The request id is propagated on every event.
  assert.ok(logger.events.every((e) => e.requestId === "req_1"));
});

test("deep model tier for an analysis request", async () => {
  const c = createContainer({
    logger: new CapturingLogger(),
    clock: fixedClock,
    newRequestId: () => "req_deep",
  });
  const res = await c.useCase.handle({ prompt: "analyse this topic", role: "viewer" });
  assert.equal(res.answer, "[deep] echo: analyse this topic");
});

test("access control: a viewer cannot invoke an impactful tool", async () => {
  const c = createContainer({ logger: new CapturingLogger() });
  await assert.rejects(
    () =>
      c.registry.invoke(
        "publish_note",
        { content: "x" },
        "viewer",
        "req_x",
        { toolCalls: 0 },
      ),
    UnauthorizedError,
  );
});

test("approval: an impactful tool is denied when the gate denies", async () => {
  const c = createContainer({
    logger: new CapturingLogger(),
    approvalGate: () => false, // explicit denial
  });
  await assert.rejects(
    () =>
      c.registry.invoke(
        "publish_note",
        { content: "note" },
        "operator",
        "req_y",
        { toolCalls: 0 },
      ),
    ApprovalDeniedError,
  );
});

test("approval: an impactful tool passes when the gate approves and the role suffices", async () => {
  const c = createContainer({
    logger: new CapturingLogger(),
    approvalGate: () => true,
  });
  const out = (await c.registry.invoke(
    "publish_note",
    { content: "note" },
    "operator",
    "req_z",
    { toolCalls: 0 },
  )) as { published: boolean; length: number };
  assert.equal(out.published, true);
  assert.equal(out.length, 4);
});

test("persistence: the trajectory is recorded behind the port", async () => {
  // Rebuild with an accessible repo to inspect the persisted state.
  const { InMemoryRunRepository } = await import(
    "../src/adapters/persistence/in-memory-run.repo.ts"
  );
  const repo = new InMemoryRunRepository();
  const c = createContainer({
    logger: new CapturingLogger(),
    clock: fixedClock,
    repo,
    newRequestId: () => "req_persist",
  });
  await c.useCase.handle({ prompt: "hello", role: "viewer" });
  const record = await repo.get("req_persist");
  assert.equal(record.status, "done");
  const kinds = record.steps.map((s) => s.kind);
  assert.deepEqual(kinds, ["plan", "tool_call", "model_call", "synthesis"]);
});
