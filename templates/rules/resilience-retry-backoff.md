---
title: LLM Retry with Exponential Backoff
impact: HIGH
phases: [govern]
impactDescription: Handles transient LLM failures gracefully without overwhelming the API
tags: [resilience, llm, retry, error-handling]
---

## LLM Retry with Exponential Backoff

LLM APIs experience rate limits and transient errors. Implement retry with exponential backoff.

**Incorrect:**

```typescript
// No retry - single failure = user error
const response = await model.complete({...});

// Or: immediate retry flood
while (retries < 3) {
  try {
    return await model.complete({...});
  } catch {
    retries++;  // BAD: No delay
  }
}
```

**Correct:**

```typescript
// src/lib/resilience/retry.ts
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['rate_limit_error', 'overloaded_error', 'api_error'],
};

function isRetryable(error: unknown, retryableErrors: string[]): boolean {
  if (error instanceof Error) {
    return retryableErrors.some(e => error.message.includes(e));
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withLLMRetry<T>(
  fn: () => Promise<T>,
  config = defaultConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }

      // Don't delay after last attempt
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.initialDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        console.warn(`[LLM] Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

// Usage
const response = await withLLMRetry(() =>
  model.complete({
    model: 'mid-tier-model',
    messages,
  })
);
```

**Retry Delays:**

| Attempt | Delay | Total Wait |
|---------|-------|------------|
| 1 | 1000ms | 1s |
| 2 | 2000ms | 3s |
| 3 | 4000ms | 7s |

**Retryable vs Non-Retryable:**

| Retryable | Non-Retryable |
|-----------|---------------|
| `rate_limit_error` | `invalid_request_error` |
| `overloaded_error` | `authentication_error` |
| `api_error` | `invalid_api_key` |
| Network timeouts | Validation errors |
