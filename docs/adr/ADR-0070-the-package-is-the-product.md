# ADR-0070 — The package is the product

**Date**: 2026-09-11
**Status**: accepted 2026-09-11 (decided on a measurement nobody had taken: the tarball opened as a
consumer receives it)
**Deciders**: the maintainer
**Method**: measured on `npm pack --dry-run --json` and on a consumer install, never on the
development tree

## Context

Every measurement this project had ever taken of itself was taken FROM the development tree: 70
ADRs, 30 pages of `docs/`, `CONTRIBUTING.md`, the product's own mission, all within arm's reach of
the command being judged. A five-axis self-directed investigation on 2026-09-11 found the axis
nobody had opened, and it was the most consequential one: **nobody had ever run the binary the way
a stranger obtains it.**

What the tarball actually contains: **196 files, zero under `docs/`.** What the shipped CLI does
with that: it prints five `docs/…` paths that cannot resolve, ends the very first `init --example`
by sending the user to `docs/first-mission.md` as a bare relative path, cites eight ADRs in its
`--help` with no URL, and ships a `README.md` carrying eighteen links to files the package does not
include. Separately, the two CI adapters it ships pin `node-version: 20` while its own
`engines.node` says `>=22.12.0`.

The sharpest evidence that this is a *class* and not a list: in the same investigation, an
adversarial reviewer REFUTED a finding about a project with no ports by citing
`docs/when-to-use.md`, which names the documented way out. That refutation is correct for a reader
of the repository and false for a consumer. **The documented escape hatch exists in the repository
and not in the product**, which means the person who needs it is precisely the person who cannot
reach it.

This project already refuses, elsewhere and loudly, a claim whose evidence lives somewhere the
reader cannot follow (ADR-0045; RWD-2026-0103, where the gate's advice named a workflow file the
measured mission did not hold). The same refusal had never been pointed at the package boundary.

## Decision

**Ratified**:

1. **Every pointer the shipped CLI prints resolves for someone who has only the package.** Either
   the file ships in the tarball, or the pointer is an absolute URL. A bare relative path to a file
   the package does not contain is a defect, not a convenience.
2. **Everything the package ships must be consistent with the package.** A shipped adapter, sample
   or template may not contradict `package.json` — the Node floor is derived from `engines`, never
   restated as a literal.
3. **The boundary is tested at the boundary.** `packaging.test.js` reads `npm pack --dry-run --json`
   and judges what the tarball holds against what `dist/` says, so a file dropped from `files` or a
   new documentary reference re-opens the question mechanically. Reading the repository can no
   longer stand in for reading the product.

## Alternatives discarded

- **Ship `docs/` in the tarball.** Tempting, and wrong as a blanket rule: the ADR journal is 70
  files of decision history addressed to contributors, and shipping it would grow the package and
  put an internal record on every consumer's disk. What the consumer needs is the handful of
  documents the CLI actually points at, and a URL for the rest. Rule 1 allows either, per pointer,
  which is the honest granularity.
- **Drop the references instead.** Cheaper, and it makes the product mute exactly where a newcomer
  is most lost. The references are good; their unreachability is the defect.
- **Leave it and document the gap.** This is the shape ADR-0045 refuses from an operator: a caveat
  in a file the reader does not have is not a caveat.

## Consequences

- **Positive**: the first fifteen minutes stop containing dead ends; the documented way out of a
  mismatched project becomes reachable by the person it is for; and the class cannot silently
  re-open, because the test reads the tarball.
- **Negative, accepted**: two sources of truth for a few documents (repository and URL), and a
  packaging test that is slower than a grep because it packs.
- **On other boundaries**: nothing touches the verdict path (ADR-0054). This is a packaging and
  guidance decision.

## What would settle it

A consumer install, from the registry, on a machine that has never seen the repository: every path
and reference the CLI prints in the first fifteen minutes either opens or is a URL. That run is
mechanical and needs no third party, which is why this ADR is accepted rather than proposed.

## Reevaluation trigger (mandatory, dated)

A documentary reference is added to a shipped surface without the packaging test noticing, or the
number of shipped documents grows to the point where the tarball carries material addressed to
contributors rather than to consumers.

**Trigger set on**: 2026-09-11 · **Watched via**: `packaging.test.js` and the tarball's file count
