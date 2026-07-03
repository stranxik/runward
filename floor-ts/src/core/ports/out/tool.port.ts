// Secondary port: a tool the orchestrator can invoke.
// The tool registry is the single surface where logging, access control,
// metrics, cost and approvals all pass. A tool declares in its contract its
// risk level and whether it requires human approval. The guard is carried by
// the infrastructure, not by the model's discipline (see rule:
// security-prompt-injection).

import { z } from "zod";

export type ToolRole = "viewer" | "operator" | "admin";

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
