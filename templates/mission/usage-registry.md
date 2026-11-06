# Usage registry

> **Usage.** One row per deployment. Risk is classed **by deployment, not by platform** (§15): the same platform hosts a harmless FAQ bot and an agent with write access to payments. Governance attaches to each deployment. This registry is what answers, at audit time, "what runs where, touching what." It is a governed engineering artifact, not a compliance declaration (see runward's ADR-0015/0016 and `runward compliance`).
>
> The `topology-usage-registry-present` row of `execution-topology.md` cites this file by deployment, `file:runward/governance/usage-registry.md#<deployment>`, which the gate opens and checks. The registry lives here, in a file of its own, because a pointer at the manifest that carries the row is never opened as evidence: a row resting on one is `declared`, below the level of proof `re-derived` a new mission asks for.
>
> _e.g._ `triage-bot / prod`: low, public reference, read-only. `payments-agent / prod`: high, regulated and personal, mutate (approval-gated).

| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |
|---|---|---|---|---|---|
| [deployment / environment] | [risk class] | [data classes] | [action scopes, approval points] | [named owner] | [date] |
