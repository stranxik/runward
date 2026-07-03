# ADR-[number]: [short decision title]

> **Usage.** An ADR records one structuring decision at the moment it is taken, with its context and consequences, so a future reader understands why the system is what it is. Ground rules: every decision has a lean default and an explicit evolution trigger; no decision is irreversible, because all are taken behind a boundary. The **reevaluation trigger is mandatory and dated** — an ADR without a reopening signal hardens into dogma. One ADR per decision: short, dated, numbered. Never edit an accepted ADR; write a new one that supersedes it. Replace every `[placeholder]`; delete this notice on delivery.

**Date**: [YYYY-MM-DD]
**Status**: [proposed | accepted | superseded by ADR-[n] | deprecated]
**Deciders**: [names or roles]
**Method**: [e.g. decision-loop: reality-check, sourced state of the art, challenge, durable position]

## Context

[The force that demands a decision now. The problem as observed, not as imagined. The hard constraints in play (sovereignty, regulated sector, legacy integration, confidentiality, human approval). What makes this choice structuring rather than local. State at which boundary the decision is taken: domain port, adapter, process boundary, contract.]

## Decision

[What is decided, phrased as a default being applied. One sentence of commitment, then only the strictly necessary detail. If the decision follows a default from the decision matrix, name it and say why it applies here.]

## Alternatives discarded

- **[Alternative A]**: [why discarded — the technical reason, not the habit.]
- **[Alternative B]**: [why discarded.]
- **[Alternative C]**: [why discarded, or tempered rather than eliminated.]

## Consequences

- **Positive**: [what this decision enables or simplifies.]
- **Negative, accepted**: [the cost taken on knowingly — e.g. the explicit translation of a legacy adapter, or eventual consistency when crossing a process boundary.]
- **On other boundaries**: [impact on contracts, observability, security, evaluation.]

## Reevaluation trigger (mandatory, dated)

[The objective, observable signal that will command reopening this decision — a measurable condition, never an intuition. Examples: latency or throughput proven insufficient; move to multi-instance; a genuinely parallelizable subtask appears; a new compliance constraint; behavioral divergence measured beyond a threshold. Until this signal appears, apply the decision without reopening it.]

**Trigger set on**: [YYYY-MM-DD] · **Watched via**: [metric, dashboard, or review cadence]

## References

- [Public source, related ADR, port or contract concerned.]
