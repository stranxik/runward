---
title: Forward-Only, Branch-First Migrations
impact: HIGH
impactDescription: Keeps schema change safe and auditable by making migrations additive, ordered, and tested on a branch before main
tags: [data, migrations, database, schema, safety]
appliesTo: [**/migrations/**, **/migration/**, **/migrate.*]
---

## Forward-Only, Branch-First Migrations

Schema evolution is a migration of state, not a rewrite. Treat migrations like contract changes: additive, ordered, reversible by rolling forward, and proven on a branch before they touch production data.

> **Forward-only, additive, tested on a branch, then main.**

**Rules:**

1. **Versioned and contiguous.** Files are numbered `0001`, `0002`, ... A runner applies them in order and refuses a gap or a re-order (anti-skip guard).
2. **Forward-only.** No destructive down-migration in normal operation; you fix forward with a new migration. Removal of a column is the *contract* phase of expand-then-contract, run only once nothing reads it.
3. **Branch-first.** Run the migration on a throwaway branch (Neon copy-on-write costs ~0), verify the schema and the schema-drift test, keep the branch as a return net, then apply to main.
4. **Idempotent seeds.** Seed with `on conflict (id) do nothing` so re-running is safe.

**Migration runner guard (the order is enforced, not trusted):**

```typescript
// scripts/migrate.ts - transactional, contiguity + anti-skip
const applied = await db.appliedMigrations();          // e.g. [1, 2]
const onDisk  = listMigrations();                      // e.g. [1, 2, 3]
assertContiguous(onDisk);                              // no gap 1,3 without 2
assertNoReorder(applied, onDisk);                      // applied prefix unchanged
for (const m of onDisk.filter(m => !applied.includes(m.n))) {
  await db.tx(async (t) => { await t.run(m.sql); await t.recordApplied(m.n); });
}
```

**Incorrect:**

```sql
-- Editing an applied migration in place, or dropping a live column.
ALTER TABLE facts DROP COLUMN value;   -- BAD: breaks readers, irreversible
```

**Correct:**

```sql
-- 0007_add_period.sql  (additive, forward-only)
ALTER TABLE facts ADD COLUMN period text;   -- expand
-- backfill in the same or a later migration; readers move over;
-- only later, 0009_drop_legacy.sql removes what nothing reads (contract).
```

**Checklist:**

- [ ] Migrations are numbered, contiguous, applied in order by a runner.
- [ ] No edit to an already-applied migration; fix forward.
- [ ] Proven on a branch (schema-drift green) before main.
- [ ] Column removal is the contract phase, after readers have moved.
