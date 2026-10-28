# ADR-0103 — The register records the source each module was measured on, and a stale one refuses the release

**Date**: 2026-10-28
**Status**: accepted (2026-10-28) — the maintainer chose A: the register records, per module, the digest of the built file its measurement mutated; a check run before the tag and by the release workflow before it drafts refuses a release whose register was measured on other code. The release ratchet stays where it is, as the full re-derivation after publication
**Deciders**: the maintainer. Written by an agent session on the maintainer's decision; under ADR-0088
decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: read on a fresh clone of `stranxik/runward` at `main@0eff76c` (0.46.0):
`.github/workflows/mutation-ratchet.yml`, `.github/workflows/release.yml`, `scripts/mutation-ratchet.mjs`,
`scripts/mutation-register.mjs`, `scripts/mutation-key.mjs`, `stryker.config.json`, ADR-0059, ADR-0079,
ADR-0085, `runward/runbook.md` §3, `docs/compliance/ratchet-summaries/ratchet-summary-0.45.0.json`.
Measured: the merged reports of the 0.45.0 release ratchet (run 39947132062, 25 modules) and of the seven
`mode=measure` runs of 2026-10-28 downloaded with `gh run download`; the source each embeds for
`dist/lib/<module>.js` hashed and compared with a local `npm run build` of `0eff76c`; the run times read
with `gh run view` and `gh run list`; the trigger of both workflows read at `5270c63`, the commit that
added the ratchet
**Relates to**: [ADR-0059](ADR-0059-the-mutation-ratchet-is-enforced-as-freshness-not-as-a-level.md)
(the ratchet this makes able to block), [ADR-0046](ADR-0046-mutation-testing-is-an-instrument-not-a-gate.md)
(an instrument, never a pull-request gate), [ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md)
(the signed summary), [ADR-0085](ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md)
(the draft-first chain), RWD-2026-0183 in [known-defects.md](../compliance/known-defects.md)

## Context

**What ADR-0059 says.** Decision 3: "Failing a release is the intended consequence. A release that ships a
register no longer describing its own code ships exactly the unre-derived claim ADR-0045 exists to
refuse." Consequences: "A release can be blocked by a stale register."

**What the workflows do.** `mutation-ratchet.yml` starts on `release: types: [published]`. So does the
publish phase of `release.yml`, which runs `npm publish`. Both have carried that trigger since the ratchet
was added (`5270c63`, 2026-08-24, first released in 0.36.2). The publish takes minutes; the ratchet takes
hours. The ratchet therefore never ran before a release existed and never could stop one: it answers about
a release already on npm. ADR-0085 (first used for 0.43.0) made the gap final rather than new: the release
is now immutable once published, so a refused ratchet cannot even be followed by a corrected release under
the same version.

**What happened on 0.45.0.** The publish run (39947132061) and the ratchet run (39947132062) both started
at 2026-10-23T11:35:22Z. The ratchet's signed summary was written at 2026-10-24T00:44:57Z, thirteen hours
later, with verdict `refused`: check-contract, conformance and mission no longer matched the register,
because #420 to #434 had changed that code after the last filing, and nothing had looked before the tag.
The seven modules were re-measured and re-filed on 2026-10-28 (`1dc56c2`).

**Why the register could not say it was stale.** It records what each survivor is, keyed on
(module, function, mutator, replacement, line text) by `scripts/mutation-key.mjs`, but not which code the
module was measured on. Knowing that the register is stale needed a full re-measurement: 169 chunks on the
0.45.0 run.

**What makes a cheap answer possible, measured.** Each merged report embeds the source Stryker mutated,
`files["dist/lib/<module>.js"].source`. For all 25 modules of the perimeter, the SHA-256 of that embedded
source equals the SHA-256 of `dist/lib/<module>.js` from a local `npm run build` of `0eff76c`: the seven
modules measured on 2026-10-28 (on `8bc8c5f`; `git diff --stat 8bc8c5f 0eff76c -- src` is empty) and the
eighteen others measured by the 0.45.0 release ratchet on `090e411`. For the five modules whose
`src/lib/<module>.ts` changed between `090e411` and `0eff76c` (check-contract, compliance, evidence,
tool-adapters, verdict), the 0.45.0 digest differs from today's build, as it should. The build is
reproducible enough for a digest of it to identify the code that was measured.

## Options considered

- **A. Record the measured source, check it before the tag, refuse the draft on a mismatch.** The register
  gains one small file; a script compares it with the build in seconds; the release workflow runs it before
  it drafts. The ratchet stays after publication, as the full re-derivation.
- **B. Run the whole ratchet before the tag.** It answers the full question, but costs what the release
  ratchet costs: 169 chunks and thirteen hours of wall clock on 0.45.0, each chunk under a five-hour step
  ceiling. A release would wait half a day on every tag, including a tag whose modules nobody touched.
- **C. Move the ratchet into the prepare phase and make the draft wait for it.** Same cost as B, and the
  draft job would wait on jobs that run mutated code for hours, which ADR-0079 keeps away from anything that
  writes to the release.
- **D. Hash `src/lib/<module>.ts` instead of the built file.** The report embeds the built file, so this
  would be a second thing beside what was measured; and it misses a change that only the compiler makes
  (`git diff --stat 090e411 0eff76c -- package-lock.json` reads 418 changed lines).
- **E. Amend ADR-0059 to say the ratchet only confirms after the fact.** Honest, and it leaves a stale
  register free to ship.

## Decision

