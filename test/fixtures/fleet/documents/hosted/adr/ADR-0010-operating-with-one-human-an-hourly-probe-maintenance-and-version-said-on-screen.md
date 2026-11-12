# ADR-0010: Operating with one human: an hourly probe, maintenance and version said on screen, operator jobs in the private network, a restore drill

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0018. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0018 at the boundary where the code applies it

## Context

One human, a container at scale zero, no alert but the bill.

## Decision

`.github/workflows/probe.yml` reads `/api/health` and `/api/version` every hour (off until deployed), opens an issue after two failures and closes it on return, watches the certificate and its own disabling. Maintenance is a field of `/api/health`, a banner, and 503 `maintenance` on writes. Operator gestures run as `node src/operator.js <gesture>` inside the hoster's network, started by approved workflows of the private operator repository; daily jobs (retention, chain verification) are scheduled at the hoster. A restore is drilled once before the floor is declared.

## Alternatives discarded

- **A probe every 5 minutes**: keeps the container awake
- **A third-party monitor**: a dependency outside the Union

## Consequences

- **Positive**: an outage warns within the hour
- **Negative, accepted**: up to an hour without warning
- **On other boundaries**: ADR-0007 (restore replay)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first third-party tenant (a public status page); an outage of more than an hour not seen; a bill where the probe costs more than 1 EUR.

**Trigger set on**: 2026-11-06 · **Watched via**: the probe's issues, the drill's report

## References

- PADR-0018
