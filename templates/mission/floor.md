# Floor Note: [system name]

> **Usage.** Produce this note at the end of the `floor` workflow, once the floor runs on real traffic. It records what was shipped, what was measured against the success criterion, the gaps, and the next tier. A floor is not delivered, it is proven — this note is the proof record. Replace every `[placeholder]`; delete this notice on delivery.

**Date**: [YYYY-MM-DD] · **Version**: [vX.Y] · **Architecture note**: [link] · **Success criterion**: [restate it verbatim from the framing note]

## 1. Scope shipped

[Exactly what the floor contains — and confirmation that the six floor components are present.]

| Component | Status | Notes |
|---|---|---|
| Entry point ([interface / API / tool protocol]) | [shipped] | [matched to actual use, not a demo] |
| Single orchestrator | [shipped] | [composes only, no business logic] |
| Model port (real adapter, provider-agnostic) | [shipped] | [active with a key, deterministic fallback without] |
| Persistence (immutable interaction log) | [shipped] | [attached to entity: [entity]] |
| Deterministic guardrails | [shipped] | [classification, validation, mutation access control] |
| Baseline observability + cost ceiling | [shipped] | [request ID propagated; per-run ceiling: [value]] |

## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the floor phase (`runward/rules/`, frontmatter `phases: [floor]`). Status: `applied` needs an evidence pointer (a `file:line` or a test); `deviated` needs an ADR reference; `n/a` needs a one-line reason. `runward check --strict` verifies this table is complete and well-formed — it does not judge your implementation; you do, at the gate.

| Rule | Status | Evidence |
|---|---|---|
| [rule-slug] | applied \| deviated \| n/a | [file:line, a test, ADR-id, or a reason] |

## 2. Proof against the success criterion

[The measurement, on real traffic or a representative sample — never on cases picked to impress.]

- **Traffic used**: [source, volume, period, representativeness.]
- **Measured result**: [the number or observable fact, against the criterion.]
- **Verdict**: [criterion met / partially met / not met — and what that means for the gate.]
- **Observability check**: [confirmation that a full trajectory reconstructs from a single request ID.]

## 3. Gaps and deviations

[Anything shipped differently from the architecture note, and anything the measurement revealed. Deviations were agreed with the sponsor, never silent.]

| Gap / deviation | Impact | Agreed with sponsor |
|---|---|---|
| [gap] | [impact] | [date / reference] |

## 4. Deferrals confirmed

[The floor's named deferrals, restated with their triggers — the watchlist for `iterate`.]

| Deferred capability | Trigger being watched | Signal observed so far |
|---|---|---|
| [long-term memory] | [measured cross-session need] | [none / early signs] |

## 5. Next tier

[What the evidence recommends: which trigger is closest to firing, which evolution it would command, and what proof would gate it. Or: hold the floor as is.]
