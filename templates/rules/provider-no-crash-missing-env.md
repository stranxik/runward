---
title: Graceful Degradation of Optional Services
requires: junit
impact: HIGH
phases: [floor]
asi: [ASI08]
impactDescription: Lets the app start and run wherever it is deployed, enabling features by available config rather than crashing on a missing variable
tags: [provider, configuration, resilience, deployment]
noTerritory: It governs a startup property — which dependencies may halt the boot and which must degrade — verified when the application launches and on every optional service client, not in a folder of files.
---

## Graceful Degradation of Optional Services

> **Required missing: fail fast and loud. Optional missing: disable the feature, keep running.**

The application must start regardless of which optional services are configured. Only truly required dependencies (a database of record, at least one model provider) may stop startup. Everything optional degrades to a sober default.

**Required vs optional:**

| Category | Required (may stop startup) | Optional (must degrade) |
|---|---|---|
| Database of record | `DATABASE_URL` | - |
| Model | at least one provider | a specific provider |
| Search / enrichment | none | its API key |
| Vector / memory store | none | its URL |
| Telemetry sink | none | its token |

**Incorrect:**

```typescript
// Throws at module load for an optional service.
const search = new SearchClient(env.SEARCH_API_KEY!);   // BAD: crashes if absent
```

**Correct:**

```typescript
// Lazy, returns null when unavailable; callers fall back.
let search: SearchClient | null = null;
export function getSearch(): SearchClient | null {
  if (search) return search;
  if (!env.SEARCH_API_KEY) { log.info("[SEARCH] not configured - disabled"); return null; }
  return (search = new SearchClient(env.SEARCH_API_KEY));
}

export async function enrich(q: string): Promise<Result[]> {
  const s = getSearch();
  return s ? s.search(q) : [];          // sober default, not a crash
}
```

**Log the resolved configuration at startup** so the active shape is visible (never log secrets):

```typescript
log.info("[STARTUP] services", {
  database: !!env.DATABASE_URL,
  model: modelConfig.provider,
  search: !!getSearch(),
  memory: !!getMemory(),
});
```

This is the "sober default plus trigger" posture applied to configuration: ship with the minimum that runs everywhere, light up a capability only when its dependency is actually present.

**This is bimodal deployment.** The same binary runs in a *minimal* mode (only required dependencies present) and a *full* mode (every optional dependency present), with the mode resolved by feature detection at startup, not by a separate build. The interface signals what is active rather than failing silently. Minimal mode is what makes the system deployable in a restricted or air-gapped environment without a code change.

**Checklist:**

- [ ] App starts with only the required variables set.
- [ ] Each optional service degrades to a defined fallback, never a crash.
- [ ] Resolved configuration (not secrets) is logged once at startup.
