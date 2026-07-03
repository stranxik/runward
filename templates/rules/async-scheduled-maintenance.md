---
title: Scheduled Maintenance (The Cron Updates and Cools, It Never Destroys Truth)
impact: MEDIUM
impactDescription: Keeps memory, derived views and the journal healthy over months of operation through periodic decay, pruning and cold archiving that never touch the source of truth
tags: [async, cron, maintenance, memory, retention, archive]
---

## Scheduled Maintenance

> **The cron updates and cools. It never destroys the truth.**

Some upkeep has no triggering event — its trigger is the passage of time. Memory scores decay as facts age; derived links drift past their retention; the journal accumulates segments nobody reads hot anymore; trends only appear across weeks of aggregates; reminders come due; legally imposed erasure deadlines arrive. This work belongs to scheduled maintenance jobs, not to the interactive turn and not to the post-turn pipeline.

One dividing line governs everything the cron touches:

- **Derived data** — scores, derived links, indexes, caches, summaries — may be decayed, pruned or rebuilt freely: it is recomputable from the journal.
- **The immutable journal** — the source of truth — is never deleted by maintenance. Old segments are moved to cold storage, checksum verified, and remain retrievable for audit and replay.
- **Enforced erasure** — right-to-be-forgotten, legal retention limits — is the only true deletion, and it is an explicit, audited command with its own path. It is never a side effect of a cleanup batch.

**Incorrect:**

```typescript
// A "cleanup" cron that quietly destroys the source of truth.
cron.schedule('0 3 * * *', async () => {
  // BAD: the journal is the truth — audit and replay just died
  await db.query(`DELETE FROM journal WHERE created_at < now() - interval '90 days'`);
  // BAD: silent disappearance — nothing records why the fact vanished
  await db.query(`DELETE FROM memories WHERE score < 0.2`);
});
```

**Correct:**

```typescript
// Each job declares what it touches; none of them deletes truth.
const maintenance: MaintenanceJob[] = [
  {
    name: 'decay-scores', schedule: '@daily',
    run: () => memoryStore.applyDecay({ halfLifeDays: 30 }),
    // Adjusts ranking; low scores demote, they do not delete.
  },
  {
    name: 'prune-derived-links', schedule: '@daily',
    run: () => linkStore.pruneDerived({ olderThan: RETENTION }),
    // Derived only: every pruned link is recomputable from the journal.
  },
  {
    name: 'archive-journal-segments', schedule: '@weekly',
    run: async () => {
      const segments = await journal.segmentsOlderThan(HOT_WINDOW);
      for (const s of segments) {
        const archived = await coldStorage.put(s);
        if (archived.checksum !== s.checksum) throw new Error('archive mismatch');
        await journal.releaseHotCopy(s.id, { archivedAt: archived.location });
      }
      // Moved and verified — never deleted. Audit can still unfold it.
    },
  },
  {
    name: 'detect-trends', schedule: '@weekly',
    run: () => trends.computeOverAggregates({ window: '90d' }),
  },
  {
    name: 'due-reminders', schedule: '@hourly',
    run: () => reminders.emitDue(),
  },
  {
    name: 'enforced-erasure', schedule: '@daily',
    run: async () => {
      // The only true deletion: explicit requests, own path, audited.
      for (const req of await erasureRequests.pending()) {
        await eraseAcrossStores(req.subjectId, req.scope);
        await auditLog.append({ type: 'erasure.executed', request: req.id });
      }
    },
  },
];
```

**Why this matters:**

- **Retrieval quality**: without decay and pruning, ranking drowns in stale facts; the cron is what keeps recall honest as the system ages.
- **Bounded cost without lost history**: cold archiving caps hot-storage growth while audit and replay keep working — the truth cools, it does not vanish.
- **Compliance both ways**: enforced erasure is provable (explicit request, audit record), and nothing *else* can silently delete regulated data, because no other job is allowed to.
- **Recovery**: after a bad consolidation or a corrupted index, every derived structure can be rebuilt — precisely because maintenance never touched the journal.

Maintenance jobs are background jobs like any other: bounded retry, idempotency, bounded concurrency, queue metrics (see *Background Job Guardrails*). A weekly job that fails silently for a month is a slow outage.

**Checklist:**

- [ ] Every maintenance job is classified: derived (may decay/prune/rebuild), journal (archive only, verify then release), or erasure (explicit and audited).
- [ ] No scheduled job issues deletes against the journal; archiving verifies checksums before releasing hot copies.
- [ ] Score decay demotes and invalidation supersedes — nothing silently disappears from memory.
- [ ] Enforced erasure runs on explicit requests through its own path, and writes an audit record per execution.
- [ ] Maintenance jobs follow the background-job guardrails and alert when a scheduled run is missed or failing.
