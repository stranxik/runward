# Port Contract: ModelPort

## Port: ModelPort

**Contract version**: v1.0
**Port type**: secondary (driven by the domain)
**Known adapters**: approved-deployment gateway adapter; deterministic keyword fallback classifier

## Business intent

Propose a classification and key-field extractions for one raw request text. The output is a **hypothesis, never a fact**: every proposed value is marked `model-proposed` and nothing downstream may act on it before the deterministic guard (ADR-0002). The reasoning engine is bound by this contract, not by its brand — the fallback classifier honors the same contract with lower recall.

## Signature

```
propose(requestText) -> triageProposal     — not idempotent, sync, no approval (proposes only, acts on nothing)
```

## Input schema

| Field | Type | Required | Constraint |
|---|---|---|---|
| requestId | uuid | yes | propagated for tracing |
| requestText | string | yes | subject + body, untrusted; passed as data inside a fixed instruction frame |

## Output schema

| Field | Type | Always present | Constraint |
|---|---|---|---|
| category | enum | yes | closed vocabulary: `support`, `sales`, `compliance`, `unknown` |
| fields | list | yes | may be empty; each entry: name, proposed value, source span in the text |
| confidence | enum | yes | `high`, `medium`, `low` |

## Invariants

- Every proposed field carries the span of source text it was read from — a value with no span is rejected at the schema.
- The category never leaves the closed vocabulary; anything else is a validation failure, not a new category.
- All output is provenance-marked `model-proposed`; this port cannot produce `verified` or `computed` values.

## Errors

| Error | Type | Meaning for the consumer |
|---|---|---|
| timeout / overload | transient | retry with bounded backoff, then fall back |
| non-conforming output | validation | single retry with the diagnostic fed back; then treat as `unknown`, low confidence |
| gateway unavailable | unavailable | switch to the fallback adapter behind this same port; the domain does not notice |

## Evolution rule

Versioned; the category vocabulary belongs to the TriageRecord contract — extending it (e.g. v1.1 for the unknown-rate trigger, floor.md §5) is a governed, additive contract change gated by a labeled sample, never a free prompt edit.

## References

- [../adr/ADR-0002-deterministic-guard-on-extracted-fields.md](../adr/ADR-0002-deterministic-guard-on-extracted-fields.md) — why this port's output never acts unguarded.
- [../governance/evaluation-rubric.md](../governance/evaluation-rubric.md) — how this port's behavior is evaluated.
