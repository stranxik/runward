---
title: LLM Metrics Tracking
impact: MEDIUM
impactDescription: Enables cost monitoring, performance optimization, and anomaly detection
tags: [observability, llm, metrics, cost]
---

## LLM Metrics Tracking

Track comprehensive metrics for every LLM call to enable cost control and optimization.

**Essential Metrics:**

```typescript
interface LLMMetrics {
  // Request metadata
  requestId: string;
  userId: string;
  model: string;
  provider: string;

  // Token usage
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;

  // Performance
  latencyMs: number;
  timeToFirstToken?: number;

  // Cost
  estimatedCost: number;

  // Context
  complexity: string;
  cached: boolean;
  retries: number;

  // Timestamp
  timestamp: Date;
}
```

**Implementation:**

```typescript
// LLM wrapper with metrics
async function completeLLM(request: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();
  const metrics: Partial<LLMMetrics> = {
    requestId: request.requestId,
    userId: request.userId,
    model: request.model,
    provider: llmConfig.provider,
    complexity: request.complexity,
    timestamp: new Date(),
    retries: 0,
  };

  try {
    const response = await withLLMRetry(
      () => llmClient.complete(request),
      { onRetry: () => metrics.retries!++ }
    );

    // Extract usage
    metrics.inputTokens = response.usage.input_tokens;
    metrics.outputTokens = response.usage.output_tokens;
    metrics.cacheReadTokens = response.usage.cache_read_input_tokens || 0;
    metrics.cacheWriteTokens = response.usage.cache_creation_input_tokens || 0;
    metrics.latencyMs = Date.now() - start;
    metrics.cached = metrics.cacheReadTokens > 0;
    metrics.estimatedCost = calculateCost(metrics as LLMMetrics);

    // Log metrics
    logger.info('LLM request completed', metrics);

    // Send to metrics service
    telemetry.record('llm_request', metrics);

    return response;
  } catch (error) {
    logger.error('LLM request failed', {
      ...metrics,
      error: error.message,
      latencyMs: Date.now() - start,
    });
    throw error;
  }
}

// Cost calculation
function calculateCost(metrics: LLMMetrics): number {
  const pricing = MODEL_PRICING[metrics.model];

  // Cache read tokens are discounted (90% off on some providers)
  const effectiveInputTokens =
    metrics.inputTokens - metrics.cacheReadTokens * 0.9;

  return (
    (effectiveInputTokens * pricing.input +
    metrics.outputTokens * pricing.output) / 1_000_000
  );
}
```

**Aggregated Metrics:**

```typescript
// Daily cost aggregation
interface DailyMetrics {
  date: string;
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  cacheHitRate: number;
  modelBreakdown: Record<string, { requests: number; cost: number }>;
  errorRate: number;
}

async function aggregateDailyMetrics(date: string): Promise<DailyMetrics> {
  const metrics = await db.llmMetrics.findMany({
    where: { date: startOfDay(date) },
  });

  return {
    date,
    totalRequests: metrics.length,
    totalCost: sum(metrics.map(m => m.estimatedCost)),
    avgLatency: avg(metrics.map(m => m.latencyMs)),
    cacheHitRate: metrics.filter(m => m.cached).length / metrics.length,
    modelBreakdown: groupByModel(metrics),
    errorRate: metrics.filter(m => m.error).length / metrics.length,
  };
}
```

**Alert Thresholds:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Cost/day | >$50 | >$100 |
| Error rate | >2% | >5% |
| P95 latency | >5s | >10s |
| Cache hit rate | <50% | <30% |
