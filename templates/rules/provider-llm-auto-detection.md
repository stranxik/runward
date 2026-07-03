---
title: Model Provider as an Adapter (Detected, Never Hardcoded)
impact: CRITICAL
impactDescription: Keeps the model behind a port so the provider can change by configuration without touching the core
tags: [provider, llm, embeddings, ports, configuration, portability]
---

## Model Provider as an Adapter

> **The model is rented; the architecture is owned. So the model sits behind a port, like any other external service.**

The core depends on a `ModelPort` (and, if used, an `EmbeddingPort`), never on a vendor SDK. Which provider answers is a configuration concern resolved at the boundary, by detecting available credentials. The same core runs against any provider, a gateway, a local model, or a mock, with no code change.

**Incorrect:**

```typescript
// Vendor hardcoded into reachable code; swapping providers is a rewrite.
import VendorSDK from "@some-vendor/llm-sdk";
const client = new VendorSDK({ apiKey: process.env.VENDOR_API_KEY! }); // BAD: a vendor wired into the core
```

**Correct:**

```typescript
// 1. The core knows a port, nothing else.
interface ModelPort {
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

// 2. The provider is resolved at the boundary from available config.
type ModelConfig = { provider: string; gatewayUrl?: string; model: string };

function resolveModelProvider(): ModelConfig {
  // Prefer a gateway (one egress, one place to attach the real key), then direct.
  if (env.MODEL_GATEWAY_URL) return { provider: "gateway", gatewayUrl: env.MODEL_GATEWAY_URL, model: env.MODEL };
  if (env.MODEL_PROVIDER)    return { provider: env.MODEL_PROVIDER, model: env.MODEL };
  throw new ConfigError("No model provider configured (set MODEL_GATEWAY_URL or MODEL_PROVIDER).");
}

// 3. One adapter per provider implements the port. The core never sees the difference.
class GatewayModelAdapter implements ModelPort { /* ... */ }
class MockModelAdapter implements ModelPort { /* deterministic, for tests and the floor */ }
```

**Why a gateway is the sober default:** a single egress point is where the real credential is attached by infrastructure (see *Secrets at the Network Boundary*), where residency and fallback live, and where you swap providers without redeploying the core.

**Embeddings are a separate port.** The embedding provider is detected the same way and is independent of the model provider; do not assume one implies the other.

**Checklist:**

- [ ] No vendor SDK imported from the core; only the adapter imports it.
- [ ] Provider resolved at the boundary from config, with a clear error if nothing is set.
- [ ] A deterministic mock adapter exists for tests and the offline floor.
- [ ] Embeddings have their own port, resolved independently.
