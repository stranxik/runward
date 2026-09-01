# ADR-0063 — What a SARIF finding about a MISSING file anchors to

**Date**: 2026-08-29
**Status**: accepted 2026-09-01 (measured against GitHub code scanning; record below)
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

That was why this ADR was `proposed` rather than `accepted`. The evidence has since been gathered —
see **What settled it** below — and it settles it in favour of the behaviour the tree already had.

## Decision

Keep anchoring an absence finding to the path it is about, and hold the "every uri resolves"
guarantee for every other finding.

Measured, not assumed: an alert whose path is absent from the commit is **created, open, and
structurally identical** to one whose path exists. The cost of option 1 turns out to be smaller than
the cost of either alternative, so the behaviour the tree already had is ratified rather than
changed.

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

One upload of a document carrying an absent-path finding to GitHub code scanning, and a look at what
the alert becomes: **created and displayable**, **created and undisplayable**, or **rejected**.

## What settled it

Run 2026-09-01. A throwaway branch of this repository carried one file, `probe-present.txt`, and a
SARIF was uploaded for that ref through `POST /repos/{owner}/{repo}/code-scanning/sarifs` with two
results: one anchored to `probe-present.txt`, one to `probe-absent.txt`, which the commit does not
contain. A dedicated tool name kept the probe separable from the repository's real analyses.

**The upload was accepted without error or warning** — `processing_status: complete`, `error: ""`,
`warning: ""` — and the analysis reports `results_count: 2`. **Both alerts were created and both are
`open`**, and the API returns them with the same fields: the absent-path alert carries its `path`,
`start_line`, `message` and `classifications` exactly as its sibling does. Nothing marks it, nothing
drops it, nothing dismisses it.

So of the three outcomes the question named, it is the first: **created**. What a reader loses is the
rendered snippet in the file view, not the alert. That is a smaller cost than moving the annotation
onto a file that is correct, which is what both alternatives require.

The probe left nothing behind: the branch was deleted, the analysis deleted through
`DELETE /code-scanning/analyses/{id}`, and the repository verified back at its prior alert count —
0 alerts and 0 analyses under the probe's tool name.

## Reevaluation trigger (mandatory, dated)

The upload above is performed, or a consumer other than GitHub code scanning is targeted by a
runward user and reports how it treats an absent path. Either signal ratifies or reverses this
decision; until one appears, the behaviour stands as proposed and the exception in the shape test
stands with it.

**Trigger set on**: 2026-08-29 · **Watched via**: `test/sarif-shape.js`, whose stated exception —
a non-resolving uri belongs to a finding about an absent artifact, and every other uri resolves —
now rests on this measurement rather than on an assumption. A consumer other than GitHub code
scanning reporting a different treatment reopens the decision.
