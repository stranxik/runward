# ADR-0038: `--mine` mines across languages, groups by dependency family, and never resurrects a ratified DRAFT

**Date**: 2026-07-20
**Status**: proposed
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — resume-existing audit findings on `--mine`, reality-checked against `mineDrafts`/`detectEcosystems`/`renderDraft` (`characterize.ts:281–358`).

## Context

`--mine` is the advisory half of `characterize`. Four defects, observed in the real code:

1. **Node-only mining.** `depNames` is populated only for Node (`characterize.ts:69`); Python/Go/Rust/Java leave it `[]` (`:88, :95, :108`). So `DEP_FAMILIES` — which already contains `django|flask|fastapi|rails|spring-boot|sqlalchemy|gorm|diesel` — is **dead code** off JavaScript. The typical brownfield target (a legacy Python/Java/Go service) gets stack + CI + container candidates but **zero dependency-family** candidates. Promising "brownfield" to a Python/Java/Go legacy is misleading today.
2. **One DRAFT per dependency, capped globally at 8.** `mineDrafts` (`:312–321`) emits one DRAFT per matching dep and stops at 8 in manifest order — so a datastore declared late in the manifest can be purged by the cap, and a repo with many deps in one family gets noise (N near-identical DRAFTs).
3. **Post-ratification resurrection.** After the operator ratifies `DRAFT-stack-node.md` → renames it `ADR-NNNN-…md`, the next `--mine` re-emits `DRAFT-stack-node.md` (nothing checks the `adr/` dir for an already-resolved slug) and re-reddens the gate.
4. **`firstSeen` computed then thrown away.** `firstSeen()` computes the first-seen-in-git date of the manifest and nothing surfaces it. (An earlier draft of this decision promoted it to the DRAFT's `**Date**`; the doctrine audit rejected that as a fact/hypothesis-boundary breach — see the Decision below.)

## Decision

**`--mine` mines dependency families across ecosystems, emits one DRAFT per family, skips already-resolved slugs, and dates a DRAFT honestly: the mining date, with the git first-seen quoted as labeled evidence.**

- **Cross-language `depNames`.** Populate names where they are already at hand, offline: Python `requirements.txt` (already read+split, `:86`) and `pyproject.toml`; Go `go.mod` (the regex at `:94` already matches the require lines — capture the module path it currently discards). Maven `pom.xml` / Cargo `Cargo.toml` follow the same at-rest extraction. This revives the existing `DEP_FAMILIES` entries rather than adding names blindly.
- **Group by family, cap per family.** Emit **one DRAFT per `fam.family`** (e.g. "data store / ORM"), listing the member deps as evidence, instead of one per dep. Replace the global cap-8 with a per-family cap, so no single family drowns the set and no family is purged by manifest order.
- **Sober family extension.** Extend `DEP_FAMILIES` only for structurally decisive families — **auth, observability, IaC, payment** — plus the cross-language names for the families that already exist. Do **not** add ubiquitous-but-low-signal families (test framework, validation): they are noise on the ratification gate.
- **Idempotence after resolution.** Before emitting `DRAFT-<slug>.md`, scan `runward/adr/` for any of three durable, content-derived signals and **skip** the candidate: a ratified `ADR-NNNN-<slug>.md` filename; an ADR carrying a `**Draft-slug**: <slug>` provenance line (every DRAFT ships one and the ratification instructions say to keep it — so ratifying under a *different* filename still resolves); or a `DRAFT-<slug>.md` marked `**Status**: rejected`. The rejected-in-place status is the durable "not a decision": deletion alone is **not** durable — the next `--mine` would re-propose the file and re-redden the gate, overriding the operator's call. No mutable ledger file (that would fight "same commit → same output"); the `adr/` content is the state.
- **Honest dating (fact vs hypothesis).** `**Date**` is the **mining date** for every DRAFT — the only date runward knows as a *fact* about the document it writes. The git first-seen is quoted in Evidence as a labeled trace ("first git trace …, not the decision date"): first-appearance-in-git is a fact about *visible history* (history imports, squashes, shallow clones and renames all shift it), and even a faithful history dates the *file*, never the *decision* — one decides before writing, or writes long after deciding. The ADR template's "records a decision at the moment it is taken" cannot be satisfied retroactively; pretending otherwise would cross the fact/hypothesis boundary this whole command is built on. The ratification instructions tell the operator to confirm or correct `**Date**` — the human is the only party who can know when the decision was actually taken. Keep the literal `**Date**` label (the `status.ts` date regex depends on it).

Still deterministic, git-archaeology only, **no model call** (ADR-0014). DRAFTs remain `Status: hypothesis`, `why: UNKNOWN`, trigger-mandatory — nothing here loosens the gate.

## Alternatives discarded

- **Full manifest parsers for every ecosystem.** Rejected: the names are already within reach from files `detectEcosystems` reads; a targeted extraction revives dead `DEP_FAMILIES` entries without vendoring parsers.
- **Broadly expand `DEP_FAMILIES`.** Rejected: more families = more DRAFTs to ratify; low-signal ones (test/lint/validation) add ratification noise without a structural decision behind them. Extend only where a real architectural choice lives.
- **A `.mined-ledger` file to remember what was emitted.** Rejected: mutable state in tension with the determinism invariant (same commit must give same output regardless of prior runs). The ratified `adr/` set is the durable, content-derived signal.
- **Keep one-DRAFT-per-dep.** Rejected: it produces near-duplicate DRAFTs and lets the global cap purge whole families; per-family is both quieter and more complete.

## Consequences

- **Positive.** `--mine` becomes real on Python/Go/Java/Rust legacies — the actual brownfield target. Fewer, better DRAFTs (one per family). Re-running `--mine` after ratification or rejection no longer re-reddens the gate. DRAFTs date themselves honestly (mining date as fact, git trace as labeled evidence) — the fact/hypothesis boundary holds even on the metadata.
- **Negative, accepted.** Per-family grouping loses per-dep granularity in the DRAFT title (mitigated: members listed as evidence). Cross-language extraction is heuristic per format; a missed name degrades to "no family candidate", never a crash. The ratified-slug scan reads `adr/` each run (cheap, deterministic).
- **On other boundaries.** `EcosystemInfo.depNames` populated for more ecosystems; `mineDrafts` regroups; `renderDraft` dates by first-seen; `characterize` command unchanged. The gate stays red until the operator ratifies — untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) operators promote grouped DRAFTs unread (the ADR-0014 trigger — add per-ADR confirm friction); (b) a decisive family is still missed on real repos — extend `DEP_FAMILIES` (soberly); or (c) the ratified-slug skip proves too strict/too loose (skips a genuinely new decision, or resurrects one) — refine the slug-resolution match.

**Trigger set on**: 2026-07-20 · **Watched via**: field use of `characterize --mine` on non-Node repos; DRAFTs promoted without an operator-written *why*.

## References

- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the deterministic, no-model-call `--mine` contract this stays within; its reopening trigger this serves.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — the hypothesis→accepted lifecycle DRAFTs feed.
- `src/lib/characterize.ts` (`detectEcosystems`, `DEP_FAMILIES`, `mineDrafts`, `renderDraft`, `firstSeen`) — edited.
- The resume-existing / brownfield audit (2026-07-20).
