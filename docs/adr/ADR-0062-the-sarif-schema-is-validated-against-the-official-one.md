# ADR-0062: the SARIF emission is validated against the official schema, and that is worth one dev dependency

**Status**: accepted 2026-08-27
**Date**: 2026-08-27
**Closes**: the open decision recorded in RWD-2026-0072.

## Context

The 2026-08-26 audit found that **nothing checked the SARIF runward emits**. `test/fixtures/` vendors
a NIST OSCAL schema and an in-toto schema, and each emission is validated against its own; the SARIF
had no net at all. The auditor ran the missing one by hand — 22 mission states against the official
OASIS schema, all valid — so the emitter is well formed today, and nothing would have said if it
stopped being.

A structural net shipped the same day (`test/sarif-shape.js`) and was **recorded as not being schema
validation**, because it is not: it checks the invariants a consumer relies on, not conformance.
Claiming otherwise would have been the exact overstatement the audit spent itself correcting.

The obstacle was mechanical. The OASIS SARIF 2.1.0 schema is **draft-04**; ajv 8 dropped draft-04
(`id` rather than `$id`, boolean `exclusiveMinimum`) and refuses to compile it. Full validation needs
`ajv-draft-04`. On a project that ships an attested CycloneDX SBOM on every release, adding a
dependency is not a detail, so it was left as an operator decision rather than taken silently.

## Decision

**Add `ajv-draft-04` as a dev dependency and validate the emitted SARIF against the vendored official
OASIS schema, on four mission states.**

What makes the trade a small one, checked rather than assumed:

- **Same maintainer, already trusted here.** `ajv-draft-04` is published by the `ajv-validator`
  organisation — the same one that publishes `ajv` and `ajv-formats`, **both already dev
  dependencies of this project**. The marginal trust surface is one package from a maintainer whose
  code already runs in this test suite.
- **Dev-only, never shipped.** It appears in `devDependencies`; the published package's runtime
  dependencies remain `@inquirer/prompts`, `chalk`, `commander`.
- **Offline.** The schema is vendored at `test/fixtures/sarif_schema.v2.1.0.json` with its source
  URL, vendoring date, `$id` and sha256 recorded in `test/fixtures/README.md`, exactly as the OSCAL
  and in-toto schemas are. The network-isolated CI leg is unaffected.
- **It detects.** Verified before adoption, not after: the real emission validates; a wrong
  `version`, a missing `runs`, and a `level` outside the SARIF enumeration are each refused.

**The structural checks stay, and are not redundant.** A schema cannot say that an
`artifactLocation.uri` RESOLVES in the checkout — RWD-2026-0041 shipped uris that no checkout held,
and every one of them was schema-valid. Nor that two runs on an unchanged tree are byte-identical.
Conformance and truthfulness are different questions; this file now asks both.

## Consequences

- **Positive.** The three emissions with a published schema are now each held to it. The gap the
  audit named is closed as a gap rather than narrated as a limitation.
- **Negative.** One more dev dependency, and one more vendored third-party artifact to refresh when
  OASIS revises the schema. The refresh procedure is in `test/fixtures/README.md` beside the others.
- **Accepted.** A schema is a floor, not a proof: a document can be perfectly conformant and still
  say something false about the tree. That is why the structural half exists.

## Reevaluation trigger

**Trigger set on**: 2027-02-27.

The decision is wrong and must be revisited if: `ajv-draft-04` stops being maintained by the
`ajv-validator` organisation (the whole basis of the trade); or OASIS publishes a SARIF revision in a
draft ajv supports natively, which would make the dependency removable; or the vendored schema starts
refusing an emission that consumers accept, which would mean the schema, not the emitter, is the
thing out of date.

**Watched via**: `test/sarif-shape.js`, `.github/dependabot.yml`, and the SBOM drift job.
