# ADR-0009: Consent to content per repository, empty box; retention while declared then 30 days; erasure keeps digests

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0017. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0017 at the boundary where the code applies it

## Context

PADR-0002 sends digests by default; the floor needs content, as a dated derogation for the maintainer's own repositories.

## Decision

Consent is per repository, unchecked by default, given or withdrawn under a per-gesture verification, journaled; without it every upload is refused `content-not-consented` and the bytes of a pending repository's first upload are not kept (its claims are). Withdrawal offers to erase what was received. Bytes stay while the repository is declared, then 30 days (the daily `retention` job). Erasure removes the bytes, rebuilds the index, and writes an entry that keeps the digests. Objects are addressed by content with a reference count; the bucket has no versioning; backups 7 days; a prepared archive lives 24 h and follows erasure.

## Alternatives discarded

- **Keep everything**: contrary to PADR-0009 §4
- **A pre-ticked box**: not consent (CJEU, Planet49)

## Consequences

- **Positive**: the erasure promised is executed
- **Negative, accepted**: S1 does not cover an erased repository; `replay.json` says which index no longer replays
- **On other boundaries**: ADR-0007 (the journal keeps digests)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first third-party tenant; the lawyer's opinion; a hoster that imposes versioning.

**Trigger set on**: 2026-11-06 · **Watched via**: the retention job's report

## References

- PADR-0017; GDPR art. 5 and 17
