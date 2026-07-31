# ADR-0042: craft-rule confrontation is continuous, not a gate-crossing ritual

**Date**: 2026-07-31
**Status**: proposed (candidate — pending maintainer ratification)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — the Dropyour field report (2026-07-31), reality-checked against the eleven shipped workflows in `templates/workflows/`; the coupling this revises was found empirically, not assumed

## Context

The shipped method couples craft-rule confrontation to gate crossing. This is not an impression; it is visible in the workflow set. Counting mentions of the craft rules across the eleven shipped workflows:

| Workflow | Names the craft rules | Carries a gated manifest |
|---|---|---|
| `architect`, `floor`, `govern`, `handover` | yes | yes |
| `verify` | yes | (the adversarial pass over them) |
| `frame`, `brownfield`, `decision-loop`, `method`, `review`, **`iterate`** | **no** | no |

The rules are named in exactly the workflows that carry a manifest, and nowhere else. The instruction that does exist is phrased around the crossing: `floor.md` says "account for each in the `Rule conformance` manifest… `runward check --strict` verifies that manifest"; `govern.md` the same. The implied doctrine is therefore: *you confront the rules when you fill a deliverable*.

That doctrine contradicts the baseline runward itself writes at `init`. `AGENTS.md` prescribes, verbatim: "Apply the craft rules in `runward/rules/` while building — and confront them **at the point of action, not from memory**." One text says continuously, at the point of action; the workflows carry the gesture only at the crossings. The two have coexisted because nothing forced the question.

The Dropyour field report forced it. An agent rewrote a cron and a secret relay in one afternoon, on code it had just written itself, with `check --strict` green throughout. Reading the rules afterwards, it found `async-job-guardrails` (HIGH) violated on two of its four non-negotiables, and `config-secrets-boundary` (CRITICAL) violated on the egress-key boundary. Both rules are mapped to `govern` — a phase crossed at day zero, on the code of that day. The work happened in the steady state, where the method says nothing about rules.

Two facts bound what this decision may fix. First, the gate behaved exactly as declared: a green row never proved the code implements the rule, and since the amendment shipped alongside this ADR, `GATE_NON_SCOPE` also declares that a green row does not travel forward in time. Second, the corpus has already refused to gate the steady state: ADR-0033 §Alternatives discarded rejects `iterate` as a gated phase by name — "it would either never complete (permanent red on every mature mission) or complete falsely". So the remedy cannot be a gate, and this ADR does not propose one.

The scope question is what makes this a framework decision rather than a local fix. A mission can edit its own copy under `runward/workflows/` today, and `runward update` will leave it alone as `drift (locally modified)`. But the field report's own decisive argument applies to that workaround: Dropyour scaffolds a runward mission per graduated app, so patching one copy leaves every scaffolded mission shipped with the same silent `iterate.md`. A gap that replicates into every mission is a framework gap.

## Decision

**Proposed, pending ratification: decouple craft-rule confrontation from gate crossing. Confronting the rules is a continuous obligation of building, carried by the method into the steady state — and it is a discipline, never a new gate.**

The candidate shape (to be confirmed or amended at ratification):

- **`iterate.md` gains a `Confront the craft rules` step**, in the form the gated workflows already use: name the rules that govern what is being touched, read them rather than work from their names, and do it *before* writing. The gesture available today is `runward rules --phase <phase>` — coarse (the `govern` phase returns 12 rules) but real, and it needs no new machinery. [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md), if ratified, makes the same gesture precise; this decision deliberately does not wait for it.
- **The accounting rides the artifact `iterate` already produces.** The workflow already mandates "one locked ADR per switch, before implementing". When a change is a switch, the ADR that locks it names the rules confronted and how. No new deliverable, no new manifest, no change to `GATED_DELIVERABLES` — the obligation attaches to an artifact the method already requires.
- **For changes that are not switches** — ordinary maintenance, the class the field report actually describes — the confrontation is prescribed but has no artifact. It is a reading discipline. Saying so plainly is part of the decision: an unenforced obligation that pretends to be enforced would be worse than none.
- **Declared non-scope, in the workflow text itself.** `check --strict` does not verify any of this. The step states it, so no operator reads the new prose as a gate. This is the ADR-0040 standard applied to a doctrine change: name what it cannot verify.
- **The other silent workflows stay silent, for now.** `frame`, `method`, `review`, `brownfield`, `decision-loop` are not building phases; adding a rule-confrontation step to each would be ritual. The revision is targeted at the steady state, because that is where the field failure occurred and where most of a product's code is written.

## Alternatives discarded

