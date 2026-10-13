---
charter: runward-delegation/1
stage: 1
accountable: <forge>:<account>
aliases: [<login>, <name as written in ratifications>]
delegates:
  - <agent name, as `ratify --agent` records it>
  - <the App or bot account the agents push with>
class-R: maintainer
class-H: maintainer
class-I: refused
class-D: delegated
scope-D:
  - merges outside the pre-merge list
  - agent ratification of manifest rows
  - non-constitutional ADRs
  - documentation syncs
budget-consecutive-refusals: 3
budget-refusals-per-period: 20
sample-size: 5
sample-seeds: 1
sample-period-days: 7
effective: YYYY-MM-DD
expires: YYYY-MM-DD
pre-merge-paths:
  - runward/delegation.md
  - AGENTS.md
  - .github/**
  - .gitlab-ci.yml
  - .gitlab/**
pre-merge-events:
  - disagreement between agents
  - a check red then green on re-run
---

# Delegation charter

The policy under which agents act for the accountable person named above
([runward ADR-0088](https://github.com/stranxik/runward/blob/main/docs/adr/ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)).
Copy this file to `runward/delegation.md` and fill every field: `runward init` and `runward wire` never
write it, because signing, renewing, widening and revoking the charter are the accountable person's own
acts (class R). A placeholder left in a field is a named gap under `runward check --strict`.

**What it is worth.** It is written by the party it governs, so the gate prints, on every surface that
reads it, « delegation: declared, not proved — the maintainer's credential is within agent reach » and
« charter: declared, not proved ». In stage 1 it adds attribution, not protection.

**Accountable id.** A canonical id the forge gives the person: `github:<account>` or `gitlab:<account>`
(the numeric user id, or the username, of GitLab.com or of your own instance). runward never resolves
it; it compares it, folded, with the names ratifications carry. A delegate is the agent's own identity:
on GitHub an App's `<app-slug>[bot]`, on GitLab a project or group access token's bot user. Keep
the pre-merge paths of the forge you do not use: they cost nothing.

**Classes** (ADR-0088 decision 2). R, trust roots, and H, judgement owed to a third party, are the
accountable person's in every stage. I, irreversible public acts, is `refused` in stage 1. D, reversible
or internal acts, may be `delegated`.

**Window.** `expires:` is at most 90 days after `effective:`. The gate has no clock: an agent
ratification dated after `expires:` is a gap; `runward doctor` compares `expires:` with today's date and
warns 14 days ahead.

The full field reference is `docs/delegation-charter.md` in the runward package repository.
