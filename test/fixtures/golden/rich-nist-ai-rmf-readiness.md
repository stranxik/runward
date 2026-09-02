# NIST AI RMF — assessment-readiness draft

> **Draft, incomplete — not a compliance claim.** Assembled by `runward compliance nist-ai-rmf` on 2026-01-01,
> deterministically from ratified engineering artifacts (no model call). The AI RMF is **voluntary guidance**
> with no pass/fail and no certification; this populates the MEASURE/documentation evidence and an ASI crosswalk,
> while GOVERN, risk tolerance and go/no-go stay the operator's. Verify the current AI RMF text before use.
> Lens: NIST AI RMF (mapping version 1.0) — `nist-ai-rmf@1.0`.

> **Declared non-scope of every green row (ADR-0040).** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing. A ratification trace proves a human answered the displayed evidence; it does not prove they understood it.

> **Gate verdict when this draft was assembled: clean (--strict, exit 0, 0 conformance gap(s)).**

## 1. Agentic-risk crosswalk (OWASP ASI → AI RMF)

An indicative engineering crosswalk (not NIST-endorsed): each agentic-security risk lands primarily under **MEASURE** (test & evaluate, esp. security & resilience) and **MANAGE** (risk treatment). Confirm subcategory selection against AI RMF §5.

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

## 2. MEASURE / TEVV documentation

Feeds MEASURE 2.x — documented, repeatable test methodology and results. From your mission: **23 applied · 0 deviated · 13 n/a** across 36 rule(s).
- Evaluation rubric (test sets, metrics, tooling): **present** — confirm it is filled
- Threat model (adversarial / risk-source analysis): **present** — confirm it is filled

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
| `handover-redone-task-proof` | applied | §2 — 2026-07-02, ops engineer, incident-recovery task end to end without the builder; file:code/test/triage.test.ts; file:runward/runbook.md#Recovery | Handover |
| `handover-runbook-executable` | applied | file:runward/runbook.md#Recovery — the seven gestures carry commands/paths (start §1, observe §1, debug §4, resume §3, swap §2+§4, bench: cd code && npm test, approvals §3); exercised during the 2026-07-02 task | Handover |
| `handover-agents-charter-final` | applied | file:AGENTS.md#Never — finalized at hand-over: mission-specific boundaries (registry read-only, compliance always approval-gated), exact verification commands, never/PR rules | Handover |
| `handover-succession-named` | applied | §3 — named owner (triage product owner), escalation path, weekly review cadence, builder's accesses revoked 2026-07-03 | Handover |

## 3. Design decisions (ADR journal)

| ADR | Status |
|---|---|
| ADR-0001: single orchestrator, sequential triage (`ADR-0001-single-orchestrator.md`) | accepted |
| ADR-0002: deterministic guard on model-extracted fields (`ADR-0002-deterministic-guard-on-extracted-fields.md`) | accepted |
| ADR-0003: port placement and sovereignty behind the four ports (`ADR-0003-port-placement-and-sovereignty.md`) | accepted |

## Required from the operator / organization (runward cannot produce this)

- **GOVERN** — policies, roles, accountability, **risk tolerance** (almost entirely organizational).
- **MAP** — intended purpose, business/legal context, use-case risk enumeration.
- **MANAGE** — the **go/no-go acceptance** decision, resourcing, response planning.
- **Profiles** — Current/Target selection, prioritization, the risk-tolerance choices behind them.

_Indicative engineering framing, not legal advice; NIST prescribes no report template — confirm against AI 100-1 and the Playbook._

