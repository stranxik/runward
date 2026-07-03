---
title: Distributed Rate Limiting
impact: HIGH
impactDescription: Enables consistent rate limiting across multiple instances
tags: [scaling, rate-limiting, redis, architecture]
---

## Distributed Rate Limiting

In-memory rate limiting fails with multiple instances. Use Redis for consistent limits.

**The Problem:**

With 3 instances and 100 req/min limit:
- User can make 100 requests to each instance
- Actual rate: 300 req/min (3x limit bypass)

**Incorrect:**

```typescript
// In-memory - each instance has its own counter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const record = rateLimits.get(userId);
  // BAD: Only counts requests to this instance
}
```

**Correct:**

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

interface RateLimitConfig {
  windowMs: number;    // Time window in ms
  maxRequests: number; // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,    // 1 minute
  maxRequests: 100,
};

async function checkRateLimit(
  key: string,
  config = defaultConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowMs)}`;

  const multi = redis.multi();
  multi.incr(windowKey);
  multi.pttl(windowKey);

  const results = await multi.exec();
  const count = results![0][1] as number;
  const ttl = results![1][1] as number;

  // Set expiry on first request
  if (count === 1) {
    await redis.pexpire(windowKey, config.windowMs);
  }

  const remaining = Math.max(0, config.maxRequests - count);
  const resetIn = ttl > 0 ? ttl : config.windowMs;

  return {
    allowed: count <= config.maxRequests,
    remaining,
    resetIn,
  };
}

// Middleware usage
async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id || req.ip;
  const result = await checkRateLimit(`user:${userId}`);

  // Set standard rate limit headers
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + result.resetIn / 1000));

  if (!result.allowed) {
    res.setHeader('Retry-After', Math.ceil(result.resetIn / 1000));
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}
```

**Sliding Window Algorithm:**

For more precise rate limiting, use sliding window:

```typescript
async function slidingWindowRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Remove old entries and add new one atomically
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.expire(key, Math.ceil(windowMs / 1000));

  const results = await multi.exec();
  const count = results![2][1] as number;

  return count <= maxRequests;
}
```

**Rate Limit Tiers:**

| Tier | Limit | Use Case |
|------|-------|----------|
| Anonymous | 10/min | Public endpoints |
| Free | 60/min | Authenticated users |
| Pro | 300/min | Paid users |
| API | 1000/min | API keys |
