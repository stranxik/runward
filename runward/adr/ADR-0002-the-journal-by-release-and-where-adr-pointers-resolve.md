# ADR-0002 — The journal is kept per release, and `adr:` pointers resolve mission first

**Date**: 2026-09-27
**Status**: accepted — decision taken by the maintainer on 2026-09-27 on the ratification dossier's recommendation; text drafted by the coding agent, accepted by the maintainer's review and merge
**Deciders**: the maintainer
**Method**: ratification preparation of 2026-09-27 (each decided manifest row re-read against its evidence)

## Context

ADR-0001 put the product's decision journal in `docs/adr/`, which holds. Two of its consequences no
longer describe the tree. It said the `adr:NNNN` pointer "resolves only against `runward/adr/`", so a
product decision had to be cited as a `file:` path; since product ADR-0074 (2026-09-12), `adr:` resolves
against `runward/adr/`, then `docs/adr/`, then `doc/adr/`, then `adr/`, first hit wins. And it said no
`deviated` row existed; this mission now records its first deviations (ADR-0003, ADR-0004). The
`process-adr-and-journal` rule also asks for a journal, and none was named: the counts quoted in the
deliverables (28, 32, 73 accepted ADRs) were each true on their date and are now wrong.

## Decision

This ADR replaces the first two consequences of ADR-0001; its decision stands.

1. `adr:NNNN` is the pointer for any decision. It resolves in `runward/adr/` first: a mission ADR
   shadows a product ADR of the same number, so a row citing a product decision whose number this
   directory also uses cites it as `file:docs/adr/ADR-NNNN-….md`.
2. The journal is `CHANGELOG.md`, one entry per release, linked to the ADRs and known defects it
   carries. It is a journal per release, not per working session: sessions leave commits and pull
   requests, which git keeps.
3. Deliverables do not quote a count of product ADRs. `docs/adr/` is the count.

## Alternatives discarded

- **A per-session journal file.** It would duplicate what commits and pull requests already record,
  and drift from them.
- **Rewrite ADR-0001.** An accepted ADR's decision is not rewritten; this one replaces the consequences
  that aged, as a dated amendment would.

## Consequences

- **Positive**: the manifests can cite product decisions as `adr:` pointers the gate resolves and
  status-checks.
- **Negative, accepted**: mission numbers 0002 to 0004 now shadow product ADR-0002 to ADR-0004 for
  `adr:`; the rule above says how to cite those.

## Reevaluation trigger (mandatory, dated)

Reopen if the product journal moves out of `docs/adr/`, if the `adr:` resolution order changes, or if a
second maintainer needs a journal between releases.

**Trigger set on**: 2026-09-27 · **Watched via**: product ADRs touching evidence resolution; a second maintainer joining.

## References

- ADR-0001 (this directory), product ADR-0074 (`docs/adr/ADR-0074-*.md`).
