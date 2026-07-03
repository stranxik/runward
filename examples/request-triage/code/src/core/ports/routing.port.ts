// Secondary port: the system's only action on the world
// (../../runward/contracts/routing-port.md). Assign one validated triage
// record to a queue. The most guarded boundary: it acts on verified facts
// only and fails closed.
//
// Invariants the adapter must hold:
//   - refuse any record whose action-bearing fields are still
//     "model-proposed" (fail-closed on provenance, ADR-0002);
//   - never assign a compliance-flagged record without a recorded approval;
//   - idempotent on requestId (no duplicate tickets).

import type { TriageRecord } from "../domain/triage.js";

export interface RoutingApproval {
  approvedBy: string;
  at: string; // ISO timestamp
}

export interface RoutingConfirmation {
  ticketRef: string;
  routedAt: string; // ISO timestamp, UTC
  queue: string;
  approval?: RoutingApproval;
}

export interface RoutingPort {
  assign(
    record: TriageRecord,
    targetQueue: string,
    approval?: RoutingApproval,
  ): Promise<RoutingConfirmation>;
}
