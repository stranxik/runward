# ADR-0006: Tenant isolation by forced row level security, proven with two real tenants; exact-key resolution

**Date**: 2026-11-06
**Status**: accepted
**Deciders**: Thibault Souris (author), ratified as PADR-0013 and its note. Written by an agent session.
**Method**: decision-loop; this mission ADR restates the ratified product decision PADR-0013 and its note at the boundary where the code applies it

## Context

The schema decides isolation before the first table. Point 1 bis lists resolution tables (repository by forge id, credential, session, link) reachable only through SECURITY DEFINER functions by exact key.

## Decision

Every tenant table carries `tenant_id` defaulted from `app.tenant` (set with `set_config(..., true)` per transaction), with RLS enabled and forced, USING and WITH CHECK on `rw_tenant()`. Reading of point 1 bis, written as such: the resolution tables are tenant tables too (they carry the tenant and its RLS), and the cross-tenant lookup is a SECURITY DEFINER function owned by `rw_resolve`, by exact key; the policies let `rw_resolve` read, never write. The tables with no tenant (challenges, token ids, counters, the operator's journal) grant nothing to `rw_app`. Roles: `rw_owner` (migrations), `rw_app` (no BYPASSRLS, no DELETE, no journal UPDATE), `rw_maint` (the hoster's jobs), `rw_resolve` (no login). Proof: `test/pg/isolation.test.js` makes two tenants through the application under `rw_app` and finds 0 row crossing both ways, checks the catalog, and fails on two planted twins (RLS disabled, USING (true)); `scripts/isolation-deployed.mjs` repeats it on the deployed base after each deploy.

## Alternatives discarded

- **A schema or database per tenant**: migrations and cost multiplied for one maintainer
- **Filtering in code only**: one forgotten clause suffices
- **BYPASSRLS for the resolver**: a managed PostgreSQL may refuse to grant it; the policy clause is portable

## Consequences

- **Positive**: defence in depth from the first table; the isolation proof is an artefact of every deploy
- **Negative, accepted**: the definer functions are the most sensitive piece; one S3 key for every tenant
- **On other boundaries**: ADR-0005 (session sets the tenant), ADR-0003 (the token's repository sets it)

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-02-06, or earlier: a first third-party tenant (a key per tenant); a leak found; a qualified target that imposes a database per tenant.

**Trigger set on**: 2026-11-06 · **Watched via**: `test/pg/isolation.test.js`, `scripts/isolation-deployed.mjs`

## References

- PADR-0013 and its note; PostgreSQL, Row Security Policies
