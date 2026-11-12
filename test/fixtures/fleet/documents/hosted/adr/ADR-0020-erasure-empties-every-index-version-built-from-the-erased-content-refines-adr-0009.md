# ADR-0020: Erasure empties every index version built from the erased content (refines ADR-0009)

**Date**: 2026-11-10
**Status**: accepted 2026-11-10 by the author in chat ("je suis ok pour tout ce que tu m'as cité", in answer to a list that named this record), after the independent review of `8fae95e` and its fixes
**Refines**: ADR-0009 (accepted 2026-11-06), which stays in force for everything this record does not change
**Deciders**: Thibault Souris (author). Written by an agent session.
**Method**: decision-loop: reality-check (the store, the archive and the restore replay at `9e5728e`), a planted control on the old code, durable position; revised on 2026-11-10, while still proposed, after the independent review of `8fae95e` (`runward/governance/reviews/2026-11-10_code-review_8fae95e.md`, findings C21 to C26)

## Context

ADR-0009 says: "Erasure removes the bytes, rebuilds the index, and writes an entry that keeps the digests", and "a prepared archive lives 24 h and follows erasure". At `9e5728e`, erasure removed the uploads' bytes and published a new version of the index, but every earlier version of `rw.fleet_index` kept its full bytes, and those bytes project the erased content. The export archive packed `versions/<n>/index.json` for each of them. Erased content therefore survived in derived data: in the table and in any archive prepared afterwards. On the old code, 5 of the 7 unit cases of `test/unit/erasure.test.js` fail, the archive's included (`object archives: GONE-RUN-1`). On PostgreSQL, the main case fails on "the versions built from the repository hold no byte in the table": versions 3, 4 and 5 stay whole.

`runward/JOURNAL.md` had left the related point "to dig": a published version could not be changed, because `rw_maint` held no right on `rw.fleet_index`.

## Decision

1. **The rule, in one place** (`src/application/context.js`, `eraseIndexVersions`). A published version keeps its bytes while every export its `fleet.json` names is still held. Otherwise its bytes are emptied and `erased_at` is set. It keeps `sha256`, `manifest_sha256`, `seq` and its `fleet.json` (repository name, mission, path, commit, digests), as the journal does. The rule reads the versions not yet erased, and of each its number and its `fleet.json` only, through one narrow read of the store (`indexVersionsWhole`): never the bytes of every version, whose sum grows with each upload.
2. **Where it applies**:
   - erasure on request, including a withdrawal of consent with erasure;
   - the retention pass, 30 days after a removal;
   - the replay of an erasure after a restore, whichever of the two made it: the retention pass writes the same `content-erased` event to the security log as an erasure on request, before any byte leaves the object store;
   - on each retention pass, what an earlier erasure left whole, with a journal entry the first time.
3. **The database holds the boundary.** Migration `0006_fleet_index_erasure.sql` adds:
   - the column `erased_at`;
   - a constraint: an erased version holds no byte;
   - the trigger `fleet_index_written_once`: a version is written once, and its only possible change is this emptying. The trigger dates the emptying itself (`now()`), over whatever date the statement gives: an erasure cannot be dated in the past or at infinity.

   `db/grants.sql` gives `rw_maint` `UPDATE` on `rw.fleet_index`, bounded by that trigger. Row-level security is unchanged: forced, per tenant.
4. **The archive.** `versions/<n>/index.json` is packed only when the version is not erased and every export it names is held, so it does not wait for the retention pass. An export is held once its bytes were read from the object store, not on the word of its row: on a restored database that still counts bytes the store no longer has, the version is not packed and `replay.json` does not call it replayable. `replay.json` says `indexErased` for erased content, and `indexWithheld` with `why: "bytes missing"` otherwise. A prepared archive is removed as soon as a version is emptied.
5. **The served index.** When the last version is erased and nothing has been published since, no index is served (404) until the tenant's next gesture or upload.
6. **The journal.** The `content-erased` entry names the versions emptied (`indexVersions`). The retention pass writes one entry per repository erased, which names the repository, its digests and those versions.
7. **Under the tenant lock.** An erasure takes the tenant lock before its first read: the erasure on request, each tenant's retention transaction and the replay. A gesture that republishes the index takes it before it assembles. So a transaction in flight that publishes (an upload, a restore, a change of language) commits before the erasure reads, or assembles after the erasure committed: no version built from the erased content is published around it.

