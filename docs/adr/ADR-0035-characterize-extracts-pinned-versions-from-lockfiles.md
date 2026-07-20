# ADR-0035: `runward characterize` extracts pinned versions from the lockfile it already detects

**Date**: 2026-07-20
**Status**: proposed
**Deciders**: Thibault Souris (maintainer)
**Method**: decision-loop — resume-existing audit finding, reality-checked against `src/lib/characterize.ts` (lockfile detected, contents ignored) and ADR-0014, which promises "pinned versions" twice but never delivered them.

## Context

`detectEcosystems` (`characterize.ts:61`) records *whether* a lockfile exists (`firstExisting(root, ["package-lock.json", …])`) but never opens it. ADR-0013 and ADR-0014 both name "pinned versions" as part of the deterministic inventory — an unfulfilled promise, exactly the doc↔code drift the framework condemns. For a brownfield operator, the resolved versions are the one place `characterize` can, **entirely offline**, surface the raw material of a dependency-debt audit: `express@4.16` vs `4.21`, a runtime pinned three majors back. Today that signal sits in a file `characterize` has already located and refuses to read.

## Decision

**`characterize` reads the resolved versions from the lockfile it already detects, offline, and reports a bounded sample as facts.**

- **`package-lock.json`**: trivial JSON parse (`packages`/`dependencies` maps) → `name → resolved version`.
- **Other lockfiles** (`yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, `composer.lock`, `go.sum`): line-scan for the `name` / `version` pairs each format encodes — no full-grammar parser, just the pinned pair. A format not recognised degrades to "lockfile present, versions unread", never a crash.
- **Rendered** as a bounded, sorted sample in the `Languages & build` area (e.g. "resolved versions (sample): `express@4.21.2` · …"), with a total count. Runtime deps are prioritised over the (often huge) transitive set; the cap is reported, never silent.
- **Hard line — no advisory lookup.** `characterize` **never** queries an advisory/EOL database or any network (ADR-0014 offline invariant). It reports the pinned version as a *fact*; whether `4.16` is stale is a judgement the operator/agent makes downstream. runward states what is pinned, never "this is vulnerable".

Deterministic (sorted, bounded), read-only, zero-LLM.

## Alternatives discarded

- **Resolve and flag outdated/vulnerable versions.** Rejected: needs a network advisory feed, breaking the offline/deterministic invariant and turning `characterize` into an oracle asserting a security verdict — the exact overclaim ADR-0014 forbids. The version is a fact; the debt is the operator's call.
- **Full lockfile-grammar parsers per ecosystem.** Rejected as disproportionate: a robust `name@version` line-scan (plus trivial JSON for npm) covers the reporting need without vendoring six parsers; unrecognised formats degrade honestly.
- **Report every transitive version.** Rejected: a lockfile has thousands of entries; dumping them buries the signal. Prioritise runtime/direct deps, sample, and report the count.

## Consequences

- **Positive.** ADR-0013/0014's "pinned versions" promise becomes true. The operator gets, offline and reproducibly, the raw material of a dependency-debt review. No new dependency, no network.
- **Negative, accepted.** Line-scan heuristics per format are approximate for exotic lockfiles; degraded honestly to "versions unread". The sample is bounded, so a specific pin may not be shown — the count and cap make that explicit, and the file remains the source of truth.
- **On other boundaries.** `EcosystemInfo` grows a `pinnedVersions` sample + count; `renderCharacterization` shows it. The gate is untouched.

## Reevaluation trigger (mandatory, dated)

Reopen if (a) operators repeatedly need a specific lockfile format the line-scan handles poorly — then add a targeted parser for it; (b) there is a proven, *offline*, vendorable way to flag EOL/outdated majors without a network call or an overclaim — then reconsider surfacing staleness as a clearly-labelled hypothesis, never a fact; or (c) the sampled output is judged too sparse or too noisy in practice.

**Trigger set on**: 2026-07-20 · **Watched via**: dogfooding `characterize` on real lockfiles across ecosystems.

## References

- [ADR-0014](ADR-0014-the-characterize-command-contract.md) — the contract that promised "pinned versions" and forbids the network advisory lookup this deliberately avoids.
- [ADR-0013](ADR-0013-retro-documentation-as-transmission-pointed-backward.md) — pinned versions named as inventory material.
- `src/lib/characterize.ts` (`detectEcosystems`, `renderCharacterization`) — edited.
- The resume-existing / brownfield audit (2026-07-20).
