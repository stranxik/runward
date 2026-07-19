# When to use Runward — and when not to

Runward is not for every project that touches a model. It earns its weight when an agentic system has to *hold*: in production, under governance, in someone else's hands after you leave. This page explains where the method fits through the three doors people actually enter by, where it does not fit, and what it costs in discipline. For the mechanics, start with [your first mission in 15 minutes](first-mission.md); for the human side of the bet, [the operator role](operator-role.md).

## The tech lead with a prototype that worked too well

The demo convinced everyone — which is precisely the problem. The prototype is now expected to hold production, and it was never designed to be evaluated, governed, or explained. This is the **brownfield entry**. `runward init` in brownfield mode does not ask for a rewrite; the first workflow is characterization — observe and record what the existing system actually does before touching a line. From there the gates apply to what exists: boundaries get named in `runward/architecture.md`, implicit choices become explicit ADRs, the threat model and evaluation rubric are written against real behavior, and replacement proceeds port by port — never as a big-bang rewrite. At the end the tech lead holds a characterized system, an architecture note, a decision journal that explains it, and a floor that passes `runward check`: the same prototype, now accountable.

## The operator delivering for a client

A consultant, or an engineer embedded on the business side, has to deliver an agentic system inside a client organization — often a regulated one, where someone must answer for the system by name. This is the **framing entry**, and day one is a conversation, not code: the `frame` workflow produces `runward/framing.md` (problem, value, an observable success criterion the sponsor validates) and `runward/mission-contract.md` (the one-page steering contract). Only then comes architecture, then the floor, proven on real traffic. The mission ends with the handover kit: `runward/runbook.md`, the ADR journal, the governance folder — and a client team that redoes a task alone, demonstrated. Because governance artifacts exist from day zero, they are ready the day a regulated environment asks to see them.

## The team whose spec is done

A team finishes a spec with Spec Kit, OpenSpec or BMAD, and that framework's last gate closes at merged code. Their `spec.md` becomes the **input of `runward/framing.md`**: the intent survives, the gates continue past the merge. What Runward adds is exactly what the spec did not cover — proof on real traffic (`floor.md`), evolution on evidence (the decision matrix), governance (`threat-model.md`, `evaluation-rubric.md`, `observability-schema.md`) and transmission (`runbook.md`).

## When Runward is the wrong tool

- **An already-specified tooling request with no production stakes.** If the spec is done and nothing has to hold, implement it directly; Runward's gates would be ceremony.
- **Recurring operations.** Runward hands over; it does not operate. If what you need is a permanent run team, the method ends where that team begins.
- **A pure content or assistant use case**, with no tools and no blast radius. A bad output is just a bad answer; the gates would protect against a risk you do not carry.
- **You want a framework that decides for you.** Runward makes *you* decide, at every gate. Judgment is not distributed across personas here; it is concentrated in you.

## One language in the core

The reference stack's sober default is a single language in the core — TypeScript by default, an adapter decision like any other, recorded in the decision matrix. The clonable floor (`floor-ts/`) is expressed in that default; what it demonstrates — ports, contracts, middleware chain, deterministic guard — survives a change of language. If your organization runs on Python or Go, transpose the floor: the patterns are the contract, the language is the adapter.

The same neutrality holds for structure. The method's default shape is a **modular core behind ports and adapters** — the pattern known as hexagonal architecture: each capability sits behind a stable contract, so a component can be swapped or extracted later without reworking the rest. That modularity is what makes runward stack-neutral and framework-optional in the first place. And it is a sober default with explicit evolution triggers, not a requirement: the gate checks that the architect and floor phases *confronted* it, and a system that deviates passes green with a traced ADR — runward's own mission does exactly that (a single-process CLI monolith, deviation on the record).

## The price: discipline

Runward is cheap in tooling and expensive in discipline. **One accountable operator** owns every gate — not a committee, not a cast of personas. **Governance from day zero is non-negotiable**: threat model, evaluation rubric and observability exist before the first real call, or phase 5 never truly happened. And **every structural decision is an ADR** — dated, locked, with a re-evaluation trigger. If that discipline sounds heavier than your stakes, reread the section above: Runward may simply not be your tool. If it sounds like what production would demand of you anyway, it is.
