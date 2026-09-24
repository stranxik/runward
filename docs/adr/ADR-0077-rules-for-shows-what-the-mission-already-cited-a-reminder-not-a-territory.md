# ADR-0077: `rules --for` shows what the mission already cited — a reminder, not a territory

**Date**: 2026-09-24
**Status**: accepted 2026-09-24 — the maintainer asked for the defect to be fixed after a three-way investigation (doctrine, code, adversarial field measurement), and approved this shape
**Deciders**: the maintainer
**Method**: measured before decided — the example mission and a 409-file field mission, every file asked; the case that created `--for` replayed at its own date

## Context

`runward rules --for code/src/core/domain/guard.ts`, run in the example mission, answers **0 rules**.
That file is the one the mission cites as evidence for four CRITICAL/HIGH rules —
`frontier-deterministic-boundary` and `hexa-move-deterministic-out` in `floor.md`,
`security-prompt-injection` and `security-human-agent-trust` in `governance/threat-model.md` — and the
two that the renaming demonstration breaks are among them. An agent about to edit the deterministic
guard is told nothing.

The answer is correct by [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md):
`--for` matches on the territory a rule declares, and all four rules **declared, in writing, that they
have none** (`noTerritory:` — "a glob broad enough to be true would be less honest than no territory").
It is not the wrong answer to the question asked. It is an answer that leaves unsaid something the
mission itself already wrote down.

Measured, every file asked:

- **Example mission** (13 files under `code/src` and `code/test`): territory covers 7, all ports and
  adapters; the mission's manifests cite 11.
- **A field mission** (409 files): territory covers 66 (16 %); the manifests cite 96 (23 %), almost
  disjoint — of 150 cited (file, rule) pairs, 9 were already surfaced by territory. The domain core:
  68 files, 0 covered by territory, 17 cited. 263 files (64 %) are reached by neither.

## Decision

**`--for` gains a separate section: the rules this mission already cited these files as evidence for.**
Each entry names the rule, the row's status, and the manifest and line that cite the file
(`← runward/floor.md:22 file:code/src/core/domain/guard.ts#guardFields`), on the `git check-ignore -v`
model the ADR-0041 match reason already follows.

- **The source is a declaration, never a reading of code.** A typed pointer (`file:` / `test:`) in a
  gated manifest row is an operator statement in a normed file — the class of fact
  [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) admits for derivation, not the content
  signal ADR-0041 refused. The manifests are the gated deliverables, read by the gate's own reader.
- **It is not a match, and it is never counted.** It lives in its own JSON field, `citedByMission`
  (additive, [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md)), and its own text section, under
  the territory answer. `count`, `rules`, `matchedBy`, `unscoped` and `territoryStates` are unchanged,
  and so is `FOR_NON_EXHAUSTIVE`: a rule with no territory is still never *matched*.
- **Its caveat travels with it**: listed because already cited; a rule nobody answered for here is
  absent; a new file is never cited; it says what was declared, never what governs the file.
- **Every status is shown, none filtered** — a `deviated` row citing the file is as much a reminder as an
  `applied` one. **Proposed rows** ([ADR-0066](ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md))
  are written by an agent and not ratified: named apart, never listed as the mission's declaration.
  Pointers into `runward/rules/` are circular evidence ([ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md)) and skipped.
- **Stale evidence is said to be stale.** A cited file that no longer exists, or a `#symbol` it no
  longer carries, is still listed — the path still identifies the file — and marked *no longer
  resolves*, pointing at `runward check`. It is stated, never judged: `--for` still exits 0.
- **A manifest the gate refuses to read** (several `Rule conformance` sections) is a named fault in
  `citedByMission.couldNotRead`, never a blind zero. The top-level `couldNotRead` keeps speaking for
  territory carriers only.

Two consequences for the surface as documented: `--for` now reads files — the gated manifests, and a
cited file when its pointer names a symbol — where the port contract said "no filesystem access"; and
`readManifest` returns line numbers in a parallel array, never on the row, because rows are spread into
the compliance payload and a new row field would have changed that machine surface.

## Alternatives discarded

- **Merge citations into `matchedBy`.** Rejected: a reader would take a cited file for a governed one,
  and a long list reads as complete. The field mission shows why that matters — one entry module would
  go from 3 rules to 8, a number that measures documentation written, not exposure.
- **This source alone, as the fix.** Rejected as insufficient, on the evidence of the case that created
  `--for`: replayed at its own date, the mission then cited neither the rewritten cron nor the secret
  relay, so this source would have surfaced **nothing** there. What closed that gap was a declaration made
  in advance — a territory category. Citation reminds; it never warns about what was forgotten.
- **Filter to `applied` only.** Rejected: a deviation citing the file is exactly what an editor of that
  file needs to see.

## What remains open, and what would settle it

**A `domain-core` category** ([ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md)), declared by a
mission map line (`code/src/core/domain/**`), would reach new files too — the half this decision cannot.
But the rules it would attach to have each **declared in writing that they carry no territory**, with a
reason; attaching one reopens those decisions, which ADR-0041 names as the cost that must never be paid
silently. It is left to the maintainer. It would be settled by a rule whose own text genuinely prescribes
the domain core as its subject — not by a slug, and not by quota.

## Consequences

- **Positive.** The file the example mission cites for four CRITICAL/HIGH rules now surfaces them, with
  the line that says so, and says when that evidence has gone stale.
- **Negative, accepted.** The section is only as good as what the mission has written: empty on a new
  mission, empty on a new file, longest where documentation is densest. Its caveat says so every time.
- **On other boundaries.** The gate is untouched: no exit code, no manifest shape, no `check` behaviour,
  no new red. The new module enters the mutation perimeter beside `rules`, `territory` and
  `territory-map` ([ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)).

## Reevaluation trigger (mandatory, dated)

Reopen if field use shows the section read as the governing rule set (an agent or operator treating a
cited list as exhaustive), or if a pilot mission surfaces, through this section, a re-examination that
territory would have missed — the evidence that would justify promoting it. Reopen the `domain-core`
question if a shipped rule's own text comes to name the domain core as its subject.

**Trigger set on**: 2026-09-24 · **Watched via**: `rules --for` field reports and the pilot protocol's
questionnaire (`docs/pilot-protocol.md`)

## References

- [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), [ADR-0043](ADR-0043-territory-is-declared-in-two-parts.md) — the territory carriers this sits beside.
- [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) — additive machine surface.
- `test/unit/rules-for-cited.test.js` — the guard.ts case, the rename, the deleted file, the uncited file, the proposed row, the refused manifest.
