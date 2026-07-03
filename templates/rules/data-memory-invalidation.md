---
title: Bi-Temporal Memory Invalidation (Contradicted Facts Are Dated, Not Deleted)
impact: MEDIUM
impactDescription: Lets memory change its mind without lying about the past, by tracking when a fact was learned and when it was valid as two separate timelines
tags: [data, memory, invalidation, bi-temporal, audit]
---

## Bi-Temporal Memory Invalidation

> **A contradicted fact is invalidated with a date. It is never deleted.**

Facts about the world change: the user moves teams, the client changes their budget, a preference flips. A memory store that handles this by overwriting or deleting the old fact destroys two things at once — the ability to explain past decisions ("it acted on what it knew then"), and the ability to detect that a fact *changed*, which is often information in itself.

The structural answer is **bi-temporal** memory. Every fact carries two independent timelines:

- **Learned time** (`recordedAt` / `supersededAt`): when the system came to know the fact, and when it stopped treating it as current.
- **Valid time** (`validFrom` / `validTo`): the period in the world during which the fact held true.

The two are different and both matter. "The budget is 50k" may have been *true* from January but only *learned* in March; a decision made in February is judged against what was learned by February, not against what turned out to be true.

**Incorrect:**

```typescript
// Overwrite on contradiction: the past is silently rewritten.
async function updateFact(subject: string, newValue: string): Promise<void> {
  await memoryStore.update({ subject }, { value: newValue }); // BAD: old value gone
  // "Why did the agent quote 30k in February?" — no way to know
  // the store ever said 30k. The audit trail now contradicts itself.
}
```

**Correct:**

```typescript
interface BiTemporalFact {
  id: string;
  subject: string;
  value: string;
  source: 'user' | 'system' | 'inferred';
  authority: number;          // e.g. user-stated > inferred
  recordedAt: Date;           // learned time: when we came to know it
  supersededAt: Date | null;  // learned time: when we stopped believing it
  validFrom: Date;            // valid time: when it became true in the world
  validTo: Date | null;       // valid time: when it stopped being true
}

// A contradiction invalidates with a date; nothing is deleted.
async function assertFact(next: Omit<BiTemporalFact, 'id' | 'supersededAt'>): Promise<void> {
  const current = await memoryStore.findCurrent(next.subject);
  if (current) {
    // Most recently learned wins — unless the standing fact
    // comes from a more authoritative source.
    if (current.authority > next.authority) return; // keep the standing fact
    await memoryStore.invalidate(current.id, {
      supersededAt: next.recordedAt,     // we stopped believing it now
      validTo: next.validFrom,           // it stopped being true then
    });
  }
  await memoryStore.insert({ ...next, supersededAt: null });
}

// Two distinct questions, two distinct queries.
const nowView = await memoryStore.query({ supersededAt: null, validTo: null });   // true now
const asOfT   = await memoryStore.query({
  recordedAt: { lte: T }, supersededAtAfterOrNull: T,   // what we knew at T
});
```

**Resolution order on contradiction:** the most recently learned fact invalidates the older one — *unless* the older fact comes from a more authoritative source (a user's explicit statement outranks a model's inference; a verified system-of-record field outranks both). Authority is compared first, recency second.

**Physical deletion stays exceptional.** Two cases only:

1. **Derived data under retention**: projections, caches and indexes rebuilt from the journal may be purged on their TTL (see *TTL by Data Type*).
2. **Mandated erasure**: a legal right-to-erasure request removes the data wherever it lives, including the journal, through a documented, non-routine procedure.

Everything else is invalidation with a date.

**Why this matters:**

- **Audit**: "what did the system believe at the time of decision D?" has an exact answer — replay the learned timeline at D. Overwrites make that question unanswerable.
- **Correct behaviour under change**: the agent can say "your budget was 30k until March, 50k since" instead of flattening history into the latest value.
- **Safe contradiction handling**: injected or mistaken "corrections" don't destroy the standing fact; they sit next to it, dated and sourced, and can be rolled back by re-invalidating.

**Checklist:**

- [ ] Every fact carries both learned time and valid time.
- [ ] Contradictions invalidate with a date; no routine code path deletes facts.
- [ ] Recency wins on conflict only at equal or higher source authority.
- [ ] "True now" and "known at time T" are two distinct, supported queries.
- [ ] Physical deletion is limited to derived data under retention and mandated erasure.
