// Pure domain. Zero framework, zero I/O, zero network dependency.
// The only import here is zod, treated as a schema library (not a framework).
// The domain expresses its needs as contracts; it knows nothing about the model,
// the persistence, or the transport (see rules: hexa-architecture,
// hexa-llm-boundary-principle).

import { z } from "zod";

// ----------------------------------------------------------------------------
// Value object: RequestId. Identifier propagated end to end (observability).
// A single identifier travels from the entry point down to every tool and
// model call — the precondition for auditability (see rule:
// patterns-request-id-propagation).
// ----------------------------------------------------------------------------
export const RequestIdSchema = z
  .string()
  .min(1, "A request identifier cannot be empty.");
export type RequestId = z.infer<typeof RequestIdSchema>;

// ----------------------------------------------------------------------------
// Input entity: the user request entering the system.
//
// SECURITY CONTRACT — the caller's role is NOT part of this payload. A role
// carried by the request body would be self-declared privilege: any client
// could claim "admin". The role is resolved by the inbound adapter from an
// authenticated principal and passed as a separate argument to the use case
// (see HandleRequestPort). The schema is strict(): a payload smuggling a
// "role" key (or any unknown key) is rejected at the boundary.
// ----------------------------------------------------------------------------
export const UserRequestSchema = z
  .object({
    // The request text. Size is bounded: a boundary validates its inputs.
    prompt: z.string().min(1, "The prompt cannot be empty.").max(4000),
  })
  .strict();
export type UserRequest = z.infer<typeof UserRequestSchema>;

// ----------------------------------------------------------------------------
// Output entity: the synthesized response returned to the caller.
// ----------------------------------------------------------------------------
export const AgentResponseSchema = z.object({
  requestId: RequestIdSchema,
  answer: z.string(),
  // Tools actually invoked (useful for audit and for teaching).
  toolsUsed: z.array(z.string()),
  // End-of-run status. "done" on the nominal path, "capped" when a cost cap
  // was reached and the orchestrator stopped on a partial synthesis,
  // "suspended" when an impactful tool awaits a human approval (the run is
  // serialized, the process is freed), "rejected" when the human denied the
  // approval on resume (the tool never executed).
  status: z.enum(["done", "capped", "suspended", "rejected"]).default("done"),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ----------------------------------------------------------------------------
// Pure business rule (testable without any mock): classify a request by
// complexity, which will drive the model tier choice (fast / balanced / deep).
// Everything deterministic stays out of the model (see rule:
// frontier-deterministic-boundary).
// ----------------------------------------------------------------------------
export type Complexity = "simple" | "balanced" | "deep";

export function classifyComplexity(prompt: string): Complexity {
  const length = prompt.trim().length;
  // Toy keyword heuristic — replace with your own signal in a real mission.
  const wantsAnalysis = /\b(analyse|compare|strateg|pourquoi|explique)\b/i.test(
    prompt,
  );
  if (wantsAnalysis || length > 400) return "deep";
  if (length > 80) return "balanced";
  return "simple";
}
