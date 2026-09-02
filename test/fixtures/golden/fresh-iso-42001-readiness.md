# ISO/IEC 42001 — assessment-readiness draft

> **Draft, incomplete — not a compliance claim.** Assembled by `runward compliance iso-42001` on 2026-01-01,
> deterministically from ratified engineering artifacts (no model call, nothing scraped or run). It populates the
> **technical-evidence layer and its index**; the applicability, risk-acceptance, policy and management sign-off it
> cannot invent are listed under "Required from the operator". This is **supporting evidence**, never certification —
> only an accredited body certifies an AI management system. Verify the current ISO/IEC 42001 text before an audit.
> Lens: ISO/IEC 42001 (mapping version 2023) — `iso-42001@2023`.

> **Declared non-scope of every green row (ADR-0040).** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing.

> **Gate verdict when this draft was assembled: gaps (--strict, exit 1, 36 conformance gap(s)).** The gate REFUSED this tree — this draft documents readiness gaps, not readiness. Run `runward check --strict` for the refusals.

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

Feeds the Statement of Applicability's implementation-status + evidence columns (6.1.3). From your mission's manifests: **0 applied · 0 deviated · 0 n/a** across 0 accounted rule(s).

_No filled `Rule conformance` manifest found yet — fill the architect/floor/govern deliverables (see `runward check --strict`)._

## 3. Design decisions (ADR journal)

The "key design choices, alternatives, and re-evaluation triggers" an ISO 42001 auditor expects (records under Annex A control groups).

_No ratified ADR found in `runward/adr/`._

## 4. Risk & impact inputs (presence)

- Threat model (feeds risk assessment 6.1.2): **not counted** (raw template)
- Evaluation rubric (feeds impact/validation analysis): **not counted** (raw template)

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

