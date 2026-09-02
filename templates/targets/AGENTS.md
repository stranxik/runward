# Agent charter — Runward mission

This project is delivered with the Runward method: floor first, evolution on evidence, governance from day zero. Any agent working here follows this charter. It is vendor-neutral: the method lives in `runward/workflows/`, the mission state in `runward/`.

## Non-negotiable boundaries

1. **The architecture constrains the model, not the other way around.** The model is a replaceable adapter behind a stable port. No domain logic in prompts, no prompt fragments in the domain. The five architecture gestures (`runward/workflows/method.md`) and the decision matrix (`runward/decision-matrix.md`) carry the complete method.
2. **Boundaries before the stack.** Ports and contracts are decided before languages, frameworks or topology. Contracts are versioned, additive, tolerant-reader. One single language in the core; polyglot only as a sidecar behind the tool protocol, on a proven trigger.
3. **Complexity is deferred until a trigger commands it.** Multi-agent, long-term memory, service extraction, a bigger model: each requires an objective trigger recorded in an ADR. No trigger, no change.
4. **Deterministic frontier.** Anything that can be computed deterministically is. The model never invents figures that the system can compute.
5. **Security on actions, not display.** Untrusted input never gains write or exfiltration capability in the same session (lethal trifecta, 2-of-3 rule). Reads may fail open; actions fail closed.

## The loop — five gestures

Confront the craft rules at the point of action, not from memory. For every deliverable, in order:

1. **Ask which rules govern the files.**
   `runward rules --for <paths>` returns the rules whose declared territory covers those files, with the pattern that retained each one — auditable, never magical. It also states how many rules declare no territory and are therefore never matched, only counted: `--for` surfaces, it never masks. `runward rules --phase <phase>` lists a phase's full CRITICAL/HIGH set.
2. **Read what comes back.**
   `runward explain <rule>` prints a rule's why and full text. Never work from a rule's name. When a rule and a habit conflict, the rule wins; deviating requires an ADR.
3. **Account for each rule in the deliverable's `Rule conformance` manifest — as a proposal, never a bare status.**
   `runward manifest --sync` scaffolds the missing rows; `runward propose` pre-fills what a signature can corroborate. You fill each remaining decision as `proposed:<status>` with a typed pointer and a one-line justification:
   - `proposed:applied` — with a typed pointer the gate verifies (`file:PATH[:LINE][#SYMBOL]`, `test:PATH[::NAME]`, `adr:NNNN`);
   - `proposed:deviated` — with an ADR;
   - `proposed:n/a` — with a real reason.
   You propose; you never ratify. `runward ratify` is the operator's gesture — the gate refuses every proposed row until a human makes it theirs, and a bare status written by an agent leaves a decided row with no ratification trace, which every check discloses. A signed rule (frontmatter `signature:`) needs evidence whose content matches its signature; a pointer at an empty or vanished file fails the gate.
4. **Run the gate yourself.**
   `runward check --strict` verifies the manifest and the evidence's shape, deterministically — never the quality of the code; the operator judges that at the gate. Do not end your turn on a red you could have fixed.
5. **When the gate is green, verify before crossing.**
   Run `runward/workflows/verify.md`: an advisory, adversarial cite-vs-apply pass (ideally on a different model) that judges whether the code an `applied` row points at actually applies the rule or merely cites it, recorded in `runward/governance/verify-findings.md`. It never blocks the gate (ADR-0007). Once the operator crosses, they may seal the evidence with `runward check --freeze` (ADR-0021).

## Beyond the loop

- **Before adding any capability:** consult `runward/decision-matrix.md` — 22 arbitrations, each with a sober default and an explicit trigger. No trigger, no change.
- **Before any structural decision:** run `runward/workflows/decision-loop.md` — verify in the real code, check the sourced state of the art, challenge the source, take a durable position, lock it. One ADR per structural decision, in `runward/adr/`, from `runward/adr/ADR-0000-template.md`, with a dated re-evaluation trigger.
- **Phases and gates:** `runward/framing.md` holds the Definition of Ready; each workflow holds its Definition of Done. Never mark a phase done unless its Definition of Done is demonstrably met — a gate is passed on evidence, not on assertion.
- **Wiring the gate:** run `runward wire` (or `runward wire --json`) to identify the channel for the harness running you, then offer to wire its recommended sample from `runward/adapters/`. If it reports `status: undetermined`, do not guess — ask the operator, in plain language, which AI tool they use, then wire the matching sample. Act only on explicit approval; runward installs nothing itself (ADR-0012): you are the operator's hands, and the operator owns the gate.
- **Show before you build:** for any deliverable meant for humans, produce a reviewable preview first.

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
