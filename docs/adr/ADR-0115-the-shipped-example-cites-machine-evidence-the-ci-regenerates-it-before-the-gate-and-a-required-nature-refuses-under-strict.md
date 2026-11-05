# ADR-0115 — The shipped example cites machine evidence, the CI regenerates it before the gate, and a required nature refuses under `--strict`

**Date**: 2026-11-05
**Status**: accepted (2026-11-05)
**Deciders**: a delegated agent, under class D of `runward/delegation.md` (non-constitutional ADRs), on the
maintainer's instruction of 2026-11-05. Decision 4 is implemented in a second pull request that changes
pre-merge paths (`src/lib/evidence.ts`, `src/lib/verdict.ts`, `src/lib/conformance.ts`,
`src/commands/check.ts`) and waits for the maintainer before merge (ADR-0088 decision 7); the charter names
"arming the gate" in class R, and if the maintainer reads decision 4 as that, the approval of that pull
request is the decision. The first pull request changes `package.json`, also a pre-merge path, and waits
the same way. The job of decision 3 in `.github/workflows/ci.yml` is the maintainer's to add: a change to a
workflow waits for the maintainer (ADR-0110), and the App that pushed these pull requests cannot write one
**Method**: read on a fresh clone of `stranxik/runward` at `main@8ffdf7c` (0.46.0 and unreleased): ADR-0008,
ADR-0060, ADR-0065, ADR-0073, ADR-0075, ADR-0098, ADR-0102, `src/lib/evidence.ts` (`requiresLedger`,
`natureSatisfied`, `declaredUncarriableNatures`), `src/lib/tool-adapters.ts`, `src/lib/verdict.ts`,
`src/lib/hooks.ts`, the shipped example and the CI samples. Measured on 2026-11-05, on macOS with the
Node.js of `.nvmrc` (24.22.1) unless said: the sabotage replays of the 0.46.0 example and of a bench that
added machine evidence to it (the measurements this decision starts from); then the new example, built by
`init --example` from this tree, with each sabotage replayed unsealed and sealed, in the recommended CI and
in a local `check --strict`; the example's reports regenerated under Node.js 22.22.2, 24.18.0 and 24.22.1
**Relates to**: [ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) (the hook seam),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0060](ADR-0060-a-vacuous-green-is-disclosed-not-refused.md) (the Jest shape of a refusal),
[ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md),
[ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md) (option 1, and the arming it blocked),
[ADR-0075](ADR-0075-a-required-nature-the-project-cannot-produce.md) (a nature declared uncarriable),
[ADR-0098](ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md)
(the JUnit freshness recipe), [ADR-0102](ADR-0102-whether-the-seal-hashes-a-junit-report-by-what-the-gate-reads-of-it-rather-than-its-bytes.md)

## Context

**What 0.46.0 lets through on its own example.** With nothing but a committed JUnit report and pointers at
source files, `check --strict` on the shipped example stayed green after each of these changes, measured on
2026-11-05: the domain rewritten around a database driver while keeping every cited symbol name (an import
of `pg`, a live-looking key in a literal, SQL built by concatenation, case a); a file added to the core that
sends a request to a model and executes what comes back (d, and d2 where the use case imports it); every
source file replaced by a stub that keeps the cited names, with a JUnit report written by hand (c3b); the
test bodies emptied with their names kept, the JUnit report left (e1) or regenerated (e2). Every one of them
is a change the gate's contract never claimed to see: the gate reads that a decision is traced and that its
evidence resolves, and none of that evidence said anything about what the code does.

**What machine evidence changes, measured on the same release.** A bench gave the example an ESLint run
(written per file as ESLint JSON and per rule as SARIF) and an LCOV coverage report, cited them from the
manifests, and regenerated all of them in CI before running the gate again. The same 0.46.0 refused seven
sabotages of seven (a, c3b, d, d2, e1, e2, and a with e2 combined), including when the agent had re-sealed
the mission before pushing, and stayed green on the healthy mission and on a legitimate rename.

**Why regeneration is not optional.** The gate detects a report by its shape (`isEslintReport` reads a JSON
array carrying `filePath` and `messages`). A JSON file of 93 bytes written by hand satisfied the `eslint`
nature of a row on 2026-11-05. That is the design, not a defect: the gate reads a committed report and never
runs the tool (ADR-0054). It follows that a committed report counts only where something regenerates it from
the tree under review and refuses a difference, as ADR-0098 already decided for JUnit.

