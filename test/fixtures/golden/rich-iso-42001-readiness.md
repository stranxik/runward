# ISO/IEC 42001 — assessment-readiness draft

> **Draft, incomplete — not a compliance claim.** Assembled by `runward compliance iso-42001` on 2026-01-01,
> deterministically from ratified engineering artifacts (no model call, nothing scraped or run). It populates the
> **technical-evidence layer and its index**; the applicability, risk-acceptance, policy and management sign-off it
> cannot invent are listed under "Required from the operator". This is **supporting evidence**, never certification —
> only an accredited body certifies an AI management system. Verify the current ISO/IEC 42001 text before an audit.
> Lens: ISO/IEC 42001 (mapping version 2023) — `iso-42001@2023`.

> **Declared non-scope of every green row (ADR-0040).** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing.

> **Gate verdict when this draft was assembled: clean (--strict, exit 0, 0 conformance gap(s)).**

## 1. Agentic-risk coverage (OWASP ASI → your rules)

Feeds the ISO 42001 risk assessment (6.1.2) and control selection (6.1.3): which agentic-security risks are addressed by named engineering rules.

| ASI | Risk | Rules addressing it |
|---|---|---|
| ASI01 | Agent Goal Hijack | `frontier-deterministic-boundary`, `hexa-move-deterministic-out`, `security-prompt-injection` |
| ASI02 | Tool Misuse & Exploitation | `checklist-pre-production-security`, `hexa-move-deterministic-out`, `resilience-fail-open`, `security-code-execution-sandbox`, `security-tool-change-reapproval`, `tools-registry-pattern`, `tools-scope-atomicity` |
| ASI03 | Identity & Privilege Abuse | `checklist-pre-production-security`, `config-secrets-boundary`, `tools-registry-pattern` |
| ASI04 | Agentic Supply Chain Vulnerabilities | `contracts-governance`, `hexa-typescript-native`, `resilience-multi-provider-fallback`, `security-mcp-server-pinning`, `security-tool-change-reapproval`, `topology-trace-export-decision` |
| ASI05 | Unexpected Code Execution | `security-code-execution-sandbox` |
| ASI06 | Memory & Context Poisoning | `checklist-pre-production-security`, `data-memory-provenance`, `patterns-memory-router-tiered`, `security-prompt-injection`, `state-event-sourcing` |
| ASI07 | Insecure Inter-Agent Communication | `contracts-governance` |
| ASI08 | Cascading Failures | `async-job-guardrails`, `checklist-pre-production-resilience`, `eval-loop`, `handover-runbook-executable`, `provider-no-crash-missing-env`, `resilience-fail-open`, `resilience-multi-provider-fallback`, `resilience-retry-backoff`, `scaling-distributed-rate-limiting` |
| ASI09 | Human-Agent Trust Exploitation | `handover-redone-task-proof`, `security-human-agent-trust` |
| ASI10 | Rogue Agents | `config-secrets-boundary`, `handover-agents-charter-final`, `scaling-distributed-rate-limiting`, `security-mcp-server-pinning` |

## 2. Control-implementation status (rule conformance)

Feeds the Statement of Applicability's implementation-status + evidence columns (6.1.3). From your mission's manifests: **24 applied · 0 deviated · 22 n/a** across 46 accounted rule(s).

