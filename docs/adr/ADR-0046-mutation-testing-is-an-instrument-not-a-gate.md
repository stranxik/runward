# ADR-0046: mutation testing is an instrument, not a gate

**Date**: 2026-08-05
**Status**: accepted (ratified 2026-08-05 — see Ratification)

## Context

runward asks operators to prove that a step happened. It had never asked the same of its own test
suite. Two hundred and some tests were green; nothing said what they would catch if the code moved
under them.

A full Stryker pass was run on 2026-08-05 against the seven library modules the verdict is computed
*from* (`evidence`, `conformance`, `mission`, `rules`, `scaffold-lock`, `territory`, `territory-map`).

The wording matters, and the first draft of this ADR got it wrong in the direction that flatters. It
called these "the seven modules that produce a verdict". They do not. The verdict is **assembled** in
`src/commands/check.ts`, which no unit test imports and which this pass did not mutate. The measured
perimeter is therefore everything the verdict is computed from, and not the place where it is
decided. That gap is stated again in the Decision (point 5) and is the single most consequential
absence of this measurement.
**2 973 mutants, 2 h 35, mutation score 60.78 %**: 1 769 killed, 38 timeout, **1 166 survived**,
0 without coverage.

A raw survivor count is not a defect count, and treating it as one would have produced a day of
false findings. The survivors were therefore filtered before being judged:

1. **By stake.** 433 of the 1 166 carry mutators that can flip a *decision* (equality, conditional,
   logical, boolean, unary, optional chaining). The rest are mostly string literals and regexes,
   many of them inside printed prose. No test should pin prose.
2. **Against the whole net.** The unit suite is not runward's safety net. The 433 were re-run against
   the self-gate, the OSCAL schema validation and the end-to-end smoke. **53 died there. 380
   survived everything.** Reporting the other 53 as holes would have been false.
3. **By instruction, case by case.** Thirteen analysts, one per function, each in an isolated copy of
   the repository, each required to apply the mutant to a real mission and read the verdict rather
   than reason about the code.

**What that instruction found, and what it corrected.**

The first reading was wrong, and the correction is the substance of this ADR. A surviving mutant is
not automatically a false green. Forcing `artifactState` to report every ADR directory as `filled`
survives the unit suite, the self-gate, the smoke run **and** the audit corpus — yet a mission with
no ADR is still **refused**, because the typed pointer `adr:0001` does not resolve. Defence in
depth, not a hole in the verdict. What it does corrupt is the printed line: `✓ Decision journal`
where the truth is `○ raw template`. For this tool that remains a defect, because a proof surface
that lies under a correct verdict is still a proof surface that lies.

**The structural result.** `check.ts` imports neither `territory` nor `characterize`. The territory
derivation reaches only `runward rules --for` (which exits 0 by design) and `runward status`. The
125 survivors in `territory.js`, a third of the 380, **cannot turn a refusal into a pass**. Measured,
not deduced: 42 mutants applied one at a time to a green mission left `check --strict` at exit 0
every time, while 4 of them already corrupted `rules --for --json`. That command is a machine
contract an agent drives on, and a mis-scan does not answer "I could not read it" — it answers a
wrong list, plausibly.

**The three findings that mattered.** Each is a mechanism that was *correct* and that *nothing
protected against regression*:

- **The seal.** One field flipped in `verifyEvidenceLock` (`present: true` → `false` on the
  unparseable-lock path) turns a tampered, sealed mission from exit 1 into **exit 0**. `check.ts`
  gates the entire seal section on that field, so the violations are neither printed nor counted.
  Verified by hand on a real mission sealed with `check --freeze`.
- **The ReDoS screen (ADR-0020).** The loop in `unsafeSignature` that collapses nested groups is
  entered by no existing fixture. It could be deleted outright and the suite stayed green.
- **Containment.** The repository fallback in `resolvePointer` was dead code under test: every
  containment test ran in a bare temp directory, where no repository marker exists above the base.

**Why the suite could not see them.** The reference mission shipped by `init --example` writes
`file:PATH#SYMBOL` and bare `test:PATH` — the robust forms, and the right choice for an example,
since a symbol anchor survives a refactor and a line number does not. The consequence is that the
`:LINE` and `::NAME` branches of the grammar are unreachable by the self-gate whatever they do. The
answer is unit coverage, not a more fragile example.

**What was closed.** 246 of the 380 were instructed and **181 now die** (measured centrally against
the full suite, not claimed by the analysts, whose own count was 183): `territory.js` 101/125,
`evidence.js` 80/121. Fourteen test files, 113 cases. Separately, `artifactState` — 101 survivors in
one function, the lowest-scoring module at 40 % — was pinned by 13 cases killing 7 threshold mutants.

## Decision

**Mutation testing is an instrument runward runs on itself. It is never a gate, and no mutation
score is ever a crossing condition.**

