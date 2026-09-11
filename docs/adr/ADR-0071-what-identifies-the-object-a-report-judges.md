# ADR-0071 — What identifies the object a report judges

**Date**: 2026-09-11
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured on the generated report and on `missionStateDigest`, including a measurement
that KILLED the obvious fix

## Context

The delivery report (ADR-0064) was read blind on 2026-09-11 by a reader with access to nothing else,
and again against ISO/IEC 42001 and EU AI Act Annex IV. Both readings returned the same first
question, independently: **which object is this a report about?**

What the report carries today: an absolute filesystem path. Measured: on the generating machine that
path was a temporary directory containing the session UUID, printed twice, once inside `<title>`. It
names no repository, no commit, no content hash. An assessor who receives the file cannot tell
whether it describes the tree in front of them, and cannot tell two reports of the same mission
apart.

Three axes ranked "put `missionStateDigest` in the report" as a top-three fix. **That fix is
trapped, and the trap was measured**: the report is written to `runward/governance/delivery-report.html`,
which lives inside the tree `missionStateDigest` hashes. A report that prints the digest of its own
tree is stale the instant it is written, and shipping that naively would manufacture exactly the
class of false green this project spent two releases removing.

A second, smaller reading from the same pass: the attestation must be produced before the report,
or the report changes the digest the attestation covers. That ordering constraint is real, is
nowhere documented, and is the kind of undocumented sequencing that produces a support question
rather than a wrong verdict.

## Decision

**Proposed** — the choice is between three shapes, and it is the maintainer's because each spends
something different:

1. **Exclude runward's own outputs from the digest.** `runward/governance/delivery-report.html`,
   `runward/compliance/*` and any future generated emission stop being hashed; the digest then means
   "the material the operator wrote plus the gate's inputs". Cost: the attestation no longer covers
   its own published artifacts, so a tampered report is no longer detectable by the seal. That is a
   real loss and it must be stated in `GATE_NON_SCOPE` if this is chosen.
2. **Print the digest as of before the write, declared as such.** The report carries
   `subject digest (before this file was written): <hash>`. Nothing is excluded from the seal; the
   reader gets an identity they can re-derive by removing the report and re-hashing. Cost: a
   sentence an assessor must understand, and a re-derivation gesture that is one step longer.
3. **Identify by commit, not by digest.** The report carries the git commit SHA and the remote URL,
   read from the repository it judges. Cost: it reaches for git, which the verdict path refuses
   (ADR-0054) — so it would have to be read in the REPORT command only, never in `check`, and a
   dirty tree would need saying (`<sha>+dirty`), which is another sentence.

Whatever is chosen, two things ride with it: the absolute path stops being printed (it leaks the
generating machine's layout and says nothing to the reader), and the attestation-before-report
ordering is documented or made unnecessary.

## Alternatives discarded

- **Print nothing and let the reader ask.** That is the current state, and two independent readings
  named it as the first blocker. An unidentified report is a report an assessor cannot file.
- **Put the digest in naively.** Measured above: it would be wrong on every run, which is worse than
  absent, because absent does not lie.

## Consequences

- **Positive**: the report becomes a document about a specific object, which is the precondition for
  an assessor filing it at all.
- **Negative, per option**: option 1 narrows what the seal covers; option 2 adds a sentence to
  understand; option 3 puts a git read in one command and needs the dirty case said.
- **On other boundaries**: option 3 is the only one that touches ADR-0054's territory, and only in
  a command that is not the verdict.

## What would settle it

Generate a report, hand it to a reader who has the repository but not the session, and ask them to
prove the report describes the tree they are looking at. Option 2 and 3 make that possible with one
command; option 1 makes it possible only for the operator's own material. The measurement is cheap
and needs no third party, so this ADR should not stay proposed for long.

## Reevaluation trigger (mandatory, dated)

An assessor (or the pilot) states that they cannot tie a report to a tree, or a fix for this lands
without excluding the report from the digest and the digest is then wrong on every run.

**Trigger set on**: 2026-09-11 · **Watched via**: the pilot's first report reading (ADR-0052)
