# ADR-0106 — The release ratchet reuses the previous release's survivors, and measures every other mutant

**Date**: 2026-11-12
**Status**: proposed. Planned by ADR-0104 (option D, "reuse the previous release's measurement") and
written by an agent session; the maintainer has not read this text. It becomes accepted with his approval
of the pull request that carries it, or is amended on his review. The adversarial review this kind of
record gets (a second model, on the critical path of the release ratchet) has not run yet: it is pending,
and the pull request says so
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an agent
session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing
is disclosed throughput, not independent review
**Method**: read on a clone of `stranxik/runward` at `main@c9a886a`: `.github/workflows/mutation-ratchet.yml`,
`stryker.config.json`, `scripts/mutation-*.mjs`, `scripts/ratchet-summary.mjs`, ADR-0046, ADR-0059,
ADR-0079, ADR-0088, ADR-0103, ADR-0104, ADR-0105, ADR-0110. Stryker's incremental mode read in its own
source, `node_modules/@stryker-mutator/core/src/mutants/incremental-differ.ts`,
`src/fs/project-reader.ts`, `src/test-runner/command-test-runner.ts` (10.1.1, the version
`package-lock.json` pins), then run: `test/stryker-incremental-contract.js` (added here) on Node.js
24.22.1. Measured: the per-line record of the 0.46.0 release ratchet
(`docs/compliance/mutation-chunk-costs.json`, run 40684642130, 9,958 killed and 2,403 surviving mutants),
the coverage map of run 42878769502 (`main@7d1846b8`, 266 test files), the register's filings at
`v0.46.0` and at three later commits of `main` (`b7d8c62`, 29 commits after the tag; `61d5041`, 91
commits, the size of the 0.45.0 to 0.46.0 release; `7d1846b8`, 280 commits), and the built
`dist/lib/*.js` of each, compiled from that commit. The cost model is ADR-0104's (961 s per leg, 12.7 s
per kill, 151.5 s per survivor), replayed with its planner and list scheduling at 12 and 16 slots; every
figure below is modelled, none is a measured run of this decision
**Relates to**: [ADR-0104](ADR-0104-the-mutation-ratchet-cuts-its-chunks-from-measured-cost-and-runs-the-longest-first.md)
(the plan this changes the cost of; its option D), [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md)
(every chunk comes back, the register describes the tree), [ADR-0103](ADR-0103-the-register-records-the-source-each-module-was-measured-on-and-a-stale-one-refuses-the-release.md)
(the measured source, checked before the tag), [ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md)
(the signed summary, which now says what was reused), [ADR-0105](ADR-0105-a-survivor-runs-only-the-test-files-that-execute-its-lines.md)
(a survivor runs its covering files only), [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md),
[ADR-0110](ADR-0110-the-app-may-change-and-dispatch-workflows-so-no-agent-acts-under-the-maintainers-identity-dispatch-is-a-closed-list-and-every-workflow-change-still-waits.md)
(the dispatch allowlist, which gains one input), [ADR-0112](ADR-0112-runwards-committed-junit-report-has-one-reference-environment-macos-and-the-nodejs-of-nvmrc.md)
(the Node.js of `.nvmrc`)

## Context

**What a release ratchet costs.** Every release ratchet measures every mutant of the perimeter: on the
0.46.0 model, 128 legs and 170.4 runner-hours, of which 34.2 are what legs pay before their first mutant,
35.1 are killed mutants and 101.1 are survivors (a survivor pays the whole suite, a kill the cheap stage,
ADR-0046 lever 1). At 16 legs abreast that ends in 10.9 h; at the 12 that #514 sets so the account's
other repositories keep runners, in 14.5 h. Most of that work answers again a question the previous
release already answered on the same code.

**What Stryker's incremental mode does, read in its source.** `stryker.config.json` sets
`incremental: true`, and the ratchet passes `--force`, which disables it. Without `--force`, Stryker
reads an incremental report (a previous Stryker JSON report, sources included), diffs each file's old
source against the current one with diff-match-patch, and moves every old mutant's location through the
diff; a mutant whose code the diff touched is dropped. For the mutants left, `mutantCanBeReused` decides:
with per-test coverage, a killed mutant is reused if its killing test is unchanged and a surviving one if
no covering test was added. Without coverage it does not ask:

> `if (!testCoverage.hasCoverage) { // This is the best we can do when the test runner didn't report coverage. … return true; }`