- **Gate the steady state (a manifest for `iterate`).** Rejected by name in ADR-0033 §Alternatives discarded, and the code confirms it is not rhetorical: a missing gated deliverable yields one violation per expected rule, so the gate would sit permanently red on every mature mission. A manifest that restated the floor manifest would be the vacuous paperwork ADR-0017 and ADR-0002 exist to refuse.
- **Leave it to the operator's own copy.** This is the workaround the field report itself pre-refutes: a gap replicating into every scaffolded mission is a framework gap, not a discipline problem. Patching one mission's `runward/workflows/iterate.md` leaves the fleet blind — and the fleet is exactly where the evidence pack is sold as opposable.
- **Wait for the matcher.** Rejected as a false dependency, and the more tempting error of the two. The doctrine fix costs one file, needs no new field, no ratification of a primitive, and no editorial campaign over the rule set; the matcher costs all four. Coupling the cheap, high-leverage half to the expensive half would delay the only part of the remedy that ships to every mission at the next `runward update`.
- **Amend `AGENTS.md` instead of the workflow.** Rejected: `AGENTS.md` already says the right thing. The defect is that the method does not carry it into the phase where building happens. Restating an instruction that is already correct would not change a single mission's behaviour.
- **Make the step mandatory in the ADR template for every iterate ADR.** Deferred rather than rejected: it would give the obligation an artifact for switches, but the field report's own case was not a switch, so it would miss the reported failure while adding template weight. Revisit if switch-ADRs are observed skipping the confrontation.

## Consequences

**If ratified:**

- **Positive.** The method stops implying that rules are a crossing ritual, and starts carrying them into the phase where most of a product's life happens. The fix ships to every mission — existing ones through `runward update`, new ones at `init` — which is what makes it a framework answer rather than a local patch. It costs one file, is independent of ADR-0041, and closes the most direct plausible cause of the reported violations.
- **Negative, accepted.** The obligation is unenforced: nothing verifies that anyone read anything, and this ADR refuses to pretend otherwise. Its effect rests on the method being read, which is a weaker mechanism than a gate — deliberately, because the corpus has already established that gating this would be worse. And until ADR-0041 lands, the gesture is coarse: `--phase govern` returns 12 rules where three might apply. That is a real cost, and an honest one to state: it turns "read 64 and guess" into "read 12", not into "read the 3 that matter".
- **On other boundaries.** No gate change: exit codes, `GATED_DELIVERABLES`, manifest shape, seal and the zero-run/zero-LLM invariants are untouched. `runward update` treats the changed workflow like any other refreshed method file, leaving locally modified copies alone. ADR-0033's steady-state semantics are preserved exactly — this decision is what remains *possible* once gating the steady state is refused.

**If rejected:** this file stays as the dated record that the rules-confronted-at-crossings coupling was examined against a real field failure and deliberately kept, with the reasons above.

## Reevaluation trigger (mandatory, dated)

This is a candidate: the trigger governs the **ratification decision**. Decide — accept (moving Status to `accepted`) or reject — at the first groom, and no later than **2026-10-01**. The window is shorter than ADR-0041's on purpose: this half is cheap, independent, and delay costs missions.

Once ratified, reopen if (a) a further field report shows rules missed in the steady state *despite* the workflow step, meaning the prose is read past and only a mechanism would carry it — then reconsider the artifact question, still without gating `iterate`; (b) ADR-0041 ships and the coarse `--phase` gesture named here should be replaced by `--for`; or (c) the same silence proves harmful in another non-gated workflow (`brownfield` is the likeliest), making the targeted revision too narrow.

**Trigger set on**: 2026-07-31 · **Watched via**: field reports from missions scaffolded by `runward init`, the Dropyour graduated-app fleet first; and the ADR journal at each groom.

## References

- [ADR-0033](ADR-0033-status-reports-real-lifecycle-position-state-and-reopenings.md) — §Alternatives discarded rejects `iterate` as a gated phase; the constraint that makes this a doctrine decision rather than a gate decision, and the ADR that named the steady state in the first place.
- [ADR-0041](ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — the matcher that would make this step precise; deliberately not a prerequisite.
- [ADR-0040](ADR-0040-per-rule-non-scope-declaration.md) — "every gate names what it cannot verify"; applied here to a doctrine change, and amended alongside this ADR to declare the temporal blind zone the field report exposed.
- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md) — the gate never judged whether code implements a rule; the honest ground on which an unenforced discipline is the right instrument.
- [ADR-0017](ADR-0017-application-infrastructure-double-vision-gated.md), [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the dual objection: gating a note that carries no mission decision "would make `check --strict` verify the presence of a copied reference text — vacuous paperwork, the exact theater ADR-0002 hardens the gate against". A restated iterate manifest is that case.
- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the phase mapping this leaves untouched; rule routing stays coarse until ADR-0041.
- `templates/workflows/` (the eleven shipped workflows) — the empirical basis for the coupling stated in Context; `AGENTS.md` — "confront them at the point of action, not from memory".
- The Dropyour field report, *Brief à transmettre à l'agent runward — durcir la conformité aux règles de métier* (2026-07-31) — the two violations, and the argument that a gap replicating into every scaffolded mission is a framework gap.
