# ADR-0007: The journal is append only, chained over a canonical encoding; the security log is doubled in the object store

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0014 and its note. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0014 and its note at the boundary where the code applies it

## Context

A journal is chained from its first entry or never. A restore of the database must not resurrect withdrawn accesses.

## Decision

One journal per tenant (`rw.ledger`): `rw_app` has INSERT and SELECT only, triggers refuse UPDATE, DELETE and TRUNCATE. Each entry carries `seq`, the previous hash and its own, over runward's witness encoding (`src/domain/ledger.js#canonical`); dates carry their source (service clock, declared; token; export). Each 201 answer carries `seq`, the head and `indexSha256`, which the send job writes in the job summary, an annotation and an artifact: an anchor outside the service. Every access gesture writes an object under `tenants/<uuid>/security/<ulid>.json` before the database commits; a failing write fails the gesture (`src/application/context.js#security`). After a restore, `node src/operator.js restore-replay` closes every session and replays the gestures in ULID order.

## Alternatives discarded

- **The full vault of PADR-0009 now**: a service key and a key manager for one reader
- **A journal without chaining**: it never catches up
- **Object Lock on exports**: it contradicts erasure

## Consequences

- **Positive**: the audit reads from the first upload; a future signature lands on an existing chain
- **Negative, accepted**: without published heads, only the anchors in job summaries show a truncation
- **On other boundaries**: ADR-0010 (erasure keeps digests)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first third-party tenant; the legal entity registered; a buyer asks for qualified timestamps; an integrity incident.

**Trigger set on**: 2026-11-06 · **Watched via**: the daily `verify-chains` job; `test/unit/domain.test.js`

## References

- PADR-0014 and its note; RFC 9162; Crosby and Wallach (2009)
