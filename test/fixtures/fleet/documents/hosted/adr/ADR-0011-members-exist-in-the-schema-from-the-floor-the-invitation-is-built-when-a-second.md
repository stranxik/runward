# ADR-0011: Members exist in the schema from the floor; the invitation is built when a second human arrives

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0019. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0019 at the boundary where the code applies it

## Context

Taking the member model up later costs a migration of every table.

## Decision

`rw.member (tenant_id, id, role, founder, added_at, removed_at)` with role `owner`; authorisation reads the role, never the founder flag; the last owner cannot be removed (`src/domain/repository.js#checkMemberRemovable`). The link mechanism already handles the kind `invitation` (72 h). The invitation routes and screens are not built before their trigger, as the PADR decides; the Access screen says so in one line.

## Alternatives discarded

- **Magic link by e-mail**: a sending provider in the identity path
- **No member model in the floor**: a migration of every table later

## Consequences

- **Positive**: the second human needs neither provider nor migration
- **Negative, accepted**: the inviter carries the channel
- **On other boundaries**: ADR-0005

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a second human in a tenant.

**Trigger set on**: 2026-11-06 · **Watched via**: the member table

## References

- PADR-0019