| Rule | Status | Evidence | Phase |
|---|---|---|---|
| `contracts-governance` | applied | file:code/src/core/ports/model-provider.port.ts#TriageModelPort — §3 TriageRecord v1.0 — versioned, additive, tolerant reader, fail-closed; contracts/ | Architect |
| `hexa-architecture` | applied | file:code/src/core/application/triage-request.usecase.ts#TriageRequestUseCase — §2 pure triage domain, four ports; code/src/core/ | Architect |
| `hexa-adapter-pattern` | applied | file:code/src/adapters/keyword-model.adapter.ts#KeywordModelAdapter — §3 every dependency behind a port; code/src/adapters/ | Architect |
| `hexa-typescript-native` | n/a | language deliberately left open at this note (§5); locked at floor kickoff (ADR-0004 pending) | Architect |
| `process-adr-and-journal` | applied | adr:0001 — adr/ADR-0001, adr/ADR-0002, adr/ADR-0003 — dated decisions with reevaluation triggers | Architect |
| `security-mcp-server-pinning` | n/a | the floor consumes no MCP or external tool server; tools are in-process and deterministic | Architect |
| `topology-port-placement-mapped` | applied | file:code/src/core/ports/routing.port.ts#RoutingPort — §2 map — all four ports placed; the two non-in-app placements (ModelPort → managed vendor runtime, RoutingPort → existing ticketing infra) are locked in ADR-0003 (the infra ADR family) | Topology |
| `topology-sovereignty-by-data-class` | applied | file:code/src/adapters/hardcoded-account-registry.adapter.ts — §2 map — a data class and a sovereignty level per port; request text is bound to the approved model deployment (residency), the TriageRecord is kept internal | Topology |
| `topology-trace-export-decision` | n/a | the floor exports no execution traces to a third party; observability is in-app structured logs per governance/observability-schema.md | Topology |
| `topology-usage-registry-present` | applied | §3 usage registry — the single prod deployment with its risk class, data classes, action scopes and owner | Topology |
| `frontier-deterministic-boundary` | applied | file:code/src/core/domain/guard.ts#guardFields; test:code/test/triage.test.ts — every action-bearing field recomputed/verified (ADR-0002), fail-closed | Floor |
| `hexa-move-deterministic-out` | applied | file:code/src/core/domain/guard.ts#parseDeadline — classification and validation are deterministic, out of the model | Floor |
| `config-secrets-boundary` | n/a | the illustrative floor runs the deterministic keyword classifier; no provider secret is read in this example code | Floor |
| `provider-llm-auto-detection` | n/a | only the deterministic keyword adapter ships here; no real provider to auto-detect | Floor |
| `security-prompt-injection` | applied | test:code/test/triage.test.ts — threat-model §3 + ADR-0002 — model-proposed values never act; request text is data, not instruction | Floor |
| `hexa-architecture` | applied | file:code/src/core/domain/triage.ts — code/src/core/ pure domain behind four ports | Floor |
| `hexa-adapter-pattern` | applied | file:code/src/adapters/in-memory-routing.adapter.ts — code/src/adapters/ — mailbox/web, keyword-model, routing, log behind ports | Floor |
| `provider-no-crash-missing-env` | applied | file:code/src/adapters/keyword-model.adapter.ts — deterministic fallback runs with no key | Floor |
| `state-event-sourcing` | applied | file:code/src/adapters/in-memory-triage-log.adapter.ts — append-only, keyed by request ID | Floor |
| `tools-scope-atomicity` | applied | file:code/src/core/ports/routing.port.ts#RoutingApproval — architecture §2 middleware chain + approval on RoutingPort for compliance records | Floor |
| `async-post-turn-pipeline` | n/a | the floor is synchronous end to end — one request, one guarded reply, nothing deferred after the turn; an async pipeline is a target-tier capability behind a measured trigger | Floor |
| `checklist-day-zero-project` | applied | file:code/package.json; test:code/test/triage.test.ts — structure, lockfile, tests and the demo run from the first day of the mission | Floor |
| `data-migrations-forward-only` | n/a | the floor persists nothing beyond the registry seeded per run: no database, no migration — persistence is a target-tier decision named with its trigger | Floor |
| `scaling-state-externalization` | n/a | a single-instance floor with no session state: the request registry is rebuilt per run, and externalisation is the multi-instance trigger named in the framing's deferrals | Floor |
| `tools-registry-pattern` | n/a | the model port takes request text in and a label out; no tool call exists on the floor, so there is no tool registry to pattern | Floor |
| `eval-loop` | applied | test:code/test/triage.test.ts — evaluation-rubric.md — abstention scenarios, guard-escalation rate watched off the hot path | Govern |
| `security-prompt-injection` | applied | file:code/src/core/domain/guard.ts#guardFields — §3 guardrails — untrusted request text is data; deterministic guard before RoutingPort (ADR-0002) | Govern |
| `config-secrets-boundary` | n/a | the illustrative floor reads no provider secret (deterministic keyword classifier) | Govern |
| `resilience-fail-open` | applied | §3 — sensitive routing fails closed; the guard rejects on doubt (ADR-0002) | Govern |
| `resilience-multi-provider-fallback` | n/a | single deterministic classifier; no second provider in this floor | Govern |
| `resilience-retry-backoff` | n/a | in-memory adapters; no external call to retry in the shipped floor | Govern |
| `async-job-guardrails` | n/a | synchronous request triage; no background jobs at the floor | Govern |
| `security-mcp-server-pinning` | n/a | no MCP or external tool server consumed at the floor | Govern |
| `security-tool-change-reapproval` | n/a | tools are in-process and deterministic; no signed external tool to re-approve | Govern |
| `data-memory-provenance` | n/a | no persistent memory; each request is triaged independently (named deferral) | Govern |
| `security-code-execution-sandbox` | n/a | the floor runs no model-generated or tool-invoked code; the classifier is deterministic in-process code and RoutingPort calls a typed ticketing API, not code | Govern |
| `security-human-agent-trust` | applied | file:code/src/core/domain/guard.ts#buildApprovalSummary — §3 — each TriageRecord field carries a provenance marker (computed / verified / model-proposed); RoutingPort approval on a compliance-flagged record shows provenance before the human decides (ADR-0002) | Govern |
| `checklist-pre-production-observability` | n/a | the floor ships baseline observability (structured logs, request id, per-call metrics) and stops before production by its framing; the pre-production pass belongs to the tier the deferrals name | Govern |
| `checklist-pre-production-performance` | n/a | the floor's stopping tier is proven on real traffic, not deployed to production; the performance checklist is the gate the target tier will cross, with its trigger in the decision matrix | Govern |
| `checklist-pre-production-resilience` | n/a | single-instance floor behind a human review step: retries, fallbacks and load posture are target-tier items, deferred with their triggers in the framing | Govern |
| `checklist-pre-production-security` | n/a | the floor's security posture is carried by the guard rows above (deterministic boundary, prompt-injection guard, human send); the pre-production security pass belongs to the deployment tier the framing defers | Govern |
| `routing-confidence-upgrade` | n/a | one model tier on the floor; no router exists to upgrade on confidence — smart routing is deferred with its trigger in the decision matrix | Govern |
| `handover-redone-task-proof` | applied | §2 — 2026-07-02, ops engineer, incident-recovery task end to end without the builder; file:code/test/triage.test.ts; file:runward/runbook.md#Recovery | Handover |
| `handover-runbook-executable` | applied | file:runward/runbook.md#Recovery — the seven gestures carry commands/paths (start §1, observe §1, debug §4, resume §3, swap §2+§4, bench: cd code && npm test, approvals §3); exercised during the 2026-07-02 task | Handover |
| `handover-agents-charter-final` | applied | file:AGENTS.md#Never — finalized at hand-over: mission-specific boundaries (registry read-only, compliance always approval-gated), exact verification commands, never/PR rules | Handover |
| `handover-succession-named` | applied | §3 — named owner (triage product owner), escalation path, weekly review cadence, builder's accesses revoked 2026-07-03 | Handover |