**A**, decided by the maintainer on 2026-10-28.

1. **The register records what was measured.** `docs/compliance/mutation-measured-sources.json` holds one
   entry per module of the perimeter, sorted by module: `module`, `sha256` (of the `dist/lib/<module>.js`
   source the run's merged report embeds), `run` (the workflow run id) and `measuredAt` (the run's date). A
   module whose measured source cannot be established carries `"sha256": null` and a `reason`, never a
   guessed digest. The file sits beside `mutation-survivors/`, not in it: every `.json` there is read as a
   per-function verdict file by the register generator, the ratchet and their tests.
2. **`scripts/mutation-fresh.mjs` (`npm run mutation:fresh`).** It builds nothing; it hashes each module's
   current `dist/lib/<module>.js` and compares it with the record. Exit 0 only when every module of
   `stryker.config.json`'s `mutate` is fresh; exit 1 when one is stale (its build changed since its
   measurement) or unknown (no entry, or a null digest), naming each with
   `gh workflow run mutation-ratchet.yml -f module=<m> -f mode=measure`; exit 2 when an input is missing or
   unreadable (no `dist/`, a module not built, the record or the configuration absent or malformed), which is
   never a pass.
3. **Filing writes the entry.** `scripts/mutation-record-source.mjs --module <m> --report <merged.json>
   --run <id> --measured-at <date>` reads the digest from the report, replays `scripts/mutation-ratchet.mjs`
   on that report against the committed verdicts, and writes the entry only if the ratchet answers that the
   register describes it (exit 0). The procedure is in `docs/compliance/mutation-register.md`, "Filing a
   measurement". The record was seeded this way on 2026-10-28, from the downloaded reports: all 25 replays
   answered "describes", all 25 modules are fresh on `0eff76c`.
4. **The runbook checks before the tag.** Runbook §3 gains a step before the tag: `npm run build && npm run
   mutation:fresh` must exit 0; otherwise the stale modules are re-measured and filed first.
5. **The release workflow refuses a draft on a stale register.** In `release.yml`, the job that
   cross-checks the tarball runs `node scripts/mutation-fresh.mjs` after its build and test step; a non-zero
   exit fails that job, so no draft is created and nothing can be published.
6. **The release ratchet is unchanged.** It still runs on `release: published`, re-measures the whole
   perimeter and signs its summary (ADR-0079). It now confirms after publication what the check made true
   before the tag, for the part the digest covers.

## Alternatives discarded

- **Recording the digest inside each verdict file.** One file per function; a module spans many files and a
  function with no survivor has none, so a module could not be read off them.
- **Running the check on every pull request.** ADR-0046 decision 3: a change to one module would turn every
  pull request red until someone re-measured it. The check belongs to the release, where the claim is made.
- **Filling the record for the modules not re-measured on 2026-10-28 from the current build.** That would
  write the code that exists, not the code that was measured. Their digests come from the 0.45.0 reports
  instead, and match today's build because their code has not changed since.

## Consequences

- **Stricter than the ratchet's key, on purpose.** Any byte of a built module changes its digest, a comment
  included (`tsc` keeps comments), so such a change requires re-measuring that module before the next tag,
  though the ratchet's key might not have moved. The cost is one `mode=measure` run of that module, not of
  the perimeter.
- **A release that changes a measured module waits for its measurement.** Before the tag, not after
  publication.
- **The workflow change is pushed by the maintainer.** Agent sessions cannot push workflow files; the change
  sits in its own commit.

### What this does not catch

- **The test net.** A fresh module means its code is the code measured, not that the ratchet will answer
  "describes": a stronger test can kill a filed survivor without touching the module, and the ratchet
  reports that filing as one the tree no longer produces. That refusal can still arrive after publication.
- **The whole-net legs.** Their changes are disclosed by the register itself (`netDigest`), not here.
- **A deliberate maintainer.** The record is written by whoever files, as the register is. What makes an
  entry checkable is its run id: the run's commit, rebuilt, gives the same digest, and its merged report
  carries the same source for 30 days.

## What would settle it

- **For A**: at the 0.47.0 tag, `mutation:fresh` exits 0, the release workflow drafts, and the release
  ratchet answers "describes" for every module, or refuses only for a reason in the test net, named.
- **Against A**: a release ratchet refuses a module `mutation:fresh` had called fresh, for a reason in that
  module's code: the digest would then not identify what was measured.

## Reevaluation trigger (mandatory, dated)

Reopen at the first release ratchet that refuses a module `mutation:fresh` called fresh, at the first draft
refused by this step for a reason nobody agreed with, or on 2027-01-28, whichever comes first.

**Trigger set on**: 2026-10-28 · **Watched via**: each release's signed ratchet summary
(`docs/compliance/ratchet-summaries/`) read against the prepare run's `mutation-fresh` step.

## References

- `scripts/mutation-fresh.mjs`, `scripts/mutation-record-source.mjs`,
  `docs/compliance/mutation-measured-sources.json`, `test/unit/mutation-fresh.test.js`.
- `.github/workflows/mutation-ratchet.yml` (`on: release: published`, `workflow_dispatch` inputs `module`,
  `chunk_lines`, `mode`), `.github/workflows/release.yml`.
- `docs/compliance/ratchet-summaries/ratchet-summary-0.45.0.json` (run 39947132062, verdict `refused`).
- ADR-0059, ADR-0046, ADR-0079, ADR-0085, ADR-0088 decision 4; RWD-2026-0183.
