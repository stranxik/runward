---
title: Retryable vs Non-Retryable Errors
impact: MEDIUM
impactDescription: Prevents wasted retries and ensures quick failure for unrecoverable errors
tags: [resilience, error-handling, llm]
noTerritory: It is an error-classification discipline, valid everywhere an external call fails, with no identifiable class of files.
---

## Retryable vs Non-Retryable Errors

Not all errors should be retried. Distinguishing them prevents wasted time and API calls.

**Error Classification:**

| Retryable (transient) | Non-Retryable (permanent) |
|----------------------|---------------------------|
| `rate_limit_error` | `invalid_request_error` |
| `overloaded_error` | `authentication_error` |
| `api_error` (500s) | `invalid_api_key` |
| Network timeout | `model_not_found` |
| Connection reset | Validation errors |
| `service_unavailable` | `content_policy_violation` |

**Incorrect:**

```typescript
// Retries everything, including permanent errors
async function callLLM(request: Request): Promise<Response> {
  for (let i = 0; i < 3; i++) {
    try {
      return await model.complete(request);
    } catch (error) {
      await sleep(1000 * Math.pow(2, i));  // BAD: Retries invalid_api_key
    }
  }
  throw new Error('Failed after retries');
}
```

**Correct:**

```typescript
const RETRYABLE_ERRORS = new Set([
  'rate_limit_error',
  'overloaded_error',
  'api_error',
  'service_unavailable',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
]);

function isRetryable(error: unknown): boolean {
  if (error instanceof ModelAPIError) {
    // provider SDK specific
    if (error.status === 429) return true;  // Rate limit
    if (error.status >= 500) return true;   // Server error
    return false;  // Client errors (4xx except 429)
  }

  if (error instanceof Error) {
    // Network errors
    return RETRYABLE_ERRORS.has(error.name) ||
           RETRYABLE_ERRORS.has((error as any).code);
  }

  return false;
}

async function callLLM(request: Request): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await model.complete(request);
    } catch (error) {
      lastError = error as Error;

      // Fail fast on permanent errors
      if (!isRetryable(error)) {
        console.error('[LLM] Non-retryable error:', error);
        throw error;
      }

      // Retry with backoff for transient errors
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`[LLM] Retryable error, waiting ${delay}ms:`, error);
      await sleep(delay);
    }
  }

  throw lastError!;
}
```

**HTTP Status Code Guide:**

| Status | Meaning | Retry? |
|--------|---------|--------|
| 400 | Bad Request | No |
| 401 | Unauthorized | No |
| 403 | Forbidden | No |
| 404 | Not Found | No |
| 429 | Rate Limited | **Yes** |
| 500 | Server Error | **Yes** |
| 502 | Bad Gateway | **Yes** |
| 503 | Unavailable | **Yes** |
| 504 | Timeout | **Yes** |
