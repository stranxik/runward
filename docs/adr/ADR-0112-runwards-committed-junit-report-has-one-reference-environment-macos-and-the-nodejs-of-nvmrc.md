# ADR-0112 — runward's committed JUnit report has one reference environment: macOS and the Node.js of `.nvmrc`

**Date**: 2026-11-04
**Status**: accepted (2026-11-04) — the maintainer decided that `reports/junit.xml` is written on macOS with
the Node.js release `.nvmrc` names (24.22.1), that the report says which environment wrote it, that
`npm run test:reports` refuses one written anywhere else, and that a CI job in that environment regenerates
it and fails when it differs from the committed one; `engines` stays the floor users need
**Deciders**: the maintainer. Written by an agent session on the maintainer's decision; under ADR-0088
decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: read on a fresh clone of `stranxik/runward` at `main@4541a90` (0.46.0): `scripts/junit-committable.mjs`,
`scripts/reports-fresh.mjs`, `scripts/net-shrink.mjs`, `src/lib/tool-adapters.ts` (`junitTestCases`,
`junitProjection`), `.github/workflows/ci.yml` (job `lint-and-reports`), `package.json` (`engines`,
`test:junit`, `test:reports`), ADR-0073, ADR-0102, RWD-2026-0113. Measured on 2026-11-04: one three-case
suite, one case named `a "quoted" name`, run with `node --test --test-reporter=junit` under Node.js 24.18.0,
22.22.2, 25.4.0 (Homebrew and nvm builds on macOS) and 24.22.1 (the official darwin-arm64 tarball, its
SHA-256 checked against `SHASUMS256.txt`); the committed `reports/junit.xml` read for its escaping (16 names
written `&amp;quot;`, none `&quot;`) and its census (1,739 cases)
**Relates to**: [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md) (how a report becomes
citable evidence), [ADR-0102](ADR-0102-whether-the-seal-hashes-a-junit-report-by-what-the-gate-reads-of-it-rather-than-its-bytes.md)
(the projection seal), [ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md) (the net-shrink guard, M3),
RWD-2026-0113, RWD-2026-0187 and RWD-2026-0188 in [known-defects.md](../compliance/known-defects.md)

## Context

