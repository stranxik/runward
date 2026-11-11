# ADR-0015: The in-memory store is the reference adapter of the store port, and a parity suite runs on PostgreSQL

**Date**: 2026-11-06
**Status**: accepted (2026-11-08), ratified on the author's delegation in chat ("ratifie pour moi", "ratify for me"), the session having recommended it; the author did not read this text again before delegating
**Deciders**: proposed by an agent session; Thibault Souris (author) decides.
**Method**: decision-loop

## Context

The application tests must run on the workstation (8 GB) without a database, and the PostgreSQL behaviour must not drift from them.

## Decision

`src/adapters/store/memory.js` implements the same port as `src/adapters/store/postgres.js`, with the same tables (`src/adapters/store/tables.js`), unique constraints, tenant filter, link dates and append-only journal. The application, HTTP and identity tests run on it locally; `test/pg/isolation.test.js` runs the application's paths on PostgreSQL (history, quarantine, removal and restore, export and replay), on the NAS and in CI. The service refuses `RW_STORE=memory` in production (`src/main.js#readConfig`); the local witness says it runs in memory.

## Alternatives discarded

- **PostgreSQL for every test**: every application test would need a database on the workstation
- **Mocks per test**: they drift from both adapters

## Consequences

- **Positive**: fast tests where they run, the same paths on the real database
- **Negative, accepted**: two adapters to keep in step
- **On other boundaries**: ADR-0006

## Reevaluation trigger (mandatory, dated)

Reopen when the PostgreSQL suite finds a behaviour the memory store does not have (one found and fixed on 2026-11-06: jsonb double encoding, on the PostgreSQL side).

**Trigger set on**: 2026-11-06 · **Watched via**: `test/pg/isolation.test.js`

## References

- PADR-0015 point 7 (the suite on the same image, R9)
