# ADR-0105 — A surviving mutant runs only the unit test files that execute its lines

**Date**: 2026-11-03
**Status**: accepted (2026-10-28) — the maintainer decided to pursue the narrowing if the measurement
supported it; measured 2026-11-03, the gain on what survivors cost is 51 % (estimate, above the 30 %
the decision required), so it is implemented: a coverage map per build, a mutant table per leg, and
a test command that runs the covering files and falls back to the whole suite on any doubt
**Deciders**: the maintainer. Written by an agent session on the maintainer's decision; under ADR-0088
decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: read on a fresh clone of `stranxik/runward` at `main@b7d8c62` (0.46.0):
`stryker.config.json`, `scripts/mutation-testcmd.sh`, `scripts/mutation-chunked.sh`,
`scripts/test-cost.mjs`, `test/unit-cost.json`, `.github/workflows/mutation-ratchet.yml`,
`@stryker-mutator/core` 10 (`test-runner/command-test-runner.js`, `process/2-mutant-instrumenter-executor.js`,
`fs/project-reader.js`) and `@stryker-mutator/instrumenter` (`printers/js-printer.js`), ADR-0046,
ADR-0059, ADR-0103. Measured on the maintainer's server (4 cores, a `node:24` container capped at 3.5
cores, `~/.claude/skills/nas/scripts/verifier-sur-nas.sh`), never on the laptop: the coverage map of
2026-11-03 (every unit test file run alone under `NODE_V8_COVERAGE`; first map at 18:55, load average
0.25 before and 8.74 after, 865 s; the map this record cites at 19:23, load 5.41 before and 7.85 after
with another verification sharing the machine, 1187 s; the covering sets do not depend on load, the
seconds below come from `test/unit-cost.json`); the 173 chunk reports of release run 40684642130
(0.46.0, 2026-10-28) downloaded with `gh run download`, merged into 12 361 mutants (9 911 killed,
2 403 survived, 47 timeouts); the source each report embeds hashed against the local build (23 of 25
modules identical; `evidence` and `tool-adapters` changed since and are left out of the line-matched
figures); the positive control run on the server, below
**Relates to**: [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md) (decision 3: an
instrument that makes every change wait gets switched off), [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md)
(the ratchet that refuses a survivor the register does not carry),
[ADR-0103](ADR-0103-the-register-records-the-source-each-module-was-measured-on-and-a-stale-one-refuses-the-release.md)
(a measurement keyed to the digest of the build it measured), ADR-0088 decision 4

## Context

**What a mutant costs, and why survivors cost most of it.** `stryker.config.json` runs the command
runner with `coverageAnalysis: "off"`: Stryker knows nothing of which test reaches which mutant, and
re-runs `scripts/mutation-testcmd.sh` whole for every mutant. That command runs the 146 cheap files
first and the 65 expensive ones only if nothing cheap failed, so a killed mutant pays about 10 s and a
survivor pays the whole suite, about 146 s. On release run 40684642130 that is, with the release
estimate `t ≈ 893 s × legs + 9.9 s × killed + 145.7 s × survivors`: 173 legs × 893 s = 43 h of fixed
cost, 9 911 killed × 9.9 s = 27 h, 2 450 survivors and timeouts × 145.7 s = 99 h, 169 runner-hours in
all, of which survivors are 59 %. The whole-suite cost of a survivor was correct as long as nothing
knew which tests could reach it: proving that nothing kills a mutant means running everything that
could.

**Why Stryker's own coverage did not work here.** Tried on 2026-08-18 with the tap runner:
106 of 106 mutants reported "no coverage". 64 of the 65 expensive files spawn the CLI as a
subprocess, and per-test coverage collected in the test process sees nothing a subprocess executes.

**What can see it.** `NODE_V8_COVERAGE` is read by every Node process that inherits it, so a test
file run alone under it writes one coverage file per process it spawned, the CLI's included. Two
test files rebuild their environment from scratch (`test/unit/delegation-stop.test.js:71`,
`test/unit/adapter-version-pin.test.js:126`); neither runs `dist/lib` in that process (a repository
script, and shell stubs), so nothing of the perimeter is lost there. `test/unit/example-packed.test.js`
runs a packed copy of the tree from a temporary directory: inside Stryker's sandbox that copy holds
the instrumented module, so the map counts it as covering and records where it saw the copy
(`elsewhere`).

