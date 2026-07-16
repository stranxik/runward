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

Merge the `hooks` block into your `.claude/settings.json` (or `.claude/settings.local.json`). The `Stop` hook runs the gate when the agent finishes a turn and surfaces the verdict in the loop — so an agent can no longer close out with the gate never run.

This is **one example** of a per-harness turn-end hook, not a privileged one — Claude Code just happens to expose a clean, documented seam. Any agent harness that can run a command at turn-end (Codex, and others as they add the capability) wires the *same* one line: `runward check --strict`. And where a harness offers no such seam, the `pre-commit` and CI adapters above already gate the code **whatever agent produced it** — the port is the exit code, not the agent.

---

Adapters are runward-owned templates: `runward update` refreshes them, `runward doctor` verifies them. They are never mission state. Add a new harness by dropping a new sample here — the port contract above does not change.
