# ADR-0019: Typed evidence pointers, verified at the gate

**Date**: 2026-07-16
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — factual multi-agent audit of the gate ("the gate proves the trace, not the implementation"), cross-read against the pre-set reevaluation triggers of ADR-0001 and ADR-0002, challenge, durable position

## Context

The audit confirmed, file and line, what ADR-0001's own reevaluation trigger (b) anticipated: the only thing `check --strict` verifies about an `applied` row's evidence is that the *string* is non-empty. The drift pass (ADR-0004) checks existence only, and advisorily. Consequently a pointer at an existing but **empty** file passes the gate green — a trace that points at nothing. That is a gaming vector in ADR-0002's sense ("a way to satisfy the manifest without a real decision"), and it is exactly the erosion trigger (b) of ADR-0001 planned for: "re-tighten toward the operator (e.g. require a pointer to resolve to an existing file:line — still deterministic)."

Evidence today is free prose. That is deliberate (ADR-0004: prose is the operator's judgment) and it must survive — the reference mission's strongest evidence rows are section references. But an operator who *wants* the gate to verify more has no way to say so: the pointer carries no declared nature the gate could check.

## Decision

Give an evidence pointer an optional, declared **type**, and give each type a deterministic check. Opt-in per row; free prose stays exactly as valid as before.

**Grammar** (one or more pointers may appear in an Evidence cell, alongside prose):

- `file:PATH`, `file:PATH:LINE`, `file:PATH#SYMBOL`, `file:PATH:LINE#SYMBOL`
- `test:PATH`, `test:PATH::NAME` (`NAME` runs to the next `;` or the end of the cell; quotes optional)
- `adr:NNNN`

**Checks, blocking under `--strict`** (a typed pointer is an explicit contract — failing it is a violation, not an advisory):

- `file:` — the path resolves under the same three bases as the drift pass; the file is **non-empty** (non-whitespace bytes); with `LINE`, the file has at least that many lines; with `SYMBOL`, the symbol occurs in the file (deterministic substring, language-neutral).
- `test:` — same resolution and non-vacuity; with `NAME`, the test name occurs in the file.
- `adr:` — an ADR with that number exists in `runward/adr/` (digit-boundary match, as `deviated` already enforces).

**Non-vacuity of pointed content, for every row** (typed or not): any path token in an `applied` row's evidence that *does* resolve must resolve to a non-empty file. A real-but-hollow file no longer passes. This is the one check extended to legacy prose rows — an empty file is never legitimate evidence, so the false-positive surface is nil.

**What the gate still never does**: open project semantics, run a test, call a model. Every check above is existence, line count, or substring — bytes, not judgment. The invariant moves one honest notch: from "a traced decision exists" to "a traced decision exists and points at something that is really there". Whether the pointed code truly implements the rule remains the operator's judgment at the gate, informed by the `verify` workflow (ADR-0007) and, deterministically, by rule signatures (ADR-0020).

## Alternatives discarded

- **Make typing mandatory.** Breaks every existing mission and outlaws the prose evidence ADR-0004 deliberately respects (a section reference can be the strongest honest pointer for an architecture note). Typing is a contract the operator opts into, row by row.
- **Resolve symbols by AST / language server.** Language-specific machinery and false precision; a substring check is deterministic, dependency-free and language-neutral. A renamed symbol failing the check is not a false positive — it is drift surfacing.
- **Run the named test.** Crosses never-a-runtime (ADR-0005); the gate proves the test *exists by name*, the operator's suite proves it passes (the behavioral proof, kept legible and separate).

## Consequences

- **Positive.** The empty-file pass is closed for all rows; an operator can escalate any row from prose to a verified pointer without leaving the manifest; the grammar gives `manifest --sync` and machine surfaces something structured to emit.
- **Negative, accepted.** A parser and per-type checks to maintain in `conformance`'s orbit; typed rows are only as good as their adoption — ergonomics (scaffolding, docs) must carry them, or prose stays the default and only the non-vacuity floor bites.
- **On other boundaries.** `src/lib/evidence.ts` (pointer grammar + checks) enters the gate path; `check --strict` gains blocking evidence violations; the four gated templates and the floor workflow document the grammar; the reference mission demonstrates typed rows where its evidence is file-backed.

## Reevaluation trigger (mandatory, dated)

Reopen if typed pointers stay rare in real missions (prose remains ~the only form — then the ergonomics failed, fix scaffolding before tightening anything), or if the non-vacuity/substring checks produce a single confirmed false positive on legitimate evidence.

**Trigger set on**: 2026-07-16 · **Watched via**: typed-row ratio in missions that cross the gate, and the conformance-gate incident log.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — trigger (b), the pre-authorized tightening this executes.
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — trigger (a): the real-but-empty file is a gaming vector of that class.
- [ADR-0004](ADR-0004-advisory-drift-detection-of-applied-pointers.md) — the resolution bases and the prose-is-judgment line this preserves.
- [ADR-0020](ADR-0020-rule-evidence-signatures.md), [ADR-0021](ADR-0021-blocking-drift-and-evidence-sealing.md) — the two companion tightenings shipped with this one.
