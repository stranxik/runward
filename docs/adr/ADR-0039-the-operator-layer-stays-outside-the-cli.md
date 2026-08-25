# ADR-0039: the operator layer stays outside the CLI — three tiers named, nothing new mechanised

**Date**: 2026-07-21
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in a maintainer dogfooding pass (operating runward from a well-kept coding harness), a three-reader sweep of the repo doctrine, the site positioning and the distribution surface, then an adversarial two-judge confrontation (integrate vs. reject); durable position

## Context

Operating runward from a well-kept coding harness surfaces a family of practices that live NEXT TO the gate, not inside it: mechanical file-level checks wired as harness hooks (a typechecker run after every edit), machine-wide instruction files that make the agent behave as an operator between gate runs, cost visibility for the operator's own harness, and measured self-audits of adoption. A maintainer dogfooding session produced all four, and the question followed: does any of this belong in runward — the product, a satellite, or nothing?

Three standing decisions already fence this ground:

1. **runward never becomes the thing that runs.** [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) discards the daemon, the watcher and the auto-install by name: "the cure for 'the gate doesn't run automatically' is not for runward to become the thing that runs it." [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) draws the same line for telemetry: implementing an exporter crosses into being a runtime.
2. **runward reads the mission repo, nothing else.** The sovereign posture — "local with no data flow" ([ADR-0031](ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md)) — is what regulated adopters buy. An adoption audit over harness transcripts reads an object runward reads nowhere today: the operator's behavior.
3. **No harness is privileged.** v0.19 removed the Claude-specific default from `init --yes` to close "a standing vendor-neutrality breach" ([ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)). A machine-wide instruction file and a post-edit hook are, as produced by the dogfooding pass, single-harness artifacts.

Against that, the confrontation established one thing the repo genuinely lacks: the verification architecture is fully built but never **named**. The deterministic gate is [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md)/[ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md); the operator's mechanical hooks seam is [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md)/[ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) ("The operator's extension, not runward's"); advisory LLM review is [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md) ("never in the exit-code path"); discovery-not-enforcement is [ADR-0029](ADR-0029-mcp-is-a-discovery-boundary-never-an-enforcement-path.md). Three tiers, one partition question — *must this check be unforgeable?* — implemented across six ADRs and named in none.

## Decision

**The operator layer stays outside the CLI. The three-tier verification doctrine gets a public name in the docs; the harness gets an honest wiring guide; at most, inert samples ship; the rest remains the operator's own tooling.**

Concretely:

- **Name the three tiers (docs only).** A concepts page maps the name onto the existing ADRs: Tier 1 — the deterministic gate (unforgeable, decides phases); Tier 2 — the operator's mechanical hooks (inform and correct, never gate); Tier 3 — advisory review (findings in, operator decides). Zero new mechanics; the page documents what is already published.
- **A "wire your harness" operating guide** extends the gate-wiring doc in the honest per-channel format of [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md): what each harness can carry beyond the turn-end hook, tier by tier, no channel privileged, capabilities re-verified against vendor docs at write time. Nothing is auto-wired; ADR-0012 holds in full.
- **At most, inert samples.** An example file-edit hook (no-op outside its territory, informs and corrects, never gates) may ship in the per-harness packaging, symmetric with existing samples — or flagged per-channel where symmetry is impossible — never auto-wired.
- **Never in the MIT CLI:** adoption audits over harness transcripts, operator-side cost/telemetry tooling, machine-wide instruction files. As published material these belong, if anywhere, to the doctrine side (CC BY-ND) or the separate commercial track already parked at Someday (certification/training) — never to the tool that promises "local with no data flow."
- **A voluntary satellite (e.g. `runward-operator`) is deferred behind an explicit trigger.** The runward-gemini/runward-kiro precedent covers thin repos imposed by a vendor's format, not voluntary adjacent products; a voluntary satellite is a second product to govern and must earn its existence through demand.

## Alternatives discarded

- **Operator tooling inside the CLI** — reverses ADR-0011/ADR-0012 and erodes ADR-0031. Rejected without a superseding decision.
- **A Claude-code-first operator kit** — reopens the vendor-neutrality breach closed in v0.19. Any sample ships symmetric or honestly flagged per-channel, or not at all.
- **An immediate satellite repo** — judged in 2026 as pure maintenance surface for a single
  maintainer. **Withdrawn as an architecture argument by the amendment of 2026-08-24**: it was a
  judgement about where to spend weeks, and this register is not where such judgements acquire
  permanence. The architectural objection to a satellite is not that nobody asked for it; it is
  ADR-0054, and ADR-0054 does not forbid one — it says where it has to live.
