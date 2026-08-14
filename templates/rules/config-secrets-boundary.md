---
title: Secrets at the Network Boundary, Never in the Model
impact: CRITICAL
asi: [ASI03, ASI10]
phases: [floor, govern]
impactDescription: Makes secret disclosure structurally impossible by keeping the real key out of the model and the domain
signature: secret|vault
nonScope: A matching signature proves a "secret" or "vault" token appears in the cited evidence; it does not prove the real key stays out of the model and the domain, or that the boundary is enforced on every read path.
tags: [security, secrets, configuration, boundary]
appliesTo: [**/config/**, **/config.ts, **/*.env, **/*.env.*]
governs: [secret-boundary]
---

## Secrets at the Network Boundary, Never in the Model

> **A secret the model never saw cannot be disclosed.** This guard is structural, not behavioural, and it strips prompt injection of its most coveted loot.

Secrets and sensitive data are isolated behind typed configuration, never in the domain. One notch further for runtime secrets: the secret never crosses the boundary of the model or of the execution environment. The agent handles only a *substitute*; the real key is attached by infrastructure at the network boundary, toward the only explicitly authorised destinations, and is replaceable without redeployment.

**Incorrect:**

```typescript
// Key in code, in the domain, and within reach of the model's context.
const MODEL_KEY = "sk-live-abc123";                  // BAD: in code
function callModel(prompt: string) {
  return fetch(GW, { headers: { Authorization: `Bearer ${MODEL_KEY}` }, ... });
}
// BAD: if the key sits in config the agent reads, an injection can ask for it.
```

**Correct:**

```typescript
// Domain knows a port, not a key. The adapter calls a gateway; the real
// credential is injected by infrastructure at the egress boundary.
interface ModelPort { complete(req: Req): Promise<Res>; }

// adapter: no secret in scope of the model's reasoning
class GatewayModelAdapter implements ModelPort {
  // calls the internal gateway URL; the platform attaches the real key
  // at the network edge toward the allowed destination only.
}
```

**Configuration discipline:**

- Secrets live in `.env` (git-ignored), read once into typed config, never committed, never logged.
- The domain depends on ports, never on environment variables.
- Egress credentials are attached by the platform at the network boundary, not carried through application code.
- Prefer rotation without redeployment (the substitute stays stable, the key behind it rotates).

**Transport, strict by default:** for Postgres/Neon, pin `sslmode=verify-full` (strict verification of both certificate and DNS name) so you do not depend on a driver's future default:

```
postgresql://USER:PASS@HOST/DB?sslmode=verify-full&channel_binding=require
```

**Checklist:**

- [ ] No secret literal anywhere in source or logs.
- [ ] The real egress key is attached at the network boundary, not in app code.
- [ ] The model's context never contains a usable credential, only a substitute.
- [ ] DB connection string pins `sslmode=verify-full`.
