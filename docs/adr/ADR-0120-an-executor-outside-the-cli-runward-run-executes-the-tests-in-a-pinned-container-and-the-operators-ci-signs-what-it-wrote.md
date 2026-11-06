# ADR-0120 — An executor outside the CLI: `runward-run`, a sibling package, runs the tests, the coverage and the mutation of the cited lines and the evals in a pinned container with the network cut; the operator's CI signs what it wrote, in another job, from a workflow the agent cannot write

**Date**: 2026-11-05
**Status**: accepted (2026-11-05). Constitutional, class R under ADR-0088 decision 2: it amends ADR-0005
and the conditions of ADR-0039, notes ADR-0054 and changes the delivery order of ADR-0093
**Deciders**: the maintainer, by delegation in chat on 2026-11-05, in these words (translated from
French): « runward must perhaps cover more than what we imagined. Everything has evolved. » and « In what
I have to do there are items that you can do, and where you even make recommendations to me. After having
investigated. So I trust you: carry it out each time instead of asking me. » Accepted on the
recommendation of the agent sessions that investigated (scratchpad inv-S1, inv-S2); the maintainer did not
review this text before acceptance. This is a delegation, not a review. The words were relayed to the
session that wrote this record by the session that received them. Under ADR-0088 decision 4 the
maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review; as ADR-0088 decision 3 asks, the act is recorded by an agent session (agent), for
`github:stranxik` (accountable). The delegation does not amend `runward/delegation.md`, where class R stays
the maintainer's and `scope-D` covers non-constitutional ADRs only: this acceptance stands outside the
charter, and the record lands when the maintainer approves its pull request
**Method**: the investigation of 2026-11-05 (ADR-0117's method): the mutation mini-harness (13 mutants of
the declared core, the example's single test file, each mutant run once and the source restored), the
three variant trees built from the sealed example and judged by 0.46.0 after the real tools regenerated
their reports, and the measurement that a 93-byte ESLint JSON committed by hand satisfies `requires:`.
Read on a fresh clone of `stranxik/runward` at `main@61d5041`: ADR-0005, 0039 (amendment of 2026-08-24),
0049, 0054, 0055, 0073, 0088 (decisions 1 and 2), 0093 (decisions 1, 8, 10 and 12), 0094 (question 1 and
its note of 2026-10-23), 0098, 0110, `docs/spec/runward-signing.md`, `packages/runward-forge`,
`test/unit/runtime-boundary.test.js`, `test/unit/regulated-posture.test.js`, RWD-2026-0195
**Relates to**: [ADR-0117](ADR-0117-the-verdict-measures-what-the-accountable-people-declared-against-what-the-agent-delivered-decisions-code-and-execution-each-at-a-named-level.md)
(the third object), [ADR-0119](ADR-0119-three-levels-of-proof-and-one-required-level-each-row-says-whether-its-evidence-is-re-derived-attested-or-declared.md)
(the `attested` level and its two halves), ADR-0118 (the analyzers; in progress)
**Amends, by name**: [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md); the
conditions of [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) (amendment of
2026-08-24); [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(its deliveries and their order). A note on
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md). Each note lands with the code, one delivery
ahead of it, as ADR-0093 does; no accepted decision is rewritten

## Context

**The execution half has no producer the agent cannot reach.** ADR-0117's table: with reports
regenerated in CI before the gate, 0.46.0 refuses the seven sabotages of the investigation's laboratory in
14 runs of 14, and nothing in the product says who regenerated them. Committed by hand, a 93-byte ESLint
JSON satisfies `requires:`. When every assertion is replaced by `assert.ok(true)` and the real tools
regenerate the JUnit, ESLint and coverage reports, the 14 test cases stay green, the cited file stays
covered, and 0.46.0 exits 0 on the re-sealed tree. Only an execution refutes that one: on a sample of 13
mutants of the declared core, the original tests kill 11, the weakened ones 5, none of them through an
assertion, since none is left that could fail (the harness counted any non-zero exit as a kill).

**The CLI must not be that producer.** ADR-0005 keeps the gate from running anything, and ADR-0054 makes
the CLI's verdict path free of processes, sockets and keys. ADR-0073 did not choose its option 3, a report
cited by reference to an external run, which reaches outside the judged tree (crossing 4). ADR-0093
decided the CLI never signs and never verifies a signature, and that a customer-run satellite,
`runward-fleet`, verifies signatures against the operator's trust policy.

**A precedent in this repository.** `runward-forge` lives in `packages/runward-forge`, a second package of
the same repository and release chain, so that « the runward package contains no network code » stays a
property a reviewer checks in one grep (ADR-0094, enforced by `test/unit/runtime-boundary.test.js`).
runward's own release builds in a reusable workflow that alone holds `id-token: write` (ADR-0049); the
investigation of 2026-11-05 noted that its signing job also installs the dependencies and runs the tests.

**Where independence ends.** A signature by the operator's CI is independent of the agent, not of the
operator. On runward's own mission, ADR-0088 stage 1 says it plainly: the maintainer's credential is within
agent reach, so whatever an agent can make the maintainer's CI sign is declared, not proved.

## Decision

**1. `runward-run`, a sibling package.** It lives in `packages/runward-run`, released by the chain that
releases `runward` and `runward-forge` (ADR-0094's answer to its question 1): MIT, its own npm name, its own
tarball. The `runward` package imports nothing from it, ships none of its files and never spawns it.
`runward-run` imports nothing from runward's `src/` or `dist/`; it reads the files runward writes (the
witness of ADR-0089 for the cited locations, `check --json` for the rows) and the operator's run policy.
`test/unit/runtime-boundary.test.js` gains the pair of assertions it holds for `runward-forge`, in both
directions; unlike `runward-forge`, `runward-run` spawns processes, and the test asserts that it does, so
the boundary cannot pass vacuously.

**2. What it executes: legs, each opted into by the run policy.**

- **Tests**: the test command the run policy declares, and its JUnit XML report.
- **Declared reports**: the other reports a `requires:` nature names (lint, static analysis, dependency
  scan), each from the command the run policy declares for it.
- **Coverage of the cited lines**: for each applied row that cites a code location and a test, whether the
  cited tests execute the cited lines, in LCOV.
- **Mutation of the cited lines**: for each such row, mutants of the cited lines only, the cited tests run
  against each, and each mutant recorded as killed through a failed assertion, killed through an error, or
  surviving, where the runner tells a failure from an error (JUnit XML's `<failure>` and `<error>`, or the
  runner's own error class); where it cannot, the leg records the kills without the distinction and says
  so. The mutator is per language, behind a port; the first serves JavaScript and TypeScript, the shipped
  example's languages. A language with no mutator yields no mutation fact, named, never a guess. This is
  ADR-0117's note F: a fact per row, never a score.
- **Evals**: the eval command the run policy declares, with the network cut, so only evals that replay
  recorded outputs or run a pinned local model. An eval that needs a remote model is outside `runward-run`,
  and its result stays `declared`.

**3. Where it executes, and when it refuses.** In a container whose image is pinned by digest, with the
network cut. The sources are hashed from the checkout of the judged commit before any leg runs, and the
legs run on a copy of it, writing their outputs only to the output directory. Dependencies are installed
from the lockfile before the network is cut, with install scripts disabled where the package manager
allows it (an install script is code the agent chose, run while the network is open), and the lockfile's
digest is recorded. When it cannot cut the network or pin the image, `runward-run` exits non-zero and
writes nothing a gate could read as evidence: it fails closed. It holds no key, opens no socket of its
own, and keeps no state between runs.

**4. What it writes.** For each leg, its report, normalised as ADR-0073 option 1 does (no absolute path,
no timing), plus one unsigned in-toto Statement for the run:

- `predicateType` `https://runward.dev/run/v1`, versioned and expand-only, like ADR-0055's;
- the subjects: the SHA-256 of each report;
- the predicate: `runward-run`'s version, the image digest, the commands as run and their exit codes,
  `network: "none"`, the lockfile digest, the digest of the mission's manifests the citations came from,
  and the source digests of the expected set. That set is derived from the declared territory, the cited
  files and the cited tests, never chosen by the writer: ADR-0098 option F, reopened by ADR-0117 note E
  with its written weakness corrected.

The tests leg also emits the in-toto `test-result` predicate beside it, a neutral port in ADR-0011's
sense; the coverage and mutation facts, for which in-toto defines no predicate, stay in runward's.

**5. Who signs, and from where.** Never `runward-run`, never the CLI: the operator's CI.

- **Two jobs.** The executing job holds no `id-token` permission and no secret. The signing job runs no
  project code: it signs the Statement the executing job handed over, keyless through the forge's OIDC
  identity where the forge offers it (Sigstore, through `actions/attest` or `cosign attest-blob`), or with
  the operator's own key elsewhere, for instance on an offline instance.
- **A workflow the agent cannot write.** Both jobs come from a workflow pinned by commit, in a repository
  the agent cannot write: a reusable workflow on GitHub; on GitLab, a pipeline of a project the agent
  cannot write, run for the mission's commit, so that the signing identity is that project's and not the
  mission's.
- **The run policy lives with that workflow**, not in the judged tree: the image digest, the commands, the
  legs. The mission declares what to verify (its territory, its citations), never how `runward-run`
  executes.
- **The trust policy** pins the signer workflow, its commit and the repositories it may sign for; a
  landing is raised only on the protected ref, as ADR-0093 decision 8 says. ADR-0110 measured why the ref
  is not optional: a signer workflow given without its ref accepts that file at any ref.
- **Inert samples.** runward ships the reusable workflow and the GitLab pipeline as samples the operator
  copies into a repository of their own; runward installs nothing (ADR-0012).

**6. What the CLI reads, and what survives.** The reports, the Statement and its signature bundle, as files
at rest in the judged tree; the CLI never fetches them, so crossing 4 holds and ADR-0073's option 3 stays
unchosen. A verdict survives on the repository alone, as ADR-0052's thesis says, only for what the
repository carries: the samples runward ships commit the reports, the Statement and its bundle with the
tree they judge, under the signing identity. A workflow that only downloads them into the gate's workspace
gets a verdict for that run, which an auditor cannot re-derive later from the repository, and its
documentation says so. The CLI re-derives the binding of ADR-0119 decision 1: each cited report's
digest is a subject of the Statement; the source digests recorded match the tree; the expected set
recorded is not narrower than the one the CLI derives from the tree; the manifests digest recorded matches
the tree's. It counts the Statement's signatures without verifying them, and reads `attested`, with
`signatureVerified: false` and the sentence of ADR-0119 decision 5, or `declared` when none is present.

**7. ADR-0005, amended by name.** « Run the project's tests in the gate » and « Bundle a test runner »
stay discarded for the gate, and « runward did not run your code », printed by `check`, stays true of the
CLI (`test/smoke.js` pins it). A sibling package now runs the project's code in the operator's CI, outside
the gate, and the gate reads what it wrote. ADR-0005's three reasons, read again:

- the gate never runs anything: kept;
- language neutrality: `runward-run` runs the commands the operator declares, reads interchange formats
  (JUnit XML, LCOV, SARIF), and its mutation leg is per language behind a port, with a named absence;
- « it duplicates the project's CI »: it runs in the project's CI. What it adds is not a second run but a
  run whose outputs are bound to the tree and attested under an identity the agent does not hold.

**8. The conditions of ADR-0039, amended by name.**

- « It lives in its own repository » now admits a sibling package of the same repository and release chain,
  when the import boundary is tested in both directions and the `runward` tarball contains none of its
  code: the answer ADR-0094 gave for `runward-forge`. `runward-fleet` keeps its own repository (ADR-0093
  decision 10).
- « It never enters the MIT CLI »: kept.
- « It does not make runward operate a process »: `runward-run` is a command the operator's CI runs and
  that exits, holding nothing between runs. It executes the project's code only in the operator's CI, on
  the operator's runner.
- « The aggregation is the operator's »: it aggregates nothing.

**9. A note on ADR-0054.** Executing the project's code in a sibling package is none of the five
crossings, which bound the `runward` package and its verdict path. The boundary test holds the line: no
module of the `runward` package imports `runward-run`, spawns it or ships its files; the verdict reads its
outputs as files at rest (crossings 4 and 5 unchanged) and holds no key (crossing 3 unchanged).

**10. ADR-0093: `runward-run` joins the deliveries, and the verification of signatures moves ahead of D2
and D3.** Without a verifier, `attested` is established by nothing runward ships, and every later delivery
would display cells resting on a signature nobody checked. The order becomes:

| Delivery | Content | Estimate, agent-weeks (±30 %) | Acceptance |
|---|---|---|---|
| R1 | `runward-run`: the tests and declared-reports legs, the Statement, the binding read by the CLI at `attested`; the workflow and pipeline samples, GitHub and GitLab at parity | 3 | ADR-0117's row 3 and a hand-committed report refused at `attested`; a run that could not cut the network writes nothing; the offline GitLab CE bench passes |
| D4a | the verification half of D4: `runward-fleet` static, the trust policy, signature verification offline, the cosign and `actions/attest` recipes | 3 | a Statement signed from the mission's own workflow, by an unpinned signer, or by the right workflow at another commit is refused; the pinned one is accepted |
| R2 | the coverage and mutation legs (JavaScript and TypeScript first) | 3 | ADR-0117's row 8 refused at `attested`, the original tests accepted |
| R3 | the evals leg | 1.5 | an eval that needs a remote model reads `declared`, named |
| D2, D3, D4b, D5, D6 | as ADR-0093 wrote them; D4b is the display half of D4 (cells raised to `machine-established` on the landing records D2 writes) | unchanged | unchanged |

The estimates are ADR-0093's kind, not measurements. Releases stay the maintainer's (class I in stage 1),
and the first publication of `runward-run` meets the npm bootstrap `runward-forge` still waits on
(RWD-2026-0195); until then it ships as a verified release asset, as `runward-forge` does.

**11. Execution under runward's own identity belongs to the hosted product (ADR-0093 D6), apart from the
CLI.** Some adopters will want execution evidence that neither the agent nor the operator could have
produced, for instance a buyer who wants the runs outside every system that holds the agent. That is a
buyer's preference, not the texts' demand: Delegated Regulation (EU) 2024/1774 art. 17(1)(b) asks for
approving functions independent, within the entity, of those that request and implement, which the
operator's own identities, read from the forge, can show. Meeting that preference takes a third identity,
runward's own as a vendor, and it is exactly what the CLI and its satellites may never be:

- a key the operator does not hold, a long-lived service and an endpoint (ADR-0054 crossings 1 to 3);
- a vendor-operated product with vendor-managed keys, which ADR-0093 decision 10 says is not a satellite;
- a supply to regulated customers, with contracts, service levels and audit rights (Regulation (EU)
  2022/2554 art. 28 and 30), and the obligations of a manufacturer once a price exists (Regulation (EU)
  2024/2847), which need an entity that does not exist yet (ADR-0052 part 3, branch A).

So the hosted executor is D6's, in its own repository, record and licence. It consumes `runward-run`'s
contracts unchanged, the same Statement signed under the vendor's identity instead of the operator's, so a
customer moves between the two without changing what the CLI reads. Nothing in the CLI or in `runward-run`
depends on it, and the CLI knows neither its URL nor its existence.

## Alternatives discarded

- **Run the tests in the CLI** (`check --run`). ADR-0005 and ADR-0054: the gate would hold a runtime, a
  process tree and the project's code in its verdict path.
- **Let the agent's own CI job write and sign the reports.** The job that executes the agent's code would
  hold the identity that signs; one compromised test would sign its own result. The two-job split exists
  for that reason.
- **Read the reports from the forge's artifact store at verdict time.** Crossing 4, and ADR-0073's
  option 3; the gate reads files at rest.
- **The run policy in the mission tree.** The agent writes the tree: it would choose the commands that
  produce its own evidence.
- **Sign under a key runward holds.** ADR-0055 and `docs/spec/runward-signing.md`: the judge would sign its
  own verdict. That identity is the hosted product's, under its own record (decision 11).
- **Mutation over the whole code base.** A score, hours of runtime, and not what a row claims; only the
  cited lines bear on a row (ADR-0117 note F).
- **A separate repository for `runward-run`.** A second release chain for one maintainer, while ADR-0094's
  sibling package already gives the property a reviewer checks.

## Consequences

- **Positive.** The execution half of a verdict gets a producer the agent cannot reach and a binding the
  gate re-derives. Rows 8 and 9 of ADR-0117's table become refusable by a pipeline that checks both halves
  of `attested` (ADR-0119 decision 5), and the hand-committed report reads for what it is, `declared`.
- **Negative, accepted.**
  - A second package that runs code, with its own threat model: a container runtime, images to pin,
    mutators per language.
  - A CI layout the operator must adopt: two jobs, a workflow in a repository the agent cannot write, a
    trust policy.
  - Wall-clock cost of the mutation leg, bounded by the cited lines.
  - One more contract to keep expand-only (`runward.dev/run/v1`).
  - An npm bootstrap still blocked for `runward-forge`.
  - On runward's own mission, `attested` stays declared until ADR-0088 stage 2: the maintainer's credential
    is within agent reach.
- **On other boundaries.** The five crossings are unchanged for the `runward` package; ADR-0093's D2 and D3
  move one slot later; `runward-fleet` gains its first verification work before its display work.
- **Nothing ships with this record.** R1, D4a, R2 and R3 are pull requests of their own, the first two
  touching the verdict's binding reader on the charter's pre-merge paths.

### What this does not catch

- **The agent's code runs inside the container.** A test written to recognise a mutation, or to print
  results it did not compute, is executed as written; ADR-0118's test-integrity family is where such tests
  are named.
- **A weak assertion** that kills one mutant and misses the rest: the survivors are listed, never summed.
- **A run policy the operator wrote too loosely**, a compromised CI provider or runner, or an agent that
  holds the operator's CI administration credentials.
- **Anything the trust policy should not have trusted.** The policy is the operator's.

## What would settle it

**For**, each measured on a laboratory repository with the shipped example's run policy:

- **R1.** The forged one-case JUnit report and a hand-committed report are refused at `attested` for want
  of a binding, and the healthy example passes. An unsigned Statement the agent wrote, consistent with the
  tree, reads `declared` and exits 5 at `attested`. A cited source edited after the run breaks the binding
  and exits 5. A run that cannot cut the network writes nothing the gate reads as evidence (a test). The
  executing job, without `id-token`, produces no signature the trust policy accepts.
- **D4a.** The verifier refuses a Statement signed from the mission's own caller workflow, by an unpinned
  signer workflow, or by the pinned workflow at another commit, and accepts the pinned one. A Statement the
  agent signs with a key of its own is refused.
- **R2.** The weakened-assertion sabotage (every assertion replaced by `assert.ok(true)`) is refused at
  `attested` on the rows citing the weakened file, the original tests are accepted, and the wall-clock time
  of the mutation leg on the shipped example is published.
- **Boundary.** `test/unit/runtime-boundary.test.js` and `test/unit/packaging.test.js` redden on a planted
  import of `runward-run` into the `runward` package or into its tarball.

**Against**: the mutation leg takes more than 30 minutes of wall clock on the shipped example, or on any of
the real repositories of ADR-0117's criterion 2 (it then runs on a schedule, and the level says so); the
GitHub-hosted or GitLab shared Linux runners cannot pin an image or cut the network (the leg is refused
there and the gap is named); one assessor who does not accept the operator's CI identity as out of the
agent's reach (then decision 11's case is made, and the hosted product's record says so).

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-05, or earlier when: the first adopter runs `runward-run` in CI; the npm bootstrap is
still blocked at `runward-run`'s first release; a forge changes the identity claims its OIDC tokens carry;
in-toto publishes a predicate for coverage or mutation results; ADR-0088 stage 2 holds for runward's own
mission.

**Trigger set on**: 2026-11-05 · **Watched via**: `test/unit/runtime-boundary.test.js`, the laboratory
repository's runs, the offline GitLab CE bench, and the release runs of `runward-run`.

## Notes

- **2026-11-06, R1 and D4a implemented, and what was measured.** Written by the agent session that built
  them, in pull request form; the maintainer has not reviewed it.
  - **What landed, by decision.** Decision 1: `packages/runward-run` (MIT, no dependency, versioned with
    runward, `private` until the npm bootstrap so that `npm publish` refuses it), importing nothing of
    runward. Decision 2: the tests and declared-reports legs; the coverage, mutation and evals legs are
    refused by name (R2, R3). Decision 3: the image must be pinned by digest and named by the runtime by
    that digest; dependencies install from the lockfile on a copy of the tree, the network open and
    install scripts disabled; a probe container started with `--network none` must see the loopback
    only; anything else is exit 3 with the output directory never created. Decision 4: the run Statement
    `https://runward.dev/run/v1` and the in-toto `test-result` Statement beside it, byte for byte the
    same across two runs of one tree. Decision 5: inert samples for GitHub (a reusable workflow: `execute`
    with `contents: read` only, `sign` with the identity and no checkout, `gate`, an opt-in `commit`) and
    GitLab (the pipeline of a runner project: `execute` with no `id_tokens`, `sign` keyless or with the
    project's own key, `gate`), both writing the shipped example's run policy
    (`packages/runward-run/samples/request-triage.run-policy.json`). Decision 6: `check --strict --require
    attested` reads, in the directory of each cited report, a run Statement bare, in a DSSE envelope or in
    a Sigstore bundle; re-derives its binding (the subject digest, `network: "none"`, the manifests, a
    recorded source set not narrower than the tree's expected set, every recorded digest); counts its
    non-empty signatures; reads `attested` with `signatureVerified: false` and ADR-0119's sentence, else
    `declared`, naming why. D4a: `runward-fleet verify-run` verifies the signature offline against the
    trust policy, reusing the fleet's Sigstore verifier and policy reader, and refuses each case of this
    record's acceptance by name; the policy gains the signer kind `key` for instances with no keyless
    signing. The verifier lives in runward-fleet, so the CLI keeps reading files only. The specification
    is `docs/spec/runward-run.md`.
  - **Choices this record left open, made here.** The expected set is the files the analyzers read under
    the pinned policy (source and configuration files), the cited files and the cited tests, less the
    execution reports and the in-toto documents; runward publishes it (`levels.execution.expected`) and
    runward-run records it, so the writer never chooses it. runward looks for a run Statement only beside
    the report it binds, so one run writes all its reports to one directory. The `levels` block of
    `check --json` is present only when the run requires `re-derived` or `attested`, so every other
    payload keeps its bytes. `verify-run` refuses a signer workflow of the mission's own repository even
    under a policy that pins it. On GitHub the mission's commit is the certificate's; for a pipeline run
    in the signer's own project (the GitLab runner project) or a key, it is the signed Statement's
    `mission` claim, which that signer vouches for.
  - **Two limits found.** A reusable workflow cannot read its own commit from its context
    (`github.job_workflow_sha` is reported empty inside it, actions/runner issue 2417), so a trust policy
    cannot live in the workflow file it pins: the samples read it from a repository of the operator's,
    and the operator adds each new commit of the signer workflow to `workflowDigests`. And a host whose
    container runtime enforces SELinux makes a bind mount unreadable until it is labelled: runward-run
    labels its own mounts (`:z`), measured below.
  - **Measured.** On a laboratory copy of the shipped example (`test/support/run-lab.js`: its lockfile, its
    one prose row typed) with a fake container runtime (`test/unit/run-binding.test.js`, Node.js 24.22.1,
    macOS): the healthy example exits 0 at `attested` once its Statement carries one signature, 16 applied
    rows attested, 8 re-derived (they cite no report), 0 declared; unsigned it exits 5; a hand-committed
    ESLint report and a hand-written JUnit report carrying every cited case exit 0 at `mechanical` and 5 at
    `attested`; a source or a manifest edited after the run, a recorded set narrower by one file, a run
    recording the network open, each unbind (exit 5); a runtime that refuses `--network none`, or accepts it
    and leaves an interface up, writes nothing (exit 3). The identity half
    (`test/unit/run-signature.test.js`, the tests' own Sigstore): the pinned reusable workflow at its pinned
    commit is accepted; the mission's own caller workflow, a signer the policy does not name or names
    without a commit, the pinned workflow at another commit, another commit of the mission, a key the policy
    does not pin, a certificate from an authority of the signer's own: each refused by name. The boundary:
    an import of runward-run planted in `dist/lib/evidence-levels.js` reddens the ADR-0120 assertions of
    `runtime-boundary.test.js` and `packaging.test.js`; `packages/runward-run/src` planted in the tarball's
    `files` reddens both and ADR-0094's; restored, 28 of 28 pass. ADR-0117's row 3 replayed on its
    laboratory tree: exit 1 at `mechanical` and at `attested`, 51 gaps, 17 rows below `attested`. On a real
    container runtime, the maintainer's NAS (Fedora, SELinux enforcing, Docker 29.0.4), with the example's
    run policy: the install of 94 packages from the lockfile, scripts disabled, the probe seeing the
    loopback only, the three legs exiting 0, 12 s in all; the four normalised reports byte for byte the ones
    the example commits; unsigned, exit 5 with the Statement bound; one signature counted, exit 0;
    `verify-run` refuses that signature (exit 1). Its first attempt found the two defects fixed in this pull
    request: the unlabelled mounts, and the report directory Node.js's test reporter does not create, where
    the run was refused, exit 3, nothing written. On a loaded MacBook, `check --strict --json` on the
    laboratory takes 0.4 to 0.7 s at `attested` and about 0.5 s at `mechanical`; the `levels` block is 16
    KB. The full suite on the NAS (Node.js 24, Linux), on the code of this pull request: exit 0 in 841 s,
    2040 unit tests, 2029 passing, 0 failing, 11 skipped (each bound to an operating system), then the smoke
    test, the schemas, spelling, the SARIF shape and the attack corpus, 18 of 18. The committed JUnit
    report, regenerated twice on macOS with the Node.js of `.nvmrc`, is byte for byte the same both times:
    2040 cases, 0 failures, 2 skipped.
  - **Not delivered, or not exercised.** R1's « the offline GitLab CE bench passes »: no bench instance
    was available to this session (the bench runs as `gitlab-bench.yml` on GitHub), so the GitLab sample
    is held at parity by `test/unit/run-samples.test.js` and has not run on a GitLab. The GitHub samples
    and the `runward-run-e2e` job of `ci.yml` have not run on GitHub: nothing of this was pushed. The
    healthy example passes on the laboratory copy; the shipped example, as `init --example` writes it,
    keeps the prose row and ships no lockfile. runward-run is not packed by the release chain yet
    (`build-and-attest.yml`, `release.yml`), so no release carries it. The required level read from the
    lock (ADR-0119 decision 4). D4b, R2, R3.

## References

- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md),
  [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md),
  [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md),
  [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md),
  [ADR-0049](ADR-0049-the-build-is-isolated-from-the-publish.md),
  [ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md),
  [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
  [ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md),
  [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md),
  [ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
  [ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
  [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md),
  [ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md),
  [ADR-0098](ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md),
  [ADR-0110](ADR-0110-the-app-may-change-and-dispatch-workflows-so-no-agent-acts-under-the-maintainers-identity-dispatch-is-a-closed-list-and-every-workflow-change-still-waits.md).
- `docs/spec/runward-signing.md`, `packages/runward-forge`, `test/unit/runtime-boundary.test.js`,
  `test/unit/regulated-posture.test.js`, `test/smoke.js`.
- RWD-2026-0195 in [known-defects.md](../compliance/known-defects.md).
- The in-toto attestation framework (the Statement, the `test-result` predicate), Sigstore keyless
  signing, GitHub reusable workflows and artifact attestations, GitLab `id_tokens`.
