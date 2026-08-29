# ADR-0063 — What a SARIF finding about a MISSING file anchors to

**Date**: 2026-08-29
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured on the emitted documents, then checked against the consumer's documentation

## Context

`check --sarif` gives every finding a `physicalLocation` naming the artifact it is about. For a
finding whose whole content is that an artifact is **absent**, that path is by definition not in the
checkout.

Measured on a realistic red mission: six findings, one of them anchored to a path that does not
resolve — `runward/deliverable-not-filled` on `runward/runbook.md`, the deliverable it reports as
missing. The scope is narrow and worth stating precisely, because two of the four families that name
a path can never produce it:

| finding | anchors to | can the path be absent? |
|---|---|---|
| `runward/deliverable-not-filled` | `runward/<deliverable>` | yes, when the state is `missing` |
| `runward/rule-corpus` | `runward/rules/<file>` | yes, for a rule reported gone |
| `runward/unratified-decision` | `runward/adr/<file>` | no — the file exists, it is merely unratified |
| `runward/evidence-seal`, `runward/hook-failed` | the lock, `hooks.json` | no — present by construction |

The question surfaced because this project already refused a version of it once. RWD-2026-0041
shipped uris no checkout held, and the net that came out of it asserts *every uri resolves in the
checkout*. Extending `test/sarif-shape.js` with the fixtures the mutation campaign showed were
missing — a deliverable gap, a corpus divergence — made that invariant fail. It was **narrowed** to
admit exactly this case rather than dropped, so the behaviour now sits inside a stated exception
rather than inside a guarantee. That is honest, and it is not the same as being right.

**What is known about the consequence, and what is not.** GitHub's code-scanning documentation is
**silent** on a result whose path is absent from the analyzed commit. It states that relative paths
resolve against the repository root, that an absolute URI is converted to a relative one to be
"matched against a file committed to the repository", and — for the neighbouring case — that a path
resolved through a symlink leaves code scanning "unable to display the result". Reports from other
tools' users describe the alert being ingested with the file view answering *"Sorry, we couldn't
find this file in the repository"*; separately, an **empty** `artifactLocation.uri` is reported to
make the upload itself fail. Ingested-but-undisplayable and rejected are very different outcomes,
and this decision turns on which one it is.

That is why this ADR is `proposed` and not `accepted`: the evidence that would settle it has not been
gathered, and neither documentation nor reasoning can substitute for it.

## Decision

**Proposed**: keep anchoring an absence finding to the path it is about, and hold the "every uri
resolves" guarantee for every other finding.

This is what the tree does today. Naming it here turns an unexamined behaviour into a decision that
can be argued with, which is the whole point of recording it before it is ratified.

## Alternatives discarded

- **Anchor to the manifest that requires the artifact.** Every uri resolves again, unconditionally.
  Discarded *provisionally*: the annotation would land on a file that is correct, and a reviewer
  following it would arrive where the problem is not. Reconsider if the settling evidence below
  shows the alert is dropped or rejected rather than merely undisplayable.
- **Anchor to the manifest and name the absent path in the message.** The loss mitigated in prose.
  Discarded *provisionally*: two paths in one finding, and the machine surface would no longer say
  in a readable field which artifact the finding is about.
- **Emit no location at all for an absence finding.** Discarded outright, and measured: an empty
  `locations` array passed the schema net for months precisely because `[].every(...)` is true, and
  a finding a forge cannot place anywhere is a finding nobody reads.

## Consequences

- **Positive**: the finding names the artifact it is about, in a field a tool can read, and the
  reviewer needs no prose to learn which file is missing.
- **Negative, accepted**: on a forge the alert may be created without a displayable source, and the
  "every uri resolves" invariant survives only as a stated exception rather than a guarantee.
- **On other boundaries**: `test/sarif-shape.js` carries that exception explicitly — a non-resolving
  uri must belong to a finding about an absent artifact, and every other uri must resolve. If this
  ADR is decided the other way, that assertion becomes unconditional again.

## What would settle it

One upload of a document carrying an absent-path finding to GitHub code scanning, against a scratch
repository, and a look at what the alert becomes: **created and displayable**, **created and
undisplayable**, or **rejected**. That is one CI run, and it turns three guesses into one
measurement. Until it is run this decision stays `proposed`.

## Reevaluation trigger (mandatory, dated)

The upload above is performed, or a consumer other than GitHub code scanning is targeted by a
runward user and reports how it treats an absent path. Either signal ratifies or reverses this
decision; until one appears, the behaviour stands as proposed and the exception in the shape test
stands with it.

**Trigger set on**: 2026-08-29 · **Watched via**: this ADR's status, which stays `proposed` and is
reported as such by the guard on the journal
