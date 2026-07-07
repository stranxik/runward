# ADR-0001: Enforce declared rule-conformance at the gate

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — field-test reality-check against the code, doctrine cross-check (operator-role, when-to-use), challenge of the proposed remedies, durable position

## Context

The force is an observed failure in a live end-to-end run of the method, not a hypothesis. A coding agent building a floor **cited** the craft rule `frontier-deterministic-boundary` in its ADR but **shipped no grounding guard**: a figure produced inside model prose reached the deliverable unchecked, violating a hard framing constraint ("no invented figure"). The floor still passed `runward check` green.

The cause is structural and confirmed in the code, and it recurs with any competent model:

- The charter states rule application declaratively and globally. `AGENTS.md` says "apply the craft rules in `runward/rules/` while building" — one imperative pointing at a whole directory, with no task-to-rule mapping and no reminder at the point of action. `init` writes the full text of all **51** rules to disk (impact levels: CRITICAL, HIGH, MEDIUM, LOW — 13/19/18/1), so the agent has the text; nothing routes the applicable rule to it while it builds. The build workflow (`floor.md`) routes zero rules.
- `runward check` verifies deliverable **presence**, not rule **conformance**: it classifies a note as filled once it diverges from its template with few remaining placeholders. It never reads project code and runs nothing. Consequently, citing a rule and applying it are indistinguishable to the gate.

This is structuring, not local: it changes how every mission enforces its own craft discipline, and any remedy risks colliding with the founding bet — judgment concentrated in one accountable operator, "cheap in tooling, expensive in discipline", no deciding AI personas. The decision is taken at the **method/tooling boundary** (rule frontmatter schema, workflows, the `check` command, the charter), never inside a mission's domain.

## Decision

Apply the doctrine's own default — **bound the non-deterministic with the deterministic at the gate** — by adding a deterministic conformance layer, governed by one invariant: *the gate verifies the presence of a traced decision, never the quality of an implementation; no LLM sits anywhere in the gate path.* The operator still owns the gate.

Four deterministic pieces:

1. **Phase-to-rule mapping.** CRITICAL/HIGH rules declare an additive `phases:` frontmatter field (e.g. `phases: [floor, govern]`). It is surfacing, never masking: it says where a rule applies; MEDIUM/LOW stay advisory. This is the coarse, deterministic form of routing — the phase is already the unit `check` works in. Finer per-task triggers are deferred until evidence demands them.
2. **Conformance manifest.** Build-phase deliverables (starting with `floor.md`) carry a `Rule conformance` table: one row per mapped CRITICAL/HIGH rule, status `applied | deviated | n/a`. `applied` requires a non-empty evidence pointer (file:line or a test); `deviated` requires a reference to an existing ADR; `n/a` requires a one-line reason.
3. **`runward check --strict` (opt-in).** A deterministic pass verifies the manifest is complete and well-formed: every mapped CRITICAL/HIGH rule has a row, every `applied` carries a pointer, every `deviated` resolves to an ADR file that exists, every `n/a` carries a reason. It never opens project code, never runs tests, never judges whether the pointer truly implements the rule. Default `check` is unchanged, so this is non-breaking; the operator opts into the stricter gate.
4. **Rule confrontation at the point of action.** Build workflows and the generated `/rw-*` commands name the phase-routed rules and instruct the agent to read them before building and account for each in the manifest. Verbatim text injection is a later refinement, on evidence.

The manifest does not stop an agent from citing without applying; it makes that a **visible, located lie** the operator catches at the gate — an unbacked `applied`, a dangling `deviated`, or a missing row turns green into red.

## Alternatives discarded

- **Do nothing, rely on the charter's declaration.** The field test is the disproof: it fails by default, even with a willing model that had the rule text in hand.
- **An auto-blocking quality gate** (an LLM or heuristic that fails the build on a "bad" artifact). Discarded — it violates "the operator owns every gate" and turns Runward into "a framework that decides for you", the exact anti-pattern named in `when-to-use.md`.
- **An LLM-judge review as the safety net** (a `runward review` that scores cite-vs-apply). Discarded as pillar and as gate. It reintroduces the machine persona the doctrine excludes ("judgment is concentrated in you"), it is non-deterministic, and `review.md` itself flags judge-model bias as a hazard. Its real danger is drift: an "advisory" opinion becomes the de-facto gate and reproduces this very incident. Tolerable only strictly outside the exit-code path, never blocking — and not the answer here.
- **Drastically cutting the rule set.** Discarded — it discards captured craft. The problem is activation and routing, not volume.

## Consequences

- **Positive**: rules get applied, not merely cited; compliance theater becomes catchable at the gate; the operator judges on a real, located signal; cognitive load shifts from "hold 51 rules in mind" to "account for the few that fired on this phase". The tooling finally implements, at the gate, the doctrine it ships.
- **Negative, accepted**: more tooling than Runward's minimalist default prefers — accepted only because each piece serves the operator's gate or the agent's between-gate fidelity, and none decides. The `phases:` mapping must be kept honest; the manifest adds a writing step per build deliverable; `--strict` adds a parser and a code path to maintain.
- **On other boundaries**: the rule frontmatter schema evolves (versioned, additive — per `contracts-governance`); `check` gains a `--strict` mode and a manifest parser; `AGENTS.md` is updated so the charter names the build-time confrontation and the manifest; `doctor` and the smoke test cover the new field and mode.

## Reevaluation trigger (mandatory, dated)

Reopen if any of:
- **(a)** cited-not-applied incidents persist above an agreed threshold *despite* the layer — activation is insufficient; tighten routing/injection.
- **(b)** operators rubber-stamp `--strict green` without reading the pointers — judgment has silently migrated from the human to the tool, contradicting the founding bet; re-tighten toward the operator (e.g. require a pointer to resolve to an existing file:line — still deterministic).
- **(c)** the `phases:` mapping produces false negatives — a CRITICAL/HIGH rule that should have fired on a phase was not mapped.

**Trigger set on**: 2026-07-07 · **Watched via**: an incident log of rule-conformance failures, plus a periodic charter/doctrine review.

## References

- `docs/operator-role.md` — the operator owns every gate; the method constrains the agent, not the reverse.
- `docs/when-to-use.md` — "cheap in tooling, expensive in discipline"; "not a framework that decides for you".
- `templates/rules/frontier-deterministic-boundary.md` — the rule the incident violated (the model writes prose, the program owns the facts; the guard fails closed).
- `templates/workflows/review.md`, `templates/workflows/decision-loop.md` — one architect wearing five hats; judgment not distributed across autonomous personas.
- Architectural Decision Records — https://adr.github.io/
