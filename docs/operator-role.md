# The operator role

Runward assumes a specific way of working that most agentic-coding frameworks do not: **one accountable human operator, embedded on the business side, paired with a coding agent**. This page defines that role. If BMAD simulates an agile team with a dozen AI personas, Runward takes the opposite bet: the roles that matter are not simulated — they are carried by one engineer who answers for the outcome, while the agent executes the method's workflows under that engineer's gates.

## Mission

The operator turns a real business need into an agentic system that runs in the organization's environment and holds in production. They do not deliver a study or a recommendation: they deliver a running system, prove its value against an observable criterion, then hand it over and leave. What they leave behind — architecture, decisions, rules, an autonomous team — matters as much as what they shipped.

## Posture

Three traits define the role before any technical skill:

- **Mentor as much as engineer.** Listening outranks solving. Understand the process as it actually runs before proposing anything.
- **An executable beats a document.** Prove with a system on real traffic, not a deck. Show before you build.
- **Architecture before the model.** The model and the infrastructure are adapter decisions, reversible, taken behind stable contracts. What capitalizes is the architecture, not the prototype.

## Scope

| In scope | Out of scope |
|---|---|
| Frame a business need into a floor and a target | Produce an opportunity study with no executable deliverable |
| Decide boundaries and ship a connected system | Own long-term operations and the run |
| Instrument governance, security and evaluation from day zero | Act as the compliance or security officer of record |
| Hand over assets, decisions and skills | Remain a permanent dependency of the team |

## When this role is the right one

The most reliable signal: there is a real problem, an observable success criterion, and nobody to turn one into the other in executable form. Good triggers: an intuition worth proving fast on real traffic; an agentic project that needs a tenable architecture before a stack gets picked; a team that wants to own this kind of system durably. Wrong triggers: an already-specified tooling request, recurring operations, or a decision that belongs to a dedicated business function.

## The operator and the agent

The division of labor is fixed by the charter (`AGENTS.md`):

- **The agent** executes workflows, applies the craft rules, drafts artifacts, builds from the reference floor, and never crosses a gate on its own assertion.
- **The operator** owns every gate: validates the success criterion with the sponsor, accepts or rejects the floor's proof, decides each complexity trigger, approves sensitive actions, and demonstrates the handover.

This is the LLM Boundary Principle applied to the delivery process itself: the method constrains the agent, not the other way around. Frameworks that simulate a full team distribute the judgment across personas; Runward concentrates accountability in one person, because in production — and doubly so in regulated sectors — someone has to answer for the system, and a persona cannot.

## What they leave behind

A running system proven against the criterion; an architecture note that states boundaries before technology; a locked, dated decision journal; governance wired from day zero; and a team that redoes a task alone — demonstrated, not declared.
