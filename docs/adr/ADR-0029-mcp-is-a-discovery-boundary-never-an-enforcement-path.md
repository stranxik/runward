# ADR-0029: MCP is a discovery boundary, never an enforcement path

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — grounded in the MCP specification and the MCP registry's own publishing rule, cross-read against the never-a-soft-gate and vendor-neutral invariants, challenged against the "everyone ships an MCP server" default, durable position

## Context

"Why doesn't runward ship an MCP server?" is the single most-asked structural question about runward's distribution, and ADR-0028 answers it only in passing (point 5 and a discarded alternative). It deserves its own citable anchor, because the answer is load-bearing for the whole positioning.

Two facts are in direct tension:

- **runward's gate is a deterministic, must-run authority.** Its value is that it returns a verdict the agent cannot route around.
- **MCP tools are model-controlled by specification.** The MCP tools spec (2025-06-18, "User Interaction Model") states verbatim that "tools in MCP are designed to be **model-controlled**, meaning that the language model can discover and invoke tools automatically." Every safety mechanism the protocol adds — human-in-the-loop approval, elicitation, sampling — is *subtractive*: a veto that can deny or pause a call. Nothing in the protocol can *compel* a call. The trust model even instructs clients to treat tool annotations as untrusted unless the server is trusted.

A check placed behind an MCP tool is therefore a check the agent is free to skip — a soft judge in a hard judge's robe, the exact failure runward exists to remove.

A second fact settles the narrower "then at least publish the discovery descriptor" question: the MCP registry hosts *metadata, not artifacts*, so publishing requires a real, runnable npm package whose `package.json` carries an `mcpName` matching the descriptor's `name`. runward's descriptor has `"packages": []` — nothing runnable. Publishing would mean building an executable server whose only honest job is read-only discovery.

## Decision

**runward's gate is never exposed as an MCP tool, and no runward MCP server is published.**

- **Enforcement lives only where the model gets no vote**: the end-of-turn client lifecycle hook (`runward check --strict`, blocking where the harness allows) and the required CI status check (the GitHub Action at merge). Both are gates the agent *runs into*, not tools it *chooses to call*.
- **A runward MCP surface, if ever built, is read-only discovery only** — `status`, `rules --json` — so an agent can learn the rules and read the current verdict mid-session. It never mutates state, seals evidence, or returns a binding block.
- **The `packaging/mcp/server.json` descriptor stays an inert sketch** (`"packages": []`), documenting this boundary; it is not published, because publishing would require an executable server for a role we have just argued must never gate.

State the claim precisely: *a published MCP server, as specified, is skippable, so it cannot be **the** gate.* Not "MCP can never enforce anything anywhere" — an out-of-band MCP **gateway** (a deterministic interceptor between model and servers) does enforce, precisely because it sits *outside* the model-controlled call. That is the same architecture as runward's CI check and end-of-turn hook, at a different layer, and it confirms rather than weakens the thesis: enforcement belongs to a layer independent of the LLM, never to a tool the LLM decides whether to invoke.

## Alternatives discarded

- **runward-as-MCP-gate** (expose `check --strict` as an MCP tool). The model can skip it; it stops being a gate. This is the founding failure mode restated one layer out.
- **Publish the discovery descriptor now.** The registry requires a runnable server; building one whose only honest role is discovery is effort spent to ship a thing we've argued must not gate. Non-publication is the coherent choice, not the lazy one.
- **Rely on a client that wires a tool to always run.** The spec permits non-standard interaction models, but that is a per-client quirk, non-portable across the ecosystem, and it *is* the lifecycle hook — which is exactly the seam runward already uses. Do not lean on a quirk you can't rely on.

## Consequences

- **Positive.** One citable answer to the most-asked question; the honest tiering (discovery over MCP, enforcement over hook and CI) is itself a credibility signal in a market being told, by its own auditors, that evidence must be deterministic, attributable and enforced. The wider agent-security field has converged on the same split (MCP for context; a deterministic layer independent of the LLM for enforcement).
- **Negative, accepted.** runward forgoes the discovery reach of a registry listing until a read-only surface is worth building; some readers expect an MCP server by default and must be told, once, why there isn't one. Both are cheap relative to the consistency they buy.
- **On other boundaries.** None mechanical — this ADR promotes an existing ADR-0028 sub-decision to a first-class, linkable one. `packaging/mcp/README.md` and `docs/distribution.md` cite it; no code changes.

## Reevaluation trigger (mandatory, dated)

Reopen if MCP evolves a genuinely non-model-controlled, enforceable surface (a server the client is required to consult, not one the model elects to call) — then reconsider whether a runward MCP enforcement path is possible without the soft-judge failure. Kept in sync with ADR-0028's own MCP trigger.

**Trigger set on**: 2026-07-16 · **Watched via**: the MCP specification's interaction model across versions, and the registry's publishing requirements.

## References

- [ADR-0028](ADR-0028-distributable-packagings-across-harness-channels.md) — the distribution family this focuses; the MCP-discovery-only sub-decision this promotes.
- [ADR-0018](ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md), [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the vendor-neutral and operator-installs invariants preserved.
- MCP tools specification (2025-06-18), "User Interaction Model" — the model-controlled property this rests on.
- MCP registry publishing quickstart — the runnable-package requirement behind non-publication.
