# ADR-0094: The forge adapter boundary: one port, GitHub and GitLab at parity, the verdict forge-neutral

**Date**: 2026-10-13
**Status**: proposed — class R proposed under ADR-0088 decision 2: the record touches files on the
charter's pre-merge paths (`.github/**` for the Action, `src/lib/harness.ts` for the CI channel `init`
proposes) and extends the boundary test of ADR-0054. The maintainer decides the class and the two
questions in "What would settle it". An agent wrote this record and decides nothing (ADR-0088
decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: a fresh clone of `stranxik/runward` at `main@958d068` (runward 0.43.1), read on
2026-10-13: `action.yml`, `verify/action.yml`, `templates/adapters/gitlab-ci.yml`,
`templates/adapters/README.md`, `src/lib/harness.ts` (`UNIVERSAL_CHANNELS`), `src/lib/characterize.ts`,
`src/lib/identity.ts`, `src/commands/check.ts`, `eslint.security.config.js` (`SPAWN_ALLOWED`),
`test/unit/runtime-boundary.test.js`, `package.json` (`files`, `exports`), ADR-0054, 0064, 0080, 0088,
0093. A GitLab gap analysis written for the maintainer on 2026-10-13, outside this repository, in
French, which read the GitLab, Atlassian and Microsoft documentation that day; the tier statements
below are that reading, not a measurement on an instance
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md) (the umbrella, decision 2),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0088](ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
[ADR-0095](ADR-0095-check-json-carries-ratification-row-by-row-causes-by-kind-and-the-assurance-mode-in-force.md),
[ADR-0096](ADR-0096-code-quality-and-junit-renderings-of-the-verdict-and-why-runward-gaps-are-not-filed-as-vulnerabilities.md)
**Would amend, by name, once accepted**: none now. ADR-0080's Consequences ("Part 2 is forge-specific:
GitHub first, GitLab when a user asks") is amended by the forge-neutral independence-rule record, which
lands during D4 (ADR-0093 decision 12); this record only fixes the boundary that record will use.

## Context

**The verdict is already forge-neutral, measured.** No module of the verdict path calls a forge, opens
a socket or reads a forge variable. `check.ts` names a forge once, in a sentence ("forge approval (the
pull-request review on GitHub or GitLab): not verified by this command"). Canonical identities are
opaque strings (`github:<id>` and `gitlab:<id>` read the same). `characterize` already detects
`.gitlab-ci.yml`, `azure-pipelines.yml`, CircleCI, Jenkins and Drone. No module under `src/` imports
an HTTP client or calls `fetch`.

**What is GitHub is the envelope, and much of it by habit, not need.**

| Element | Where | GitHub because |
|---|---|---|
| the gate as an Action, with a warning when the version is not pinned | `action.yml` | need (the Action format) |
| the verify Action, its Markdown summary written by inline JavaScript in the YAML | `verify/action.yml` | need for the format; habit for the renderer, which no other forge can reuse |
| the CI channel `init` proposes | `src/lib/harness.ts`, `UNIVERSAL_CHANNELS` names `runward/adapters/github-actions.yml` only, even when `characterize` saw a `.gitlab-ci.yml` | habit |
| the GitLab sample | `templates/adapters/gitlab-ci.yml`: `npx --yes runward check --strict`, unpinned and without the Action's warning, no report deposited, no `verify` | habit |
| ADR-0080 Part 2 | "GitHub first, GitLab when a user asks"; not shipped on any forge | habit: the independence rule is a pure function, only its facts and trigger are per forge |

**What GitLab offers, and at which tier** (read 2026-10-13). CI/CD components and the catalogue: Free.
`include: remote` with `integrity:` (SHA-256, the pipeline fails on a different content): from 17.9. A
merge-request note by API: Free, but `CI_JOB_TOKEN` only reads notes, so a project access token is
needed (Premium on GitLab.com, any licence self-managed). Code Quality widget and JUnit test summary in
the merge request: Free. Required approval rules, CODEOWNERS approval, the audit API: Premium. SARIF
ingestion, external status checks, external controls, pipeline execution policies, audit streaming:
Ultimate. **No pipeline starts on an approval** (no `CI_PIPELINE_SOURCE` value for one), and an
approval record carries `approved_at`, not a commit SHA. On GitLab Free, approvals are optional and do
not block a merge.

**Why now.** ADR-0093 makes GitLab first-class, at parity in every delivery, and names the target's
most likely primary forge as GitLab, often self-managed and possibly offline. Without one written
boundary, each of D1 to D5 would re-argue where forge code lives, what happens without a token, and
what "parity" may promise.

## Decision

**The verdict and its file renderings are forge-neutral and unchanged. Everything that talks to a
forge sits behind one port, outside the verdict's import closure, with one closed behaviour per
failure. GitHub and GitLab ship at parity in every delivery; Azure DevOps and Bitbucket ship a
minimal adapter. "Parity" describes what runward ships, never what a forge tier allows.**

1. **The layers.**

   | Layer | Content | Neutral or per forge |
   |---|---|---|
   | Verdict | `check`, `--json`, `--attest`, `--witness`, `verify`, `report` | neutral, unchanged |
   | File renderings | SARIF (exists), Markdown summary, Code Quality JSON and JUnit XML (ADR-0096) | neutral, rendered from the one payload |
   | Independence rule (ADR-0080 Part 2) | one pure function, `decideIndependence(facts) -> { decision, reason }` | neutral, one implementation |
   | Fact readers | GitHub: reviews, commits, timeline; GitLab: `/approvals`, `/versions`, `/commits`, `/approval_state` where the tier exposes it | per forge |
   | Posters | summary (GitHub job summary; GitLab merge-request note; Azure pull-request status; Bitbucket Code Insights), external status (GitHub check run; GitLab external control) | per forge |
   | Packaging | the Action; a GitLab component and an integrity-pinned file; Azure Pipelines and Bitbucket Pipelines templates | per forge |
   | Change identifier | `git rev-list --first-parent` is neutral; the message parser (`Merge pull request #N`, `See merge request group/project!N`) is per forge | git neutral, parser per forge |
   | Signature | always the operator's (`actions/attest`; `cosign` with `id_tokens` or the entity's key) | per forge, runward holds no key |

