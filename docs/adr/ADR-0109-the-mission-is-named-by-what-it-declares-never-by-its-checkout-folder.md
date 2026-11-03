# ADR-0109 — The mission is named by what it declares, never by its checkout folder

**Date**: 2026-10-28
**Status**: accepted (2026-10-28) — the maintainer chose A: every machine surface that names the mission
reads the name from `runward/mission-contract.md` (`# Mission Contract: <name>`), with one deterministic
fallback (`mission`) when nothing is declared; the checkout folder's basename appears nowhere
**Deciders**: the maintainer. Written by an agent session on the maintainer's decision; under ADR-0088
decision 4 the maintainer is the single accountable person, and the agent's writing is disclosed
throughput, not independent review
**Method**: measured on 2026-10-28 at `20b56d2` (0.46.0): `node dist/cli.js check --strict --attest`,
`--witness <f>` and `--vsa --resource-uri pkg:npm/runward@0.46.0` under one `SOURCE_DATE_EPOCH`, on
macOS arm64 and Linux x64, in checkouts named `demo-mac` and `w`; then every `basename(` of `src/`
read (`attestation.ts`, `check.ts`, `bundle.ts`, `compliance.ts`, `characterize.ts`), `verify.ts` read
for what it compares, `docs/spec/runward-oscal-mapping.md` §5 and §7, ADR-0054, ADR-0055, ADR-0024,
ADR-0030; reproduced on a fresh clone with two copies of `init --example` under those two names
**Relates to**: [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (the invariant this restores),
[ADR-0055](ADR-0055-the-verdict-is-a-standards-legible-attestation.md) (the surfaces that carried the
folder name), [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) and
[ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md) (the additive
rule a changed value is measured against), [ADR-0076](ADR-0076-oscal-1-2-3-a-widening-measured-not-announced.md)
(the last OSCAL spec revision), RWD-2026-0186 in [known-defects.md](../compliance/known-defects.md)

## Context

**What ADR-0054 says.** "Same working tree ⇒ same verdict and same machine outputs": `check --strict
--json` is byte-identical across two runs, and ADR-0055 extends it to the attestation ("byte-idempotent
on an unchanged tree: the subject digest and the predicate are both pure functions of the mission on
disk") and to the bundle statement.

**What was measured.** With the same tree and the same clock, the in-toto attestation and the VSA were
byte-identical across macOS and Linux only when the two checkouts had the same folder name. Under
`demo-mac/` and `w/`, `check --attest` differed in `subject[0].name` and `predicate.mission`
(`"demo-mac"` against `"w"`), and `check --vsa` in `subject[0].name`. The witness was identical: it
writes every path relative to the project root and never the root's name (`docs/spec/witness.md`).

**Where it came from.** `src/lib/attestation.ts` put `basename(root)` in the subject of both statements;
`src/commands/check.ts` put it in the attestation's predicate (`mission`, "the mission's own name" in its
comment, which the folder name is not) and in the digest the JUnit rendering's `runward.rendering`
property names; `src/commands/bundle.ts` put `basename(root ?? cwd)` in the bundle predicate;
`src/commands/compliance.ts` passed it to `renderOscal` as the component `title`, the metadata title
and the `<ns>` of every UUID seed, which `docs/spec/runward-oscal-mapping.md` §5 had written down as
"the project root's directory basename". The folder name is not part of the tree: it is where the
operator cloned, so two people verifying the same release from differently named clones held two
different attestations of one state. `check --json` is a different case: its `mission` is the project
root, an absolute path, and `docs/interop.md` says so; the local payload names where it ran. The
attestation replaced that path precisely to be portable, and replaced it with something still local.

**What the mission already declares.** `templates/mission/mission-contract.md` opens with
`# Mission Contract: [system or mission name]`; `init --idea` fills the bracket, the reference example
reads `Inbound Request Triage`, runward's own reads `runward`. It is the one field of the scaffold
whose job is to name the system under delivery, it is in the tree, and the subject digest already
covers it. No other field of the scaffold names the mission (`framing.md` carries the same title;
`scaffold-lock.json` names the corpus, not the mission).

**What `verify` reads.** `runward verify` re-derives the subject digest and the verdict, compares the
predicate field by field and lists `mission` among the fields it does not re-derive; it never reads
`subject[].name`. A bundle is verified by re-hashing each subject by the path its `name` gives; the
bundle's `predicate.mission` is not read. So the field that varied was one no verifier ever used,
and the field that binds, the digest, never varied.

## Options considered

- **A. The declared name, with one fallback.** Read the title of `runward/mission-contract.md`; when
  the file, the heading or a real title is absent (the scaffold's whole-bracket placeholder counts as
  absent), use the literal `mission`, the word `renderOscal` already used for an empty name. The same
  function serves every surface.
- **B. A digest-derived name.** Name the subject by a prefix of the mission-state digest. Deterministic
  and declaration-free, but every edit of the tree renames the mission, so an OSCAL component would
  change identity at every pack, and a human reading the subject learns nothing.
- **C. Keep the folder name and document it.** Honest and cheap, and it keeps ADR-0054's sentence
  false for three emissions.
- **D. A new declared field** (`name:` in `scaffold-lock.json` or a front-matter key). One more thing
  to fill, for a value the contract already holds.

## Decision

**A**, decided by the maintainer on 2026-10-28.

1. **One function names the mission.** `declaredMissionName(missionDir)` in `src/lib/mission.ts`
   returns the title of `runward/mission-contract.md` (`# Mission Contract: <name>`, white space
   collapsed and trimmed, the heading found anywhere in the file), or `UNDECLARED_MISSION_NAME`
   (`mission`) when the file is missing or unreadable, the heading is absent, the title is empty, or the
   title is wholly a bracket (the scaffold's placeholder). It reads one file; it never reads the folder
   name, the absolute path, git, or the clock.
2. **Every machine surface that names the mission uses it.** Old value → new value, for the same tree:
   - `check --attest`: `subject[0].name` and `predicate.mission`: the checkout folder's basename →
     the declared name (`demo-mac` / `w` → `Inbound Request Triage` on the reference example; `mission`
     on a scaffold nobody named).
   - `check --vsa`: `subject[0].name`: the same change.
   - `bundle`: `predicate.mission`: the checkout folder's basename → the declared name; with no mission
     found, the current directory's basename → `mission`.
   - `compliance <regime>` (the OSCAL component-definition): `components[0].title`, the suffix of
     `metadata.title`, and the `<ns>` of every UUID seed of spec §5: the folder's basename → the
     declared name. `docs/spec/runward-oscal-mapping.md` moves to **1.2**: the shape is unchanged, the
     derivation of `<ns>` is, and the normative example is regenerated (`UPDATE_GOLDEN=1`, because the
     golden mission's folder was `golden-mission` and its scaffold declares no name, so the fixture now
     reads `mission`).
   - `check --junit`: the `runward.rendering` property's `payload-sha256` is the digest of the payload
     with `mission` replaced by the declared name, as `--attest` does.
3. **Unchanged, by design.** `check --json` keeps `mission` = the project root (documented; the local
   payload says where it ran, and the two-folder test asserts this is the only field that differs).
   The witness, the SARIF log, the Code Quality report and the HTML delivery report never carried the
   folder name. `characterize` keeps the folder name in the heading of the Markdown it writes: it runs
   on a repository with no mission, and the heading is prose, not a machine field. `runward verify`
   is not changed.
4. **Compatibility of older attestations.** None is needed for `verify`: it never compared `mission`
   (listed as not re-derived) nor `subject[].name`, the digest definition is untouched, and a bundle's
   subjects are its artifacts' paths. An attestation written by 0.35.0 to 0.46.0 verifies against its
   tree exactly as before, and its `mission` field reads as what it is, the folder it was made in. No
   dual read. For OSCAL, a 1.1 pack and a 1.2 pack of the same tree carry different UUIDs: a GRC tool
   that imported the 1.1 pack and keys on UUIDs sees the 1.2 pack as a new component once, which the
   spec's version line states.
5. **The register.** RWD-2026-0186, `class` `machine-surface`, `affected-from` 0.35.0 (the first release
   with `--attest`, `f1a85b3`), `found-by` `measurement`.

## Alternatives discarded

- **B** renames the mission at every edit; the subject name should identify what is delivered, the
  digest identifies its state, and the two should not be the same thing.
- **C** leaves the measured contradiction in place.
- **D** adds a field for a value the scaffold already asks for, and a mission that filled neither
  would still need A's fallback.

## Consequences

- **Same tree, same bytes, wherever it was cloned.** The two-folder control
  (`test/unit/mission-name-independent-of-checkout.test.js`) holds `--attest`, `--vsa`, the bundle
  predicate and the OSCAL pack byte-identical across `demo-mac/` and `w/`, and `--json` identical
  outside its documented `mission`; a positive control changes the declared title and shows the name
  move where the folder no longer can.
- **A mission nobody named is named `mission`.** The fallback is deliberate and visible: an
  attestation whose subject reads `mission` says the contract's title is still the placeholder. The
  gate does not refuse it; naming the mission is the operator's gesture, not the verdict's business.
- **An existing attestation's `mission` changes meaning on re-emission**, from the folder to the
  declaration, with no change of digest. A consumer that stored attestations keyed on `mission`
  sees a new key once.
- **The OSCAL normative example changes** (UUIDs and titles), as it did for 1.1.

### What this does not catch

- **Two missions declaring the same title.** The name is not an identity; the digest is. Two projects
  both titled `Inbound Request Triage` produce two attestations with the same subject name and
  different digests, as two folders both named `w` did before.
- **A title edited after the attestation.** The contract is in the tree, so the digest moves, and
  `verify` reports drift, as for any edit.
- **A renamed heading.** A contract with no `# Mission Contract:` heading is read as undeclared. The
  scaffold's heading is the declared form; a mission that rewrites it names itself `mission` until it
  restores it.

## What would settle it

- **For A**: the next release's `check --attest` on this repository, from two differently named
  clones on two operating systems, gives one digest (the demonstration of 2026-10-28, rerun at the
  tag), and no adopter reports a consumer that needed the folder name.
- **Against A**: an adopter whose contract cannot carry the name the attestation must show (a
  localized heading, a generated contract), or a consumer that keyed on the old `mission` value and
  cannot be told once.

## Reevaluation trigger (mandatory, dated)

Reopen at the first report of a consumer that keyed on the folder name, at the first mission whose
contract cannot declare its name in the scaffold's heading, or on 2027-04-28, whichever comes first.

**Trigger set on**: 2026-10-28 · **Watched via**: the register (any entry naming `subject[].name`
or `predicate.mission`) and the two-folder test.

## References

- `src/lib/mission.ts` (`declaredMissionName`, `UNDECLARED_MISSION_NAME`), `src/lib/attestation.ts`,
  `src/commands/check.ts`, `src/commands/bundle.ts`, `src/commands/compliance.ts`.
- `test/unit/mission-name-independent-of-checkout.test.js`, `test/unit/verdict-attestation.test.js`,
  `test/fixtures/golden/oscal-component-definition.json` (regenerated).
- `docs/spec/runward-oscal-mapping.md` (1.2), `docs/interop.md`, `docs/gitlab.md`.
- ADR-0054, ADR-0055, ADR-0024, ADR-0030, ADR-0076, ADR-0088 decision 4; RWD-2026-0186.
