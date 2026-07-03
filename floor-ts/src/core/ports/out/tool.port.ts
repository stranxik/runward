// Secondary port: a tool the orchestrator can invoke.
// The tool registry is the single surface where logging, access control,
// metrics, cost and approvals all pass. A tool declares in its contract its
// risk level and whether it requires human approval. The guard is carried by
// the infrastructure, not by the model's discipline (see rule:
// security-prompt-injection).

import { z } from "zod";

export type ToolRole = "viewer" | "operator" | "admin";

// Role hierarchy: a higher role includes the rights of the lower ones.
// Exported so infrastructure (middleware, registry) and use cases share one
// definition of "role X reaches minimum role Y".
export const ROLE_RANK: Record<ToolRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

export function roleAtLeast(role: ToolRole, min: ToolRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Declarative tool definition. The zod schema guards the input boundary.
export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  // Input schema: validated at the boundary (contract tests).
  input: z.ZodType<I>;
  // Minimum role required to even see, then call, this tool.
  minRole: ToolRole;
  // Impactful tool: requires human approval before execution.
  requiresApproval: boolean;
  // The actual implementation. Free of any cross-cutting infrastructure: the
  // middleware handles log, access, cost and approval around it.
  execute(input: I): Promise<O>;
}