## Alternatives discarded

- **Delete the erased versions' rows**: `seq` and the digests are the trail that the journal and `replay.json` cite. A gap in `seq` would read as a loss, not as an erasure.
- **Rebuild each earlier version without the erased content**: a version is the bytes that were served at that time. Rewriting it would serve something that never existed under its digest.
- **Leave it to the retention pass alone**: the archive would carry erased content for up to a day.
- **A broader right for `rw_maint`**: the trigger confines its `UPDATE` to emptying. Any other change, `DELETE` and `TRUNCATE` are refused, and so is any reach into another tenant (`test/pg/erasure.test.js`).

## Consequences

- **Positive**: erased content leaves the table, the objects and the archive; the digests and the order stay. After a restore from a backup of before an erasure, the replay empties the versions again, for an erasure on request and for one the retention pass made. At `8fae95e` this held for an erasure on request only: the retention pass wrote no event, so the replay had nothing to act on (review finding C22).
- **Negative, accepted**:
  - a tenant whose last version is erased has no served index until its next gesture or upload;
  - `rw_maint` gains a bounded `UPDATE`;
  - backups keep the bytes 7 days, as ADR-0009 already says;
  - a replayed erasure is dated at the replay, not at the first erasure: the security log and the journal keep the first date;
  - between a restore and its replay, a version whose every export can still be read is packed: an export whose bytes another upload of the tenant still holds is one. The service stays stopped for that window (runbook §3);
  - a rollback of the service to an image of before this change (runbook §7) runs code that does not read `erased_at`: for a tenant whose last version is erased and that has published nothing since, that image answers the index with a 200 and an empty body under the old digest, calls an identical rebuild unchanged, and packs an empty `index.json`, until the tenant's next upload or gesture that changes the index. No erased byte comes back. This is read from the code at `9e7fadf`, not run (review finding C25).
- **On other boundaries**:
  - threat T24 and runbook §16 state the new residual;
  - the evaluation rubric cites the two erasure test files;
  - a later column of `rw.fleet_index` that projects content (the planned `point` of lot M2) must join `eraseIndexVersions`, the constraint and the trigger;
  - `publish` and `latestIndex` still read every version of the tenant whole, on each upload and each read of the index, as they did before this record (review finding C23, second half): reading the last row only is a later change.

## What would settle it

- **Confirms**: `test/unit/erasure.test.js` (11 cases) and `test/pg/erasure.test.js` (9 cases, as `rw_app` and as `rw_maint`) green, with the retention case of `test/pg/restore-replay.test.js`. They search a content marker in each version, object, journal entry and archive, as a superuser across tenants on PostgreSQL, with a positive control before the erasure and another tenant unchanged. A store that never empties a version reddens them. Four cases force, on two real connections, a transaction in flight during an erasure (an upload of another repository, an upload of the erased one, a change of language, a restore at the end of its window); two restore a backup of before a retention erasure.
- **Reverses**: an erased marker found in a version, an object or an archive; a legitimate change of a published version that the trigger refuses; a daily pass that fails on a tenant because of what it reads.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-12-10, or earlier when a column that projects content is added to `rw.fleet_index`, or when the index format changes (`runward-fleet-index/0`).

**Trigger set on**: 2026-11-10 · **Watched via**: `test/unit/erasure.test.js`, `test/pg/erasure.test.js`, `db/schema.snapshot.txt`

## References

- ADR-0009 (refined); PADR-0017
- `db/migrations/0006_fleet_index_erasure.sql`, `db/grants.sql`, `src/application/context.js` (`eraseIndexVersions`, `republish`), `src/application/repositories.js` (`eraseIn`), `src/application/operator.js` (`retention`, the replay of `content-erased`), `src/application/reading.js`, `src/adapters/store/` (`indexVersionsWhole`)
- `runward/governance/reviews/2026-11-10_code-review_8fae95e.md` (C21 to C26)
