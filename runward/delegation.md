---
charter: runward-delegation/1
stage: 1
accountable: github:stranxik
aliases: [stranxik, Thibault Souris, thibaultsouris]
delegates:
  - runward-steward[bot]
  - claude
class-R: maintainer
class-H: maintainer
class-I: refused
class-D: delegated
scope-D:
  - merges outside the pre-merge list
  - agent ratification of manifest rows
  - non-constitutional ADRs
  - Dependabot merges (with cooldown)
  - defect-register entries
  - documentation syncs
  - advisory drafts by the App (never by the GITHUB_TOKEN)
  - golden regeneration
budget-consecutive-refusals: 3
budget-refusals-per-period: 20
sample-size: 5
sample-seeds: 1
sample-period-days: 7
effective: 2026-10-02
expires: 2026-12-31
pre-merge-paths:
  - src/lib/conformance*
  - src/lib/evidence*
  - src/lib/verdict*
  - src/commands/wire.ts
  - src/commands/ratify.ts
  - src/commands/propose.ts
  - src/lib/harness.ts
  - plugins/runward-gate/hooks/**
  - .github/**
  - package.json
  - runward/scaffold-lock.json
  - AGENTS.md
  - SECURITY.md
  - README.md
  - runward/delegation.md
  - allowedSigners
pre-merge-events:
  - lock opt-ins (regulated, agentRatification, identities, singleAccountable, structureContract)
  - README claims
  - disagreement between agents
  - a check red then green on re-run
  - a ratchet drop
  - any gate-bypass.log line
---

# runward's delegation charter

The policy under which agents act for runward's maintainer, read by `runward check`
([ADR-0088](../docs/adr/ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)).

**Stage 1.** « delegation: declared, not proved — the maintainer's credential is within agent reach ».
« charter: declared, not proved ». Delegated acts run under the `runward-steward` App and the agents
named above, and the maintainer's credential and the App key are still within agent reach: this charter
adds attribution, not protection.

**Classes.** R (trust roots: this charter, forge and admin settings, `allowedSigners`, lock opt-ins,
arming the gate, constitutional ADRs) and H (judgement owed to a third party: a reported vulnerability,
its acknowledgement, a CVE request, embargo coordination) are the maintainer's. I (irreversible public
acts: releases, advisory publication) is refused in stage 1; releases and advisories stay as ADR-0085
and ADR-0084 decide them. D (reversible or internal acts, listed in `scope-D`) is delegated.

**Pre-merge.** A change to a path in `pre-merge-paths`, or one of the `pre-merge-events`, waits for the
maintainer before merge (ADR-0088 decision 7). Every other merge touching a file in the published
tarball is listed in the weekly digest once the signed sample exists.

**Window.** In force from 2026-10-02 to 2026-12-31 (90 days). Renewing, widening or revoking it is the
maintainer's act, in its own commit.
