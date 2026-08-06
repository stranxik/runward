# ADR-0021: Drift promoted to blocking under --strict; opt-in evidence sealing (--freeze)

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — ADR-0004's own promotion trigger executed against the audit's finding (advisory drift = silent rot never fails CI), challenge on false positives, durable position

## Context

ADR-0004 shipped drift detection advisory, with an explicit promotion path: "Promote drift from advisory to blocking (under `--strict` …) once evidence-path conventions are stable and observed false positives are near zero." The conventions are now stable — the heuristic fires only on file-extension tokens, prose never triggers it, and ADR-0019 gives pointers a declared grammar — and no false positive has been observed on the reference mission or in the incident log. Meanwhile the audit named the cost of staying advisory: a manifest rots silently in CI; a pointer whose file was deleted after the gate went green *stays* green forever.

Two distinct failure windows exist. **Before the gate**: a stale pointer must fail the crossing — that is promotion. **After the gate**: the mission crossed on evidence that later silently vanishes or mutates — no re-run of a presence check can distinguish "evolved legitimately" from "eroded"; only a seal taken at crossing time can.

## Decision

1. **Promotion.** Under `--strict`, an `applied` row whose evidence carries path tokens none of which resolve is now a **blocking** violation (exit 1), not an advisory line. Prose-only evidence remains unchecked — the operator's judgment, per ADR-0004. The message keeps the fix legible: update the pointer, mark the row `deviated` with its ADR, or remove it.
2. **Sealing, opt-in.** `runward check --freeze` runs the full strict gate and, **only if green**, seals it: every evidence file that resolves across the gated manifests is hashed (SHA-256) into `runward/evidence-lock.json` — sorted, deterministic, meant to be committed. Freezing a red gate is refused: a seal certifies a crossing, not a hope.
3. **Seal verification.** When `runward/evidence-lock.json` exists, `check --strict` verifies it: a sealed file now missing, or whose hash changed, is a **blocking** violation naming the operator's gesture — re-read the pointer, confirm the evidence still holds, then re-seal with `check --freeze`. No lock file, no seal check: the discipline is opt-in by construction.
4. **Determinism.** The lock is `{ version, sealedAt, files: { path: sha256 } }` with stable key order; `sealedAt` honors `RUNWARD_NOW` in non-interactive runs, like the compliance pack. Re-sealing unchanged evidence is byte-idempotent.

The gate still reads bytes and hashes them; it executes nothing, judges nothing, calls no model.

## Alternatives discarded

- **git mtime / commit comparison** instead of hashing. Depends on git presence, checkout times and history rewrites; a content hash is true regardless of transport.
- **Sealing automatically at every green `--strict`.** A read-only audit command that silently writes state violates least surprise; the seal is an explicit operator gesture, like the crossing itself.
- **Storing hashes inside the manifest.** Mixes generated, machine-owned data into an operator-owned document; the lock file keeps ownership legible.
- **Keeping drift advisory behind yet another flag** (`--strict=hard`). A third strictness level for a check whose false-positive surface is now near-nil is surface complexity; ADR-0004 planned promotion into `--strict`, not a ladder.

## Consequences

- **Positive.** CI finally fails on a rotten pointer; deletion-after-green becomes visible the day it happens on sealed missions; the audit claim "drift is advisory, erosion is silent" stops being true.
- **Negative, accepted.** A refactor that legitimately moves evidence turns a sealed mission red until the operator re-verifies and re-seals — deliberate: the manifest is a snapshot, and the seal makes its staleness loud instead of silent. Rollback path if the field disagrees: the reevaluation trigger below, never a silent re-soften.
- **On other boundaries.** `check.ts` moves drift into the blocking path and gains `--freeze`; a small `evidence-lock` module joins the gate's orbit; ADR-0004 gains an amendment noting its trigger fired; the smoke suite's advisory expectation is replaced by a blocking one.

## Threat model of the seal, stated plainly (amended 2026-07-16)

An adversarial audit confirmed the seal's honest scope, which was implicit and must be explicit: **the seal detects drift and deletion, not falsification by a writer.** Anyone with write access to the repository can edit an evidence file *and* recompute its hash in `evidence-lock.json`, and `check --strict` will report the seal intact — the lock is content-addressed, not signed, and runward is never a runtime that could hold a key the operator does not. This is not a hole to patch here; it is the boundary of what a repo-resident, zero-secret gate can promise. What the seal *does* give: a green-crossing hash that makes accidental erosion (a refactor, a deleted file, a moved artifact) loud, and a value an auditor cross-checks against the signed git history — the trust anchor is the reviewed commit, not the lock file alone. Cryptographic signing of the seal is deliberately out of scope (it needs a key custody model runward does not own); if ever required it is its own ADR. The spec (`docs/spec/runward-oscal-mapping.md` §6) states this boundary to readers.

## Reevaluation trigger (mandatory, dated)

Reopen if blocking drift produces a confirmed false positive on legitimate prose evidence (the path-token heuristic over-matched — narrow it, or demote that class), or if sealed missions turn red so often on legitimate refactors that operators stop sealing — the seal must stay worth its cost.

**Trigger set on**: 2026-07-16 · **Watched via**: the conformance-gate incident log and the re-seal frequency on sealed missions.

### Amendment — 2026-08-01, when NOT to seal, measured on this repository

An internal-validity pass asked why runward's own mission carries no
`evidence-lock.json` — the tool proposing a discipline it does not practise. The answer, measured
rather than argued: sealing this repository would seal 25 files, and **25 of those 25 changed within
30 days**. They are spread across the whole repository rather than concentrated in one corner —
8 under `src/`, 5 at the root, 5 under `runward/`, 4 under `docs/`, 2 workflows, 1 example — which
is the point: a mission's evidence points at whatever proves it, and on a product under development
all of that moves. A committed lock here would turn `check --strict` red on the first commit after
every seal, making `--freeze` a per-commit ritual and the red meaningless.

So the omission is correct, and the decision's "opt-in by construction" is doing exactly its job.
What was missing is that **the boundary was written nowhere**, and it is not obvious: an operator in
a regulated setting is precisely the one most likely to seal everything on principle, and to meet a
permanently red gate without understanding why.

**Seal what has stopped moving.** A seal certifies a crossing — a handover, a release, an audited
version, a mission entering operation. Its value is that a later change becomes loud. On a
deliverable still under active edit, every change is expected, so the loudness carries no
information and trains the operator to re-seal without reading, which is the failure the seal exists
to prevent.

This changes no behaviour: the mechanism, the exit codes and the lock format are untouched. It names
a usage boundary the decision implied and never stated.

## References

- [ADR-0004](ADR-0004-advisory-drift-detection-of-applied-pointers.md) — the promotion trigger this executes; amended accordingly.
- [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md) — the pointer grammar that stabilized the conventions.
- [ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) — the precedent for opt-in, operator-owned extensions of `check`.
