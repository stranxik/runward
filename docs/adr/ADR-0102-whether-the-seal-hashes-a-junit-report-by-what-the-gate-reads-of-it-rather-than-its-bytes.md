# ADR-0102 — Whether the seal hashes a JUnit report by what the gate reads of it, rather than its bytes

**Date**: 2026-10-22
**Status**: proposed (2026-10-22) — nothing is chosen here. The record lays out how `check --freeze` could
stop drifting on a JUnit report that a test run rewrites with nothing changed, and what each option costs.
An agent wrote this record; the maintainer decides (ADR-0088 decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: an adopter's report, measured on a copy of its repository with runward 0.44.1 (64 sealed
files, 4 of them JUnit reports); read against a fresh clone of `stranxik/runward` at `main@97f3f02`:
`src/lib/evidence.ts` (`sha256`, `normalizedFileSha256`, `collectSealableEvidence`), the JUnit detector
and reader the gate uses for `test:` pointers, ADR-0098. The adopter's measurement is reported, not
re-run here
**Relates to**: [ADR-0098](ADR-0098-whether-the-gate-says-how-old-a-committed-junit-report-is-and-what-it-may-read-to-say-it.md)
(the age of a committed JUnit report), RWD-2026-0181

## Context

**What was reported.** An adopter seals its mission with `check --freeze` in CI. Its test runner (vitest,
like most JUnit writers) puts `time`, `timestamp`, `hostname` and `<system-out>`/`<system-err>` into the
report, and orders `<testsuite>` elements differently from one run to the next. Every CI run rewrites the
report, the seal's hash changes, and the gate reports drift with no code changed. The adopter now runs a
normaliser after each suite (attributes and console output removed, suites sorted by name); two runs then
give the same hash.

**What the tree does.** `sha256()` (`src/lib/evidence.ts`) hashes a sealed file's bytes after one
normalisation: line endings, because a Windows checkout rewrites them. A JUnit report is sealed like any
other file. The gate itself, reading a `test:` pointer through a report, reads case names, verdicts and
failure messages; it never reads `time`, `timestamp`, `hostname` or console output.

**Why it matters.** A seal that drifts on every run is re-sealed by habit, which is the failure the seal
exists to prevent (`docs/operator-role.md`, "treat a lock diff in review as a decision, not as noise").

## Decision

None yet. The options:

- **A. Bytes, as today, and a documented normaliser.** The operator removes the volatile parts before
  sealing; runward documents the attributes to drop and ships nothing.
- **B. Hash the projection the gate reads.** For a file the JUnit detector recognises, the seal hashes a
  canonical projection: suites and cases sorted by name, each case's verdict and failure message; every
  other attribute and console output left out. Same idea as the line-ending normalisation, applied to the
  format the gate already parses. The witness and the evidence lock would record which hash kind a file
  carries.
- **C. Do not seal JUnit reports.** Seal the test source the pointer names and let ADR-0098 decide what the
  gate says about a report's age. Loses the guarantee that the report read is the report sealed.

## Alternatives discarded

- **Ignoring drift on `.xml` files.** A seal that stops looking is not a seal.

## Consequences

- B changes what "sealed" means for one format: a report whose timings changed but whose cases did not
  stays sealed. That is the gate's own reading, but it must be said in the lock and the witness
  specification, and existing locks need a migration or a dual read.
- A costs nothing in the tool and leaves every adopter to rediscover the normaliser.

## What would settle it

- **For A**: adopters who seal JUnit reports already normalise them, and a documentation page is enough.
- **For B**: a second adopter, unrelated, meeting the same drift; a canonical projection specified once and
  shared by the seal and the witness.
- **For C**: ADR-0098 settled in a way that makes the report's content irrelevant to the seal.

## Reevaluation trigger (mandatory, dated)

Reopen when ADR-0098 is decided, when a second unrelated adopter reports seal drift on a test report, or on
2027-01-22, whichever comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues mentioning the seal, `--freeze`, JUnit or drift.

## References

- `src/lib/evidence.ts` (`sha256`, line-ending normalisation), the JUnit reader of `test:` pointers.
- RWD-2026-0181 in `docs/compliance/known-defects.md`; ADR-0098.
