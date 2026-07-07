# ADR-0002: Harden the --strict gate against vacuous passing

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against a competitor code benchmark (BMAD, Spec Kit, OpenSpec, Spec Kitty), challenge, durable position

## Context

`runward check --strict` (ADR-0001) verifies that every CRITICAL/HIGH rule mapped to a phase is accounted for in that phase's conformance manifest. A code-level benchmark of the four spec-driven competitors surfaced a real weakness by comparison: Spec Kitty invests explicitly in making its deterministic gate hard to neutralize (a non-vacuity tactic, a self-mutation test, a shrink-only allowlist ratchet), while runward's gate can pass **vacuously**. Three trivial gaming vectors exist today:

1. **Strip the mapping.** Remove the `phases:` frontmatter from a phase's rules and the expected set collapses to zero, so `--strict` turns green with nothing checked.
2. **Empty n/a.** Mark every rule `n/a` with a one-word or placeholder reason; the gate accepts it.
3. **Silent regression of the guard.** Nothing proves the gate still catches a real violation after a refactor.

A gate that can be neutralized in one edit is not a gate. Since runward's central claim is precisely that it has the per-rule conformance gate no competitor has, that gate must resist obvious gaming. The decision is taken at the tooling boundary (the `check` command and the rule schema), never in a mission's domain, and it must stay deterministic with no LLM in the gate path.

## Decision

Add deterministic non-vacuity guards to `--strict`, keeping the invariant intact (presence of a traced decision, never code quality; zero LLM):

1. **Routed-count floor.** A pinned per-phase minimum of mapped CRITICAL/HIGH rules (`EXPECTED_MAPPED`, e.g. architect ≥ 5, floor ≥ 10, govern ≥ 7). If the shipped rule set maps fewer than the floor, `--strict` fails and `doctor` flags it. Lowering a floor is a visible, tracked edit — itself an ADR-worthy change — so the mapping cannot be silently stripped to pass.
2. **Non-trivial `n/a`.** An `n/a` reason must be more than a placeholder: non-empty, above a minimum length, and not a bracketed template token. A lazy blanket `n/a` no longer passes.
3. **Self-mutation test.** The suite plants a real violation and asserts the gate catches it (red), pinning the guarantee that `--strict` still bites after any refactor. This formalizes what the smoke test already does into a named non-vacuity guarantee.

Explicitly out of scope: a shrink-only allowlist ratchet — runward has no violation-allowlist mechanism to ratchet, so the attack it defends against does not exist here. Noted, not built.

## Alternatives discarded

- **Trust the operator to notice a stripped mapping.** Defeats the gate's purpose; the whole point is that neutralizing it must be loud, not silent.
- **An LLM check of whether an `n/a` reason is legitimate.** Violates the zero-LLM invariant of the gate and reintroduces the non-determinism ADR-0001 rejected. Legitimacy of an `n/a` stays the operator's judgment at the gate; the tool only enforces that a real reason is present.
- **Shrink-only allowlist ratchet (Spec Kitty).** Not applicable: no allowlist exists to ratchet. Adopt the *principle* (non-vacuity), not this specific mechanism.

## Consequences

- **Positive.** The gate resists the three obvious gaming vectors; runward's differentiating claim ("the per-rule gate no one else has") is backed by a gate that is actually hard to neutralize.
- **Negative, accepted.** The routed-count floor must be updated when the mapping legitimately grows or shrinks — a deliberate, tracked edit (which is the point). A small maintenance surface on `check`, `doctor` and the constants.
- **On other boundaries.** `check --strict` gains three deterministic guards; `doctor` gains a floor check; the smoke suite gains a self-mutation assertion. No change to the mission domain or to the zero-LLM invariant.

## Reevaluation trigger (mandatory, dated)

Reopen if any of:
- **(a)** a new gaming vector is observed that these guards miss (e.g. a way to satisfy the manifest without a real decision);
- **(b)** the routed-count floor produces false positives on a legitimate mapping change often enough to be edited reflexively — a sign it should be derived, not pinned;
- **(c)** the `n/a` minimum-length heuristic rejects genuine short reasons in practice.

**Trigger set on**: 2026-07-07 · **Watched via**: the conformance-gaming incident log and periodic review of the gate against new competitor hardening.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the gate this hardens.
- Code benchmark of BMAD / Spec Kit / OpenSpec / Spec Kitty (2026-07-07) — Spec Kitty's `architectural-gate-non-vacuity.tactic.yaml` and shrink-only ratchet as the reference for hardening; its own audit notes most of those elements are aspirational, so the principle is adopted, not the unproven machinery.
- `src/lib/conformance.ts`, `src/commands/check.ts`, `src/commands/doctor.ts` — the surfaces this ADR touches.
