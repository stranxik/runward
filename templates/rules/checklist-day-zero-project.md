---
title: Day-Zero Project Setup Checklist
noAsi: a setup checklist; each security discipline it lists is a rule of its own and carries its own ASI mapping. Mapping the checklist too would double-count coverage.
impact: CRITICAL
impactDescription: Starts a project on the foundation that prevents costly refactors, with the core engineering disciplines wired from the first commit
tags: [checklist, architecture, setup, project]
noTerritory: A day-zero checklist governs the shape of the whole project at its first commit, so it has no file territory: everything it prescribes does not exist yet when it applies.
---

## Day-Zero Project Setup Checklist

The foundation to lay before the first feature. Sober by default: only what runs everywhere, with the disciplines that are expensive to retrofit wired from commit one.

```
ARCHITECTURE (30 min)
├── [ ] Hexagonal structure (core/, adapters/, infrastructure/)
├── [ ] Ports defined (even if empty); the model is one of them
├── [ ] Config typed and validated once with Zod (no scattered process.env)
├── [ ] Unified error model
└── [ ] Structured JSON logger with request-id propagation

BOUNDARIES (15 min)  [the core disciplines]
├── [ ] Model behind a port, resolved at the boundary (no vendor SDK in core)
├── [ ] Deterministic boundary planned: facts from a store, model writes prose
├── [ ] Optional services degrade gracefully (absent != crash); logged at startup
└── [ ] Secrets read only in typed config; never in code, never in the model

QUALITY (15 min)
├── [ ] Lint + format configured
├── [ ] Pre-commit hooks
├── [ ] Domain test template (the floor's success criterion as a test)
├── [ ] ADR template + first ADRs for structural choices (with revisit triggers)
├── [ ] JOURNAL.md for per-session entries
└── [ ] Minimal README

INFRA (15 min)
├── [ ] .env.example with the required vars only, optional ones commented
├── [ ] Forward-only migration runner (numbered, contiguous, branch-first)
├── [ ] CI pipeline (lint + test + schema-drift)
├── [ ] Healthcheck + readiness endpoint
└── [ ] Conventional commits
```

**Minimum directory structure:**

This is the layout of the reference scaffold; follow it so every project speaks the same structure.

```
src/
├── core/                      # Pure: no framework, no vendor SDK reaches here
│   ├── domain/                # entities, value objects, zod types, guards
│   ├── application/           # use-cases (orchestration)
│   └── ports/
│       ├── in/                # primary ports (how the app is driven)
│       └── out/               # secondary ports (model, store, clock, tools)
├── adapters/
│   ├── primary/               # http, cli
│   └── secondary/             # model, persistence, tools
├── infrastructure/
│   ├── config/                # zod-typed, validated once; the only reader of env
│   ├── container.ts           # wires adapters to ports (DI)
│   ├── middleware.ts          # the single cross-cutting surface (logs, request-id, cost)
│   ├── registry.ts            # tool registry (an index, not a bus)
│   └── observability/
├── eval/                      # behavioural eval harness
db/ (when persisted)
└── migrations/                # 0001_init.sql, forward-only
test/                          # domain · contract (schema-drift) · integration · cost-cap
CLAUDE.md · JOURNAL.md · README.md · docs/adr/
```

**Minimum `.env.example` (required only; optional commented):**

```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db?sslmode=verify-full&channel_binding=require
MODEL_GATEWAY_URL=        # or MODEL_PROVIDER + MODEL
MODEL=

# Optional (feature lights up only if present)
# SEARCH_API_KEY=
# MEMORY_URL=
# TELEMETRY_TOKEN=
LOG_LEVEL=info
```

**Startup log (resolved config, never secrets):**

```typescript
log.info("[STARTUP] config", {
  env: config.env,
  model: config.model.provider,
  database: !!config.database.url,
  search: config.optional.search,
  memory: config.optional.memory,
});
```

The split is deliberate: the *Boundaries* block is what separates an agentic system that holds up from one that does not. It is cheap on day zero and expensive on day ninety.
