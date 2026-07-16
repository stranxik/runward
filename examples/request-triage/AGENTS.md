# Agent charter — Inbound Request Triage (finalized leave-behind)

**Finalized at hand-over, 2026-07-03** — this is no longer the scaffolded charter: it carries what this mission learned. Any agent working on this system follows it; the receiving team owns the gate. Names and dates are illustrative, like the rest of the reference mission.

## Non-negotiable boundaries (mission-specific)

1. **No model-proposed value ever acts.** Every action-bearing field is recomputed or verified deterministically before RoutingPort (ADR-0002). The provenance marker is the law: `model-proposed` never routes, fail-closed.
2. **The account registry is read-only for agents.** It is the deterministic source the guard checks against; an agent that writes to it is falsifying its own verifier.
3. **Compliance-flagged records are always approval-gated.** No change may route them without human approval — the framing note's attached condition, not a default to optimize away.
4. **The TriageRecord contract changes only through governance.** Category vocabulary, fields, provenance markers: versioned, additive, one PR with its ADR — never widened ad hoc because the review queue grows (runbook §4).
5. **Traces stay in-app.** No third-party trace export without its own decision naming recipient, data class and retention (ADR-0003; execution-topology.md).

## How work is verified here

- `cd code && npm test` — the behavioral proof (domain, guard, contracts).
- `npx runward check --strict` — the conformance gate; the sole authority on the manifests.
- `cd code && npm run demo` — the guard's climax, reproducible: the fabricated account reference (`ACC-7777`) is refused fail-closed and escalated.
- Before crossing any green gate: the `verify` workflow (`runward/workflows/verify.md`), findings recorded in `runward/governance/verify-findings.md`.

## Never / PR rules

- **Never**: route on an unverified field; approve a compliance record programmatically; delete or rewrite the triage log (append-only); disable the guard "temporarily".
- **Always via a reviewed PR with its ADR**: contract or schema changes, category vocabulary changes, a new placement (execution-topology row), any new capability (decision matrix first — no trigger, no change).

## Mission state

| File | What it holds |
|---|---|
| `runward/framing.md` · `runward/floor.md` | The criterion, and the measured proof against it |
| `runward/architecture.md` · `runward/execution-topology.md` | Ports, placements, sovereignty |
| `runward/adr/` | The decision journal — read the re-evaluation triggers before reopening anything |
| `runward/runbook.md` | The operating gestures (start, observe, recover, swap, approve) |
| `runward/handover.md` | The succession record: the kit, the redone-task proof, the named owner |