**What blocked the arming.** ADR-0073 kept `requires:` disclosed and not refused until the example could
provide its own evidence: arming it turned `init --example` red. Measured on `main@8ffdf7c`, the example
reports 17 unmet requirements (junit on 11 rows, eslint on 4, adr on 2). runward's own mission reports one,
`loadtest` on `checklist-pre-production-performance`, which ADR-0075 declares uncarriable for a CLI with no
concurrency surface (the 17 of ADR-0073's watch line counted an earlier tree).

**Bytes differ across honest environments.** The example's coverage report, regenerated under Node.js 22.22.2
and under 24.22.1, differs in the hit counts of two lines; the files measured, and whether each one ran, are
the same. Its JUnit report is byte-identical across the three releases measured, and every report is
byte-identical across two runs on one machine.

## Decision

**1. The example carries four reports a tool writes, each chosen for what the others cannot say.**
- `code/reports/junit.xml` (exists, ADR-0073): a case ran green. Cited by a case on every row whose rule
  requires `junit`, each case chosen because it exercises the row's claim.
- `code/reports/lcov.info`: the code a case is about still runs. A JUnit report cannot tell an emptied test
  from a real one; the coverage report can, because the domain no longer executes. Cited by file
  (`#src/core/domain/guard.ts`) on the rows whose claim lives in one file.
- `code/reports/eslint.json`: a cited file obeys the boundary. Cited by file on the `eslint` rows.
- `code/reports/eslint.sarif`, the same ESLint run per rule: a rule held everywhere, including in a file no
  row cites (an added `autopilot.ts`). Its rule list is read from the configuration in force, so a rule
  switched off disappears and a row citing it is refused.

`code/eslint.config.mjs` encodes what the mission says: the core imports its own modules and `zod`, never an
infrastructure package, a Node.js built-in or an adapter (`no-restricted-imports` with a regex allowlist);
the core calls no network global and loads nothing at run time; nowhere under `src/` is a string run as code
(`no-eval`, `no-new-func`, `no-implied-eval`) or a credential written as a literal (`no-restricted-syntax`
over the literal shapes of common keys, tokens, private key blocks and passwords in URLs); an inline
`eslint-disable` has no effect (`noInlineConfig`). Dependencies added to the example: `eslint`,
`@typescript-eslint/parser` and its peer `typescript`. No plugin, no SARIF formatter, no coverage tool: the
SARIF is written from ESLint's own results and the coverage is Node.js's. The topology rows that require an
ADR cite `adr:0003`, the decision they describe. `check --strict --json` on the example reports
`requiresUnmet: []`.

**2. Each report is produced and normalised by a script, as ADR-0073 option 1 decided for JUnit.** One
script per tool (`scripts/junit-committable.mjs`, `coverage-committable.mjs`, `lint-committable.mjs`) runs it,
removes only what ties the output to the machine that ran it (absolute paths, timings, the echoed source and
fix payloads), sorts what has no order, keeps every verdict and count, writes the report even when it is red
or empty (a previous file would otherwise stay green in the tree), and exits with the tool's own status.
`npm run reports` runs the three.

**3. The freshness recipe covers every cited report, and the shipped CI runs it before the gate.**
`npm run reports:fresh` (`scripts/reports.mjs --check`) regenerates the four reports into a scratch
directory, never into `reports/`, and compares, per report, what the gate reads of it and what else it
records that does not depend on the machine: for JUnit, every case (suite, classname, name) and its verdict;
for LCOV, every file measured and whether anything executed it; for ESLint JSON, every file linted, its
counts, and the rule and line of each message; for SARIF, every rule in force and the rule, level, file and
line of each result. Never the bytes (measured: Node.js 22 and 24 differ). It refuses any difference, a tool
that is not green and a report that is missing, naming each. The mission says to run it in
`runward/hooks.json`, so `runward check --strict --hooks` runs it, then the gate. The CI the product ships
runs the gate that way by default: `templates/adapters/github-actions.yml` and `gitlab-ci.yml`, which
`init` writes into every mission, and the GitHub Action and the GitLab template through a new `hooks` input
whose default is `true`. ADR-0008 stands as written: a plain `runward check` runs nothing, and a clone runs
nothing; what changes is that the CI integrations pass the flag. runward's own CI gains a job that runs the
example the same way, on Linux and Node.js 22 (`example-evidence`, added by the maintainer: see Deciders).
`docs/recipes/junit-freshness-in-ci.md` gains the general case.

**4. Under `--strict`, an applied row whose rule requires a nature no pointer in the row carries is refused.**
- It is a conformance gap on the row, kind `requires-unmet`, counted in the verdict, listed in `Why red`, in
  `conformance[]` and in every rendering, and re-derived by `verify` from the same verdict; no new field.
- The refusal names the rule, the nature, a form to cite, and the three ways out: cite a report of that
  kind; mark the row `deviated` with the ADR that decides it; or, when the mission cannot produce that kind
  at all, declare it in an accepted ADR (`**Nature not carried**: <nature> — <why>`, ADR-0075).
- A declared nature is not refused. It stays unmet in the `requiresUnmet` ledger and is printed on every
  strict run with the ADR that declares it: a decision an assessor can read, never an exemption the tool
  grants.
- No command-line flag accepts an unmet nature. ADR-0060 asked that a refusal of this family take Jest's
  shape, a named opt-in and never a silent pass. The named opt-in here is a decision the tree carries, one per
  row or one per nature, which `verify` re-derives and a reviewer reads in a diff; a flag would make the
  verdict depend on the invocation, need its own field in the attestation, and let a CI file accept every
  unmet row at once. The migration window an adopter needs already exists: each shipped adapter runs the
  runward version that wrote it, and `runward update` moves it.

**5. runward's own mission stays green honestly.** It cites a report of each kind its rules require, except
`loadtest`, which its journal declares uncarriable (ADR-0075). Decision 4 does not refuse it; the line that
says so is printed on every strict run. That is the second consequence of ADR-0073 met by the mechanism
ADR-0075 built: the journal says plainly which natures this delivery cannot carry, and why.

## Alternatives discarded

- **Compare the bytes of the regenerated reports.** Simple, and wrong across environments: the coverage report
  differs between Node.js 22 and 24 on an unchanged tree. A guard that fails an honest pipeline is switched off.
- **Commit no report; produce them in the CI job only (ADR-0073 option 2).** The local `check --strict` would
  read nothing, and ADR-0073 chose committed reports for that reason.
- **A runward command that runs the tools.** ADR-0054: the verdict path runs nothing. The regeneration is the
  operator's command, run by the hook seam the operator wired.
- **A coverage threshold.** A floor is a policy (ADR-0056); the gate says a file ran, never how well it was
  tested.
- **A secrets scanner in the example.** The right tool for a project that holds secrets (runward runs one on
  itself); for an example that holds none, a lint rule over literal shapes keeps the dependency set to ESLint.
- **A `--pass-with-unmet-requires` flag.** See decision 4.

## Consequences

- **Positive.** The first command the product recommends now ships a mission whose gate is bound to what the
  code does, not only to where it lives, and the CI it ships proves the reports are the tree's.
  Measured on the new example (the table is in the pull request): a, d, d2, e1, e2 and c3b, the last with every
  cited report forged by hand, each pass `check --strict` on the committed, unsealed tree and are refused by
  `check --strict --hooks`; the healthy mission and the legitimate rename pass both.
- **Negative, accepted.** `npm install` in the example fetches ESLint and TypeScript (about 60 MB) and needs
  Node.js 22.13 or later for the lint; the CI gate spends seconds installing and regenerating; a mission whose
  `hooks.json` holds workstation-only commands sees them run in CI (set `hooks: false`). Adopters' missions
  with unmet natures turn red on the release that ships decision 4, with the ways out named.

### What this does not catch

- **The instrument lives in the tree it judges.** `scripts/reports.mjs`, `eslint.config.mjs`, `hooks.json`,
  the `package.json` scripts and the CI workflow are files an agent can edit. The example cites the
  configuration, the script and the hook (`file:code/eslint.config.mjs#no-restricted-imports`,
  `file:code/scripts/reports.mjs#--check`, `file:runward/hooks.json#reports:fresh`), so removing what they name
  is red locally and a sealed mission's seal covers them. Measured: case a, plus `reports.mjs` reduced to
  `process.exit(0)`, is refused locally and in CI by that pointer; the same with `--check` kept in a comment is
  green in CI, and only the seal (when the agent does not re-seal) or a review sees it. The control that holds
  is the forge's: CODEOWNERS or a ruleset requiring review on those paths and on `runward/`.
- **Shapes, not meaning.** A credential in a shape the rule does not list; a test that imports a module and
  asserts nothing keeps the file "exercised". Mutation testing measures assertion strength, outside the gate.
- **The hook is a command from the tree under review.** It runs with the trust given to `npm test`; never run
  it under `pull_request_target` on an untrusted head.
- **The gate's own disclosure counts committed JUnit reports only** (ADR-0098 option B). Rows judged on a
  committed ESLint, SARIF or LCOV report are not counted on that line yet.

## What would settle it

- **For**: the sabotages measured here stay refused by `check --strict --hooks` on every release's example,
  and the job `example-evidence`, once added (Linux, Node.js 22, reports written on macOS with Node.js 24),
  refuses no honest tree over its first twenty runs.
- **Against**: an honest regeneration refused for a reason in the environment rather than in the tree (the
  comparison flaps), or an adopter whose row cites legitimate evidence of another kind than the corpus
  requires, refused by decision 4 with no way out but a declaration that is not true.

## Reevaluation trigger (mandatory, dated)

Reopen at the first refusal of `example-evidence` for an environmental reason, when a linter or a test runner
in common use writes a commit or a source digest into its report (ADR-0098 option F), at the first adopter
report that decision 4 leaves only an untrue declaration, or on 2027-02-05, whichever comes first.

**Trigger set on**: 2026-11-05 · **Watched via**: the `example-evidence` job of `.github/workflows/ci.yml`
once the maintainer adds it, `requiresUnmet` on the example and on runward's own mission, and the issue
tracker.

## References

- `examples/request-triage/code/eslint.config.mjs`, `scripts/reports.mjs` and the three generators,
  `examples/request-triage/runward/hooks.json`, the manifests of the example.
- `templates/adapters/github-actions.yml`, `templates/adapters/gitlab-ci.yml`, `action.yml`,
  `templates/ci/gitlab/runward-gate.yml`; `docs/recipes/junit-freshness-in-ci.md`.
- `test/unit/example-machine-evidence.test.js`, `test/unit/forge-gitlab-template.test.js`.
