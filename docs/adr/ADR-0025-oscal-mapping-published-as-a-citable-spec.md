# ADR-0025: The OSCAL mapping published as a versioned, citable mini-spec

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — the audit's timing finding ("OSCAL-at-green is ahead of the standardization curve: be the implementation people cite, not the one standardized around"), challenge on overclaim, durable position

## Context

runward emits OSCAL at the gate: the *decision → ADR → conformance manifest → OSCAL component-definition* chain, with deterministic UUIDs, derivation rules for implementation-status, a versioned regime lens (ADR-0022) and an evidence seal (ADR-0021). The audit's point is about timing: gate-level, machine-readable audit evidence for agentic delivery has no reference practice yet. Whoever writes the referenceable document first becomes the citation; whoever waits gets standardized around. Today that mapping exists only as implementation (`renderOscal`) and scattered ADR prose — correct, tested byte-for-byte, and impossible to cite.

## Decision

1. **Publish the mapping as a mini-spec**: `docs/spec/runward-oscal-mapping.md`, version **1.0**, self-contained and implementation-independent — the document a GRC vendor, an auditor or another toolmaker can read without runward's source: the evidence chain, the component-definition shape, the ASI-controls-as-implemented-requirements structure, the implementation-status derivation rules (`planned` / `partial` / `implemented`), the deterministic UUID scheme (seed grammar included), the regime-lens stamp, the byte-identity conditions, and the `evidence-lock.json` v1 format.
2. **Version it like a port** (ADR-0011): additive within a major, breaking changes bump the major *and* keep the old text in place — a published spec is never rewritten under its readers.
3. **Make citation mechanical**: a `CITATION.cff` at the repository root (the spec and the tool citable in one gesture), and the spec linked from the README and the compliance docs.
4. **Anti-overclaim guardrails carried into the spec itself**: it describes *supporting evidence assembled at the gate*, states its own scope (never a compliance claim, never a certification), and the honest ingestion boundary (ADR-0022's dated evaluation).

## Alternatives discarded

- **Submit to a standards body instead.** Years-long, and the point is field citation now; a mini-spec can feed a standards process later — the reverse is not true.
- **Auto-generate the spec from the code.** Couples the document's stability to refactors; a spec's value is that it holds still while implementations move. It is checked against the golden test instead (the reference output *is* the conformance suite).
- **Keep it as ADR prose.** ADRs record decisions for maintainers; a citable spec addresses outsiders. Different reader, different document.

## Consequences

- **Positive.** "Feeds your GRC tool" gains a document to point at; third parties can implement or critique the mapping without reading TypeScript; the timing advantage becomes an artifact instead of a hope.
- **Negative, accepted.** A published spec is a commitment surface: the derivation rules and UUID scheme become hard to change casually (that is the point); spec/implementation drift becomes a new defect class — mitigated by citing the golden fixture as the normative example.
- **On other boundaries.** `docs/spec/` is born; `CITATION.cff` at the root; README and `docs/compliance/README.md` link the spec; the golden OSCAL fixture is promoted to normative example.

## Reevaluation trigger (mandatory, dated)

Reopen if the mapping needs a breaking change (major bump, old text preserved), or if an external standard emerges that covers this ground — then the spec's job becomes a documented crosswalk to it, not competition with it.

**Trigger set on**: 2026-07-16 · **Watched via**: external citations/issues referencing the spec, and the OSCAL/GRC standards landscape at each release review.

## References

- [ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md), [ADR-0022](ADR-0022-regime-mappings-as-versioned-data.md), [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — the implemented chain this specifies.
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the versioned-port discipline the spec inherits.
- `test/fixtures/golden/oscal-component-definition.json` — the normative example.