- **Saying nothing** — leaves the built architecture unnamed and the operator without a map; the cheapest real gap, closed by two doc pages.

## Consequences

- Two doc pages (concepts: the three tiers; operating: wire your harness) and this ADR. No CLI change, no new packaging obligation, no gate behavior change.
- The dogfooding material (adoption audit method, cost recipes, machine-wide files) remains the maintainer's own operator tooling — usable later as doctrine or training matter, never as CLI surface.
- The message stays clean: runward verifies decisions; the harness belongs to the operator.

## Amendment (2026-08-24) — a resource judgement was written into an architecture record, and it had made itself unfalsifiable

This ADR mixed two decisions of different kinds, and only one of them belongs here.

**What is architectural, and stands unchanged.** Operator tooling does not enter the MIT CLI. That
follows from [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) and
[ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md), from the promise of a tool that is
local with no data flow, and above all from
[ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md): the verdict, the rules and any fleet rollup
are computed in-repo, on demand, and carried as artifacts the operator owns — never produced, held,
watched, served or aggregated by a process runward operates. An adjacent product that crosses that
line is a DIFFERENT artifact with its own repository and its own model. That is a real invariant, it
is falsifiable, and nothing here touches it.

**What was not architectural, and is withdrawn.** *"A voluntary satellite … must earn its existence
through demand"*, and the dated check reading *"if no signal has arrived, this ADR stands without
rereading"*. That is a judgement about where to spend a single maintainer's weeks. It is a legitimate
judgement; it is not an architecture decision, and putting it in this register gave it a permanence
it never earned.

Worse, the pair was **self-sealing**. Building was conditioned on a demand signal; the signal was to
arrive through the channels of a product with no adoption; and the absence of a signal was written as
grounds for not rereading the decision. A condition that can only be satisfied by the outcome it
gates is not a trigger — it is a decision never to decide, wearing a trigger's clothes. Fourteen
months would have passed under it without a single reading.

### What replaces it

1. **Building an adjacent product is no longer gated on a demand signal.** Whether to build one, and
   when, is product work decided as product work — not deferred by an ADR whose subject is the
   boundary, not the backlog.
2. **The architectural conditions any adjacent product must satisfy are stated here, because THAT is
   this register's job.** It lives in its own repository; it never enters the MIT CLI; it does not
   make runward operate a process; and if it aggregates anything, the aggregation is the operator's,
   computed from artifacts runward emitted and the operator holds. An adjacent product that cannot
   meet those is not a satellite — it is a different company's product, and calling it a satellite
   would not change what it is.
3. **The dated check no longer self-seals.** "No signal" is not grounds for standing without
   rereading. The date below is a date to reread, whatever has or has not arrived.

### What is NOT reopened

The satellite is not hereby approved, scheduled, or scoped. This amendment removes a false constraint
and states a real one. Deciding to build something adjacent remains a decision to take deliberately,
with its own record — and, per ADR-0054, with its own repository the day it crosses the line.

## Reevaluation trigger (mandatory, dated)

**Trigger set on**: 2027-01-01 (the dated check below; the date was stated in prose and carried no
`Trigger set on` line until 2026-08-17, so no reader — and no tool — could see it as a date).

Reopen the **CLI** question only through a decision that explicitly supersedes ADR-0011/ADR-0012 —
unchanged, and architectural.

The **satellite** question is no longer gated on a demand signal (amendment of 2026-08-24): what to
build adjacent to runward is product work, decided as such. What this ADR still owes is the boundary
any adjacent product has to respect, and it is stated in the amendment.

**Dated check, which no longer self-seals**: reread at the first groom after 2027-01-01, whatever has
or has not arrived. The decision is wrong and must be revisited if any of these holds: an adjacent
product was built that quietly puts operator tooling back into the MIT CLI; an adjacent product made
runward operate a process, crossing ADR-0054 without a record saying so; or a constraint in this
register turns out again to be a resource judgement rather than an invariant, which is the defect
this amendment corrects.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md), [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md), [ADR-0007](ADR-0007-advisory-llm-conformance-verification.md), [ADR-0008](ADR-0008-opt-in-hook-seam-around-check.md) — the three tiers as already implemented
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md), [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — never a runtime, the operator wires
- [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md), [ADR-0029](ADR-0029-mcp-is-a-discovery-boundary-never-an-enforcement-path.md), [ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md), [ADR-0031](ADR-0031-sovereign-engineering-evidence-for-regulated-environments.md) — the fences this decision keeps
