# Port Contract: RoutingPort

## Port: RoutingPort

**Contract version**: v1.0
**Port type**: secondary (driven by the domain)
**Known adapters**: ticketing anticorruption adapter (translates TriageRecord into the ticketing API's dialect — see architecture.md §6)

## Business intent

Assign one validated triage record to a queue in the ticketing system — the organization's system of record. This is the system's only action on the world, which makes it the most guarded boundary: it acts on verified facts only, and fails closed.

## Signature

```
assign(triageRecord) -> routingConfirmation   — idempotent on requestId, sync
                                              — approval required: compliance-flagged records, always
```

## Input schema

| Field | Type | Required | Constraint |
|---|---|---|---|
| triageRecord | TriageRecord v1.0 | yes | schema-validated; every field carries a provenance marker |
| targetQueue | string | yes | resolved deterministically by queue resolution, never model-proposed |

## Output schema

| Field | Type | Always present | Constraint |
|---|---|---|---|
| ticketRef | string | yes | the ticketing system's reference for the routed request |
| routedAt | timestamp | yes | UTC |

## Invariants

- **Fail-closed on provenance**: any record whose action-bearing fields are still `model-proposed` is refused — it goes to human review, never through (ADR-0002).
- A compliance-flagged record is never assigned without a recorded human approval.
- Assigning the same requestId twice returns the existing ticketRef; no duplicate tickets.
- The ticketing dialect never crosses this boundary inward — translation lives entirely in the adapter.

## Errors

| Error | Type | Meaning for the consumer |
|---|---|---|
| provenance refusal | business | expected guard path — record escalates to review with per-field reasons |
| unknown target queue | business | ticketing configuration drifted; escalate to the on-call, translation table needs an update |
| ticketing API unavailable | unavailable | fail closed: record queues durably, retry with backoff — nothing routes blind, nothing is dropped |

## Evolution rule

Versioned; additive by default. The translation table in the anticorruption adapter is versioned with the contract and re-verified against the ticketing configuration on every ticketing-side change (the named cost of architecture.md §6).

## References

- [../architecture.md](../architecture.md) §6 — the anticorruption boundary this port sits behind.
- [../governance/threat-model.md](../governance/threat-model.md) §4 — the approval points enforced here.
