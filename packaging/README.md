# Distribution packagings

runward ships one gate — a deterministic, zero-LLM check whose whole contract is an
exit code (`0` clean, `1` gaps, `2` no mission). These packagings hand that same gate
to each agent harness in **its own native format**, so the harness reads the verdict at
the moment that matters. They do not change the gate; they only route it.

Every channel runs the **same one line**: `runward check --strict`.

This folder holds the **non-Claude** harness packagings. The Claude Code plugin lives at the repo root (`.claude-plugin/marketplace.json` + `plugins/runward-gate/`), and the GitHub Action is `action.yml`. The full, honestly-tiered map of every channel — including Claude Code, the Action and npm — is [`docs/distribution.md`](../docs/distribution.md).

## Invariants (ADR-0028)

- **The operator installs.** Each file here is an inert sample. runward never wires a
  harness, never writes to `.git/`, never runs on clone or on `check`. You copy it into a
  repo you trust.
- **Never a runtime.** These are configuration descriptors, not a service runward runs.
- **Vendor-neutral.** No agent is privileged. Every harness gets the identical command;
  none is presented as the blessed one.
- **The hard gate is CI.** The session/turn-end hooks below are **advisory** — they
  surface the verdict inside the agent loop. The only *blocking* gate that no code can
  bypass is the CI check (the GitHub Action / `runward check --strict` in a pipeline).
- **MCP is discovery only.** A model-controlled surface is never an enforcement path.

## Honest gate tier per channel

| Channel | Format | Native seam used | Gate tier (honest) | Blocks? |
|---------|--------|------------------|--------------------|---------|
| CI (Action / pipeline) | `action.yml`, adapters | required status check | **hard — CI** | yes, un-bypassable |
| [`gemini/`](./gemini) | Gemini CLI extension | `AfterAgent` (end of turn) | advisory end-of-turn | no (`\|\| true`) |
| [`codex/`](./codex) | Codex plugin | `Stop` (end of turn) | advisory end-of-turn | no (`\|\| true`) |
| [`copilot/`](./copilot) | Copilot CLI / VS Code hooks | `Stop` (end of turn) | advisory end-of-turn | no (`\|\| true`) |
| [`cursor/`](./cursor) | Cursor plugin + hooks | `stop` (observational) | **soft — per-tool only** | no; `stop` cannot block |
| [`kiro/`](./kiro) | Kiro Power + hook | `PreToolUse` | **soft — per-tool** | per tool call, not end-of-turn |
| [`mcp/`](./mcp) | MCP registry descriptor | read-only surfaces | **discovery only** | never a gate |

The end-of-turn hooks (Gemini, Codex, Copilot) *could* block on some harnesses, but we
keep them advisory on purpose, exactly like the Claude Code plugin: the agent loop sees
the verdict, and the enforcing gate stays in CI. Cursor's `stop` and Kiro's save/Stop
events **cannot** block by design — there the only blocking seam is per-tool
(`beforeShellExecution` / `PreToolUse`), which is a soft, noisier gate, documented as such
in each folder.

## The one command

- `runward check` — the deliverable audit (exit `0`/`1`/`2`).
- `runward check --strict` — also enforces the floor rule-conformance manifest. This is
  the line every packaging carries.
