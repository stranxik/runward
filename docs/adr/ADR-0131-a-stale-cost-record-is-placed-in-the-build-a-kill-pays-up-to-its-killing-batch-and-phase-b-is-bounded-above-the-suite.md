# ADR-0131 — A stale cost record is placed in the build, a kill pays up to its killing batch, and phase B is bounded above the suite

**Date**: 2026-11-12
**Status**: proposed — amends [ADR-0104](ADR-0104-the-mutation-ratchet-cuts-its-chunks-from-measured-cost-and-runs-the-longest-first.md),
whose re-evaluation trigger "the first leg that hits the 300-minute ceiling" was reached on 2026-11-12;
written for the maintainer's arbitration, with the code in the same pull request
**Deciders**: the maintainer. Written by an agent session; under ADR-0088 decision 4 the maintainer is
the single accountable person, and the agent's writing is disclosed throughput, not independent review.
The review of this gate-adjacent code by a second model is planned after 2026-11-17 and has not happened
**Method**: read on a fresh worktree of `stranxik/runward` at `main@c1f2a12`: `scripts/mutation-plan.mjs`,
`scripts/mutation-timeouts.mjs`, `scripts/mutation-testcmd.sh`, `scripts/mutation-select-tests.mjs`,
`scripts/mutation-mutant-table.mjs`, `docs/compliance/mutation-chunk-costs.json`,
`.github/workflows/mutation-ratchet.yml`, `stryker.config.json`, ADR-0104, ADR-0105, and the open
pull request #515 (ADR-0106). Measured: the `mode=measure` dispatch of module `evidence`, run
43208399067 (2026-11-12): its 98 jobs read with `gh api .../runs/43208399067/jobs`, the logs of its
`measure` legs (Stryker's score table, its dry-run line, the verifier's verdicts), the four chunk
artifacts holding the phase-B verdicts (`chunk-evidence--49`, `--106`, `--251`, `--417`), and the
coverage map of the run (`coverage-map`, its `evidence` digest equal to the local build, 22e48d75…).
Stryker's instrumenter run on the 25 built modules of `main@c1f2a12` for the mutant counts. One
lexer mutant measured on the laptop before and after decision C, below

## Context

**What happened.** A measure of `evidence` alone (run 43208399067, target 35 minutes, 97 legs) put
the comment lexer of ADR-0114 into legs the planner predicted at about 34 minutes; one of them,
lines 65-105, hit the 300-minute step ceiling, and the module is refused for a missing chunk. That
is ADR-0104's "against" signature: a leg predicted under the target hitting the ceiling while the
planner warned the record was stale.

