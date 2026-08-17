---
title: New Feature = New Adapter
impact: HIGH
phases: [architect, floor]
noAsi: code organisation. It is the substrate the containment rules use, never a control itself.
impactDescription: Keeps core business logic clean and external integrations isolated
tags: [architecture, hexagonal, adapters, integration]
appliesTo: [**/adapters/**, **/*.adapter.ts, **/ports/**, **/*.port.ts]
governs: [port-adapter]
---

## New Feature = New Adapter

When adding a new external integration, always create a new adapter. Never mix external service logic into core.

**The Rule:**

> **New external service → New adapter implementing existing or new port**

**Incorrect:**

```typescript
// Business logic mixed with external service
// core/application/analyze-project.ts
import { WebSearchClient } from 'web-search';  // BAD: External import in core

export class AnalyzeProjectUseCase {
  async execute(projectId: string) {
    // BAD: Direct external service usage in core
    const web-search = new WebSearchClient(process.env.SEARCH_API_KEY);
    const searchResults = await web-search.search(query);
    // ...
  }
}
```

**Correct:**

```typescript
// 1. Define port in core
// core/ports/out/search-gateway.port.ts
export interface SearchGateway {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

// 2. Use case depends on port (interface), not implementation
// core/application/analyze-project.ts
export class AnalyzeProjectUseCase {
  constructor(private searchGateway: SearchGateway) {}

  async execute(projectId: string) {
    const searchResults = await this.searchGateway.search(query);
    // ...
  }
}

// 3. Adapter implements port
// adapters/secondary/search/web-search.adapter.ts
import { WebSearchClient } from 'web-search';
import { SearchGateway, SearchResult } from '@/core/ports/out/search-gateway.port';

export class WebSearchAdapter implements SearchGateway {
  private client: WebSearchClient;

  constructor(apiKey: string) {
    this.client = new WebSearchClient(apiKey);
  }

  async search(query: string): Promise<SearchResult[]> {
    const results = await this.client.search(query);
    return results.map(this.mapToSearchResult);
  }
}

// 4. Alternative adapter for testing or different provider
// adapters/secondary/search/mock.adapter.ts
export class MockSearchAdapter implements SearchGateway {
  async search(query: string): Promise<SearchResult[]> {
    return [{ title: 'Mock result', url: 'https://example.com' }];
  }
}
```

**Benefits:**

- Core is testable without external services
- Easy to swap providers (the search provider → another provider)
- Clear contracts between layers
- External service changes don't affect core logic
