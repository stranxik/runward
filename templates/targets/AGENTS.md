# Agent charter — Runward mission

This project is delivered with the Runward method: floor first, evolution on evidence, governance from day zero. Any agent working here follows this charter. It is vendor-neutral: the method lives in `runward/workflows/`, the mission state in `runward/`.

## Non-negotiable boundaries

1. **The architecture constrains the model, not the other way around.** The model is a replaceable adapter behind a stable port. No domain logic in prompts, no prompt fragments in the domain. This principle is the opening posture, not the whole frame: the five architecture gestures the workflows apply (named in `runward/workflows/method.md`) and the decision matrix (`runward/decision-matrix.md`) carry the complete method.
2. **Boundaries before the stack.** Ports and contracts are decided before languages, frameworks or topology. Contracts are versioned, additive, tolerant-reader. One single language in the core; polyglot only as a sidecar behind the tool protocol, on a proven trigger.
3. **Complexity is deferred until a trigger commands it.** Multi-agent, long-term memory, service extraction, a bigger model: each requires an objective trigger recorded in an ADR. No trigger, no change.
4. **Deterministic frontier.** Anything that can be computed deterministically is. The model never invents figures that the system can compute.
5. **Security on actions, not display.** Untrusted input never gains write or exfiltration capability in the same session (lethal trifecta, 2-of-3 rule). Reads may fail open; actions fail closed.

## How to work

- Apply the craft rules in `runward/rules/` while building — and confront them at the point of action, not from memory (`runward explain <rule>` prints a rule's why and full text). Each rule declares where it applies (`phases:`); a build phase surfaces its CRITICAL/HIGH rules to open and account for in the deliverable's `Rule conformance` manifest. `runward manifest --sync` scaffolds the missing rows; you fill the decision: `applied` with a **typed pointer the gate verifies** — `file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN` (or prose, which stays the operator's judgment) — `deviated` with an ADR, `n/a` with a real reason. A signed rule (frontmatter `signature:`) needs evidence whose content matches its signature; a pointer at an empty or vanished file fails the gate. When a rule and a habit conflict, the rule wins; deviating requires an ADR. `runward check --strict` verifies the manifest and the evidence's shape — never the quality of the code; you judge that at the gate. When the gate is green, run `runward/workflows/verify.md` before crossing: an advisory, adversarial cite-vs-apply pass (ideally on a different model) that judges whether the code an `applied` row points at actually applies the rule or merely cites it, and records its findings in `runward/governance/verify-findings.md`. It is advisory — it never blocks the gate (ADR-0007). Once the operator crosses, they may seal the evidence with `runward check --freeze` (ADR-0021).
- Consult `runward/decision-matrix.md` before adding any capability: 22 arbitrations, each with a sober default and an explicit trigger. No trigger, no change.
- Before any structural decision, run `runward/workflows/decision-loop.md`: verify in the real code, check the sourced state of the art, challenge the source, take a durable position, lock it in an ADR — only then edit.
- One ADR per structural decision, in `runward/adr/`, with a dated re-evaluation trigger. Use the template `runward/adr/ADR-0000-template.md`.
- Current phase and gates: see `runward/framing.md` (Definition of Ready) and each workflow's Definition of Done. Do not skip a gate on assertion; pass it on evidence.
- Offer to wire the gate at your harness's lifecycle seam — git `pre-commit`, a CI required check, or a turn-end hook — from the inert samples in `runward/adapters/`. Run `runward wire` (or `runward wire --json`) to identify the channel for the harness running you: if it reports a harness (`status: detected` / `config-detected`), offer to wire its recommended sample. **If it reports `status: undetermined`, do not guess — ask the operator, in plain language, which AI tool they use, then wire the matching sample.** Propose it and act only on explicit approval; never wire it silently. `runward wire` is read-only and runward installs nothing itself (ADR-0012): you are the operator's hands, and the operator owns the gate.
- Show before you build: for any deliverable meant for humans, produce a reviewable preview first.
- Never mark a phase done if its Definition of Done is not demonstrably met.

## Mission state

| File | What it holds |
|---|---|
| `runward/framing.md` | Problem, value, observable success criterion, floor vs target |
| `runward/architecture.md` | Boundaries, ports, integration protocol |
| `runward/floor.md` | The floor's scope and its measured proof |
| `runward/adr/` | Decision journal |
| `runward/governance/` | Threat model, evaluation rubric, observability schema |
| `runward/runbook.md` | Recovery runbook for the receiving team |
| `runward/handover.md` | The succession record: kit index, redone-task proof, named owner — gated at phase 6 |
