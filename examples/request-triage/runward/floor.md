# Floor Note: Inbound Request Triage

**Date**: 2026-06-19 · **Version**: v0.1 · **Architecture note**: [architecture.md](architecture.md) · **Success criterion**: "The share of requests routed to the correct team on first assignment, measured on real inbound traffic over at least two weeks, exceeds the manual baseline measured over the same period the previous month. Attached condition: no compliance-category request may be routed to a non-compliance queue without human review."

> **Note.** All figures below are **illustrative**. They exist to show what a proof record contains and how it reads — not to report a real engagement.

## 1. Scope shipped

| Component | Status | Notes |
|---|---|---|
| Entry point (mailbox + web-form adapters on RequestIntakePort) | shipped | wired to the real shared mailbox — actual traffic, not a demo feed |
| Single orchestrator | shipped | fixed sequential plan per ADR-0001; composes only, no business logic |
| Model port (real adapter, provider-agnostic) | shipped | active against the approved deployment with a key; deterministic keyword-based fallback classifier without |
| Persistence (immutable interaction log) | shipped | append-only, attached to entity: inbound request (one trajectory per request ID) |
| Deterministic guardrails | shipped | ADR-0002 guard on all action-bearing fields; provenance markers enforced at RoutingPort, fail-closed |
| Baseline observability + cost ceiling | shipped | request ID propagated end to end; per-run ceiling: 2 model calls, hard stop with escalation to review |

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| frontier-deterministic-boundary | applied | code/src/core/domain/guard.ts — every action-bearing field recomputed/verified (ADR-0002), fail-closed |
| hexa-move-deterministic-out | applied | code/src/core/domain/guard.ts + keyword classifier — classification and validation are deterministic |
| config-secrets-boundary | n/a | the illustrative floor runs the deterministic keyword classifier; no provider secret is read in this example code |
| provider-llm-auto-detection | n/a | only the deterministic keyword adapter ships here; no real provider to auto-detect |
| security-prompt-injection | applied | threat-model §3 + ADR-0002 — model-proposed values never act; request text is data, not instruction |
| hexa-architecture | applied | code/src/core/ pure domain behind four ports |
| hexa-adapter-pattern | applied | code/src/adapters/ — mailbox/web, keyword-model, routing, log behind ports |
| provider-no-crash-missing-env | applied | code/src/adapters/keyword-model.adapter.ts — deterministic fallback runs with no key |
| state-event-sourcing | applied | code/src/adapters/in-memory-triage-log.adapter.ts — append-only, keyed by request ID |
| tools-scope-atomicity | applied | architecture §2 middleware chain + approval on RoutingPort for compliance records |

## 2. Proof against the success criterion

- **Traffic used**: 200 real requests replayed from the previous month's mailbox archive (stratified across the three categories to match observed proportions), then one week of live shadow traffic (~380 requests) routed in parallel with the manual process. No hand-picked cases.
- **Measured result** *(illustrative)*: routing accuracy 87% on first assignment on the replayed set, against a manual baseline of 71% reconstructed from the ticketing system's reassignment history for the same month. Live shadow week: 84%, baseline that week 73%. Attached condition held: 100% of compliance-category requests reached the compliance queue or human review; zero silent misses. Guard escalation rate: 14% (under the 25% reevaluation trigger of ADR-0002).
- **Verdict**: criterion met on the replayed sample and the first live week. The gate to `iterate` requires the full two-week live window per the criterion's wording — one more week of live measurement before the gate is crossed. Partial by duration, not by result.
- **Observability check**: confirmed — a full trajectory (intake, model proposal, per-field guard outcome, routing decision, persistence) reconstructs from a single request ID; verified on 10 randomly drawn requests.

## 3. Gaps and deviations

| Gap / deviation | Impact | Agreed with sponsor |
|---|---|---|
| Manual baseline reconstructed from reassignment history, not observed live (the framing DoR risk) | baseline may understate manual accuracy — reassignments not logged in the ticketing system are invisible | 2026-06-05, sponsor accepted the reconstruction method and owns the residual uncertainty |
| Web-form adapter shipped one week after the mailbox adapter | first replay set is mailbox-only; live shadow week covers both | 2026-06-12 |
| `unknown` category runs at 9% of live traffic, above the 5% assumed at framing | more human-review load than planned; absorbed by coordinators so far | 2026-06-19, watched weekly |

## 4. Deferrals confirmed

| Deferred capability | Trigger being watched | Signal observed so far |
|---|---|---|
| Auto-drafted acknowledgments | accuracy above baseline for 4 consecutive weeks | 1 of 4 weeks accumulated |
| Priority scoring in queues | deadline misses under FIFO in receiving teams | none |
| Requester memory / continuity | measured repeat-requester rate where prior context changes routing | early signs — 6% of live requests were repeat requesters; routing unchanged in all observed cases |
| Multi-agent decomposition | parallelizable or isolation-requiring subtask (ADR-0001) | none — attachments remain out of scope |
| Externalized state | multi-instance need or replay-on-restart failure | none |

## 5. Next tier

Hold the floor and complete the second live week to close the gate. The closest trigger is the `unknown`-category rate: if it stays above 5%, the evidence points to extending the category vocabulary — a governed, versioned contract change (TriageRecord v1.1), gated by a labeled sample of the `unknown` cases, not a free edit. No other trigger is near firing; no complexity is added without one.
