# ADR-0003: An upload enters only with the OIDC token of the product's send workflow, called by SHA

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0010 and its note (7 bis to 7 sexies). Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0010 and its note (7 bis to 7 sexies) at the boundary where the code applies it

## Context

Each declared repository's CI sends what runward wrote. The service must know who sends without holding a secret of the customer, and an agent of the repository must not be able to send a file it wrote.

## Decision

The customer calls `stranxik/runward-hosted/.github/workflows/send.yml@<release sha>`. Its `check` job runs `runward check --strict --json` (never `--hooks`), writes under `$RUNNER_TEMP`, and uploads one artifact; its `send` job alone holds `id-token: write`, verifies the artifact's digest, and posts one fresh token per file; its `verdict` job gives the run runward's exit code. The service verifies the token (`src/adapters/oidc/github.js`: issuer pinned, audience `https://app.runward.dev`, RS256, 60 s skew, `jti` once) then, in this order, the generic claims (`event_name` push, `refs/heads/main`, `github-hosted`, `job_workflow_ref` and a published `job_workflow_sha`), the repository (by `repository_id`, or by name while pending), the calling workflow, the owner, the mission, the rate (30 runs an hour), the body (2 MB, RFC 9530 digest), the consent (`src/domain/workload.js`, `src/application/ingest.js#upload`). The current upload is the highest `run_number`, then `run_attempt`, within an order epoch.

## Alternatives discarded

- **An API token per repository**: a customer secret held by two parties
- **The CLI sends**: the CLI never knows the product
- **The product fetches the exports**: read access to the repository, therefore to the code

## Consequences

- **Positive**: no customer secret; an agent of the repository cannot supply the file; a refusal of runward rises in the CI
- **Negative, accepted**: GitHub only; the content stays `ci-declared`
- **On other boundaries**: ADR-0005 (assembly in the request), ADR-0008 (every upload in the journal)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first GitLab repository; GitHub changes its token format; a forged upload passes (incident); a first tenant who is not the maintainer.

**Trigger set on**: 2026-11-06 · **Watched via**: the refusal codes of the journal, `test/unit/ingest.test.js`, `scripts/check-workflows.mjs`

## References

- PADR-0010 and its note
- GitHub Docs, OpenID Connect with reusable workflows; RFC 8725; RFC 9530