**Cause 1: the record is read by line number.** `lineCosts` priced each line with the record's cost
for the same line number, and averaged only the lines past the recorded length. The record is the
0.46.0 run's (`dist/lib/evidence.js` at 1793 lines, 1653 mutants). ADR-0114 (commit 284e5d1,
2026-11-05) inserted 336 lines near line 70; the build planned had 2441 lines and 2856 mutants
(Stryker's instrumenter, whole file). The lexer's lines were priced with the code that used to sit
there: range 65-105 was predicted 2038 s for 52 mutants; it holds 147.

**Cause 2: a kill costs a survivor.** Lines 60-85 of the lexer run at module load, so 185 unit test
files execute them (the coverage map), and the file that kills a lexer mutant
(`symbols-outside-comments.test.js`) is on the slow list. `scripts/mutation-testcmd.sh` ran the
selected expensive files as ONE `node --test`, which runs every file it is given even after one has
failed. A killed lexer mutant paid the whole expensive set. Measured per leg (job duration over
mutants): 49-64, 44 killed and 2 timeouts, 316 s a mutant; 293-295, 19 killed, 328 s; 268-278,
6 killed, 327 s; 106-149, 201 s; 296-331, 218 s; 251-267, 238 s. Elsewhere in the run the median
mutant cost 12 s.

**Cause 3, a correctness defect: phase B was bounded under the suite.** `scripts/mutation-timeouts.mjs`
re-runs every Timeout-status mutant alone; phase B (the whole suite) was bounded at a constant 240 s,
set against a suite of about 105 s. Stryker's dry run of the same suite, alone, on the same runners,
took 267 to 533 s (median 377 s). A mutant still running at 240 s is filed "Timeout (real hang,
detected)": the direction that hides a survivor. Seven verdicts of the run stopped at 243 to 245 s:
`evidence` L51 and L53 StringLiteral (leg 49-64), L111 LogicalOperator and Regex (106-149), L251
EqualityOperator and UpdateOperator (251-267), L445 ArithmeticOperator (417-448). None is known to
hang: each was cut off before the suite could have finished. 14 others stopped in phase A (the
module's own tests, 20 s), which this decision does not touch.

## Options considered

- **A. Bound phase B by the suite's measured duration.** Twice the leg's own dry run, never under
  the old 240 s, and 900 s with no measurement.
- **B. Place a stale module's mutants in the build, priced at its recorded mean, with a cap per
  chunk.** The record keeps deciding where a module is cut when it describes the build; when it does
  not, the mutants are counted where Stryker will put them.
- **C. Run the expensive covering files in batches of increasing cost, stopping at the first
  failure.** A kill pays up to the batch that kills it; a survivor runs every covering file.
- **D. Regenerate the record and change nothing else.** Fixes the placement for one release, not the
  next insertion; does not touch causes 2 and 3.
- **E. A lower target.** Cuts every module finer and pays an intercept per leg (about 961 s); a
  leg priced wrong by a factor of six stays wrong at any target.
- **F. Leave it.** Every measure of `evidence` refuses the module, and seven, then more, survivors
  can be filed as detected.

## Decision

**A, B and C**, in the scripts only; no workflow file changes.

**A. Phase B is bounded above the suite** (`scripts/mutation-timeout-bounds.mjs`, read by
`scripts/mutation-timeouts.mjs`).
1. The bound is `max(240 s, 2 × the leg's dry run)`. The dry run is Stryker's own measurement of the
   whole suite on the leg's runner; `stryker.config.json` sets `fileLogLevel: "info"` so that its line
   ("Initial test run succeeded … (net N ms, overhead M ms)") is in `stryker.log`, where the verifier,
   which runs in the next step of the same leg, reads it.
2. Without that line the bound is 900 s, above every dry run measured on the runners (533 s at most);
   not above every machine's suite (the maintainer's server: 865 s), see below.
3. `--limit-ms` still sets the bound outright; `--suite-ms` gives a duration when no log does. The
   verifier prints the bound and why on its first line.
4. A hang now costs up to the bound (about 700 to 1100 s on a runner, against 240 s) when it hides
   behind a passing phase A; 7 of the run's 21 verified timeouts were in that case.

**B. A stale record is placed, not read by line number** (`scripts/mutation-plan.mjs`).
1. A module is stale when the record does not describe its build: by the SHA-256 of the measured
   source, which every record written from now on carries (`--record` hashes the source Stryker
   embedded); for the current record, which has none, by line count, as before.
2. The planner places the mutants of every module with Stryker's instrumenter, as
   `scripts/mutation-mutant-table.mjs` does (its call is now shared, `placeMutants`). A fresh module is
   cut on its record exactly as before. A stale one prices each placed mutant at the module's recorded
   mean cost per mutant (the record's mean for a module it does not know; a survivor's cost with no
   record at all).
3. A chunk of a stale module holds at most `DEFAULT_MAX_MUTANTS` mutants (`--max-mutants`), whatever
   their guessed price. A line carrying more is a chunk of its own, over the cap and measured.
4. A stale module whose mutants were not placed is refused, never planned on the old reading; the
   256-job refusal stays, and now also names the cap.

**C. A kill pays up to its killing batch** (`scripts/mutation-select-tests.mjs`,
`scripts/mutation-testcmd.sh`).
1. The selector prints the cheap covering files on line 1, then the expensive ones in batches of
   increasing measured cost, one batch a line: the first batch fills to 30 s of measured cost, each
   next one to the sum of all before it (budgets double, so a set of S seconds is about
   log2(S / 30) + 2 invocations). With no expensive file the second line is empty, as before.
2. The test command runs one `node --test` per line and stops at the first that fails.
3. The covering set is unchanged, so a verdict cannot change: a mutant is killed iff a covering file
   fails. A survivor runs every covering file, in more invocations. The whole-suite fallback (no map,
   or any doubt) is unchanged, and so is phase B, which runs it.

## Measurement

