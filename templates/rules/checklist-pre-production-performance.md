---
title: Pre-Production Performance Checklist
noAsi: performance readiness; no agentic-security surface.
impact: HIGH
impactDescription: Ensures application performs well under production load
tags: [checklist, performance, production, deployment]
noTerritory: A pre-production checklist is a gate on the system as a whole, not on a class of files: it is confronted at the crossing, not while editing any particular path.
---

## Pre-Production Performance Checklist

Performance items to validate before production deployment.

```
PERFORMANCE CHECKLIST
├── [ ] Prompt caching evaluated — enabled only where measured cost justifies it (see cache-three-tier-architecture: a cost lever, not a principle)
├── [ ] Model routing evaluated — tiered routing (Fast/Balanced/Deep) only on a measured trigger, single tier is the sober default
├── [ ] DB connection pooling configured
├── [ ] DB queries indexed (check slow query log)
├── [ ] Frontend assets optimized (images, bundle) if a UI is served
├── [ ] Code splitting enabled
├── [ ] Bundle size analyzed (<500KB initial — a starting point, not calibrated truth: recalibrate the numeric targets in this checklist against your real traffic)
├── [ ] API response times measured (<200ms P95 for non-LLM)
└── [ ] Load testing completed
```

**Cache Verification:**

```typescript
// Log cache hit rates at startup and periodically
setInterval(() => {
  const stats = cacheStats.get();
  logger.info('Cache statistics', {
    layer1HitRate: stats.layer1.hits / stats.layer1.total,
    layer2HitRate: stats.layer2.hits / stats.layer2.total,
    totalSavings: stats.estimatedSavings,
  });
}, 60000);

// Alert if cache performance degrades
if (stats.layer1HitRate < 0.8) {
  logger.warn('Layer 1 cache hit rate below threshold', { rate: stats.layer1HitRate });
}
```

**Database Performance:**

```typescript
// Enable slow query logging
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// Log slow queries
pool.on('query', (event) => {
  if (event.duration > 100) {  // > 100ms
    logger.warn('Slow query detected', {
      query: event.query.substring(0, 200),
      duration: event.duration,
    });
  }
});
```

**Bundle Analysis:**

```bash
# Analyze bundle size
npm run build -- --analyze

# Check for large dependencies
npx @next/bundle-analyzer
```

**Load Testing:**

```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustain
    { duration: '2m', target: 100 },  // Spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Performance Targets:**

| Metric | Target | Critical |
|--------|--------|----------|
| API response (non-LLM) | <200ms P95 | >500ms |
| LLM response (Fast) | <500ms P95 | >2s |
| LLM response (Balanced) | <2s P95 | >5s |
| Initial bundle size | <500KB | >1MB |
| Cache hit rate (L1) | >80% | <60% |
