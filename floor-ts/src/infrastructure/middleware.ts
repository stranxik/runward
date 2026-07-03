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

// Injectable approval function. In a PoC, a deterministic rule; in
// production, a real human checkpoint (approve, deny, edit).
export type ApprovalGate = (ctx: ToolInvocation) => boolean;

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
export function approvalMiddleware(gate: ApprovalGate): ToolMiddleware {
  return async (ctx, next) => {
    if (ctx.tool.requiresApproval) {
      const approved = gate(ctx);
      if (!approved) {
        throw new ApprovalDeniedError(
          `Approval denied for impactful tool "${ctx.tool.name}".`,
        );
      }
    }
    return next();
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
