---
title: Externalize State for Scaling
noAsi: horizontal-scaling prerequisite; the confidentiality of externalized state is governed by the data rules.
impact: CRITICAL
impactDescription: Enables horizontal scaling by removing in-process state dependencies
tags: [scaling, architecture, redis, state-management]
noTerritory: Externalised state is a property of the whole system: any module holding an in-process Map can break horizontal scaling, so no path selects the code this rule governs.
---

## Externalize State for Scaling

> **Scaling ≠ adding instances. Scaling = externalized state.**

In-memory state prevents horizontal scaling. Each instance has its own copy, leading to inconsistencies.

**Incorrect:**

```typescript
// In-memory state - works for single instance only
const rateLimitStore = new Map<string, RateLimitData>();
const sessionStore = new Map<string, SessionData>();
const idempotencyStore = new Map<string, IdempotencyRecord>();

function rateLimit(userId: string): boolean {
  const data = rateLimitStore.get(userId);  // BAD: Instance-local
  // ...
}
```

**Correct:**

```typescript
// External state - works for any number of instances
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function rateLimit(userId: string): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 60);  // 1 minute window
  }

  return current <= 100;  // 100 requests per minute
}
```

**State Migration Table:**

| Component | Single Instance | Multi Instance |
|-----------|-----------------|----------------|
| Token cache | `Map<>` OK | Redis with TTL |
| Rate limiting | In-memory OK | Redis distributed |
| Session state | In-memory OK | Redis or a shared store |
| Locks | Not needed | Redis distributed lock |
| Idempotency | `Map<>` OK | Redis with TTL |

**Files to Audit:**

```typescript
// Common patterns to find and migrate
middleware.ts      rateLimitStore: Map<string, RateLimitData>
middleware.ts      idempotencyStore: Map<string, IdempotencyRecord>
service.ts         sessionStore: Map<string, SessionData>
import.ts          importProgress: Map<string, ImportProgressRecord>
export.ts          exportProgress: Map<string, ExportProgressRecord>
```

**Scaling Checklist:**

```
PRE-REQUISITES
├── [ ] In-memory Maps identified
├── [ ] Rate limiting ready for Redis
├── [ ] DB connection pooling configured
├── [ ] Multi-tenant isolation OK
└── [ ] Healthcheck + readiness probe

MIGRATION (when multi-instance needed)
├── [ ] Rate limiting → Redis
├── [ ] Session state → Redis
├── [ ] Distributed locks → Redis
└── [ ] Load tests validated
```
