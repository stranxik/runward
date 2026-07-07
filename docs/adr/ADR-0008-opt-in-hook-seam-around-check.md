# ADR-0008: An opt-in hook seam around check

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor benchmark (Spec Kit `.specify/extensions.yml`), challenge, durable position

## Context

The competitor benchmark surfaced a clean extensibility pattern (P8): Spec Kit exposes `before_`/`after_` hooks so third-party gates plug in without forking the core. runward's deterministic conformance gate is fixed and neutral, but an operator legitimately needs to run **their own** checks around it — a test-baseline validation (the residual of ADR-0005/P4), a security scan, a house linter. Forcing them to fork runward or wrap it in ad-hoc CI glue is friction.

The catch is security. runward's doctrine is least-privilege and untrusted-input-aware. Executing arbitrary shell from a file in a repository is a real surface: a cloned or malicious repo carrying a hooks file could run commands the moment someone types `runward check`. Any seam must not create surprise command execution.

## Decision

An **opt-in** hook seam. `runward check --hooks` reads `runward/hooks.json` (`{ "before": [...], "after": [...] }`, arrays of shell commands) and runs the operator's commands around the audit: `before` first, then the deterministic audit, then `after`. A non-zero hook fails the gate — the operator wired it, so it gates for them.

- **Never by default.** Plain `runward check` never runs hooks. Hooks execute only under the explicit `--hooks` flag, so cloning a repo and running `check` cannot execute anything.
- **The operator's extension, not runward's.** runward's own conformance check stays deterministic and zero-LLM (ADR-0001); the hooks are the operator's commands, run with their explicit consent — the ecosystem model of npm scripts, git hooks, and Makefiles.
- **Where the P4 residual lives.** An operator who wants baseline test validation, or any language-specific proof runward will not run itself, plugs their own runner here. runward still runs nothing of its own.

## Alternatives discarded

- **Run hooks whenever `hooks.json` is present.** A surprise-command-execution foot-gun on any clone; rejected on security grounds.
- **No seam at all.** Forces forking or external wrapping for a need that is common and legitimate.
- **A hook DSL or an LLM-driven hook.** Overkill; a list of shell commands is the neutral, universal interface, and keeps runward out of the business of interpreting them.

## Consequences

- **Positive.** The gate is extensible without forking; the P4 residual has a home; runward stays neutral and zero-run for its own part.
- **Negative, accepted.** `--hooks` runs shell commands — documented as such, with the same trust posture as npm scripts or git hooks. The operator enables it only in repos they trust.
- **On other boundaries.** A new `runward/hooks.json` convention and a `--hooks` flag on `check`; the deterministic audit and its zero-LLM invariant are untouched; hooks influence the exit code only when explicitly enabled.

## Reevaluation trigger (mandatory, dated)

Reopen if the shell-command surface proves risky in practice — then restrict hooks to an allowlist, a signed-hooks scheme, or a restricted command vocabulary, rather than free shell.

**Trigger set on**: 2026-07-07 · **Watched via**: security review of the hook seam and any reported misuse.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate the seam wraps, never alters.
- [ADR-0005](ADR-0005-baseline-worktree-test-validation-out-of-scope.md) — the P4 residual this seam hosts.
- Spec Kit `.specify/extensions.yml` — the before/after hook reference.
- `src/lib/hooks.ts`, `src/commands/check.ts` — the surfaces this ADR touches.
