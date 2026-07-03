// Orchestrator use case: a reduced plan-and-execute loop.
// The orchestrator drives the loop — plan, delegate, synthesize; it contains no
// business logic, it composes. It is a stateless reducer: all persistence goes
// through RunRepositoryPort; no instance field carries run state.
//
// Explicit dependencies injected through the constructor (dependency
// inversion). The orchestrator only knows ports and the registry, never a
// concrete adapter.

import {
  UserRequestSchema,
  type UserRequest,
  type AgentResponse,
  type RequestId,
  classifyComplexity,
  type Complexity,
} from "../domain/request.js";
import type { HandleRequestPort } from "../ports/in/handle-request.port.js";
import type { ModelProviderPort, ModelTier } from "../ports/out/model-provider.port.js";
import type { RunRepositoryPort } from "../ports/out/run-repository.port.js";
import type { ClockPort } from "../ports/out/clock.port.js";
import type { ToolRole } from "../ports/out/tool.port.js";
import type { ToolRegistry } from "../../infrastructure/registry.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import { ValidationError } from "../../infrastructure/errors.js";

// Business complexity (deterministic) maps to a model tier.
const TIER_BY_COMPLEXITY: Record<Complexity, ModelTier> = {
  simple: "fast",
  balanced: "balanced",
  deep: "deep",
};

// Per-run cost caps (governance from day zero). Beyond them, the orchestrator
// stops and returns a partial synthesis (status "capped").
export interface CostLimits {
  maxToolCalls: number;
  maxModelCalls: number;
}

export interface HandleRequestDeps {
  model: ModelProviderPort;
  repo: RunRepositoryPort;
  clock: ClockPort;
  registry: ToolRegistry;
  logger: Logger;
  // Request-id factory, injected to stay deterministic in tests.
  newRequestId: () => RequestId;
  // Per-run cost caps. Optional: sober defaults when not provided.
  limits?: CostLimits;
}

const DEFAULT_LIMITS: CostLimits = { maxToolCalls: 16, maxModelCalls: 4 };

export class HandleRequestUseCase implements HandleRequestPort {
  constructor(private readonly deps: HandleRequestDeps) {}

  async handle(rawInput: UserRequest): Promise<AgentResponse> {
    const { model, repo, clock, registry, logger, newRequestId } = this.deps;
    const limits = this.deps.limits ?? DEFAULT_LIMITS;

    // 1. Validation at the boundary: never trust the input.
    const parsed = UserRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    const input: UserRequest = parsed.data;

    // 2. Trajectory identity, propagated everywhere (observability).
    const requestId = newRequestId();
    const role = input.role as ToolRole;
    // The cost meter tracks tool calls (incremented by the middleware) and
    // model calls (incremented here). It feeds the per-run cost cap.
    const costMeter = { toolCalls: 0, modelCalls: 0 };

    await repo.save({ requestId, status: "running", steps: [] });
    logger.emitCycleEvent({ requestId, step: "request_received", data: { role } });

    // 3. Plan (reduced): classify complexity (deterministic) -> model tier.
    const complexity = classifyComplexity(input.prompt);
    const tier = TIER_BY_COMPLEXITY[complexity];
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "plan",
      detail: `complexity=${complexity} -> tier=${tier}`,
    });
    logger.emitCycleEvent({ requestId, step: "planned", data: { complexity, tier } });

    // 4. Execute: call a read tool through the registry + middleware chain.
    //    The registry applies log / access / cost / approval around the tool.
    const toolsUsed: string[] = [];
    const visibleTools = registry.listFor(role).map((t) => t.name);
    if (visibleTools.includes("word_count")) {
      // Cost guardrail: no new tool call beyond the cap.
      if (costMeter.toolCalls >= limits.maxToolCalls) {
        return this.capRun(requestId, "tool_calls", costMeter, toolsUsed);
      }
      await registry.invoke(
        "word_count",
        { text: input.prompt },
        role,
        requestId,
        costMeter,
      );
      toolsUsed.push("word_count");
      await repo.appendStep(requestId, {
        at: clock.nowIso(),
        kind: "tool_call",
        detail: "word_count",
      });
      logger.emitCycleEvent({ requestId, step: "tool_called", data: { tool: "word_count" } });
    }

    // Cost guardrail: no model call beyond the cap.
    if (costMeter.modelCalls >= limits.maxModelCalls) {
      return this.capRun(requestId, "model_calls", costMeter, toolsUsed);
    }

    // 5. Model call through the port (deterministic echo adapter by default).
    costMeter.modelCalls += 1;
    const result = await model.generate({ tier, prompt: input.prompt });
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "model_call",
      detail: `tier=${result.tier} in=${result.inputTokens} out=${result.outputTokens}`,
    });
    logger.emitCycleEvent({
      requestId,
      step: "model_called",
      data: {
        tier: result.tier,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    // 6. Synthesis: assemble the final answer.
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "synthesis",
      detail: `toolCalls=${costMeter.toolCalls}`,
    });
    const current = await repo.get(requestId);
    await repo.save({ ...current, status: "done" });
    logger.emitCycleEvent({ requestId, step: "done", data: { toolCalls: costMeter.toolCalls } });

    return {
      requestId,
      answer: result.text,
      toolsUsed,
      status: "done",
    };
  }

  // Cleanly stops a run that hits a cost cap: persists the "capped" status,
  // emits the cost_cap_reached event, and returns a synthesis of what was done
  // instead of pressing on.
  private async capRun(
    requestId: RequestId,
    limit: "tool_calls" | "model_calls",
    costMeter: { toolCalls: number; modelCalls: number },
    toolsUsed: string[],
  ): Promise<AgentResponse> {
    const { repo, clock, logger } = this.deps;
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "synthesis",
      detail: `cost_cap_reached (${limit}) toolCalls=${costMeter.toolCalls} modelCalls=${costMeter.modelCalls}`,
    });
    const current = await repo.get(requestId);
    await repo.save({ ...current, status: "capped" });
    logger.emitCycleEvent({
      requestId,
      step: "cost_cap_reached",
      data: { limit, toolCalls: costMeter.toolCalls, modelCalls: costMeter.modelCalls },
    });
    return {
      requestId,
      answer: `Cost cap reached (${limit}). Partial synthesis: tools called = ${
        toolsUsed.length ? toolsUsed.join(", ") : "none"
      }; model calls = ${costMeter.modelCalls}.`,
      toolsUsed,
      status: "capped",
    };
  }
}
