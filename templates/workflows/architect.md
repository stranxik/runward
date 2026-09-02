---
workflow: architect
phase: architect
gate: strict
produces: [runward/architecture.md#gated, runward/execution-topology.md#gated, runward/decision-matrix.md]
requires: [runward/framing.md]
nonScope: Proves the map was drawn and its decisions traced to ADRs; never that the boundaries are the right ones — the operator judges that at the gate.
---

# Architect — Boundaries Before Stack

## When to use

Use this workflow once framing is decided and structure must follow: "how do we architect this?", "what do we build on?", "which contracts?", "monolith or microservices?", "which backend language?" (answer: ports first). This is phase 2 of `method`. It turns a decided perimeter into a decided architecture: boundaries fixed, contracts named, language and topology deliberately left open.

## Inputs

- The framing note: floor/target split, success criterion, hard constraints, presumed boundaries.
- The `mission/architecture.md`, `mission/port-contract.md`, and `mission/adr/ADR-0000-template.md` templates.
- The `mission/decision-matrix.md` template (the structuring defaults and the trigger that switches each).
- The `mission/shared-bricks.md` and `mission/execution-topology.md` templates (the infrastructure vision).

## Outputs

- A light architecture note.
- The port list with contracts and the integration protocol.
- The decision matrix adopted for the mission: each structuring choice with its sober default and the objective trigger that switches it (`mission/decision-matrix.md`).
- The execution-topology note: each port placed behind its location family, with data class and sovereignty.
- One ADR per structuring decision, including each non-in-app placement.

## Procedure

**Refuse stack questions, again.** Contracts first, technology later. The phase rests on the doctrine's guiding principle: the architecture constrains the model, never the reverse. The model and the infrastructure are adapter decisions, taken behind stable contracts. That is why boundaries come before stack. Each stack choice is taken adapter by adapter once boundaries are known, justified by a local technical reason — never by habit.

**Fix the two boundaries that make the stack secondary.**

1. **Domain ports.** The domain expresses its needs as contracts: generate a model completion, persist state, execute an action, read a source. Each contract is honored by an adapter written in any language, as long as it honors the contract. The model port is a port like any other: the reasoning engine is bound only by its contract, not by its brand. The daily dividend is a domain testable without the model; substitutability is the insurance you keep in reserve. This is the guiding principle made concrete: the model is a replaceable adapter behind a stable port.
2. **The cross-process integration protocol.** When a capability lives in another process or language, expose it through a standardized tool protocol. The system consumes that process as a tool provider and publishes its own capabilities the same way. A service is just an adapter that moved into its own process; the domain does not change.

**Govern every contract.** A port is more than a typed schema. Version it; make changes additive by default; read as a tolerant reader that ignores unknown fields and accepts missing optional ones. For a genuinely breaking change, expand then contract: introduce the new, migrate consumers, retire the old — never in one move. Track provenance: who produces, who consumes, under which version, so impact is measurable before a change. Fix meaning per bounded context: without pinned semantics the model will invent false mappings; the semantic contract is to meaning what the typed schema is to malformed data. On legacy, the adapter becomes an anticorruption layer that translates the old dialect into the domain language without contaminating the new — and that boundary is never free: name the translation cost and budget it.

**Name the default topology and its triggers.** A modular hexagonal monolith by default: one deployable, pure domain plus adapters. A single orchestrator directing specialists: it composes, it carries no business logic. A tool registry plus a middleware chain as the single transversal surface (logging, access, cost, approval, traces) — the chain stays thin, the registry stays an index, never a brain. One core language for server and interface, a thin model abstraction (a direct SDK, not a heavy chain framework); polyglot only via a sidecar or service, justified by a mature library or proven performance need. Name each default's evolution trigger here; cross it only in `iterate`.

**Place the ports — the second vision, behind the same ports.** The application domain says *what* the system does; the execution topology says *where*, and under which sovereignty, each port's adapter runs. They are not two subjects: a placement is an adapter decision behind a stable port ("a service is just an adapter that moved into its own process; the domain does not change"). In `execution-topology.md`, record one row per port: its adapter, its location family (the five in `shared-bricks.md`), the class(es) of data crossing it, its sovereignty level, and the trigger to move it. Any placement that is not in-app is an ADR. Sovereignty is graduated by data class, not set wholesale — and traces are data: a third-party trace export is a decision, not a default. Seed the usage registry here too: risk is classed by deployment, not by platform. runward traces this decision; it never deploys.

**Lock structuring choices in ADRs.** Starting topology, core language, legacy integration strategy, bounded-context boundaries: each goes through `decision-loop` — reality-check against reference implementations, sourced state of the art, challenge, durable position, written lock. A decision that is not locked does not enter the architecture note.

**Confront the architect craft rules at the point of deciding.** Open the CRITICAL/HIGH rules mapped to the architect phase (`runward/rules/`, `phases: [architect]`): contract governance, the hexagonal architecture and adapter pattern, the single core language, the ADR-and-journal discipline. Do not work from their names — read them. Account for each in the `Rule conformance` manifest of the architecture note: `applied` with a pointer, `deviated` with an ADR, or `n/a` with a reason. `runward check --strict` verifies that manifest.

**Write the architecture note.** Short, readable, decided: the ports, the default topology and its triggers, what stays open (language, provider), and the target named without being built. A few pages, not a detailed design dossier.

## Definition of Done

- Architecture note produced, boundaries first, stack open.
- Decision matrix adopted for the mission: every structuring choice carries a sober default and an objective trigger; the positions taken so far are recorded (`mission/decision-matrix.md`).
- Every port named with contract and initial version; integration protocol stated.
- Execution-topology note produced: every port placed behind a location family, with its data class(es) and sovereignty; non-in-app placements carry an ADR; the usage registry is seeded.
- One ADR per structuring choice, locked before the note mentions it.
- Every architect CRITICAL/HIGH rule accounted for in the conformance manifest (`runward check --strict`).
- Note reviewed via `review` before circulation.
- Deliverable form matched: the presented architecture note carries an expected delivery form (a readable PDF or HTML); ADRs and contract specs stay as repository markdown.

## Anti-patterns

- Deciding language, framework, or provider at this phase.
- Building microservices or multi-agent into the starting topology instead of naming them in the target.
- Confusing typed contracts with behavior: the behavioral boundary is validated in `govern`, never guaranteed by types.
- Writing the note before the ADRs are locked.
- Pretending the boundary is free on legacy — the integration cost concentrates exactly there.
- Letting the middleware chain accumulate orchestration or business logic.
