// Orchestrator use case: a reduced plan-and-execute loop.
// The orchestrator drives the loop — plan, delegate, synthesize; it contains no
// business logic, it composes. It is a stateless reducer: all persistence goes
// through RunRepositoryPort; no instance field carries run state.
//
// Explicit dependencies injected through the constructor (dependency
// inversion). The orchestrator only knows ports and the registry, never a
// concrete adapter.

import { createHash } from "node:crypto";

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
import type {
  RunRepositoryPort,
  PromptProvenance,
} from "../ports/out/run-repository.port.js";
import type { ClockPort } from "../ports/out/clock.port.js";
import { roleAtLeast, type ToolRole } from "../ports/out/tool.port.js";
import type { ToolRegistry } from "../../infrastructure/registry.js";
import {
  isSuspensionRequired,
  type SuspensionRequired,
} from "../../infrastructure/middleware.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../../infrastructure/errors.js";

// SHA-256 (hex) of the prompt actually sent. A pure, deterministic function:
// no I/O, no clock, no randomness — safe in the application layer.
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

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
  // Optional ceiling on cumulated tokens (input + output) per run. Call
  // counters bound the number of calls; this bounds what actually drives the
  // bill. Undefined = no token ceiling.
  maxRunTokens?: number;
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

// Cost meter of one trajectory. toolCalls is incremented by the cost
// middleware, modelCalls and tokens by the orchestrator.
interface CostMeter {
  toolCalls: number;
  modelCalls: number;
  tokens: number;
}

export class HandleRequestUseCase implements HandleRequestPort {
  constructor(private readonly deps: HandleRequestDeps) {}

