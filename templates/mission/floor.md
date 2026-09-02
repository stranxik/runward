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
>
> Evidence can be **typed**, and typed pointers are verified deterministically at the gate: `file:PATH[:LINE][#SYMBOL]` · `test:PATH[::NAME]` · `adr:NNNN` — several per cell, separated by `;`. The gate checks resolution, non-emptiness, line count, symbol/test-name presence, and the rule's `signature:` when it declares one (ADR-0019/0020). Free prose stays valid — it is your judgment; a path it cites must simply not point at an empty file.

| Rule | Status | Evidence |
|---|---|---|
| [rule-slug] | applied \| deviated \| n/a | [file:line, a test, ADR-id, or a reason] |

## 2. Proof against the success criterion

<!-- gate: every field below present; the **Metric** and **Threshold (success)** lines echo
     framing.md §3 character for character; Period is date..date; Verdict is one of the closed
     list. The gate reads the SHAPE of the measurement — never whether it is true. -->

[The measurement, on real traffic or a representative sample — never on cases picked to impress.]

**Criterion**: [SC-1]
**Metric**: [echo the framing SC's Metric line verbatim]
**Threshold (success)**: [echo the framing SC's Threshold line verbatim]
**Traffic used**: [source, volume, representativeness]
**Period**: [YYYY-MM-DD..YYYY-MM-DD]
**Measured result**: [the number or observable fact, against the criterion]
**Verdict**: [met | partially-met | not-met — and what that means for the gate]
**Observability check**: [confirmation that a full trajectory reconstructs from a single request ID]

**Behavioral proof**: `[the command that proves the floor's behavior, e.g. cd code && npm test]`
**Proof artifact**: [optional — a result file the command writes, e.g. code/test-results.json; runward reports it present/fresh, never runs or reads it]

> The gate above is the *documentary* proof (the decisions are traced). This line is the *behavioral* proof (your code actually runs). runward never executes it — it is not a runtime; on a green `--strict` it only reports the pointer, and the artifact's presence and freshness if you name one.

## 3. Gaps and deviations

[Anything shipped differently from the architecture note, and anything the measurement revealed. Deviations were agreed with the sponsor, never silent.]

<!-- gate: at least one non-bracket row is REQUIRED when the Verdict above is below met — a
     shortfall with zero named gaps is a shape error, not a judgment. -->

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
