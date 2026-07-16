# Where to install runward — every channel, honestly tiered

runward's gate is deterministic, zero-LLM, and lives in your repository. You can install it from wherever you already work — but not every channel can carry the same *strength* of gate, and pretending otherwise would be the exact overclaim the gate exists to forbid. So here is the honest map (ADR-0028).

Three things a channel can do, and they don't coincide:

- **Enforce hard at merge** — a CI check that fails the build. Only one channel does this, and it's the strongest.
- **Enforce hard at turn end** — a client hook that blocks the agent until the gate passes.
- **Remind / orient** — surface the verdict, or tell the agent this repo is governed, without blocking.
- **Discovery only** — make runward findable, with no gate at all.

## The map

| Channel | Install | Gate tier | Notes |
|---|---|---|---|
| **GitHub Actions** | `uses: stranxik/runward@<sha>` as a required check | **Hard, at merge** | The load-bearing governance gate. Open, no secrets. `action.yml` at the repo root. |
| **npm** | `npx runward check --strict` (CI, pre-commit, or by hand) | **Hard, where you wire it** | The universal substrate. Runs in any harness with a shell. |
| **Claude Code** | `/plugin marketplace add stranxik/runward` → `/plugin install runward-gate` | **Client, turn end (advisory)** | `Stop` hook surfaces the verdict; the operator can make it block by removing `\|\| true`. |
| **Gemini CLI** | `gemini extensions install https://github.com/stranxik/runward-gemini` | **Client, turn end (advisory)** | Same one line at `AfterAgent`. Published from a thin dedicated repo because Gemini requires the manifest at the repo root. |
| **OpenAI Codex** | `codex plugin marketplace add https://github.com/stranxik/runward.git --sparse packaging/codex` | **Client, turn end (advisory)** | Same one line at `Stop`. `--sparse` because the repo root carries the *Claude* marketplace; the curated Codex directory is partners-only, the git-backed add is open. |
| **GitHub Copilot / VS Code** | copy `packaging/copilot/hooks/runward-gate.json` into `.github/hooks/` (per-repo) or `~/.copilot/hooks/` (per-user) | **Client, turn end (advisory)** | Drop-in, no submission. The hook format is `.claude/`-compatible (`Stop`/`agentStop`), so one shape serves Copilot CLI and VS Code Agent hooks. |
| **Cursor** | Cursor `hooks.json` (`.cursor-plugin` best-effort — Cursor publishes no plugin/marketplace schema) | **Client, advisory (`stop`)** | The shipped hook is an advisory `stop` (observational): it surfaces the verdict, it does not block. Cursor's blocking seam is per-tool (`beforeShellExecution`), deliberately not shipped. So: a reminder, not an end-of-turn gate. |
| **Kiro** | Import Power from GitHub → `https://github.com/stranxik/runward-kiro` | **Client, per-tool (soft)** | Published from a thin dedicated repo (Kiro requires `POWER.md` at the repo root). In the Kiro IDE, `Stop`/save hooks do **not** block; only `PreToolUse` does — a per-tool gate. The Kiro *CLI* has a blocking `stop`. |
| **MCP registries** | **not published — by design** | **Discovery only — never a gate** | An MCP tool is *model-controlled*: the agent may call it or skip it. The official registry also requires a real, published MCP server package — building one would contradict our own line (MCP is discovery, never enforcement). `packaging/mcp/server.json` documents that stance; we do not ship an MCP server. The gate is the Action and the client hooks, never MCP. |

## Why the tiering matters

The honest answer to "does the gate block?" is **yes in CI, yes at turn end where the harness allows it, no on a channel the model controls**. A tool that told you an MCP server "gates" your agent would be selling you a soft judge dressed as a hard one — and a hard guarantee can't be built out of a soft judge. That distinction is the whole point of runward; it applies to how runward distributes itself too.

## Supply chain: `npx --yes runward` pulls the latest published package

Every client hook and the Action's default run `npx --yes runward@latest`, so each invocation fetches and runs the newest published version. That keeps the gate current, and runward's own publishing is hardened (OIDC trusted publishing, SLSA provenance, SHA-pinned CI actions) — but `npx` does **not** verify that provenance on the consumer side. If you want reproducibility or a stronger supply-chain posture:

- **Pin the version** in your own copy of the hook or workflow: `npx --yes runward@0.18.1 check --strict` (bump deliberately).
- **In CI**, pin the Action by commit SHA (`uses: stranxik/runward@<sha>`) and pass `version: 0.18.1` rather than the `latest` default.

The packagings ship with `latest` for freshness; pinning is the operator's call, and it is the safer default for a regulated pipeline.

## The one invariant across all of them

**The operator installs.** runward auto-wires nothing: `/plugin install`, `uses:`, `gemini extensions install`, "Import Power" — every one is your gesture, in a repo you trust (ADR-0012). And every packaging is a thin shell around the same exit-code port: `runward check --strict`, 0 clean · 1 gaps · 2 no mission. No packaging is a runtime; none is privileged; the canonical vendor-neutral surface stays `AGENTS.md` + `.agents/skills/`.
