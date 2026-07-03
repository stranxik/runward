# Port Contract: PersistencePort

## Port: PersistencePort

**Contract version**: v1.0
**Port type**: secondary (driven by the domain)
**Known adapters**: append-only store adapter

## Business intent

Append every triage decision to an immutable log, keyed by request ID. The log is the system's truth: audit, replay and recovery all read from it; queue state and metrics are derived views. Nothing is ever updated or deleted — corrections are new entries that reference what they correct.

## Signature

```
append(triageDecision) -> logPosition      — idempotent on (requestId, step), sync
readTrajectory(requestId) -> decisionList  — idempotent, sync, read-only
```

## Input schema

| Field | Type | Required | Constraint |
|---|---|---|---|
| requestId | uuid | yes | one trajectory per request |
| step | enum | yes | `intake`, `proposal`, `guard`, `routing`, `escalation` |
| payload | object | yes | the step's full record, provenance markers included |
| recordedAt | timestamp | yes | UTC |

## Output schema

| Field | Type | Always present | Constraint |
|---|---|---|---|
| logPosition | integer | yes | strictly increasing; gap-free per trajectory |

## Invariants

- Append-only: no operation on this port mutates or removes an existing entry.
- A read never mutates state.
- A trajectory replays in order and completely from its requestId alone — the property verified at the floor gate (floor.md §2, observability check).

## Errors

| Error | Type | Meaning for the consumer |
|---|---|---|
| store unavailable | unavailable | fail closed for action-bearing steps: a decision that cannot be persisted does not act (routing blocks); intake buffers at the channel |
| idempotency conflict | business | same (requestId, step) with different payload — a bug upstream; the entry is refused and the run escalates |

## Evolution rule

Versioned; additive by default — new step types and optional payload fields extend the enum and schema without breaking readers, which tolerate unknown steps. Migrations are forward-only; the log is never rewritten.

## References

- [../governance/observability-schema.md](../governance/observability-schema.md) — lifecycle events persisted through this port.
- [../runbook.md](../runbook.md) §3 — recovery replays this log, never the model.