runward runs the command runner with `coverageAnalysis: "off"` (`stryker.config.json`: the tap runner with
per-test coverage reported 106 of 106 mutants uncovered, because `node --test` isolates each file), and the command runner reports one test, "All tests", with no file and no
coverage. So here Stryker reuses every mutant whose code did not change, killed or surviving, whatever
the tests, the other modules, the fixtures or the harness became. Three more facts, read and then run
(`test/stryker-incremental-contract.js`):

1. A mutant the incremental report does not carry is measured (case 2).
2. A reused mutant keeps the report's `statusReason` (case 1), which lets a run count what it reused.
3. A mutant of the report that falls outside the run's `--mutate` range is copied into the new report
   ("Make sure that old mutants that didn't run this time around aren't forgotten"; case 5). A chunked
   run that took Stryker's mode as it is would report, in every chunk, mutants it never measured.

Case 4 of the same script runs the blind spot: a test strengthened to kill a survivor leaves Stryker
reusing that survivor.

**Why the direction matters.** A reused result can be wrong in two ways. A reused **kill** the tree would
now let survive is a hole nobody files: the false green ADR-0059 refuses, and ADR-0045 before it. A
reused **survivor** the tree would now kill is a hole filed after it closed: a claim weaker than the
truth, which the ratchet cannot then report as "the register carries a survivor this tree does not
produce". The first hides a defect; the second overstates one.

## Options considered

- **A. Reuse survivors only, keyed on code and filing.** A leg is handed, as Stryker's incremental file,
  the previous release's survivors whose stable key (ADR-0059's, `mutation-key.mjs`) the register still
  files, with the source they were measured on. Stryker takes those whose code did not change and
  measures everything else: every killed mutant, every changed mutant, every survivor whose filing was
  retired.
- **B. Stryker's mode as it is.** Hand each leg the whole previous report. It reuses kills a test change
  or another module may have turned into survivors, and copies out-of-range mutants into every chunk.
- **C. A, and also re-measure every survivor a changed test file covers** (the ADR-0105 map, line by
  line, file digests compared). It closes the blind spot of case 4 at the file level.
- **D. A and C, and also reuse kills whose covering test files are unchanged.** It is Stryker's rule with
  runward supplying the coverage; it reuses kills.
- **E. Leave it**: 14.5 h at 12 abreast for every release.

**What C and D would buy, measured.** A line of the perimeter is executed by a median of 93 test files
(p25 6, p75 115; 10,905 executed lines in the map of run 42878769502): most tests spawn the CLI, which
loads every module. The test files a release touches are among those broad ones, so a file-level test
condition excludes most survivors: of the 2,403 survivors of 0.46.0, C keeps 614 (25.6 %) 29 commits
later, 598 (24.9 %) 91 commits later, 339 (14.1 %) 280 commits later, and the run ends in 11.9 h, 12.0 h
and 13.0 h at 12 abreast. D's kills face the same condition, and reusing a kill is the one error that
hides a hole. Re-verifying a survivor against its changed covering files only (a narrower C) is not
cheaper here: the changed files are the slow CLI-spawning ones, 103.6 runner-hours on the 29-commit case.

## Decision

**A**, proposed.

1. **What is reused.** A mutant that SURVIVED (Stryker's `Survived` or `NoCoverage`, the set the ratchet
   files) at the previous release, whose code Stryker's diff finds unchanged, and whose stable key the
   register still files (`survivorKeys` in `scripts/mutation-key.mjs`, the construction the ratchet now
   calls too, so the two ask one question). Nothing else: every killed mutant, every Timeout, every
   mutant on changed code and every survivor whose filing was retired is measured on this tree. A reused
   result is therefore only ever "survived", and no reuse can hide a hole. A bundle that carries any
   other status is refused whole (`scripts/mutation-reuse.mjs plan`).
2. **Where the previous measurement lives, and why it cannot be forged or silently stale.** The release
   ratchet's `summary` job writes `reuse-bundle.json` (per complete module: the source measured, its
   SHA-256, its survivors; the run's environment and generation), attests it as a GitHub artifact
   attestation beside the summary (ADR-0079; no job gains a write permission: the summary job already
   holds `id-token` and `attestations`), records its SHA-256 in the summary, and keeps it 90 days. The
   next release's `plan` job finds the newest earlier release, its completed `release` ratchet run, and
   that run's `reuse-bundle` artifact, then runs
   `gh attestation verify --cert-identity https://github.com/<repo>/.github/workflows/mutation-ratchet.yml@refs/tags/<tag> --source-ref refs/tags/<tag> --source-digest <tag's commit> --deny-self-hosted-runners`:
   a bundle signed by a dispatch, by a branch, by another workflow or on another commit does not verify.
   The script then requires the bundle's version, commit and event to be that release's. The bundle is
   the previous release's or nothing: an older one is never looked for.
