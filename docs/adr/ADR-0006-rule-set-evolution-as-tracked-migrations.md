# ADR-0006: Rule-set evolution as tracked migrations

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor benchmark (OpenSpec delta model), challenge, durable position

## Context

OpenSpec evolves specs by **delta + merge** — changes are expressed as ADDED / MODIFIED / REMOVED / RENAMED against a living document, with a mandatory Reason and Migration on removals, never by a silent rewrite. runward's craft-rule set evolves too: v0.7.0 already renamed `hexa-llm-boundary-principle` to `hexa-move-deterministic-out`. When a rule is renamed or removed, a mission whose conformance manifest still cites the old slug breaks — P2 (ADR-0003) correctly flags it as an "unknown rule", but with no guidance. The operator is left to guess what happened. A rename should be a **guided migration**, not a dead end.

The decision is at the tooling boundary (the rule set and `check`), deterministic, zero-LLM.

## Decision

Record rule-set deltas in a machine-readable **migration record** shipped with the package. Each entry keys the old slug to a target (for a rename) or none (for a removal), plus a reason and the version it happened in — a mini-ADR integrated into the record. When `check --strict`'s form-lint hits an unknown slug that is a known old name, it enriches the message into `renamed to <new> in <version> (<reason>)` (or, for a removal, states the reason). The record is the living delta of the rule set: it grows by addition, never by silent rewrite.

## Amendment 2026-07-21 — the migration entry as a change contract

Each migration entry is "a mini-ADR integrated into the record" (Decision, above). A mini-ADR that only states a reason is half an ADR: it explains the change but does not bound it. From this date, every new entry added to the migration record must declare, in its drafting, three things:

1. **Invariants preserved.** What the migration does not change — typically: the gate's verdict on manifests that never cited the old slug, the zero-LLM invariant, and the grow-by-addition property of the record itself.
2. **Falsification condition.** The observation that would prove the migration wrong — e.g. a manifest citing the old slug that fails `check --strict` without receiving the guided message, or a rename whose target slug does not exist in the shipped rule set.
3. **Rollback plan.** How the change is undone — for a rule set, ordinarily: pin the previous package version. The record itself is additive, so rolling back the rule change never requires rewriting the record.

The declarations live in the change that ships the entry — the release note or commit adding it — and, where a sentence suffices, in the `reason` field itself. This is a drafting requirement, not a mechanism: the `RuleMigration` shape in `src/lib/rule-migrations.ts` is unchanged, and `check` reads the record exactly as before. The one existing entry (`hexa-llm-boundary-principle`, v0.7.0) predates this amendment and is grandfathered.

The field survey on code as agent harness converges on the same discipline: "Every proposed edit should carry a change contract: which component is modified, which failure mode it targets, what improvement it predicts, which invariants it must preserve, which evaluation can falsify it, and how it can be rolled back" (arXiv 2605.18747, §Emerging Fields and Open Problems). The paper writes this for runtime harness mutation; runward applies it to the evolution of its rule set — the delivery-layer analogue. The convergence is noted as such, not leaned on: the requirement stands on this ADR's own terms — a migration entry is a mini-ADR, and an ADR without invariants, a falsifier, and a rollback path is incomplete — not on the paper's authority.

## Alternatives discarded

- **Silent rename or removal.** Exactly the failure being fixed: a mission breaks with no path forward.
- **An LLM that guesses the intended rule.** Violates the zero-LLM invariant; a recorded mapping is exact, an LLM guess is not.
- **Rewriting the rule's history in place.** Loses the migration trail the operator needs.

## Consequences

- **Positive.** A rename or removal becomes a guided migration; the rule set can evolve without silently breaking existing missions.
- **Negative, accepted.** Every rule rename or removal must add an entry to the record — which is the point: the change is tracked, not silent.
- **On other boundaries.** A new `rule-migrations` record; the form-lint's unknown-rule message reads it. No change to the zero-LLM invariant or the mission domain.

## Reevaluation trigger (mandatory, dated)

Reopen if the migration record grows unwieldy — then prune entries older than a fixed migration window (a few minor versions), documenting the window, so an ancient old slug eventually falls back to a plain "unknown rule".

**Trigger set on**: 2026-07-07 · **Watched via**: the size of the migration record across releases.

## References

- [ADR-0003](ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md) — the unknown-rule check this enriches.
- OpenSpec delta model (ADDED / MODIFIED / REMOVED / RENAMED with Reason/Migration) — the reference adapted.
- arXiv 2605.18747, *Code as Agent Harness*, §Emerging Fields and Open Problems — the "change contract" convergence cited by the 2026-07-21 amendment.
- `src/lib/rule-migrations.ts`, `src/lib/conformance.ts` — the surfaces this ADR touches.
