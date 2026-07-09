# ADR-0014: The `runward characterize` command contract

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — first build piece of the retro-documentation surface scoped in ADR-0013. Contract decided against the never-a-runtime and zero-LLM-gate invariants. Decision only; no code in this ADR.

## Context

ADR-0013 adopts retro-documentation as the transmission phase pointed backward and names `runward characterize` as the one genuinely new primitive: the read-only entry point that turns an undocumented system into the start of a governed mission. Today the brownfield entry mode is a workflow the agent reads (`brownfield.md`) with no CLI verb; "characterize before touching" is a manual instruction, not a tool.

Before writing code, the command's contract must be locked, because `characterize` is the highest-temptation surface in runward: it is the one place an agent reads a real codebase, and the pull is to let it *conclude* — to emit "here is your architecture / here are your decisions / here is your compliance posture" as fact. That would put an LLM's judgment on the path to the gate and make runward an oracle. The contract exists to make that impossible by construction, not by good intentions.

## Decision

`runward characterize` is a **read-only** command that produces the raw material of a brownfield mission: a factual inventory plus *candidate* decisions, all explicitly unvalidated. It reads artifacts at rest and writes only into `runward/` — never into `.git/`, never the user's source, and it never executes the user's system.

**Two layers, sharply separated:**

- **Deterministic inventory (default, zero-LLM).** Parses artifacts at rest: repo tree, dependency manifests and lockfiles (pinned versions), entrypoints, CI/workflow config, container/deploy files, test presence and reported coverage, and the *shape* of `git log` (age, churn, authors — counts, not interpretation). Emits `runward/characterization.md`: a factual inventory with a `confidence: high` header, no opinions, no *why*. Reproducible — two runs on the same commit agree.
- **Advisory ADR-mining (opt-in, `--mine`).** Only under an explicit flag. May use an agent/LLM to propose decisions from evidence (when a boundary appeared, when a dependency was swapped, what a flag toggles). Writes **only** `runward/adr/DRAFT-*.md` files, each with `status: hypothesis`, the evidence pointers (commit SHAs, file paths) that suggest a decision, and an explicit `why: UNKNOWN — needs operator` field. It writes nothing else and touches no manifest.

**The contract's hard lines:**

- **Read-only, never a runtime.** `characterize` opens files; it does not install, build, run, or instrument the target. No network to the target, no execution of its code.
- **Zero-LLM in the deterministic core.** The inventory is pure parsing. The LLM lives only in the opt-in `--mine` layer, strictly upstream of any gate, and its only output is DRAFT hypotheses.
- **Nothing it emits can pass the gate.** DRAFT ADRs carry `status: hypothesis`; `check --strict` (per ADR-0013's lifecycle) requires `status: accepted` + a human-written *why* + a trigger. `characterize` produces material for the operator to ratify, never a conformance verdict.
- **Facts are labelled facts; guesses are labelled guesses.** `characterization.md` is `confidence: high` (mechanical). DRAFT ADRs are hypotheses with provenance. No output is ever presented as original design intent or as compliance.
- **Idempotent and non-destructive.** Re-running refreshes `characterization.md` and adds/updates DRAFTs; it never overwrites an operator-ratified ADR (`status: accepted`) or any mission state.

**Surface:** `runward characterize [--path <dir>] [--mine] [--yes] [--dry-run]`. Exit codes follow the house convention: `0` inventory produced, `2` no repo/target found. `--mine` never changes the exit code (advisory). Default (no `--mine`) is deterministic and offline.

## Alternatives discarded

- **Let `characterize` run or instrument the system** to observe real behavior. Violates never-a-runtime and would require executing untrusted code. Characterization tests that *do* run belong to the operator in their own harness (brownfield workflow), not to a runward command. Rejected.
- **Emit ADRs directly (no DRAFT state), or auto-accept mined decisions.** Launders a hypothesis into a validated fact and lets an LLM's guess satisfy the gate. Rejected — it breaks operator-owns-the-gate (ADR-0013).
- **Put the mining in the default path (no opt-in flag).** Makes every `characterize` an LLM call and blurs the deterministic/advisory line. Rejected — the deterministic inventory must stand alone, offline and reproducible.
- **One combined artifact** (inventory + decisions in one file). Confuses `confidence: high` facts with `hypothesis` guesses. Rejected — separate `characterization.md` (facts) from `adr/DRAFT-*.md` (hypotheses).

## Consequences

- **Positive.** The named-but-untooled entry mode becomes a real, safe primitive; the operator gets the raw material of a brownfield mission in one read-only pass; the deterministic inventory is useful on its own (offline, no keys), and the advisory layer accelerates ADR reconstruction without ever asserting truth.
- **Negative, accepted.** A useful `--mine` run depends on an agent whose proposals are fallible — surfaced honestly as `hypothesis`/`why: UNKNOWN`, never smoothed over. The command does not *finish* the retro-doc; it starts it (the operator must ratify, and prove autonomy — ADR-0013's caveat).
- **On other boundaries.** A new `src/commands/characterize.ts`; a `runward/characterization.md` convention and a `DRAFT-*.md` ADR shape; `init`/`doctor` unaffected; the deterministic gate and its zero-LLM invariant untouched (this command sits entirely upstream of it).

## Reevaluation trigger (mandatory, dated)

Reopen if `--mine` proposals are trusted without ratification in practice (operators promoting DRAFTs unread), or if the deterministic inventory is asked to make judgments beyond parsing. At that point, add friction to DRAFT promotion (an explicit per-ADR confirm) or narrow the inventory, rather than let `characterize` drift toward asserting conclusions.

**Trigger set on**: 2026-07-09 · **Watched via**: field use of `characterize --mine` and any DRAFT promoted without an operator-written *why*.

## References

- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — the retro-documentation decision and the ADR `hypothesis → accepted` lifecycle this command feeds.
- [ADR-0001](ADR-0001-enforce-declared-rule-conformance-at-the-gate.md) — the deterministic gate `characterize` sits upstream of.
- `docs/retro-documentation.md` — the capability brief, confidence model, and anti-overclaim guardrails.
- `templates/workflows/brownfield.md`, `docs/when-to-use.md` — the documented entry mode this command tools.
