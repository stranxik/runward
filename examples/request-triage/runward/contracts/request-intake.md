# Port Contract: RequestIntakePort

## Port: RequestIntakePort

**Contract version**: v1.0
**Port type**: primary (drives the domain)
**Known adapters**: mailbox adapter, web-form adapter

## Business intent

Deliver one raw inbound request into the triage domain, whatever channel it arrived on. A "request" here is a single message from one requester asking the organization for something — the channel's envelope (mail headers, form metadata) is normalized at this boundary and never leaks into the domain.

## Signature

```
submit(rawRequest) -> intakeReceipt        — idempotent on sourceMessageId, sync
```

## Input schema

| Field | Type | Required | Constraint |
|---|---|---|---|
| source | enum | yes | `mailbox` or `web-form` |
| sourceMessageId | string | yes | channel-native ID; idempotency key |
| receivedAt | timestamp | yes | channel receipt time, UTC |
| senderAddress | string | yes | as given by the channel; verified later by the guard, not here |
| subject | string | no | absent for some form submissions |
| body | string | yes | raw free text, untrusted by definition |

## Output schema

| Field | Type | Always present | Constraint |
|---|---|---|---|
| requestId | uuid | yes | unique; the ID propagated through the whole trajectory |
| accepted | boolean | yes | false only on validation rejection |

## Invariants

- Every accepted request yields exactly one requestId; resubmitting the same sourceMessageId returns the same one.
- Intake never mutates the source channel and never triages — it accepts and hands over.
- The body is stored verbatim; normalization is recorded as derived data, never destructive.

## Errors

| Error | Type | Meaning for the consumer |
|---|---|---|
| malformed payload | validation | rejected at the boundary; the channel adapter keeps the original for manual pickup |
| duplicate sourceMessageId | business | not an error — same receipt returned (idempotent) |
| store unavailable | unavailable | fail closed: the adapter retries from the channel; nothing is acknowledged unpersisted |

## Evolution rule

Versioned; additive by default (new optional fields, tolerant readers); a breaking change goes expand-then-contract across both channel adapters before the old shape retires.

## References

- [../architecture.md](../architecture.md) §3 — port table.
- [model-port.md](model-port.md) — next step in the fixed sequential plan.
