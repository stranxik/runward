# ADR-0060: a vacuous green is disclosed, not refused

**Status**: accepted 2026-08-27
**Date**: 2026-08-27
**Extends**: [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) (the documentary boundary) and
[ADR-0004](ADR-0004-prose-is-legitimate-where-nothing-can-be-pointed-at.md) (prose is legitimate).

## Context

Measured on the fixed tree on 2026-08-26, after the day's thirty-three defects were closed: delete
`code/`, point every `applied` row at one of the mission's own deliverables, and `runward check
--strict` returns **exit 0, verdict `clean`, `22 of 22 applied row(s) … (100%)`**, `--freeze` seals
six files, and `runward compliance iso-42001` assembles the pack. On a mission citing no code, no
test and no ADR.

None of the day's fixes reach it, because it is not a defect in any check. Every row does carry a
pointer the gate opened and checked. The gate is telling the truth, and a reader draws a conclusion
the gate never claimed. The honest mission reads **87%**; the empty one reads **100%**.

**The project already named this phenomenon.** RWD-2026-0003, in its own register: answering `n/a`
to every rule *"removed the only vacuity signal the product had, and the emptiest missions produced
the most reassuring output"*. The doctrine existed; it had never been asked at the level of "does
this mission cite anything outside itself".

## Prior art, and why it does not all point one way

- **Vacuity detection in temporal model checking** (Beer, Ben-David, Eisner & Rodeh, CAV 1997;
  Kupferman & Vardi) is the exact analogue. `AG(req → AF grant)` — "every request is eventually
  followed by a grant" — is satisfied *vacuously* by a system that never sends a request. The field's
  conclusion is that a vacuous pass hides real modelling errors and **must be reported as vacuous**.
  Here: "every applied rule resolves to evidence" is vacuously true when nothing is applied to code.
- **pytest** exits **5**, not 0, when no tests are collected — deliberately, so "everything passed"
  and "nothing ran" are different exit codes.
- **Jest** fails by default (`No tests found, exiting with code 1`) and names the escape,
  `--passWithNoTests`. The vacuous pass exists, but only as an explicit opt-in.
- **ISA 705** — an auditor who cannot obtain sufficient appropriate evidence, where the effect is
  material and pervasive, issues a **disclaimer of opinion**: *"we do not express an opinion"*.
  Neither pass nor fail: no opinion.

## Decision

**Follow ISA 705, not pytest.** A mission that cites only its own documents stays **green**, and the
run says so.

ADR-0054 makes this gate documentary and explicitly not a runtime. A documentation-only mission is
therefore legitimate, and refusing it would contradict the boundary this product declares in order
to catch a reader's inference. What must change is not the verdict but the reporting: the fact is
**counted**, **said**, and **carried in the machine contract**.

1. `evidenceBreakdown` counts the distinct evidence files a mission's rows resolve to, and how many
   live **outside the mission directory** (`evidenceFiles: { total, external }`). No new resolution:
   the same pointers, the same bases, only the destination recorded, so it cannot disagree with the
   `typed` counter beside it.
2. When `external === 0` on a mission that has rows, `check` prints the disclaimer: *all N file(s)
   this mission cites live inside the mission directory … that is a legitimate state for a
   documentation-only mission and it is NOT a gap.*
3. The coverage line names where the checked pointers land — `100%, all 1 inside runward/` versus
   `87%, in 12 file(s) of which 11 outside runward/`. One clause, and the inference is gone.
4. `evidence.evidenceFiles` joins the ADR-0030 machine contract, so a CI or a policy engine can
   branch on it without reading prose. `runward verify` re-derives it like every other predicate
   field (RWD-2026-0042).

**If this ever becomes a refusal, it takes Jest's shape**: a named opt-in flag, never a silent pass.

## Consequences

- **Positive.** The discriminator needed no new computation and is falsifiable: 11 of 12 external on
  the shipped example, 0 of 1 on the code-free mission. The gate's declared scope is unchanged, so
  no honest mission newly reds. RWD-2026-0003's phenomenon now has a signal at the level it lacked.
- **Negative.** `external` is a location, not a judgement: evidence outside `runward/` can still be
  paperwork, and a legitimate mission whose code genuinely lives inside the mission directory reads
  the disclaimer. It is printed as a statement, never as a gap, precisely because it cannot be a
  verdict.
- **Accepted cost.** One more field in the ADR-0030 contract, and one more field `verify` must
  re-derive. The suite went red the moment the field landed without the re-derivation, which is
  RWD-2026-0042's guard doing its work.

## Reevaluation trigger

**Trigger set on**: 2027-02-27.

The decision is wrong and must be revisited if: an operator reports the disclaimer on a mission
whose code legitimately lives inside `runward/` and the wording sends them to change a correct
layout; or a consumer is found branching on `external` as if it were a gate; or a real deployment
produces a vacuous green that this disclosure did NOT surface — which would mean the discriminator
is the wrong one, not that the disclosure is the wrong shape.

**Watched via**: `test/unit/gate-missing-nets.test.js` (both directions),
`test/unit/check-contract.test.js` (the contract), and any report of a surprising disclaimer.
