# ADR-0005: Baseline-worktree test validation is out of scope for the gate

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor benchmark (Spec Kitty `review/baseline.py`) and against ADR-0001's invariant, challenge, durable position

## Context

The competitor benchmark surfaced a pattern (P4) worth examining: Spec Kitty spins an isolated git worktree on the base branch, runs the project's tests, parses the JUnit output, and separates pre-existing failures from newly-introduced ones — so that a test cited as evidence is honest, not "it was already red". Tempting to adopt so an `applied | test/x.test.ts` pointer is proven, not merely present.

Reality-check against runward's own boundaries kills the fit:

1. **The gate never runs anything.** ADR-0001 fixes the gate as deterministic and non-executing: it checks the presence of a traced decision, never runs a test, never opens the project's runtime. Running a worktree and a test suite is exactly what the gate must not do.
2. **runward is language- and runtime-neutral.** It does not know the project's test command, its framework, or its JUnit dialect. Owning a test runner would be a language lock-in against the adapter-neutrality the whole method rests on.
3. **It duplicates the project's CI.** Whether a test is new, passing, and actually exercises the rule is the project CI's and the operator's job — precisely the responsibility the gate hands back to the operator.

## Decision

**Do not adopt baseline-worktree test validation as a runward mechanism.** The gate stays zero-run and neutral. runward's contribution to test-evidence honesty stops at what it can do deterministically without running anything:

- **P3 (ADR-0004)** already verifies that an `applied` test pointer's file resolves — it catches a deleted or moved test.
- Beyond that, whether the test is honest is judged by the operator at the gate, aided by their own CI.

An operator who genuinely wants enforced test-baseline validation plugs their own tooling around `check` through the hook seam (the P8 decision), running *their* test runner — runward still runs nothing itself.

## Alternatives discarded

- **Run the project's tests in the gate.** Violates the zero-run invariant of ADR-0001 and the vendor/language neutrality of the method.
- **Bundle a test runner and a JUnit parser.** Language lock-in; runward would stop being neutral and start being a build tool.
- **A shallow "the test file exists" check inside the gate.** Already delivered by P3's drift detection; nothing to add.

## Consequences

- **Positive.** The gate stays deterministic, zero-run, neutral; runward does not grow a language-specific test-execution surface it cannot own honestly. The scope line ("we govern the decision, the project's CI governs its own tests") stays crisp — a credibility asset, not a gap to hide.
- **Negative, accepted.** runward does not, by itself, prove a cited test is honest. Accepted: that is the project CI's job, and P3 already catches the common failure (a vanished test).

## Reevaluation trigger (mandatory, dated)

Reopen if recurring evidence shows P3's file-existence check is insufficient and operators systematically cite tests that do not run or do not exercise the rule. The response then is **not** to make runward run tests, but to expose the operator's own test-baseline check through the hook seam (P8, ADR to come) — operator-supplied, still zero-run for runward.

**Trigger set on**: 2026-07-07 · **Watched via**: the conformance-gate incident log.

## Amendment (2026-08-14) — the letter is superseded on one alternative; the substance stands

The discarded alternative "Bundle a test runner and a JUnit parser" bundled two refusals, and they
aged differently. What this ADR protected — the gate RUNS nothing: no runner spun, no worktree, no
project test executed — stands untouched and is now proven structurally (the transitive
import-closure test of the verdict path, `test/unit/runtime-boundary.test.js`, ADR-0054). But
[ADR-0056](ADR-0056-the-evidence-layer-widens.md) later added a READER of a committed
`junit.xml` (`src/lib/tool-adapters.ts`): a `test:reports/junit.xml::Name` pointer resolves against
the recorded result — present-and-green, present-and-red, absent — by reading bytes at rest, never
by spawning anything. That is a parser, and it is not the lock-in this ADR refused: no runner is
bundled, no language is privileged (JUnit XML is a cross-language interchange format), and the
project's CI still owns running its own tests. The 2026-08-14 audit named the silent contradiction
between this file's letter and the shipped adapter; this amendment records it. The refusal that
remains in force: runward never RUNS a test, never spins a worktree, never separates pre-existing
from introduced failures — that baseline mechanism stays out of the gate, exactly as decided.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the zero-run, deterministic invariant this decision protects.
- [ADR-0004](ADR-0004-advisory-drift-detection-of-applied-pointers.md) — the file-resolution check that already covers vanished test files.
- Spec Kitty `review/baseline.py` — the pattern considered and, on reality-check, kept out of the gate.
