# ADR-0007: Advisory LLM conformance verification, subordinate to the gate

**Date**: 2026-07-07
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — reality-check against the competitor benchmark (BMAD's adversarial review), challenge, durable position

## Context

The competitor benchmark surfaced the one place a competitor is genuinely ahead: BMAD's LLM evaluation layer — adversarial multi-subagent review, "run it on a different model", deduplicated triage — is a maturity runward lacks. The deterministic gate `check --strict` (ADR-0001) verifies the *presence* of a traced decision (`applied` with a pointer, `deviated` with an ADR, `n/a` with a reason). What it cannot judge is *semantic*: does the code an `applied` row points at **actually apply** the rule, or merely cite it? That is exactly the incident that started this whole line of work, and it is a judgment a deterministic check cannot make.

An LLM can help there. But ADR-0001 fixes the invariant: **no LLM in the gate path**. And the benchmark named the real danger — an "advisory" LLM opinion becoming the de-facto gate by convenience, which would reproduce the very incident (a machine validating instead of a deterministic gate an operator crosses).

## Decision

Introduce an **advisory** LLM conformance-verification layer as a **workflow** (`verify`), agent-executed and strictly subordinate to the deterministic gate:

- **Agent-executed, nothing bundled.** `verify` is a markdown workflow the operator's own coding agent runs — no LLM in runward's code, vendor-neutral, like every other workflow.
- **Never in the exit-code path.** It is not wired into `check`, produces no exit code, and never blocks. It emits cite-vs-apply findings (confirmed / cited-not-applied / uncertain) for the operator to read.
- **Adversarial and diverse.** It challenges each `applied` claim through distinct lenses and, where possible, a different model than the one that built the floor — to avoid self-agreement.
- **The gate stays the operator's.** The deterministic `check --strict` remains the load-bearing decision; `verify` only informs the operator's judgment before they cross it.

The four structural guards — separate workflow, opt-in, advisory-only, gate unchanged — are what keep it from drifting into the gate.

## Alternatives discarded

- **Wire the LLM into `check --strict`.** Violates the zero-LLM invariant and makes the advisory the gate — the exact failure mode named in the benchmark.
- **No LLM layer at all.** Leaves the semantic cite-vs-apply gap that no deterministic check can close; the benchmark showed this is where a competitor leads.
- **Bundle an LLM provider in runward.** Breaks vendor-neutrality; the workflow-executed-by-the-agent model keeps runward neutral.

## Consequences

- **Positive.** The semantic gap (cited vs applied) gets a real instrument, without touching the deterministic gate or vendor-neutrality. runward closes its one benchmarked weakness — on its own terms.
- **Negative, accepted.** An advisory layer can be misused as a gate; the workflow and this ADR state, explicitly and repeatedly, that it never is. The operator must resist rubber-stamping its verdict.
- **On other boundaries.** A new `verify` workflow and `/rw-verify` command; `check` is untouched; the zero-LLM invariant of the gate is untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if operators begin treating a green `verify` as the pass — the advisory becoming the gate. The response is to re-assert subordination and, if needed, make the coupling looser, never to wire `verify` into the exit code.

**Trigger set on**: 2026-07-07 · **Watched via**: how teams describe their gate-crossing decision in handover.

## Amendment (2026-07-11) — discoverability wired, `/rw-verify` left per-harness

The `verify` workflow shipped with the decision (`templates/workflows/verify.md`), but nothing surfaced it: an operator crossing a green gate never learned the semantic layer existed. Fixed, without touching the invariant. **(1)** `runward check --strict`, when green, now prints an advisory "Semantic check" pointer to `runward/workflows/verify.md` (agent-executed, never blocks). **(2)** `AGENTS.md` instructs any agent to run `verify` before crossing a green gate. Both are zero-LLM, vendor-neutral prose — the human and the agent now both find the layer at the right moment.

The `/rw-verify` slash command named in Consequences is **deliberately not shipped as a default**: a per-harness slash command would privilege one agent, against the vendor-neutral invariant (ADR-0010/0012, later than this ADR). The neutral surface — the workflow plus the two pointers above — carries it; a `/rw-verify` binding stays a per-harness example the operator may add, like the Claude Code `Stop` hook.

## References

- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the zero-LLM gate this sits above, never inside.
- BMAD `bmad-code-review` (adversarial multi-subagent review, "different LLM", triage) — the reference for the advisory layer.
- `templates/workflows/verify.md`, `templates/workflows/review.md` — the workflow surface.
