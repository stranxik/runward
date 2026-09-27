# Hand-over Note — runward

**Date**: 2026-07-16 · **State**: the succession has not happened — single-maintainer product, the builder has not departed. This note records the kit as it stands, what is already exercised without the builder, and what flips the day a second maintainer arrives. An honest phase-6 record, not a simulated one.

## 1. The kit

| Artifact | Where | State | Exercised by the receiving side? |
|---|---|---|---|
| Recovery runbook | `runbook.md` | ready | its build/test/gate gestures run on a pristine CI machine at every push |
| Contributor charter (the leave-behind) | `CONTRIBUTING.md` + `GOVERNANCE.md` (project root) | current | every external PR exercises it |
| Architecture note + decision journal | `architecture.md` · `docs/adr/` (dated triggers; the directory is the count) | current | — |
| Evaluation bench | `npm test` (unit + fuzz + golden + smoke + OSCAL schema) | ready | CI, three Node versions, plus network-isolated |
| Evidence pack | `runward compliance <regime>` (regenerable; spec: `docs/spec/runward-oscal-mapping.md`) | regenerable on demand | — |

## 2. The redone task (the proof)

Not yet redone by a human successor — there is no successor. What already runs without the builder, mechanically: every push, a pristine CI runner reproduces the whole chain from the repository alone — build, the full test suite, and `runward check --strict` on this very mission, including with the network cut. The day a second maintainer cuts their first release from `runbook.md` §3 alone, that release is the redone task and this section records it.

## 3. Succession

- **Owner**: the maintainer, named in `GOVERNANCE.md` — decisions, releases, keys (none long-lived: publishing is OIDC trusted publishing, no token exists to hand over).
- **Escalation path**: security reports via `SECURITY.md` (private reporting); everything else through GitHub issues per `GOVERNANCE.md`.
- **Review cadence**: the ADR re-evaluation triggers are re-read at each release review (every ADR carries a dated trigger); CI, Scorecard and Dependabot watch continuously.
- **Known risk, stated**: bus factor of one. Mitigations already in place: the runbook targets "the next maintainer" explicitly, the mission carries its own strict-green gate, and no publish credential exists to lose. The residual risk is judgment, not access — which is exactly what the doctrine, the ADR journal and `runward explain` transmit.

## 4. Provider-swap drill

No model provider exists in this system by invariant (zero-LLM gate, ADR-0001) — there is nothing to swap. The nearest analogue, exercised on every push: the CI matrix proves the CLI on Node 20, 22 and 24, so the runtime under the tool is swappable and proven, not assumed.

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| handover-redone-task-proof | n/a | no succession has occurred: single-maintainer product, the builder has not departed. The mechanical half runs at every push (a pristine CI runner reproduces build, tests and the strict gate from the repository alone — file:.github/workflows/ci.yml); a second maintainer's first release becomes the redone task and flips this row to applied |
| handover-runbook-executable | applied | file:runward/runbook.md#reports-fresh; file:runward/runbook.md#checkpoint — every gesture carries its real command (build, test, lint, committed reports, OIDC release and its verification, golden regeneration, red-gate debugging, rule and regime evolution); the agentic-runtime gestures (checkpoint resume, provider swap, suspended approvals) have no referent in a CLI that is never a runtime, and the runbook has a row saying so |
| handover-agents-charter-final | applied | file:AGENTS.md#--strict — the finalized charter for whoever works on this repository next, agent or person: the verification commands (npm test, lint, the strict self-gate, the committed-report check), the boundaries that are never crossed (no manifest edited to pass, no ratification by an agent, no golden regenerated unread, no local publish) and the pull-request rules; file:CONTRIBUTING.md#PR; file:GOVERNANCE.md#Maintainer |
| handover-succession-named | applied | file:runward/handover.md#Succession; file:GOVERNANCE.md#Ownership — owner named, review cadence stated; no escalation beyond the single owner exists today, and that is stated as the known risk and priced for adopters (file:docs/compliance/regulated-adoption.md#Bus); no long-lived credential exists to hand over (OIDC publishing), so revoked-at-succession is structurally empty |

## Cross-references

- `runbook.md` — the operational half of the kit, written for the next maintainer.
- `CONTRIBUTING.md` · `GOVERNANCE.md` · `SECURITY.md` — the charter the receiving side already operates under.
- `docs/adr/` — the open re-evaluation triggers the owner watches, release by release.
