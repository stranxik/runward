---
title: Tiered Memory Router
impact: HIGH
impactDescription: Order-of-magnitude latency cut on simple queries by fetching only the memory tier the query needs, measured on a reference system — recalibrate on your traffic
tags: [patterns, memory, performance, architecture]
---

## Tiered Memory Router

Not every query needs full memory search. Route to appropriate tier based on complexity.

**The Problem:**

Fetching all memory sources for every query:
- Slow (full graph traversal, vector search)
- Expensive (embedding generation)
- Unnecessary for simple queries

**Tiered Approach:**

```
Tier 0 (casual) - ~50ms
└── Presence, timezone, basic stats only

Tier 1 (task) - ~400ms
└── Tier 0 + vector search + recent memories

Tier 2 (deep) - ~1200ms
└── Tier 0 + Tier 1 + graph traversal + archival search
```

**Incorrect:**

```typescript
// Always fetch everything
async function getContext(userId: string, query: string): Promise<Context> {
  const [presence, memories, graph, archives] = await Promise.all([
    getPresence(userId),
    searchMemories(query),          // BAD: Always runs
    traverseGraph(userId, query),   // BAD: Always runs
    searchArchives(query),          // BAD: Always runs
  ]);
  return { presence, memories, graph, archives };
}
```

**Correct:**

```typescript
type MemoryTier = 0 | 1 | 2;

interface MemoryRouterConfig {
  tier: MemoryTier;
  sources: MemorySource[];
  timeout: number;
}

const tierConfigs: Record<MemoryTier, MemoryRouterConfig> = {
  0: {
    tier: 0,
    sources: ['presence', 'basicStats'],
    timeout: 100,
  },
  1: {
    tier: 1,
    sources: ['presence', 'basicStats', 'vectorSearch', 'recentMemories'],
    timeout: 500,
  },
  2: {
    tier: 2,
    sources: ['presence', 'basicStats', 'vectorSearch', 'recentMemories', 'graphTraversal', 'archivalSearch'],
    timeout: 2000,
  },
};

function selectTier(complexity: ComplexityLevel): MemoryTier {
  switch (complexity) {
    case 'casual': return 0;
    case 'task': return 1;
    case 'planning':
    case 'deep': return 2;
  }
}

async function getContext(
  userId: string,
  query: string,
  complexity: ComplexityLevel
): Promise<Context> {
  const tier = selectTier(complexity);
  const config = tierConfigs[tier];

  const fetchers: Record<MemorySource, () => Promise<any>> = {
    presence: () => getPresence(userId),
    basicStats: () => getBasicStats(userId),
    vectorSearch: () => searchMemories(query),
    recentMemories: () => getRecentMemories(userId),
    graphTraversal: () => traverseGraph(userId, query),
    archivalSearch: () => searchArchives(query),
  };

  // Per-source timeout with allSettled: one slow source degrades only
  // itself. A global Promise.race that resolves to [] on timeout would
  // throw away everything — including sources that had already answered.
  const settled = await Promise.allSettled(
    config.sources.map(source => withTimeout(fetchers[source](), config.timeout))
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = settled.length - results.length;
  if (failed > 0) {
    console.warn(`[MEMORY] Tier ${tier}: ${failed}/${settled.length} sources failed or timed out, degrading`);
  }

  return buildContext(results);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then(() => Promise.reject(new Error('memory source timeout'))),
  ]);
}
```

Tier 0 sources (`presence`, `basicStats`) are part of every tier's source list and are cheap key-value reads: a degraded response still carries them. If you need a hard guarantee, await them separately from the optional sources so they are never dropped.

**Latency Impact (measured on a reference system — recalibrate on your traffic):**

| Query Type | Old (all sources) | New (tiered) | Savings |
|------------|-------------------|--------------|---------|
| "Hi" | 1200ms | 50ms | **96%** |
| "Summarize project" | 1200ms | 400ms | **67%** |
| "Analyze market trends" | 1200ms | 1200ms | 0% |

Average latency reduction is large — an order of magnitude on simple queries — but the weighted figure depends entirely on your traffic distribution. The numbers above come from one reference system; measure your own before quoting a percentage.