**What the command is told about the mutant.** Stryker's command runner sets one variable,
`__STRYKER_ACTIVE_MUTANT__`, to the mutant's id (`command-test-runner.js:62`). The sandbox holds the
instrumented file, printed by `@babel/generator` without `retainLines` (`js-printer.js:3`): 86 lines
for the 41 of `paths.js`. So the sandbox says nothing of the line a mutant sits on. What it does say:
ids are assigned in placement order, which is source order. Measured on the 173 chunk reports: the
ids of every chunk are monotone in (line, column), 173 of 173. The same instrumenter, run on the same
file with the same range and the same options, numbers the same mutants: a table written before
Stryker runs, by calling `@stryker-mutator/instrumenter` as `core` does, reproduces the run's
numbering, lines, end lines and mutators on all 133 same-build chunks, 133 of 133.

## Measurement

**The map.** `scripts/mutation-coverage-map.mjs`: each of the 211 unit test files run alone with
`NODE_V8_COVERAGE`; for each perimeter module, the lines executed in any process of that run (block
granularity: a line counts when the innermost V8 range holding its first non-blank character has a
count above zero). 87 files spawn the CLI and bring its coverage back; 17 spawn something and show no
`dist/cli.js` coverage, each because what they spawn is a script or a packed copy, not the CLI
in place. The map is keyed to the SHA-256 of each module's built file.

**Per mutated line of the 23 same-build modules**, the number of unit test files that execute it and
the sum of their measured seconds (`test/unit-cost.json`, 395.4 s whole):

| module | mutants | survivors | covering files / line, median · p90 | seconds / line, median · p90 | median as % of the suite |
|---|---|---|---|---|---|
| attestation | 74 | 13 | 25 · 88 | 179 · 361 | 45 |
| check-contract | 486 | 32 | 46 · 94 | 258 · 362 | 65 |
| citations | 96 | 4 | 3 · 89 | 3 · 361 | 1 |
| compliance | 566 | 98 | 4 · 6 | 10 · 10 | 2.5 |
| conformance | 1 414 | 208 | 15 · 154 | 99 · 378 | 25 |
| delegation | 698 | 73 | 10 · 157 | 74 · 378 | 19 |
| delegation-sample | 859 | 67 | 5 · 8 | 44 · 65 | 11 |
| gate-hook | 172 | 7 | 4 · 7 | 26 · 32 | 7 |
| identity | 134 | 9 | 13 · 158 | 78 · 378 | 20 |
| mission | 1 614 | 685 | 67 · 154 | 318 · 378 | 80 |
| paths | 42 | 1 | 161 · 161 | 378 · 378 | 96 |
| ratify | 467 | 33 | 5 · 8 | 34 · 57 | 9 |
| rules | 285 | 11 | 17 · 154 | 69 · 378 | 17 |
| sarif | 211 | 50 | 14 · 40 | 135 · 243 | 34 |
| scaffold-lock | 287 | 28 | 76 · 98 | 341 · 356 | 86 |
| spec-conformance | 337 | 32 | 5 · 5 | 21 · 26 | 5 |
| territory | 627 | 36 | 5 · 8 | 0.8 · 1.2 | 0.2 |
| territory-map | 227 | 16 | 10 · 10 | 34 · 34 | 9 |
| verdict | 379 | 70 | 75 · 76 | 342 · 344 | 86 |
| verify-findings | 73 | 8 | 67 · 89 | 318 · 361 | 81 |
| wire-install | 107 | 18 | 2 · 88 | 4 · 361 | 1 |
| witness | 601 | 407 | 1 · 1 | 25 · 25 | 6 |
| workflow-contract | 206 | 33 | 76 · 78 | 342 · 342 | 86 |

Two populations: modules every CLI run loads (`mission`, `verdict`, `scaffold-lock`, `paths`,
`workflow-contract`, `verify-findings`) are executed by most files and gain little; modules reached by
their own tests (`compliance`, `territory`, `witness`, `spec-conformance`, `ratify`, `gate-hook`,
`delegation-sample`) gain almost everything. `witness` carries 407 of the 1 939 same-build survivors
and one covering file per line.

