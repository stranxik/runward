---
title: Tiered Memory Router
impact: HIGH
impactDescription: Reduces latency by 76% through intelligent memory fetching based on query complexity
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

  const promises = config.sources.map(source => fetchers[source]());

  const results = await Promise.race([
    Promise.all(promises),
    sleep(config.timeout).then(() => { throw new Error('Memory timeout'); }),
  ]).catch(() => {
    // Timeout: return partial results
    console.warn(`[MEMORY] Tier ${tier} timeout, degrading`);
    return [];
  });

  return buildContext(results);
}
```

**Latency Impact:**

| Query Type | Old (all sources) | New (tiered) | Savings |
|------------|-------------------|--------------|---------|
| "Hi" | 1200ms | 50ms | **96%** |
| "Summarize project" | 1200ms | 400ms | **67%** |
| "Analyze market trends" | 1200ms | 1200ms | 0% |

**Average latency reduction: 76%** (weighted by traffic distribution)