**The cap (B3), and why it is not 40.** A leg has 300 minutes and pays about 961 s before its first
mutant. A survivor of the lexer runs its 185 covering files, the whole suite in practice: about the
dry run, 267 to 533 s on a runner. 40 mutants all surviving at 330 s is 3.9 h, inside the ceiling
with an hour for the leg's timeouts; that is the value a worst case gives. But a cap binds every
stale module, and on `main@c1f2a12` 15 of the 25 modules are stale against the 0.46.0 record. The
whole perimeter at the default target (90 minutes), with the planner of this decision:

| Cap | Legs, whole perimeter | Legs, `evidence` alone |
| ---: | ---: | ---: |
| none (B1-B2 only) | 147 | 29 |
| 40 | 321, refused (over 256) | 77 |
| 50 | 264, refused | |
| 55 | 244 | |
| **60** | **228** | **50** |
| 80 | 187 | 37 |
| old planner (`main`) | 141 | |

So 40 refuses the release ratchet's plan until the record is regenerated, and the record is
regenerated from a release ratchet. The default is **60**: the smallest round value with margin under
256. What it costs: with C, a lexer kill costs about a tenth of what it did (below), so a 60-mutant
chunk stays under the ceiling unless more than about 84 % of its mutants survive at the whole
suite's cost ((18 000 − 961 − 60 × 34) / (60 × 296)); the worst lexer leg of the run had 37 %
survivors (15 of 41). Which value is the maintainer's question 1 below.

**C on one lexer mutant.** The ArrayDeclaration mutant of the `go` lexicon (`go: { line: [] }`,
`dist/lib/evidence.js` L67, id 1 of `--mutate dist/lib/evidence.js:67-67`), in a sandbox laid out as
Stryker's (the instrumented module, the run's coverage map, the leg's mutant table), on the laptop
(8 cores, `nice -n 10`, nothing else heavy running), killed by
`symbols-outside-comments.test.js` both times:

| | Selection | Wall clock |
| --- | --- | ---: |
| Before (one expensive invocation) | 86 cheap files, then 99 expensive in one `node --test` | 328.6 s |
| After (batches) | 86 cheap, then 99 expensive in 6 batches (30, 31, 63, 129, 254, 359 s measured); the killer in batch 3 | 33.8 s |

The same 185 files against the pristine build, as a survivor runs them: 384 s in the old two
invocations, 428 s in the seven of the new command (+11 %, the price of the batch boundaries). One
expensive file failed in both runs of the pristine set, with the machine's load average near 70 (the
suite's own subprocesses), and the same one in both is assumed, not checked; it does not change which
files ran.

## Alternatives discarded

- **A bound from the cost file** (`test/unit-cost.json`, measured sequentially on a laptop): it is
  not the runner's time, and it is a month old; the dry run is the same suite, on the same machine,
  minutes earlier.
- **Measuring the suite inside the verifier**: one more whole suite per leg that has a timeout, for
  a number Stryker already measured.
- **A line map from the recorded source to the build** (moving each recorded cost with its line):
  the record holds no source, only line counts; the digest it carries from now on makes staleness
  exact, and the next regeneration makes the placement unnecessary until the code moves again.
- **A cap on every module**: 14 825 mutants at 40 a leg is 371 legs, over the matrix.
- **`node --test` stopping at the first failing file**: it has no such option (Node.js 24).

## Consequences

- **The plan job runs Stryker's instrumenter** on every module of the plan (1.3 s for the 25 on the
  laptop); it already runs `npm ci`, so nothing is installed for it.
- **More legs while the record is stale**: 228 against 141 for the whole perimeter on today's tree,
  each paying the intercept; a regenerated record (`--record`) makes every module fresh again and
  removes the cap's effect.
- **Every record written from now on carries the digest of what it measured**, so a stale module is
  found by its bytes, not its length.
