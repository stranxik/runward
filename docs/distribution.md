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
| **GitLab CI/CD** | `include: remote:` the release asset `runward-gitlab-gate-X.Y.Z.yml` with `integrity:` (GitLab 17.9+), or a copy `include: project:`d on your instance; then *Pipelines must succeed* | **Hard, at merge** (on Free, only while the job stays in the pipeline: see [`gitlab.md`](gitlab.md)) | The same job as the Action, reports as artifacts. `templates/ci/gitlab/runward-gate.yml`; a sample in every mission's `runward/adapters/gitlab-ci.yml`. |
| **Azure Pipelines, Bitbucket Pipelines** | merge `runward/adapters/azure-pipelines.yml` or `bitbucket-pipelines.yml` | **Hard, where you require it** | Minimal samples: the pinned gate and its reports; no summary poster yet. |
| **npm** | `npx --yes runward@0.45.0 check --strict` (CI, pre-commit, or by hand) | **Hard, where you wire it** | The universal substrate. Runs in any harness with a shell. |
| **Claude Code** | `/plugin marketplace add stranxik/runward` → `/plugin install runward-gate` | **Client, turn end (advisory)** | `Stop` hook runs the gate; its plain output goes to Claude Code's debug log, not to the model. Removing `\|\| true` does not make it block (exit 1 is a non-blocking error): `runward wire --install` arms it. |
| **Gemini CLI** | `gemini extensions install https://github.com/stranxik/runward-gemini` | **Client, turn end (advisory)** | Same one line at `AfterAgent`. Published from a thin dedicated repo because Gemini requires the manifest at the repo root. |
| **OpenAI Codex** | `codex plugin marketplace add https://github.com/stranxik/runward.git --sparse packaging/codex` | **Client, turn end (advisory)** | Same one line at `Stop`. `--sparse` because the repo root carries the *Claude* marketplace; the curated Codex directory is partners-only, the git-backed add is open. |
| **GitHub Copilot / VS Code** | copy `packaging/copilot/hooks/runward-gate.json` into `.github/hooks/` (per-repo) or `~/.copilot/hooks/` (per-user) | **Client, turn end (advisory)** | Drop-in, no submission. The hook format is `.claude/`-compatible (`Stop`/`agentStop`), so one shape serves Copilot CLI and VS Code Agent hooks. |
| **Cursor** | Cursor `hooks.json` (`.cursor-plugin` best-effort — Cursor publishes no plugin/marketplace schema) | **Client, advisory (`stop`)** | The shipped hook is an advisory `stop` (observational): it runs the gate and prints plain text, which Cursor passes on only as `followup_message` JSON, so the verdict does not reach the agent; it does not block. Cursor's blocking seam is per-tool (`beforeShellExecution`), deliberately not shipped. So: a reminder, not an end-of-turn gate. |
| **Kiro** | Import Power from GitHub → `https://github.com/stranxik/runward-kiro` | **Client, per-tool (soft)** | Published from a thin dedicated repo (Kiro requires `POWER.md` at the repo root). Per Kiro's docs (checked 2026-09-28), `Stop` and save hooks do **not** block, in the IDE or the CLI; `PreToolUse` does. The packaged hook is `PreToolUse` ending in `2>&1 \|\| true`: the verdict reaches the agent's context, nothing blocks. The armed `Stop` decision-block was measured on the Kiro CLI on 2026-09-02 and is not documented by Kiro: not verified. |
| **MCP registries** | **not published — by design** | **Discovery only — never a gate** | An MCP tool is *model-controlled*: the agent may call it or skip it. The official registry also requires a real, published MCP server package — building one would contradict our own line (MCP is discovery, never enforcement). `packaging/mcp/server.json` documents that stance; we do not ship an MCP server. The gate is the Action and the client hooks, never MCP (ADR-0029). |

## Why the tiering matters

The honest answer to "does the gate block?" is **yes in CI, yes at turn end where the harness allows it, no on a channel the model controls**. A tool that told you an MCP server "gates" your agent would be selling you a soft judge dressed as a hard one — and a hard guarantee can't be built out of a soft judge. That distinction is the whole point of runward; it applies to how runward distributes itself too.

## Supply chain: which runward a hook runs

The Action's default runs `npx --yes runward@latest`, so each invocation fetches and runs the newest published version, and says so on every run. Every other surface runward ships is pinned (TOR-243). The client hooks in the packagings run `npx --yes runward@<the packaging's version>`. The gate adapters `runward init` writes into `runward/adapters/` are stamped with the version that wrote them, and `runward wire --install` writes the version that wired. Through 0.44.0 the hooks and the adapters ran `npx --yes runward` with no version (the pre-commit sample even preferred a bare global `runward`), and on a machine with a global install that ran the global copy, whatever its version, without saying so (measured with npm 11.16: a global 0.28.0 answered a bare `npx --yes runward`, a pinned `npx --yes runward@<version>` answered that version, measured at 0.43.1). That mattered: the same tree exits 0 under 0.31.0 and 1 under 0.44.0. A pinned `npx` still uses a project install of exactly that version first (measured with npm 11.16 on 0.44.0, offline and with an empty cache), and fetches it otherwise. runward's own publishing is hardened (OIDC trusted publishing, SLSA provenance, SHA-pinned CI actions), but `npx` does **not** verify that provenance on the consumer side. If you want reproducibility or a stronger supply-chain posture:

- **Pin the version** in your own copy of the hook or workflow: `npx --yes runward@0.45.0 check --strict` (bump deliberately).
- **In CI**, pin the Action by commit SHA (`uses: stranxik/runward@<sha>`) and pass `version: <the version you qualified>` rather than the `latest` default.

The Action ships with `latest` for freshness; pinning it is the operator's call, and it is the safer default for a regulated pipeline. Pin the **maintained minor** (SECURITY.md's supported-versions table names it, with dates): that buys six months of security fixes without requalification — the two-line policy ADR-0068 ratified on 2026-09-09, which made pinning and patching compatible. Since 2026-10-01 (ADR-0086) that holds for a fix that applies to the older line without rework; when it does not, the fix ships on the maintained line only and its advisory says so, so watch the advisories as well as the table.

## The one invariant across all of them

**The operator installs.** runward auto-wires nothing: `/plugin install`, `uses:`, `gemini extensions install`, "Import Power" — every one is your gesture, in a repo you trust (ADR-0012). And every packaging is a thin shell around the same exit-code port: `runward check --strict`, 0 clean · 1 gaps · 2 no mission, a usage error or a refused gesture: the question could not be asked, never a red gate. No packaging is a runtime; none is privileged; the canonical vendor-neutral surface stays `AGENTS.md` + `.agents/skills/`.
