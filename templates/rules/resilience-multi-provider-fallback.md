---
title: Multi-Provider Fallback
impact: HIGH
impactDescription: Ensures LLM availability by falling back to alternative providers
tags: [resilience, llm, providers, availability]
---

## Multi-Provider Fallback

Configure fallback providers to handle outages. If primary provider fails, automatically try secondary.

**Model gateway configuration (one option):**

```yaml
# gateway_config.yaml
model_list:
  - model_name: app-fast
    gateway_params:
      model: small-fast-model
    fallbacks:
      - alt-small-model

  - model_name: app-balanced
    gateway_params:
      model: mid-tier-model
    fallbacks:
      - alt-mid-model

  - model_name: app-deep
    gateway_params:
      model: top-tier-model
    fallbacks:
      - alt-mid-model  # No Deep equivalent

router_settings:
  retry_policy:
    num_retries: 3
    backoff_factor: 2
```

**Manual Fallback (without a model gateway):**

```typescript
// src/lib/providers/llm-client.ts
interface LLMClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

const providers: LLMClient[] = [
  new PrimaryModelClient(),
  new SecondaryModelClient(),
  new TertiaryModelClient(),
];

async function completeWithFallback(
  request: CompletionRequest
): Promise<CompletionResponse> {
  let lastError: Error;

  for (const provider of providers) {
    try {
      return await provider.complete(request);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[LLM] Provider failed, trying next:`, {
        provider: provider.constructor.name,
        error: lastError.message,
      });
    }
  }

  throw new Error(`All LLM providers failed. Last error: ${lastError!.message}`);
}
```

**Provider Priority:**

| Priority | Provider | Notes |
|----------|----------|-------|
| 1 | Primary provider | best measured quality |
| 2 | Secondary provider | availability fallback |
| 3 | Tertiary provider | last resort |
| 4 | Local or offline | development, air-gapped |

**When to use each approach:**

- **a model gateway**: Production, complex routing, multiple providers
- **Manual fallback**: Simple apps, fewer dependencies
- **Single provider**: Development, prototyping

**Monitoring:**

```typescript
// Track fallback usage
console.info('[LLM] Request completed', {
  primaryProvider: 'primary',
  usedProvider: response.provider,  // May differ if fallback used
  fallbackUsed: response.provider !== 'primary',
});
```
