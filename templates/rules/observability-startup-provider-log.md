---
title: Log Providers at Startup
impact: LOW
impactDescription: Simplifies debugging by showing configuration at startup
tags: [observability, configuration, debugging]
appliesTo: [**/startup.ts, **/app.ts, **/src/index.ts]
governs: [startup]
---

## Log Providers at Startup

Always log the detected configuration at application startup for debugging.

**Implementation:**

```typescript
// src/lib/startup.ts
import { features } from './features';
import { llmConfig } from './providers/llm-provider';
import { embeddingConfig } from './providers/embedding-provider';

export function logStartupConfig() {
  console.info('═'.repeat(60));
  console.info('[STARTUP] Application Configuration');
  console.info('═'.repeat(60));

  console.info('[CONFIG] Deployment mode:', features.mode);

  console.info('[CONFIG] Providers:', {
    llm: {
      provider: llmConfig.provider,
      model: llmConfig.model,
      // Don't log API keys
    },
    embeddings: {
      provider: embeddingConfig.provider,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    },
  });

  console.info('[CONFIG] Features:', {
    auth: features.auth.provider,
    search: features.search.enabled ? features.search.provider : 'disabled',
    memory: features.memory.enabled ? features.memory.provider : 'disabled',
    realtime: features.realtime.enabled,
    presence: features.realtime.presence,
  });

  console.info('[CONFIG] Database:', {
    postgres: !!process.env.DATABASE_URL,
    graph: !!process.env.GRAPH_URI,
    redis: !!process.env.REDIS_URL,
  });

  console.info('═'.repeat(60));
}

// Call at startup
// app.ts or index.ts
logStartupConfig();
```

**Output Example:**

```
════════════════════════════════════════════════════════════
[STARTUP] Application Configuration
════════════════════════════════════════════════════════════
[CONFIG] Deployment mode: full
[CONFIG] Providers: {
  llm: { provider: 'configured-provider', model: 'mid-tier-model' },
  embeddings: { provider: 'configured-provider', model: 'embedding-model', dimensions: 1536 }
}
[CONFIG] Features: {
  auth: 'configured-provider',
  search: 'web-search',
  memory: 'configured-provider',
  realtime: true
}
[CONFIG] Database: { postgres: true, graph: true, redis: true }
════════════════════════════════════════════════════════════
```

**Environment Validation:**

```typescript
function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  // At least one LLM provider
  const hasLLM = [
    'MODEL_GATEWAY_URL',
    'MODEL_PROVIDER',
    'AWS_ACCESS_KEY_ID',
    'MODEL_API_KEY',
    'EMBEDDING_API_KEY',
  ].some(key => !!process.env[key]);

  if (!hasLLM) {
    errors.push('No LLM provider configured');
  }

  // Warnings for missing optional services
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set - using in-memory state (not scalable)');
  }

  // Log results
  if (warnings.length > 0) {
    console.warn('[STARTUP] Warnings:', warnings);
  }

  if (errors.length > 0) {
    console.error('[STARTUP] Configuration errors:', errors);
    process.exit(1);
  }
}

// Run before startup
validateEnvironment();
logStartupConfig();
```
