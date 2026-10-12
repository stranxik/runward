# ADR-0091 — Machine-checked proofs as evidence: a ratified statement, a kernel-checked proof, read and never run

**Date**: 2026-10-12
**Status**: accepted (2026-10-12) — class R under ADR-0088 decision 2 (its increment 1 touches the
verdict path: `evidence.ts`, `tool-adapters.ts`, `conformance.ts`, `ratify.ts`, all on the critical
list of ADR-0090 decision 10). The maintainer accepted the record with the three recommended answers:
(1) increment 0 now, a recipe with no verdict change, and increment 1, the `proof` nature in the gate,
only on its trigger (an adopter or the ADR-0052 pilot with a Lean statement to carry, AND the ADR-0089
checker running in CI); (2) no new `proof:` prefix: the later nature is spelled
`file:<report>#<Theorem>@<sha256>`; (3) a row citing a proof requires a bound ratification in every
tier. An agent wrote this record and only records the decision; the maintainer decided (ADR-0088
decision 4, applied to decisions as to rows)
**Deciders**: the maintainer
**Method**: a fresh clone of `stranxik/runward` at `origin/main@5ad619f`, plus the branch
`docs/adr-0090-assurance-modes` (PR #377), read on 2026-10-12: `src/lib/evidence.ts`,
`tool-adapters.ts`, `conformance.ts` (`rowDigest`, `unboundRatifications`), `ratify.ts`, `verdict.ts`,
`witness.ts`, `claims-rules.ts`; `docs/spec/witness.md`; `test/audit-corpus.js` (AC-001 to AC-017);
`scripts/reports-fresh.mjs`; ADR-0011, 0045, 0050, 0054, 0056, 0075, 0080, 0086, 0089, 0090. The code
sites cited below re-read on `origin/main@b9b7ec9` (ADR-0090 merged) on the same day, unchanged. Three
state-of-the-art reports written for the maintainer on 2026-10-12 (AI and proofs; proof assistants for
software; Cedar and guided verification), outside this repository. Two web searches and one page read
on 2026-10-12 for prior art (`leanprover/comparator`; QEDGen `solana-skills` PR #444); comparator's
README and test projects read through the forge API the same day. The npm download count was read from
`api.npmjs.org` on 2026-10-12. Increment 0 was run once end to end on macOS arm64 (recorded in the
recipe, with what was not run)
**Relates to**: [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md),
[ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md),
[ADR-0050](ADR-0050-the-public-claim-is-narrowed-to-the-provable-form.md),
[ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md),
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md),
[ADR-0056](ADR-0056-the-evidence-layer-widens.md),
[ADR-0075](ADR-0075-a-required-nature-the-project-cannot-produce.md),
[ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md),
[ADR-0087](ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md),
[ADR-0089](ADR-0089-the-verdict-carries-its-witness-a-small-checker-that-shares-no-code-re-checks-it.md),
[ADR-0090](ADR-0090-a-mission-chooses-its-assurance-mode-machine-is-a-first-class-choice-honest-only-on-a-named-floor.md)
**Amends, by name**: none. Decision 3 adds a requirement on proof rows only; the regulated tier's rule
for every other row (ADR-0080 part 1) is unchanged.

## Context

**The thesis.** runward's premise under ADR-0090 is that the machine checks the agent's work and the
person owns what only a person can judge. For a critical property of agent-written code, proof
assistants offer the sharpest form of that split: the kernel checks the proof; a person reviews only
the statement. Lean FRO describes its `comparator` (a frozen challenge statement, a list of permitted
axioms, a kernel replay, optionally a second kernel) as the gold standard for an untrusted prover. The
Lean reference manual lists what remains assumed at every level: "No human error or misleading
presentation of the theorem statement".

**What runward already has.**

- Committed-report adapters, content-detected, read and never run (ADR-0056, ADR-0054). The `#` operand
  of a `file:` pointer is already read structurally per report: a SARIF `ruleId`, an LCOV source file,
  an SBOM `name@version`.
- Requirable natures (`REQUIRABLE_NATURES`, ADR-0075): `junit`, `sarif`, `eslint`, `coverage`, `sbom`,
  `adr`, `loadtest`.
- Ratification bound to a row (`rowDigest`, ADR-0080): SHA-256 of rule, status and the **evidence cell
  text**, whitespace folded, truncated to 16 hex characters.
- A replayable attack corpus in both directions (AC-001 to AC-017).

**What was measured, and changes the design.**

1. `rowDigest` does not read the files a cell cites. Editing a cited statement file unbinds nothing
   unless the statement's digest is written in the cell.
2. `unboundRatifications` is counted only under `"regulated": true` (`verdict.ts`, `if (regulated.on)`).
   Outside the tier, an agent that edits a statement and the digest in the cell together is stopped by
   nothing the gate reads.
3. Report freshness is not in the gate. RWD-2026-0113's fix is `scripts/reports-fresh.mjs` in runward's
   own CI, not shipped; ADR-0086's amendment of 2026-10-01: "For an adopter the behaviour is unchanged".
   A proof report can carry the digests of its inputs, which the gate can recompute by reading files:
   the first report nature whose freshness is checkable inside the boundary.
4. `comparator` has no structured output; its verdict is its exit code. A proof report is therefore a
   format runward would define (tension with ADR-0011 and ADR-0075, precedent in `docs/spec/witness.md`).
5. The pointer grammar `file|test|adr` is hard-coded at six sites (`evidence.ts` lines 60, 93, 101;
   `conformance.ts` 494; `docs/spec/witness.md` 620 and 658). ADR-0045 class 7: "No new syntax".
6. The witness checker of ADR-0089 (step 4) is not built; ADR-0090's floor items M3, M4, M6, M7 and M8 are
   not in force. ADR-0089 Consequences: "every new family the gate judges needs a witness field and a
   checker check, or it lands in `notWitnessed`".
7. Audience. No third-party mission is known (ADR-0052's pilot is waiting); 1,692 npm downloads from
   2026-09-11 to 2026-10-10, bots and CI included. No target buyer found writing Lean on production code;
   regulated formal-methods practice is more often SPARK, Frama-C or Atelier B. Agents prove software
   poorly in Lean today (Verina: 4.9 % of proofs at one attempt; the vericoding benchmark: 27 % in Lean,
   44 % in Verus, 82 % in Dafny).
8. Prior art. CI jobs that fail on `sorryAx` or a non-standard axiom are now common in Lean repositories.
   QEDGen's PR #444 (merged 2026-10-01) gates axioms on a per-spec allowlist under `--strict`, running
   Lean itself. Nothing tooled was found that reads a committed proof report and binds it to a ratified
   requirement row; the search was short, so this is "nothing tooled found", not an established absence.
9. Measured while building increment 0 (Lean v4.35.0-rc4, comparator `ca04cfc7`): `native_decide` no
   longer shows as `Lean.ofReduceBool` but as an auxiliary axiom named
   `<declaration>._native.native_decide.ax_…`; a fixed list refuses it either way, as a user axiom.
   `landrun`, comparator's sandbox, is Linux-only; on macOS the run used comparator's development shim,
   with no sandbox.

## Decision

**A row may rest on a kernel-checked proof of a ratified statement. Today it does so through a JUnit
case written by a reference job in the adopter's repository (increment 0). Later, on a trigger, the
gate reads a committed proof report itself (increment 1). In both, runward never runs Lean, and what is
said is that a ratified statement has a kernel-checked proof recorded in a committed report, and
nothing about the code.**

1. **When: increment 0 now, increment 1 on its trigger.** Increment 0 is the recipe
   [`docs/recipes/lean-proofs-as-junit.md`](../recipes/lean-proofs-as-junit.md), carried by the
   qualification kit (ADR-0087): a reference CI job in the adopter's repository that runs `comparator`
   with runward's axiom list and a second kernel, prints each theorem's axioms (`#print axioms`), scans
   the sources for forbidden constructs, and writes one JUnit case per theorem whose name carries the
   theorem name, the SHA-256 of the frozen statement file and the axioms. The mission row cites it with
   `test:`, so the digest enters `rowDigest`. The job re-runs in CI as a required check and compares
   its output with the committed report, and the report is attested, both outside the verdict path. No
   change to `src/`.

   **Trigger for increment 1:** an adopter, or the ADR-0052 pilot mission, with a Lean statement to
   carry on a row, **and** the ADR-0089 checker running on runward's CI. Both, not either.

2. **The spelling: no new prefix.** Increment 1 reads
   `file:<report>#<Theorem.name>@<sha256 of the statement file>` through a proof adapter when the file
   is a `runward-proof-report/1` report, as SARIF and SBOM are read today, with a new nature `proof` in
   `REQUIRABLE_NATURES`. The report keeps the name and the digest in separate fields, so a runward
   version without the adapter reads the operand as an absent substring and refuses: the downgrade
   fails closed (to be pinned by a test).

3. **A row citing a proof requires a bound ratification in every tier.** The printed sentence says
   "ratified"; without a ratification bound to the row's current digest the row reads « statement not
   ratified » and is a strict gap, in every tier. Other rows keep ADR-0080 part 1 unchanged. Until
   increment 1, the gate counts an unbound ratification only under the regulated tier, and the recipe
   says so: outside it, the requirement is the adopter's to keep.

### What increment 1 builds, on its trigger

- **The report, `runward-proof-report/1`.** Canonical JSON (sorted keys, no timestamps, no run
  identifiers), specified in `docs/spec/proof-report.md`, expand-only versioning: `schema`; `prover`
  (`"lean4"`); `toolchain` (the content of `lean-toolchain`); `pins` (digests of `lean-toolchain` and
  `lake-manifest.json`); `statementFile` and `statementSha256`; `sourceRoot` and `sources` (path to
  digest, every `.lean` file under the root); `comparator` (`config`, `configSha256`, `passed`);
  `kernels` (`{name, version, passed}`, `lean4` required); `theorems[]` (`name`, `axioms` as printed by
  `#print axioms`, `kernelChecked`, `controls[]` of the same shape); `commit` (informative: the gate
  reads no git, the attestation binds it).
- **What the gate checks, by reading only.**
  - the report resolves, is regular, is not circular, has the schema;
  - the named theorem is present, `kernelChecked`, and listed in the `comparator` config's
    `theorem_names`, whose digest matches the file on disk;
  - every axiom is in a list fixed by runward: `propext`, `Quot.sound`, `Classical.choice`. Refused by
    name: `sorryAx`, `Lean.ofReduceBool`, `Lean.trustCompiler`, any user axiom. No setting widens the
    list; a project that needs another axiom records the row `deviated` with an ADR;
  - every digest the report carries equals the file on disk (`normalizedFileSha256`), and `sources`
    is exactly the set of `.lean` files under `sourceRoot`: a modified, added or removed file makes the
    report stale;
  - the statement digest in the pointer equals `statementSha256` and the file on disk;
  - independently of the report, a scan of the sources with comments removed for `sorry`, `admit`,
    `native_decide`, `implemented_by`, `@[extern`, `unsafe`, `axiom`, and, in the statement file only,
    `partial` and `opaque`. A hand-edited report that omits `sorryAx` is refused here. A forbidden word
    inside a string literal is a false red, named in the message: it fails on the safe side;
  - at least one sensitivity control per theorem (`controls[]`), kernel-checked, with its statement in
    the statement file: a property that must fail on a stated variant of the model. A statement
    reduced to `True` admits no such control.
- **The statement freeze reuses ratification.** The digest in the cell puts the statement under
  `rowDigest`. `ratify`, on a proof row, displays the whole statement file (definitions, theorems,
  controls; not the proofs) before it records `bound:`. A proof may change freely: the cell does not
  change and nothing unbinds; the report must be regenerated or it is stale. A statement change without
  a cell change is refused; a statement change with a new digest in the cell unbinds the ratification.
- **What the gate prints, and never prints.** For a green proof row:

  ```
  proof  <Theorem>: statement <digest prefix> (<statement file>), ratified <date> by <name>;
         a kernel-checked proof is recorded in <report> under axioms <list> on <toolchain>;
         second kernel: <name | none>; sensitivity control: <name>
         link to shipped code: <test: pointer | not cited>
         report attestation: not verified by this command
  ```

  and once per run with at least one proof row: « A proof row says that a ratified statement has a
  kernel-checked proof recorded in a committed report. It does not say that the statement is the right
  property, that the shipped code behaves like the Lean model, or that the report came from the job it
  names. » The words "the code is correct", "proven", "formally verified", "certified" and "guaranteed"
  are never printed about the code, the product or runward; the claims guard gains that class, with its
  usual negation escape (ADR-0050).
- **The link to the shipped code is not established by the proof.** A row cites it with a `test:`
  pointer, in the same cell, to a green JUnit case of a differential test (Cedar's route), or with a
  `file:` pointer to extracted code proved in place where an extraction exists (none exists from
  TypeScript today). Without one, « link to shipped code: not cited » is disclosed. Under the regulated
  tier, a missing link and a missing second kernel are strict gaps.
- **Then.** Increment 2: the proof facts in the witness, re-checked by the ADR-0089 checker (digests,
  the axiom list); until then the result sits under `report-natures` in `notWitnessed`. Increment 3: a
  second prover (Dafny or Verus) by expanding the schema.

### What increment 0 says, and does not

A green case of the recipe says what the run that wrote it observed. The gate reads that case as it
reads any JUnit case: a forged file with the right name is accepted, and freshness is the required
re-run job's, not the gate's (fact 3). The recipe carries that sentence, the exact case-name format,
the axiom list, the forbidden constructs, the statement freeze through the digest in the cell, and the
differential test the link to the shipped code needs.

## The attack cases (increment 1)

| Case | Attack | Refused by |
|---|---|---|
| AC-018 | `sorry` in the proof, honest report | `sorryAx` not permitted |
| AC-019 | `sorry` in the proof, report edited to drop `sorryAx` | the gate's own source scan |
| AC-020 | a user `axiom` added | the fixed list, and the scan |
| AC-021 | `native_decide` | its axiom not permitted, and the scan |
| AC-022 | a vacuous statement, `theorem t : True` | no kernel-checked sensitivity control |
| AC-023 | statement edited after ratification, cell untouched | statement digest differs from the pointer |
| AC-024 | statement edited and the digest in the cell rewritten | ratification unbound, in every tier |
| AC-025 | stale report: a source changed or added after it | source digests and source set |
| AC-026 | a proof of another theorem name | theorem absent from the report or the `comparator` config |
| AC-027 | toolchain changed, report not regenerated | `lean-toolchain` digest |
| AC-028 (honest) | a clean proof using `Classical.choice`, CRLF checkout | must exit 0 |
| AC-029 (honest) | the proof changed, the statement identical, the report regenerated | must exit 0 with no new ratification |

**Declared limits, not corpus cases.** A report forged with correct digests is accepted by the gate, as a
forged JUnit report is; the defence is the re-run job and the attestation, outside the verdict path, and
a unit test pins that the gate prints « report attestation: not verified by this command ». A sensitivity
control unrelated to its theorem, or contradictory hypotheses, are meaning (`GATE_NON_SCOPE`): the person
sees them when ratifying, since they live in the statement file.

## Alternatives discarded

- **A `proof:` prefix.** More legible; six hard-coded sites, a witness spec change, ADR-0045 class 7, and
  an older runward reads it as prose rather than refusing. Decision 2.
- **Run Lean in the gate.** ADR-0054 crossing 5 and the moat; refused.
- **Let the report or the mission widen the axiom list.** The audited party would set its own floor
  (ADR-0090's reasoning on the machine floor).
- **Freshness in the adopter's CI only, as for JUnit, for good.** Acceptable for increment 0, which has
  no verdict change; for increment 1 the proof report makes freshness checkable by reading, and leaving
  it out would repeat RWD-2026-0113 knowingly.
- **Change `rowDigest` to hash cited files.** Rebinds or unbinds every existing ratification and
  enlarges what a row means; the digest in the cell reaches the same freeze for proof rows only.
- **Build increment 1 now.** No measured audience, the ADR-0089 checker not built, the ADR-0090 floor
  incomplete; a family added before the checker is a family added to `notWitnessed`. Decision 1.
- **Require a bound ratification only under the regulated tier.** The printed sentence says
  "ratified"; outside the tier it would be false whenever an agent rewrote statement and digest
  together. Decision 3.

## Consequences

- **Positive.** A row can carry a kernel-checked proof today, with the statement as the only thing a
  person reviews, at no verdict-path cost. On the trigger, the freshness of that evidence becomes
  checked by the gate itself, which no other report nature offers.
- **Negative, accepted.** runward maintains a recipe and a reference job that follow Lean and comparator
  releases (comparator pins its own toolchain and `lean4export`); increment 1 adds a report format,
  a Lean toolchain and a fixture project to runward's CI; ratification of proof rows becomes mandatory
  in every tier, a new cost for those rows only.
- **Increment 0's limits.** The gate cannot tell a recipe case from a hand-written one, and does not
  check its freshness; the required re-run job and the attestation are the adopter's. Outside the
  regulated tier the gate does not refuse an unbound ratification on a proof row until increment 1.
- **On other surfaces, at increment 1.** SARIF, the delivery report and `--json` carry the proof line;
  the claims guard gains a class; `docs/spec/witness.md` gains the `proof` nature detector.
- Estimated cost (not measured): increment 1, 2 to 3 weeks part-time with agents; increment 2, 3 to 5
  days.

## What would settle it

- A first adopter's statement carried through increment 0, ratified, and re-run by their CI as a
  required check, the reference workflow measured on a GitHub runner with `landrun` in place.
- AC-018 to AC-029 each red on a build where the matching check is removed, and green on the full one.
- The downgrade property (decision 2) measured on the last published runward.
- The reference job's duration on a Mathlib-free fixture, measured in CI.

## Reevaluation trigger (mandatory, dated)

Reopen on 2027-04-12, or earlier on: an adopter or the pilot asking to carry a proof; the ADR-0089
checker running in CI (with the first, it fires increment 1); `lake check --paranoid` (announced for
Lean v4.35.0) or a structured `comparator` output shipping, which would replace part of the reference
job; a Lean kernel soundness defect affecting a toolchain a report names.

**Trigger set on**: 2026-10-12 · **Watched via**: the security and support intake (ADR-0084), the
ROADMAP item for ADR-0089 and the one for this record, Lean and comparator release notes.

## References

- `src/lib/evidence.ts`, `tool-adapters.ts`, `conformance.ts`, `ratify.ts`, `verdict.ts`, `witness.ts`,
  `claims-rules.ts`; `docs/spec/witness.md`; `test/audit-corpus.js`; `scripts/reports-fresh.mjs`.
- Increment 0: [`docs/recipes/lean-proofs-as-junit.md`](../recipes/lean-proofs-as-junit.md),
  `docs/recipes/lean-proofs/`, `test/unit/recipe-lean-proofs.test.js`.
- Lean reference, validating proofs: https://lean-lang.org/doc/reference/latest/ValidatingProofs/
- `leanprover/comparator`: https://github.com/leanprover/comparator (read 2026-10-12, commit `ca04cfc7`)
- QEDGen `solana-skills` PR #444: https://github.com/QEDGen/solana-skills/pull/444 (read 2026-10-12)
- Verina: https://arxiv.org/abs/2505.23135; vericoding benchmark: https://arxiv.org/abs/2509.22908
- Cedar, Lean model and differential testing:
  https://aws.amazon.com/blogs/opensource/lean-into-verified-software-development/
- npm downloads, last month: https://api.npmjs.org/downloads/point/last-month/runward (2026-10-12)
