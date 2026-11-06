# ADR-0122 — runward-integrations: MIT recipes outside the verdict, each regenerating its report out of the agent's reach, with its `requires:` rows, a planted-sabotage control and a named maintainer, counted only while its control passes

**Date**: 2026-11-06
**Status**: accepted (2026-11-06), on option (A) of decision 6, by the maintainer's delegation in chat of
2026-11-05 (« je te fais confiance, réalise à chaque fois au lieu de me demander »: "I trust you, carry it
out each time instead of asking me"), on the recommendation of the agent session that wrote this record;
the maintainer did not review this text before acceptance. This is a delegation, not a review. Proposed
the same day as a question that delegation asked to be written `proposed` and settled next, after
ADR-0121 (accepted). Non-constitutional, class D under ADR-0088 decision 2 (`scope-D` of
`runward/delegation.md`: non-constitutional ADRs): it adds a package beside the product, and touches no
verdict path and no charter path. Its first delivery (the note of 2026-11-06 below) adds a job to
`.github/workflows/ci.yml`, a pre-merge path of the charter: that pull request waits for the maintainer
before merge (ADR-0088 decision 7, ADR-0110)
**Deciders**: the maintainer, by delegation. Written by an agent session; as ADR-0088 decision 3 asks, the
act is recorded by an agent session (agent), for `github:stranxik` (accountable). Under ADR-0088 decision 4
the maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review
**Method**: the bench of 2026-11-05 described in ADR-0121 (fresh copies of `examples/request-triage`,
runward 0.46.0 installed from npm, seven sabotages each pushed as is and after an attempt to re-seal it,
two healthy runs).
Read on a fresh clone at `main@32d8425`: ADR-0005, 0028, 0054, 0073, 0093, `docs/recipes/` and its tests,
`templates/adapters/`, `docs/gitlab-bench.md`, `src/lib/evidence.ts` (`REQUIRABLE_NATURES`); ADR-0115
(pull request #483) and ADR-0119 and ADR-0120 (pull request #482), open when this record was written.
Datadog's annual report on Form 10-K for fiscal 2025, read on 2026-11-05, and the README of its
community integrations repository (`DataDog/integrations-extras`), read on 2026-11-06
**Relates to**: [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md),
[ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
[ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md);
ADR-0115 (pull request #483); ADR-0119 and ADR-0120 (pull request #482)

## Context

**What the bench measured.** On the reference example, the default Action refused 7 of the 14 sabotaged
runs: it reads the reports the agent committed, so a tree the agent re-sealed, or a file no manifest cites,
went through. The gate
re-run on JUnit, lint and coverage reports regenerated in CI refused 14 of 14, with no refusal on the 2
healthy runs. One mission, one language: indicative, not a rate. What closed the gap was not a new check in
the gate: it was a CI step that produced the reports again, from the code, where the agent could not write
them.

**What exists.** ADR-0073 option 1: the report is committed, and the product ships the step that makes it
committable. `docs/recipes/` holds three recipes (JUnit freshness in CI, Lean proofs as JUnit, repository
rules as JUnit), two of them with scripts and a test in this repository
(`test/unit/recipe-repository-rules.test.js` turns the gate red, then green, on `init --example`), and
`templates/adapters/` holds the CI and harness adapters `init` writes. ADR-0115
(open) makes the shipped example regenerate its four reports before the gate. ADR-0120 (open) gives
execution a producer the agent cannot reach, `runward-run`, whose declared-reports leg runs the commands
the operator's run policy names. The natures a row may require are `junit`, `sarif`, `eslint`, `coverage`,
`sbom`, `adr` and `loadtest` (`REQUIRABLE_NATURES`).

**What none of them gives.** For one tool in one CI: a manifest that says which `requires:` rows its
report satisfies, a named maintainer, a step placed out of the agent's reach, and a control showing that
the step turns the gate red when the code is sabotaged. Without them every adopter writes the step again,
and nothing tells a step that regenerates the report from one that reads the report the agent committed,
which is the bench's default case.

**A model, and the lesson taken from it.** Datadog's 10-K for fiscal 2025 counts « more than 1,000
out-of-the-box integrations » and lists keeping them current among its risks (« This development effort may
require significant engineering, sales and marketing resources »). Its community repository says that
« integrations in this repository are maintained by the community » and that « The current maintainer is
listed in `manifest.json` ». The lesson taken here: a recipe without a named maintainer ages unseen, and a
count of recipes says nothing unless each one counted has passed its own control.

## Decision

**Proposed: `runward-integrations` is a set of MIT recipes outside the verdict. Each recipe is a CI step
that regenerates one report from the project's own tools, out of the agent's reach; it ships the
`requires:` rows that report satisfies, a positive control (a planted sabotage the gate must refuse with
the recipe) and a named maintainer. A recipe is counted, wherever runward counts recipes, only while its
control passes.**

1. **What a recipe is.** A directory with a manifest and its files:
   - **the step**, for one CI system, run where the agent cannot write it (a workflow pinned by commit in a
     repository the agent cannot write, as ADR-0120 decision 5 lays out, or the forge's protected
     equivalent), regenerating the report before the gate reads it and normalising it as ADR-0073 option 1
     does: no absolute path, no timing, every verdict and count kept;
   - **the rows**: the `requires:` natures the report satisfies, in the vocabulary above, with the citable
     form of each (`explain` already prints one per nature);
   - **the control**: a fixture mission (the shipped example by default), a planted sabotage the recipe
     exists to catch, and the two expected exits, the sabotaged tree refused with the recipe and the healthy
     one accepted. For a consumer of in-toto attestations, the control is a tampered attestation the
     consumer must refuse;
   - **the maintainer**: a named person or team, with the date and the runward version of the last passing
     control.

2. **The order.** The report formats first: SARIF (`sarif`), JUnit (`junit`), LCOV (`coverage`). Then the
   CI systems: GitHub Actions, GitLab CI, Jenkins. Then the agent harnesses: where each wires the turn-end
   gate and whether the agent's session can edit that wiring, measured per harness in the honest
   per-channel format of ADR-0028. Then the consumers of in-toto attestations, which read `check --attest`
   and `runward-run`'s Statement.

3. **The count.** Only the recipes whose control passed on the current release are counted, in the README,
   on the site and in the docs. A recipe whose control fails, or has not run on the current release, reads
   « not counted », with the reason. No total is published without its list.

4. **Outside the verdict.** No recipe is imported by the `runward` package or changes what `check`
   computes: a recipe changes which files exist when the gate runs, never how they are judged. A recipe
   runs the project's tools in the operator's CI, never in the CLI (ADR-0005, ADR-0054).

5. **With `runward-run`.** A recipe is the how of one report: which tool, which command, which
   normalisation, which rows. `runward-run` is the where and the under-which-identity (ADR-0120): a
   recipe's command can be a leg of its run policy, and the report can then reach `attested` (ADR-0119
   decision 1: bound to the tree by a run Statement, and signed); run as a plain CI step, the same report is
   regenerated but `declared`, and every surface says which.

6. **Where the recipes live, the question this record leaves open.**
   - (A) a package of this repository, `packages/runward-integrations`, released by the chain like
     `runward-fleet` (ADR-0121 decision 5), its controls run by this repository's CI and by the offline
     GitLab CE bench;
   - (B) a repository of its own, maintained by contributors, each recipe's maintainer in its manifest, as
     Datadog's community repository does;
   - (C) recipes in `docs/recipes/`, as today: a page and its scripts, with no manifest, no named
     maintainer and no step out of the agent's reach.

   **Recommended: (A)** for the first three formats and the two forges this repository already tests,
   because a control has to run where the release is built; (B) for a recipe whose maintainer is not
   runward's.

## Alternatives discarded

- **Counting integrations without controls.** A number that cannot tell a working recipe from a decorative
  one; the bench's default case is a step that runs and proves nothing.
- **Recipes inside the CLI** (a command that runs a tool and writes its report). The CLI would run the
  project's tools: ADR-0005 and ADR-0054.
- **Leaving it to each adopter.** Each one rewrites the step, and nothing shows the step turns red on a
  sabotage; on the bench, the default path let half of the sabotaged runs through.
- **Recipes only as `runward-run` legs.** That ties every recipe to a container runtime and a signing
  layout; a plain CI step is the floor an adopter can take first, and it says that it is `declared`.

## Consequences

- **Positive.** The step that closed the bench's gap becomes something an adopter installs instead of
  writing; each recipe carries its own proof that it catches what it claims; the count cannot run ahead of
  the controls.
- **Negative, accepted.** Every recipe is a maintenance surface with a named owner; a control per recipe
  and per release costs CI time; a recipe whose control fails is withdrawn from the count until fixed,
  however popular it is; Jenkins and the harnesses need benches this repository does not have yet.
- **On other boundaries.** No change to the verdict, to `check --json` or to the charter's paths. ADR-0115's
  scripts for the example and ADR-0120's run policy are the first places a recipe's command already lives.

## What would settle it

- **For.** The SARIF, JUnit and LCOV recipes each refuse their planted sabotage on the shipped example and
  accept the healthy tree, in this repository's CI on GitHub and on the offline GitLab CE bench; one
  adopter installs one recipe from its manifest alone, with no other instruction.
- **Against.** A recipe whose control can only redden from inside the CLI; a recipe for which no maintainer
  is found (it is then not shipped); a control that passes on the bench and fails on a real repository in
  another language (the recipe's reach is then narrowed to what its control covers).

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier when: ADR-0121 lands; ADR-0115 lands; ADR-0120's first delivery ships; a
third party proposes a recipe; a counted recipe's control fails on a release.

**Trigger set on**: 2026-11-06 · **Watched via**: the recipes' controls in CI, the offline GitLab CE bench,
the pull requests that add a recipe.

## Note, 2026-11-06: what the first delivery covers, and what remains

**Covered: decisions 1 to 6, for the three report formats and the two forges this repository tests.**
`packages/runward-integrations` (MIT, `private`, no dependency, at runward's version) holds the recipes
`sarif`, `junit` and `coverage` (LCOV), in that order. Each has a manifest validated against
`schema/recipe-manifest.schema.json` by the tests (with planted manifests the schema refuses); a step for
GitHub Actions (a composite action, called by a 40-character commit of this repository) and one for GitLab
CI (a hidden job, its template included at a pinned commit, the package fetched by a URL pinned with its
sha256); its `requires:` row with the form `runward explain` prints, character for character; its
`runward-run` leg; its control; its limits; and its maintainer, `stranxik`, with the date and runward version
of the last passing control. The step runs the project's own command, normalises the report as ADR-0073
option 1 does, and replaces the cited report; a command that writes no report of the recipe's format is
refused and the cited report removed. Samples put the commands out of the agent's reach as well (a reusable
workflow of the operator's, called by commit; the pipeline of a protected project), at parity.

**Measured on 2026-11-06**, by `node packages/runward-integrations/src/cli.js control` on the shipped
example, under Node.js 24.22.1 on macOS and on Linux, with the same exits: for each recipe the healthy tree exits 0 after
the step, the planted sabotage exits 0 without the recipe (built-in analyzers included) and 1 with it, on the
rows its manifest names, and each other recipe's sabotage exits 0 with it. `sarif` refuses a bearer token in
a new adapter no row cites (`checklist-day-zero-project`), a shape the analyzers do not know; `junit` refuses
a guard that promotes an unknown account reference as verified (`frontier-deterministic-boundary`,
`security-prompt-injection`); `coverage` refuses a journal that overwrites instead of appending while the
tests run a copy of their own (`state-event-sourcing`), which every case still asserts and which no
regenerated JUnit report refuses. On the healthy tree, each regenerated report is byte for byte the one the
example commits. The sabotages chosen first were measured and changed: test bodies emptied are already
refused by the analyzers' test-integrity family, and a `Function` constructor in an adapter by their
capability family, so neither shows that a recipe is needed.

**The count (decision 3).** "The current release" is read as the runward version of the tree: a recipe is
counted when its manifest records a control that passed with that version and it is not withdrawn. The
README, `docs/recipes/junit-freshness-in-ci.md` and the package's README carry a block rendered from the
manifests; `count --check` refuses another block and any total of recipes written outside one (unit
tests, offline), and in CI, with the results of that run's controls, a text that counts a recipe whose
control did not pass. A version bump therefore reads every recipe "not counted" until its control passes
again and is recorded (`runward/runbook.md` §3).

**Decision 5.** The JUnit and LCOV recipes' commands are the legs of
`packages/runward-run/samples/request-triage.run-policy.json`, argument for argument, and the two
normalisers agree byte for byte on a run's container paths: tested, with runward-run's code unchanged. The
SARIF leg needs an image that carries the package; the sample policy runs the example's own lint script.

**Decision 6, option (A).** A CI job, `integrations`, runs the controls, then `count --check --results`,
then each recipe's GitHub step on a sabotaged and a healthy copy of the example. The offline GitLab CE bench
gains a job per recipe and tree, its template included from a second project at a pinned commit, and the
gate's exit read back three ways. The bench passed by hand on 2026-11-06, on a Linux machine with SELinux
enforcing (GitLab CE 19.4.2 and GitLab Runner 19.4.1, network cut, 15 jobs green, each recipe 0 without, 1
with, 0 on the healthy tree): the GitLab step is proven there, its include pinned by commit, its package
fetched by its sha256 and its report handed to the gate job as an artifact. The GitHub step is proven by
the `integrations` job's first run on GitHub, which no session of this delivery could start; its logic was
rehearsed locally, each composite action's script run with its inputs in the environment.

**What remains.** Jenkins, which has no bench here; the agent harnesses, measured per channel in ADR-0028's
format; the consumers of in-toto attestations, whose control is a tampered attestation refused; a release
asset for the package (ADR-0121 decision 5, the next release chain); the site's count, which reads
`count --json`; and the criterion "one adopter installs one recipe from its manifest alone", which no
delivery of this repository can meet: an independent agent session installing a recipe from its manifest
is a rehearsal, never that adopter. Found on the way, and fixed in the same delivery: `explain` printed
for `junit` a form that resolves nowhere (RWD-2026-0209).

## References

- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md),
  [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md),
  [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
  [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
  [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md);
  ADR-0115 (pull request #483); ADR-0119 and ADR-0120 (pull request #482).
- `docs/recipes/`, `test/unit/recipe-repository-rules.test.js`, `templates/adapters/`, `docs/gitlab-bench.md`,
  `src/lib/evidence.ts`.
- Datadog, Inc., annual report on Form 10-K for fiscal 2025 (SEC EDGAR, read on 2026-11-05);
  `DataDog/integrations-extras`, README (read on 2026-11-06).
