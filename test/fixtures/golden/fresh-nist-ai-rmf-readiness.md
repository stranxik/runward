# NIST AI RMF — assessment-readiness draft

> **Draft, incomplete — not a compliance claim.** Assembled by `runward compliance nist-ai-rmf` on 2026-01-01,
> deterministically from ratified engineering artifacts (no model call). The AI RMF is **voluntary guidance**
> with no pass/fail and no certification; this populates the MEASURE/documentation evidence and an ASI crosswalk,
> while GOVERN, risk tolerance and go/no-go stay the operator's. Verify the current AI RMF text before use.
> Lens: NIST AI RMF (mapping version 1.0) — `nist-ai-rmf@1.0`.

> **Declared non-scope of every green row (ADR-0040).** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing. A ratification trace proves a human answered the displayed evidence; it does not prove they understood it.

> **Gate verdict when this draft was assembled: gaps (--strict, exit 1, 36 conformance gap(s)).** The gate REFUSED this tree — this draft documents readiness gaps, not readiness. Run `runward check --strict` for the refusals.

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

Feeds MEASURE 2.x — documented, repeatable test methodology and results. From your mission: **0 applied · 0 deviated · 0 n/a** across 0 rule(s).
- Evaluation rubric (test sets, metrics, tooling): **missing**
- Threat model (adversarial / risk-source analysis): **missing**

_No filled `Rule conformance` manifest found yet — fill the architect/floor/govern deliverables (`runward check --strict`)._

## 3. Design decisions (ADR journal)

_No ratified ADR found in `runward/adr/`._

## Required from the operator / organization (runward cannot produce this)

- **GOVERN** — policies, roles, accountability, **risk tolerance** (almost entirely organizational).
- **MAP** — intended purpose, business/legal context, use-case risk enumeration.
- **MANAGE** — the **go/no-go acceptance** decision, resourcing, response planning.
- **Profiles** — Current/Target selection, prioritization, the risk-tolerance choices behind them.

_Indicative engineering framing, not legal advice; NIST prescribes no report template — confirm against AI 100-1 and the Playbook._