3. **Missing or unverified is a full measure, never a pass.** No earlier release, no completed ratchet run,
   no artifact (none before this decision, or past 90 days), an attestation that does not verify (also an
   error annotation), a bundle unreadable or of another version, commit or event, a Stryker that fails
   `test/stryker-incremental-contract.js`, `reuse=off` at dispatch: each writes a full plan with its
   reason, every mutant is measured, and the summary's `reuse` block says which reason.
4. **The environment must be the same.** The exact Node.js (the plan and measure jobs now take
   `.nvmrc`, where `24` moved with every patch release, ADR-0112's reference), the versions of
   `@stryker-mutator/core` and `instrumenter` from `package-lock.json`, the settings of
   `stryker.config.json` (its `_` prose keys and its `mutate` perimeter left out: a module that enters
   the perimeter has no survivor in the bundle and is measured whole), and the bytes of
   `mutation-testcmd.sh`, `mutation-select-tests.mjs`, `mutation-timeouts.mjs` and
   `mutation-apply-verdicts.mjs`. Any difference is a full measure.
5. **Every chunk still comes back (ADR-0059), and the register's freshness still holds (ADR-0103).** The
   planner predicts an offered survivor at zero and so cuts fewer, longer ranges; `assertCovers` still
   requires every line of every module as built now, once. A leg writes its incremental file from the plan
   (`mutation-reuse.mjs leg`), runs Stryker without `--force`, then trims its report to its range
   (`trim`), so the merge sees exactly what a full measure of that range reports. A leg the plan cut for
   reuse that cannot apply it (plan missing, another Node.js) fails: its chunk does not come back and the
   ratchet refuses the module, rather than measure for hours on a plan cut for a cheaper leg. The merged
   report embeds the current source, so ADR-0103's record and `mutation:fresh` are unchanged.
6. **One release ratchet in four measures everything.** The bundle carries a generation: 0 after a full
   measure, one more after each reuse. At the fourth, the plan is full. Reuse can only leave stale
   survivors (decision 1), and they accumulate with what the runs did not see: changes in other modules
   and fixtures, and tests that kill a filed survivor before anyone retires its filing. Four bounds that
   to three releases, under two weeks at the cadence of 0.42.1 to 0.46.0 (nine releases from
   2026-09-25 to 2026-10-28), and costs one run in four at the full price. A dispatch with `reuse=off` (its default) measures
   everything at any time.
7. **The summary says what was reused.** `ratchet-summary-X.Y.Z.json` gains `reuse` (state, reason, the
   release and run reused, the generation), `reuseBundleSha256`, and per module `survivorsReused`,
   counted on the merged report by the marker Stryker carried through, never taken from the plan.
8. **Dispatch.** `mutation-ratchet.yml` gains the input `reuse` (`off` by default, `auto`); a release
   always runs `auto`. `.github/dispatch-allowlist.json` lists it as any value: it reads a signed bundle
   and writes nothing (ADR-0110).

## Cost (ADR-0104's model, 0.46.0 data)

Survivors kept by decision 1 and the run each plan gives, against the 0.46.0 survivors and the register at
each commit (the code condition measured on the built files with a line-level longest common
subsequence; the filing condition on the register's keys, scaled per module):

| From v0.46.0 to | Commits | Survivors reused | Legs | Runner-hours | 12 abreast | 16 abreast |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| full measure (today) | | 0 | 128 | 170.4 | 14.5 h | 10.9 h |
| `b7d8c62` | 29 | 2,401 (99.9 %) | 41 | 46.2 | 4.2 h | 3.1 h |
| `61d5041` | 91 | 2,317 (96.4 %) | 45 | 50.8 | 4.4 h | 3.3 h |
| `7d1846b8` | 280 | 2,223 (92.5 %) | 48 | 55.5 | 4.7 h | 3.5 h |

The longest leg stays at the 90-minute target. What remains is the intercept and the kills (35.1
runner-hours), which decision 1 re-measures on purpose. Over a cycle of one full run and three reuses, a
release ratchet averages about 7 h at 12 abreast against 14.5 h. With the survivor cost ADR-0105 measured
(51 % lower), a full run is about 9.2 h at 12 abreast and a reuse run still about 4.2 to 4.4 h: the gain
shrinks with every survivor made cheaper, and stays above half.

## Alternatives discarded

- **B**, on the reading above: it reuses kills, which is the one error that hides a hole, and it copies
  mutants from outside a chunk's range into its report.
- **C and D**, on the measurement above: at the file level, a test condition excludes three survivors in
  four, and D reuses kills. Test-level coverage would need one process per test case.
- **Skipping legs for ranges with nothing to measure.** Every module holds kills, and a skipped leg would
  need a second path into the merged report beside the chunks the ratchet counts. Cutting longer ranges
  gives the same saving through the existing path.
- **Committing the bundle to the repository.** A few megabytes a release, readable by nobody, and a copy
  is not a proof: the attestation is (ADR-0079's reasoning for the summary).
- **A release asset.** An immutable release refuses a file attached after publication, and the ratchet
  runs after it (ADR-0085).

## Consequences

- **A release ratchet ends in about 4 to 5 h** at 12 abreast on the model, three times in four.
- **The first reuse is two releases away.** No bundle exists before this change: the first release
  ratchet that runs this workflow measures everything and leaves the first bundle; the next release
  reuses it.
- **The ratchet's answer is weaker on reused survivors, and says so.** For them, "the register describes
  this tree" means "the register still files them and their code did not change", which is ADR-0103's
  residual ("a stronger test can kill a filed survivor without touching the module") carried one more
  release. `survivorsReused` in the signed summary is that disclosure.
- **The ratchet's Node.js is now `.nvmrc`'s** in the plan and measure jobs (24.22.1 today, where the
  runners resolved `24` to 24.22.2 on run 42878769502).
- **The workflow change is pre-merge** (ADR-0110): the maintainer approves and merges it. It composes with
  #514 (12 legs abreast, one dispatched run at a time), which touches other lines of the same file.

### What this does not catch

- **A test that newly kills a filed survivor, until its filing is retired or the fourth run.** Case 4 of
  the contract. The module's own dispatch (`-f module=<m> -f mode=measure`, `reuse` off by default) measures
  it whole at any time.
- **A change outside the module that newly kills a survivor** (another module, a fixture, a dependency the
  tests execute). Same direction, same bound.
- **A Stryker whose differ stops behaving as read.** The contract runs in every plan job before any reuse;
  it checks cases 1 to 3 on a throwaway project, not on this repository's modules.
- **The cost estimate.** It is the ADR-0104 model on 0.46.0 data, the code condition approximated at the
  survivor's first line, the filing condition at the module's rate; the first reuse run is the
  measurement.

## What would settle it

- **For A**: the first release ratchet that reuses ends under 6 h at 12 abreast, its `ratchet` job counts
  every chunk for every module, its summary reports `survivorsReused` for every complete module, and a
  dispatch of the same commit with `reuse=off` gives the same answer for every module, or differs only on
  survivors a test now kills (reported by the full run as filed and not produced), each named.
- **Against A**: a reuse run answers "describes" for a module where the full run of the same commit finds
  a survivor the register does not file. That would mean a reuse hid a hole, which decision 1 says it
  cannot.

## Reevaluation trigger (mandatory, dated)

Reopen at the first reuse run whose `reuse=off` twin disagrees on anything but a survivor a test now kills,
at the first Stryker upgrade that fails `test/stryker-incremental-contract.js`, if per-test coverage
becomes available to the command runner (C and D would then be worth measuring again), or on 2027-05-12,
whichever comes first.

**Trigger set on**: 2026-11-12 · **Watched via**: each release's signed summary (`reuse`,
`survivorsReused`) read when it is filed under `docs/compliance/ratchet-summaries/`.

## References

- `scripts/mutation-reuse.mjs`, `scripts/mutation-key.mjs` (`survivorKeys`), `scripts/mutation-plan.mjs`
  (`--reuse`), `scripts/ratchet-summary.mjs`, `test/stryker-incremental-contract.js`,
  `test/unit/mutation-reuse.test.js`, `test/unit/ratchet-summary.test.js`.
- `.github/workflows/mutation-ratchet.yml` (`plan`, `measure` and `summary` jobs, `reuse` input),
  `.github/dispatch-allowlist.json`, `stryker.config.json` (lever 2).
- `node_modules/@stryker-mutator/core/src/mutants/incremental-differ.ts` (10.1.1).
- Run 40684642130 (the 0.46.0 release ratchet) and run 42878769502 (the coverage map).
- ADR-0046, ADR-0059, ADR-0079, ADR-0085, ADR-0088 decision 4, ADR-0103, ADR-0104, ADR-0105, ADR-0110,
  ADR-0112.
