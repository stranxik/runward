# Mission Contract: runward

**Date**: 2026-07-16 · **Sponsor**: Thibault Souris (maintainer) · **Operator(s)**: the maintainer, plus any contributor working under this mission · **Indicative horizon**: continuous — runward is a live product; the contract is re-read at every release

## Principle

A deliverable is judged by its **acceptance against an observable criterion**, not by its form. This mission is unusual in one way only: the system under delivery is the delivery framework itself, so the contract doubles as the product's credibility argument — runward's own repository must pass `runward check --strict`. If the gate ever goes red on main, the product's central claim is broken, and fixing it outranks any feature.

## Engagements

| Engagement | Deliverables | Definition of Done |
|---|---|---|
| **Flash framing** | Framing note: the missing per-rule gate, the deterministic-verdict criterion, floor vs target | Done — see [framing.md](framing.md); the floor scope shipped as `init`/`check`/`status` |
| **Executable floor** | The CLI on npm; the strict gate verifying real missions; the reference mission green out of the box | Done — `npm i -g runward` installs a working gate; `runward init --example` scaffolds a strict-green mission |
| **Staged iteration** | Typed evidence, signatures, sealing, manifest sync, machine rule surface, compliance packs — each behind an accepted ADR | Ongoing — every increment lands with its ADR in `docs/adr/` and full test coverage; no increment without a traced decision |
| **Handover** | This mission, the runbook, 24 ADRs, the reference mission, CONTRIBUTING/GOVERNANCE | A new maintainer can release, debug a red gate, and add a rule using only what is in the repository |

## Acceptance of the whole mission

1. `runward check --strict` at the repository root exits 0 — the product passes its own gate.
2. The CI chain is green on main: unit + fuzz + golden OSCAL + smoke + network-isolated core run, on Node 20/22/24.
3. Governance is in place: threat model, supply-chain hardening (SHA-pinned actions, provenance, Scorecard, CODEOWNERS), and the zero-network invariant enforced structurally.
4. The mission is transmissible: everything a new maintainer needs is versioned in this repository, nothing lives in anyone's head.

## Tier and roadmap

Stopping tier: **full chain** — frame through handover, then continuous iteration on evidence. Gates are crossed on measured evidence, never by calendar: a feature enters only with an ADR, tests, and a green strict gate; a release only from a green chain via the provenance-signed workflow.

## The contract, filled

| Field | Value |
|---|---|
| **Problem** | Agent-delivered code accumulates without traced decisions; no deterministic per-rule conformance gate existed |
| **Success criterion** | Deterministic, replayable strict-gate verdict; full CI chain green; package on npm with provenance |
| **Floor** | The `init`/`check`/`status` CLI, proven on this repository and the reference mission |
| **Target** | Richer rule set, regime lenses, more inert adapters, brownfield reconstruction — named in [framing.md](framing.md) §5 |
| **Engagements retained** | All four: framing, floor, staged iteration, handover |
| **Milestones & gates** | Per release; each release requires green CI plus the strict gate on the repo's own mission |
| **Deliverables & DoD** | Engagements table above |
| **Hard constraints** | Zero-LLM/zero-network verdict, no telemetry, never a runtime, vendor-neutral, supply-chain hardened |
| **Risks owned by the sponsor** | Single-maintainer bus factor — mitigated by this mission and the runbook, accepted until a co-maintainer exists |
