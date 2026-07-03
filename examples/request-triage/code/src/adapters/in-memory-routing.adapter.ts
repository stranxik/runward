// Routing adapter: in-memory stand-in for the ticketing anticorruption
// adapter. It enforces the port's invariants itself — the guard is carried
// by the boundary, not by the caller's discipline:
//   - fail-closed on provenance: any action-bearing field still
//     "model-proposed" is refused (ADR-0002);
//   - a compliance record is never assigned without a recorded approval;
//   - idempotent on requestId: assigning twice returns the same ticketRef.

import type {
  RoutingPort,
  RoutingApproval,
  RoutingConfirmation,
} from "../core/ports/routing.port.js";
import type { TriageRecord } from "../core/domain/triage.js";

export class ProvenanceRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvenanceRefusalError";
  }
}

export class ApprovalMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalMissingError";
  }
}

export class InMemoryRoutingAdapter implements RoutingPort {
  private readonly tickets = new Map<string, RoutingConfirmation>();
  private seq = 0;

  // Test observability: how many assignments actually happened.
  get assignments(): number {
    return this.tickets.size;
  }

  async assign(
    record: TriageRecord,
    targetQueue: string,
    approval?: RoutingApproval,
  ): Promise<RoutingConfirmation> {
    // Fail-closed on provenance: refuse, never repair.
    const actionBearing = [record.accountRef, record.deadline].filter(
      (f): f is NonNullable<typeof f> => f !== undefined,
    );
    const unverified = actionBearing.filter(
      (f) => f.provenance === "model-proposed",
    );
    if (unverified.length > 0) {
      throw new ProvenanceRefusalError(
        `Refused (fail-closed): action-bearing field(s) still model-proposed: ${unverified
          .map((f) => f.value)
          .join(", ")}.`,
      );
    }

    // A compliance record never routes without a recorded human approval.
    if (record.category === "compliance" && !approval) {
      throw new ApprovalMissingError(
        `Refused (fail-closed): compliance record "${record.requestId}" has no recorded approval.`,
      );
    }

    // Idempotent on requestId: no duplicate tickets.
    const existing = this.tickets.get(record.requestId);
    if (existing) return existing;

    const confirmation: RoutingConfirmation = {
      ticketRef: `TCK-${++this.seq}`,
      routedAt: new Date().toISOString(),
      queue: targetQueue,
      approval,
    };
    this.tickets.set(record.requestId, confirmation);
    return confirmation;
  }
}
