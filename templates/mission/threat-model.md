# Threat Model: [system or agent name]

> **Usage.** This threat model maps the attack surfaces specific to an agentic system and fixes the guardrails. Principle: you do not defend against injection with detection — unreliable, especially for indirect injection — but with architecture. The model is not a trust boundary. The first-rank threat is prompt injection, intrinsic to any memory or retrieval. The worst case arises when a **lethal trifecta** — private-data access, untrusted-content ingestion, outbound communication — meets on one unguarded path; removing any one of the three defuses it. Operational rule: allow at most **two of the three while untrusted content is in the context window**; when all three are needed, the action goes under human supervision, never autonomous. Replace every `[placeholder]`; delete this notice on delivery.

**Version**: [vX.Y] · **Last review**: [YYYY-MM-DD] · **Agent privilege level**: [low | high]

## 1. Attack surfaces

[List every way a hostile instruction or datum can enter or act.]

| Surface | Description | Trust | Primary risk |
|---|---|---|---|
| **Untrusted input (direct)** | [user input] | untrusted | [direct injection] |
| **Untrusted input (indirect)** | [retrieved content: page, document, memory item] | untrusted | [indirect injection, fired at ingestion] |
| **Memory** | [working memory, consolidated items] | untrusted by inheritance | [persisted injection, replayed later] |
| **Tools** | [tool registry exposed to the model] | guarded | [unauthorized call of an impactful tool] |
| **Exposed surface** | [tool server published by the system] | guarded | [unauthenticated access, unbounded rate] |
| **Secrets and sensitive data** | [configuration, private data] | internal | [exfiltration] |

## 2. Lethal trifecta

[Assess the three properties on every sensitive path. The danger is never one property alone; it is their meeting.]

| Path / context window | Private data | Untrusted content ingested | Outbound communication | Verdict |
|---|---|---|---|---|
| [path] | [yes / no] | [yes / no] | [yes / no] | [safe (2 of 3) / human supervision (3 of 3)] |

**Context-window rule**: at most two of the three properties at once **while untrusted content is present in the context window** (the scope is the context, not the session — a session may hold many contexts, and the risk exists exactly as long as the untrusted content does). If all three are genuinely required on one path, the action does not run autonomously — it goes under human validation. For every three-of-three path, document which property is removed, or why supervision is imposed instead.

## 3. Guardrails

[The non-negotiable base as soon as external content is ingested.]

- **Separation of the untrusted**: [retrieved content treated as data, never as instruction; kept apart from instructions; purged from context after use.]
- **Least privilege on tools**: [the model sees only what it may call; the registry is filtered by role before the model sees it.]
- **Human approval**: [on consequential actions and any outbound communication.]
- **Output validation**: [tool and model outputs validated by schema before they act.]
- **Immutable log**: [any injected action stays traceable and reversible.]
- **High-privilege patterns (if applicable)**: [proportionate to risk: pre-approved action sets (action selector); plan frozen before exposure to tool outputs (plan-then-execute); isolation of untrusted processing; or a privileged planner split from a quarantined model that only reads the untrusted (dual model).]

## 4. Approval points

[Actions that require human approval — declared in the tool's contract, enforced by infrastructure.]

| Action | Approval trigger | Presentation to the human | If no response |
|---|---|---|---|
| [mutation, write, external push] | [always / above threshold] | [deterministic summary, faithful to the tool's real arguments — never a model paraphrase] | [agent suspended in durable state, resources freed, rehydrated on decision] |

**Reminder**: the approval summary is itself an attack surface. It must be deterministic and faithful to the real arguments, or an injected action slips through in the batch. Group low-urgency requests into a prioritized queue with summaries, so approvers are not trained to rubber-stamp.

## References

- [Related hardening ADR, observability schema, evaluation rubric.]
