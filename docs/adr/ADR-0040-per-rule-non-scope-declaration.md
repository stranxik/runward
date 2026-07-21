# ADR-0040: per-rule non-scope declaration — every gate names what it cannot verify

**Date**: 2026-07-21
**Status**: proposed
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in the adversarial confrontation of the repo against the arXiv:2605.18747 survey (13-agent read: six readers, two mappers, two judges including a skeptic, three code verifiers), cross-read against ADR-0005 and the manifest surface in `src/lib/conformance.ts`; **candidate position pending maintainer ratification, not a durable position yet**

## Context

runward already practices a specific honesty in one place: [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md) states plainly what the gate does *not* prove — "runward does not, by itself, prove a cited test is honest" — and calls the crisp scope line "a credibility asset, not a gap to hide". The same honesty lives as a comment at the head of `src/lib/conformance.ts`: the strict gate "never opens project code, never runs a test, and never judges whether the pointer truly implements the rule. That judgment stays the operator's, at the gate." Today that honesty exists as prose in one ADR and one code comment. It is not a first-class, machine-readable property of the rule set: a green row says "accounted for", and nothing in the manifest, the rule frontmatter, or the machine surface says what "accounted for" deliberately does not cover.

The current shape, for reference. A rule is a markdown file under `runward/rules/` (else the package's `templates/rules/`, 64 files) with frontmatter `impact` / `phases` / `signature` (`parseRuleMeta`, `conformance.ts`). A deliverable's manifest is the `## Rule conformance` table — three columns, `Rule | Status | Evidence`, one row per rule, status in `applied | deviated | n/a` (`parseManifest`). [ADR-0003](ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md) form-lints that table deterministically before the semantic check; [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md)/[ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) verify and seal the evidence pointers; [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) exposes the rule set as data.

The field survey on code-as-harness (arXiv:2605.18747 — a v1 preprint, not yet peer-reviewed; a survey describes a landscape, it does not validate a product) names this exact abstraction as the missing one, verbatim (§4, `sec_4.tex`):

> "The central missing abstraction is a verification stack with explicit scope. […] Each artifact should declare what it verifies, what it cannot verify, and what confidence it provides."

Two adjacent verbatims sharpen the demand. The survey's evidence bundle attaches to every accepted action "the checks run, the assumptions preserved, the untested regions, and the remaining risks" — and the confrontation graded runward's mapping onto that bundle **partial precisely on this field**: the typed-pointer chain (ADR-0019 → manifest → OSCAL) carries the checks run and their evidence, not the untested regions. And the survey's "epistemically aware" feedback loops ask that "the harness should know when a signal is strong enough to act on, when it is weak, and when additional evidence is required" — with the warning that motivates the whole exercise: "if the verifier is weak, the agent will learn to optimize against the wrong signal."

runward's gate is deliberately narrow ([ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md): presence-of-decision, zero-run, zero-LLM). Narrowness is the design, not the defect — but an *undeclared* narrow check is exactly the weak verifier the survey warns about: a green verdict read as more than it proves. The candidate move is to generalise ADR-0005's honesty from one decision into a property of every rule.

## Decision

**Proposed, pending ratification: generalise ADR-0005 into a first-order principle — every rule in the set may declare its NON-scope, "what this gate cannot verify", and that declaration travels with the verdict.**

The candidate shape (to be confirmed or amended at ratification):

- **A `nonScope` frontmatter field on the rule file**, beside `impact` / `phases` / `signature`: one or two lines stating what a green row for this rule does *not* prove (e.g. for a rule whose signature matches a `file:line` pointer: "verifies a resolving pointer of the declared shape exists; does not verify the code at that pointer implements the rule"). The rule file, not the manifest row, is the right carrier: non-scope is a property of the *check*, identical across missions — putting it on the row would make every mission restate it and let it drift.
- **Carried through the read surfaces.** `rules --json` and `rules explain` ([ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md)) expose the field; the compliance/evidence outputs ([ADR-0016](ADR-0016-runward-compliance-evidence-pack-assembler.md)) carry it so an assessor reading a green verdict also reads its declared blind zone. This is the direct answer to the survey's "untested regions, and the remaining risks" field, scoped to what runward is: a delivery gate recording decisions, not a runtime recording actions.
- **What stays out, regardless of ratification.** No confidence scores — the survey's "what confidence it provides" belongs to runtime verifiers with graded signals; a deterministic gate's confidence is structural (forgeable or not, the [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) partition question), not scalar. No LLM anywhere in the path (ADR-0001/[ADR-0007](ADR-0007-advisory-llm-conformance-verification.md)). Nothing executed (ADR-0005). The declaration is static text verified for form, never a computed assessment.

**Precondition to ratification — costed, not hand-waved.** If accepted, the manifest form and the deterministic form-lint ([ADR-0003](ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md)) evolve: `parseRuleMeta`, the lint pass, the rule template, the machine surface, and a tracked migration ([ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md)) touching the 64 shipped rule files. That sizing note is a required input to the ratification decision and is deliberately **not** produced inside this ADR: a candidate does not pre-commit its own implementation bill.

## Alternatives discarded

- **Keep the honesty as prose (status quo).** ADR-0005's credibility asset stays local to one decision and one code comment; the machine surface keeps answering "what passed" without "what passing means". This is the gap the survey names; leaving it costs nothing today and compounds as the rule set grows.
- **Per-row non-scope in the manifest.** Restates a property of the check in every mission's table; widens the table [ADR-0003](ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md) lints; drifts from the rule definition silently. Rejected as carrier even if the principle is ratified.
- **Confidence levels per rule.** Imports the survey's runtime framing wholesale. A zero-run gate has two structural confidence classes at most — unforgeable or advisory — and those are already partitioned by tier ([ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md)); a scalar would be theatre.
- **Full evidence-bundle parity with the survey.** The bundle attaches to accepted runtime *actions*; runward records delivery *decisions* and is "never the thing that runs" ([ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md)). Adopting the whole object would blur the line the product is built on; the non-scope field is the one element of the bundle that maps onto a decision gate honestly.

## Consequences

**If ratified:**

- **Positive.** The verdict becomes epistemically explicit: green means "these declared checks passed, and each check names its blind zone". The scope line ADR-0005 drew for one mechanism becomes uniform across the 64 rules, machine-readable, and citable — including toward assessors consuming the compliance pack. It closes the one field on which the confrontation graded the evidence-bundle mapping partial.
- **Negative, accepted if ratified.** More frontmatter to maintain, and a real boilerplate risk: "this gate does not run code" repeated 64 times is noise, not honesty. Mitigation to decide at ratification — likely a shared structural default (the gate-wide non-scope, stated once) plus per-rule specifics only where a rule's blind zone is narrower than the default.
- **On other boundaries.** No change to the exit-code contract, the zero-run/zero-LLM invariants, or the tier partition; this makes an existing property visible, it does not add a verification capability.

**If rejected:** ADR-0005 and the `conformance.ts` header remain the record of the gate's honesty; this file stays as the dated record that the generalisation was considered against the field survey and declined, with the reasons above.

## Reevaluation trigger (mandatory, dated)

This is a candidate: the trigger governs the **ratification decision**, not a watch on the world. Decide — accept (moving Status to `accepted` and commissioning the sizing note first) or reject (moving Status to `rejected`) — at the first groom after the sizing note exists, and no later than **2026-10-01**. If neither has happened by that date, the candidate lapses to `rejected` by default: an unratified generalisation must not sit half-open while the rule set evolves under it.

**Trigger set on**: 2026-07-21 · **Watched via**: the ADR journal at each groom.

## References

- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md) — the honesty this generalises ("a credibility asset, not a gap to hide").
- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md), [ADR-0003](ADR-0003-deterministic-form-lint-of-the-conformance-manifest.md), [ADR-0019](ADR-0019-typed-evidence-pointers-verified-at-the-gate.md), [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md), [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) — the manifest, lint, evidence and machine surfaces this would touch.
- [ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md) — the migration mechanism any rule-set change rides on.
- [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) — the tier partition that already answers "what confidence" structurally.
- `src/lib/conformance.ts` — the current manifest shape (`parseRuleMeta`, `parseManifest`) and the header comment stating the gate's scope.
- arXiv:2605.18747v1, *Code as Agent Harness* (§4, `sec_4.tex`) — "a verification stack with explicit scope", "declare what it verifies, what it cannot verify", the evidence bundle's "untested regions, and the remaining risks", "epistemically aware" feedback loops. A v1 preprint; cited as a field description, not as validation.
- The runward × arXiv:2605.18747 confrontation note (2026-07-21) — action 8, and the partial grade on the evidence-bundle mapping this responds to.
