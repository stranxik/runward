# ADR-0036: `runward characterize` reports git churn hotspots and bus-factor — counts, never "seams"

**Date**: 2026-07-20
**Status**: accepted (ratified 2026-07-29 — see Ratification)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — resume-existing audit finding, reality-checked against `gitShape` (`characterize.ts:161`, no churn) and ADR-0014:22, which claims the git shape includes "churn" — a capability the code never had.

## Context

`gitShape` (`characterize.ts:161`) computes commits, first/last commit dates, and a distinct-author count. ADR-0014:22 describes the git shape as "age, churn, authors — counts, not interpretation". **Churn is absent** — another doc↔code drift. Churn (per-file change frequency) and bus-factor (how few authors own a hot file) are the canonical, deterministic way to point a brownfield operator at the files that most need characterization tests (brownfield workflow move 1) — the code-maat / Tornhill lineage. This is signal `characterize` can produce read-only, offline, from `git log` alone.

## Decision

**`characterize` aggregates `git log --name-only` into a top-N churn table with a per-hotspot author count, and reports both as raw counts.**

- **Churn hotspots.** `git -C <root> log --format= --name-only` (read-only), tally changes per path, render the **top-N** (default 10) as `path — N changes`. Sorted deterministically (by count desc, then path asc) so two runs agree.
- **Bus-factor.** For each hotspot, count distinct authors touching it (`git log --format=%an -- <path>`, deterministic). Report the count; a hotspot changed 60× by 1 author is a factual concentration signal.
- **Hard line — counts, never interpretation.** The rendered label is "Hotspots (churn)" with raw numbers. It **never** says "probable seam", "refactor target", or "risk". Churn × complexity → *seam* is a judgement; if any speculative label is ever emitted it lives only in a `--mine` DRAFT (`Status: hypothesis`), never in the `confidence: high` `characterization.md`. This keeps the fact/hypothesis frontier (ADR-0014) intact.
- **Bounded & offline.** Top-N capped; on a huge history the aggregation reads the log once. No network. Not a git repo → the section degrades exactly like the existing git shape (reported absent).

## Alternatives discarded

- **Churn × complexity ("real hotspots").** Rejected here: complexity needs language-aware parsing (per-ecosystem), and the product (a ranked "hotspot score") is interpretive — it belongs to the operator's judgement, not the fact inventory. Raw churn + bus-factor are facts; the weighting is a downstream call.
- **Label hotspots as "likely seams".** Rejected: that is the precise overclaim the contract forbids — a machine guess presented as design insight. Facts stay labelled facts.
- **Walk the full per-file history for accurate rename-following.** Rejected as disproportionate/slow; `--name-only` tallying is the standard, fast, deterministic approximation. `--follow` across renames is per-file and does not compose with a single log pass.

## Consequences

- **Positive.** ADR-0014:22's "churn" claim becomes true. The operator gets the canonical pointer to the files most worth characterization tests — the highest-value input to brownfield M3/M4 — offline and reproducible. Bus-factor surfaces concentration risk as a fact.
- **Negative, accepted.** `--name-only` over a very long history costs one larger `git log` read; bounded to top-N output and a single pass. Rename churn is approximate (no `--follow`); acceptable for a shape signal, and stated as counts only.
- **On other boundaries.** `Inventory["git"]` grows a `hotspots: {path, changes, authors}[]`; `renderCharacterization` grows the churn table under the existing git section. The gate is untouched.

## Ratification — 2026-07-29

Ratified by the maintainer. This ADR made true ADR-0014's "churn" claim; the code shipped under test while the status stayed `proposed`.

Delivered and in force: `git log --name-only` aggregated into a top-N churn table (sorted count-desc then path-asc) with a per-hotspot distinct-author count — raw counts only, never "seam"/"risk"; a churn read failure is reported (`churnRead:false`), never rendered as "no hotspots". The user's git config that could perturb the read (`core.quotepath`, `diff.renames`, `log.showSignature`) is pinned (`file:src/lib/characterize.ts#churnHotspots`, `file:src/lib/characterize.ts#gitShape`). Proof: `test:test/unit/characterize.test.js` ("git churn hotspots carry raw counts and bus-factor (ADR-0036)") and the zero-commit case in `test:test/unit/characterize-parsers.test.js`.

**Honest determinism note (extended from ADR-0038).** Churn and author counts read the *visible* history; a shallow clone, a squash or a history import shifts them. "Same commit → same bytes" holds at equal clone depth — a fact about visible history, not a bug.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) operators need rename-following accuracy the `--name-only` tally lacks — then weigh a costlier `--follow` pass; (b) top-10 proves too coarse/too long on real repos — make N a flag; or (c) there is genuine demand for a complexity-weighted hotspot score — then design it as a labelled `--mine` hypothesis, never a `characterization.md` fact.

**Trigger set on**: 2026-07-20 · **Watched via**: dogfooding `characterize` on real repos with deep histories; the fact/hypothesis frontier staying clean.

## References

- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the contract that claimed "churn" (now made true) and mandates counts-not-interpretation.
- `src/lib/characterize.ts` (`gitShape`, `renderCharacterization`) — edited.
- code-maat / A. Tornhill, *Your Code as a Crime Scene* — the churn-as-hotspot lineage (concept, not a dependency).
- The resume-existing / brownfield audit (2026-07-20).
