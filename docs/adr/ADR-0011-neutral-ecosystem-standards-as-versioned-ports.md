# ADR-0011: Neutral ecosystem standards as versioned ports in the reference stack

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — ecosystem veille (2026), sourced state of the art, challenge, durable position

## Context

The veille showed the neutral substrate of the agent ecosystem is now institutionalised under the Linux Foundation / Agentic AI Foundation and adjacent bodies: **MCP** (tools/context), **A2A** (agent-to-agent), **OpenTelemetry GenAI** semantic conventions (observability), and a converging agent-**identity** stack (OAuth 2.1/PKCE, SPIFFE/WIMSE, Entra Agent ID, IETF `agent_assertion`). For runward to stay neutral *and* current, the reference stack must name these standards as the **default contracts of specific ports**, resolved by an adapter decision — without runward ever exporting telemetry, providing a runtime, or bundling an SDK. These specs also churn (MCP revises roughly every eight months), so each must be isolated behind a versioned contract and re-tested on revision.

## Decision

The **reference stack** names, per port, the neutral standard as the default contract, each resolved by a versioned adapter decision and pinned in an ADR:

- **Tools / context port → MCP** (pinned spec version; per ADR-0009, a consumed server is pinned by version and hash).
- **Observability port → OpenTelemetry GenAI semantic conventions** (spans `invoke_agent`, `execute_tool`; pinned — the spec is still experimental). runward prescribes the port and the span contract; the operator plugs the backend (CloudWatch GenAI, Langfuse, Phoenix, Braintrust…) as an adapter. runward exports nothing itself.
- **Identity & delegation port → OAuth 2.1/PKCE + SPIFFE / Entra Agent ID / IETF `agent_assertion`**, sober default: one identity per agent, short scoped credentials, explicit ownership and lifecycle; the decision matrix documents when to harden, on an objective trigger, in an ADR.
- **Distributed-topology toggle → A2A**, deferred default: no A2A until a single agent no longer suffices (a decision-matrix trigger, not a starting default).

runward **references and pins**; it never implements the standard, exports the telemetry, provides the runtime, or ships the sandbox/memory. Each standard's version is pinned in an ADR and re-tested on revision.

## Alternatives discarded

- **Adopt a vendor's proprietary equivalent** (a cloud's native gateway, identity, or eval SDK). Breaks the neutrality that is the moat.
- **Ignore the standards.** runward drifts into irrelevance as the ecosystem converges around them.
- **Implement a standard** (ship an MCP server, an OTel exporter, an identity broker). That crosses the line into being a runtime — the one thing runward must never become.

## Consequences

- **Positive.** runward stays neutral and current: the model, the runtime, the telemetry backend, the identity broker are all adapter decisions behind a port with a named, versioned contract. Isolation behind a versioned contract absorbs spec churn.
- **Negative, accepted.** A pinning-and-re-test discipline: each spec revision (notably MCP) forces a re-test and a new pinned version in an ADR.
- **On other boundaries.** `reference-stack.md` and `decision-matrix.md` name the standards as ports and add the identity-hardening and A2A/distributed triggers; the doctrine's topology and integration sections cite them. The zero-LLM gate is untouched.

## Reevaluation trigger (mandatory, dated)

Reopen on each material spec revision — the finalized **MCP 2026-07-28** first — to re-test the adapter and pin the new version; or when a listed standard is superseded by a more widely-adopted neutral one.

**Trigger set on**: 2026-07-09 · **Watched via**: MCP / A2A / OTel GenAI / agent-identity release feeds (the veille watch-list).

## References

- MCP · A2A · AGENTS.md (Linux Foundation / Agentic AI Foundation); OpenTelemetry GenAI semantic conventions; OAuth 2.1 · SPIFFE · Entra Agent ID · IETF `agent_assertion`.
- [ADR-0009](ADR-0009-owasp-agentic-top-10-as-the-gate-risk-grammar.md) — the MCP version+hash pinning rule.
- `templates/mission/reference-stack.md`, `templates/mission/decision-matrix.md` — the surfaces this ADR touches.
