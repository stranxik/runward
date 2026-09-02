---
title: Config Typing with Zod
phases: [floor]
impact: MEDIUM
impactDescription: Makes configuration type-safe and validated once at the boundary, so the rest of the system trusts it
tags: [configuration, typescript, validation]
appliesTo: [**/config/**, **/config.ts]
governs: [configuration]
---

## Config Typing with Zod

Type and validate all configuration with Zod once, at startup, at the boundary. The domain then depends on a typed `Config` object, never on raw `process.env`. Secrets are read here and nowhere else (see *Secrets at the Network Boundary*).

> **Parse, do not scatter `process.env` across the codebase.** One schema, one validation, one typed object.

**Implementation:**

```typescript
// src/config.ts
import { z } from "zod";

const ConfigSchema = z.object({
  env: z.enum(["development", "production", "test"]),
  port: z.coerce.number().positive().default(3000),

  // Model provider resolved at the boundary, behind a port.
  model: z.object({
    provider: z.string(),                 // open string, not a vendor enum
    gatewayUrl: z.string().url().optional(),
    model: z.string(),
  }),

  // Database of record (required). Pin strict TLS.
  database: z.object({
    url: z.string().url(),                 // ...?sslmode=verify-full&channel_binding=require
    poolSize: z.coerce.number().positive().default(20),
  }),

  // Optional services: present or absent, never crashing (graceful degradation).
  optional: z.object({
    search: z.boolean().default(false),
    memory: z.boolean().default(false),
    telemetry: z.boolean().default(false),
  }),

  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse({
  env: process.env.NODE_ENV ?? "development",
  port: process.env.PORT,
  model: {
    provider: process.env.MODEL_PROVIDER ?? "gateway",
    gatewayUrl: process.env.MODEL_GATEWAY_URL,
    model: process.env.MODEL ?? "",
  },
  database: { url: process.env.DATABASE_URL, poolSize: process.env.DB_POOL_SIZE },
  optional: {
    search: !!process.env.SEARCH_API_KEY,
    memory: !!process.env.MEMORY_URL,
    telemetry: !!process.env.TELEMETRY_TOKEN,
  },
  logLevel: process.env.LOG_LEVEL,
});
```

**Discipline:**

- Provider fields are open strings, not vendor enums. The set of providers is not part of your contract; the port is. Adding a provider must not change this schema.
- Validation happens once; a malformed required value fails startup loud and early (fail fast). Optional services resolve to a boolean and degrade (fail-open) when absent.
- The domain imports `config` (typed), never `process.env`. Secrets never travel further than this boundary.

**Usage:**

```typescript
import { config } from "@/config";   // fully typed, already validated
if (config.optional.search) { /* TypeScript knows the shape */ }
```
