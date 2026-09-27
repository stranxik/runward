# ADR-0080 — The regulated tier: the repository disciplines, the forge proves

**Date**: 2026-09-26
**Status**: accepted 2026-09-26 — direction chosen by the maintainer after an investigation of what runward already has, what regulated organisations are asked for, and what their forges already enforce; the delivery criteria are below
**Deciders**: the maintainer
**Method**: measured on runward 0.42.2 and its example mission; public texts and platform documentation read at the source

## Context

Regulated organisations are the users runward expects to serve most, and they are asked for one thing
runward does not yet address: that whoever approves a change is independent of whoever implements it.
The delegated regulation (EU) 2024/1774 under DORA, art. 17(1)(b), requires « mechanisms to ensure the
independence of the functions that approve changes and the functions responsible for requesting and
implementing those changes ». It names an outcome, not a mechanism: BaFin's DORA guidance notes (June
2024, §5.3) say the provision « does not describe or require the implementation of a concrete
process » (a non-binding translation of a non-binding text). The IIA's sample audit program (GTAG *IT
Change Management*, 3rd ed., appendix F) states the control as: « At a minimum, separate people/groups
perform the responsibilities for change approval and implementation. » None of these texts mentions
coding agents.

**The forges have already answered the agent question.** GitHub, of its cloud agent: it « prevents the
user who asked Copilot cloud agent to create a pull request from approving it », and « if your repository
requires pull request approvals, your approval of a Copilot pull request won't count toward the required
number ». GitLab (Duo Agent Platform, composite identity): « From a compliance perspective, prompting an
AI system to write code is equivalent to writing the code yourself. » Both attribute agent work to the
person who launched it; where approvals are required and configured, that person's approval does not
count. Neither is automatic: a repository that requires no approval enforces nothing, GitLab lets
committers approve by default, and since 2026-09-01 an administrator can let a Copilot review count as an
approval.

**What runward has, measured.** Ratification (ADR-0066) records a trace per deliverable; it is disclosed,
never required: runward's own mission and the example each carry 46 decided manifest rows, none with a ratification
trace (`check --strict --json`: `untraced: 46`). The trace
is declared provenance, and weaker than its non-scope said until RWD-2026-0119: a `### Ratification` block typed by hand,
or `ratify` driven by a script through a pseudo-terminal, produces a line-by-line trace with no person at
the keyboard (RWD-2026-0119). The trace is keyed by rule slug only, so a row rewritten after its
ratification stays « traced ». And the one opt-in that moves the verdict today is `structureContract`
(ADR-0069).

**The first design was rejected by the maintainer, for the reason this project already wrote down.** It
declared roles in the repository (implementer, approver) and refused self-approval between the
declarations. `docs/operator-role.md` refuses exactly that: a « validated by » field in a mission artifact
« would be re-signable by whoever writes the artifact — declarative, worth nothing to an assessor ». The
maintainer's objection, in substance: anyone can write anyone's name; a declaration has no legal weight.
What carries weight is an account the organisation controls or links to its single sign-on, and the
approval record the forge keeps.

## Decision

**A regulated tier, one opt-in, two parts of different natures, each saying what it proves.**

The mission declares `"regulated": true` in `runward/scaffold-lock.json`, like `structureContract`
(ADR-0069): a committed line, disarmed by a readable diff, preserved by `update` (which today rebuilds the
lock and would drop an unknown key: the preservation is part of the delivery), never written by runward
on its own.

**Part 1 — in the repository: ratification required, as a discipline of process.** Under the tier and
`--strict`:
- a decided row with no ratification trace is a strict gap, named, in the terminal, the JSON, the SARIF
  and the attestation, and re-derived by `verify`;
- a trace binds to the row it ratified: `ratify` records a digest of the row's status and evidence, and a
  row whose content no longer matches its digest counts as unratified;
- `ratify` gains a path for a row already decided by hand (today it lists only `proposed` rows), so the
  existing rows can be ratified at all;
- a `BLIND` ratification is a gap under the tier, and is printed in the terminal (ADR-0066 decision 4
  asked every later check to disclose it; the terminal does not yet);
- the penalty enters `strictGaps` in `computeVerdict` as its own `strictBreakdown` term (not the existing
  `unratified`, which counts ADRs), so `verdictFrom` (ADR-0047) stays the one definition of clean.

It proves that every decided row carries a ratification record bound to its current content. It does not
prove that the gesture was made, who made it, or that a person did: a record can be written by a script
as well as by `ratify`, and the non-scope says so (RWD-2026-0119).

