# Observability Schema: Inbound Request Triage Qualifier

**Version**: v1.0 · **Last review**: 2026-06-19

Wired from day zero through the middleware chain — the floor's proof (floor.md §2) was measured on this instrumentation, not retrofitted. Ceilings and field names are **illustrative**.

## 1. The three levels

| Level | What | Fields | Use |
|---|---|---|---|
| **Structured logs** | one JSON line per event | module, request_id, timestamp, level, event | aggregation, search, alerting on guard-escalation and unknown-category rates |
| **Lifecycle events** | every orchestrator step and tool call, persisted with the triage log | step, tool, input digest, output digest, status, duration | trajectory replay, behavioral audit, weekly observability review |
| **Per-model-call metrics** | one measurement per inference (max two per run) | input tokens, output tokens, model version, duration, status, attempt | cost tracking per request; feeds the per-run ceiling |

## 2. Propagated request ID

- **Origin**: generated at intake — one UUID per accepted request, mapped from the mailbox message ID or form submission ID (both stored for cross-reference).
- **Propagation**: passed to both model calls, every deterministic tool call, the guard, RoutingPort and PersistencePort.
- **Parent/child lineage**: not needed at the floor — single orchestrator, no sub-agents (ADR-0001); one trajectory per request ID. The field structure reserves a parent_id, empty until a topology trigger fires.
- **Carrier field**: `request_id` in logs, events and metrics.

## 3. Provenance

- **Per-inference fingerprint**: hash of the exact prompt frame plus raw request text injected on each call, stored with the lifecycle event.
- **Associated versions**: prompt version and model version recorded per inference, so a behavior change is attributable to the exact pair that produced it.
- **Linkage**: fingerprint, versions, guard outcomes and routing decision all share the request_id — one identifier unfolds the full decision.

## 4. Unfolding a decision (audit)

No consolidated memory exists at the floor — the triage log is raw and append-only, so unfolding is direct: given a request_id, replay intake payload, model proposal, per-field guard outcome with provenance marker (`computed`, `verified`, `model-proposed`), routing or escalation, and persistence — verified on 10 randomly drawn requests at the floor gate (floor.md §2). When requester memory enters (named deferral), consolidation pointers become mandatory here before the first consolidated item is written.

## 5. Cost ceilings

- **Per-run ceiling**: 2 model calls per request, hard stop — an overrun escalates the request to human review with the partial record, never loops.
- **Aggregate counter**: weekly model-spend counter across all runs; alert threshold set with the sponsor (illustrative: alert at the cost of 600 requests/week, ~1.5× observed volume).
- **Behavior on overrun**: intake continues, model calls pause, every request routes to the review queue via the deterministic fallback classifier — degraded but honest.
- **Structural cost levers**: the deterministic frontier (validation, parsing and queue resolution pay no model call); a single default tier (tier routing is a matrix arbitration, untriggered at 400 req/week); stable prompt frame for cache hits.

## References

- [evaluation-rubric.md](evaluation-rubric.md) — sampled off this trace stream.
- [threat-model.md](threat-model.md) — the immutable log guardrail this schema implements.
- [../runbook.md](../runbook.md) — incident diagnosis starts from the request_id.