2. **The port, written once.** `readChangeFacts(change) -> Facts`, `postSummary(markdown)`,
   `setExternalStatus(verdict, ref)`, `identifyChange(commitMessage) -> { forge, id } | null`. `Facts` is
   normalised (author, committers, `Co-authored-by` co-authors, the agent's requester when declared,
   approvals with their time, head commit and last push time, bot accounts) so the independence rule
   never sees a forge's vocabulary. `setExternalStatus` publishes the raw verdict (exit code, `clean`
   or `gaps`, digests); a `pass` or `fail` mapping is a policy file the customer writes (ADR-0093
   decision 9), and without it the poster refuses.

3. **Closed behaviours, one per failure, each tested on recorded API responses.**

   | Failure | `postSummary` | `readChangeFacts` and the independence rule | `setExternalStatus` |
   |---|---|---|---|
   | no token | prints « summary not posted: no token » and exits 0; the summary stays an artifact | refusal, named | refusal, named |
   | 401, 403 | « summary not posted: <status> », exit 0 | refusal | refusal |
   | 404, malformed body | same | refusal | refusal |
   | 5xx, timeout | one retry, then as above | refusal | refusal |
   | customer policy absent | not applicable | not applicable | refusal |

   The summary is a convenience; the facts and the status are evidence or claims, so they fail closed.
   No poster turns a forge error into a green.

