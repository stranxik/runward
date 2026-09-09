---
title: Pre-Production Resilience Checklist
phases: [govern]
requires: junit
impact: CRITICAL
asi: [ASI08]
impactDescription: Ensures application handles failures gracefully in production
tags: [checklist, resilience, production, deployment]
noTerritory: A pre-production checklist is a gate on the system as a whole, not on a class of files: it is confronted at the crossing, not while editing any particular path.
---

## Pre-Production Resilience Checklist

Resilience items that MUST be validated before any production deployment.

```
RESILIENCE CHECKLIST
├── [ ] LLM retry with exponential backoff
├── [ ] Timeout on ALL external requests (LLM, APIs, DB)
├── [ ] Healthcheck endpoint (/health or /api/health)
├── [ ] Readiness probe (for Kubernetes)
├── [ ] Graceful shutdown (handle SIGTERM)
├── [ ] Fallback providers configured (a model gateway or manual)
├── [ ] Circuit breaker for flaky services
├── [ ] Fail-open for non-critical services
└── [ ] Error boundaries in UI (React)
```

**Incorrect:**

```typescript
// No timeout, no retry
const response = await fetch(externalApi);  // BAD: Can hang forever

// No graceful shutdown
process.on('SIGTERM', () => process.exit(0));  // BAD: Drops in-flight requests
```

**Correct:**

```typescript
// Timeout on external calls
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(externalApi, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}

// Graceful shutdown
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  console.info('[SHUTDOWN] Received SIGTERM, starting graceful shutdown');
  isShuttingDown = true;

  // Stop accepting new requests
  server.close();

  // Wait for in-flight requests (max 30s)
  await Promise.race([
    waitForInflightRequests(),
    sleep(30000),
  ]);

  // Close database connections
  await db.destroy();

  console.info('[SHUTDOWN] Graceful shutdown complete');
  process.exit(0);
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness probe (checks dependencies)
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});
```

**LLM Retry Configuration:**

```typescript
const LLM_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['rate_limit_error', 'overloaded_error', 'api_error'],
};
```