1. **No absolute threshold.** A number placed high blocks honest work; placed low it certifies
   nothing. Either way, a mutation score written into a manifest is a verdict satisfied by a figure
   nobody re-derived, which is what [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)
   forbids. runward does not do to itself what it refuses from an operator.

2. **A ratchet, on a named perimeter.** What is opposable is a direction, not a level. On the seven
   core modules, the score does not go down and the absolute-survivor list does not grow. A drop is a
   finding to instruct, not an automatic refusal — the criterion is falsifiable, and it invents no
   number.

3. **Out of the pull-request path.** 2 h 35 for the core alone. It runs on demand and before a
   release, never per commit. An instrument that makes every change wait gets switched off, and a
   guard that is switched off guards nothing.

4. **Survivors are a register, not a backlog to zero.** Each one is filed with what it is: hole,
   defence in depth, equivalent, or display-only — and equivalence is *argued*, never assumed. Three
   survivors were declared harmless on an earlier bench of four; two were live defects.

5. **The perimeter is published with its absences, starting with the one that hurts.** The
   measurement covers seven library modules. It does **not** cover `src/commands/check.ts`, where the
   verdict is actually assembled and where the exit code is chosen — no unit test imports any command,
   so mutating them would have produced 100 % survivors, which is noise and not a measurement. It
   does not cover the nine other commands, the five `lib/` modules nothing reaches even transitively
   (`behavioral-proof`, `hooks`, `styles`, `verify-findings`, `write`), nor the nine other modules
   outside the core.

   This absence must be stated first and not last, because it is the one an assessor finds by
   crossing this ADR with the source tree: the least-tested path in the project is the one that
   returns the exit code, and it is the same region the 22 false positives of ADR-0045 lived in.
   Until that path is extracted into something a unit test can import, "we measured what our net
   catches" reads, correctly, as "everywhere except where the verdict is decided". A score quoted
   without its perimeter is an overclaim; this perimeter quoted without this sentence is one too.

6. **The adverse reading is published too.** These results are an input an assessor uses to classify
   runward *higher* on a tool-confidence scale, not lower: they document a verification tool whose
   own net had unguarded load-bearing mechanisms. That belongs in the qualification material
   alongside the improvement, per the rule already in force in `test/unit/no-overclaim.test.js`.
   Publishing the strengthening while burying the finding would be the overclaim that file forbids.

## Alternatives discarded

- **A blocking threshold in CI.** Rejected on 1 and 3. It would also invite the one behaviour this
  project exists to refuse: raising a score by writing tests that assert nothing hard.
- **Mutating the whole codebase.** Rejected on 5. Mutating code no test reaches measures the absence
  of tests, which `npm run coverage` already states more cheaply and more honestly.
- **Zeroing the survivor list.** Rejected on 4. 380 survive everything; a third of them cannot reach
  a verdict at all. Treating them as equal defects would spend the project's attention on the wrong
  two hundred.
- **Enriching `init --example` with `:LINE` pointers** so the self-gate exercises those branches.
  Rejected: it trades a real property of the example (it survives a refactor) for coverage a unit
  test gives without the fragility.

## Consequences

- Fourteen test files enter the suite (322 unit tests, up from 209). They pin decisions, not
  implementations: private scanners are reached through their public entry points.
- Every guard is pinned in **both** directions. A fixture that only ever expects a refusal is
  satisfied by a function that refuses everything.
- Cost accepted: a periodic run of some hours, and the discipline of instructing survivors rather
  than counting them.
- The known-defects material gains three entries whose *fix* is a test, and the seal finding is
  named in the regulated-adoption documentation rather than only here.

## Ratification — 2026-08-05

Measured on the shipped build, every figure re-derived rather than quoted:

- Stryker 9.6.1, `command` runner, mutating `dist/` — 2 973 mutants, 60.78 %, 2 h 35.
- Stage 2 against the full net: 433 tested, 53 killed, 380 alive.
- Central kill verification over the 246 instructed mutants: **181 killed** by the augmented suite.
- Full net green with the new files: unit 322/322, smoke, OSCAL, audit corpus, `check --strict` — all
  exit 0.
- The seal false green reproduced by hand: sealed mission exit 0, lock corrupted exit 1, same case
  with one mutant applied exit 0.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2026-11-05, or at the first release that adds a module to the verdict core.

Re-run the pass on the seven modules. The decision is wrong and must be revisited if any holds:
the score dropped without a named cause; the absolute-survivor list grew; the run no longer fits in
a release window; or an instructed survivor turns out to have been a live defect filed as equivalent.

## References

- [ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) — a verdict may not rest on what
  the audited party writes; the reason no score is ever a crossing condition.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the non-vacuity floors
  whose thresholds `test/unit/artifact-state.test.js` now pins.
- [ADR-0020](ADR-0020-rule-evidence-signatures.md) — the ReDoS screen whose nested-group loop no
  fixture entered.
- [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) — the derivation the territory tests
  pin; the reason its mutants corrupt evidence and not a verdict.
- `docs/compliance/regulated-adoption.md` — where the adverse reading of this pass is published.
