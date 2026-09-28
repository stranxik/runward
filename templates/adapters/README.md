# Gate adapters

The runward gate is a **port**. Its whole contract is an exit code:

| Exit | Meaning |
|------|---------|
| `0`  | current gate clean — every expected deliverable is filled (and, under `--strict`, every CRITICAL/HIGH rule mapped to a build phase is accounted for) |
| `1`  | gaps — a deliverable is not filled, a `--strict` rule-conformance gap remains, or an enabled hook failed |
| `2`  | no `runward/` mission found here or above |

A human reads that verdict by typing `runward check`. These adapters let a **harness** read the same verdict at the moment it matters — a commit, a CI run, an agent finishing a turn — without runward running, watching, or installing anything.

> **runward never wires these for you.** Each file below is an inert sample. Nothing here executes on `init`, on clone, or on `check`. You copy it into your harness, in a repo you trust. This is the same opt-in posture as the `--hooks` seam (ADR-0008), one step stronger: runward does not even run these — it hands them over.

The command inside every adapter is runward's own deterministic, zero-LLM gate — not arbitrary shell. Choose `runward check` for the deliverable audit, or `runward check --strict` to also enforce the floor rule-conformance manifest.

## Two tiers, said plainly

Every `*.json` sample here is the **consultative** tier: the agent loop sees the verdict, nothing
blocks, the hard gate stays in CI. The `*.armed.json` variants beside them are the **armed** tier:
the same red gate becomes the harness's own refusal (`runward gate-hook --harness <id>`), blocks
exactly once per stop (native re-entry guards honoured), and traces every release to a committed
`runward/gate-bypass.log` — a bypass lives in a diff, never in silence. Do not wire an armed
variant by hand: `runward wire --install` is the gesture (TTY-only, refused under any agent
runtime signal, file shown before writing, journaled in `runward/adapters/installed.log`), and
`runward wire --uninstall` is its symmetric undo.

---

## `pre-commit` — block a commit on an open gate

Copy it into your repo's git hooks and make it executable:

```sh
cp runward/adapters/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or keep hooks in-tree and point git at them:

```sh
mkdir -p .githooks && cp runward/adapters/pre-commit .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

A non-zero exit aborts the commit. Bypass a single commit with `git commit --no-verify` when you have a reason.

## `github-actions.yml` — the gate as a required check

Copy the job into a workflow under `.github/workflows/` (or merge it into an existing one). Make it a required status check on your protected branch so no gap merges. This is the audit-evidence seam for a regulated pipeline: a dated, versioned record that the gate passed on every merge.

## `gitlab-ci.yml` — the same required check, GitLab flavor

Merge the job into your `.gitlab-ci.yml` and require the pipeline on your protected branch (Settings → Merge requests). Same port, same one line — the gate does not care which forge reads its exit code.

## `claude-code-settings.json` — run the gate at the agent's turn-end (one example)

Merge the `hooks` block into your `.claude/settings.json` (or `.claude/settings.local.json`). The `Stop` hook runs the gate when the agent finishes a turn, so the gate is never left unrun. It does **not** put the verdict in front of the model: Claude Code writes a `Stop` hook's plain stdout to its debug log (hooks reference, checked 2026-09-28), so the agent still has to run `runward check --strict` itself. The armed variant beside it (`claude-code-settings.armed.json`, wired by `runward wire --install`) is the one that returns a red gate to the model as a refusal.

This is **one example** of a per-harness turn-end hook, not a privileged one — Claude Code just happens to expose a clean, documented seam. Any agent harness that can run a command at turn-end (Codex, and others as they add the capability) wires the *same* one line: `runward check --strict`. And where a harness offers no such seam, the `pre-commit` and CI adapters above already gate the code **whatever agent produced it** — the port is the exit code, not the agent.

## `kiro-hooks.json` — the same turn-end gate, Kiro flavor

Copy the file into `.kiro/hooks/` in your workspace. The `Stop` trigger runs `runward check --strict` when the agent finishes. It is **not** a gate: Kiro's docs (checked 2026-09-28) say a `Stop` / Agent Stop hook cannot block, in the IDE or the CLI. What the agent receives depends on the exit code: at exit 0 Kiro adds the hook's stdout to its context; on a red gate (exit 1) Kiro sends the hook's stderr, which is empty because runward writes its verdict on stdout, so the agent learns that the hook failed and not why. The packaged Kiro Power (`packaging/kiro/`) uses a per-tool `PreToolUse` hook ending in `2>&1 || true` instead. The armed variant (`kiro-hooks.armed.json`) relies on a `Stop` decision-block measured on the Kiro CLI on 2026-09-02 that Kiro's current docs do not document: not verified. Kiro also reads `AGENTS.md` natively, and `runward init --tools kiro` mirrors the phase skills as steering files (`.kiro/steering/`, relevance-loaded) — the traced decisions inform the session; the gate stays the only authority.

## `bmad-review-layer.toml` — the gate as a review layer BMAD calls

Copy the `[[workflow.review_layers]]` block into the customize.toml of BMAD's `bmad-code-review` skill. It adds runward's deterministic gate as one review layer beside BMAD's adversarial LLM reviewers (their extension point explicitly allows "an external reviewer via bash"): they judge the code's craft, runward verifies the traced decisions and their evidence. A complement running on BMAD's flow, not a competitor to it — same inert posture, same exit-code port (ADR-0027).

---

Adapters are runward-owned templates: `runward update` refreshes them, `runward doctor` verifies them. They are never mission state. Add a new harness by dropping a new sample here — the port contract above does not change.