**Part 2 — on the forge: the approval, read where accounts are controlled.** runward ships an optional CI
step, GitHub Actions first, separate from `check` so the verdict path stays without network and without
git (ADR-0054). Triggered on review and merge-queue events, with the forge's token, it requires at least
one approval, on the head commit, by a human account (not a bot or an app) different from the pull
request's author, from every author, committer and `Co-authored-by` co-author of its commits, and from the
account that requested an agent's work where the forge records it. (Copilot's cloud agent authors its
commits itself and names the requesting developer only as co-author: the author and committer fields
alone would miss them.) It fails closed: no token, an API error or no qualifying approval is a refusal.
It writes the head commit, the accounts, the review identifiers and the digest of runward's own
attestation, and the CI signs that as a separate artifact attestation: two attestations naming the same
commit, not one carrying the other.

The step only proves anything if the implementer cannot remove it in the change under review: it is meant
to be a required status check set by the organisation (a ruleset outside the repository), and its
documentation says so first. Locally no forge answers; under the tier, `check` prints « forge approval:
not verified by this command » and counts nothing for it either way.

It proves what the forge recorded about accounts the organisation controls. It does not prove that an
account is used by the person it names, nor anything the forge's own configuration allows around it
(administrator bypass, a bypass actor, a bot review allowed to count): the step reports the rules its
token can read, and the forge's audit log remains the record of overrides.

**runward itself.** Part 1 applies: the maintainer ratifies runward's 46 rows himself, and runward's own
lock carries the flag. Part 2 does not apply to a project with one maintainer, and runward says so in its
mission rather than staging a second approver whose approval would mean nothing.

## Alternatives discarded

- **Declared roles in the repository.** The first design, rejected: a declaration anyone can type,
  refused by `operator-role.md` for that reason.
- **Read the git author in the verdict.** Refused by ADR-0054: the author field is itself configurable
  and unsigned, and the verdict would depend on history rather than on the tree.
- **runward holds keys and signs approvals.** Refused by ADR-0054 and ADR-0021: runward holds no key.
  The signature of part 2 is the organisation's CI identity.
- **Require ratification by default.** The example and runward would go red on their first command
  (46 rows each), the case ADR-0073 refused for the evidence natures. It stays an opt-in.

## Consequences

- **Positive.** A regulated organisation gets, in its CI, the approval evidence its auditor samples, next
  to the decisions and evidence runward already verifies, both signed and naming the same commit. With the
  ADR-0079 summary, this can contribute to the test, validation and record-keeping procedures that AI Act
  art. 17(1)(d) and (k) require of a provider of a high-risk AI system; runward is not a quality
  management system and does not by itself satisfy art. 17.
- **Negative, accepted.** Part 2 is forge-specific: GitHub first, GitLab when a user asks. Part 1 costs the
  operator a ratification per decided row; that cost is the discipline.
- **On other boundaries.** No network, key or git read in the verdict path. The flag is additive; missions
  without it are untouched.

## Delivery criteria

1. Part 1 ships with `verify` re-deriving the new gap, the row digest pinned in both directions (a changed
   row loses its trace; an unchanged one keeps it), a record with no digest refused under the tier, `BLIND`
   printed in the terminal, `ratify` able to ratify a hand-decided row, and `update` preserving `regulated`
   (pinned by a test).
2. runward's own mission carries the flag and passes, its rows ratified by the maintainer.
3. Part 2 ships as a documented GitHub Actions step, tested against recorded API responses, and refuses in
   each wrong case: approved by the pull request's author, by a commit author, by a `Co-authored-by`
   co-author, by the agent's requester, by a bot; approved on an earlier commit than the head; no review;
   no token or an API error. Its documentation starts with the organisation ruleset that makes it
   required.

## Reevaluation trigger (mandatory, dated)

Reopen if a supervisor or an assessor states which evidence of independence it accepts for agent-written
changes, if a forge changes its attribution of agent work, or if a user of the tier reports that the
ratification cost made them ratify in bulk without reading (the discipline failing as discipline).

**Trigger set on**: 2026-09-26 · **Watched via**: the pilot protocol's questionnaire, forge changelogs, and
the ratification ledger on runward's own mission

## References

- [ADR-0066](ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md) — ratification, and its amendment (RWD-2026-0119).
- [ADR-0069](ADR-0069-the-structure-contract-is-the-default-for-new-missions.md) — the opt-in shape reused.
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — why part 2 stays outside the verdict path.
- [ADR-0073](ADR-0073-how-a-report-becomes-citable-evidence.md) — why a default that reds the example is refused.
- [ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md) — the other signed evidence a release now keeps.
- `docs/operator-role.md` — the doctrine this decision keeps.
