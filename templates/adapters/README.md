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

**Every adapter runs the runward version that wrote it.** `runward init` and `runward update` stamp their own version into each file here (`npx --yes runward@X.Y.Z …`, or `RUNWARD_VERSION` in the forge samples), so a hook does not run whatever binary the machine happens to have: two runward versions can give the same tree two verdicts. A pinned `npx` uses a project install of exactly that version when there is one, and fetches it once otherwise; the pre-commit hook checks `node_modules/.bin/runward --version` itself first. To move to a newer runward, run `runward update` with it: an adapter you never edited is refreshed to the new version (`updated … (changed upstream)`), one you edited is kept and named. A copy you already installed elsewhere (`.git/hooks/pre-commit`, a workflow) is yours and is not touched: copy it again.

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

The hook is POSIX `sh`. On Windows, Git for Windows runs hooks with its bundled `sh`, so the same file works there; `npx` must be on the `PATH` that Git's shell sees (the Node.js installer puts it there). The local-install branch reads `node_modules/.bin/runward`, the `sh` shim npm writes beside the `.cmd` one. This Windows path is reasoned from how Git for Windows and npm behave, not measured on a Windows runner; if the local branch does not apply, the hook falls back to the pinned `npx`, never to a global.

## `github-actions.yml` — the gate as a required check

Copy the job into a workflow under `.github/workflows/` (or merge it into an existing one). Make it a required status check on your protected branch so no gap merges. This is the audit-evidence seam for a regulated pipeline: a dated, versioned record that the gate passed on every merge.

## `gitlab-ci.yml` — the same required check, GitLab flavor

At parity with the GitHub Action: a pinned version (and the Action's warning when it is not), `check --strict`, the reports deposited as artifacts on a red gate too, and `verify` on the attestation the job just emitted. The same run writes a Code Quality report and a JUnit XML, declared as `reports: codequality` and `reports: junit`, so the merge request shows the gate's causes on every tier without a token. SARIF is not declared as `reports: sarif`: GitLab files it in the vulnerability report, and a runward gap is never a vulnerability (ADR-0096). Merge the job into your `.gitlab-ci.yml`, or, on GitLab 17.9 or later, `include:` the release asset `runward-gitlab-gate-X.Y.Z.yml` pinned by `integrity:`. Then require the pipeline on your protected branch (Settings → Merge requests → Pipelines must succeed). What each GitLab tier enforces, and what Free cannot (a merge request can edit the `.gitlab-ci.yml` that holds the job; approvals do not block a merge), is `docs/gitlab.md` in the runward repository.

## `azure-pipelines.yml` and `bitbucket-pipelines.yml` — minimal samples

The pinned `check --strict`, its `--json` and the HTML report as artifacts. Make the Azure job a Build validation policy, the Bitbucket step a required build in the branch restrictions. Their summary posters come later, under the same port (ADR-0094).

## `claude-code-settings.json` — run the gate at the agent's turn-end (one example)

Merge the `hooks` block into your `.claude/settings.json` (or `.claude/settings.local.json`). The `Stop` hook runs the gate when the agent finishes a turn, so the gate is never left unrun. It does **not** put the verdict in front of the model: Claude Code writes a `Stop` hook's plain stdout to its debug log (hooks reference, checked 2026-09-28), so the agent still has to run `runward check --strict` itself. The armed variant beside it (`claude-code-settings.armed.json`, wired by `runward wire --install`) is the one that returns a red gate to the model as a refusal.

This is **one example** of a per-harness turn-end hook, not a privileged one — Claude Code just happens to expose a clean, documented seam. Any agent harness that can run a command at turn-end (Codex, and others as they add the capability) wires the *same* one line: `runward check --strict`. And where a harness offers no such seam, the `pre-commit` and CI adapters above already gate the code **whatever agent produced it** — the port is the exit code, not the agent.

## `kiro-hooks.json` — the same turn-end gate, Kiro flavor

Copy the file into `.kiro/hooks/` in your workspace. The `Stop` trigger runs `runward check --strict` when the agent finishes. It is **not** a gate: Kiro's docs (checked 2026-09-28) say a `Stop` / Agent Stop hook cannot block, in the IDE or the CLI. What the agent receives depends on the exit code: at exit 0 Kiro adds the hook's stdout to its context; on a red gate (exit 1) Kiro sends the hook's stderr, which is empty because runward writes its verdict on stdout, so the agent learns that the hook failed and not why. The packaged Kiro Power (`packaging/kiro/`) uses a per-tool `PreToolUse` hook ending in `2>&1 || true` instead. The armed variant (`kiro-hooks.armed.json`) relies on a `Stop` decision-block measured on the Kiro CLI on 2026-09-02 that Kiro's current docs do not document: not verified. Kiro also reads `AGENTS.md` natively, and `runward init --tools kiro` mirrors the phase skills as steering files (`.kiro/steering/`, relevance-loaded) — the traced decisions inform the session; the gate stays the only authority.

## `bmad-review-layer.toml` — the gate as a review layer BMAD calls

Copy the `[[workflow.review_layers]]` block into the customize.toml of BMAD's `bmad-code-review` skill. It adds runward's deterministic gate as one review layer beside BMAD's adversarial LLM reviewers (their extension point explicitly allows "an external reviewer via bash"): they judge the code's craft, runward verifies the traced decisions and their evidence. A complement running on BMAD's flow, not a competitor to it — same inert posture, same exit-code port (ADR-0027).

---

Adapters are runward-owned templates: `runward update` refreshes them, `runward doctor` verifies them. They are never mission state. Add a new harness by dropping a new sample here — the port contract above does not change.