  // callerRole contract: resolved by the inbound adapter from an
  // authenticated principal — NEVER from the request payload. The payload
  // schema (strict) rejects any "role" key smuggled by a client.
  async handle(rawInput: UserRequest, callerRole: ToolRole): Promise<AgentResponse> {
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
    // The cost meter tracks tool calls (incremented by the middleware),
    // model calls and cumulated tokens (incremented here). It feeds the
    // per-run cost caps.
    const costMeter: CostMeter = { toolCalls: 0, modelCalls: 0, tokens: 0 };

    await repo.create(requestId);
    logger.emitCycleEvent({ requestId, step: "request_received", data: { role: callerRole } });

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
    //    Tool outputs are kept: they feed the synthesis prompt below.
    const toolsUsed: string[] = [];
    const toolResults: Array<{ tool: string; output: unknown }> = [];
    const visibleTools = registry.listFor(callerRole).map((t) => t.name);
    if (visibleTools.includes("word_count")) {
      // Cost guardrail: no new tool call beyond the cap.
      if (costMeter.toolCalls >= limits.maxToolCalls) {
        return this.capRun(requestId, "tool_calls", costMeter, toolsUsed);
      }
      const output = await registry.invoke(
        "word_count",
        { text: input.prompt },
        callerRole,
        requestId,
        costMeter,
      );
      toolsUsed.push("word_count");
      toolResults.push({ tool: "word_count", output });
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
    //    The tool results are injected into the synthesis prompt: an
    //    observation the model never sees is a tool call wasted.
    const synthesisPrompt = toolResults.length
      ? `${input.prompt}\n\n[tool_results]\n${toolResults
          .map((r) => `${r.tool}: ${JSON.stringify(r.output)}`)
          .join("\n")}`
      : input.prompt;
    costMeter.modelCalls += 1;
    const result = await model.generate({ tier, prompt: synthesisPrompt });
    costMeter.tokens += result.inputTokens + result.outputTokens;
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "model_call",
      detail: `tier=${result.tier} in=${result.inputTokens} out=${result.outputTokens}`,
    });
    // Prompt provenance: one fingerprint per model call — request id, hash of
    // the prompt ACTUALLY sent, model identity, tier, timestamp, and the
    // recorded output. Audit re-reads this entry; it never replays the call.
    await repo.appendProvenance(requestId, {
      requestId,
      promptSha256: sha256Hex(synthesisPrompt),
      model: result.model,
      tier: result.tier,
      at: clock.nowIso(),
      outputText: result.text,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
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

    // Cost guardrail: cumulated token ceiling for the run (when configured).
    if (limits.maxRunTokens !== undefined && costMeter.tokens > limits.maxRunTokens) {
      return this.capRun(requestId, "run_tokens", costMeter, toolsUsed);
    }

    // 6. Impactful step: roles that see publish_note (operator+) publish the
    //    synthesized answer. The tool contract requires approval; when none
    //    is available NOW, the middleware short-circuits with a suspension
    //    signal — the run is serialized and the process freed (suspend, do
    //    not block). resumeRun() rehydrates it on the human decision.
    if (visibleTools.includes("publish_note")) {
      if (costMeter.toolCalls >= limits.maxToolCalls) {
        return this.capRun(requestId, "tool_calls", costMeter, toolsUsed);
      }
      const outcome = await registry.invoke(
        "publish_note",
        { content: result.text },
        callerRole,
        requestId,
        costMeter,
      );
      if (isSuspensionRequired(outcome)) {
        return this.suspendRun(requestId, outcome, result.text, toolsUsed, costMeter);
      }
      toolsUsed.push("publish_note");
      await repo.appendStep(requestId, {
        at: clock.nowIso(),
        kind: "tool_call",
        detail: "publish_note",
      });
      logger.emitCycleEvent({ requestId, step: "tool_called", data: { tool: "publish_note" } });
    }

    // 7. Synthesis: assemble the final answer.
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "synthesis",
      detail: `toolCalls=${costMeter.toolCalls}`,
    });
    await repo.updateStatus(requestId, "done");
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
    limit: "tool_calls" | "model_calls" | "run_tokens",
    costMeter: CostMeter,
    toolsUsed: string[],
  ): Promise<AgentResponse> {
    const { repo, clock, logger } = this.deps;
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "synthesis",
      detail: `cost_cap_reached (${limit}) toolCalls=${costMeter.toolCalls} modelCalls=${costMeter.modelCalls} tokens=${costMeter.tokens}`,
    });
    await repo.updateStatus(requestId, "capped");
    logger.emitCycleEvent({
      requestId,
      step: "cost_cap_reached",
      data: {
        limit,
        toolCalls: costMeter.toolCalls,
        modelCalls: costMeter.modelCalls,
        runTokens: costMeter.tokens,
      },
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

  // Suspend-and-rehydrate, half one: serialize the trajectory (status +
  // pending tool step + EXACT tool arguments + resume context) behind the
  // repository port, then free the process. The answer presented to the
  // approver is the deterministic summary built by the middleware from the
  // real arguments — never a model reformulation.
  private async suspendRun(
    requestId: RequestId,
    signal: SuspensionRequired,
    answerSoFar: string,
    toolsUsed: string[],
    costMeter: CostMeter,
  ): Promise<AgentResponse> {
    const { repo, clock, logger } = this.deps;
    await repo.appendStep(requestId, {
      at: clock.nowIso(),
      kind: "approval_requested",
      detail: signal.summary,
    });
    await repo.suspend(requestId, {
      tool: signal.tool,
      input: signal.input,
      summary: signal.summary,
      suspendedAt: clock.nowIso(),
      answerSoFar,
      toolsUsed: [...toolsUsed],
      costMeter: { ...costMeter },
    });
    logger.emitCycleEvent({
      requestId,
      step: "suspended",
      data: { tool: signal.tool },
    });
    return {
      requestId,
      answer: signal.summary,
      toolsUsed: [...toolsUsed],
      status: "suspended",
    };
  }

  // Suspend-and-rehydrate, half two: reload the serialized trajectory and
  // resume exactly where it stopped. "approve" executes the pending tool with
  // its exact serialized arguments and finishes the run; "reject" ends the
  // run "rejected" — the execution never happens.
  async resumeRun(
    runId: RequestId,
    decision: "approve" | "reject",
    callerRole: ToolRole,
  ): Promise<AgentResponse> {
    const { repo, clock, registry, logger } = this.deps;

    const record = await repo.get(runId);
    if (record.status !== "suspended" || !record.pending) {
      throw new ValidationError(
        `Run "${runId}" is not suspended (status: ${record.status}).`,
      );
    }
    const pending = record.pending;

    const tool = registry.find(pending.tool);
    if (!tool) {
      throw new NotFoundError(`Unknown tool: "${pending.tool}".`);
    }
    // The decider must at least hold the tool's minimum role. Same contract
    // as handle(): the role comes from an authenticated principal.
    if (!roleAtLeast(callerRole, tool.minRole)) {
      throw new UnauthorizedError(
        `Role "${callerRole}" cannot decide on tool "${pending.tool}" (required: ${tool.minRole}).`,
      );
    }

    await repo.appendStep(runId, {
      at: clock.nowIso(),
      kind: "approval_decision",
      detail: `${decision} tool=${pending.tool} role=${callerRole}`,
    });

    if (decision === "reject") {
      // The execution never happens: clear the pending step and close.
      await repo.clearPending(runId);
      await repo.updateStatus(runId, "rejected");
      logger.emitCycleEvent({
        requestId: runId,
        step: "approval_rejected",
        data: { tool: pending.tool },
      });
      return {
        requestId: runId,
        answer: `Approval rejected: tool "${pending.tool}" was not executed.`,
        toolsUsed: [...pending.toolsUsed],
        status: "rejected",
      };
    }

    // Approve: rehydrate the exact serialized invocation (same tool, same
    // arguments, same cost meter) and resume. The middleware chain still
    // runs in full; the human decision travels in the invocation context.
    const costMeter: CostMeter = { ...pending.costMeter };
    await registry.invoke(
      pending.tool,
      pending.input,
      callerRole,
      runId,
      costMeter,
      "approve",
    );
    const toolsUsed = [...pending.toolsUsed, pending.tool];
    await repo.appendStep(runId, {
      at: clock.nowIso(),
      kind: "tool_call",
      detail: pending.tool,
    });
    logger.emitCycleEvent({
      requestId: runId,
      step: "tool_called",
      data: { tool: pending.tool },
    });
    await repo.appendStep(runId, {
      at: clock.nowIso(),
      kind: "synthesis",
      detail: `resumed toolCalls=${costMeter.toolCalls}`,
    });
    await repo.clearPending(runId);
    await repo.updateStatus(runId, "done");
    logger.emitCycleEvent({
      requestId: runId,
      step: "done",
      data: { toolCalls: costMeter.toolCalls, resumed: true },
    });
    return {
      requestId: runId,
      answer: pending.answerSoFar,
      toolsUsed,
      status: "done",
    };
  }

  // Provenance journal of a run: one fingerprint per model call. The audit
  // path re-reads the recorded output; it never replays the call.
  async getProvenance(runId: RequestId): Promise<PromptProvenance[]> {
    return this.deps.repo.getProvenance(runId);
  }
}