**What a test runner writes depends on the runner.** Node.js's junit reporter writes a `"` of a test name as
`&amp;quot;` up to 24.21.x, and in every 20.x, 22.x and 25.x release, and as `&quot;` from 24.22.0
(nodejs/node#65971, commit dc3b46f749). Measured on 2026-11-04: 24.18.0, 22.22.2 and 25.4.0 write
`name="a &amp;quot;quoted&amp;quot; name"`, 24.22.1 writes `name="a &quot;quoted&quot; name"`, for the same
file. runward's committed report holds sixteen names carrying a `"`, all written `&amp;quot;`: it was last
regenerated under an older Node.js.

**What that broke.** The net-shrink guard counted those sixteen cases as removed on a pull request that
removed none, after the report was regenerated under a newer Node.js. The product's own readers had the same
fault (RWD-2026-0187: the gate refused a pointer under one Node.js that it linked under the other, and the
unreleased projection seal of ADR-0102 B broke). Those readers are fixed by reading the document's escaping
(`junitWritesQuotesTwice`, `decodeJUnitValue` in `src/lib/tool-adapters.ts`). This record is about the
other half: the file runward commits.

**Why the readers' fix is not enough for the committed file.** The escaping is one difference among those a
runner can introduce; another is already known. Four case-folding tests carry
`{ skip: CASE_INSENSITIVE ? false : "…" }`: they run on macOS and are `<skipped>` on Linux
(`scripts/reports-fresh.mjs`, measured 2026-09-12). A report written on one machine and compared on another
differs without the suite having changed, and `test:reports` can only say so, not tell staleness from
weather. ADR-0073 makes the committed report the evidence runward's own rows cite; a piece of evidence whose
bytes depend on whoever last ran the suite is not one file, it is several.

**What exists.** `npm run test:junit` (`scripts/junit-committable.mjs`) writes the report on whatever
machine runs it, with no trace of which. `npm run test:reports` (`scripts/reports-fresh.mjs`) regenerates it
and compares the census and the verdicts (not the bytes: `node --test` writes cases in completion order). CI
runs it in the job `lint-and-reports` on `ubuntu-latest`, Node.js 22, the one platform the committed report
was not written on. No `.nvmrc`. `engines` is `>=22.12.0`, the floor users need.

## Options considered

- **A. One reference environment, recorded in the report, refused elsewhere, regenerated in CI there.**
  `.nvmrc` names the Node.js release; the platform is `darwin`, where the maintainer works and where the
  case-folding tests run. The generator writes `<!-- generated: node vX.Y.Z <platform> -->` into the report;
  `test:reports` refuses a committed report whose comment names another environment, or none, and says how
  to regenerate; the existing CI job moves to `macos-latest` with `node-version-file: .nvmrc`.
- **B. Normalise the bytes after generation** (rewrite `&amp;quot;` to `&quot;` in the generator). It fixes
  the one difference known today and none of the others, and it makes the committed file a rewriting of
  what the runner wrote, which ADR-0073 keeps to the removal of what a tree cannot carry (paths, timings).
- **C. Compare across environments, tolerating known differences.** That is what `test:reports` already
  does for skips; each new tolerance is one more place where a real difference can hide.
- **D. Pin `engines` to the reference.** It would move the users' floor to the maintainer's machine, which is
  not what `engines` says.

## Decision

**A**, decided by the maintainer on 2026-11-04.

1. **`.nvmrc` names the reference Node.js release**: `24.22.1`, a release of the 24 line that carries the
   corrected reporter, and the one measured here. The platform is `darwin`. `engines` stays `>=22.12.0`, the floor users need;
   `.nvmrc` concerns only the machine that writes the file runward commits.
2. **The report says who wrote it.** `scripts/junit-committable.mjs` writes `<!-- generated: node vX.Y.Z
   <platform> -->` after the XML declaration (`withGeneratedComment`, `scripts/junit-reference.mjs`). Comments
   are outside every reading of the report: `junitTestCases` reads `<testcase>` tags, `junitProjection`
   skips comments, and the document rule of RWD-2026-0187 is unchanged by one (pinned by
   `test/unit/junit-quote-escaping.test.js`).
3. **`npm run test:reports` refuses a report from elsewhere.** `scripts/reports-fresh.mjs` refuses a
   committed `reports/junit.xml` whose comment names another Node.js or platform, or carries none, naming the
   environment and the command that regenerates it (`referenceProblem`, `scripts/junit-reference.mjs`).
4. **CI regenerates it in the reference environment.** The job `lint-and-reports` of
   `.github/workflows/ci.yml`, which already regenerates every committed report and fails when one no longer
   describes the tree (RWD-2026-0113), runs on `macos-latest` with `node-version-file: .nvmrc` instead of
   `ubuntu-latest` with Node.js 22. One job, not a second one beside it.
5. **The committed report is regenerated by the maintainer in that environment** after this lands; until
   then `test:reports` is red on purpose, since the committed report names no environment.

## Alternatives discarded

- **Linux as the reference.** It would match the CI default, and record as skipped the four case-folding
  tests that macOS runs; the maintainer works on macOS, so every local regeneration would differ from it.
- **A byte comparison in CI.** `node --test` writes cases in completion order across parallel files, so two
  honest runs on one machine already differ byte for byte; the census and verdict comparison stays.
- **The Node.js version in a separate file beside the report.** The report would travel without it.

## Consequences

- **A report regenerated on another machine is refused by `test:reports`**, with the command that fixes it,
  rather than compared and half-explained.
- **The CI job costs a macOS runner** (public repository: no minutes billed, a slower queue).
- **Moving the reference is a change to `.nvmrc` and a regeneration in one commit**, read in its diff: the
  sixteen names carrying a `"` are the visible part of the 24.21 to 24.22 move.
- **Nothing changes for users.** No CLI behaviour, output or verdict depends on this; their reports are read
  whichever Node.js wrote them (RWD-2026-0187).

### What this does not catch

- **A difference inside the reference environment.** Two runs on one macOS with one Node.js can still differ
  by order (not compared) or by a flaky test (compared, and refused: the right answer).
- **A forged comment.** The comment is written by whoever runs the generator, and nothing proves it; the CI
  job is what regenerates the report where the comment says.

## What would settle it

- **For A**: over the next ten pull requests that change a test, `test:reports` refuses no committed report
  for a reason other than staleness or its environment, and the net-shrink guard counts no case removed
  that the suite still holds.
- **Against A**: the macOS job refuses a report the maintainer regenerated on macOS with the Node.js of
  `.nvmrc`, for a reason in the environment rather than in the tree.

## Reevaluation trigger (mandatory, dated)

Reopen at the first refusal described under "Against A", when Node.js 24 leaves maintenance, when GitHub's
`macos-latest` moves to an architecture or release the maintainer does not run, or on 2027-02-04, whichever
comes first.

**Trigger set on**: 2026-11-04 · **Watched via**: the `lint-and-reports` job of `.github/workflows/ci.yml`
on pull requests, and the net-shrink guard's `junit-quote-escaping` note.

## References

- `.nvmrc`, `scripts/junit-reference.mjs`, `scripts/junit-committable.mjs`, `scripts/reports-fresh.mjs`,
  `test/unit/junit-quote-escaping.test.js`.
- `.github/workflows/ci.yml` (job `lint-and-reports`).
- nodejs/node#65971 (commit dc3b46f749), the reporter's escaping.
- ADR-0073, ADR-0090, ADR-0102, ADR-0088 decision 4; RWD-2026-0113, RWD-2026-0187, RWD-2026-0188.
