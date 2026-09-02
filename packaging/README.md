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

The old table's single "Blocks?" column confused **what the harness can do** with **what the
shipped file chooses to do** — measured 2026-09-02: over 1,668 recorded agent turns on this very
repository, the shipped consultative tier never once put a red verdict in front of the model,
because every sample ends in `|| true`. That is a *choice*, and it stays the shipped default; the
column now says both truths.

| Channel | Format | Native seam used | Shipped tier | Can the harness block? (measured 2026-09-02) |
|---------|--------|------------------|--------------|----------------------------------------------|
| CI (Action / pipeline) | `action.yml`, adapters | required status check | **hard — CI** | yes, un-bypassable |
| [`gemini/`](./gemini) | Gemini CLI extension | `AfterAgent` (end of turn) | advisory (`\|\| true`) | **yes** — `{"decision":"deny","reason"}` rejects the reply and forces a correction turn; exit 2 blocks with stderr as the reason; native `stop_hook_active` loop guard |
| [`codex/`](./codex) | Codex plugin | `Stop` (end of turn) | advisory (`\|\| true`) | **yes** — hooks shipped in v0.114 (2026-03), blocking `Stop` |
| [`copilot/`](./copilot) | Copilot CLI / cloud agent hooks | `Stop` (end of turn) | advisory (`\|\| true`) | **yes** — `{"decision":"block","reason"}` "forces another agent turn"; native ceiling of 8 consecutive blocks. (The current reference names two execution surfaces, CLI and cloud agent — not VS Code, which this table once claimed.) |
| [`cursor/`](./cursor) | Cursor plugin + hooks | `stop` (observational) | advisory | **retry tier only** — `stop` cannot deny, but `{"followup_message"}` auto-submits the verdict as the next user message (`loop_count` guard). The blocking seams are per-tool (`beforeShellExecution`…). The shipped hook uses neither; the armed variant uses the retry tier and says so. |
| [`kiro/`](./kiro) | Kiro Power + hook | `PreToolUse` | advisory per-tool | **yes, in the CLI** — the `Stop` hook accepts `{"decision":"block","reason"}` and the reason becomes the next user message; the IDE's documented blocking stays per-tool |
| [`mcp/`](./mcp) | MCP registry descriptor | read-only surfaces | **discovery only** | never a gate |

Measured but not packaged here: **Junie CLI** now ships hooks (`Stop` blocks by exit 2 or
`{"decision":"block"}`); **Windsurf** ships Cascade Hooks (per-tool blocking by exit 2 — end of
turn is observational and cannot block); **Trae** has no lifecycle hooks (feature request open);
**Continue is a discontinued harness** (acquired by Cursor, June 2026; repository read-only) — the
`init --tools continue` profile warns accordingly.

In total, six of the nine measured harness families can put a red verdict back into the model's
context at end of turn (Claude Code, Copilot, Gemini CLI, Kiro CLI, Junie CLI, Codex). The shipped
samples stay advisory on purpose: the agent loop sees the verdict and the enforcing gate stays in
CI. **The armed tier is one explicit gesture away**: `runward wire --install` (TTY-only,
operator-only) wires `runward gate-hook --harness <id>`, which speaks each harness's native
refusal, blocks once, and traces every release to a committed `runward/gate-bypass.log`. The
armed samples ship beside the consultative ones in `runward/adapters/*.armed.json`.

## The one command

- `runward check` — the deliverable audit (exit `0`/`1`/`2`).
- `runward check --strict` — also enforces the floor rule-conformance manifest. This is
  the line every packaging carries.