**The map's blindness, checked against the run.** Killed mutants on lines the map says no unit test
executes: 0 of 7 996. (The first map of the day called seven killed `ObjectLiteral` mutants of
`mission.js` unexecuted: they start on a line holding only `{`, which that map had excluded; the map
now keeps every non-blank line, and the selector joins the mutant's whole span.) Survivors on lines no
test executes: 142; the selector runs the whole suite for them, which is the conservative answer.

**Granularity, because the leg's range was the obvious cheaper key.** Keyed on the leg's 60-line
chunk instead of the mutant's line (no table needed), the covering set is the union over 60 lines:
median 361 s of 395 s, a 13 % gain on survivors' cost. Keyed on the line: 51 %. The table is what
buys the difference.

**The estimate.** A survivor's wall clock after narrowing is taken as 145.7 s × (covering seconds ÷
395.4 s), never below its longest covering file, and 145.7 s when its lines are unexecuted. On the
1 939 same-build survivors: 78.5 runner-hours before, 38.6 after, a 51 % gain on what survivors cost,
estimate. Applied to the whole release run (the two changed modules assumed to behave as the
twenty-three): 169 runner-hours → 119, 30 % of the release, estimate; the map itself costs one job
of about 15 to 20 minutes per run. The decision's threshold was a gain above 30 % on survivors' cost.

