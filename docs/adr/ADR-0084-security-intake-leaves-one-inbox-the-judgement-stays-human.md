# ADR-0084 — Security intake leaves one person's inbox; the judgement stays human

**Date**: 2026-09-30
**Status**: proposed
**Deciders**: the maintainer
**Method**: `SECURITY.md`, `runward/runbook.md` §3 step 2, `ROADMAP.md` ("Security handling") and the
repository's workflows read on the branch of this ADR (base `main` at 0.42.3); GitHub's documentation
read at the source on 2026-09-30 and quoted below; the repository's merge settings, branch protection
and Dependabot history read through the API the same day (status codes and counts only: no advisory,
alert or report content was read or is recorded here)
**Relates to**: [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) (the operator layer
stays outside the CLI), [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (nothing runward
operates holds state), [ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md) (what
an agent may propose, only the operator's hand completes), RWD-2026-0163 (the three security settings)

## Context

**The promise.** `SECURITY.md` names one channel, the repository's private vulnerability reporting
form, and one deadline: "**Acknowledgement**: within 7 days of the report." It promises no fix time.
`ROADMAP.md` lists, under "Security handling, as the mature projects do it": "Security intake that does
not depend on one person's inbox. An automated acknowledgment inside the 7 days, a notification to the
maintainer, Dependabot security patches merged automatically on a green CI when they are
development-only, and a weekly CodeQL digest. This is operator-layer work (ADR-0039), outside the CLI."

**What carries the promise today.** One person's GitHub notifications. GitHub's page *Managing
privately reported security vulnerabilities*: "When a new vulnerability is privately reported in a
repository, GitHub notifies repository administrators and security managers if: They're watching the
repository for all activity or are subscribed to “Security alerts” notifications. They have
notifications enabled for the repository." A filtered e-mail, a muted repository or a week away and the
7 days pass silently; nothing measures the delay.

**What the platform allows, read at the source (2026-09-30).**

1. *Listing reports awaiting triage.* REST `GET /repos/{owner}/{repo}/security-advisories` takes
   `state`, which "Can be one of: `triage`, `draft`, `published`, `closed`". Its access rule: "The
   authenticated user can access unpublished security advisories from a repository if they are a
   security manager or administrator of that repository, or if they are a collaborator on any security
   advisory." *Permissions required for fine-grained personal access tokens* lists the endpoint under
   **Repository permissions for "Repository security advisories"**, access `read`, token `PAT`; the
   GitHub Apps page lists it under the same permission, tokens "UAT, IAT" ("UAT = user access token, IAT
   = installation access token").
2. *The workflow token has no such permission.* The `permissions` table of *Workflow syntax for GitHub
   Actions* names `actions`, `artifact-metadata`, `attestations`, `checks`, `code-quality`, `contents`,
   `deployments`, `discussions`, `id-token`, `issues`, `packages`, `pages`, `pull-requests`,
   `security-events`, `statuses` and `vulnerability-alerts`; none covers repository security
   advisories. *Use GITHUB_TOKEN for authentication in workflows*: "If you need a token that requires
   permissions that aren't available in the `GITHUB_TOKEN`, create a GitHub App and generate an
   installation access token within your workflow. [...] Alternatively, you can create a personal
   access token, store it as a secret in your repository". Whether a `GITHUB_TOKEN` is refused on the
   endpoint has not been measured (see "What would settle it").
3. *No workflow event fires on a report.* The webhook event `repository_advisory` exists, "Action type:
   `published`, `reported`", available to a `repository`, `organization` or `app` webhook, and "To
   subscribe to this event, a GitHub App must have at least read-level access for the 'Repository
   security advisories' permission." *Events that trigger workflows* lists no advisory event: a workflow
   can only poll on `schedule`.
4. *No documented API comments on an advisory.* The maintainer page says: "To ask for more
   information, or to open a discussion with the reporter, you can comment on the advisory. Any comments
   are visible only to the reporter and to any collaborators on the advisory." The REST reference for
   repository security advisories has eight operations (list for an organisation, list, create,
   privately report, get, update, request a CVE, create a temporary private fork) and no comment
   operation; the public GraphQL schema (`schema.docs.graphql`, fetched 2026-09-30) contains no
   repository-advisory type. **An automated acknowledgment written to the reporter, as the roadmap
   phrases it, has no documented channel.** The only machine-writable change a reporter sees is the
   advisory's state (`PATCH`, "Repository security advisories" `write`), and accepting or closing a
   report is the triage decision itself.
5. *Code scanning.* `security-events: read` "permits an action to list the code scanning alerts for the
   repository"; `GET /repos/{owner}/{repo}/code-scanning/alerts` filters on `state` (`open`, `closed`,
   `dismissed`, `fixed`). `.github/workflows/codeql.yml` already runs weekly (`cron: "37 5 * * 2"`).
6. *Dependabot auto-merge.* *Automating Dependabot with GitHub Actions* gives the pattern:
   `dependabot/fetch-metadata` (outputs `dependency-names`, `dependency-type`, `update-type`), then
   `gh pr merge --auto --merge` under `permissions: contents: write, pull-requests: write`, with the
   note "you should enable **Require status checks to pass before merging** for the target branch".
   The action's README: `dependency-type` is one of "`direct:production`, `direct:development` and
   `indirect`"; `update-type` is "The highest semver change being made by this PR". The troubleshooting
   page: runs triggered by Dependabot "receive a read-only `GITHUB_TOKEN`" by default, and "You can use
   the `permissions` key in your workflow to increase the access for the token". The options reference:
   the default three-day cooldown "does not apply to security updates".
7. *Where a run's output lands.* *Using workflow run logs*: "Read access to the repository is required"
   to view or download logs. On this public repository that is every logged-in account.

**The repository as measured (2026-09-30).** `allow_auto_merge` is `false`. Branch protection on `main`
requires four status checks (`test (22)`, `test (24)`, `floor-ts`, `core tests, network-isolated`),
requires no review and does not bind administrators. The repository holds 0 Actions secrets and 0
Dependabot secrets, and the runbook states it as a property: "the repository keeps no Actions secret
[...] so no CI job can run this". Dependabot has opened 50 pull requests since 2026-07-15: 19 merged,
31 closed unmerged; the merged ones waited a median of 0.3 day, at most 18.8 days. The published
package has three runtime dependencies; every other npm dependency at the root is a development
dependency, among them `typescript`, which compiles the `dist/` that ships.

## Decision

**Proposed: split the intake by what it has to read.** Whatever reads private security state (reports
in triage, code scanning alerts, Dependabot alerts) runs in the maintainer's operator layer, outside
this repository, with a token that never enters it. Whatever reads only public state (a Dependabot pull
request's metadata) runs as a workflow in this repository on the `GITHUB_TOKEN`, with no secret.

1. **Report watch, outside the repository (operator layer, ADR-0039).** The maintainer's operator agent
   polls `GET /repos/stranxik/runward/security-advisories?state=triage` (or receives the
   `repository_advisory` `reported` webhook, if the maintainer gives it a private endpoint) and sends a
   notification on a channel that is not the e-mail inbox: at the report, again at day 5 if the report
   is still in `triage`, and a last one at day 7. Its token: a fine-grained personal access token scoped
   to this one repository, read-only, with **Repository security advisories: read**, **Code scanning
   alerts: read** and **Dependabot alerts: read** and nothing else, an expiration of at most 90 days,
   kept in the operator's secret store (never in a file, never in this repository), its rotation date
   written in the operator's own runbook. The notification carries the advisory's link and age, never
   its text.
2. **Acknowledgment stays a human comment, and the watch makes the deadline visible.** Since no
   documented API writes to the reporter (Context, 4), the 7-day acknowledgment is the maintainer's
   comment on the advisory; the automation's job is that the maintainer cannot miss the clock.
   `SECURITY.md` keeps its wording; if the maintainer wants it to say how the acknowledgment is
   produced, that is a text change decided separately.
3. **Weekly CodeQL and Dependabot digest, outside the repository.** The same agent, weekly, counts open
   code scanning alerts by severity and open Dependabot alerts by severity, and sends the counts with
   links. Nothing is posted in the repository: an issue or a run log is readable by every logged-in
   account (Context, 7), and an open alert is an unfixed defect.
4. **Dependabot auto-merge, inside the repository, on the `GITHUB_TOKEN`.** One workflow on
   `pull_request`, gated on `github.event.pull_request.user.login == 'dependabot[bot]'`, with
   `permissions: contents: write, pull-requests: write` at job level, runs `dependabot/fetch-metadata`
   pinned by commit SHA and enables `gh pr merge --auto` only when **all** of the following hold: the
   ecosystem is `npm` at the root or in `/floor-ts`; `dependency-type` is `direct:development`;
   `update-type` is `version-update:semver-patch` or `version-update:semver-minor`; no updated
   dependency is on a deny-list kept in the workflow, starting with `typescript` (it builds what ships).
   The required checks are the merge condition; auto-merge adds none and removes none. GitHub Actions
   updates (`chore(ci)`) never auto-merge: they change what runs with the workflows' privileges, which
   the threat model says is "untrusted until reviewed". Turning on `allow_auto_merge` is an
   administrator's act, the maintainer's.
5. **What stays a human decision, with no automation around it.** Whether a report is a vulnerability
   (accept as draft, or close); when and how to fix it; the advisory's text, its severity, its CVE
   request and its publication; the acknowledgment comment; any dependency update outside the envelope
   of point 4, production dependencies and `indirect` ones included; the three security settings the
   runbook reads back at each release; the token's issue, scope and rotation.
6. **What is automated.** The notification at the report and its day-5 and day-7 reminders; the weekly
   digest; the merge of development-only patch and minor updates once the required checks are green.

Nothing here enters the CLI, the gate, the mission or the verdict path (ADR-0054). The only change to
this repository, if the decision is taken, is the auto-merge workflow and a line in the runbook.

## Alternatives discarded

- **A scheduled workflow in this repository with a narrowly scoped token** (a fine-grained PAT or a
  GitHub App installation token with "Repository security advisories: read", stored as an Actions
  secret). It is the cheapest to build and the costliest to hold. It ends the repository's
  zero-secret property, which the runbook states and which the threat model relies on; it puts a token
  that reads unpublished vulnerability reports in a public repository's CI, where every workflow file
  and action is one pull request away from it (a `pull_request` run from a fork receives no secret, but
  a merged change to any workflow does); its logs are readable by any logged-in account, so one careless
  `echo` publishes an embargoed report; and it still has nowhere private to send the notification
  (an issue is public, an e-mail is the inbox this ADR leaves). A GitHub App narrows the blast radius
  (installation tokens "expire after 1 hour") but adds an App private key as the secret instead. Kept
  as the fallback if the maintainer has no operator agent, and then only with the App, a job that
  prints status codes and counts only, and a notification through an external channel whose own
  secret is counted.
- **Do nothing, keep it manual.** Costs nothing and holds no token. The 7-day acknowledgment keeps
  resting on one notification setting that nothing checks, and Dependabot's pull requests keep waiting
  on a person (median 0.3 day, but 18.8 days at worst, measured). Honest, and the default until this ADR
  is decided.
- **Everything outside the repository, auto-merge included.** The operator agent could merge Dependabot
  pull requests with a write token. That needs a token with `Contents: write` living outside GitHub's
  own lifetime rules, where the in-repository workflow needs no secret at all, since the
  `GITHUB_TOKEN` "expires when the job finishes or after its effective maximum lifetime". Worse on the
  axis this ADR is about.
- **Auto-merge every Dependabot security update, production included.** It is what the roadmap's phrase
  could be read to ask, and it would let an unreviewed version into the three packages that ship, on a
  schedule that security updates do not cool down (Context, 6). A patch that closes a vulnerability in
  a runtime dependency is a release decision ([ADR-0068](ADR-0068-one-maintained-minor-and-a-dated-release-train.md)), not a merge.

## Consequences

- **Positive.** The acknowledgment deadline gets a clock that someone other than the inbox watches,
  with two reminders before it lapses. Development-only bumps merge on the same checks a person would
  wait for. The repository keeps zero secrets and no workflow reads private security state.
- **Negative, accepted.** The acknowledgment itself stays manual: the promise still depends on one
  person, now warned three times instead of once. The report watch depends on the operator agent
  running; if it stops, the intake falls back to today's state silently unless the agent reports its
  own liveness. The fine-grained token is a standing secret on the maintainer's side, with a
  rotation to keep. `indirect` updates (a vulnerable transitive development package, the case the
  roadmap names for `qs`) stay manual, because `fetch-metadata` does not say whether a transitive
  package is development-only.
- **On the documents.** `runward/governance/threat-model.md` counts "The repository's two scheduled
  workflows (watch-external-facts, scorecard)"; `.github/workflows/codeql.yml` is scheduled too, so the
  count is already off by one on `main`. The auto-merge workflow is not scheduled and does not change
  it; that line is corrected separately. `docs/compliance/regulated-adoption.md` describes vulnerability
  management and gains one sentence on auto-merge if point 4 is adopted.
- **Supply chain.** A development dependency is not harmless because it does not ship: it runs in CI
  and, for the compiler, produces the shipped code. The deny-list is the control; it is short on
  purpose and reviewed at each reevaluation.

## What would settle it

- **For the split (points 1 to 4)**: the maintainer confirms that the operator agent can hold a
  fine-grained token and reach a notification channel, and that a test report lands as a notification
  within one polling interval. The test report is filed from an account that is not an administrator
  of the repository, so it arrives as a reporter's would; a draft advisory created by the maintainer
  exercises the `state` filter only for `draft`, which does not prove the `triage` path.
- **Against the fallback (a workflow with a token)**: one `workflow_dispatch` run that calls the
  endpoint with the `GITHUB_TOKEN` and prints only the HTTP status. A 200 on `state=triage` would
  contradict Context, 2 and reopen the in-repository option without a secret; a 403 or 404 closes it.
- **For an automated acknowledgment**: a documented endpoint that writes a comment on a repository
  security advisory. Its appearance in the REST reference or the GitHub changelog moves the
  acknowledgment from point 2 to point 6.
- **For point 4's envelope**: over the first 90 days of auto-merge, the list of merged updates read
  against the deny-list; any auto-merged update later reverted or tied to a defect narrows it.

## Reevaluation trigger (mandatory, dated)

Reopen when GitHub documents an API that comments on a repository security advisory, or adds a
repository-advisory permission to the `GITHUB_TOKEN`, or an Actions event for reports; when the
project gains a second maintainer or a security manager (the single-person premise changes); when an
acknowledgment deadline is missed or met only after the day-7 reminder; or when an auto-merged update
is reverted.

**Trigger set on**: 2026-09-30 · **Watched via**: the GitHub REST changelog and the repository
security advisories reference at each release's runbook step 2; the defect register (`found-by` any)
for a missed acknowledgment or a reverted auto-merge.

## References

- `SECURITY.md` ("Reporting a vulnerability"); `ROADMAP.md` ("Security handling, as the mature projects
  do it"); `runward/runbook.md` §3 step 2; `runward/governance/threat-model.md`;
  `.github/dependabot.yml`; `.github/workflows/codeql.yml`.
- GitHub Docs, read 2026-09-30: *REST API endpoints for repository security advisories*;
  *Permissions required for fine-grained personal access tokens*; *Permissions required for GitHub
  Apps*; *Workflow syntax for GitHub Actions* (`permissions`); *Use GITHUB_TOKEN for authentication in
  workflows*; *GITHUB_TOKEN*; *Webhook events and payloads* (`repository_advisory`); *Events that
  trigger workflows*; *Managing privately reported security vulnerabilities*; *REST API endpoints for
  code scanning*; *Automating Dependabot with GitHub Actions*; *Troubleshooting Dependabot on GitHub
  Actions*; *Dependabot options reference* (`cooldown`, `dependency-type`); *Using workflow run logs*;
  *Managing your personal access tokens*; *Generating an installation access token for a GitHub App*.
- `dependabot/fetch-metadata`, README (inputs `alert-lookup`, outputs `dependency-type`,
  `update-type`).
