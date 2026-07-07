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
- `src/lib/rule-migrations.ts`, `src/lib/conformance.ts` — the surfaces this ADR touches.
