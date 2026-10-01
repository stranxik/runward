# ADR-0088 — runward's own delivery runs under a delegation charter the gate reads: agents act under their own identity, the maintainer signs the policy and one weekly sample, not each act

**Date**: 2026-10-01
**Status**: proposed — the direction (agents under their own identity, a charter signed once, a weekly
signed acknowledgement, two stages) was approved by the maintainer on 2026-10-01; the treatment of
runward's own regulated lock (decision 4, recommended option (a)) is not answered yet
**Deciders**: the maintainer
**Method**: an inventory of every act in runward's delivery that requires the maintainer's hand,
measured on `origin/main@8a18489` with read-only `gh api` calls; the texts that bear on human approval
read at source or at a named mirror on 2026-10-01; prior art from forges and large projects; the
doctrine read against the code (`src/lib/conformance.ts`, `src/commands/ratify.ts`,
`src/commands/wire.ts`, `src/lib/harness.ts`); a regulatory review and a security review of the draft
the same day; then five platform measurements on a throwaway public repository,
`github.com/stranxik/runward-delegation-lab`, with the GitHub App `runward-steward` (id 5150097) on
2026-10-01, quoted under "What the platform does, measured"
**Relates to**: [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md),
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md),
[ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md),
[ADR-0066](ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0082](ADR-0082-an-agent-may-ratify-under-its-own-name-never-under-a-humans.md),
[ADR-0084](ADR-0084-security-intake-leaves-one-inbox-the-judgement-stays-human.md),
[ADR-0085](ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md),
[ADR-0086](ADR-0086-security-advisories-and-a-fix-time-target.md), ADR-0087 (proposed, PR #346)
**Would amend, by name, once accepted** (none of these ADRs is edited by this one): ADR-0080, the
"runward itself" paragraph; ADR-0082, decision 3 extended, for the single-accountable case only;
ADR-0084, point 5, for advisory drafting; ADR-0085, decision 3 and its consequence "The only
irreversible gesture of a release is the maintainer's", for patch releases only.

## Context

**What the maintainer said.** On 2026-10-01: « c'est un système qui doit fonctionner sans ma main
directe [...] c'est absurde de développer un système justement fait pour encadrer l'IA agentique et
que je doive moi-même gérer cela manuellement » [it is a system that must work without my direct hand;
it is absurd to build a system meant to frame agentic AI and then manage it all by hand myself]. This
is, from the inside, the reevaluation trigger ADR-0080 names: ratification cost leading to bulk
ratification without reading.

**What the forge records today.** All 277 merged pull requests not opened by Dependabot were opened and
merged by the maintainer's account, with 0 reviews; median creation-to-merge 0.076 h. Since
2026-07-01, 823 commits carry the maintainer's name and 0 an agent's. 11 draft advisories were created
in 8 seconds on 2026-10-01. `.github/CODEOWNERS` is `* @stranxik`. Every agent session on the
maintainer's machine uses the same token. The forge cannot tell the maintainer's acts from an agent's:
the attribution ADR-0082 forbids for ratification ("never under a human's name") already holds for
merges, releases and advisories. While that token is within agent reach, **no control in this ADR binds
an agent**: with it, an agent can give the CODEOWNERS approval, change rulesets, clear a stop, or bypass
an environment wait.

**What the human validation measured last week.** runward's 46 rows were ratified on 2026-09-27 en bloc,
"sample 18/46, sampled rows accepted 18/18": 28 rows were never displayed. A later entry (2026-09-30) is
signed with a different spelling of the maintainer's name than the other five; by RWD-2026-0119 the
trace cannot tell who ran it. By the same record, a script on a pseudo-terminal can produce a
person-shaped trace: `ratify`'s human path checks `process.stdin.isTTY` (`ratify.ts:142`), and
`agentRuntimeSignal(process.env)` (`harness.ts:110`) is environment detection.

**What ADR-0082 already allows, and its gap.** `ratify --agent <name> --for <person>` records
`mode: agent`, refused when the agent or its accountable person is the row's proposer. `agentCause()`
(`conformance.ts:756`) compares free declared strings (`declaredNameIn`): `--agent` is any string, and
`--for thibaultsouris` does not match a proposer `Thibault Souris`. Proposals do not record the
proposer's accountable person. Under the regulated tier, ADR-0082 decision 3 extended counts
`agentRatification` only "when its accountable person differs from the proposer" and "never relaxes
ADR-0080 part 2: the forge approval still requires a human account, not a bot or an app". runward's own
lock (`runward/scaffold-lock.json`) carries `"regulated": true`.

**What ADR-0080 already refused.** `docs/operator-role.md`: a "validated by" field in a mission artifact
"would be re-signable by whoever writes the artifact — declarative, worth nothing to an assessor". A
delegation charter is such an artifact. This ADR does not ask it to prove anything (decision 3).

**What the platform does, measured** (2026-10-01, `github.com/stranxik/runward-delegation-lab`, public,
throwaway). The App `runward-steward` (id 5150097, private, owner `stranxik`) is installed on the lab
repository only, with `metadata: read`, `contents: write`, `pull_requests: write`,
`repository_advisories: write`, `actions: read`, `checks: read`, `statuses: read`, and no
`administration`, `workflows` or `variables`. Its private key sits in the macOS keychain of the
maintainer's user; installation tokens are minted per use and live one hour.

- **T1, a review.** Branch ruleset on the default branch: pull request required, 1 approving review, no
  bypass. Pull request #1, opened by the maintainer's account, approved by `runward-steward[bot]`
  (REST; `gh pr review` over GraphQL errored with an App token), merged by the maintainer's account:
  merged, `reviewDecision` APPROVED, rule suite result pass. Control, pull request #2 with no review:
  merge refused, "At least 1 approving review is required by reviewers with write access." **The App's
  approval satisfies a required review.**
- **T2, a release.** The App created a draft release for a tag `v0.0.1` that did not exist, then
  published it (`PATCH draft=false`): release published, author `runward-steward[bot]`; the workflow on
  `release: published` ran with actor and triggering actor `runward-steward[bot]`. **An installation
  token fires the event the `GITHUB_TOKEN` does not, so the App key alone can make a release's
  irreversible gesture** and start everything ADR-0085 hangs on it, npm publication included.
- **T3, an advisory by the App.** `POST` create: draft `GHSA-vm9v-39qg-jf2c`, state draft, author
  `runward-steward[bot]`; `PATCH state=closed`: closed. Publishing an advisory and requesting a CVE
  were **not** measured: either would write to the public Advisory Database.
- **T4, an advisory by the workflow token.** A `GITHUB_TOKEN` with `contents: read`: list `GET` 200,
  create `POST` 403. A workflow token cannot create an advisory. (The lab note does not record the
  state filter or the content of the list call; ADR-0084's question on `state=triage` stays open.)
- **T5, a tag.** Tag ruleset on `refs/tags/v*`, rule "creation", no bypass: the App creating
  `refs/tags/v0.0.2` was refused ("Reference update failed"); control, the App creating `refs/tags/lab-1`
  succeeded; the App publishing a draft whose tag `v0.0.3` did not exist was refused ("Cannot create
  ref due to creations being restricted"); the maintainer's account creating `v0.0.4` was refused too.
  **A no-bypass tag ruleset stops the App and the maintainer alike.**
- **A fact about one agent runtime.** During the lab, Claude Code's own permission classifier refused,
  unprompted, an agent approving through the App a pull request the same agent had opened, a merge
  without review even as a control, reading the App key, and making a repository public; the maintainer
  ran T1's approval and its control by hand. This is a property of one harness's configuration, which
  runward neither ships nor can read, and no decision below relies on it.

**What follows from the measurements.** From T2: the custody of the App key is a precondition of any
delegation, not a hardening step; whoever holds the key holds the release. From T1: if the author and
the reviewer are two identities whose keys one process can read, the forge's "approved" is one actor
approving itself; the reviewer's key must be under a custody separate from the author's, and even then,
with one accountable person, the forge's "approved" is not independent and must not be presented as
such. From T5: a no-bypass tag ruleset cannot serve a chain where the maintainer pushes the tag
(ADR-0085 decision 1); an admin-role bypass keeps the App out but protects only once agents no longer
hold the maintainer's credential, because with it an agent is the admin. From T3 and T4: advisory drafts
come from the App, never from the `GITHUB_TOKEN`; App publication and CVE requests rest on documentation
until measured.

**What the texts require.** Read 2026-10-01; EUR-Lex refused automated fetches, so DORA was read on an
unofficial mirror and RTS art. 17 on springlex.eu.

- DORA art. 9(4)(e) (https://eur-lex.europa.eu/eli/reg/2022/2554/oj; read at
  https://www.digital-operational-resilience-act.com/Article_9.html): controls so that "all changes to
  ICT systems are recorded, tested, assessed, approved, implemented and verified in a controlled
  manner"; management approval of the process is additional, not a substitute. DORA requires every
  change to be approved.
- RTS 2024/1774 art. 17(1) (https://eur-lex.europa.eu/eli/reg_del/2024/1774/oj; read at
  https://www.springlex.eu/en/packages/dora/rts-rmf-regulation/article-17/): applies "in respect of all
  changes"; (b) "independence of the functions that approve changes and the functions responsible for
  requesting and implementing those changes"; (f) "adequate safeguards"; (g) post-implementation
  approval for **emergency changes only**, every one of them. The charter-and-sample model does **not**
  meet these. It is acceptable for runward only because runward is not a financial entity, and it is
  never presented as a change-approval control.
- AI Act art. 14(1) (https://artificialintelligenceact.eu/article/14/): a design obligation on
  providers of high-risk systems, which "shall be designed and developed [...] [to] be effectively
  overseen by natural persons during the period in which they are in use"; 14(4)(d)-(e) abilities to
  override and to "interrupt the system through a 'stop' button"; 14(5) two-person verification for
  remote biometric identification only. Art. 26(2) (https://artificialintelligenceact.eu/article/26/):
  deployers assign oversight to natural persons with "competence, training and authority, as well as
  the necessary support". runward is not a high-risk system. The applicability date of the high-risk
  obligations, and any postponement, was not re-read.
- NIST AI 100-1 (https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf): MANAGE 2.4, mechanisms "to
  supersede, disengage, or deactivate AI systems". The appendix on human-AI interaction: "Some AI
  systems may not require human oversight, such as models used to improve video compression. Other
  systems may specifically require human oversight."
- SLSA v1.2 Source (https://slsa.dev/spec/v1.2/source-requirements): the second level requires the
  source control system to issue "Source Provenance Attestations for each new Source Revision"; the
  third, enforced technical controls recorded in attestations and Verification Summary Attestations;
  the fourth, "two or more trusted persons", a trusted person being "a human". The "Trusted Robot"
  exception requires an automation whose "identity and codebase cannot be unilaterally influenced"; an
  App held by one maintainer does not qualify. runward's current Source level is not measured.
- Cyber Resilience Act (primary text not read; secondary: https://www.cyberresilienceact.eu/reporting.html,
  https://zavodsky.org/en/intelligence/regulatory-radar/cyber-resilience-act-reporting-11-september-2026/):
  art. 14 reporting of actively exploited vulnerabilities applies from 2026-09-11, with a 24-hour early
  warning; open-source stewards have art. 24 obligations. Whether runward is a manufacturer, a steward
  or out of scope depends on commercial activity; paid pilots are envisaged. Not determined.
- GitHub Terms of Service (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service):
  "Accounts registered by 'bots' or other automated methods are not permitted"; "A machine account is an
  Account set up by an individual human who accepts the Terms on behalf of the Account, provides a valid
  email address, and is responsible for its actions"; "You are responsible for all content posted and
  activity that occurs under your Account". The terms do not forbid automation under one's own account:
  today's defect is an attribution defect under ADR-0082, not a breach of the terms.
- GitHub Actions (https://docs.github.com/en/actions/concepts/security/github_token): "events triggered
  by the `GITHUB_TOKEN` will not create a new workflow run". Rulesets
  (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets):
  push rules with file-path restriction apply only "to a private or internal repository"; "Any person
  or integration with write permissions to a repository can set the state of any status check".

**What prior art does** (read 2026-10-01). Prow
(https://docs.prow.k8s.io/docs/components/plugins/approve/approvers/): for `/lgtm`, "Authors of the PR
cannot give the label, but they can cancel it"; `approve` lets an author in OWNERS approve their own
files by default (secondary source; the approve-plugin page is a placeholder). Chromium Rubber Stamper
(https://chromium.googlesource.com/infra/infra/+/refs/heads/main/go/src/infra/appengine/rubber-stamper/README.md)
approves narrow benign classes and "never provides OWNERS approval, by design". Copilot coding agent
(https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations): commits authored
by the agent, the requester co-author and barred from approving; Copilot reviews do not count toward
required approvals by default, an administrator can let them count since 2026-09-01 (recorded in
ADR-0080), approvals in public preview (https://docs.github.com/en/copilot/concepts/agents/code-review).
Apache lazy consensus (https://community.apache.org/committers/lazyConsensus.html): intent stated "on a
public email", "usually 72 hours", "Silence indicates consent". Anthropic
(https://www.anthropic.com/engineering/claude-code-auto-mode): "Claude Code users approve 93% of
permission prompts". OpenAI, "Practices for Governing Agentic AI Systems"
(https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf): §4.2 opens "Some
decisions may be too important for users to delegate to agents [...] (such as independently initiating
an irreversible [...] transaction)" and lists the "rubber stamp" among its open questions; §4.4:
"Actions that can only be reviewed after the fact should be more easily reversible than those that
require approval." Class I below answers this with a signed prior authorization, never silence.

**Not read.** CRA primary text; ISO/IEC 42001 and 27001; ITIL 4; PCAOB AS 2201; GitHub's CNA review
practice; npm's terms on automated publishing; npm trusted-publisher environment binding; GitHub
environment admin-bypass documentation.

## Decision

**Agents act under their own identity, inside a charter the gate reads; the maintainer's recurring act
is one signed weekly commit. It starts in two stages, and every surface says which stage holds.**

1. **Two stages, displayed.**
   - **Stage 1, now.** Delegated acts run under the App; the maintainer's credential and the App key are
     still within agent reach. Every surface (`check`, `report`, the charter header, README) prints
     « delegation: declared, not proved — the maintainer's credential is within agent reach ». Classes R
     and H stay the maintainer's, class I is not delegated (releases and advisories as ADR-0085 and
     ADR-0084 decide them today), class D is delegated. Stage 1 adds attribution; it adds no protection,
     and says so.
   - **Stage 2, provable.** Agent sessions run under a separate macOS user (or a container) that holds
     no maintainer `gh` token (at most a fine-grained read-only one) and cannot read the App keys; trust-root
     acts happen only from a 2FA web session or a commit signed by the maintainer's hardware key
     (`sk-ssh-ed25519`, touch required). The gate checks what it can: every commit on `main` after the
     cut-over is the App's (web-flow signature verified) or signed by a key in `allowedSigners`; an
     agent-side probe (`gh api user` fails or returns the App) is shown as self-declared. Only the
     hardware-key signature is evidence an agent cannot produce.

2. **Four classes of acts.**
   - **R, trust roots, the maintainer's**: signing, renewing, widening and revoking the charter; forge
     and admin settings; `allowedSigners`; lock opt-ins; arming the gate (ADR-0065, unchanged);
     constitutional ADRs (verdict path or ADR-0054 crossing, `AGENTS.md` boundaries, `SECURITY.md`
     promises, the public-claim ceiling, the charter, superseding an accepted decision).
   - **H, judgement owed to a third party, the maintainer's**: a reported vulnerability, its
     acknowledgement, a CVE request, embargo coordination, and any CRA art. 14 notification if runward
     is in scope.
   - **I, irreversible public acts, delegated in stage 2 only, covered by a signed prior authorization,
     never by silence**: patch releases whose diff contains no constitutional ADR, no shipped-code merge
     not yet covered by a signed digest, and no dependency version younger than N days, with checks
     green, the ratchet held and the four assets verified. Advisory publication joins class I only
     after the CRA scope determination and the measurement of App publication (What would settle it);
     until then it stays human. Minor and major releases remain the maintainer's gesture.
   - **D, reversible or internal, delegated**: merges outside the pre-merge list (decision 7), agent
     ratification of rows, non-constitutional ADRs, Dependabot merges (with `cooldown`), defect-register
     entries, documentation syncs, advisory drafts by the App (T3; never by the `GITHUB_TOKEN`, T4),
     golden regeneration.

3. **Identities and key custody.** Delegated acts run under `runward-steward`, installed on runward's
   repository with the lab's permission set and never `administration`, `workflows` or `variables`.
   Because the App key alone can publish a release (T2), its custody is part of the decision: in stage 2
   it leaves the agents' reach (a signer the agents' OS user cannot read, preferably KMS/HSM with a
   per-App policy). Because the App's approval satisfies a required review (T1), a review counts only
   from an identity whose key is under a custody separate from the author's: preferably a third-party-
   hosted reviewer whose key no local process holds (Copilot review, if the administrator enables it),
   otherwise a second App under separate custody, outside any agent's filesystem, the operator-layer
   agent's included. In stage 1 no App review is presented as a review. Invariant: no App in any bypass
   list. Every act carries « by: <agent> (agent) · for: <canonical id> (accountable) ». README and
   GOVERNANCE state that the forge's "approved" is not independent with one accountable person: the
   forge UI, ruleset audit and SLSA tooling do not carry runward's disclosure.

4. **Independence fixed, and never claimed where it does not exist.** `propose` records the proposer's
   accountable person; accountable persons are compared by canonical id (forge user id plus aliases);
   `by:` is bound to the git identity that committed the entry (the App bot, web-flow signature
   verified), not a free string. A ratification whose accountable person equals the proposer's is
   refused, except as `agent (single accountable)`:
   - in a default mission it counts, disclosed on every surface as « single accountable person; agent
     ratifications are disclosed throughput, not independent approval »;
   - under the regulated tier it is refused by default (ADR-0082 decision 3 extended stands). For one
     case only this ADR would amend it: it counts when the lock names the exception
     (`"singleAccountable": "<canonical id>"`) **and** the period is covered by a passing signed sample;
     otherwise it is a named strict gap. Every surface then prints « not a DORA change-approval
     control; ADR-0080 Part 2 unchanged ».
   - **For runward's own mission, recommended: (a)** the named amendment to ADR-0082 above and the
     exception declared in `runward/scaffold-lock.json`. The others: (b) leave the regulated tier on
     runward's own mission, losing the strictest dogfooding; (c) keep the agent rows as named strict
     gaps, which turns runward's own strict gate red or sends the maintainer back to ratifying in
     person. The maintainer has not chosen yet.

5. **A charter the gate reads, which proves nothing by itself: `runward/delegation.md`.** Delegates, the
   accountable person as a canonical id, classes, scopes, budgets, sample size, `expires:` (at most 90
   days). Guarded by CODEOWNERS with required code-owner review, the only file guard a public repository
   has, void while stage 1 holds. The answer to `operator-role.md`: the charter is declared and the gate
   says so; what carries evidence is the sample ledger, signed by a key only the maintainer holds and
   verified offline (decision 6). The gate prints « charter: declared, not proved; samples: signed by
   <key> (presence shown, reading declared) ». A renewal is shown as a diff against the last signed
   charter; any widening (new scope, smaller sample, shorter window) needs its own signed commit and
   cannot ride a renewal.

6. **One weekly signed act: sample, digest, acknowledgement.**
   - Population from git alone: first-parent merges on `main`, tags, ratification entries since the last
     signed sample; counts reconciled; population hash published.
   - Draw: fixed, stratified, risk-weighted, 5 acts plus 1 seeded defective item; randomness from a
     source fixed after the period closes that no agent can steer (a pre-announced drand round), never
     from the mission-state digest. The seed is committed as `H(seed, nonce)` before the sample and
     revealed after, so an auditor can re-perform the control.
   - One commit signed by the maintainer carries the sample outcome, the 100 % digest of shipped-code
     merges (decision 7) and, in stage 2, the authorization of that week's class I patches (decision 8).
     The gate verifies it offline against `allowedSigners`. This is the remaining human act and is named
     as such.
   - Missing the seed records `control missed`: the sample does not count. A rejected act suspends that
     class for that delegate. Seeds also measure the reviewer; its catch rate is a published counter.
   - In stage 1 the signing key is within agent reach: entries print « sample: declared human, not
     proved » and never unlock class I.

7. **The system comes to the maintainer; silence is never consent; escalation is deterministic.**
   - Push notifications for: sample ready, pre-merge escalation, charter expiring within 14 days, minor
     release ready. A delivery receipt is shown as « delivered, not read », is an agent's attestation
     when the operator-layer agent sends it, and is never consent.
   - Before merge, the maintainer's pre-approval: `src/lib/{conformance,evidence,verdict}*`,
     `src/commands/{wire,ratify,propose}.ts`, `src/lib/harness.ts`, `plugins/runward-gate/hooks/**`,
     `.github/**` (CODEOWNERS and workflows included), `package.json` (scripts, `prepublishOnly`,
     dependencies), lock opt-ins, `AGENTS.md`, `SECURITY.md`, README claims, the charter,
     `allowedSigners`; disagreement between agents; a check red then green on re-run; a ratchet drop;
     any `gate-bypass.log` line.
   - After merge, 100 %, in the weekly digest: every other merge touching a file in the published
     tarball (`package.json` `files`, `templates/`, `plugins/`). No patch release may contain one before
     a signed digest covers it.
   - One missed week: « unsampled since <date> » everywhere. Two missed periods: `check --strict` turns
     red on any class D act since the last signed sample, and agent ratifications stop counting.

8. **The release window, built on what was measured.** For a class I patch (stage 2), the prior
   authorization is the annotated tag `vX.Y.Z` signed by the maintainer's hardware key and pushed in the
   weekly session. The `v*` tag ruleset carries an admin-role bypass, so the maintainer can push it and
   the App cannot (T5; a no-bypass ruleset would refuse the maintainer too). ADR-0085's prepare run makes
   the draft; the App may then publish it (T2: the `published` event fires for its token). The `publish`
   job verifies the tag's signature against `allowedSigners` before `npm publish` and refuses otherwise,
   so the App key alone no longer reaches npm. Minor and major releases keep ADR-0085 decision 3 as is.

9. **Stop.** A repository variable or ruleset toggle only an administrator can change, read by a
   required check whose source is pinned to the GitHub Actions app; the escalation budget (3 consecutive
   refusals, 20 per period) is counted by that check, not by the agent. Revocation by uninstalling the
   App. Exercised on a schedule, result committed under signature. In stage 1 an agent holding the
   maintainer's credential can clear it; the surfaces say so.

10. **Public claims narrowed first** (ADR-0050 claims guard), before any delegation: `AGENTS.md:39` "The
    maintainer merges"; `GOVERNANCE.md` roles; `README.md:166` "publishing to npm is a deliberate human
    gesture (creating the Release)" and "The deterministic executes; the human decides the crossing. The
    discipline is demonstrated, not claimed." Added: one accountable person; agent ratifications and
    forge approvals are disclosed throughput, not independent approval; not a DORA change-approval
    control; the SLSA Source level once measured, the two-person level out of reach with one person.

**Implementation order.** (1) This ADR decided, including decision 4's option. (2) Claims narrowed
(decision 10). (3) CLI, each in its own pull request: canonical ids and the `agentCause()` fix,
`propose` recording the accountable person, `by:` bound to the committing identity, the charter reader
and its stage banner, the git-built population, the signed sample with commit-reveal. (4) The App
installed on runward from a 2FA web session, CODEOWNERS, the stop, Dependabot `cooldown`; class D on, in
stage 1, with its banner. (5) Stage 2: separate OS user, hardware key in `allowedSigners`, the App key
and the reviewer's key under separate custody, the `v*` tag ruleset with admin-role bypass, the tag
signature check in `publish`. (6) SLSA Source level measured; CRA scope determined. (7) Class I patches
after four consecutive weeks of hardware-signed samples with no `control missed`.

## Alternatives discarded

- **Keep the maintainer's hand on each act.** Measured as a login, not a gesture; bulk ratification left
  28 of 46 rows unseen.
- **Agents act under the maintainer's account (the status quo, never decided).** The attribution
  ADR-0082 forbids; it also voids every human control, since the human identity is within agent reach.
- **Wait for stage 2 before delegating anything.** Cleaner, and it keeps the attribution defect open
  for as long as the separate user and the hardware key take; stage 1 fixes attribution now and says it
  proves nothing.
- **Agent ratification without a sample (ADR-0082 as is).** No human measurement, and the free-string
  independence check reads independence where one person answers for both sides.
- **Sampling a share of acts (20 %).** At September's volume, 20 or more items a week at about 30
  seconds each: the rubber stamp it claims to prevent.
- **Silence windows for irreversible acts.** Counter to the cited OpenAI guidance; a delivery receipt
  does not show the notice was read.
- **An App review counted as independent approval.** T1 shows the forge would accept it; with one
  accountable person and, in stage 1, one custody for every key, it is one actor approving itself.
- **A no-bypass tag ruleset.** Measured to stop the maintainer as well (T5), which breaks ADR-0085
  decision 1.
- **A second human approver staged for appearance.** ADR-0080 Part 2 already refuses it.
- **Full automation including all releases and third-party security judgement.** Irreversible acts and
  duties owed to a reporter or a CSIRT need a human.
- **A machine user with a long-lived token instead of an App.** Allowed by the terms, but a long-lived
  secret; fallback only.
- **Pre-merge escalation of every shipped file.** About 60 of 96 September merges; the bottleneck
  restored. Replaced by pre-merge on gate-critical paths plus a 100 % weekly digest gating the patch
  envelope.

## Consequences

- **This is not a DORA change-approval control**, and runward does not present it as one. Under the
  regulated tier ADR-0080 Part 2 (forge approval by a human account) is unchanged for adopters; the
  single-accountable exception counts only when named in the lock and covered by a signed sample.
- **Stage 1 changes who the forge names, not what anyone can do.** Until stage 2, an agent can still act
  as the maintainer; the banner is the control, and it is a disclosure.
- The maintainer's recurring work: one signed weekly commit (6 items, the shipped-code digest, the patch
  tags in stage 2), pre-merge escalations on gate-critical paths, about four minor-release gestures a
  month, constitutional ADRs, quarterly renewal, third-party and CRA duties. Weekly minutes are not
  estimated; they are published after four weeks.
- Every delegated act is attributable to a named agent and a canonical accountable id; no surface
  presents an agent approval as a human one, nor the forge's approval as independent.
- The evidence changes meaning, and says so: "it matched a policy the maintainer signed, a second
  declared identity under the same accountable person validated it, and a weekly sample signed by the
  maintainer's hardware key passed a seeded control an auditor can re-perform".
- Adopters can use the charter, the signed sample and the disclosure in a default mission; under the
  regulated tier they gain nothing that relaxes ADR-0080 Part 2.
- Cost: a separate OS user for agents; a hardware key; an App and a reviewer under separate custody; a
  notification channel; CLI changes to `propose`, `ratify` and the conformance reader.
- Risk accepted: the charter is written by the audited party; it is declared, and the gate says so.
- No CLI change and no `runward/delegation.md` ship with this ADR.

## What would settle it

- **Measurements still missing, each on the lab repository first**: an App publishing a repository
  advisory and requesting a CVE (both write to public databases, so a dedicated test advisory is
  needed); a `v*` tag ruleset with an admin-role bypass refusing the App and admitting the maintainer;
  whether a CODEOWNERS required review is satisfied by an App; whether GitHub refuses an App approving a
  pull request the same App authored; disabling admin bypass on the `release` environment; npm trusted
  publishing bound to an environment; a `GITHUB_TOKEN` on `state=triage` (ADR-0084's open item);
  runward's SLSA Source level.
- **Stage 2 holding**: every commit on `main` after the cut-over attributable to the App or to an
  `allowedSigners` key, and the agents' OS user unable to read either App key.
- **Four weeks of class D with signed samples**: share of `control missed`, rejected acts, escalation
  volume, measured weekly minutes; the reviewer's catch rate on seeds.
- **The CRA scope determination**, before advisory publication enters class I.
- **Decision 4's option** chosen by the maintainer for runward's own lock.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-01-01, or earlier on: a sampled act rejected twice in one class; `control missed` twice
in a row; stage 1 still in force three months after acceptance; a second maintainer joining
(independence becomes possible); a supervisor statement on agents as the approving function under RTS
art. 17(1)(b); GitHub changing whether App reviews count toward required approvals, or taking Copilot
approval out of preview; the CRA scope determination concluding runward is in scope, or paid pilots
starting.

**Trigger set on**: 2026-10-01 · **Watched via**: the weekly signed sample (its rejections and
`control missed`), the stage banner on `check`, the GitHub changelog at each release's runbook step 2.

## References

- DORA, Regulation (EU) 2022/2554: https://eur-lex.europa.eu/eli/reg/2022/2554/oj (not fetched); read
  at https://www.digital-operational-resilience-act.com/Article_9.html (2026-10-01)
- Delegated Regulation (EU) 2024/1774: https://eur-lex.europa.eu/eli/reg_del/2024/1774/oj (not
  fetched); art. 17 read at https://www.springlex.eu/en/packages/dora/rts-rmf-regulation/article-17/
  (2026-10-01)
- AI Act art. 14, 26: https://artificialintelligenceact.eu/article/14/,
  https://artificialintelligenceact.eu/article/26/ (2026-10-01)
- Cyber Resilience Act (secondary only): https://www.cyberresilienceact.eu/reporting.html,
  https://zavodsky.org/en/intelligence/regulatory-radar/cyber-resilience-act-reporting-11-september-2026/
  (search results, 2026-10-01)
- NIST AI 100-1: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf (2026-10-01)
- SLSA v1.2 Source requirements: https://slsa.dev/spec/v1.2/source-requirements (2026-10-01)
- GitHub Terms of Service: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
  (2026-10-01)
- GITHUB_TOKEN: https://docs.github.com/en/actions/concepts/security/github_token (2026-10-01)
- Rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
  (2026-10-01)
- Copilot code review: https://docs.github.com/en/copilot/concepts/agents/code-review (2026-10-01)
- Copilot coding agent risks: https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations
  (2026-10-01)
- Prow approvers: https://docs.prow.k8s.io/docs/components/plugins/approve/approvers/ (2026-10-01)
- Chromium Rubber Stamper: https://chromium.googlesource.com/infra/infra/+/refs/heads/main/go/src/infra/appengine/rubber-stamper/README.md
  (2026-10-01)
- Apache lazy consensus: https://community.apache.org/committers/lazyConsensus.html (2026-10-01)
- Anthropic, Claude Code auto mode: https://www.anthropic.com/engineering/claude-code-auto-mode
  (2026-10-01)
- OpenAI, Practices for Governing Agentic AI Systems:
  https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf (2026-10-01)
- GitHub App permissions: https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
  (2026-10-01)
- npm trusted publishing: https://docs.npmjs.com/trusted-publishers (2026-10-01; environment binding
  not verified)
- Platform measurements: `github.com/stranxik/runward-delegation-lab`, App `runward-steward` (id
  5150097), T1 to T5, 2026-10-01.
