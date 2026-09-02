---
title: Reversible Memory Consolidation (Merge, Summarize, Keep Pointers)
phases: [floor]
impact: MEDIUM
impactDescription: Keeps long-term memory compact without destroying evidence, so every consolidated fact can be unfolded back to its sources at audit time
tags: [data, memory, consolidation, summarization, audit]
noTerritory: It constrains the data model and the behaviour of the memory store — source pointers, supersession rather than deletion — a property of the system that no file path delimits.
---

## Reversible Memory Consolidation

> **Consolidation is a projection, not a rewrite. You never consolidate the source of truth.**

A memory store that only accumulates degrades: near-duplicates crowd out signal, retrieval ranks ten variants of the same fact, and the context budget fills with redundancy. The answer is consolidation — merging near-duplicates, summarizing episodes into higher-level facts — but done naively it destroys the very thing memory exists for: the ability to say *why* the system believed what it believed.

The rule is that consolidation must be **reversible**. Two constraints make it so:

1. **The immutable journal is never consolidated.** Consolidation operates on the derived working view only (see *State as an Immutable Journal*). The journal remains the append-only source of truth; a summary is one more derived artifact, never a replacement for what it summarizes.
2. **Every consolidated item keeps pointers to its sources.** A merged fact records the ids of the near-duplicates it absorbed; an episode summary records the ids of the events it condenses. Given a consolidated memory, you can always unfold it back to the raw facts.

**Incorrect:**

```typescript
// Destructive consolidation: summarize, then delete the originals.
async function consolidate(memories: Memory[]): Promise<void> {
  const summary = await summarize(memories);
  await memoryStore.insert(summary);
  await memoryStore.deleteMany(memories.map(m => m.id)); // BAD: evidence gone
  // A month later: "why did the agent think the client wanted X?"
  // The summary says so, the facts behind it no longer exist.
}
```

**Correct:**

```typescript
// Reversible consolidation: the summary points at its sources,
// the sources are demoted out of retrieval, nothing is destroyed.
interface ConsolidatedMemory extends Memory {
  kind: 'merged' | 'episode-summary';
  sourceIds: string[];        // pointers to the raw facts
  consolidatedAt: Date;
}

async function consolidate(memories: Memory[]): Promise<ConsolidatedMemory> {
  const summary = await summarize(memories);
  const consolidated = await memoryStore.insert({
    ...summary,
    kind: 'episode-summary',
    sourceIds: memories.map(m => m.id),
    consolidatedAt: new Date(),
  });
  // Sources leave the retrieval index, not the store.
  await memoryStore.markSuperseded(memories.map(m => m.id), consolidated.id);
  return consolidated;
}

// Audit: unfold a consolidated memory to the raw facts as of a decision.
async function unfold(memoryId: string, asOf: Date): Promise<Memory[]> {
  const memory = await memoryStore.get(memoryId);
  if (!('sourceIds' in memory)) return [memory];
  const sources = await memoryStore.getMany(memory.sourceIds);
  return sources.filter(s => s.createdAt <= asOf);
}
```

Two consolidation moves, same discipline for both:

- **Near-duplicate merge**: facts above a similarity threshold collapse into one canonical statement carrying the union of their provenance. The duplicates are superseded, not deleted.
- **Episode summarization**: a bounded slice of interaction events becomes one higher-level fact ("the user prefers weekly reports on Monday"), pointing at the events that support it.

**Why this matters:**

- **Audit**: when a decision is questioned, you replay it at its timestamp and unfold every consolidated memory that was in context back to the raw facts. A summary that cannot be unfolded is an assertion without evidence.
- **Correcting bad summaries**: summarization is a model operation and will sometimes be wrong. With pointers, a bad summary is fixed by re-summarizing the same sources; without them, the error is permanent and silently propagates.
- **Retrieval quality**: superseded items leave the index, so ranking stops splitting relevance across ten variants of one fact — without paying for it in lost history.

**Checklist:**

- [ ] Consolidation runs on the derived view only; the immutable journal is untouched.
- [ ] Every merged or summarized memory carries `sourceIds` pointing to its raw facts.
- [ ] Superseded sources are removed from retrieval, never physically deleted by consolidation.
- [ ] An `unfold` path can expand any consolidated memory to its sources as of a given timestamp.
