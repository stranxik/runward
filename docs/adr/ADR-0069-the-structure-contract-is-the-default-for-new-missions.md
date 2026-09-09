# ADR-0069 — The structure contract is the default for new missions

**Date**: 2026-09-09
**Status**: accepted 2026-09-09 (the maintainer's explicit call, made on the question the M1
machinery left open as D3)
**Deciders**: the maintainer
**Method**: decided on the consolidated pass's calibration evidence

## Context

M1 through M4 built the structure contract — typed fields, closed domains, row coherence,
cross-file echoes on all 11 mission templates — and left it inert behind the scaffold-lock's
`structureContract: true`, with the default for NEW missions explicitly reserved to the
maintainer (D3). The consolidated mutation pass then paid for the calibration three ways: the raw
template yields zero noise, the shipped example yields zero violations, and the generic
reverse-fill is refused. The cost of arming a fresh mission is therefore measured, and it is
nothing until the operator writes something malformed — at which point the named detail (repaired
in RWD-2026-0105) tells them exactly what to fix.

## Decision

1. `runward init` writes `structureContract: true` into the scaffold-lock of a NEW mission.
2. No existing mission moves: `update` PRESERVES whatever the lock says — it never writes the
   flag on its own. (Making that true fixed RWD-2026-0106: the lock writer rebuilt the object
   wholesale and a refresh silently disarmed every opted-in mission.)
3. Disarming stays one honest edit away: delete the line from the committed lock, in a diff a
   reviewer can read.

## Consequences

Positive: the promise the templates make is real for every newcomer, not just for whoever finds
the flag. Negative, accepted: a new mission whose operator writes a malformed field sees the gate
say so — which is the product working, and the detail names the fix.

## Reevaluation trigger (mandatory, dated)

A pilot operator reports the armed default as the reason they abandoned a fresh mission, or the
structure contract's false-positive register (violations on content later judged legitimate)
gains three entries. **Trigger set on**: 2026-09-09 · **Watched via**: pilot feedback (ADR-0052)
and the defect register.
