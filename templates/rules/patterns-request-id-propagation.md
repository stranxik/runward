---
title: Request ID Propagation
impact: MEDIUM
impactDescription: Enables end-to-end request tracing across services
tags: [patterns, observability, debugging]
noTerritory: The identifier must survive middleware, logger, outbound HTTP calls, LLM metadata and SQL comments alike, so it is verified end to end across the call chain rather than in one class of files.
---

## Request ID Propagation

Propagate a unique request ID through all services for end-to-end tracing.

**Implementation:**

```typescript
// src/lib/context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string {
  return getRequestContext()?.requestId || 'no-request-id';
}

// Middleware
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  const context: RequestContext = {
    requestId,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
    startTime: Date.now(),
  };

  // Set response header
  res.setHeader('x-request-id', requestId);

  // Run handler within context
  asyncLocalStorage.run(context, () => next());
}
```

**Logger Integration:**

```typescript
// src/lib/logger.ts
import { getRequestContext } from './context';

class Logger {
  private log(level: string, message: string, data: object = {}) {
    const ctx = getRequestContext();

    console.log(JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      tenantId: ctx?.tenantId,
      ...data,
    }));
  }

  info(message: string, data?: object) { this.log('info', message, data); }
  error(message: string, data?: object) { this.log('error', message, data); }
  // ...
}

export const logger = new Logger();
```

**Propagate to External Services:**

```typescript
// Include requestId in external API calls
async function callExternalService(endpoint: string, data: object) {
  const requestId = getRequestId();

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,  // Propagate to external service
    },
    body: JSON.stringify(data),
  });
}

// Include in LLM metadata
async function callLLM(request: LLMRequest) {
  const requestId = getRequestId();

  return model.complete({
    ...request,
    metadata: {
      user_id: getRequestContext()?.userId,
      request_id: requestId,  // Appears in the provider dashboard
    },
  });
}
```

**Database Query Tagging:**

```typescript
// Tag queries with request ID for debugging
async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const requestId = getRequestId();

  // Add comment with request ID (visible in slow query logs)
  const taggedSql = `/* requestId=${requestId} */ ${sql}`;

  return db.query(taggedSql, params);
}
```

**Full Request Trace Example:**

```
[2025-01-24T10:30:00.000Z] {"level":"info","message":"Request started","requestId":"abc-123","path":"/api/chat"}
[2025-01-24T10:30:00.050Z] {"level":"info","message":"Memory retrieval","requestId":"abc-123","memories":5}
[2025-01-24T10:30:00.100Z] {"level":"info","message":"LLM request started","requestId":"abc-123","model":"balanced"}
[2025-01-24T10:30:02.500Z] {"level":"info","message":"LLM request completed","requestId":"abc-123","tokens":1234}
[2025-01-24T10:30:02.550Z] {"level":"info","message":"Request completed","requestId":"abc-123","duration":2550}
```
