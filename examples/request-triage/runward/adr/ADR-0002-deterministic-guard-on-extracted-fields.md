# ADR-0002: deterministic guard on model-extracted fields

**Date**: 2026-05-12
**Status**: accepted
**Deciders**: delivery engineer, Head of Operations (sponsor)
**Method**: decision-loop: reality-check on the TriageRecord contract, challenge on failure modes, durable position

## Context

The model proposes the classification and the extracted key fields (requester identity, account reference, stated deadline). Those fields drive an action: routing into the ticketing system, where a wrong account reference attaches the request to the wrong customer and a missed deadline flag can breach a regulatory response window. A model-proposed value is a hypothesis, not a fact — plausible-looking account references and dates are exactly what a language model fabricates most fluently. The framing note's attached condition (no silent miss on compliance requests) makes this the highest-stakes boundary in the system. The decision is taken at the domain's output boundary, between the model port and the routing port.

## Decision

Every model-extracted field is validated or recomputed deterministically before any action is taken on it. **The model never supplies a value the system can compute or verify itself.** Concretely: account references are resolved against the account registry (a deterministic tool) — a reference that does not resolve is dropped to `unverified`, never routed on; deadlines are re-parsed from the source text by a deterministic date parser, and the model's proposal is discarded in favor of the parsed value; requester identity is matched against the sender address before being trusted. Each field in the TriageRecord carries a provenance marker (`computed`, `verified`, `model-proposed`); the RoutingPort refuses, fail-closed, any record whose action-bearing fields are still `model-proposed`. Records that fail the guard go to the human review queue with the failure reason attached.

## Alternatives discarded

- **Trust the model's structured output**: discarded. Schema-valid is not correct — a well-formed fabricated account reference passes every JSON check and still routes to the wrong customer. Structure guarantees shape, not truth.
- **Second model call as verifier**: discarded. A verifier model has the same failure class as the extractor; it converts a deterministic check the system can do for free into a probabilistic one that costs tokens. Verification that can be computed must be computed.
- **Post-hoc detection (flag anomalies after routing)**: discarded. Detection after the action is too late for deadline-bearing compliance requests; the framing note's attached condition demands the miss never happen, not that it be noticed.

## Consequences

- **Positive**: no fabricated value can trigger an action; the guard is pure and unit-testable without a model in the loop; provenance markers make every routing decision auditable field by field; regressions surface at the boundary, in tests, not in the ticketing system.
- **Negative, accepted**: every deterministic check needs a maintained data source (account registry access, date-parsing rules), and legitimate requests with unresolvable references land in human review — an accepted false-positive cost, since review is cheaper than misrouting.
- **On other boundaries**: the TriageRecord contract gains the provenance marker (additive, v1.0); the observability schema logs guard outcomes per field, which feeds the evaluation rubric; the middleware chain enforces that RoutingPort is unreachable except through the guard.

## Reevaluation trigger (mandatory, dated)

Reopen this decision if the guard's escalation rate — the share of requests sent to human review because fields stayed unverified — exceeds 25% over two consecutive weeks, measured on the observability schema. That level would mean the deterministic sources are too weak for real traffic and the verification strategy (not the principle) needs redesign. Until then, apply without reopening.

**Trigger set on**: 2026-05-12 · **Watched via**: guard-escalation rate on the weekly observability review

## References

- [architecture.md](../architecture.md) §3 — TriageRecord contract and provenance markers.
- [ADR-0001](ADR-0001-single-orchestrator.md) — the sequential plan that places this guard before RoutingPort.
- Framing note §3 — attached condition on compliance-category requests.
