---
title: Pre-Production Observability Checklist
noAsi: observability readiness, not an attack category. Detection of a misbehaving agent rests on the governance rules that declare what must be observable.
impact: HIGH
impactDescription: Ensures you can monitor and debug production issues
tags: [checklist, observability, production, deployment]
noTerritory: A pre-production checklist is a gate on the system as a whole, not on a class of files: it is confronted at the crossing, not while editing any particular path.
---

## Pre-Production Observability Checklist

Observability items to validate before production deployment.

```
OBSERVABILITY CHECKLIST
├── [ ] Structured logs (JSON format)
├── [ ] Request ID propagated through all services
├── [ ] LLM metrics tracked (tokens, cost, latency, model)
├── [ ] Error rates tracked and alerted
├── [ ] Alerts configured for critical metrics
├── [ ] Dashboard for operational monitoring
├── [ ] Log retention policy defined
└── [ ] Sensitive data redacted from logs
```

**Structured Logging:**

```typescript
// BAD: Incorrect: unstructured logs
console.log(`User ${userId} created project ${projectId}`);

// GOOD: Correct: structured JSON
logger.info('Project created', {
  userId,
  projectId,
  tenantId,
  requestId: ctx.requestId,
  duration: Date.now() - start,
});
```

**Request ID Propagation:**

```typescript
// Middleware to create/propagate request ID
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  // Add to async local storage for logging
  asyncLocalStorage.run({ requestId }, next);
}

// All logs include requestId
const logger = {
  info(message: string, data: object) {
    const ctx = asyncLocalStorage.getStore();
    console.log(JSON.stringify({
      level: 'info',
      message,
      requestId: ctx?.requestId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
};
```

**LLM Metrics:**

```typescript
// Track every LLM call
interface LLMMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  estimatedCost: number;
}

function logLLMMetrics(metrics: LLMMetrics) {
  logger.info('LLM request completed', metrics);

  // Send to metrics service
  telemetry.record('llm_request', {
    ...metrics,
    timestamp: Date.now(),
  });
}
```

**Alert Configuration:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 5% over 5 min | Page on-call |
| LLM latency P95 | > 5s | Investigate |
| Cache hit rate | < 50% | Investigate |
| Cost per request | > $0.10 | Review routing |
