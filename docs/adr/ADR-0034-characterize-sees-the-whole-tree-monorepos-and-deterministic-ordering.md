# ADR-0034: `runward characterize` sees the whole tree — nested workspaces — and orders every scan deterministically

**Date**: 2026-07-20
**Status**: accepted (ratified 2026-07-29 — see Ratification)
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — the resume-existing audit's #1 finding, reality-checked against `src/lib/characterize.ts` (root-only detectors) and the ADR-0014 read-only/deterministic/zero-LLM contract.

## Context

`characterize` is the read-only entry to a brownfield mission. Two defects, observed in the real code:

1. **Root-only blindness.** `detectEcosystems`, `detectEntrypoints`, `detectCI`, `detectContainers` (`characterize.ts:61–149`) all test only `join(root, …)`. A monorepo — pnpm/yarn/npm workspaces, a Turbo/Nx repo, a Cargo workspace, `go.work`, a multi-module Gradle build — carries its real manifests under `packages/*`, `apps/*`, `services/*`. On the dominant shape of large brownfields, the `Languages & build` table comes back **empty or wrong**, and the mode `M2 — join a project in flight` (the audit's typical target) starts from nothing. The bounded `walk()` (`characterize.ts:39`) already exists and already skips heavy dirs, but only feeds a file *count* (`:178`) and the test count (`:155`) — it never discovers manifests.

2. **Non-deterministic ordering.** `detectCI` (`characterize.ts:135`) pushes `readdirSync(wf)` results **unsorted** straight into the rendered `characterization.md`. `readdirSync` order is filesystem-dependent, so two runs on the same commit — on the same machine after a re-checkout, or on a colleague's clone — can render the CI list in a different order. That is a direct breach of the ADR-0014 core promise ("two runs on the same commit agree"), on the command whose whole value is reproducibility.

## Decision

**`characterize` discovers manifests across the bounded tree, reports workspaces as a first-class section, and sorts every filesystem-derived list before it is rendered.**

- **Nested-manifest discovery.** Reuse `walk()` (bounded depth, `SKIP_DIRS`-pruned, read-only) to find dependency manifests below the root. The root ecosystem detection is unchanged; nested finds are reported in a new **"Sub-packages / workspaces"** section as `path → ecosystem` facts (bounded, deterministic). Depth is capped (default 3) so a pathological tree cannot explode the scan; when the cap or a result cap is hit, the output says so (never a silent truncation).
- **Workspace markers.** Detect and report the presence (pure existence, no parsing of intent) of `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `go.work`, a `workspaces` field in the root `package.json`, a `[workspace]` table in root `Cargo.toml`, and `settings.gradle`/`settings.gradle.kts`. Facts only — "this repo declares a workspace", never "this is well-structured".
- **Deterministic ordering.** Every `readdirSync` result that reaches the rendered output is `.sort()`-ed. Nested manifests render in a stable, path-sorted order. This closes the reproducibility hole and is the precondition the determinism test (ADR-0014 follow-up) will assert.

Still `confidence: high` facts, read-only, zero-LLM. No manifest is executed; nested manifests are recorded as `path → ecosystem` presence facts only — their dependency lists are deliberately **not** parsed (the at-rest dependency parse applies to root manifests; resolving the nested graph is the operator's reconstruction, per the discarded alternative below).

## Alternatives discarded

- **Unbounded recursion to find every manifest.** Rejected: unbounded walk on a large legacy repo is a latency and memory risk, and violates the "bounded, read-only" posture. Depth cap + `SKIP_DIRS` (already the `walk()` contract) is the deterministic, safe reuse.
- **Parse workspace globs and resolve the true package graph.** Rejected for now: resolving `workspaces: ["packages/*"]` into an accurate dependency graph edges toward interpretation and per-tool semantics (pnpm ≠ Cargo ≠ go.work). Presence + discovered nested manifests are honest facts; the graph is a judgement the operator/agent reconstructs (ADR-0013).
- **Leave ordering to the filesystem and "usually it's stable".** Rejected: "usually deterministic" is non-deterministic. The contract is byte-for-byte agreement; a sort is one line and removes all doubt.

## Consequences

- **Positive.** The dominant brownfield shape (monorepo) is no longer invisible; `M2` starts from a real map. Reproducibility becomes true, not approximately true — the determinism test can now assert byte-equality. `walk()` earns its keep beyond a file counter.
- **Negative, accepted.** A deeper (still bounded) scan costs marginally more I/O on huge trees; capped and reported. The workspace section can be long on a big monorepo; it is sorted and cap-reported.
- **On other boundaries.** `Inventory` grows a `subPackages` / `workspaceMarkers` shape; `renderCharacterization` grows one section; `--mine` (ADR-0038) can later consider nested stacks. The gate is untouched (`characterize` sits upstream).

## Ratification — 2026-07-29

Ratified by the maintainer, closing an inverted doc↔code drift: the whole-tree scan and deterministic ordering shipped and have run under test while this ADR stayed `proposed`.

Delivered and in force, with the evidence:

- **Nested-manifest discovery** as a first-class "Sub-packages / workspaces" section, via the bounded `walk()` (depth cap, `SKIP_DIRS`-pruned), plus workspace-marker presence detection — `file:src/lib/characterize.ts#detectSubPackages`, `file:src/lib/characterize.ts#detectWorkspaceMarkers`.
- **Deterministic ordering.** Every `readdirSync`-derived list is sorted through `byCodeUnit` (locale-independent) with POSIX-stable paths (`toPosix`); caps are announced, never silently truncated — `file:src/lib/characterize.ts#walk`, `file:src/lib/characterize.ts#detectCI`.

Proof: `test:test/unit/characterize.test.js` ("monorepo: nested manifests and workspace markers are seen and sorted (ADR-0034)"), `test:test/unit/characterize-parsers.test.js` (byte-identical across locales; symlinked directory never traversed), and end-to-end `test:test/smoke.js` ("characterize sees the whole tree: a nested sub-package is surfaced (ADR-0034)"). Read-only, offline, zero-LLM; the gate is untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) real repos show the depth-3 cap misses common layouts (e.g. deeply nested `services/*/*/package.json`) — then raise the cap or make it a flag; (b) the flat "discovered nested manifests" list proves insufficient and operators need the resolved workspace graph — then reconsider parsing globs behind the same read-only contract; or (c) the sub-package scan measurably slows `characterize` on large monorepos beyond an acceptable budget.

**Trigger set on**: 2026-07-20 · **Watched via**: dogfooding `characterize` on monorepos and the determinism test's stability.

## References

- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the read-only/deterministic/zero-LLM contract this extends and whose "two runs agree" promise the sort restores.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — facts vs the operator-reconstructed *why* (why the workspace graph stays out).
- `src/lib/characterize.ts` (`walk`, `detectEcosystems`, `detectCI`, `renderCharacterization`) — edited.
- The resume-existing / brownfield audit (2026-07-20).
