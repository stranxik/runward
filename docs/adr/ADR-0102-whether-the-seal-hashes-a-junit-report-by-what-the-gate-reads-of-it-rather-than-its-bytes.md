# ADR-0102 — Whether the seal hashes a JUnit report by what the gate reads of it, rather than its bytes

**Date**: 2026-10-22
**Status**: accepted (2026-10-23) — the maintainer chose A now with D and E from the adopter's follow-up: a documented normaliser for drift, `--freeze` refuses to seal a cited JUnit report whose root counts failures or errors, and `check` warns when a cited report carries failures outside the cases it cites. B waits for a second adopter; C is discarded. Amended 2026-10-28: the reevaluation trigger fired and the maintainer chose B, with a dual read of existing locks
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

**Decided (2026-10-23).** A, D and E. **A**: the documentation names the attributes to strip before
sealing (`time`, `timestamp`, `hostname`, console output) and the suite order to fix; runward ships no
normaliser yet. **D** (added below from the same adopter's follow-up): `check --freeze` refuses to seal a
JUnit report cited by a `test:` pointer whose root counts failures or errors, whatever the cited cases
say: a seal certifies a crossing, and a report that says tests failed is not one, which is the reason
the seal already refuses a red gate. **E**: `check` adds a line when a cited report carries failures
outside the cases it cites ("the report is not green, even though the cited cases are"), advisory,
outside the verdict. **B** (hashing the projection the gate reads) waits for a second unrelated adopter
meeting the drift: it changes what "sealed" means for one format. **C** is discarded: it loses the
guarantee that the report read is the report sealed. RWD-2026-0181 stays `not-fixed` until D and E ship
in a pull request of their own.

*(Amended 2026-10-28: B decided, with a dual read of existing locks.)* **Why now.** The reevaluation
trigger below says "Reopen when ADR-0098 is decided", and ADR-0098 was decided on 2026-10-23: the
trigger fired. Two facts were then on the record. First, runward is a second user meeting the drift,
and solved it only for itself: its own committed report goes through `scripts/junit-committable.mjs`,
which strips `file=`, the per-case `time=`, the suite wall clock and the trailing duration comment and
touches no verdict, and the shipped example mission does the same gesture; every adopter who seals a
report had to rediscover that step. Second, since 0.46.0 (D, RWD-2026-0182) `--freeze` refuses to seal
a cited report whose root records failures or errors, so a sealed report is green at its root: a
projection of names and verdicts carries no stack trace and no failure message to vary, and is very
stable. The maintainer decided B on 2026-10-28; an agent wrote this amendment and the change that
implements it (ADR-0088 decision 4, applied to decisions as to rows).

**B, as decided.**

1. When `check --freeze` seals a file the JUnit detector recognises (`isJUnitReport`), that is not a
   verdict rendering runward wrote (`isRunwardJUnit`, ADR-0096) and that parses whole as one, it hashes
   a canonical projection instead of the bytes: every `<testsuite>` and `<testcase>`, sorted, each
   case reduced to its identity (enclosing suite names, `classname`, `name`) and its verdict
   (`passed`, `skipped`, `failure`, `error`), plus the root failures-and-errors count the gate reads
   (`junitRootFailures`, decision D). Everything else is out: `time`, `timestamp`, `hostname`, `file`,
   `line`, every other attribute, properties, `<system-out>`, `<system-err>`, failure messages,
   comments, CDATA, attribute order, white space, suite and case order. It is specified once,
   `junitProjection` in `src/lib/tool-adapters.ts`, serialised as canonical JSON lines, read by the
   seal and by its verification, and written out for a reader without runward in
   `docs/spec/runward-oscal-mapping.md` §6.
2. **Duplicates are kept.** Two cases with the same suite, class and name are two lines, sorted by
   their text and so by verdict: their document order does not matter, and removing one homonym or
   changing one homonym's verdict still moves the hash.
3. **A report that does not parse whole is sealed by its bytes, and said.** Not well formed, two
   roots, text after the root, a root that is not a suite: the file is hashed as before and
   `check --freeze` names it (it reads as a JUnit report but does not parse whole as one). A file is
   never sealed by a reading that did not understand it, and never silently.
4. **The lock records the kind.** `evidence-lock.json` gains `hashKinds` (path → kind), additive,
   written only when an entry is not a bytes entry, so a lock that seals no report keeps its bytes. An
   entry with no recorded kind is a bytes entry and is verified by bytes: every lock written before
   this release keeps working, and its reports drift as before until one `check --freeze` re-seals
   them under the new kind (the drift message says so). A kind this runward does not know is refused,
   never read as bytes. `version` stays 1.
5. **What is not changed.** The verdict attestation (ADR-0055) and the witness (ADR-0089) keep
   digesting files by their bytes: the attestation binds a verdict to the exact tree it was computed
   on, and the witness states facts about the file read; the seal is a family the witness does not
   carry. `scripts/junit-committable.mjs` keeps producing runward's committed report, now for a
   byte-stable committed file, no longer for the seal. A is superseded for sealing: the normaliser
   recipe in `docs/operator-role.md` and the adapters README becomes "not needed for sealing".

The options as proposed on 2026-10-22:

- **A. Bytes, as today, and a documented normaliser.** The operator removes the volatile parts before
  sealing; runward documents the attributes to drop and ships nothing.
- **B. Hash the projection the gate reads.** For a file the JUnit detector recognises, the seal hashes a
  canonical projection: suites and cases sorted by name, each case's verdict and failure message; every
  other attribute and console output left out. Same idea as the line-ending normalisation, applied to the
  format the gate already parses. The witness and the evidence lock would record which hash kind a file
  carries.
- **D. `--freeze` refuses a cited JUnit report that is not green at its root** (added 2026-10-23). A report
  cited by a `test:` pointer whose root counts failures or errors is refused for sealing, even when every
  cited case is green.
- **E. An advisory line when a cited report carries failures outside the cited cases** (added 2026-10-23).
  Outside the verdict, on every run.
- **C. Do not seal JUnit reports.** Seal the test source the pointer names and let ADR-0098 decide what the
  gate says about a report's age. Loses the guarantee that the report read is the report sealed.

## Alternatives discarded

- **Ignoring drift on `.xml` files.** A seal that stops looking is not a seal.

## Consequences

- B changes what "sealed" means for one format: a report whose timings changed but whose cases did not
  stays sealed. That is the gate's own reading, but it must be said in the lock and the witness
  specification, and existing locks need a migration or a dual read.
- *(Amended 2026-10-28.)* B decided: a sealed JUnit report is sealed for its cases and their verdicts,
  not for its timings. Another run of the same suite keeps the seal; a case renamed, removed, added, or
  changing verdict (a pass becoming a skip included) breaks it. The lock says which entries carry the
  projection (`hashKinds`), the spec states the projection, and the witness specification says its
  file digests stay bytes. Existing locks get the dual read, and one re-freeze migrates them.
  RWD-2026-0181 is fixed in the release carrying this change.
- A costs nothing in the tool and leaves every adopter to rediscover the normaliser.

## What would settle it

- **For A**: adopters who seal JUnit reports already normalise them, and a documentation page is enough.
- **For B**: a second adopter, unrelated, meeting the same drift; a canonical projection specified once and
  shared by the seal and the witness. *(Amended 2026-10-28: settled by the trigger firing and runward
  itself being the second user, above; the projection is specified once and shared by the seal's writer
  and verifier. What would reopen it: a confirmed false green, a report whose gate reading changed while
  its seal held, or a JUnit writer whose ordinary output this reader refuses, so that it is sealed by
  bytes and drifts again.)*
- **For C**: ADR-0098 settled in a way that makes the report's content irrelevant to the seal.

## Reevaluation trigger (mandatory, dated)

Reopen when ADR-0098 is decided, when a second unrelated adopter reports seal drift on a test report, or on
2027-01-22, whichever comes first.

**Trigger set on**: 2026-10-22 · **Watched via**: issues mentioning the seal, `--freeze`, JUnit or drift.

*(Amended 2026-10-28.)* Fired on 2026-10-23, when ADR-0098 was decided; B was decided on 2026-10-28.
Reopen B when the projection is found to hold a seal over a change the gate reads (a false green), when a
mainstream JUnit writer's ordinary report does not parse whole and falls back to bytes, or on 2027-04-28,
whichever comes first. **Trigger set on**: 2026-10-28 · **Watched via**: the same issues, and the
`check --freeze` note naming a report sealed by bytes.

## Notes

- **2026-10-23, the same adopter's follow-up.** The gate judges a JUnit report by the cases it cites
  (ADR-0056), so `check --strict --freeze` sealed a report holding a `<failure>` on a case no pointer
  cited: a flaky test in a 277-file suite. The next CI run regenerated the report without that failure,
  the seal drifted, and the gate reddened for a defect unrelated to the change. Re-read in
  `src/lib/evidence.ts` (`junitTestResult`, per cited case). The adopter's guard refuses to seal a report
  containing `<failure` or `<error `. Options D and E above come from that report.

## References

- `src/lib/evidence.ts` (`sha256`, line-ending normalisation), the JUnit reader of `test:` pointers.
- `src/lib/tool-adapters.ts` (`junitProjection`), `src/lib/evidence.ts` (`sealHash`,
  `collectEvidenceSeal`, `verifyEvidenceLock`), `test/unit/junit-seal.test.js` (B, both directions,
  end to end on `init --example`); `docs/spec/runward-oscal-mapping.md` §6; ADR-0021 (amended
  2026-10-28).
- RWD-2026-0181 in `docs/compliance/known-defects.md`; ADR-0098.
