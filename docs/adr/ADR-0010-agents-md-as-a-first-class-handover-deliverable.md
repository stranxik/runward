# ADR-0010: AGENTS.md as a first-class handover deliverable

**Date**: 2026-07-09
**Status**: accepted
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — ecosystem veille (2026), sourced state of the art, challenge, durable position

## Context

The veille confirmed `AGENTS.md` as the de-facto standard for the agent charter: 60k+ repositories, read by 30+ tools (Codex, Copilot, Cursor, Jules, Amazon Q, and — via `@AGENTS.md` — Claude Code), stewarded by the Linux Foundation's Agentic AI Foundation. runward already writes a vendor-neutral `AGENTS.md` at `init` (the mission charter). What it does **not** yet do is treat `AGENTS.md` as an explicit **output of the handover phase** — the leave-behind that makes the receiving team, and any harness they later adopt, autonomous from day one.

This is the wedge. The labs productizing the FDE posture leave behind a PDF playbook and a dependency on their service. runward's differentiator is transmission-as-deliverable; emitting the leave-behind in the one format every harness already reads turns that principle into a portable, machine-consumable artifact.

## Decision

The **handover** workflow (`transmettre-capitaliser` / `handover`) emits an `AGENTS.md` as a standard, first-class handover deliverable — distinct from the charter written at `init`, this one is the *leave-behind for the receiving team*: the craft rules that govern the system, the **judgment boundaries** (what the operator decides versus what the agent may do), the verification commands (including how to run `runward check --strict`), and the never/PR rules. It is written to be consumed by any harness, alongside the runbook, the ADR journal, and the proofs-in-code — never in place of them.

## Alternatives discarded

- **A vendor-specific profile only (CLAUDE.md, GEMINI.md).** Ties the leave-behind to one harness; the receiving team may run another. `AGENTS.md` is the neutral standard all of them read.
- **A bespoke runward handover format.** Not portable, not read by any tool — it recreates the lock-in the method rejects.
- **A PDF playbook.** What the labs' FDE services produce; human-readable but not machine-consumable, and it ages into a shelf document.

## Consequences

- **Positive.** The handover leave-behind is portable and immediately usable by any harness; "transmission as deliverable" and vendor-neutrality are realised in one move; runward is positioned to own the de-facto "leave-behind" standard.
- **Negative, accepted.** One more emitted artifact to keep aligned with the `AGENTS.md` convention as it evolves.
- **On other boundaries.** The handover workflow's Definition of Done gains the emitted `AGENTS.md`; the doctrine's transmission section names it as the standard format. No change to the gate or the zero-LLM invariant.

## Reevaluation trigger (mandatory, dated)

Reopen if the `AGENTS.md` convention changes materially under AAIF stewardship (structure, required sections), or if a genuinely more widely-read neutral format supersedes it.

**Trigger set on**: 2026-07-09 · **Watched via**: the Agentic AI Foundation's `AGENTS.md` stewardship.

## References

- `AGENTS.md` (Linux Foundation / Agentic AI Foundation) — the neutral charter standard.
- `templates/workflows/handover.md`, `templates/targets/AGENTS.md` — the surfaces this ADR touches.
- The doctrine's transmission section — where the format is named as standard.
