# EU AI Act — Annex IV technical documentation — assessment-readiness draft

> **Draft, incomplete — not a conformity assessment.** Assembled by `runward compliance eu-ai-act` on 2026-01-01,
> deterministically from ratified engineering artifacts (no model call). High-risk obligations bind from
> **2 December 2027 (Annex III) / 2 August 2028 (Annex I)** (Chapter III, Sections 1, 2 and 3 -- Art. 113, 3rd para, point (c), as replaced by Regulation (EU) 2026/1744. Annex III systems (Art. 6(2)) from 2 December 2027; Annex I systems (Art. 6(1)) from 2 August 2028.). This populates Annex IV Point 2 (design & validation) and the design-rationale
> history; it does **not** satisfy art. 12 runtime logging, and it is not a signed declaration of conformity.
> Verify against the Official Journal text before filing.
> Lens: EU AI Act (Annex IV) (mapping version 2026-1744) — `eu-ai-act@2026-1744`.

> **Declared non-scope of every green row (ADR-0040).** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing.

> **Gate verdict when this draft was assembled: gaps (--strict, exit 1, 46 conformance gap(s)).** The gate REFUSED this tree — this draft documents readiness gaps, not readiness. Run `runward check --strict` for the refusals.

## Annex IV coverage map

| Annex IV point | runward supplies | Required from the provider |
|---|---|---|
| 1. General description | UI, HW/SW/firmware notes | intended purpose, provider, versioning, distribution |
| 2. Elements & development | **architecture, validation procedures + metrics, cybersecurity (manifest + rubric + threat model); design choices, alternatives, assumptions, pre-determined changes = the ADR journal** | third-party sourcing/licensing, sign-off on test logs |
| 3. Monitoring & control | accuracy characterization, input-data specs, oversight tooling | fundamental-rights / discrimination risk sourcing |
| 4. Performance metrics | metric-choice justification (rubric) | — |
| 5. Risk management (art. 9) | technical inputs (threat model, testing) | **risk acceptance / RMS governance** |
| 6. Lifecycle changes | engineering change record (ADR journal) | release/change-management governance |
| 7. Harmonised standards | technical notes | **standards selection** (compliance strategy) |
| 8. Declaration of conformity | — | **signed legal act (art. 47)** |
| 9. Post-market monitoring | telemetry/logging backbone | **post-market monitoring plan (art. 72)** |

## Point 2 — design decisions (ADR journal, near-verbatim to the Annex IV requirement)

_No ratified ADR found in `runward/adr/`._

## Agentic-risk coverage (OWASP ASI → Point 2 cybersecurity / Point 5 risk)

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

## Control-implementation status (feeds Point 2 validation)

_No filled `Rule conformance` manifest found yet — fill the architect/floor/govern deliverables (`runward check --strict`)._

## Required from the provider (runward cannot produce this)

- **Point 1** general description (intended purpose, provider, versioning) · **Point 5** RMS governance & risk acceptance (art. 9).
- **Point 7** harmonised-standards selection · **Point 8** the signed **EU declaration of conformity** (art. 47) · **Point 9** the **post-market monitoring plan** (art. 72(3); the Commission must adopt guidance and a template by 2 September 2027).
- **Art. 12 runtime event logs** — produced by the running system, not by runward.

_Engineering framing, not legal advice; Annex IV wording moves — confirm against the Official Journal (Reg. (EU) 2024/1689) before filing._

