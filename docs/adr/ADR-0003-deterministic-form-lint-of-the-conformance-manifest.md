# ADR-0003: Deterministic form-lint of the conformance manifest before the semantic check

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor code benchmark (BMAD `lint_spine.py`), challenge, durable position

## Context

The competitor benchmark surfaced a discipline BMAD applies: a cheap **deterministic form-lint** runs before any judgment (missing fields, duplicate IDs, unpinned versions), so the semantic reviewer only ever sees well-formed input. `runward check --strict` (ADR-0001) verifies presence-of-decision but silently tolerates two form defects in the `Rule conformance` manifest:

1. **Duplicate rows.** `parseManifest` builds a `Map` keyed by rule, so a rule listed twice keeps only the last row and silently drops the other — a contradictory manifest reads as consistent.
2. **Unknown slug.** A row referencing a rule that does not exist (a typo like `frontier-determistic-boundary`) is silently ignored: the rule it was meant to account for stays "not accounted for", but the operator, seeing a row, believes it is handled.

A manifest that looks complete but is malformed is a hole in the gate. The fix is at the tooling boundary (the manifest parser and `check`), deterministic, zero-LLM.

## Decision

Run a deterministic **form-lint** before the semantic conformance check, splitting well-formedness (form) from presence-of-decision (semantics):

1. **A rule listed more than once** in the manifest is a violation.
2. **A manifest row whose slug is not a real rule** (not present under `runward/rules/`, and not a bracketed template token) is a violation — "unknown rule, typo?".

Template placeholder rows (`[rule-slug]`) are ignored: the semantic pass already covers the unfilled case, so flagging them would only add noise on a fresh mission. The split also keeps any future LLM review layer (P7) off malformed input — the cheap deterministic pass first, the expensive judgment only on clean input.

## Alternatives discarded

- **Keep tolerating duplicates and typos.** That is exactly the failure mode being closed: a manifest that looks complete while a rule silently slips.
- **An LLM to detect typos or contradictions.** Violates the zero-LLM invariant of the gate; and set-membership against the shipped rule slugs is exact and deterministic, which an LLM is not.
- **Flag leftover placeholder rows too.** Low value and noisy on fresh missions; the semantic "not accounted for" already carries the unfilled case.

## Consequences

- **Positive.** Typos and duplicate rows can no longer make a manifest read as complete while a rule slips; the gate now checks the manifest is well-formed, not just that decisions are present.
- **Negative, accepted.** A legitimately renamed rule referenced by its old slug will be flagged until the manifest is updated — the intended behaviour, but a small maintenance touch on rename.
- **On other boundaries.** `conformance.ts` gains a form-lint pass and an `allRules` helper; no change to the mission domain or the zero-LLM invariant. Sets up the form-then-semantics ordering the LLM review layer (ADR to come) will build on.

## Reevaluation trigger (mandatory, dated)

Reopen if the unknown-rule check produces false positives in practice — e.g. an intended cross-reference notation in the evidence column being misread as a rule slug, or a rename workflow that needs the old slug to remain valid for a transition window.

**Trigger set on**: 2026-07-07 · **Watched via**: the conformance-gate incident log.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the semantic check this form-lint precedes.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the non-vacuity hardening this continues.
- BMAD `src/bmm-skills/3-solutioning/bmad-architecture/scripts/lint_spine.py` — the "cheap deterministic pass first" reference.
- `src/lib/conformance.ts` — the surface this ADR touches.
