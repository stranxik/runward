---
title: Memory Scoring Formula
impact: MEDIUM
impactDescription: Provides optimal memory retrieval ranking
tags: [data, memory, scoring, algorithm]
---

## Memory Scoring Formula

A comprehensive scoring formula for memory retrieval that balances multiple factors.

**Complete Formula:**

```typescript
interface Memory {
  id: string;
  content: string;
  embedding: number[];
  importance: number;       // 0-1, user or system assigned
  accessCount: number;      // Times retrieved
  lastAccessedAt: Date;
  createdAt: Date;
  source: 'user' | 'system' | 'inferred';
  verified: boolean;        // User confirmed accuracy
}

interface ScoringWeights {
  similarity: number;
  recency: number;
  importance: number;
  frequency: number;
  verification: number;
}

const defaultWeights: ScoringWeights = {
  similarity: 0.35,
  recency: 0.25,
  importance: 0.20,
  frequency: 0.10,
  verification: 0.10,
};

function computeMemoryScore(
  memory: Memory,
  queryEmbedding: number[],
  weights = defaultWeights
): number {
  // 1. Semantic similarity (cosine)
  const similarity = cosineSimilarity(memory.embedding, queryEmbedding);

  // 2. Time decay (exponential)
  const daysSinceAccess = (Date.now() - memory.lastAccessedAt.getTime()) / DAY_MS;
  const recency = Math.exp(-daysSinceAccess / 60);  // 60-day half-life

  // 3. Importance (direct from memory)
  const importance = memory.importance;

  // 4. Access frequency (logarithmic, capped)
  const frequency = Math.min(Math.log10(memory.accessCount + 1) / 2, 1);

  // 5. Verification bonus
  const verification = memory.verified ? 1 : 0.5;

  // Weighted combination
  const score =
    similarity * weights.similarity +
    recency * weights.recency +
    importance * weights.importance +
    frequency * weights.frequency +
    verification * weights.verification;

  return score;
}
```

**Context-Aware Weights:**

```typescript
// Adjust weights based on query type
function getWeightsForContext(queryType: string): ScoringWeights {
  switch (queryType) {
    case 'factual':
      // Prioritize verified, important memories
      return {
        similarity: 0.30,
        recency: 0.10,
        importance: 0.25,
        frequency: 0.10,
        verification: 0.25,
      };

    case 'recent':
      // Prioritize recent memories
      return {
        similarity: 0.25,
        recency: 0.40,
        importance: 0.15,
        frequency: 0.10,
        verification: 0.10,
      };

    case 'exploratory':
      // Balance all factors, favor similarity
      return {
        similarity: 0.40,
        recency: 0.20,
        importance: 0.20,
        frequency: 0.10,
        verification: 0.10,
      };

    default:
      return defaultWeights;
  }
}
```

**Cosine Similarity Implementation:**

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
```

**Score Interpretation:**

| Score Range | Interpretation |
|-------------|----------------|
| 0.8 - 1.0 | Highly relevant, should definitely include |
| 0.6 - 0.8 | Relevant, include if space permits |
| 0.4 - 0.6 | Marginally relevant, include for deep queries |
| 0.0 - 0.4 | Low relevance, consider for pruning |