- **A hang hiding behind a passing phase A costs up to the new bound**, not 240 s.
- **A survivor pays a few more invocations** (C), measured above.
- **`stryker.log`** is written in the working directory of a Stryker run (a leg's, or a laptop
  pass's); it is not committed. A `.gitignore` line for it is left to the maintainer.

### Composition with ADR-0106 (pull request #515)

#515 discounts a reused survivor in `lineCosts`' output (`discountReuse`) and adds `reuse` to `plan`.
The two meet in four places of `scripts/mutation-plan.mjs` (the usage line, the `plan` signature, the
cut in its loop, the `plan` call in `main`), each resolved by keeping both sides. One line more
belongs to the resolution: a survivor offered for reuse is instrumented but not run, so it must not
count toward the cap; where #515 computes `counts` (offered survivors per line), the loop subtracts
them from `lc.mutants` (never below zero) before `cutModule`. Without that line the cap would cut for
mutants a leg does not measure: more legs, never fewer lines. In a stale module the discount
subtracts a survivor's modeled cost (151.5 s) from a line priced at the module's mean (about 43 s a
mutant for `evidence`), so a reused line is predicted free, the same direction.

The scripts this decision changes (`mutation-testcmd.sh`, `mutation-select-tests.mjs`,
`mutation-timeouts.mjs`, `stryker.config.json`) are part of ADR-0106's harness fingerprint, so the
first ratchet after both land re-measures everything instead of reusing: expected, and the reuse
resumes from the release after.

### What this does not catch

- **The model's error on a fresh record.** A regenerated record prices a lexer kill at the model's
  12.7 s; with C it costs about 34 s on the laptop, not the 300 s that broke the run, but the model
  is fitted across modules and a module whose kills are dear stays underpriced. ADR-0104's "refit"
  remains the remedy.
- **Phase A's bound (20 s)**, sized for a module's own tests of about 1.3 s; not re-measured here.
- **The seven verdicts already filed, and the default off the runner.** Re-verified alone on the
  maintainer's server on 2026-11-12 (a `node:24` container capped at 3.5 cores, no `stryker.log`, so
  the 900 s default): all seven stopped at the bound again (910 s each). That server runs the pristine
  whole-suite command in 865 s, so 900 s is not above its suite and the re-check is inconclusive, not
  a confirmation. The default is above the runner's suite (533 s at most), not above every machine's:
  a verification off the runner passes `--suite-ms` (or `--limit-ms`) from that machine's own suite.
  Read from the code, `k++` at L251 and `i - 1` at L445 loop forever (real hangs); `k < 0` at L251
  skips its loop and the two L111 mutants end at the start of the text (survivors or kills, not
  hangs); L51 and L53 empty a string delimiter, which may or may not loop. Settling them is a re-run
  with `--suite-ms 865000` on that server (bound 1730 s, at most about 3.4 h for the seven).

## What would settle it

- **For**: the next whole-perimeter ratchet plans under 256 legs, no leg hits the ceiling, the
  verifier's first line shows a bound read from the leg's dry run on every leg with a timeout, and
  the `evidence` legs over the lexer cost under 90 s a killed mutant.
- **Against**: a leg of a stale module hitting the ceiling with fewer than the cap's mutants (the
  cap is then too high, or the price too low), a phase-B verdict at the bound whose re-run alone on an
  idle machine survives (the bound is still under the suite), or a ratchet mismatch on an unchanged
  module after C (a batch boundary changing a verdict, which it must not).

## Reevaluation trigger (mandatory, dated)

Reopen at the first leg that hits the 300-minute ceiling with this plan, at the first phase-B
verdict at the bound that a re-run alone contradicts, when ADR-0106 lands (a reuse changes what each
leg pays and what the cap counts), or on 2027-02-12, whichever comes first.

**Trigger set on**: 2026-11-12 · **Watched via**: each ratchet run's plan job log (legs, stale
modules, cap) and its `measure` legs' durations and verifier lines.

## References

- `scripts/mutation-plan.mjs`, `scripts/mutation-mutant-table.mjs`, `scripts/mutation-timeouts.mjs`,
  `scripts/mutation-timeout-bounds.mjs`, `scripts/mutation-select-tests.mjs`,
  `scripts/mutation-testcmd.sh`, `stryker.config.json` (`fileLogLevel`).
- `test/unit/mutation-plan.test.js` (the stale placement, the cap, a file grown in the middle as
  positive control), `test/unit/mutation-select-tests.test.js` (the batches),
  `test/unit/mutation-timeouts.test.js` (the bound, with a fixed bound as positive control).
- Run 43208399067 (the `evidence` measure of 2026-11-12) and its artifacts; run 40684642130 (the
  0.46.0 record).
- ADR-0046, ADR-0059, ADR-0088 decision 4, ADR-0104 (amended), ADR-0105, ADR-0106 (#515), ADR-0114.
