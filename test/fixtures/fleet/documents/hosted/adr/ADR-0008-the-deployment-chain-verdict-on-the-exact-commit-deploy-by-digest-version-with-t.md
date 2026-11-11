# ADR-0008: The deployment chain: verdict on the exact commit, deploy by digest, version with two digests, smoke, rollback, two targets

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0015 and its note. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0015 and its note at the boundary where the code applies it

## Context

A green workflow does not say what is served. The chain must make the production say it.

## Decision

`.github/workflows/ci.yml` runs the tests, the PostgreSQL suite, the runward-fleet verification, the workflow guards, the gate, the infrastructure validation for two targets (`infra/scaleway`, `infra/kubernetes`) and builds the OCI image at the commit, with a base pinned by digest, then runs it against PostgreSQL and a local S3 (`scripts/image-smoke.mjs`). `.github/workflows/deploy.yml` is written and OFF (`vars.RW_DEPLOY_ENABLED`): it deploys by digest only after the ci run of that commit is green, reads the served revision from the hoster's API (S5), waits for `/api/version`, smokes, sends through the real send workflow to the witness tenant, runs the isolation suite on the deployed base, and rolls back on any failure. `.github/workflows/rollback.yml` is the manual rollback. The runbook writes the procedure.

## Alternatives discarded

- **Deploying by tag**: what is served is no longer named by what was verified
- **Building on a workstation**: an image no CI has seen
- **One target**: portability only asserted

## Consequences

- **Positive**: each deploy can say what it serves and why; the rollback needs no judgement
- **Negative, accepted**: a deploy takes minutes; two descriptions to keep
- **On other boundaries**: ADR-0006 (isolation after deploy), ADR-0011 (probe)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first buyer who requires the qualified offer; a green deploy that serves another commit; a failed rollback.

**Trigger set on**: 2026-11-06 · **Watched via**: the deploy evidence, the runbook

## References

- PADR-0015 and its note; SLSA v1.0 Build; DORA research
