---
title: Hexagonal Architecture Structure
impact: HIGH
phases: [architect, floor]
noAsi: code organisation. It is the substrate the containment rules use, never a control itself.
impactDescription: Enables testability, maintainability, and clean dependency management
tags: [architecture, hexagonal, structure, testing]
noTerritory: This rule governs the shape of the whole tree and the direction of every dependency in it; any glob broad enough to be true would be `**`, which states nothing.
---

## Hexagonal Architecture Structure

Organize code into layers with clear boundaries. Dependencies point inward. External services are adapters.

**Incorrect:**

```typescript
// Everything mixed together
src/
├── api/
│   └── projects.ts      // Contains business logic + DB + LLM calls
├── utils/
│   └── helpers.ts       // Random functions
└── types.ts             // All types in one file
```

**Correct:**

```
src/
├── core/                    # UNTOUCHABLE - Pure business logic
│   ├── domain/              # Entities, value objects, domain events
│   │   ├── project.ts
│   │   └── user.ts
│   ├── application/         # Use cases (orchestration)
│   │   ├── create-project.ts
│   │   └── analyze-project.ts
│   └── ports/               # Interfaces (contracts)
│       ├── in/              # Primary ports (how app is used)
│       │   └── project-service.port.ts
│       └── out/             # Secondary ports (what app needs)
│           ├── project-repository.port.ts
│           └── llm-gateway.port.ts
│
├── adapters/
│   ├── primary/             # How the outside world calls us
│   │   ├── rest/            # REST API
│   │   ├── graphql/         # GraphQL API
│   │   └── cli/             # CLI commands
│   └── secondary/           # How we call the outside world
│       ├── database/        # Postgres, graph store adapters
│       ├── llm/             # model provider adapters
│       └── external/        # Third-party APIs
│
└── infrastructure/
    ├── config/              # Zod-typed configuration
    ├── middleware/          # Request middleware
    └── observability/       # Logging, metrics, tracing
```

**Port Example:**

```typescript
// core/ports/out/llm-gateway.port.ts
export interface LLMGateway {
  complete(prompt: string, options: CompletionOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
}

// adapters/secondary/model/provider.adapter.ts
export class ModelAdapter implements LLMGateway {
  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const response = await this.client.messages.create({...});
    return response.content[0].text;
  }
}
```

**Dependency Rule:**

```
External World → Adapters → Ports → Core Domain
                    ↑          ↓
              (implements)  (depends on)
```

Core never imports from adapters. Adapters implement ports defined in core.