4. **Where forge code lives.** Outside `dist/lib/verdict.js` and `dist/commands/check.js` and their
   import closures, asserted by `runtime-boundary.test.js` in both rings; no forge module is a fifth
   entry of `SPAWN_ALLOWED` (posters use the platform's `fetch`, they spawn nothing). Whether the
   forge modules ship inside the `runward` package or beside it is question 1 below.

5. **Parity, per delivery and per tier, said as it is.** Each delivery of ADR-0093 ships its forge
   pieces for GitHub and GitLab together, or does not ship. Every surface that names approval
   independence on GitLab Free says « detected after merge, not prevented »; on Premium and above « the
   forge prevents, runward records ». Azure DevOps and Bitbucket get, in D1, a pinned pipeline template
   and one line in the adapters README, and in D5 a summary poster reusing the same Markdown; their
   fact readers come later, under the same pure rule, without changing it.

6. **The D1 sweep this boundary implies** (built in D1, recorded here so D1 does not re-argue it):
   `templates/adapters/gitlab-ci.yml` aligned with the Action (pinned version, the same warning when
   unpinned, reports deposited as artifacts); `harness.ts` proposes the GitLab sample when
   `characterize` sees `.gitlab-ci.yml`; the charter template names `gitlab:<id>` beside `github:<id>`
   and adds `.gitlab-ci.yml` and `.gitlab/**` to its pre-merge path examples; the verify summary
   renderer moves out of the Action's inline JavaScript into the neutral `report --format md`.

7. **The offline bench.** A GitLab CE instance in a container, network cut, in runward's CI, plus
   recorded API responses for unit tests. It is part 2 of D0 and lands in its own pull request.

## Alternatives discarded

- **GitHub first, GitLab on request (ADR-0080's current wording).** The target names its forge in the
  first conversation and never phrases a request in runward's terms; the request would never come.
- **Forge calls inside `check`.** Crosses ADR-0054 crossing 5 and breaks "same working tree, same
  verdict": an API answer is not in the tree.
- **One adapter per forge with its own independence rule.** Two rules drift; the rule is a pure
  function of normalised facts, and only reading the facts is per forge.
- **"Parity" as a promise of equal controls.** GitLab Free cannot block a merge on an approval; saying
  parity there without the tier sentence would be the overclaim ADR-0050 exists to prevent.
- **A personal access token recommended for the GitLab.com Free merge-request note.** It would make a
  person's credential the poster's identity; the summary stays an exposed artifact there instead.

## Consequences

- **Positive.** D1 to D5 cite one boundary; GitLab gets the same deliverables in the same delivery; a
  missing token never reads as a green; the verdict path does not move.
- **Negative, accepted.** Two forges to keep in step at every delivery, each with recorded responses
  that age as the APIs move; a test bench to maintain; on GitLab Free the independence check stays a
  detection control and every surface says so.
- **On other boundaries.** The first module of runward that opens a network connection, wherever it
  lives (question 1); the network-cut CI run must keep passing with every poster absent or refusing.

## What would settle it

**Questions for the maintainer** (each with the recommendation):

1. **Where the forge modules ship.** (a) Inside the `runward` package, under a separate entry point
   outside the verdict closure: one version, one tarball for an offline mirror, one provenance. (b) A
   second package from the same repository and release chain (for example `runward-forge`), importing
   nothing from runward but reading its output files: the CLI package keeps zero network code, which
   is what a security reviewer reads first. **Recommended: (b)**, because "no module of the `runward`
   package opens a connection" is a property a reviewer can check in one grep, and (a) would end it.
2. **How the GitLab packaging reaches a self-managed instance.** (a) An integrity-pinned file published
   as a release asset, used by `include: remote` with `integrity:` or by importing the project once:
   works on Free, offline after one copy, needs no new forge account. (b) A catalogue component
   published from a gitlab.com project runward operates: discoverable, but a new trust root (a forge
   account and a release path on a second forge, both class R). **Recommended: (a) in D1 as the parity
   channel; (b) when the maintainer creates the gitlab.com project, released from the same tag.**

**Evidence that would ratify or reverse it:**

- `runtime-boundary.test.js` reddens on a planted import of a forge module into either ring.
- Every port function has a GitHub and a GitLab implementation tested on recorded responses, each
  closed behaviour above included; a planted 403 never yields a green status.
- The same Markdown summary, byte for byte, posted on a GitHub pull request and a GitLab merge request
  of the bench.
- The D1 install runs in the offline GitLab CE bench through the integrity-pinned file.
- Reversal: a forge whose facts cannot be normalised into `Facts` without losing what the
  independence rule needs, or a poster that must run inside `check` to be useful.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-13, or earlier when: GitLab adds a pipeline source for approvals (Free detection
could become prevention); a recorded response no longer matches the live API of either forge; a target
names a forge outside the four; or a poster is found inside a verdict ring.

**Trigger set on**: 2026-10-13 · **Watched via**: `runtime-boundary.test.js`, the recorded-response
tests, the offline GitLab CE bench.

## References

- ADR-0093 decisions 1, 2, 9 and 12; ADR-0054 crossings 4 and 5; ADR-0080 Part 2; ADR-0088 decision 2.
- GitLab documentation on CI/CD components, `include: remote` with `integrity`, merge request notes and
  approvals, `CI_JOB_TOKEN`, project access tokens, Code Quality, JUnit reports, external status
  checks and external controls (read 2026-10-13, outside this repository).
- Azure DevOps pull-request status policy; Bitbucket Cloud Code Insights (read 2026-10-13).
