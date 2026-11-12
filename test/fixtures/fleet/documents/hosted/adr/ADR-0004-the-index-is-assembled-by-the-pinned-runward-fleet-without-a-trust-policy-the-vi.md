# ADR-0004: The index is assembled by the pinned runward-fleet without a trust policy; the view is imported as is

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0011 and its note. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0011 and its note at the boundary where the code applies it

## Context

One interface, two deployments (ADR-0121 of runward): the hosted product serves the same `index.json` and the same `views.js` as the static build. Nothing may be raised by the service.

## Decision

`src/adapters/fleet/assembler.js` is the anti-corruption layer: it writes `fleet.json` (`runward-fleet-manifest/0`) from the declared missions and the current uploads, calls `buildIndex` without `trustPolicy`, refuses an index that breaks `checkIndex` or that `renderPage` refuses, and lets back only bytes, digests and problems. The bytes are those `runward-fleet build` writes, so an export replays to the same digest (`scripts/replay-export.mjs`, tested in `test/unit/repositories.test.js` and on PostgreSQL). A failing upload is kept in quarantine and never freezes the fleet. The shell imports `views.js` from the package, served under its digest name (`src/http/assets.js#buildAssets`).

## Alternatives discarded

- **The CI of a fleet repository builds the index**: it gives the customer back the gathering work
- **The product builds the index with its own code**: two builders drift
- **Copying views.js**: a copy drifts

## Consequences

- **Positive**: one view tested once; S1 becomes checkable each day
- **Negative, accepted**: the hosted view never shows `machine-established`; a refused index leaves the previous one
- **On other boundaries**: ADR-0002 (the pin), ADR-0008 (each publication journaled with its versions and digests)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a customer asks to see cells its own runward-fleet raised; `runward-fleet-index/0` changes in a non-additive way; assembly in the request exceeds 10 s.

**Trigger set on**: 2026-11-06 · **Watched via**: the replay test, the S1 job

## References

- PADR-0011 and its note; ADR-0121 of runward
