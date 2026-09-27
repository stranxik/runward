# ADR-0003 — Operator hooks run unsandboxed, in a tree an agent can write

**Date**: 2026-09-27
**Status**: accepted — decision taken by the maintainer on 2026-09-27 on the ratification dossier's recommendation; text drafted by the coding agent, accepted by the maintainer's review and merge
**Deciders**: the maintainer
**Method**: ratification preparation of 2026-09-27

## Context

The rule `security-code-execution-sandbox` asks that code from a model or a tool never run in process,
and that no path lead from untrusted content to execution. Under the opt-in `check --hooks`, runward
runs the commands of `runward/hooks.json` with `execSync`, unsandboxed, with the parent's environment
and no timeout (`src/lib/hooks.ts`). That file lives in the tree a coding agent edits, and runward
cannot tell who wrote it. The row said `n/a` ("runward executes no model-produced code, ever"); the code
does not guarantee that. Product ADR-0008 saw the risk and accepted it on the npm-scripts trust model.

## Decision

The row is `deviated`, on product ADR-0008's reasoning: hooks run only under the explicit `--hooks`
flag, never under plain `check` nor in the shipped actions and adapters, and the operator enables them
only in repositories whose `hooks.json` they review like any build script.

## Alternatives discarded

- **Keep `n/a`.** The rule applies: a file an agent can write reaches execution.
- **Sandbox the hooks.** A product change no ADR has weighed yet; ADR-0008's trigger (an allowlist,
  signed hooks, a restricted vocabulary) is the nearest reopening.

## Consequences

- **Positive**: the gap is visible in the manifest and in the threat model instead of classed away.
- **Negative, accepted**: an operator or CI passing `--hooks` on an unreviewed `hooks.json` runs what
  an agent wrote.

## Reevaluation trigger (mandatory, dated)

Reopen when product ADR-0008 reopens (an allowlist or signed hooks), or if a shipped action or adapter
ever passes `--hooks`.

**Trigger set on**: 2026-09-27 · **Watched via**: changes to `src/lib/hooks.ts`, `action.yml` and the adapters.

## References

- Product ADR-0008 (`docs/adr/ADR-0008-opt-in-hook-seam-around-check.md`), ADR-0054 (the crossings).
