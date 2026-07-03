// Tool registry: the single invocation surface. The registry knows the tools,
// applies the middleware chain around each one, and filters the exposed list
// by role (tool-level access control: the model never even knows about a tool
// it is not allowed to call).

import type { ToolDefinition, ToolRole } from "../core/ports/out/tool.port.js";
import { ValidationError, NotFoundError } from "./errors.js";
import {
  composeMiddleware,
  type ToolInvocation,
  type ToolMiddleware,
} from "./middleware.js";

const ROLE_RANK: Record<ToolRole, number> = { viewer: 0, operator: 1, admin: 2 };

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(private readonly middlewares: ToolMiddleware[]) {}

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new ValidationError(`Tool already registered: "${tool.name}".`);
    }
    this.tools.set(tool.name, tool);
  }

  // Tools visible for a role: filtered before exposure to the model.
  listFor(role: ToolRole): ToolDefinition[] {
    return [...this.tools.values()].filter(
      (t) => ROLE_RANK[role] >= ROLE_RANK[t.minRole],
    );
  }

  // Invokes a tool through the middleware chain. Validates the input against
  // the schema (typed boundary), then executes. The middleware decides
  // access / cost / approval.
  async invoke(
    name: string,
    rawInput: unknown,
    callerRole: ToolRole,
    requestId: string,
    costMeter: { toolCalls: number },
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new NotFoundError(`Unknown tool: "${name}".`);

    // Contract validation at the boundary.
    const parsed = tool.input.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid input for "${name}": ${parsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
      );
    }

    const ctx: ToolInvocation = {
      tool,
      input: parsed.data,
      callerRole,
      requestId,
      costMeter,
    };

    const run = composeMiddleware(this.middlewares, (c) =>
      c.tool.execute(c.input),
    );
    return run(ctx);
  }
}
