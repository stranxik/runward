---
title: Database Connection Pooling
impact: MEDIUM
impactDescription: Prevents connection exhaustion under load
tags: [scaling, database, performance, configuration]
noTerritory: A pool is a per-process resource — created once, drained on SIGTERM, sized against the instance count — so the rule governs a startup and shutdown behaviour of every process that talks to the database, not a class of files any path selects.
---

## Database Connection Pooling

Configure connection pools to prevent exhaustion under load. Each instance needs its own pool.

**The Problem:**

Without pooling:
- Each request opens a new connection
- Connections are slow to establish
- Database has limited connections
- Under load: "too many connections" errors

**Incorrect:**

```typescript
// New connection per request
async function query(sql: string) {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();  // BAD: Slow, wasteful
  const result = await client.query(sql);
  await client.end();
  return result;
}
```

**Correct:**

```typescript
// PostgreSQL with pg-pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Max connections per instance
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
});

// Reuse connections from pool
async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();  // Return to pool, don't close
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});
```

**Pool Sizing Formula:**

```
connections_per_instance = (db_max_connections - reserved) / num_instances

Example:
- PostgreSQL max_connections: 100
- Reserved for admin: 5
- Instances: 4
- Pool size per instance: (100 - 5) / 4 = ~23
```

**Prisma Configuration:**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Connection pool via URL
// DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

**Drizzle Configuration:**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export const db = drizzle(pool);
```

**Monitoring:**

```typescript
// Log pool stats periodically
setInterval(() => {
  console.info('[DB] Pool stats', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 60000);
```

**Common Issues:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| "too many connections" | Pool too large | Reduce max per instance |
| Slow queries | Pool exhausted | Increase max or optimize queries |
| Connection timeout | Pool full, queries slow | Add connection_timeout, optimize |
