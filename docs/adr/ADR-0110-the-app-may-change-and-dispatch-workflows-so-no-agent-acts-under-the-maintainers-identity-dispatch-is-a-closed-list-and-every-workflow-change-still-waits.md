# ADR-0110 — The App may change and dispatch workflows, so no agent acts under the maintainer's identity: dispatch is a closed list, and every workflow change still waits for the maintainer

**Date**: 2026-11-04
**Status**: accepted (2026-11-04: the maintainer decided the recommended answer, option A, with its three preconditions in the order written; the charter diff below lands only in the maintainer's own signed charter commit, a class R act) — constitutional, class R under ADR-0088 decision 2: it would amend ADR-0088 decision 3
("never `administration`, `workflows` or `variables`") and widen the charter's `scope-D`. Written by an agent;
under ADR-0088 decision 4 the maintainer decides, and the agent's writing is disclosed throughput, not
independent review
**Deciders**: the maintainer
**Method**: read on a fresh clone of `stranxik/runward` at `main@b7d8c62`: `runward/delegation.md`,
`runward/runbook.md` (the App's installation entry and the stop), every file of `.github/workflows/`
(triggers, `permissions:` blocks, `secrets.` references, `environment:` keys), `docs/verifying-a-release.md`
(the flags of every `gh attestation verify`), `src/lib/delegation.ts` (the charter reader's closed key set),
ADR-0082, ADR-0088, ADR-0090, ADR-0103. Not measured: GitHub's behaviour for any permission named here on
runward's own repository; the npm trusted-publisher configuration (it is read on npmjs.com, not in the tree)
**Relates to**: [ADR-0082](ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md),
[ADR-0085](ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md),
[ADR-0103](ADR-0103-the-register-records-the-source-each-module-was-measured-on-and-a-stale-one-refuses-the-release.md),
ADR-0111 (proposed, the companion record on verdict-path merges)
**Would amend, by name, once accepted**: ADR-0088 decision 3, for `workflows` and `actions: write` only
(`administration` and `variables` stay refused); the runbook's App entry, which repeats it

## Context

**What the charter and the doctrine say.** ADR-0082: an agent acts "as itself", "never under a human's
name". ADR-0088 decision 3: delegated acts run under `runward-steward`, "never `administration`, `workflows`
or `variables`". The runbook installs the App with `metadata: read`, `contents: write`,
`pull_requests: write`, `repository_advisories: write`, `actions: read`, `checks: read`, `statuses: read`.

**What that leaves undone, and how it has been done.** Two kinds of act recur in runward's delivery and the
App cannot make either:

- *A change to a file under `.github/workflows/`.* GitHub refuses a push that creates or modifies a workflow
  file from a token without the `workflows` permission. ADR-0103's Consequences records it: "Agent sessions
  cannot push workflow files; the change sits in its own commit", pushed by the maintainer.
- *A dispatch or a re-run.* `gh workflow run` and a re-run need `actions: write`. ADR-0103 decision 2 makes
  `gh workflow run mutation-ratchet.yml -f module=<m> -f mode=measure` the remedy every stale module names,
  and the documented-commands guard, the release verification and the artifact round trip are dispatched on
  demand.

When the maintainer is not available for each of these, the only credential that can make them is the
maintainer's own. An agent that uses it acts under a human's identity: the outcome ADR-0082 exists to
prevent, and the attribution defect ADR-0088's Context measured for merges. Stage 1 already says the
maintainer's credential is within agent reach; that is a disclosure of a risk, not a licence to use it.

**What the workflows can reach, read on `main@b7d8c62`.**

- No workflow references a repository secret (`secrets.` appears in none of the 13 files), and the runbook
  records that the repository keeps no Actions secret. What a workflow can obtain beyond its `GITHUB_TOKEN`
  is an OIDC token, in the jobs that declare `id-token: write`: `release.yml` (npm trusted publishing and
  provenance), `build-and-attest.yml` (Sigstore), `mutation-ratchet.yml`'s `summary` job (Sigstore),
  `scorecard.yml`.
- No workflow declares an `environment:`. The npm publish in `release.yml` is gated by
  `if: github.event_name == 'release'`, a condition written in the workflow file itself.
- `ci.yml`, which carries the required `test` checks, runs on `pull_request`, so a pull request is judged by
  the workflow file at its own head. `delegation-stop.yml` and `net-shrink.yml` run on `pull_request_target`,
  from the default branch's copy, so a pull request that edits them is not judged by its edit.
- The verification guide pins `--signer-workflow` on its `gh attestation verify` commands and carries no
  `--source-ref`.
- The charter reader refuses any field it does not know (`src/lib/delegation.ts`, "a field the gate does not
  read is a promise nobody checks"), so a new charter key needs a CLI change; existing keys do not.

**What the two permissions add, beyond today's `contents: write`.** Today the App can already push a branch,
and every workflow triggered by that push runs, but only as the workflow files already are. With `workflows`
the App can write the file that runs. On a branch, a workflow file written by the App can declare any
`permissions:` the repository allows, including `id-token: write`, drop any `if:` condition, and be
dispatched on that branch's ref. With `actions: write` it can also dispatch any workflow that has
`workflow_dispatch`, with any inputs, re-run any run, cancel runs, delete runs, logs and artifacts, and
enable or disable a workflow. GitHub offers no per-workflow scoping of either permission.

So the risk the maintainer named is real in its general form and narrower in runward's: there is no secret to
exfiltrate, but there are two credentials a branch workflow could mint. The first is the npm publish
credential, if npm's trusted publisher for `runward` and `runward-forge` is bound to the repository and the
workflow file name only, without an environment the branch cannot enter. The second is a Sigstore identity
naming a runward workflow, on a branch ref the verification guide does not pin. The third risk is
self-judgement: a pull request that edits `ci.yml` is judged by its own edit.

## Options considered

- **A. Grant both permissions, with preconditions that close the minting paths, a closed dispatch list
  enforced where the tree can enforce it and detected where it cannot, and `.github/**` kept a pre-merge
  path.** No agent needs the maintainer's credential for these acts; the maintainer keeps the merge of every
  workflow change.
- **B. Keep the permissions refused, and queue every workflow change and dispatch for the maintainer.** No new
  risk; the acts wait, or are made under the maintainer's credential when they cannot wait, which is the
  defect this record exists for.
- **C. A second App holding only `actions: write`, for dispatch, and the maintainer keeps workflow-file
  pushes.** Smaller blast radius for dispatch alone; two keys under the same custody in stage 1, and the
  workflow-file half of the defect stays open.
- **D. Dispatch through a relay workflow on the default branch** (`workflow_dispatch` or `repository_dispatch`
  received by a workflow that checks its own allowlist and calls the target with its `GITHUB_TOKEN`). The
  allowlist would then run from `main` only. But a `GITHUB_TOKEN` "will not create a new workflow run"
  (ADR-0088 Context), so the relay cannot start the target; and starting the relay already needs
  `actions: write` or `contents: write` with a `repository_dispatch` scope the App would hold anyway.

## Decision

**Decided (2026-11-04).** The maintainer accepted the recommendation below: option A, with its three preconditions in the order written. Nothing in the charter changes until the maintainer's signed charter commit; until then the record states a decision, not a mechanism in force.

**Recommended: A**, in this order. Nothing is granted before items 1 to 4 hold.

1. **The publish credential leaves the reach of a branch workflow (precondition, class R).** An environment
   `release` whose deployment rule admits only tags `v*`; npm's trusted publishers for `runward` and
   `runward-forge` bound to that environment; the `publish` job of `release.yml` declaring
   `environment: release` (a workflow change, through a pull request the maintainer merges). Then a run on a
   branch ref, whatever its workflow file says, cannot enter the environment, and npm refuses its OIDC
   exchange. The `v*` tag ruleset that refuses the App (ADR-0088 T5, measured on the lab repository) is read
   back on runward before the grant: a tag the App could create would be a ref the environment admits.
2. **The release attestations name their ref (precondition).** Every `gh attestation verify` of the guide and
   of `verify-release.yml` that checks a release artifact gains `--source-ref refs/tags/vX.Y.Z`, held in
   lockstep by the documented-commands guard, so an attestation minted on a branch under a runward workflow's
   name fails the documented verification. Whether `--signer-workflow` alone already refuses it is measured
   first (What would settle it); if it does, the pin stays as a stated defence, not a fix.
3. **The closed dispatch list lives in the tree and is enforced on `main`'s copy.**
   - `.github/dispatch-allowlist.json` (under `.github/**`, so a pre-merge path) names the workflows a
     delegate may dispatch or re-run, and the inputs it may pass. Proposed content, each verified to publish
     nothing and to write to nothing outside its run:
     - `mutation-ratchet.yml` with `module` non-empty and `mode: measure` only (with `module` empty the
       `summary` job runs and signs a ratchet summary, which is a release's act, ADR-0079);
     - `documented-commands.yml` (`contents: read`; runs the guide against a published release);
     - `verify-release.yml` (`contents: read`; read-only verification of a published release);
     - `verify-artifact-roundtrip.yml` (`permissions: {}`; "packs nothing, attests nothing, publishes
       nothing").
     Never on the list: `release.yml`, `build-and-attest.yml`, `scorecard.yml` (publishes results under
     `id-token: write`), `watch-external-facts.yml` (`issues: write`), `codeql.yml`, `gitlab-bench.yml` (an
     external account; its own record if wanted).
   - Each workflow on the list that takes inputs refuses, in its first job, a run whose
     `github.triggering_actor` is a delegate and whose inputs are outside the list (for the ratchet: an empty
     `module`, or `mode: gate`). Each workflow with `workflow_dispatch` that is not on the list refuses, in its
     first job, any run whose `github.triggering_actor` is a delegate.
   - A guard test, `test/unit/dispatch-allowlist.test.js`, in the required suite: every listed file exists and
     has `workflow_dispatch`; no listed workflow has a job with `id-token`, `attestations`, `contents`,
     `packages`, `issues` or `pull-requests` at `write` that the allowed inputs can reach; every workflow with
     `workflow_dispatch` is either listed or carries the delegate refusal; the refusals name the delegates of
     `runward/delegation.md`. Positive controls: a listed workflow given `id-token: write` fails it; an
     unlisted dispatchable workflow without the refusal fails it.
   - **What this enforces, said as it is.** The refusals and the test hold `main`'s copy. A dispatch on a
     branch ref runs that branch's copy, which the App can write: there, nothing in the tree enforces the
     list. Items 1 and 2 are what keep such a run from reaching npm or a verifiable release identity.
4. **Dispatches are detected after the fact.** A weekly workflow, `dispatch-audit.yml`
   (`actions: read`, `contents: read`), lists the runs of the period whose `triggering_actor` is a delegate
   and whose event is `workflow_dispatch`, or whose `run_attempt` is above 1, and compares each with the list,
   its inputs and its ref (`main` only). Any run outside them is the pre-merge event « a workflow dispatched
   or re-run by a delegate outside the closed list », printed in the weekly digest. Declared: it reads the
   forge's run list, and a deleted run is not in it.
5. **Workflow-file changes by the App land only through pull requests, and every one waits.** The App never
   pushes to `main` (the branch protection already requires pull requests); `.github/**` stays in
   `pre-merge-paths`, and this record makes it permanent rather than a stage-1 measure: because `ci.yml` runs
   from the pull request's head, a workflow change is the one change that writes its own required checks, and
   no machine lane (ADR-0111) may ever merge it.
6. **A re-run of a red required check stays a pre-merge event.** The App may re-run a required check of a
   listed workflow, or any check of its own pull request; a check red then green on re-run makes that pull
   request wait for the maintainer whatever paths it touches, as the charter already says. The App never
   deletes a run, a log or an artifact, and never disables or enables a workflow: none is in `scope-D`, and
   item 4 lists what it can see of them.
7. **Workflow permissions stay minimal.** Every workflow keeps a top-level `permissions:` of
   `contents: read` or `{}`, and a job raises a scope only for the step that needs it, as `release.yml` and
   `mutation-ratchet.yml` already do; the guard test of item 3 reads the listed workflows, and
   `test/unit/workflow-contract*.test.js` stays the place for the others.
8. **The grant, and its revocation, are the maintainer's (class R).** From the App's settings, add
   *Workflows: read and write* and *Actions: read and write*, then accept the new permissions on runward's
   installation. `administration` and `variables` stay refused: the stop reads a repository variable the App
   must not set (runbook, "The stop"). Revocation is removing the two permissions, or uninstalling the App.

**The charter diff proposed** (class R, the maintainer's own signed commit, ADR-0088 decision 5: a widening
of `scope-D` cannot ride a renewal). It uses only keys the reader already knows:

```diff
 scope-D:
   - merges outside the pre-merge list
   - agent ratification of manifest rows
   - non-constitutional ADRs
   - Dependabot merges (with cooldown)
   - defect-register entries
   - documentation syncs
   - advisory drafts by the App (never by the GITHUB_TOKEN)
   - golden regeneration
+  - workflow-file changes by the App, through a pull request only, merged by the maintainer (ADR-0110)
+  - workflow dispatch and re-run by the App, only the workflows and inputs of .github/dispatch-allowlist.json on the default branch (ADR-0110)
 ...
 pre-merge-events:
   - lock opt-ins (regulated, agentRatification, identities, singleAccountable, structureContract)
   - README claims
   - disagreement between agents
   - a check red then green on re-run
   - a ratchet drop
   - any gate-bypass.log line
   - the net shrank
+  - a workflow dispatched or re-run by a delegate outside the closed list
```

And in the charter's prose, under **Classes**, after the D sentence:

```diff
+The App holds `workflows` and `actions: write` (ADR-0110): it may open pull requests that change workflow
+files, which wait for the maintainer as every `.github/**` change does, and it may dispatch or re-run only
+the workflows of `.github/dispatch-allowlist.json`. It never holds `administration` or `variables`.
```

The runbook's App entry changes the same way, in the same commit.

## Alternatives discarded

- **B, the status quo.** It keeps the permissions refused on paper while the acts are made under the
  maintainer's credential when they cannot wait: the false attribution ADR-0082 forbids, with no record of it.
- **C, a dispatch-only second App.** It halves the defect and doubles the keys under one custody in stage 1;
  worth reopening only if stage 2 separates custodies.
- **D, a relay workflow.** A `GITHUB_TOKEN` cannot start another workflow, so the relay cannot do the one
  thing it is for.
- **Grant without items 1 and 2.** A branch workflow written by the App could then mint the npm publish
  credential, if the trusted publisher is not bound to an environment, and a Sigstore identity the guide does
  not tell from a release's. Whether either is possible today is not measured; the grant waits for the answer.
- **Let a workflow change merge on green checks.** The required `test` checks of that pull request run the
  workflow file the pull request wrote.

## Consequences

- **The attribution defect closes for these acts.** Every workflow change, dispatch and re-run is the App's
  on the forge, with the run's `triggering_actor` naming it; the maintainer's credential is no longer the only
  one that can make them. In stage 1 it is still within agent reach, and the banner says so: this changes
  who acts, not what an agent could do.
- **The App's blast radius grows, and the record names how far.** On a branch it can run any workflow it
  writes. What stops that run reaching npm is the environment (item 1); what stops it passing for a release's
  attestation is the ref pin (item 2); what judges a workflow change is the maintainer before merge (item 5).
  What nothing stops: a branch run spending Actions minutes, reading the repository variable, and deleting
  runs, logs or artifacts, including the run artifacts ADR-0103 cites for 30 days. Deletion is outside
  `scope-D`, and outside what the tree can detect.
- **The maintainer's load moves, it does not vanish.** Workflow changes still wait for the maintainer, now as
  pull requests opened by the App instead of commits made under the maintainer's credential. Dispatches and
  allowed re-runs stop waiting.
- **Work it needs**: the environment and the npm binding (class R, on GitHub and npmjs.com); the
  `environment:` line, the delegate refusals, `dispatch-allowlist.json`, the guard test and the audit
  workflow (pull requests, `.github/**`, merged by the maintainer); `--source-ref` in the guide and
  `verify-release.yml`.
- **No CLI change and no verdict change.** The charter keeps its key set; the gate reads `scope-D` and
  `pre-merge-events` as strings, as today.

## What would settle it

- **For A**: on the lab repository, an App-written workflow on a branch, dispatched by the App, is refused
  the npm OIDC exchange for a throwaway package whose trusted publisher is bound to an environment limited to
  `v*` tags, and admitted from a `v*` tag; the same branch run's attestation fails
  `gh attestation verify --signer-workflow <wf> --source-ref refs/tags/<tag>`, and whether it passes
  `--signer-workflow` alone is recorded. Then on runward: the `v*` tag ruleset read back refusing the App; the
  guard test's positive controls failing as described; four weeks of `dispatch-audit.yml` with every delegate
  run inside the list.
- **Against A**: a delegate run outside the list that `dispatch-audit.yml` did not report; any path by which a
  branch run reached npm or produced an attestation the documented verification accepts; a workflow change
  merged without the maintainer.

## Reevaluation trigger (mandatory, dated)

Reopen at the charter's renewal on 2026-12-31, or earlier on: a delegate run outside the closed list; a
deleted run, log or artifact found missing that a record cites; GitHub offering per-workflow scoping of
`actions: write` or of `workflows`; npm changing what its trusted publishing binds; ADR-0088 stage 2 holding
(the App key leaves agent reach, and item 1's assumptions change).

**Trigger set on**: 2026-11-04 · **Watched via**: `dispatch-audit.yml`'s weekly output in the digest, the
GitHub and npm changelogs at each release's runbook step.

## References

- `runward/delegation.md` (`scope-D`, `pre-merge-paths`, `pre-merge-events`); `runward/runbook.md` (the App's
  installation entry, the stop); `src/lib/delegation.ts` (the closed key set).
- `.github/workflows/*.yml` at `main@b7d8c62`: `release.yml` (`id-token: write` in the publish job, no
  `environment:`), `mutation-ratchet.yml` (the `summary` job and its condition), `ci.yml` (`pull_request`),
  `delegation-stop.yml` and `net-shrink.yml` (`pull_request_target`).
- `docs/verifying-a-release.md` (`--signer-workflow`, no `--source-ref`).
- ADR-0082; ADR-0088 decisions 2, 3, 5 and Context (T2, T5; the `GITHUB_TOKEN` starts no workflow);
  ADR-0090; ADR-0079; ADR-0103 decision 2 and Consequences.
- GitHub App permissions: https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
  (not re-read for this record); npm trusted publishing: https://docs.npmjs.com/trusted-publishers
  (environment binding not verified, as ADR-0088 already records).
