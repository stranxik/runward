# The operator role

Runward assumes a specific way of working that most agentic-coding frameworks do not: **one accountable human operator, embedded on the business side, paired with an agent**. This page defines that role. If BMAD simulates an agile team with a dozen AI personas, Runward takes the opposite bet: the roles that matter are not simulated — they are carried by one engineer who answers for the outcome, while the agent executes the method's workflows under that engineer's gates.

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

This is the same principle — the architecture constrains the model, never the reverse — applied to the delivery process itself: the method constrains the agent, not the other way around. Frameworks that simulate a full team distribute the judgment across personas; Runward concentrates accountability in one person, because in production — and doubly so in regulated sectors — someone has to answer for the system, and a persona cannot.

## What they leave behind

A running system proven against the criterion; an architecture note that states boundaries before technology; a locked, dated decision journal; governance wired from day zero; and a team that redoes a task alone — demonstrated, not declared.

## When there are several of you

The singular above is a doctrine, not a mechanical limit: nothing in the gate counts operators. The
question a team asks on day one — *who validates, when we are five?* — has an answer the tool already
implements, and it is worth stating plainly rather than leaving each team to rediscover it.

**What already carries the multi-operator case, by construction.** The gate is deterministic, so any
maintainer re-derives a colleague's verdict on the same tree and gets the same bytes; `runward verify`
re-checks an attestation offline, so "I could not reproduce your green" is a falsifiable statement
rather than an argument. The trust anchor is **the reviewed commit**
([ADR-0021](adr/ADR-0021-blocking-drift-and-evidence-sealing.md)), which means your existing review
mechanism is the counter-signature: a manifest row moving to `applied` is a diff, and a diff is
reviewed by someone who is not its author. Branch protection with `runward check --strict` as a
required check enforces that indifferently at one operator or fifty.

**Name the owner per phase, in the file you already have.** Each gated deliverable lives at a stable
path, so `CODEOWNERS` expresses phase ownership directly — the architecture owner reviews
`runward/architecture.md`, the security owner reviews `runward/governance/`, and so on:

```
runward/architecture.md          @org/architects
runward/execution-topology.md    @org/architects @org/platform
runward/governance/              @org/security
runward/handover.md              @org/leads
```

That is the whole mechanism. It is your forge's, not runward's — which is the point: the gate refuses
to become the thing that runs your organisation.

**Three sharp edges, named.**

1. **Re-sealing after a merge.** `check --freeze` rewrites `runward/evidence-lock.json` wholesale, so
   two people sealing in parallel produce a merge conflict on the lock, and a re-seal silently
   replaces the previous crossing. Only git history remembers. The protocol that works: seal on the
   integration branch, never in parallel; treat a lock diff in review as a decision, not as noise.
2. **`--through` in a team.** The person reading the green prefix is often not the one who declared
   the horizon. The output and the JSON both carry the caveat, and `--through --freeze` is refused
   ([ADR-0053](adr/ADR-0053-the-construction-gate-certifies-a-declared-horizon.md)) — but the social
   half is yours: the declared horizon belongs in the PR description, not only in a CI flag.
3. **Signing, when it ships.** [ADR-0055](adr/ADR-0055-the-verdict-is-a-standards-legible-attestation.md)
   layer 5 says "the operator's key", singular. At N maintainers the compatible shape is N DSSE
   signatures over the same Statement, and that must be decided before the layer is built rather
   than retrofitted.

**What runward will not add, and why.** A "validated by" field inside a mission artifact would be
re-signable by whoever writes the artifact — declarative, worth nothing to an assessor, and exactly
the floor [ADR-0002](adr/ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) closed. Reading
the author from git would make the verdict depend on repository history rather than the working tree,
breaking *same working tree ⇒ same verdict*
([ADR-0054](adr/ADR-0054-the-runtime-boundary-is-explicit.md)). Identity is your forge's job; runward
reads bytes at rest. A fleet-level "who is in good standing" view is the satellite's
([ADR-0039](adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)), never the CLI's.

**One thing does not change with the number of people.** Every gate is still crossed by *a* named
human, on evidence. Five operators means five people who each own their gates — not a committee that
owns none.
