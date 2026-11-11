# ADR-0002: runward-fleet is pinned by a vendored npm-pack tarball of a git commit, verified file by file

**Date**: 2026-11-06
**Status**: accepted (2026-11-08), ratified on the author's delegation in chat ("ratifie pour moi", "ratify for me"), the session having recommended it; the author did not read this text again before delegating
**Deciders**: proposed by an agent session; Thibault Souris (author) decides.
**Method**: decision-loop

## Context

runward-fleet is `private` (not on npm). The product needs the version of PR #496 of runward (branch `integration/2026-11-06-c`, still open): first at `da888958fbee6557338a5d3d12e7992c66cc13a9` (it adds `./site`, the golden test and `commitSource`), then, from 2026-11-06, at `2ab48025a1afba94dfdf9f6d2e052bf2f00b5753`, whose views name `level-not-met` « niveau non atteint » in French and "level not met" in English (the author's rule of the same day; the hosted app and the exported view must say the same). npm cannot install a package from a subdirectory of a git repository, and no release asset of runward-fleet exists yet.

## Decision

The package is packed at that commit (`npm pack` of `packages/runward-fleet`, reproducible: two packs give the same sha256) and committed as `vendor/runward-fleet-0.46.0-<commit>.tgz` (today `vendor/runward-fleet-0.46.0-2ab48025.tgz`); `package.json` depends on it by `file:`; `package-lock.json` pins its sha512 integrity; `vendor/runward-fleet.lock.json` names the repository, the path, the commit, the tarball sha256 and the integrity. `scripts/verify-runward-fleet.mjs` checks offline that the tarball and the lockfile pin the same bytes, and in CI that every file in the tarball is byte for byte the file at that commit on GitHub (22 files today), with a floor of ten files so the guard cannot pass empty. A re-pin replaces the tarball, the lockfile and `package-lock.json` together, and the lock names the previous pin and why it changed. The re-pin of 2026-11-06 changed `ui/views.js` only, `src/build.js` is the same, so every index the previous pin built replays to the same bytes; each published index also records the archive digest that built it. `/api/version` serves the version, the commit, the archive digest and the digest of the `views.js` served.

## Alternatives discarded

- **A git dependency by SHA**: npm does not install a subdirectory of a repository
- **Copying `views.js` and `build.js` into this repository**: a copy drifts; PADR-0011 forbids it
- **A GitHub release asset verified with `gh attestation verify`**: the target of PADR-0011 point 6; no release of runward-fleet exists yet. This ADR is the interim, and is superseded when the first release is attested

## Consequences

- **Positive**: the code that builds and shows the index is exactly the code at a reviewed commit, checked in CI without trusting the tarball
- **Negative, accepted**: the tarball is binary in the tree (184 kB); a new version is a new commit of this repository
- **On other boundaries**: ADR-0005 (the assembler), ADR-0009 (`/api/version`)

## Reevaluation trigger (mandatory, dated)

Reopen when runward-fleet publishes an attested release, or when PR #496 of runward merges with a head other than 2ab48025 (re-pack at the merged commit).

**Trigger set on**: 2026-11-06 · **Watched via**: `scripts/verify-runward-fleet.mjs` in CI

## References

- PADR-0011 point 6
- stranxik/runward PR #496, heads da888958 then 2ab48025
