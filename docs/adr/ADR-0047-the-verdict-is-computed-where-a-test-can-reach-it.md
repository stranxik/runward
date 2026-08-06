# ADR-0047: the verdict is computed where a test can reach it

**Date**: 2026-08-06
**Status**: accepted (ratified 2026-08-06 — see Ratification)

## Context

[ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) measured what this project's
test net catches on the seven library modules the verdict is computed from, and published the score
with its absences. The largest absence was the one that mattered most: **`src/commands/check.ts`,
where the verdict is assembled and the exit code chosen, was measured by nothing.**

The numbers, re-derived rather than quoted:

- **8.70 % line coverage, 0 % function coverage** on `dist/commands/check.js`.
- No file under `test/unit/` imported `dist/commands/` at all.
- The mutation pass could not reach it either: mutating a file no test imports yields 100 %
  survivors, which is noise and not a measurement, so it was excluded from the perimeter by
  construction rather than by choice.

That produced a sentence an assessor finds by crossing ADR-0046 with the source tree: *we measured
what our net catches, everywhere except where the verdict is decided*. It is also the region the 22
false positives of [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) lived in, and
`docs/compliance/regulated-adoption.md` now hands that fact to regulated buyers under its own
heading. Leaving it stated and unfixed would be the behaviour this project exists to refuse.

**Why it was untestable, precisely.** The verdict was not hidden, it was *interleaved*. A single
309-line async function read the mission, rendered each section, and incremented `gaps`,
`strictGaps` and `hookFailed` as a side effect of printing them. There was no seam: to assert that a
tampered seal reddens the gate, a test had to spawn the CLI and read text. `test/smoke.js` and
`test/audit-corpus.js` do exactly that and are worth keeping, but neither can fail on a single term
of the arithmetic, and neither runs in four milliseconds.

## Decision

**The verdict is a pure function of the mission on disk, in `src/lib/verdict.ts`. `check.ts`
renders it and exits on it, and decides nothing.**

1. **`computeVerdict(mission, opts)` reads, counts and returns.** It prints nothing, never touches
   `process.exitCode`, and runs no hook. It returns everything the renderer needs — the deliverable
   rows, the gated results, the corpus reading, the evidence breakdown, the seal, the unratified
   decisions — plus `clean` and `exitCode`.

2. **Hooks stay in the command layer, their count crosses.** They execute the operator's commands,
   which is a side effect and belongs where side effects live. Only `hookFailed` reaches the
   verdict, which is what makes the arithmetic testable without spawning anything.

3. **One definition of `clean`, exported.** `verdictFrom(gaps, strictGaps, hookFailed)` is the whole
   rule. It is exported because the command cannot call `computeVerdict` last: the `after` hooks run
   once the report is rendered, so the final count is only known at the bottom of the command. The
   alternative was to re-write the condition there, which is how two copies of one rule start
   drifting apart.

4. **No second opinion.** `check.ts` must never re-decide anything it renders. If the render and the
   verdict ever disagree, the duplicated logic is the defect, not the disagreement.

5. **Behaviour-preserving, and proven so rather than asserted.** 24 golden outputs were captured
   before the change across four missions (runward's own, `init --example`, a bare scaffold, and a
   sealed-then-tampered one) and six flag combinations, then compared byte for byte after.
   **24 of 24 identical**, exit codes included.

## Alternatives discarded

- **Unit-test `checkCommand` directly**, by capturing stdout. Rejected: it pins the *rendering*, so
  every reworded message becomes a failing test, and a guard that reds on harmless edits gets
  switched off. It also would not have made the arithmetic reachable.
- **Move the rendering into the library instead.** Rejected: the library would then own colours,
  terminal width and message wording, and `--json` would have to un-render them.
- **Leave it and widen `test/audit-corpus.js`.** Rejected on cost and on precision. The corpus takes
  15 s and answers "the mission was refused"; it cannot answer "the seal contributed the refusal".
  Both are needed, at different grains.
- **Extract further, into one module per section.** Deferred, not rejected. The seam that mattered
  was verdict against render; splitting the verdict itself buys nothing today.

## Consequences

- `dist/commands/check.js` goes from **8.70 % / 0 %** to **57.93 % lines / 100 % functions**, and
  `dist/lib/verdict.js` lands at **97.79 % lines, 90 % branches, 100 % functions**. Whole-project
  line coverage goes from 74.90 % to 79.70 %.
- **Said plainly, because the number flatters otherwise:** the coverage now recorded against
  `check.js` comes from the new test driving the real CLI in a child process (`init`, `check
  --freeze`), which Node's coverage aggregates. It is not a unit test importing `check.ts`. The
  structural gain is that the *verdict* is now imported directly, and that is where the 97.79 %
  applies.
- `src/lib/verdict.ts` enters the perimeter of ADR-0046's next mutation pass, which was the point.
- 17 new cases in `test/unit/verdict.test.js`, each pinning a term in **both** directions: a fixture
  that only ever expects a refusal is satisfied by a function that refuses everything.

## Ratification — 2026-08-06

Measured on the shipped build, every figure re-derived:

- Golden comparison: 24 outputs, 4 missions, 6 flag combinations, **24 of 24 byte-identical**.
- Full net green: unit 342/342, smoke, OSCAL, audit corpus, `check --strict` — all exit 0.
- **12 hand-written mutants applied to `dist/lib/verdict.js`, 11 killed** by the new file: `clean`
  forced true, each of the three terms deleted in turn, `exitCode` forced to 0, the deliverable
  counter disabled, the seal ignored, unratified ADRs ignored, the conformance/evidence/drift sum
  ignored, the corpus contribution zeroed, and `--freeze` made to verify the seal it replaces.
- The one survivor is argued, not assumed: removing the skip branch in `judgeGated` changes nothing
  observable, because **no shipped mission ever skips a gated deliverable**. Measured on both
  (`init --yes` and `init --yes --example`): five gated deliverables, five examined, zero skipped.
  The skip needs a deliverable with no expected rule and no violation, and ADR-0002 pins every phase
  floor above zero, so a stripped mapping raises `(mapping)` instead of falling silent. The branch
  is unreachable on any corpus runward ships, and a test asserts exactly that rather than
  manufacturing a mission to reach it.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05, together with the ADR-0046 pass, or at the first change that adds a
term to the verdict.

The decision is wrong and must be revisited if any holds: `check.ts` regains a counter of its own;
`verdictFrom` acquires a second caller that reimplements it; the skip branch becomes reachable on a
shipped mission, which would mean a phase floor fell to zero or a mapping violation went missing; or
the golden comparison can no longer be reproduced because the render and the verdict have drifted.

## References

- [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) — the measurement whose
  largest absence this closes, and the perimeter this module now joins.
- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — the 22 false positives, and
  why the seal, the corpus and the counter are terms of the verdict rather than decoration.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the non-vacuity floors
  that make the skip branch unreachable.
- [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) — the
  machine-readable surface, built from the same object the renderer prints.
- `docs/compliance/known-defects.md` — RWD-2026-0015, whose perimeter line this changes.