## 3. Design decisions (ADR journal)

The "key design choices, alternatives, and re-evaluation triggers" an ISO 42001 auditor expects (records under Annex A control groups).

| ADR | Status |
|---|---|
| ADR-0001: single orchestrator, sequential triage (`ADR-0001-single-orchestrator.md`) | accepted |
| ADR-0002: deterministic guard on model-extracted fields (`ADR-0002-deterministic-guard-on-extracted-fields.md`) | accepted |
| ADR-0003: port placement and sovereignty behind the four ports (`ADR-0003-port-placement-and-sovereignty.md`) | accepted |

## 4. Risk & impact inputs (presence)

- Threat model (feeds risk assessment 6.1.2): **filled**
- Evaluation rubric (feeds impact/validation analysis): **filled**

## Required from the operator / organization (runward cannot produce this)

These sections are managerial, legal or organizational — no tool can assemble them from engineering artifacts:

- **AI policy** (5.2) and **AIMS scope** (4.3).
- **Statement of Applicability — the applicability decisions and inclusion/exclusion justifications** (6.1.3): runward supplies the status + evidence columns; the *applicability* judgment is yours.
- **Risk methodology, acceptance criteria and risk-acceptance decisions** (6.1.2, 8.3).
- **AI system impact assessment report and deployment authorization** (6.1.4).
- **Objectives and targets** (6.2), **roles and competence** (A.3, 7.2).
- **Internal audit** (9.2) and **management review** minutes (9.3).
- **Runtime AI event logs** (A.6.2.8) — produced by the running system, not by runward.

_Regime mapping is dated engineering framing, not legal advice; ISO Annex A control counts/templates are behind the paywalled standard — confirm against the purchased text._

