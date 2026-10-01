---
charter: runward-delegation/1
stage: 1
accountable: github:<account>
aliases: [<login>, <name as written in ratifications>]
delegates:
  - <agent name, as `ratify --agent` records it>
  - <app-slug>[bot]
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

**Classes** (ADR-0088 decision 2). R, trust roots, and H, judgement owed to a third party, are the
accountable person's in every stage. I, irreversible public acts, is `refused` in stage 1. D, reversible
or internal acts, may be `delegated`.

**Window.** `expires:` is at most 90 days after `effective:`. The gate has no clock: an agent
ratification dated after `expires:` is a gap; `runward doctor` compares `expires:` with today's date and
warns 14 days ahead.

The full field reference is `docs/delegation-charter.md` in the runward package repository.
