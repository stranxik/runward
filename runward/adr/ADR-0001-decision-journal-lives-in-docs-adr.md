# ADR-0001 — The product's decision journal lives in docs/adr/

**Status**: accepted · **Date**: 2026-07-16

## Context

runward's structural decisions have been recorded since the first release in `docs/adr/` — 28 accepted ADRs at the time of writing (ADR-0001 deterministic gate, ADR-0012 gate-as-a-port with inert adapters, ADR-0019/0020/0021 typed evidence, signatures and sealing, ADR-0022/0023/0024 regime data, manifest sync and the machine rule surface, among others). That journal predates this mission directory, is linked from the README and the changelog, and is where contributors already look. Duplicating or moving it into `runward/adr/` would fork the record.

## Decision

The authoritative decision journal for the runward product stays in `docs/adr/`. `runward/adr/` holds only mission-level records — this bridge, and any future decision about the mission artifacts themselves.

## Consequences

- Mission deliverables cite product decisions as `file:docs/adr/ADR-XXXX-<slug>.md` (a typed pointer the gate resolves from the project root). The `adr:NNNN` pointer form is **not** used for product decisions, because it resolves only against `runward/adr/`.
- A manifest row with status `deviated` must reference an ADR that exists in `runward/adr/` — so a deviation justified by a product ADR needs a mission-level ADR here that cites it. None exists today; every row is honestly `applied` or `n/a`.
- The gate's ADR count for this mission reads low by design; the real journal depth is in `docs/adr/`.

## Reevaluation trigger

Reopen if the mission grows decisions of its own (e.g. a deviation from a shipped rule) — record them here as ADR-0002 onward; or if the product journal ever moves out of `docs/adr/` — supersede this ADR rather than editing it.

**Trigger set on**: 2026-07-16 · **Watched via**: a `deviated` manifest row needing a mission-level ADR; a move of the product journal.
