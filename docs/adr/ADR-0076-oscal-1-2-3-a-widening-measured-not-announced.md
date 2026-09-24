# ADR-0076: OSCAL 1.2.3, a widening measured rather than announced

**Date**: 2026-09-24
**Status**: accepted 2026-09-24 — the maintainer asked for the watch's findings to be handled; the bump is the policy ADR-0032 already ratified ("track the current OSCAL release"), applied once more with its proof
**Deciders**: the maintainer
**Method**: measured before decided — the NIST schemas diffed, the emitted pack validated against both versions, and ingested by the third-party tool the CI uses

## Context

The `watch external facts` workflow (ADR-0032) reported that NIST shipped OSCAL **1.2.3** on
2026-08-07 while runward still stamps **1.2.2**. ADR-0032 decided that runward tracks the current
OSCAL release and that every bump is traced; this is that trace.

The release notes describe a patch of **build tooling only**: dependency bumps, CI actions, a
security note for the resolver pipeline. Taken at their word, the bump would be a version string.
It is not quite, and that is why the schema was diffed instead of the notes read.

Measured on the official component-definition schemas downloaded from the two releases, sorted
canonically (`jq -S`) and compared: **11 changed lines**, and only two kinds of change —

1. the schema `$id` (`…/oscal/1.2.2/…` → `…/oscal/1.2.3/…`);
2. the component `type` enumeration **gains four values**, `region`, `zone`,
   `resource-container` and `network`, in the two places it is declared.

Nothing is removed, renamed or tightened. The vendored 1.2.2 fixture was confirmed byte-identical
to NIST's 1.2.2 asset before being replaced, so the comparison is against what runward actually
validated with.

## Decision

**Bump the pin to 1.2.3.** One constant (`OSCAL_VERSION` in `src/lib/compliance.ts`), the
vendored schema (`test/fixtures/oscal_component_schema.v1.2.3.json`, sha256
`95e76881151ececd5cb1a93ff0f70ad74b8cc1aa58771626ac8b262bf2c8e001`), the two tests that name the
version, the golden, and the documents that state it.

What made it safe, each measured on this tree:

- **The output changes by one field.** The golden regenerates with a single-line diff,
  `"oscal-version": "1.2.2"` → `"1.2.3"`. No UUID moves: the deterministic seeds do not include
  the OSCAL version.
- **The pack validates against both schemas.** A 1.2.3-stamped pack is valid against the 1.2.3
  schema and still valid against 1.2.2, because the version is a patterned string, not a constant,
  and the only schema change is a widening runward does not use (it emits `type: software`, a value both
  versions accept).
- **The third-party ingester still reads it.** IBM compliance-trestle 4.2.0, the version the CI
  pins, ingests the 1.2.3-stamped pack: 1 component, 10 implemented requirements. And the ingest
  script still refuses a pack stamped with the wrong version (a 1.2.2-stamped copy exits 1), so the
  proof is not a check that cannot fail.

**The published spec moves from 1.0 to 1.1.** `docs/spec/runward-oscal-mapping.md` declares
itself "additive within 1.x", and its normative example is the golden, which changed. The change is
additive by the spec's own measure — an output conforming to 1.1 still validates against the schema
1.0 named — so it is a minor bump, and the 1.0 wording is recorded in the version line rather than
erased.

## Alternatives discarded

- **Stay on 1.2.2.** Legal, and it would silence the watch. It is exactly the drift ADR-0032 was
  written against: a pin that stops being current while every test stays green.
- **Bump the string only, keep the 1.2.2 fixture.** The export would claim 1.2.3 while being
  validated against 1.2.2. The claim and its proof would name different documents.

## Consequences

- The watch's OSCAL finding clears on its next run.
- `docs/adr/ADR-0032-…` keeps saying 1.2.2: it records what was true on 2026-07-17 and is not
  rewritten.
- A consumer that hard-codes `oscal-version == "1.2.2"` sees a new value. None is known; the spec's
  conformance rule never asked for a literal.

## What would settle it

Nothing is left open. If NIST publishes a 1.2.x that removes or tightens a definition runward emits,
the same measurement (schema diff, dual validation, trestle) fails loudly, and that bump becomes a
real decision rather than a trace.

## Reevaluation trigger (mandatory, dated)

The watch reports a newer OSCAL release, or trestle's pinned version stops ingesting the pack.

**Trigger set on**: 2026-09-24 · **Watched via**: the `watch external facts` workflow (ADR-0032)
and the CI job `OSCAL ingested by a third-party tool (compliance-trestle)`
