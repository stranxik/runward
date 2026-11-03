# ADR-0104 — The mutation ratchet cuts its chunks from measured cost and runs the longest first

**Date**: 2026-10-28
**Status**: accepted (2026-10-28) — the maintainer chose A: the plan job of the release ratchet derives its
chunks from a committed record of measured cost, cut to a predicted ceiling and ordered longest first; the
ratchet's guarantees (every line measured once, every chunk counted) are unchanged and proved by a test.
The `incremental` comment of `stryker.config.json` now says what the workflow does, and `ci.yml` gains a
concurrency group
**Deciders**: the maintainer. Written by an agent session on the maintainer's decision; under ADR-0088
decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: read on a fresh clone of `stranxik/runward` at `main@b7d8c62`:
`.github/workflows/mutation-ratchet.yml`, `.github/workflows/ci.yml`, `scripts/mutation-chunked.sh`,
`scripts/mutation-testcmd.sh`, `stryker.config.json`, ADR-0046, ADR-0059, ADR-0079, ADR-0103. Measured:
the 0.46.0 release ratchet (run 40684642130, 2026-10-28T12:02:48Z to 2026-10-29T01:31:09Z): the 200
jobs read with `gh api .../runs/40684642130/jobs` (173 `measure` legs, start and end of each), and the
25 `merged-<module>` artifacts downloaded with `gh run download`, each mutant's status and line read
from them. The fit and the schedule simulation below were run on that data with the planner this
decision adds (`scripts/mutation-plan.mjs`); an earlier fit of 2026-10-28 on 142 of those chunks
(893 s + 9.9 s × killed + 145.7 s × survivor, R² 0.71) agrees with it
**Relates to**: [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md)
(the ratchet whose plan this changes; its "every chunk came back" rule is kept),
[ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) (an instrument, never a
pull-request gate; its lever 1, early exit ordered by cost, is why a survivor costs more than a kill),
[ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md) (the signed summary,
unchanged), [ADR-0103](ADR-0103-the-register-records-the-source-each-module-was-measured-on-and-a-stale-one-refuses-the-release.md)
(the same run's reports feed both records), ADR-0106 (planned: reuse of a measurement across releases)

## Context

**What the plan job does today.** `mutation-ratchet.yml` cuts every module of `stryker.config.json`'s
`mutate` into fixed ranges of 60 lines, in configuration order, and hands them to a matrix of at most
16 parallel legs. Each leg runs `npx stryker run --mutate <file>:<start>-<end> --force` under a
300-minute step ceiling, verifies its timeouts alone, and uploads its report; the `ratchet` job counts
the reports that came back against the plan and refuses a module short of one (ADR-0059).

**What it costs, measured on 0.46.0.** 173 legs; 13.45 h from the first leg's start to the last leg's
end, 13.47 h for the run; 182.4 runner-hours of `measure` jobs. The longest leg, `mission` lines 301-360,
took 4.60 h against the 5-hour step ceiling; four `mission` legs and one `tool-adapters` leg took more
than 4 h, 12 legs more than 3 h, 42 more than 90 min, and the median leg 44 minutes.

**Why a line count predicts nothing.** A leg's time follows what its mutants cost, not how many lines
it spans. The test command (`scripts/mutation-testcmd.sh`, ADR-0046 lever 1) runs the cheap test files
first and stops at the first failure: a killed mutant pays the cheap stage, a survivor pays the whole
suite. Fitted by least squares on the 173 legs, job duration against the counts read from the merged
reports:

> t ≈ 961 s + 12.7 s × killed + 151.5 s × survivors (R² 0.68)

The intercept is what a leg pays before its first mutant: checkout, `npm ci`, build, Stryker's dry run.
A survivor costs twelve kills. `mission` files 685 survivors (its register section), and one of its
60-line ranges holds 101 of them, which is where the 4.6 h come from; `wire-install` holds none and
its two legs are nearly all intercept.

**Why the order loses hours too.** The matrix starts legs in plan order, and the plan lists modules in
configuration order, so a long leg starts whenever its module's turn comes, and the run ends when the
last long leg started late ends, with the other slots idle. Replayed on the measured durations with 16
slots (list scheduling, the matrix's own rule): plan order ends at 13.36 h, within six minutes of what
happened; the same legs longest first end at 11.48 h. Order alone costs 1.9 h.

**Two smaller facts, verified on the tree.** `stryker.config.json` says "INCREMENTAL (on). Stryker
keeps reports/mutation/incremental.json and re-tests only the mutants a change can reach"; the workflow
runs every chunk with `--force` on a fresh runner, `reports/mutation/` is ignored by git, and no job
uploads or restores an `incremental.json`, so every release re-measures every mutant. And `ci.yml` has
no `concurrency` group: a pull request pushed three times runs its three CI runs to the end, on the
same 20-job account ceiling the ratchet's 16 slots share.

## Options considered

- **A. Cut from measured cost, run longest first.** A committed record of what each line cost on the
  last whole-perimeter run; a planner cuts each module into ranges whose predicted time stays under a
  target and sorts the plan longest first. The ratchet's counting and refusal are untouched.
- **B. Smaller fixed ranges.** `chunk_lines: 30` halves the longest leg and doubles the intercept paid:
  346 legs at 961 s each is 92 runner-hours before a single mutant, and the 256-job matrix limit is
  exceeded.
- **C. More parallel slots.** The account ceiling on standard runners is 20 concurrent jobs; 16 leaves
  room for CI on a pull request to start (the workflow says why). The sum of the legs divided by 16 is
  a floor of 11.4 h on the measured durations whatever the order; slots do not change the sum.
- **D. Reuse the previous release's measurement.** The incremental mode the comment claims. It changes
  what is re-measured, which ADR-0059 and ADR-0103 have a view on; it is ADR-0106, planned, and does
  not replace a sane plan for what is measured.
- **E. Leave it.** 13 h per release, legs at 4.6 h under a 5-hour ceiling: the next `mission` filing
  that adds thirty survivors to one range makes a leg hit the ceiling, and a leg that hits it refuses
  the module (the right outcome, for the wrong reason).

## Decision

**A**, decided by the maintainer on 2026-10-28.

1. **The plan input is committed and measured.** `docs/compliance/mutation-chunk-costs.json` holds,
   per module of the perimeter, the line count of the built file the run measured and, per line that
   carries a mutant, how many the suite killed and how many survived (`Survived` and `NoCoverage`, the
   set `scripts/mutation-survivors.mjs` uses); with the run id, its date, and the cost model used
   (`baseSeconds`, `perKilledSeconds`, `perSurvivorSeconds`). It is written by
   `scripts/mutation-plan.mjs --record --merged <dir> --run <id> --measured-at <date>` from the
   `merged-<module>` artifacts of a run, never by hand. Seeded on 2026-11-03 from run 40684642130
   (25 modules).
2. **The planner cuts to a target and orders longest first.** `scripts/mutation-plan.mjs` reads
   `stryker.config.json` and the built files, predicts each line's cost from the record with the
   model, and cuts each module greedily from line 1: a chunk grows until the next line would push its
   predicted time over the target (`--target`, default 90 minutes, a third of the step ceiling). A
   single line dearer than the target is a chunk of its own, over target and still measured. The chunks
   of all modules are then sorted by predicted time, longest first, ties by module then start, so the
   plan is the same for the same inputs. More than 256 chunks is an error, never a truncated plan.
3. **Every guarantee of the ratchet is kept.** The ranges of a module cover line 1 to the last line of
   the file as built now, with no gap and no overlap; `assertCovers` refuses any plan that does not,
   and `test/unit/mutation-plan.test.js` proves it with a positive control (one range dropped, a gap,
   an overlap, a range past the end: each reddens). The `ratchet` job still counts the chunks that came
   back against the plan and refuses a module short of one (ADR-0059); it reads the same `chunks=` and
   `modules=` outputs, with the same fields plus `predicted`. The plan job reports the chunk count, the
   longest predicted chunk and the predicted runner-hours in its log.
4. **A stale record costs time, never coverage.** A module the record does not know, or whose built
   line count differs from the recorded one, is cut on a mean line cost (the module's own mean, or the
   record's) and named in a workflow warning; its ranges still cover every line. The record is
   regenerated after each whole-perimeter run, as step 4 of "Filing a measurement" in
   `docs/compliance/mutation-register.md`.
5. **The workflow calls the planner.** The `plan` job of `mutation-ratchet.yml` runs
   `node scripts/mutation-plan.mjs --github-output` in place of its inline script; the `chunk_lines`
   input becomes `target_minutes` (default 90). The leg's name carries its predicted minutes.
6. **The `incremental` comment says what the workflow does.** Lever 2 of `stryker.config.json` now
   reads: configured for a laptop pass, not used by the ratchet, which runs every chunk with `--force`
   and keeps no `incremental.json`; reuse across releases is ADR-0106, planned.
7. **`ci.yml` gains a concurrency group.** `group: ci-${{ github.ref }}`, `cancel-in-progress` on pull
   requests only: a newer push to the same pull request cancels the run of the older one, and a push to
   `main` never cancels the run before it (its runs are the record of `main`).
   `test/unit/regulated-posture.test.js` holds the group in place.

## Simulation (0.46.0 chunk data, 16 slots)

List scheduling in plan order, the matrix's rule; "modeled" means each chunk takes what the model
predicts for its killed and surviving counts.

| Plan | Chunks | Longest chunk | Runner-hours | Wall clock (16 slots) |
| --- | ---: | ---: | ---: | ---: |
| Old (60 lines, configuration order), measured | 173 | 4.60 h | 182.4 | 13.36 h (observed 13.45 h) |
| Old, modeled | 173 | 4.63 h | | 13.48 h |
| Old, measured, longest first (order alone) | 173 | 4.60 h | 182.4 | 11.48 h |
| **New, target 90 min, modeled** | **128** | **1.50 h** | **170.4** | **10.86 h** (floor 10.65 h) |
| New, target 60 min, modeled | 217 | 1.03 h | 194.2 | 12.31 h |
| New, target 120 min, modeled | 94 | 2.00 h | 161.3 | 10.34 h |

Modeled against modeled, the new plan ends 2.6 h earlier (13.48 h to 10.86 h, 19 %) and its longest
leg is 1.5 h against 4.6 h, with 3.3× of margin under the step ceiling where the old plan had 8 %.
The runner-hours fall because fewer legs pay the intercept (173 × 961 s is 46 runner-hours of
checkout and build; 128 × 961 s is 34). A lower target buys a shorter longest leg and pays for it in
intercept; 90 minutes is where the floor (sum ÷ 16) and the longest leg are both well inside the
ceiling. On today's `main` the planner gives 131 chunks: `evidence` and `tool-adapters` grew since the
run, and their new lines are cut on a mean cost until the record is regenerated.

## Alternatives discarded

- **Predicting from the register's survivor count alone.** The register files survivors, not kills,
  and a kill still costs the cheap stage; 12.7 s × 1,000 kills is 3.5 h a module cannot ignore.
- **Cutting on mutant count without the model.** It is the model with one coefficient; it would
  place a 30-survivor line and a 30-kill line in the same size of chunk, and they differ by 12×.
- **Balancing with a bin-packing of ranges across slots.** The matrix does not take a slot
  assignment, only an order; longest first is the list-scheduling order with the best known bound and
  needs nothing the workflow does not already do.
- **Reading the record from the register files.** They carry the survivors with their line, not the
  kills; the merged report carries both, and ADR-0103 already downloads it to file a module.

## Consequences

- **A record to regenerate.** One more step after a release's ratchet, beside the signed summary and
  the measured sources. It is a convenience, so forgetting it is a warning in the plan job's log, not a
  refusal; the runbook's release checklist (§3, step 6) is the maintainer's to amend with it.
- **A plan that moves with the code.** Ranges differ between releases, so a leg's name
  (`chunk-<module>--<start>`) is not comparable across runs; the merged report per module is, and
  the summary (ADR-0079) is written from it.
- **The workflow change is pushed by the maintainer.** Agent sessions cannot push workflow files; the
  `mutation-ratchet.yml` and `ci.yml` changes sit in their own commits.
- **The local script is unchanged.** `scripts/mutation-chunked.sh` keeps its fixed ranges for a laptop
  pass, where the loss bounded is a nap, not a slot.

### What this does not catch

- **The model's error.** R² 0.68 on job durations: a chunk predicted at 90 minutes may run two hours,
  because timeouts verified alone, a runner slower than the median, and `npm ci` time are not in the
  counts. The ceiling (300 minutes) is where that error is absorbed, which is why the target is a third
  of it and not nine tenths.
- **A change in the suite's cost.** The coefficients were fitted on one release's test net; a cheap
  stage that doubles moves every prediction by the same factor and the plan stays balanced, the ceiling
  margin shrinks. Refit from a later run's jobs and update `model` in the record.
- **The straddling mutant.** A mutant whose source range crosses a chunk boundary is measured by neither
  range (the note at the end of `scripts/mutation-chunked.sh`). Cost-cut ranges have as many boundaries
  as the old ones, in other places; this decision neither adds nor removes that loss. ADR-0106 is where a
  full-file reuse pass would close it.

## What would settle it

- **For A**: the 0.47.0 release ratchet ends under 11.5 h of wall clock with no leg over 2.5 h, and
  its `ratchet` job counts every chunk of the plan for every module.
- **Against A**: a release ratchet where a leg predicted under the target hits the step ceiling, or
  where the planner's warning on a stale record coincides with a module refused for a missing chunk:
  the plan would then be deciding what is measured, which it must not.

## Reevaluation trigger (mandatory, dated)

Reopen at the first release ratchet that ends later than 13 h with this plan, at the first leg that
hits the 300-minute ceiling, when ADR-0106 lands (a reuse changes what each leg pays), or on
2027-04-28, whichever comes first.

**Trigger set on**: 2026-11-03 · **Watched via**: each release's `mutation-ratchet.yml` run (the plan
job's log line and the longest `measure` leg), read when the signed summary is filed under
`docs/compliance/ratchet-summaries/`.

## References

- `scripts/mutation-plan.mjs`, `docs/compliance/mutation-chunk-costs.json`,
  `test/unit/mutation-plan.test.js`, `docs/compliance/mutation-register.md` ("Filing a measurement",
  step 4).
- `.github/workflows/mutation-ratchet.yml` (`plan` job, `target_minutes` input),
  `.github/workflows/ci.yml` (`concurrency`), `test/unit/regulated-posture.test.js`.
- Run 40684642130 (the 0.46.0 release ratchet): its jobs and its `merged-*` artifacts.
- ADR-0046, ADR-0059, ADR-0079, ADR-0088 decision 4, ADR-0103; ADR-0106 (planned).
