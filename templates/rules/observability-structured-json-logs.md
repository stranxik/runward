---
title: Structured JSON Logs
impact: MEDIUM
impactDescription: Enables log querying, aggregation, and alerting in production
tags: [observability, logging, production]
noTerritory: Every line of the codebase that emits a log is in scope, so the rule describes a property of all output rather than a class of files.
---

## Structured JSON Logs

Use structured JSON logs for queryable, parseable logging in production.

**Incorrect:**

```typescript
// Unstructured logs - hard to parse and query
console.log(`User ${userId} created project ${projectId} in ${duration}ms`);
console.log('Error:', error.message);
console.log(`Request from ${req.ip} to ${req.path}`);
```

**Correct:**

```typescript
// Structured logger
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

class StructuredLogger {
  private context: Partial<LogEntry> = {};

  child(context: Partial<LogEntry>): StructuredLogger {
    const child = new StructuredLogger();
    child.context = { ...this.context, ...context };
    return child;
  }

  private log(level: LogEntry['level'], message: string, data: object = {}) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    // Redact sensitive fields
    const redacted = this.redactSensitive(entry);

    console.log(JSON.stringify(redacted));
  }

  private redactSensitive(entry: LogEntry): LogEntry {
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    const redacted = { ...entry };

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  debug(message: string, data?: object) { this.log('debug', message, data); }
  info(message: string, data?: object) { this.log('info', message, data); }
  warn(message: string, data?: object) { this.log('warn', message, data); }
  error(message: string, data?: object) { this.log('error', message, data); }
}

export const logger = new StructuredLogger();

// Usage
logger.info('Project created', {
  userId: 'usr_123',
  projectId: 'prj_456',
  duration: 45,
});

// Output:
// {"level":"info","message":"Project created","timestamp":"2025-01-24T10:30:00.000Z","userId":"usr_123","projectId":"prj_456","duration":45}
```

**Request Context Logger:**

```typescript
// Middleware to add request context
function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  const requestLogger = logger.child({
    requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
  });

  req.logger = requestLogger;

  // Log request start
  requestLogger.info('Request started');

  // Log request end
  const start = Date.now();
  res.on('finish', () => {
    requestLogger.info('Request completed', {
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
}
```

**Log Query Examples (the telemetry sink/Datadog):**

```sql
-- Find slow LLM requests
SELECT * FROM logs
WHERE message = 'LLM request completed'
AND duration > 5000
ORDER BY timestamp DESC

-- Error rate by endpoint
SELECT path, COUNT(*) as errors
FROM logs
WHERE level = 'error'
GROUP BY path
ORDER BY errors DESC
```
