# Runward

**After the spec: ship and run.**

Runward is a delivery framework for agentic systems. It picks up where spec-driven development frameworks stop: once the spec exists, Runward gets you from specified system to a system that holds in production — floor first, evolution on evidence, governance from day zero, and a handover that makes your team autonomous.

> Spec Kit, OpenSpec and BMAD help you specify, plan and implement. None of them covers the run: governed memory, resilience, execution security, continuous evaluation, transmission. Runward is that missing layer. It is compatible with all of them upstream.

## Why

Agentic systems fail in production, not in the spec. A model that answers well in a demo is not a system that survives real traffic, prompt injection, provider outages, cost drift and team turnover. Runward structures the part nobody frameworks: **shipping and running**.

Its engineering thesis is the **LLM Boundary Principle**: the architecture constrains the model, not the other way around. Boundaries before the stack. The model is a replaceable adapter behind a stable port. Complexity is deferred until an objective trigger commands it.

## Install

```bash
npx runward init            # scaffolds the mission structure in your project
npx runward init --tools claude,cursor
```

`init` creates:

```
your-project/
├── AGENTS.md                    # vendor-neutral agent charter (the "law" file)
├── runward/
│   ├── framing.md               # problem, value, observable success criterion, floor vs target
│   ├── architecture.md          # boundaries, ports, integration protocol — stack stays open
│   ├── floor.md                 # the smallest system that proves value on real traffic
│   ├── adr/                     # one ADR per structural decision, with re-evaluation trigger
│   ├── governance/
│   │   ├── threat-model.md      # lethal trifecta, 2-of-3 rule on the context window
│   │   ├── evaluation-rubric.md # test the deterministic, evaluate the non-deterministic
│   │   └── observability-schema.md
│   ├── contracts/               # port contracts (versioned, additive, tolerant reader)
│   ├── runbook.md               # recovery runbook for the team that inherits the system
│   └── workflows/               # the method, executable by your coding agent
└── .claude/ | .cursor/          # tool profiles (--tools)
```

## The method: six phases, gated

Each phase has entry conditions (Definition of Ready) and a Definition of Done. You do not move on assertion; you move on evidence.

| Phase | Output | Done when |
|---|---|---|
| 1. Frame | `framing.md` | Sponsor validates the observable success criterion and the floor scope |
| 2. Architect | `architecture.md` + ADRs | Boundaries decided, stack still open |
| 3. Ship the floor | Running system + `floor.md` | First measured proof against the criterion, on real cases |
| 4. Iterate on evidence | Increments + ADRs | Every addition traced to an objective trigger |
| 5. Govern & evaluate | Threat model, rubric, observability | Instrumented from day zero, never retrofitted |
| 6. Hand over | Handover kit | The team redoes a task autonomously — demonstrated, not declared |

Phase 5 is transverse: it starts at day zero, not after the incident.

## What makes it different

- **Floor, not MVP deck.** The floor is the smallest *running* system that proves value on real traffic. A presentation is not a floor.
- **Evolution on evidence.** Multi-agent, long-term memory, microservices, a bigger model: each has a sober default and an explicit trigger. No trigger, no complexity. Every switch is an ADR.
- **Security by architecture, not detection.** Prompt injection is constrained structurally (lethal trifecta, 2-of-3 rule), not filtered heuristically.
- **Handover as a deliverable.** The mission ends when the receiving team is autonomous, with proof.

## Relationship to the canon

Runward is the tooling of the doctrine **“Designing and Running Agentic Systems”** (Thibault Souris, 2026) — a 60-page architecture reference, published separately under CC BY-ND 4.0. The doctrine is the canon: read it for the *why*. Runward is MIT: fork it, adapt it, contribute. See [NOTICE.md](NOTICE.md).

## Supported tools

v0.1: Claude Code, Cursor. The mission structure is plain markdown in your repo — any agent can work with it. More profiles welcome (see [ROADMAP.md](ROADMAP.md)).

## License

MIT © Thibault Souris. The doctrine text is licensed separately (CC BY-ND 4.0) and is **not** included in this repository.
