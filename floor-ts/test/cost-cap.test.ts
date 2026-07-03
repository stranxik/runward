// Per-run cost cap test. With a tool cap of zero, the orchestrator must stop
// before the tool call, return a partial synthesis (status "capped") and emit
// cost_cap_reached.

import { test } from "node:test";
import assert from "node:assert/strict";
import { HandleRequestUseCase } from "../src/core/application/handle-request.usecase.ts";
import { InMemoryRunRepository } from "../src/adapters/persistence/in-memory-run.repo.ts";
import { EchoModelAdapter } from "../src/adapters/model/echo-model.adapter.ts";
import { ToolRegistry } from "../src/infrastructure/registry.ts";
import { CapturingLogger } from "../src/infrastructure/observability/logger.ts";
import {
  loggingMiddleware,
  accessMiddleware,
  costMiddleware,
} from "../src/infrastructure/middleware.ts";
import { wordCountTool } from "../src/adapters/tools/example-tools.ts";

const fixedClock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

function buildUseCase(logger: CapturingLogger, repo: InMemoryRunRepository, limits: {
  maxToolCalls: number;
  maxModelCalls: number;
  maxRunTokens?: number;
}) {
  const registry = new ToolRegistry([
    loggingMiddleware(logger),
    accessMiddleware(),
    costMiddleware(logger),
  ]);
  registry.register(wordCountTool);
  return new HandleRequestUseCase({
    model: new EchoModelAdapter(),
    repo,
    clock: fixedClock,
    registry,
    logger,
    newRequestId: () => "req_cap",
    limits,
  });
}

test("tool cap at zero: the orchestrator stops before the tool (capped)", async () => {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const useCase = buildUseCase(logger, repo, { maxToolCalls: 0, maxModelCalls: 4 });

  const res = await useCase.handle({ prompt: "hello" }, "viewer");

  assert.equal(res.status, "capped");
  assert.deepEqual(res.toolsUsed, []); // no tool was called
  const steps = logger.events.map((e) => e.step);
  assert.ok(steps.includes("cost_cap_reached"));
  assert.ok(!steps.includes("model_called")); // stopped before the model call
  const record = await repo.get("req_cap");
  assert.equal(record.status, "capped");
});

test("model cap at zero: the orchestrator stops before the model call (capped)", async () => {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const useCase = buildUseCase(logger, repo, { maxToolCalls: 16, maxModelCalls: 0 });

  const res = await useCase.handle({ prompt: "hello" }, "viewer");

  assert.equal(res.status, "capped");
  const steps = logger.events.map((e) => e.step);
  assert.ok(steps.includes("cost_cap_reached"));
  assert.ok(!steps.includes("model_called"));
});

test("generous caps: nominal run, status done", async () => {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const useCase = buildUseCase(logger, repo, { maxToolCalls: 16, maxModelCalls: 4 });

  const res = await useCase.handle({ prompt: "hello" }, "viewer");

  assert.equal(res.status, "done");
  assert.deepEqual(res.toolsUsed, ["word_count"]);
});

test("token ceiling: the run is capped when cumulated tokens exceed MAX_RUN_TOKENS", async () => {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  // Ceiling of 1 token: the single echo model call (a few tokens) exceeds it.
  const useCase = buildUseCase(logger, repo, {
    maxToolCalls: 16,
    maxModelCalls: 4,
    maxRunTokens: 1,
  });

  const res = await useCase.handle({ prompt: "hello" }, "viewer");

  assert.equal(res.status, "capped");
  const steps = logger.events.map((e) => e.step);
  assert.ok(steps.includes("model_called")); // the call happened...
  assert.ok(steps.includes("cost_cap_reached")); // ...then the ceiling fired
  const capEvent = logger.events.find((e) => e.step === "cost_cap_reached");
  assert.equal(capEvent?.data?.limit, "run_tokens");
  const record = await repo.get("req_cap");
  assert.equal(record.status, "capped");
});

test("token ceiling: a generous MAX_RUN_TOKENS leaves the run nominal", async () => {
  const logger = new CapturingLogger();
  const repo = new InMemoryRunRepository();
  const useCase = buildUseCase(logger, repo, {
    maxToolCalls: 16,
    maxModelCalls: 4,
    maxRunTokens: 100_000,
  });
  const res = await useCase.handle({ prompt: "hello" }, "viewer");
  assert.equal(res.status, "done");
});

test("MAX_RUN_TOKENS is read from the environment (optional)", async () => {
  const { loadEnv } = await import("../src/infrastructure/config/env.ts");
  const env = loadEnv({ MAX_RUN_TOKENS: "5000" } as NodeJS.ProcessEnv);
  assert.equal(env.MAX_RUN_TOKENS, 5000);
  const envWithout = loadEnv({} as NodeJS.ProcessEnv);
  assert.equal(envWithout.MAX_RUN_TOKENS, undefined);
});