**Positive control.** `check-contract.js` L41-43, the `--witness` beside `--freeze` refusal: the
`ObjectLiteral → {}` mutant the release ratchet killed (chunk `check-contract--1`, id 12). In the full
map one unit test file of 211 executes those lines, `test/unit/verdict-witness.test.js`, the most
expensive file of the suite (24.6 s), which spawns the CLI: the old command reached it only in its
last stage. The table for `dist/lib/check-contract.js:1-60` numbers it 12, as the run did, and the
selector hands over that file alone. Spliced into the build on the server: the 146 cheap files pass
(exit 0, 73 s under load) and `verdict-witness.test.js` alone fails ("refusals exit 2, before the
gate runs, and write nothing"), 63 s. `test/unit/mutation-select-tests.test.js` keeps the selection
half of that control; the kill half is this paragraph.

## Options considered

- **A. Map per build, table per leg, selection in the command, whole suite on any doubt.** The
  measured 51 %. Three scripts and one environment contract between the caller and the command.
- **B. Stryker's `perTest` coverage with a test-runner plugin.** Tried; sees no subprocess. The
  suite would have to stop spawning the CLI, which is what 64 of its 65 expensive files test.
- **C. Key on the leg's range, no table.** 13 %. The cost of the table is seconds per leg.
- **D. Narrow by module name (`RUNWARD_MUTATION_MODULE`) only.** What the command already does
  for ordering; it chooses what runs first, never what runs.
- **E. Run no test when no test executes the line.** Correct if the map is complete, and it would
  turn the one instrument that could show the map incomplete into one that cannot.

## Decision

**A**, decided by the maintainer on 2026-10-28, conditional on the measurement; the condition held.

1. **The map.** `scripts/mutation-coverage-map.mjs` (`npm run mutation:map`) writes, per perimeter
   module and executed line, the unit test files that execute it, subprocesses included, with the
   SHA-256 of each module's built file, each test's seconds, process count and whether `dist/cli.js`
   was seen, and `elsewhere` for coverage of a copy of the build. The ratchet workflow builds it once
   in its plan job and hands it to every leg as an artifact; `scripts/mutation-chunked.sh` builds it
   once per local pass, or reuses the one named in `RUNWARD_MUTATION_MAP`.
2. **The table.** `scripts/mutation-mutant-table.mjs --mutate <file>:<start>-<end>` runs Stryker's
   instrumenter as `core` does, on the pristine file, and writes the mutants in Stryker's numbering
   with their lines and the file's digest. It refuses (exit 2) a `stryker.config.json` that sets
   `mutator` or `ignorers`, which it would have to mirror. Written per leg, before Stryker runs.
3. **The selection.** `scripts/mutation-select-tests.mjs`, called by `scripts/mutation-testcmd.sh`
   inside the sandbox when `RUNWARD_MUTATION_MAP`, `RUNWARD_MUTATION_TABLE` (absolute paths) and
   `__STRYKER_ACTIVE_MUTANT__` are set: the union of the covering files over the mutant's lines,
   cheap files first in one `node --test`, expensive ones after, exit at the first failure. On every
   doubt it prints `ALL` with its reason on stderr and the command runs the whole ordered suite: an
   input missing or unreadable; the table's digest differing from the map's for that module; the
   sandbox file carrying a different number of `stryMutAct_9fa48("…")` markers than the table, or no
   marker for the id; an id the table does not know; a line no test executes; a test file the map
   names and the sandbox lacks. Never fewer tests silently.
4. **The safety property.** A test that never executes a mutant's lines cannot fail because of the
   mutant. Running fewer tests than the covering set can therefore turn a kill into a survivor and
   never a survivor into a kill; and a survivor the register does not carry is what the ratchet
   refuses (ADR-0059). The one error the narrowing can make is loud, and in the safe direction.
5. **The workflow change sits in its own commit**, pushed by the maintainer (agent sessions cannot
   push workflow files): the plan job's map step and artifact, the legs' download, table step and
   two environment variables. A map or table that fails to build fails nothing; the leg runs as
   before.

## Alternatives discarded

- **Committing the map.** It would be stale on the first change to any module or test, and keyed by
  digest it would then do nothing. Built per run, it is fresh by construction and costs one job.
- **Deriving the line from the instrumented file.** The marker's neighbourhood holds the original
  expression's text, not its line; matching text back to a line is a second instrumenter.
- **Counting the map's blindness as acceptable loss.** A killed mutant on an unexecuted line would be
  a survivor the ratchet refuses with no code change to explain it. The check against the run exists
  to keep that number at zero, and it is zero.

## Consequences

- **A survivor pays its covering files.** Median 25 % of the suite over the perimeter's mutated
  lines; 2.5 % in `compliance`, 0.2 % in `territory`, 86 % in `verdict`.
- **The map's cost is paid once per run**, in the plan job, before any leg; a leg whose rebuilt
  `dist/` differs from the plan job's reads the digests and pays the whole suite, said on its log.
- **`test/unit/mutation-select-tests.test.js` is the suite's most expensive file**: its positive
  control builds a four-file map on the real tree. It is on the slow list from a single measurement
  under load (78.5 s); `node scripts/test-cost.mjs` on an idle machine re-measures it.
- **The ordering decisions of 2026-08-19 stand.** `RUNWARD_MUTATION_MODULE` still puts the module's
  own tests first on the whole-suite path; the cheap-first split still decides the order inside a
  selection.

### What this does not catch

- **A test that kills a mutant without executing its lines.** A mutant in a static initialiser is
  executed at import, and the map sees imports; a test that reads the built file as text
  (fingerprints, `git grep`) kills nothing by the mutant switch, so no such kill is lost. None was
  found in the 7 996 killed of the run; a later one would appear as a ratchet mismatch on an unchanged
  module, which is the reevaluation trigger below.
- **The whole-net legs** (`scripts/mutation-wholenet.mjs`): unchanged, they run the self-gate and
  the schemas, not the unit suite.

## What would settle it

- **For A**: the 0.47.0 release ratchet answers "describes" for every module (or refuses only for a
  named reason in the test net), with its legs' logs showing `mutation-select-tests` selections and a
  total runner time below the 169 h of 0.46.0 by about the estimate.
- **Against A**: a ratchet refusal on a module whose build and tests did not change since its filing,
  with the refused survivor killed when run against the whole suite: the map would then have missed a
  covering file.

## Reevaluation trigger (mandatory, dated)

Reopen at the first ratchet refusal of the "against" shape above, at the first release whose ratchet
runs longer than 0.46.0's 169 runner-hours with the narrowing on, or on 2027-02-03, whichever comes
first.

**Trigger set on**: 2026-11-03 · **Watched via**: each release's signed ratchet summary
(`docs/compliance/ratchet-summaries/`) and the run's runner time (`gh run view`).

## References

- `scripts/mutation-coverage-map.mjs`, `scripts/mutation-mutant-table.mjs`,
  `scripts/mutation-select-tests.mjs`, `scripts/mutation-testcmd.sh`, `scripts/mutation-chunked.sh`,
  `test/unit/mutation-select-tests.test.js`, `docs/compliance/mutation-register.md` (Method, pass 1).
- `.github/workflows/mutation-ratchet.yml` (plan job: "Coverage map (ADR-0105)"; measure job:
  "Coverage map and mutant table (ADR-0105)").
- Release run 40684642130 (`gh run download`, 173 `chunk-*` artifacts, 25 `answer-*`).
- ADR-0046, ADR-0059, ADR-0103, ADR-0088 decision 4.
