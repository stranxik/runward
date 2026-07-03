// Middleware chain around every tool call. Adding a guardrail happens here,
// without touching the tools: logging, access control, cost, approval point.
//
// "Onion" model: each middleware receives the context and a `next`. It can
// act before, delegate, act after, or short-circuit (access denied, approval
// denied).

import type { ToolDefinition, ToolRole } from "../core/ports/out/tool.port.js";
import type { Logger } from "./observability/logger.js";
import { UnauthorizedError, ApprovalDeniedError } from "./errors.js";

// Context of a tool invocation traveling through the chain.
export interface ToolInvocation {
  tool: ToolDefinition;
  input: unknown;
  callerRole: ToolRole;
  requestId: string;
  // Shared cost meter of the trajectory (incremented by the cost middleware).
  costMeter: { toolCalls: number };
  // Human decision carried by a RESUMED run. Undefined on a first pass: the
  // approval middleware then consults the gate. Set by resumeRun only.
  approvalDecision?: "approve" | "reject";
}

export type Next = () => Promise<unknown>;
export type ToolMiddleware = (
  ctx: ToolInvocation,
  next: Next,
) => Promise<unknown>;

// Role hierarchy: a higher role includes the rights of the lower ones.
const ROLE_RANK: Record<ToolRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

// Injectable approval function. Three outcomes:
//   true     -> explicit synchronous approval: execute.
//   false    -> explicit synchronous denial: throw (fail-closed).
//   "absent" -> no decision available NOW: suspend-and-rehydrate. The run is
//               serialized and the process freed; a human decides later
//               through resumeRun. Fail-closed without freezing the process.
export type ApprovalGate = (ctx: ToolInvocation) => boolean | "absent";

// Suspension signal: returned (not thrown) by the approval middleware when an
// impactful tool needs an approval that is not available. Suspension is a
// normal outcome of a run, not an error. The tool did NOT execute.
export class SuspensionRequired {
  constructor(
    readonly tool: string,
    // Exact, already-validated tool arguments — what the approver decides on.
    readonly input: unknown,
    // Deterministic summary built from those arguments (see below).
    readonly summary: string,
  ) {}
}

export function isSuspensionRequired(v: unknown): v is SuspensionRequired {
  return v instanceof SuspensionRequired;
}

// Canonical JSON: object keys sorted recursively. Two identical inputs always
// produce the same string — the summary is reproducible and comparable.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// Deterministic approval summary. Built by CODE from the exact tool
// arguments; the model never phrases what the human approves. Faithful by
// construction: same tool + same arguments = same summary, always.
export function buildApprovalSummary(toolName: string, input: unknown): string {
  return `Approval required: tool "${toolName}" with arguments ${canonicalJson(input)}`;
}

// --- Provided middlewares ----------------------------------------------------

// 1. Logging: traces the entry and exit of every tool.
export function loggingMiddleware(logger: Logger): ToolMiddleware {
  return async (ctx, next) => {
    logger.log("info", "tool_invoke", {
      module: "middleware.log",
      requestId: ctx.requestId,
      tool: ctx.tool.name,
    });
    const out = await next();
    logger.log("info", "tool_done", {
      module: "middleware.log",
      requestId: ctx.requestId,
      tool: ctx.tool.name,
    });
    return out;
  };
}

// 2. Access control: checks that the caller role reaches the minimum role.
export function accessMiddleware(): ToolMiddleware {
  return async (ctx, next) => {
    if (ROLE_RANK[ctx.callerRole] < ROLE_RANK[ctx.tool.minRole]) {
      throw new UnauthorizedError(
        `Role "${ctx.callerRole}" cannot call tool "${ctx.tool.name}" (required: ${ctx.tool.minRole}).`,
      );
    }
    return next();
  };
}

// 3. Cost: increments the shared meter. Feeds cost control.
export function costMiddleware(logger: Logger): ToolMiddleware {
  return async (ctx, next) => {
    ctx.costMeter.toolCalls += 1;
    logger.log("debug", "cost_tick", {
      module: "middleware.cost",
      requestId: ctx.requestId,
      toolCalls: ctx.costMeter.toolCalls,
    });
    return next();
  };
}

// 4. Approval: for impactful tools, requires approval before execution.
//    The guard is carried by the infrastructure, not by the model.
//    A resumed run carries the human decision in the context; a first pass
//    consults the gate. When no decision exists ("absent"), the middleware
//    short-circuits with a SuspensionRequired signal: the tool never starts,
//    the orchestrator serializes the run and frees the process.
export function approvalMiddleware(gate: ApprovalGate): ToolMiddleware {
  return async (ctx, next) => {
    if (!ctx.tool.requiresApproval) return next();

    // Decision carried by a resumed run wins over the gate.
    if (ctx.approvalDecision === "approve") return next();
    if (ctx.approvalDecision === "reject") {
      throw new ApprovalDeniedError(
        `Approval denied for impactful tool "${ctx.tool.name}".`,
      );
    }

    const outcome = gate(ctx);
    if (outcome === true) return next();
    if (outcome === false) {
      throw new ApprovalDeniedError(
        `Approval denied for impactful tool "${ctx.tool.name}".`,
      );
    }
    // "absent": suspend, do not block. Execution never starts.
    return new SuspensionRequired(
      ctx.tool.name,
      ctx.input,
      buildApprovalSummary(ctx.tool.name, ctx.input),
    );
  };
}

// Composes a list of middlewares into a single execution function.
// Order matters: log -> access -> cost -> approval -> tool execution.
export function composeMiddleware(
  middlewares: ToolMiddleware[],
  terminal: (ctx: ToolInvocation) => Promise<unknown>,
): (ctx: ToolInvocation) => Promise<unknown> {
  return (ctx) => {
    let index = -1;
    const dispatch = (i: number): Promise<unknown> => {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times."));
      }
      index = i;
      const mw = middlewares[i];
      if (!mw) return terminal(ctx);
      return mw(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  };
}
