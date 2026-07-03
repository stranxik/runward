// Suspend-and-rehydrate on approval. When an impactful tool needs an
// approval that is not available, the run does not fail and does not block:
// it is serialized (status + pending tool + exact arguments) behind the
// repository port, the process is freed, and resumeRun() rehydrates it on
// the human decision. Approve executes the exact serialized call; reject
// means the execution never happens.

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createContainer } from "../src/infrastructure/container.ts";
import { HandleRequestUseCase } from "../src/core/application/handle-request.usecase.ts";
import { InMemoryRunRepository } from "../src/adapters/persistence/in-memory-run.repo.ts";
import { EchoModelAdapter } from "../src/adapters/model/echo-model.adapter.ts";
import { ToolRegistry } from "../src/infrastructure/registry.ts";
import { CapturingLogger } from "../src/infrastructure/observability/logger.ts";
import {
  loggingMiddleware,
  accessMiddleware,
  costMiddleware,
  approvalMiddleware,
  buildApprovalSummary,
} from "../src/infrastructure/middleware.ts";
import { wordCountTool } from "../src/adapters/tools/example-tools.ts";
import type { ToolDefinition } from "../src/core/ports/out/tool.port.ts";
import {
  ValidationError,
  UnauthorizedError,
} from "../src/infrastructure/errors.ts";

const fixedClock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

// The echo answer for the prompt "hello" (fast tier + word_count injected).
const ECHO_ANSWER = '[fast] echo: hello\n\n[tool_results]\nword_count: {"words":1}';

// Deterministic rig with a SPY impactful tool named publish_note: it counts
// its executions and records its last input, so "the execution never
// happened" is observable, not assumed.
function buildRig() {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const spy = { calls: 0, lastInput: undefined as unknown };
  const spyPublish: ToolDefinition<{ content: string }, { published: boolean }> = {
    name: "publish_note",
    description: "Spy impactful tool (test double for publish_note).",
    input: z.object({ content: z.string().min(1) }),
    minRole: "operator",
    requiresApproval: true,
    async execute(input) {
      spy.calls += 1;
      spy.lastInput = input;
      return { published: true };
    },
  };
  const registry = new ToolRegistry([
    loggingMiddleware(logger),
    accessMiddleware(),
    costMiddleware(logger),
    // No synchronous decision available: the doctrine default.
    approvalMiddleware(() => "absent"),
  ]);
  registry.register(wordCountTool);
  registry.register(spyPublish);
  const useCase = new HandleRequestUseCase({
    model: new EchoModelAdapter(),
    repo,
    clock: fixedClock,
    registry,
    logger,
    newRequestId: () => "req_suspend",
  });
  return { useCase, repo, logger, spy };
}

test("suspension: absent approval serializes the run and frees the process", async () => {
  const { useCase, repo, logger, spy } = buildRig();

  const res = await useCase.handle({ prompt: "hello" }, "operator");

  // The call returned (process freed) with an explicit suspended result.
  assert.equal(res.status, "suspended");
  assert.equal(res.requestId, "req_suspend");
  // The tool did NOT execute.
  assert.equal(spy.calls, 0);

  // The trajectory is serialized behind the port: status + pending step +
  // the EXACT tool arguments.
  const record = await repo.get("req_suspend");
  assert.equal(record.status, "suspended");
  assert.ok(record.pending);
  assert.equal(record.pending?.tool, "publish_note");
  assert.deepEqual(record.pending?.input, { content: ECHO_ANSWER });
  assert.deepEqual(record.pending?.toolsUsed, ["word_count"]);
  // The journal keeps the approval request as a step.
  assert.ok(record.steps.some((s) => s.kind === "approval_requested"));
  assert.ok(logger.events.some((e) => e.step === "suspended"));
});

test("resume approve: rehydrates and executes the exact serialized call, run done", async () => {
  const { useCase, repo, spy } = buildRig();
  await useCase.handle({ prompt: "hello" }, "operator");

  const resumed = await useCase.resumeRun("req_suspend", "approve", "operator");

  assert.equal(resumed.status, "done");
  // The tool executed exactly once, with the exact serialized arguments.
  assert.equal(spy.calls, 1);
  assert.deepEqual(spy.lastInput, { content: ECHO_ANSWER });
  assert.deepEqual(resumed.toolsUsed, ["word_count", "publish_note"]);
  // The run resumed where it stopped: the already-produced answer is served.
  assert.equal(resumed.answer, ECHO_ANSWER);

  const record = await repo.get("req_suspend");
  assert.equal(record.status, "done");
  assert.equal(record.pending, undefined); // suspension point cleared
  const kinds = record.steps.map((s) => s.kind);
  assert.ok(kinds.includes("approval_requested"));
  assert.ok(kinds.includes("approval_decision"));
});

test("resume reject: the execution never happens, run ends rejected", async () => {
  const { useCase, repo, spy } = buildRig();
  await useCase.handle({ prompt: "hello" }, "operator");

  const resumed = await useCase.resumeRun("req_suspend", "reject", "operator");

  assert.equal(resumed.status, "rejected");
  assert.equal(spy.calls, 0); // never executed, before OR after the decision
  const record = await repo.get("req_suspend");
  assert.equal(record.status, "rejected");
  assert.equal(record.pending, undefined);
  assert.ok(record.steps.some((s) => s.kind === "approval_decision"));
});

test("summary fidelity: deterministic, built from the exact tool arguments", async () => {
  const { useCase, repo } = buildRig();
  const res = await useCase.handle({ prompt: "hello" }, "operator");
  const record = await repo.get("req_suspend");

  // The summary presented for approval is a pure function of the tool name
  // and the EXACT arguments — never a model reformulation.
  const expected = buildApprovalSummary("publish_note", record.pending?.input);
  assert.equal(res.answer, expected);
  assert.equal(record.pending?.summary, expected);
  // The real arguments are visible verbatim in the summary.
  assert.ok(res.answer.includes('"content":"[fast] echo: hello'));
  // Canonical form: object keys sorted, so the summary is reproducible
  // whatever the insertion order of the arguments.
  assert.equal(
    buildApprovalSummary("t", { b: 1, a: 2 }),
    buildApprovalSummary("t", { a: 2, b: 1 }),
  );
});

test("resume guards: non-suspended run rejected, insufficient role rejected", async () => {
  const { useCase } = buildRig();
  // Not suspended yet (never ran): repo throws NotFound through get(); run
  // it first as viewer (no publish_note visible -> run completes "done").
  await useCase.handle({ prompt: "hello" }, "viewer");
  await assert.rejects(
    () => useCase.resumeRun("req_suspend", "approve", "operator"),
    ValidationError,
  );

  const rig2 = buildRig();
  await rig2.useCase.handle({ prompt: "hello" }, "operator");
  // A viewer cannot decide on an operator tool.
  await assert.rejects(
    () => rig2.useCase.resumeRun("req_suspend", "approve", "viewer"),
    UnauthorizedError,
  );
});

test("container default gate: an operator run suspends instead of failing", async () => {
  // Through the real container (default gate = "absent"), the shipped
  // publish_note tool suspends the run for an operator.
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const c = createContainer({
    logger,
    repo,
    clock: fixedClock,
    newRequestId: () => "req_container_suspend",
  });
  const res = await c.useCase.handle({ prompt: "hello" }, "operator");
  assert.equal(res.status, "suspended");
  const resumed = await c.useCase.resumeRun(
    "req_container_suspend",
    "approve",
    "operator",
  );
  assert.equal(resumed.status, "done");
  assert.deepEqual(resumed.toolsUsed, ["word_count", "publish_note"]);
});
