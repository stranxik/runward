# ADR-0028: Distributable packagings — the gate installable in one gesture, across every channel

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — a distribution-channel benchmark (which harnesses expose an open install channel AND can carry a deterministic gate), challenged against the vendor-neutral, never-a-runtime and operator-installs invariants, durable position

## Context

runward already ships the gate as a port with inert copy-in adapters (ADR-0012): the operator pastes a `github-actions.yml`, a `claude-code-settings.json` `Stop` hook, a `kiro-hooks.json` into their own repo. That gates *their* project. It does not make **runward itself installable in one gesture** from where developers already are — a marketplace, an `install` command, a required CI check.

A code-level channel benchmark (July 2026) found that the "install channel + deterministic gate" pattern is **not proprietary to Claude Code**: it is replicated, often with a Claude-`.claude/`-compatible hook format, across at least four harnesses, plus the canonical CI channel. Three honest tiers emerge, and conflating them would be exactly the kind of overclaim the gate exists to forbid:

- **CI gate (hard, at merge)** — GitHub Actions: `uses: <owner>/runward@<sha>` as a required status check blocks the merge on a non-zero exit. Open, auto-listed, the single highest-leverage channel and the one aligned 1:1 with "governance at the gate".
- **Client end-of-turn gate (hard, per turn)** — Claude Code, Gemini CLI, OpenAI Codex, and GitHub Copilot (CLI + VS Code Agent hooks) all expose an open plugin/extension channel whose `Stop`/`agentStop`/`AfterAgent` hook can block the turn until `runward check --strict` passes. Several read a Claude-compatible hook JSON, so one hook shape serves many.
- **Client per-tool gate (soft) + discovery-only** — Cursor and Kiro let a plugin/Power bundle a hook, but their end-of-turn/save hook does **not** hard-block (only per-tool-call does); and MCP registries distribute *discovery*, never enforcement, because MCP tools are model-controlled by specification (the agent chooses to call them). A runward MCP server would be found, never obeyed.

## Decision

Publish runward as a **family of distributable packagings** from the `stranxik/runward` repository, so the repo is at once an npm package, a GitHub Action, and a plugin marketplace — with each channel's gate strength stated honestly, and none privileged.

1. **GitHub Action** (`action.yml` at the repo root): a composite action running `npx runward check --strict`, referenced `uses: stranxik/runward@<sha>` and made a required status check. The hard CI gate. Listed on GitHub Actions Marketplace.
2. **A plugin marketplace** (`.claude-plugin/marketplace.json`) exposing a `runward-gate` plugin: the `Stop` hook running `runward check --strict` at end of turn, plus the `/rw-*` workflow commands and the phase skills. Installable with `/plugin marketplace add stranxik/runward` → `/plugin install runward-gate`.
3. **Sibling packagings for the other hard-Stop harnesses** (`packaging/`): Gemini CLI extension (`gemini-extension.json` + `hooks/hooks.json`, `AfterAgent` block), Codex plugin (`.codex-plugin/plugin.json`, `Stop` block), Copilot/VS Code Agent hooks (Claude-compatible JSON). Same one line: `runward check --strict` at end of turn.
4. **Soft-gate packagings, labelled soft**: Cursor plugin and a Kiro Power imported from GitHub, each bundling a `preToolUse`/`PreToolUse` shell hook — documented explicitly as *per-tool-call, not end-of-turn* so no operator is misled.
5. **A discovery-only MCP server descriptor** (`server.json`) for the official MCP registry — published for findability, documented as **not a gate** (model-controlled). It exposes read-only surfaces (`status`, `rules`), never the enforcement path.
6. **One honest map** (`docs/distribution.md`): every channel with its tier — CI-hard, client-hard, client-soft, discovery — so an operator picks with eyes open.

**Invariants preserved.** The **operator installs** — runward still auto-wires nothing (`/plugin install`, `uses:`, `gemini extensions install` are the operator's gesture; ADR-0012). **Never a runtime** — every packaging shells out to the same `runward check --strict` exit-code port; the MCP descriptor is read-only discovery, not a resident enforcement process. **Vendor-neutral** — this is a *family*, published together; Claude Code is one instance beside Gemini, Codex, Copilot, Cursor, Kiro and CI, none privileged in code or copy (the canonical surface stays `AGENTS.md` + `.agents/skills/`, ADR-0018).

## Alternatives discarded

- **A Claude Code plugin alone.** The benchmark's finding is precisely that the pattern is portable; shipping only Claude would pick a side and waste the CI channel (the strongest one). Rejected on vendor-neutrality and leverage.
- **runward-as-MCP-server as the gate.** Violates determinism: an MCP tool is model-controlled, so the model could skip it — the exact "soft judge" failure the gate rejects. MCP is admitted for discovery only, never as enforcement.
- **Auto-install / a daemon that registers the plugin.** Crosses ADR-0012's operator-installs line and never-a-runtime. The packagings are inert until the operator installs them.
- **Deep per-harness integrations** (a bespoke app per IDE). Couples runward to each vendor's internals and release cycle; the exit-code contract keeps every packaging a thin, swappable shell.

## Consequences

- **Positive.** runward becomes installable in one gesture from where developers already are, on every channel that can carry a real gate; the CI channel gives the hard governance gate at merge; the honest tiering ("hard here, soft there, discovery-only for MCP") is itself a credibility signal in a market that overclaims.
- **Negative, accepted.** A packaging surface to maintain against several vendors' evolving formats (Copilot/VS Code hooks are Preview; Gemini extension hook bundling is recent) — bounded, since each is a thin manifest around one command; a `doctor`/smoke check pins the shapes. Publishing to third-party marketplaces is an **outward-facing act reserved to the maintainer** (like the npm publish): runward prepares the packages; the maintainer submits.
- **On other boundaries.** The repo root gains `action.yml` and `.claude-plugin/marketplace.json`; `packaging/` and `docs/distribution.md` are born; `EXPECTED_*`/smoke cover the manifests' validity; the README's distribution section links the map. No change to the gate mechanics.

## Reevaluation trigger (mandatory, dated)

Reopen if a harness's hook format churns enough to break a shipped packaging (refresh or drop it, and say so in the map), if a channel starts privileging one agent in practice despite the neutral intent, or if MCP evolves a genuinely enforceable (non-model-controlled) surface — then reconsider MCP's discovery-only classification.

**Trigger set on**: 2026-07-16 · **Watched via**: each harness's hook/plugin schema across releases, and any signal of runward adoption arriving through a specific channel.

## References

- [ADR-0012](ADR-0012-the-gate-as-a-port-with-harness-adapters.md) — the gate-as-a-port and operator-installs posture this scales to publishable packagings.
- [ADR-0018](ADR-0018-native-skill-packagings-as-opt-in-application-adapters.md) — the vendor-neutral, no-privileged-agent invariant.
- [ADR-0027](ADR-0027-adapters-into-competing-orchestrators-as-complements.md) — the same posture toward a competing orchestrator's seam (BMAD).
- The July 2026 distribution-channel benchmark — the source classifying each channel's openness and gate strength.
