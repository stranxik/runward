// Orchestrator use case: the floor of the request-triage mission
// (../../runward/floor.md). One short dependent sequence (ADR-0001):
// validate -> model proposes -> deterministic guard verifies/recomputes ->
// route. The orchestrator composes; the business rules live in the domain
// (guard) and at the boundaries (routing invariants).
//
// Compliance is fail-closed WITHOUT freezing the process: the validated
// record is serialized as a pending routing and the call returns
// "suspended"; resumeTriage() rehydrates it on the human decision. Approve
// routes with the approval recorded; reject means the routing never happens.

import {
  InboundRequestSchema,
  QUEUE_BY_CATEGORY,
  REVIEW_QUEUE,
  type InboundRequest,
  type TriageRecord,
  type TriageResult,
} from "../domain/triage.js";
import {
  guardCategory,
  guardFields,
  buildApprovalSummary,
} from "../domain/guard.js";
import type { TriageModelPort } from "../ports/model-provider.port.js";
import type { AccountRegistryPort } from "../ports/account-registry.port.js";
import type { RoutingPort } from "../ports/routing.port.js";
import type { TriageLogPort } from "../ports/triage-log.port.js";

export interface TriageDeps {
  model: TriageModelPort;
  registry: AccountRegistryPort;
  routing: RoutingPort;
  log: TriageLogPort;
  clock: { nowIso(): string };
}

export class TriageRequestUseCase {
  constructor(private readonly deps: TriageDeps) {}

  async triage(rawInput: InboundRequest): Promise<TriageResult> {
    const { model, registry, routing, log, clock } = this.deps;

    // 1. Validation at the boundary: never trust the input.
    const parsed = InboundRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    const input = parsed.data;
    await log.append(input.requestId, {
      at: clock.nowIso(),
      event: "received",
      detail: `from=${input.senderAddress}`,
    });

    // 2. The model proposes. Everything it returns is a hypothesis.
    const proposal = await model.propose(input.body);

    // 3. Deterministic guard (ADR-0002): closed vocabulary, registry
    //    resolution, deadline re-parsed from the source text.
    const category = guardCategory(proposal.category);
    const guarded = guardFields(proposal, input.body, registry);

    const record: TriageRecord = {
      requestId: input.requestId,
      category,
      confidence: proposal.confidence,
      ...(guarded.accountRef ? { accountRef: guarded.accountRef } : {}),
      ...(guarded.deadline ? { deadline: guarded.deadline } : {}),
    };

    // 4. Abstention is a first-class answer: an unknown category or a low
    //    confidence never routes — human review, not a plausible guess.
    if (category === "unknown" || proposal.confidence === "low") {
      const reason = "abstention: category unknown or confidence too low";
      await log.append(input.requestId, {
        at: clock.nowIso(),
        event: "escalated",
        detail: reason,
      });
      return { record, status: "needs_review", targetQueue: REVIEW_QUEUE, reason };
    }

    // 5. Guard escalation: a proposed value that failed verification never
    //    routes (fail-closed) — review is cheaper than misrouting.
    if (guarded.escalations.length > 0) {
      const reason = guarded.escalations.join("; ");
      await log.append(input.requestId, {
        at: clock.nowIso(),
        event: "escalated",
        detail: reason,
      });
      return { record, status: "needs_review", targetQueue: REVIEW_QUEUE, reason };
    }

    const targetQueue = QUEUE_BY_CATEGORY[category];

    // 6. Compliance: approval required, always (the mission's attached
    //    condition: no silent miss). Suspend, do not block: serialize the
    //    validated record and free the process. The summary the approver
    //    sees is deterministic, built from the validated fields.
    if (category === "compliance") {
      const summary = buildApprovalSummary(
        input.requestId,
        category,
        targetQueue,
        record.accountRef,
        record.deadline,
      );
      await log.setPending(input.requestId, {
        record,
        targetQueue,
        summary,
        suspendedAt: clock.nowIso(),
      });
      await log.append(input.requestId, {
        at: clock.nowIso(),
        event: "suspended",
        detail: summary,
      });
      return { record, status: "suspended", targetQueue, reason: summary };
    }

    // 7. Support / sales: route directly through the guarded port.
    const confirmation = await routing.assign(record, targetQueue);
    await log.append(input.requestId, {
      at: clock.nowIso(),
      event: "routed",
      detail: `queue=${confirmation.queue} ticket=${confirmation.ticketRef}`,
    });
    return {
      record,
      status: "routed",
      targetQueue: confirmation.queue,
      ticketRef: confirmation.ticketRef,
    };
  }

  // Rehydrates a suspended compliance record on the human decision.
  // "approve" routes it with the approval recorded; "reject" ends it — the
  // routing never happens.
  async resumeTriage(
    requestId: string,
    decision: "approve" | "reject",
    decidedBy: string,
  ): Promise<TriageResult> {
    const { routing, log, clock } = this.deps;

    const pending = await log.getPending(requestId);
    if (!pending) {
      throw new Error(`Request "${requestId}" is not suspended.`);
    }

    await log.append(requestId, {
      at: clock.nowIso(),
      event: "approval_decision",
      detail: `${decision} by=${decidedBy}`,
    });

    if (decision === "reject") {
      await log.clearPending(requestId);
      await log.append(requestId, {
        at: clock.nowIso(),
        event: "rejected",
        detail: "routing never executed",
      });
      return {
        record: pending.record,
        status: "rejected",
        targetQueue: pending.targetQueue,
        reason: `approval rejected by ${decidedBy}`,
      };
    }

    // Approve: route the EXACT serialized record, approval recorded.
    const confirmation = await routing.assign(pending.record, pending.targetQueue, {
      approvedBy: decidedBy,
      at: clock.nowIso(),
    });
    await log.clearPending(requestId);
    await log.append(requestId, {
      at: clock.nowIso(),
      event: "routed",
      detail: `queue=${confirmation.queue} ticket=${confirmation.ticketRef} approved_by=${decidedBy}`,
    });
    return {
      record: pending.record,
      status: "routed",
      targetQueue: confirmation.queue,
      ticketRef: confirmation.ticketRef,
    };
  }
}
