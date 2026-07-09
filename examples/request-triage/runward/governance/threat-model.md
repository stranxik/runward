# Threat Model: Inbound Request Triage Qualifier

**Version**: v1.0 · **Last review**: 2026-06-19 · **Agent privilege level**: low

Principle applied: injection is constrained by architecture, not detection. The model is not a trust boundary — every request the system exists to process is untrusted content by definition, so the design assumes hostile text on every run.

## 1. Attack surfaces

| Surface | Description | Trust | Primary risk |
|---|---|---|---|
| **Untrusted input (direct)** | the raw request text itself — mailbox body, web-form fields; the entire workload | untrusted | direct injection: text crafted to steer classification or fabricate extractions |
| **Untrusted input (indirect)** | none at the floor — no retrieval, no external documents; attachments are out of scope (ADR-0001) | — | — |
| **Memory** | none at the floor — each request is triaged independently (named deferral, framing §6) | — | no persisted-injection surface exists yet; revisit when requester memory enters |
| **Tools** | account registry lookup, deterministic date parser, queue resolution — registry with middleware chain | guarded | a fabricated account reference resolving to the wrong customer |
| **Exposed surface** | none published — the qualifier consumes; it exposes no tool server | — | — |
| **Secrets and sensitive data** | model gateway credential, ticketing API credential, account registry access | internal | exfiltration via routed content |

## 2. Lethal trifecta

| Path / context window | Private data | Untrusted content ingested | Outbound communication | Verdict |
|---|---|---|---|---|
| Triage run (classify → guard → route) | yes — account registry, requester identity | yes — the request text is in context | **no** — the floor never replies to requesters; routing writes only to the internal ticketing system | safe (2 of 3) |
| Target tier: auto-drafted acknowledgments | yes | yes | yes — mail back to the requester | 3 of 3 → human approval on every send, already recorded in framing §5 |

**Context-window rule**: the floor holds at two of three by construction — outbound communication is removed from the tier, not filtered. The target's acknowledgment feature is the known 3-of-3 path; it enters only under per-send human approval, never autonomous.

## 3. Guardrails

- **Separation of the untrusted**: request text is passed to the model as data with a fixed instruction frame; nothing in the request can add tools or change the plan — the plan is fixed and sequential (ADR-0001).
- **Least privilege on tools**: the model proposes; it calls nothing. Deterministic tools run outside the model loop, on the orchestrator's fixed plan.
- **Deterministic guard**: no model-proposed value acts — every action-bearing field is recomputed or verified before RoutingPort (ADR-0002), fail-closed.
- **Human approval**: every compliance-flagged record passes human review before routing (framing §3 attached condition).
- **Output validation**: TriageRecord v1.0 schema enforced at the boundary; non-conforming records rejected, never repaired silently.
- **Immutable log**: every triage decision appended with provenance markers — any injected influence stays traceable per field.

## 4. Approval points

| Action | Approval trigger | Presentation to the human | If no response |
|---|---|---|---|
| Route a compliance-flagged record | always | deterministic summary: category, extracted fields with provenance markers, target queue — built from the record, never a model paraphrase | record waits in the review queue; the regulatory-deadline field is displayed so the queue is worked by deadline |
| Route a record whose fields stayed unverified | always (guard escalation, ADR-0002) | same deterministic summary, with the per-field guard failure reason | same review queue |

The review queue is prioritized (compliance deadline first) and summaries are uniform, so reviewers judge content, not layout — the rubber-stamp risk is watched via the guard-escalation rate (25% reevaluation trigger, ADR-0002).

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
| eval-loop | applied | evaluation-rubric.md — abstention scenarios, guard-escalation rate watched off the hot path |
| security-prompt-injection | applied | §3 guardrails — untrusted request text is data; deterministic guard before RoutingPort (ADR-0002) |
| config-secrets-boundary | n/a | the illustrative floor reads no provider secret (deterministic keyword classifier) |
| resilience-fail-open | applied | §3 — sensitive routing fails closed; the guard rejects on doubt (ADR-0002) |
| resilience-multi-provider-fallback | n/a | single deterministic classifier; no second provider in this floor |
| resilience-retry-backoff | n/a | in-memory adapters; no external call to retry in the shipped floor |
| async-job-guardrails | n/a | synchronous request triage; no background jobs at the floor |
| security-mcp-server-pinning | n/a | no MCP or external tool server consumed at the floor |
| security-tool-change-reapproval | n/a | tools are in-process and deterministic; no signed external tool to re-approve |
| data-memory-provenance | n/a | no persistent memory; each request is triaged independently (named deferral) |

## References

- [ADR-0002](../adr/ADR-0002-deterministic-guard-on-extracted-fields.md) — the structural defense on the action path.
- [observability-schema.md](observability-schema.md) — per-field guard outcomes feeding the audit trail.
- [evaluation-rubric.md](evaluation-rubric.md) — abstention scenarios exercising this model's failure modes.
