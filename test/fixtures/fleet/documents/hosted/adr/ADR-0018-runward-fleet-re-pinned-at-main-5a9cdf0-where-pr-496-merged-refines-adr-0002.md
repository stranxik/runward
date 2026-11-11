# ADR-0018: runward-fleet re-pinned at main@5a9cdf0, the commit where PR #496 merged (refines ADR-0002)

**Date**: 2026-11-10
**Status**: accepted 2026-11-10 by the author, after three independent readings recommended it (2026-11-10, at `7f00128`, `e60a0d4` and `b487818`); written by an agent session
**Refines**: ADR-0002 (accepted 2026-11-08), which stays in force for everything this record does not change
**Deciders**: Thibault Souris (author). Written by an agent session.
**Method**: decision-loop: reality-check (the two commits of runward, the tarballs, the lock), challenge, durable position

## Context

ADR-0002 pins runward-fleet by a vendored `npm pack` tarball of a commit of runward, verified file by file, and names its own trigger: "when PR #496 of runward merges with a head other than 2ab48025 (re-pack at the merged commit)". On 2026-11-10 PR #496 merged into `main` of stranxik/runward at `5a9cdf08a76977f9b671662f562e98d332ccc95e` (main@5a9cdf0): the trigger fired.

The answer was made the same day in commit c0b9948 (merged with PR #1 of this repository at a4ede14): `packages/runward-fleet` is identical at `2ab48025` and at `5a9cdf08` (empty `git diff` of that directory); `npm pack` at `5a9cdf08` gives the same tarball, sha256 `99e941a5ea915718e9a8254b00165042305772e3d228227b1cfeb9761b2aa2e9` and the same sha512 integrity; `scripts/verify-runward-fleet.mjs` read the 22 files of the tarball against main@5a9cdf0 on GitHub, all identical. That commit also rewrote ADR-0002 in place, which `process-adr-and-journal` forbids for an accepted record (independent review of a4ede14). ADR-0002 is restored to its accepted text by the change that adds this record; the re-pin is decided here.

The decision is taken at the same boundary as ADR-0002: the IndexAssembler adapter and its supply chain.

## Decision

The pin of runward-fleet rests on **main@5a9cdf0**, a commit of `main`, never on the head of a branch:

- the tarball is `vendor/runward-fleet-0.46.0-5a9cdf08.tgz` (the same bytes as `vendor/runward-fleet-0.46.0-2ab48025.tgz`, renamed); `package.json` and `package-lock.json` name it;
- `vendor/runward-fleet.lock.json` pins `ref` `main`, `commit` `5a9cdf08a76977f9b671662f562e98d332ccc95e`, the tarball's sha256 and integrity, and names the previous pin (`2ab48025`, `integration/2026-11-06-c`) and why it moved;
- everything else of ADR-0002 holds unchanged: the pack, the offline and online checks of `scripts/verify-runward-fleet.mjs` with their ten-file floor, the archive digest recorded on each published index, `/api/version`;
- a later re-pin is made at a commit of `main` only, and is a new record that refines this one.

## Alternatives discarded

- **Keep the pin at 2ab48025**: a commit reachable only from an integration branch, which a deletion or a force-push can take away; the CI's file-by-file check against GitHub would then fail with nothing changed here
- **Edit ADR-0002 in place, as c0b9948 did**: an accepted record is never edited (`process-adr-and-journal`); the trail of what was decided on 2026-11-08 must stay readable as it was decided
- **Wait for an attested release of runward-fleet**: still the target of ADR-0002 and PADR-0011 point 6; no release exists, and the branch commit was the fragile part

## Consequences

- **Positive**: the pinned commit survives any change of the integration branch; the bytes did not change, so every index built under the previous pin replays to the same bytes, and no published index is rebuilt
- **Negative, accepted**: a binary renamed in the tree (184 kB, same content); a commit of this repository for a change of no code
- **On other boundaries**: `runward/contracts/index-assembler.md` names main@5a9cdf08; ADR-0004 (the assembler) unchanged; `/api/version` serves the new commit as `runwardFleetCommit`

## What would settle it

- **Confirms**: `node scripts/verify-runward-fleet.mjs` green in CI against main@5a9cdf0 (22 files identical); the export replay test green on Node.js 22.
- **Reverses**: a file of the tarball that differs from main@5a9cdf0 on GitHub (the check fails closed), or a history rewrite of `main` of runward.

## Reevaluation trigger (mandatory, dated)

Reopen when runward-fleet publishes an attested release (ADR-0002's own trigger, which stands), or when the product needs a change of `packages/runward-fleet` merged into `main` after 5a9cdf08 (re-pack at that commit of `main`, in a new record that refines this one).

**Trigger set on**: 2026-11-10 · **Watched via**: `scripts/verify-runward-fleet.mjs` in CI; the release page of runward

## References

- ADR-0002 (refined), ADR-0004; PADR-0011 point 6
- stranxik/runward PR #496, heads da888958 then 2ab48025, merged into `main` at 5a9cdf08a76977f9b671662f562e98d332ccc95e
- commit c0b9948 of this repository (the re-pin), `vendor/runward-fleet.lock.json`
