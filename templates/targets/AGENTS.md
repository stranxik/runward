# Agent charter — Runward mission

This project is delivered with the Runward method: floor first, evolution on evidence, governance from day zero. Any coding agent working here follows this charter. It is vendor-neutral: the method lives in `runward/workflows/`, the mission state in `runward/`.

## Non-negotiable boundaries

1. **The architecture constrains the model, not the other way around.** The model is a replaceable adapter behind a stable port. No domain logic in prompts, no prompt fragments in the domain.
2. **Boundaries before the stack.** Ports and contracts are decided before languages, frameworks or topology. Contracts are versioned, additive, tolerant-reader.
3. **Complexity is deferred until a trigger commands it.** Multi-agent, long-term memory, service extraction, a bigger model: each requires an objective trigger recorded in an ADR. No trigger, no change.
4. **Deterministic frontier.** Anything that can be computed deterministically is. The model never invents figures that the system can compute.
5. **Security on actions, not display.** Untrusted input never gains write or exfiltration capability in the same session (lethal trifecta, 2-of-3 rule). Reads may fail open; actions fail closed.

## How to work

- Apply the craft rules in `runward/rules/` while building: they cover memory scoring, tiered retrieval, event sourcing, request-id propagation, resilience, cost routing, secrets and prompt-injection defenses. When a rule and a habit conflict, the rule wins; deviating from a rule requires an ADR.
- Consult `runward/decision-matrix.md` before adding any capability: 22 arbitrations, each with a sober default and an explicit trigger. No trigger, no change.
- Before any structural decision, run `runward/workflows/decision-loop.md`: verify in the real code, check the sourced state of the art, challenge the source, take a durable position, lock it in an ADR — only then edit.
- One ADR per structural decision, in `runward/adr/`, with a dated re-evaluation trigger. Use the template `runward/adr/ADR-0000-template.md`.
- Current phase and gates: see `runward/framing.md` (Definition of Ready) and each workflow's Definition of Done. Do not skip a gate on assertion; pass it on evidence.
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
