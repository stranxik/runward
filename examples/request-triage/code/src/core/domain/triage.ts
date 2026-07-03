// Pure triage domain. Zero framework, zero I/O; zod is used as a schema
// library only. Mirrors the TriageRecord v1.0 contract of the mission
// documents (../../runward/architecture.md §3): closed category vocabulary,
// provenance-marked fields, target queue, confidence level.

import { z } from "zod";

// ----------------------------------------------------------------------------
// Closed category vocabulary. Anything else is a validation failure, not a
// new category (contracts/model-port.md). "unknown" is a first-class answer:
// abstention beats a plausible guess.
// ----------------------------------------------------------------------------
export const CATEGORIES = ["support", "sales", "compliance", "unknown"] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// ----------------------------------------------------------------------------
// Provenance markers (ADR-0002). A model output is a hypothesis, never a
// fact: it enters the system marked "model-proposed" and nothing acts on it
// until the deterministic guard has promoted it to "verified" (checked
// against a source of truth) or replaced it with a "computed" value.
// ----------------------------------------------------------------------------
export const ProvenanceSchema = z.enum(["computed", "verified", "model-proposed"]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export interface TriageField {
  value: string;
  provenance: Provenance;
}

// ----------------------------------------------------------------------------
// Input entity: one raw inbound request (contracts/request-intake.md,
// reduced). The body is untrusted free text by definition. strict(): no
// smuggled keys cross the boundary.
// ----------------------------------------------------------------------------
export const InboundRequestSchema = z
  .object({
    requestId: z.string().min(1, "A request identifier cannot be empty."),
    senderAddress: z.string().min(3),
    body: z.string().min(1, "The body cannot be empty.").max(8000),
  })
  .strict();
export type InboundRequest = z.infer<typeof InboundRequestSchema>;

// ----------------------------------------------------------------------------
// Output entity: the validated triage record. Every field that can drive an
// action carries a provenance marker; the routing port refuses, fail-closed,
// any action-bearing field still "model-proposed".
// ----------------------------------------------------------------------------
export type TriageStatus =
  | "routed" // assigned to a team queue through the routing port
  | "suspended" // compliance: awaiting human approval (fail-closed, not frozen)
  | "needs_review" // abstention or guard escalation: human review queue
  | "rejected"; // approval denied on resume: never routed

export interface TriageRecord {
  requestId: string;
  category: Category;
  confidence: Confidence;
  // Resolved against the account registry, or absent. Never model-trusted.
  accountRef?: TriageField & { accountName?: string };
  // Re-parsed deterministically from the source text, or absent. The model's
  // proposal for this field is always discarded (ADR-0002).
  deadline?: TriageField;
}

export interface TriageResult {
  record: TriageRecord;
  status: TriageStatus;
  targetQueue: string;
  // Present when routed: the ticketing reference returned by the port.
  ticketRef?: string;
  // Present when suspended or escalated: why a human is in the loop.
  reason?: string;
}

// Queue resolution is deterministic policy, never a model output.
export const QUEUE_BY_CATEGORY: Record<Category, string> = {
  support: "support-queue",
  sales: "sales-queue",
  compliance: "compliance-queue",
  unknown: "review-queue",
};

export const REVIEW_QUEUE = "review-queue";
