# ADR-0073 — How a report becomes citable evidence

**Date**: 2026-09-11
**Status**: proposed
**Deciders**: the maintainer
**Method**: measured while executing ADR-0065's arming order, which stopped on this

## Context

ADR-0065 sequenced the evidence-nature requirement deliberately: teach it, demonstrate it in the
shipped example, document it, and only THEN let it refuse. Step one shipped on 2026-09-11 (`explain`
now prints `requires:` with a citable form per nature). Step two does not fit, and the reason is
structural rather than a missing chore.

**Three measurements, taken 2026-09-11.**

1. **The shipped CI adapter runs only runward.** `templates/adapters/github-actions.yml:28` is
   `npx --yes runward check --strict`, and there is no test step before it. So a report the gate can
   read must already exist in the tree when the gate runs — it cannot be produced by the same
   workflow, because the workflow the product ships does not produce it.
2. **The product does not satisfy its own requirement.** `check --strict --json` on runward's own
   mission reports **16 unmet natures** (junit 5, eslint 4, adr 4, sarif 2, loadtest 1), and
   `git ls-files` finds no committed JUnit, SARIF or LCOV report anywhere in the repository. The rule
   corpus demands a nature the corpus's own author does not supply.
3. **The obvious fix injects the generating machine into the showcase.** `node --test
   --test-reporter=junit` on the shipped example emits, per test case, `file="/private/tmp/.../
   examples/request-triage/code/test/triage.test.ts"` plus a per-case `time="0.003020"`. Committing
   that would put an absolute path and a timing into a tree this project holds byte-deterministic,
   and it is the same class ADR-0071 exists to remove from the delivery report. Hand-normalising it
   would mean shipping a test report nobody's test run produced, in the one place a newcomer looks
   to learn what honest evidence is.

So the sequence cannot advance by adding a file. What is missing is a decision about **where a
citable report comes from**, and the answer determines whether the nature can ever be armed.

## Decision

**Proposed** — three shapes, and the choice is the maintainer's because each spends something the
others keep:

1. **The report is committed, and the product says how to make it committable.** The nature stays as
   it is; runward documents (and for the example, ships) a normalising step that strips absolute
   paths and timings, and the example commits the result. Cost: a report in version control, which
   is a habit most teams rightly avoid, plus a normaliser runward must maintain and whose output is
   no longer byte-identical to what the test runner wrote. Buys: the gate stays a pure reader of the
   tree, which is ADR-0054's whole posture, and `check` needs nothing around it.
2. **The report is produced in the job, and the adapter says so.** The shipped adapters gain a test
   step before the gate step, so the report exists for the length of the run and is never committed.
   Cost: the adapter stops being one line, it has to guess the project's test command (or ask the
   operator to fill it), and a gate run outside CI — the operator's own `check --strict` — has no
   report unless they ran their tests first, so the disclosure will fire locally and not in CI, which
   is a confusing asymmetry. Buys: no report in git, and the evidence is as fresh as the run.
3. **The nature is satisfied by a declared external run.** An applied row may cite a report by
   reference rather than by file (a CI run id, an artifact URL), and runward records the reference
   without opening it. Cost: this is the weakest of the three by construction — runward would be
   attesting that a claim names a report, not that a report says what the claim says, which is the
   difference the whole `requires:` field was built to create. It also reaches outside the judged
   tree, which ADR-0054 crossing 4 refuses in the verdict path.

Whatever is chosen, two consequences ride with it. The arming step of ADR-0065 stays blocked until
it is implemented (measured: arming today turns `init --example` from `clean` to 18 refusals, so the
first command the product recommends would fail). And runward's own mission must satisfy the natures
it demands, or the corpus must say plainly which natures a documentation-only mission cannot carry —
the product cannot ask of others what it declines to do.

## Alternatives discarded

- **Drop `requires:` and go back to a bare pointer.** It would retire the one field that separates
  "a decision is traced" from "the practice held at sealing time", which is the product's thesis.
- **Arm it anyway and let the example fail.** Measured: 18 refusals on the showcase. A product whose
  own demonstration cannot pass its own gate is not a product to ship.
- **Fabricate a plausible report for the example.** Refused on principle, and the principle is the
  one the example exists to teach: evidence is produced, never composed.

## Consequences

- **Positive**: the arming order stops being blocked by an unnamed question; and whichever option
  wins, the product stops demanding a shape it does not supply.
- **Negative, per option**: option 1 puts a report in git and needs a normaliser; option 2 grows the
  adapter and creates a local/CI asymmetry; option 3 weakens the field to a reference check.
- **On other boundaries**: option 3 touches ADR-0054 crossing 4 (reading beyond the judged tree) and
  would need that crossing amended or the option narrowed; options 1 and 2 leave the verdict path
  untouched.

## What would settle it

For option 1 or 2: the shipped example passes `check --strict` with at least one row whose evidence
is a genuine report, produced by the example's own tests, with no absolute path and no hand-editing
in its provenance. If that cannot be produced, the option is not implementable and the measurement
says so. For option 3: an assessor states whether a cited run reference is evidence to them, which
is the one part of this decision that needs a third party.

## Reevaluation trigger (mandatory, dated)

The arming step is attempted without this decided (the example then fails and the reason will be
this ADR), or a fourth shape appears — most plausibly a test runner whose report is
path-independent and timing-free by default, which would make option 1 free.

**Trigger set on**: 2026-09-11 · **Watched via**: `requiresUnmet` on the repository's own mission,
which is 16 today and is the number this ADR must move
