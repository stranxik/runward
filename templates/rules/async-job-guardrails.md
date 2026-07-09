---
title: Background Job Guardrails (Retry, Idempotency, Bounded Concurrency, Job Observability)
impact: HIGH
asi: [ASI08]
phases: [govern]
impactDescription: The four non-negotiables of any background job — bounded retry per step, idempotency under concurrency, capped and partitioned concurrency, and queue lag plus failure rate as first-class metrics
tags: [async, jobs, idempotency, concurrency, retry, observability]
---

## Background Job Guardrails

> **A background job without guardrails is an incident on a delay.**

Post-turn pipelines and maintenance crons run off the hot path, where nobody is watching. That is exactly why they need harder guardrails than the interactive turn, not softer ones. Four are non-negotiable — all four, on every job:

1. **Bounded retry, per step.** Each step retries independently, with backoff and a hard cap. Exhausted jobs park in a dead-letter state for inspection; nothing retries forever.
2. **Idempotency.** Every real queue delivers at-least-once, so duplicates are a certainty, not an edge case. Each job carries an idempotency key derived from its cause (`extract-facts:turn-123`), and execution begins with an **atomic claim** — a unique-constraint insert, never check-then-insert — so concurrent deliveries collapse to one execution.
3. **Bounded concurrency.** A global cap protects downstream systems (the database, the model provider); a per-user partition keeps one heavy tenant from starving everyone else.
4. **Job observability.** Queue lag and failure rate are first-class metrics with alerts, at the same severity as user-facing latency. A queue that grows silently for three days is an outage you learn about from the user.

**Incorrect:**

```typescript
// No guardrails: each absence is a distinct production incident.
queue.on('job', async (job) => {
  while (true) {                       // BAD: unbounded retry storm
    try {
      await handlers[job.type](job);   // BAD: no idempotency key —
      break;                           //      redelivery = double-processing
    } catch { /* retry immediately */ }
  }
});

await Promise.all(pending.map(run));   // BAD: unbounded fan-out melts the DB
// BAD: and no metrics — the queue can rot for days unseen
```

**Correct:**

```typescript
async function runJob(job: Job): Promise<void> {
  // 1. Idempotency: atomic claim — a concurrent duplicate loses the
  //    insert itself, not a racy check that both callers pass.
  const claimed = await db.tryInsert('job_executions', {
    key: job.idempotencyKey,          // e.g. 'extract-facts:turn-123'
    claimedAt: new Date(),
  });
  if (!claimed) {
    metrics.increment('jobs.deduplicated', { type: job.type });
    return;
  }

  // 2. Bounded concurrency: global cap plus per-user partition.
  const slot = await semaphore.acquire({
    global: 32,
    partition: { key: job.userId, limit: 2 },
  });

  const startedAt = Date.now();
  try {
    // 3. Bounded retry with backoff; then dead-letter, never forever.
    await withRetry(() => handlers[job.type](job), {
      maxRetries: 3,
      backoff: 'exponential',
    });
    metrics.histogram('jobs.duration_ms', Date.now() - startedAt, { type: job.type });
  } catch (error) {
    await deadLetter.park(job, error);   // inspectable, replayable
    metrics.increment('jobs.failed', { type: job.type });
  } finally {
    slot.release();
  }
}

// 4. Job observability: lag and failure rate are first-class signals.
setInterval(async () => {
  metrics.gauge('jobs.queue_lag_seconds', await queue.oldestPendingAgeSeconds());
  metrics.gauge('jobs.failure_rate_15m', await queue.failureRate({ window: '15m' }));
}, 30_000);
// Alert: queue_lag > 300s or failure_rate > 5% —
// same severity as user-facing latency.
```

**Why this matters:**

- **At-least-once is the contract** of every production queue. Without the atomic idempotency claim, the same fact gets extracted twice, the same reminder fires twice, the same erasure runs half twice — and under concurrency, a check-then-insert passes for both callers.
- **Unbounded retry is a self-inflicted outage**: a failing provider gets hammered by its own victims, and the queue amplifies the incident instead of absorbing it.
- **Unbounded fan-out** turns a backlog into a database or provider meltdown, and one bulk-importing tenant into everyone's problem.
- **Invisible background failure degrades the system in a way nobody can date**: memory quietly stops updating, summaries go stale, and by the time answers feel wrong the cause is weeks old. Queue lag and failure rate make the rot visible the hour it starts.

**Checklist:**

- [ ] Every step has bounded retry with backoff; exhausted jobs park in a dead-letter state, never loop forever.
- [ ] Every job carries an idempotency key derived from its cause; the claim is atomic and holds under concurrent delivery.
- [ ] Concurrency is capped globally and partitioned per user or tenant.
- [ ] Queue lag and failure rate are emitted and alerted on, at the same severity as user-facing metrics.
- [ ] Dead-lettered jobs are inspectable and replayable after the cause is fixed.
