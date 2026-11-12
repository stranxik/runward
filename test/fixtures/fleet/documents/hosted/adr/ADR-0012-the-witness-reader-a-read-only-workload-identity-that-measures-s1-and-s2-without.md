# ADR-0012: The witness reader: a read-only workload identity that measures S1 and S2 without a human gesture

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0020. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0020 at the boundary where the code applies it

## Context

S1 and S2 need a daily read of the export and of the served index, which are reserved to a member.

## Decision

The token of `stranxik/runward-hosted/.github/workflows/temoin.yml` on main, audience `https://app.runward.dev/read`, pinned by `job_workflow_ref` (and `repository_id` when configured), reads `GET /api/v0/reader/index` and `POST /api/v0/reader/export` for a fleet that authorized it under a per-gesture verification; every read is journaled (`src/application/operator.js#readerCases`). `scripts/witness-reader.mjs` replays and compares.

## Alternatives discarded

- **A long-lived read token**: a secret, contrary to ADR-0003
- **A human ceremony a day**: contrary to the zero-human-time objective

## Consequences

- **Positive**: S1, S2 and the watch on filtered uploads run alone
- **Negative, accepted**: one more identity to test in isolation
- **On other boundaries**: ADR-0006

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first third-party tenant; an agent's need to read (MCP).

**Trigger set on**: 2026-11-06 · **Watched via**: the reader's journal entries

## References

- PADR-0020
