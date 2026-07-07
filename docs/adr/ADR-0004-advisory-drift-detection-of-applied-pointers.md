# ADR-0004: Advisory drift detection — applied pointers that no longer resolve

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor code benchmark (Spec Kit `/converge`), challenge, durable position

## Context

The conformance manifest (ADR-0001) is a **snapshot**: it records, at the moment it is filled, that a rule is `applied` with an evidence pointer such as `src/guard.ts:22`. But code evolves. The file can move, shrink, or be deleted while the manifest still reads green — a stale pointer that no snapshot can catch. The competitor benchmark showed Spec Kit's `/converge`: a continuous, append-only, non-destructive detector of drift between the code and the spec. The insight transfers directly: turn the snapshot into a drift-aware check.

The decision is at the tooling boundary (the `check` command), deterministic, zero-LLM. It must not introduce false positives that would erode trust in the gate, and it must respect the operator-owns-the-gate line: drift is surfaced, the operator decides.

## Decision

`check --strict` runs a deterministic, **advisory** drift pass. For each `applied` row, it extracts file-path tokens from the evidence — a path bearing a file extension, with an optional `:line` suffix — and, if the evidence carries at least one such token but none resolves under the project root, the mission directory, or the manifest's own directory, it reports the row as **drift**.

- **Advisory, not blocking.** Drift is shown; it does not fail the exit code. This matches `/converge`'s non-blocking posture and keeps the gate false-positive-safe. The operator reads the drift and acts.
- **Prose is skipped.** A section reference (`architecture §2`), an ADR id (`ADR-0002`), or a bare directory carries no file-extension token and is not checked — those are the operator's judgment.
- **Existence only.** The gate never opens the file, never reads the line, never runs a test — it checks that the evidence points at something that still exists. Deterministic; no LLM.

## Alternatives discarded

- **Make drift blocking now.** Evidence-path conventions vary across operators and are not yet proven; a hard failure would risk false positives before the conventions settle. Deferred to a re-evaluation trigger, not built as blocking.
- **Resolve the line number, or run the referenced test.** Over-reaches the "never run anything in the gate" invariant (ADR-0001) and the presence-not-quality line. Existence of the file is enough to catch the drift that matters (moved/deleted).
- **An LLM that judges whether the pointer still implements the rule.** Violates the zero-LLM invariant.

## Consequences

- **Positive.** A manifest stops silently rotting: a pointer that no longer resolves surfaces at the gate. Advisory keeps it safe to ship and safe in CI.
- **Negative, accepted.** Advisory means a stale pointer does not fail the build yet — it is surfaced, not enforced. Accepted as the false-positive-safe first step, with a trigger to promote it.
- **On other boundaries.** `conformance.ts` gains a `driftReport`; `check --strict` gains an advisory drift section. No change to exit codes on drift, to the mission domain, or to the zero-LLM invariant.

## Reevaluation trigger (mandatory, dated)

Promote drift from advisory to blocking (under `--strict`, or a dedicated strictness level) once evidence-path conventions are stable and observed false positives are near zero. Reopen sooner if the path-token heuristic produces false positives on legitimate prose evidence.

**Trigger set on**: 2026-07-07 · **Watched via**: the conformance-gate incident log and drift-report false-positive rate.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the snapshot this makes drift-aware; its trigger (b) anticipated requiring pointers to resolve.
- Spec Kit `templates/commands/converge.md` — the continuous code↔spec drift detector this adapts.
- `src/lib/conformance.ts`, `src/commands/check.ts` — the surfaces this ADR touches.
