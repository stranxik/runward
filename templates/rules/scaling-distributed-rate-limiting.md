---
title: Distributed Rate Limiting
noPhase: Applies only at the multi-instance switch, which is an iteration trigger traced by an ADR — before that switch a mission has nothing honest to point at
impact: HIGH
asi: [ASI08, ASI10]
impactDescription: Enables consistent rate limiting across multiple instances
tags: [scaling, rate-limiting, redis, architecture]
noTerritory: The rule constrains where the counter lives — shared across instances, never in-process — a property of every path that counts a request rather than a class of files.
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

// INCR and PEXPIRE must be atomic. If the process crashes between the
// INCR and a separate PEXPIRE call, the key survives with no TTL and the
// counter never resets: that user is rate-limited forever. A Lua script
// runs both as one atomic operation. (Alternative without Lua:
// `SET key 0 PX windowMs NX` to create the key with its TTL, then INCR.)
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

async function checkRateLimit(
  key: string,
  config = defaultConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowMs)}`;

  const [count, ttl] = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    windowKey,
    config.windowMs
  )) as [number, number];

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
  res.setHeader('X-RateLimit-Limit', defaultConfig.maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + result.resetIn / 1000));

  if (!result.allowed) {
    res.setHeader('Retry-After', Math.ceil(result.resetIn / 1000));
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}
```

**Fixed-window caveat — 2x burst at the boundary:**

The fixed-window counter above lets a client burst up to **2x the limit** across a window boundary: 100 requests in the last second of one window plus 100 in the first second of the next is 200 requests in two seconds, all allowed. If your downstream cannot absorb that burst, use the sliding-window variant below.

**Sliding Window Algorithm:**

For more precise rate limiting (no boundary burst), use sliding window:

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
