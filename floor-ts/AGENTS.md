# Clean Architecture for Agentic and Full-Stack Systems

> Compiled craft reference for the Runward reference floor. All rules expanded, ordered by concern.
> Each rule id in a `<sub>` tag matches a rule file: `runward/rules/<id>.md` in an initialized project, or `../templates/rules/<id>.md` in this repo. The floor in this directory is the runnable implementation of the defaults.
> Author: Thibault Souris. License: MIT.

## Navigation

- [1. Foundations and boundaries](#1-foundations-and-boundaries)
- [2. Execution topology and tools](#2-execution-topology-and-tools)
- [3. Memory, state, scaling](#3-memory-state-scaling)
- [4. Resilience](#4-resilience)
- [5. Observability and cost](#5-observability-and-cost)
- [6. Security](#6-security)
- [7. Evaluation](#7-evaluation)
- [8. Process and evidence](#8-process-and-evidence)

---

# 1. Foundations and boundaries

##  Hexagonal Architecture Structure
<sub>`hexa-architecture`</sub>


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

##  New Feature = New Adapter
<sub>`hexa-adapter-pattern`</sub>


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

##  LLM Boundary Principle
<sub>`hexa-move-deterministic-out`</sub>


> **Everything that can be deterministic, testable, and cacheable must be moved out of the LLM.**

LLMs are expensive, slow, and non-deterministic. Move everything possible to code.

**Incorrect:**

```typescript
// LLM does classification AND response
const response = await llm.complete({
  prompt: `
    Analyze this message and determine:
    1. Is it casual, task-oriented, or complex?
    2. What data sources are needed?
    3. Generate the response.

    Message: ${userMessage}
  `
});
// BAD: Pays full LLM cost for classification
// BAD: Non-deterministic classification
// BAD: Can't test classification logic
```

**Correct:**

```typescript
// Step 1: Deterministic classification (regex)
const regexResult = classifyWithRegex(userMessage);
if (regexResult.confidence >= 0.6) {
  complexity = regexResult;  // $0, ~1ms
} else {
  // Step 2: Cheap LLM classification (Fast)
  complexity = await classifyWithFastModel(userMessage);  // ~$0.0003, ~100ms
}

// Step 3: Deterministic routing
const model = selectModel(complexity);
const dataSources = selectDataSources(complexity);

// Step 4: Only use expensive LLM for actual generation
const response = await llm.complete({
  model,
  prompt: buildPrompt(userMessage, dataSources),
});
```

**What to Move Out:**

| Logic | Method | Savings |
|-------|--------|---------|
| Request classification | Regex + fallback Fast | -40% classification cost |
| Model selection | Deterministic rules | -55% average cost |
| Memory source selection | Router by complexity | -76% latency |
| Format validation | Zod schemas | $0 (vs LLM validation) |
| Error detection | Pattern matching | Instant feedback |

**Implementation Pattern:**

```typescript
// The LLM should only do what requires intelligence
interface LLMBoundary {
  // OUT: Deterministic pre-processing
  classify(message: string): ComplexityLevel;
  selectModel(complexity: ComplexityLevel): Model;
  selectSources(complexity: ComplexityLevel): DataSource[];
  buildPrompt(message: string, context: Context): string;

  // IN: Actual LLM call
  generate(prompt: string, model: Model): Promise<string>;

  // OUT: Deterministic post-processing
  validateOutput(output: string, schema: ZodSchema): Result;
  formatResponse(result: Result): Response;
}
```

**Testing Benefits:**

- Classification logic: 100% unit testable
- Routing logic: 100% unit testable
- Only generation needs integration tests
- Faster test suite, more reliable CI

**The stronger form: move deterministic *truth* out, not only deterministic *logic*.** This rule moves classification, routing and validation out of the model. Its critical extension is to also keep load-bearing facts and figures out of the model's free generation. See `frontier-deterministic-boundary`.

##  A Thin Model Abstraction You Own (Not a Heavy Chain Framework)
<sub>`hexa-typescript-native`</sub>


Heavy chain or agent frameworks add overhead that is rarely justified. Keep a light abstraction you control over the model, and call the provider through a direct SDK behind your own port.

**Why avoid a heavy chain framework as the default:**

1. **Token overhead** - the framework's internal prompts add to your cost.
2. **Abstraction leaks** - you cannot optimise what you cannot see through.
3. **Volatile ecosystem** - frequent breaking changes in fast-moving framework code.
4. **Debug difficulty** - stack traces run through framework internals.
5. **Unnecessary complexity** - most applications do not need generic chains or agents.

**Incorrect (a heavy framework owns your control flow):**

```typescript
import { ChatModel } from "@chain-framework/core";
import { HumanMessage, SystemMessage } from "@chain-framework/core/messages";
import { StringOutputParser } from "@chain-framework/core/output_parsers";

const model = new ChatModel({ modelName: "mid-tier-model" });
const chain = model.pipe(new StringOutputParser());

const response = await chain.invoke([
  new SystemMessage(systemPrompt),
  new HumanMessage(userMessage),
]);
// You no longer control the prompt, the caching, or the cost.
```

**Correct (a direct SDK behind a thin port you own):**

```typescript
// The adapter imports one provider SDK; the core sees only the port.
import { ModelSDK } from "@vendor/model-sdk";   // any provider's official SDK

const client = new ModelSDK();

const response = await client.complete({
  model: "mid-tier-model",
  maxTokens: 4096,
  system: [corePrompt, toolsPrompt, dynamicContext],
  messages: [{ role: "user", content: userMessage }],
});
```

**When a framework might still help:**

- Rapid throwaway prototyping.
- Genuinely complex multi-agent orchestration that you have measured the need for.

**The abstraction you keep is yours:**

```typescript
// A thin interface you control, in the core. One adapter per provider implements it.
interface ModelPort {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

class PrimaryModelAdapter implements ModelPort {
  // full control over caching, retries, logging, cost attribution
}

class SecondaryModelAdapter implements ModelPort {
  // same interface, a different provider, swapped by configuration
}
```

**Benefits of the thin, owned abstraction:**

- Full control of caching and cost attribution.
- Simple debugging (no framework internals in the trace).
- No framework learning curve or breaking-change treadmill.
- The type safety and the contract are yours to define.

##  Stack Posture (Sober Default plus Trigger), Not a Fixed Stack
<sub>`hexa-recommended-stack`</sub>


A durable rulebook describes functions, never products, so it ages slowly. This reference follows the same discipline: it does not prescribe a vendor stack. It prescribes how to choose one.

> **Start with the smallest stack that proves value on real traffic. Cross a frontier (new service, new database, new provider) only on an objective trigger.**

**Default posture at the floor:**

| Concern | Sober default | Cross the frontier when (trigger) |
|---|---|---|
| Language | One typed language for the core, chosen by the team's fluency and the ecosystem | A second runtime earns a measured, isolated need (e.g. a Python sidecar for OCR/NLP) |
| Topology | Modular monolith, single process | A real, measured reason to split a service (independent scaling, isolation, team boundary) |
| Model | One provider behind a `ModelPort`, ideally via a gateway | Availability fallback, or a validated promotion in shadow deployment |
| Persistence | One relational store (Postgres) for facts; vectors in the same store (pgvector) | Volume that overflows the single store; a real graph traversal becomes central |
| State / scale | In-process, single instance | Horizontal scaling needed -> externalise state first |
| Async | Inline | A workload genuinely needs scheduling or backpressure |

**How to record a stack choice:** each line above is a decision with a default and a trigger. When a trigger fires, the choice is made in an ADR with the options and a preference order, not improvised. Until the trigger fires, you do not pre-build and you do not re-debate.

**What does not belong in the core, whatever the stack:**

- No vendor SDK imported from the domain (model, database, search are adapters).
- No framework owning your control flow that you cannot see through; prefer thin abstractions you own.
- No optional service that crashes the app when absent.

For a worked, current example of this posture, see the reference stack note (`../templates/mission/reference-stack.md` in this repo, or `runward/mission/reference-stack.md` in an initialized project); treat it as an illustration of the method, not as a stack to copy.

##  Deterministic Boundary of the Model
<sub>`frontier-deterministic-boundary`</sub>


> **The model writes prose. The program owns the facts.**
> Anything that can be retrieved, computed, validated or decided deterministically must live in code, never in the model's free generation. The model is rented and non-deterministic; the boundary around it is owned and tested.

This is the strongest form of the LLM Boundary Principle: not only move deterministic *logic* out (routing, classification), but move deterministic *truth* out. The model is allowed to phrase, summarise and connect. It is never the source of a number, a citation, a price, a date, or an authorisation.

**Why structured outputs are not enough:** constrained decoding and JSON schema guarantee the *shape* of the output, never its *meaning*. A model can emit a perfectly valid JSON number that is invented. Shape validation and truth validation are two different jobs.

**Incorrect:**

```typescript
// The model is asked to "report the figures". It will, including ones it invents.
const answer = await model.complete(`
  Summarise the company's AI budget from these notes: ${notes}
  Give exact percentages and the source.
`);
// BAD: Any % in `answer` is the model's word, unverifiable, potentially hallucinated.
```

**Correct (data-to-text / slot-filling):**

```typescript
// 1. Facts come from a structured store, each with value, unit, period, source.
const facts = await portFacts.query({ topic, edition });   // deterministic

// 2. The model writes the narrative and emits SLOTS, never raw numbers.
//    Prompt: "Refer to a served fact as {f0}, {f1}... Never write a figure yourself."
const draft = await model.complete(buildPrompt(question, facts));

// 3. The program substitutes value + unit + period into each slot.
const answer = fillSlots(draft, facts);                    // deterministic

// 4. A guard rejects the response if any number in it is not grounded in served facts.
assertGrounded(answer, facts);                             // fail-closed
```

**The grounding guard (executable specification of the boundary):**

```typescript
// Extract numbers that are not part of a word/identifier, normalise FR decimals.
const NUMBER = /(?<![\p{L}\d-])\d+(?:[.,]\d+)?/gu;

// Grounded set = fact values ∪ numbers appearing in served fact labels ∪ plausible years.
function groundedSet(facts: Pick<Fact, "value" | "indicator">[]): Set<string> {
  const set = new Set<string>();
  for (const f of facts) {
    set.add(normalise(f.value));
    for (const n of f.indicator.match(NUMBER) ?? []) set.add(normalise(n));
  }
  return set;
}

// Reject any figure in the synthesis that is not in the grounded set (years excepted).
export function assertGrounded(text: string, facts: Pick<Fact, "value" | "indicator">[]): void {
  const grounded = groundedSet(facts);
  for (const n of text.match(NUMBER) ?? []) {
    const v = normalise(n);
    if (!grounded.has(v) && !isPlausibleYear(v)) {
      throw new GroundingError(`Ungrounded figure in synthesis: ${n}`);
    }
  }
}
```

**Layered defence, by maturity of the model wiring:**

| Stage | Mechanism | Guarantee |
|-------|-----------|-----------|
| Floor | Guard checks every figure against the served facts (value ∪ label numbers ∪ years) | No invented number reaches the user |
| Wired with structured outputs | Model emits `{fN}` slots, program substitutes value+unit+period | Attribution is exact (AIS: Attributable to Identified Sources) |
| Monitoring | Faithfulness metric (RAGAS / FActScore family) over a traffic sample | Drift in narrative faithfulness is measured and alerted, not blocked |

The guard **guarantees and blocks** ("can we serve this?"). The metric **measures and alerts** ("how faithful is the prose over time?"). They are complementary, never redundant.

**Boundary checklist for any feature that surfaces facts:**

- [ ] Every load-bearing value comes from a typed store, not from the model.
- [ ] The model's output passes a grounding guard before it reaches a user.
- [ ] The guard **fails closed**: on doubt it rejects, it does not pass through.
- [ ] Abstention is a first-class answer: "not in the corpus" beats a plausible guess.
- [ ] The guard has unit tests that feed realistic facts *with their labels* (the spec is executable).

**Where this sits:** the deterministic boundary is the practical form of the guiding principle (the architecture constrains the model, never the other way around) and of "the deterministic stays out of the model" (see rule: frontier-deterministic-boundary). It is also a security control: a hallucinated figure is an integrity failure, not just a quality one.

##  Contract Governance (Versioned, Additive, Expand-then-Contract)
<sub>`contracts-governance`</sub>


A port is a contract. The whole point of the hexagon is that you can change what is *behind* a port freely, but what *crosses* the port is governed. Break that discipline and the decoupling is cosmetic.

> **Behind the port: free. Across the port: governed, versioned, additive.**

**Rules of change at a boundary:**

1. **Additive by default.** Add new optional fields; never remove or repurpose an existing one in place.
2. **Versioned.** A breaking change is a new version of the contract, not an edit to the old one.
3. **Expand-then-contract** (the safe migration of any contract):
   - *Expand*: introduce the new shape alongside the old, both supported.
   - *Migrate*: move producers and consumers over, observed on real traffic.
   - *Contract*: only once nothing reads the old shape, remove it.
4. **Consumer-driven.** The consumers' expectations are encoded as tests the producer must satisfy. The contract is owned jointly, not dictated by the producer.

**The schema-drift test (executable contract):**

The cheapest consumer-driven contract test is one that fails the build when the implementation drifts from the domain contract. In a production system built on these rules, the domain `zod` types are the single source of truth, and a test asserts that the live SQL columns match them:

```typescript
// test/schema-drift.test.ts (runs only when DATABASE_URL is set)
test("SQL columns match the domain contract", async () => {
  const columns = await db.columnsOf("facts");        // live schema
  const expected = factSchema.keyof().options;        // zod domain type
  expect(new Set(columns)).toEqual(new Set(expected.map(toSnakeCase)));
});
```

When the database and the domain type disagree, the build goes red before a single request is served. The contract is not a document anyone can forget; it is a test.

**The model port is a contract too.** Promoting a new model is the sibling of expand-then-contract: the candidate runs first in *shadow deployment* behind the same port, on real traffic but silent, its behavioural divergence measured against the serving model; only if divergence stays under a pre-set threshold do you shift a growing share of traffic, with immediate rollback on any regression. You never switch in one move.

**Incorrect:**

```typescript
// Renaming a field in place. Every consumer breaks at once.
interface FactDTO { value: string; /* was: amount */ }   // BAD: breaking, unversioned
```

**Correct:**

```typescript
// Expand: add the new field, keep the old, mark it deprecated.
interface FactDTO {
  /** @deprecated use `value` */ amount?: string;
  value: string;
}
// Migrate consumers, observe on real traffic, THEN contract (remove `amount`).
```

**Checklist before changing anything that crosses a boundary:**

- [ ] Is the change additive? If not, it is a new version.
- [ ] Is there a contract test (schema-drift, consumer test) that will catch a regression?
- [ ] Are the old and new shapes both live during the migration (expand-then-contract)?
- [ ] For a model swap: shadow first, switch by stages, rollback ready.

##  Model Provider as an Adapter (Detected, Never Hardcoded)
<sub>`provider-llm-auto-detection`</sub>


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

##  Graceful Degradation of Optional Services
<sub>`provider-no-crash-missing-env`</sub>


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

# 2. Execution topology and tools

##  Tool Scope and Atomicity
<sub>`tools-scope-atomicity`</sub>


Each tool should do ONE atomic action. Avoid catch-all tools that confuse the LLM.

**The Problem:**

Tools that do everything:
- Use more tokens in descriptions
- Confuse the LLM about when to use them
- Make debugging harder
- Can't be cached or optimized individually

**Incorrect:**

```typescript
// BAD: Catch-all tool
const analyzeProjectTool = {
  name: 'analyze_project',
  description: 'Analyzes project overview, market fit, traction, team, financials, and generates recommendations',
  parameters: {
    projectId: { type: 'string' },
    analysisType: { type: 'string', enum: ['overview', 'market', 'traction', 'team', 'finance', 'all'] },
  },
};

// BAD: Vague tool
const getInsightsTool = {
  name: 'get_insights',
  description: 'Gets insights about anything',  // Too vague
};
```

**Correct:**

```typescript
// GOOD: Atomic tools - one action each
const tools = [
  {
    name: 'get_project_overview',
    description: 'Retrieves basic project information: name, stage, sector, founding date. Use for initial context.',
    parameters: { projectId: { type: 'string', required: true } },
  },
  {
    name: 'analyze_market_fit',
    description: 'Evaluates product-market fit based on user feedback and metrics. Use when assessing market validation.',
    parameters: { projectId: { type: 'string', required: true } },
  },
  {
    name: 'assess_traction',
    description: 'Calculates traction metrics: MRR growth, user growth, engagement. Use for performance assessment.',
    parameters: { projectId: { type: 'string', required: true } },
  },
  {
    name: 'get_team_assessment',
    description: 'Returns team composition and experience analysis. Use when evaluating team strength.',
    parameters: { projectId: { type: 'string', required: true } },
  },
];
```

**Principles:**

1. **One tool = One action** - Atomic operations
2. **2-3 examples max** - Don't bloat descriptions
3. **Explicit "when to use"** - Guide LLM selection
4. **Group by domain** - Organize related tools together

**Tool Documentation Template:**

```typescript
interface ToolDefinition {
  name: string;           // verb_noun format: get_project, analyze_market
  description: string;    // What it does + when to use it
  parameters: {
    // Only required parameters, minimal
  };
}

// Example
{
  name: 'search_documents',
  description: 'Searches project documents by keyword. Use when user asks about specific topics or needs to find information in uploaded files.',
  parameters: {
    projectId: { type: 'string', required: true },
    query: { type: 'string', required: true },
    limit: { type: 'number', default: 10 },
  },
}
```

**Signs of tool bloat:**

- Tool description > 100 words
- More than 5 parameters
- "or" in the description (does multiple things)
- Enum with > 5 options

##  Tool Registry Pattern
<sub>`tools-registry-pattern`</sub>


Replace switch statements with a registry pattern for tool execution. Easier to test, extend, and maintain.

**Incorrect:**

```typescript
// BAD: Giant switch statement
async function executeTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'get_project':
      return await getProject(input as GetProjectInput);
    case 'analyze_market':
      return await analyzeMarket(input as AnalyzeMarketInput);
    case 'search_documents':
      return await searchDocuments(input as SearchDocumentsInput);
    // ... 50 more cases
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

**Correct:**

```typescript
// Tool interface
interface ITool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

// Tool context for shared dependencies
interface ToolContext {
  userId: string;
  tenantId: string;
  db: Database;
  logger: Logger;
}

// Registry class
class ToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // Validate input with Zod
    const validated = tool.schema.parse(input);

    // Execute with context
    return tool.execute(validated, ctx);
  }

  // For LLM: get all tool definitions
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    }));
  }
}

// Example tool implementation
const getProjectTool: ITool = {
  name: 'get_project',
  description: 'Retrieves project details by ID',
  schema: z.object({
    projectId: z.string().uuid(),
  }),
  async execute(input, ctx) {
    const project = await ctx.db.projects.findUnique({
      where: { id: input.projectId, tenantId: ctx.tenantId },
    });
    return { success: true, data: project };
  },
};

// Registry setup
const registry = new ToolRegistry();
registry.register(getProjectTool);
registry.register(analyzeMarketTool);
registry.register(searchDocumentsTool);

// Usage
const result = await registry.execute('get_project', { projectId: '...' }, ctx);
```

**Benefits:**

- Each tool is independently testable
- Easy to add new tools (just register)
- Automatic schema validation
- Centralized logging and metrics
- No giant switch to maintain

**Advanced: Tool middleware:**

```typescript
class ToolRegistry {
  private middleware: ToolMiddleware[] = [];

  use(middleware: ToolMiddleware): void {
    this.middleware.push(middleware);
  }

  async execute(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
    // Apply middleware chain
    let handler = (input: unknown) => this.executeCore(name, input, ctx);

    for (const mw of this.middleware.reverse()) {
      const next = handler;
      handler = (input) => mw(name, input, ctx, next);
    }

    return handler(input);
  }
}

// Logging middleware
const loggingMiddleware: ToolMiddleware = async (name, input, ctx, next) => {
  const start = Date.now();
  const result = await next(input);
  ctx.logger.info('Tool executed', { name, duration: Date.now() - start });
  return result;
};

registry.use(loggingMiddleware);
```

##  Prompt as Program (Prompt Compiler)
<sub>`patterns-prompt-compiler`</sub>


Treat prompts as compiled programs, not raw strings. This enables versioning, testing, and optimization.

**Incorrect:**

```typescript
// Raw string concatenation
const prompt = `
You are an assistant.
${userContext}
${projectInfo}
${tools.map(t => t.description).join('\n')}
${userMessage}
`;
```

**Correct:**

```typescript
// Prompt as structured data
interface CompiledPrompt {
  content: string;
  tokenEstimate: number;
  cacheKey: string;
  locale: Locale;
  cacheLevel: 'L1' | 'L2' | 'L3';
  blocks: PromptBlock[];
  version: string;
}

interface PromptBlock {
  name: string;
  content: string;
  tokens: number;
  cacheLevel: 'L1' | 'L2' | 'L3';
  hash: string;  // For cache invalidation
}

class PromptCompiler {
  private blocks: Map<string, PromptBlock> = new Map();

  // Register reusable blocks
  registerBlock(name: string, content: string, cacheLevel: CacheLevel): void {
    this.blocks.set(name, {
      name,
      content,
      tokens: estimateTokens(content),
      cacheLevel,
      hash: computeHash(content),
    });
  }

  // Compile prompt from blocks
  compile(blockNames: string[], dynamicContent: Record<string, string>): CompiledPrompt {
    const usedBlocks: PromptBlock[] = [];
    let content = '';

    for (const name of blockNames) {
      const block = this.blocks.get(name);
      if (!block) {
        throw new Error(`Unknown block: ${name}`);
      }
      usedBlocks.push(block);
      content += block.content + '\n\n';
    }

    // Add dynamic content
    for (const [key, value] of Object.entries(dynamicContent)) {
      content += `## ${key}\n${value}\n\n`;
    }

    return {
      content,
      tokenEstimate: usedBlocks.reduce((sum, b) => sum + b.tokens, 0) + estimateTokens(Object.values(dynamicContent).join('')),
      cacheKey: this.computeCacheKey(usedBlocks, dynamicContent),
      locale: 'en',
      cacheLevel: this.determineCacheLevel(usedBlocks),
      blocks: usedBlocks,
      version: this.computeVersion(usedBlocks),
    };
  }

  private computeVersion(blocks: PromptBlock[]): string {
    const hashes = blocks.map(b => b.hash).join('');
    return computeHash(hashes).substring(0, 8);
  }
}

// Usage
const compiler = new PromptCompiler();

// Register static blocks
compiler.registerBlock('system-identity', SYSTEM_IDENTITY_PROMPT, 'L1');
compiler.registerBlock('evaluation-criteria', EVALUATION_CRITERIA_PROMPT, 'L1');
compiler.registerBlock('tool-definitions', TOOL_DEFINITIONS_PROMPT, 'L2');
compiler.registerBlock('response-format', RESPONSE_FORMAT_PROMPT, 'L1');

// Compile for request
const prompt = compiler.compile(
  ['system-identity', 'evaluation-criteria', 'tool-definitions', 'response-format'],
  {
    'Current Project': projectContext,
    'Recent Memories': memoriesContext,
    'User Message': userMessage,
  }
);

console.log('Prompt version:', prompt.version);
console.log('Estimated tokens:', prompt.tokenEstimate);
```

**Benefits:**

- **Versioning**: Track prompt changes like code
- **Testing**: Unit test individual blocks
- **Caching**: Precise cache key computation
- **Debugging**: Know exactly what's in each prompt
- **Optimization**: Measure and reduce token usage

# 3. Memory, state, scaling

##  State as an Immutable Journal (Event Sourcing, Replay, Provenance)
<sub>`state-event-sourcing`</sub>


> **The agent is a stateless reducer. State lives outside, in three layers.**

An agent with hidden in-process state cannot be replayed, audited, or scaled. Keep the agent stateless and externalise state into three distinct layers, each with one job:

1. **Immutable interaction journal** - the source of truth. Append-only, never edited. It is what you audit and what you replay. Every consequential step is an event appended here.
2. **Derived working view** - the memory that forgets. A projection of the journal, trimmed and scored for relevance, rebuilt from the journal at any time (see *Memory Scoring*). It is a cache, not a source.
3. **Prompt provenance** - the reconciler. For each inference, the fingerprint of what was actually injected into the model, so you can replay exactly what the model saw even after the working view has moved on.

**Incorrect:**

```typescript
// Hidden mutable state in the agent. Not replayable, not auditable.
class Agent {
  private history: Msg[] = [];          // BAD: in-process truth
  handle(input: string) {
    this.history.push({ role: "user", text: input });
    // ... mutate more fields the journal never sees
  }
}
```

**Correct:**

```typescript
// Truth is the journal. The agent folds events into a view, then appends new ones.
async function handle(runId: string, input: Event): Promise<Result> {
  await journal.append(runId, input);          // append-only truth
  const view = project(await journal.read(runId)); // derived, rebuildable
  const result = await reducer(view);          // agent is a pure fold over the view
  await journal.append(runId, result.events);  // consequences are events too
  return result;
}

// Replay is just folding the journal again, deterministically.
const replayed = project(await journal.read(runId));
```

**Why this matters:**

- **Audit and recovery**: the journal answers "what happened, exactly?" and lets you resume a run from any point (see the recovery runbook).
- **Provenance under injection**: keeping what was injected lets you investigate a bad output even after the working memory forgot it; it also pairs with the prompt provenance the single middleware records.
- **Scaling**: because the agent holds no hidden state, externalising the journal and the working view to a shared store is the only step needed to run many instances. The move changes semantics (eventual consistency, causal order, idempotency under concurrency); pay it on a trigger, in full knowledge, not by default.

**Checklist:**

- [ ] The agent holds no hidden mutable state; it folds over an external view.
- [ ] The interaction journal is append-only and is the single source of truth.
- [ ] The working view is a projection, rebuildable from the journal.
- [ ] Prompt provenance is recorded per inference for replay and audit.

##  Memory Scoring Formula
<sub>`data-memory-scoring`</sub>


A comprehensive scoring formula for memory retrieval that balances multiple factors.

**Complete Formula:**

```typescript
interface Memory {
  id: string;
  content: string;
  embedding: number[];
  importance: number;       // 0-1, user or system assigned
  accessCount: number;      // Times retrieved
  lastAccessedAt: Date;
  createdAt: Date;
  source: 'user' | 'system' | 'inferred';
  verified: boolean;        // User confirmed accuracy
}

interface ScoringWeights {
  similarity: number;
  recency: number;
  importance: number;
  frequency: number;
  verification: number;
}

const defaultWeights: ScoringWeights = {
  similarity: 0.35,
  recency: 0.25,
  importance: 0.20,
  frequency: 0.10,
  verification: 0.10,
};

function computeMemoryScore(
  memory: Memory,
  queryEmbedding: number[],
  weights = defaultWeights
): number {
  // 1. Semantic similarity (cosine)
  const similarity = cosineSimilarity(memory.embedding, queryEmbedding);

  // 2. Time decay (exponential)
  const daysSinceAccess = (Date.now() - memory.lastAccessedAt.getTime()) / DAY_MS;
  const recency = Math.exp(-daysSinceAccess / 60);  // 60-day half-life

  // 3. Importance (direct from memory)
  const importance = memory.importance;

  // 4. Access frequency (logarithmic, capped)
  const frequency = Math.min(Math.log10(memory.accessCount + 1) / 2, 1);

  // 5. Verification bonus
  const verification = memory.verified ? 1 : 0.5;

  // Weighted combination
  const score =
    similarity * weights.similarity +
    recency * weights.recency +
    importance * weights.importance +
    frequency * weights.frequency +
    verification * weights.verification;

  return score;
}
```

**Context-Aware Weights:**

```typescript
// Adjust weights based on query type
function getWeightsForContext(queryType: string): ScoringWeights {
  switch (queryType) {
    case 'factual':
      // Prioritize verified, important memories
      return {
        similarity: 0.30,
        recency: 0.10,
        importance: 0.25,
        frequency: 0.10,
        verification: 0.25,
      };

    case 'recent':
      // Prioritize recent memories
      return {
        similarity: 0.25,
        recency: 0.40,
        importance: 0.15,
        frequency: 0.10,
        verification: 0.10,
      };

    case 'exploratory':
      // Balance all factors, favor similarity
      return {
        similarity: 0.40,
        recency: 0.20,
        importance: 0.20,
        frequency: 0.10,
        verification: 0.10,
      };

    default:
      return defaultWeights;
  }
}
```

**Cosine Similarity Implementation:**

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
```

**Score Interpretation:**

| Score Range | Interpretation |
|-------------|----------------|
| 0.8 - 1.0 | Highly relevant, should definitely include |
| 0.6 - 0.8 | Relevant, include if space permits |
| 0.4 - 0.6 | Marginally relevant, include for deep queries |
| 0.0 - 0.4 | Low relevance, consider for pruning |

##  TTL by Data Type
<sub>`data-ttl-types`</sub>


Different data types require different retention policies. Define TTLs at the schema level.

**Recommended TTLs:**

| Data Type | TTL | Action at Expiration |
|-----------|-----|---------------------|
| Active chat sessions | Session duration | Archive + summarize |
| Archived sessions | 2 years | Anonymize then delete |
| Active projects | Project duration | Archive |
| Completed projects | 5 years | Anonymize personal data |
| Agent memories | Progressive decay | Prune if score < threshold |
| Audit logs | 5 years (legal) | Cold archive |
| Technical logs | 90 days | Delete |
| API tokens | 90 days | Revoke |
| Password reset | 1 hour | Delete |

**Implementation:**

```typescript
// Schema with TTL metadata
interface DataSchema {
  type: string;
  ttlDays: number | null;  // null = never expires
  expirationAction: 'delete' | 'archive' | 'anonymize';
}

const dataSchemas: Record<string, DataSchema> = {
  chatSession: { type: 'chatSession', ttlDays: null, expirationAction: 'archive' },
  archivedSession: { type: 'archivedSession', ttlDays: 730, expirationAction: 'anonymize' },
  auditLog: { type: 'auditLog', ttlDays: 1825, expirationAction: 'archive' },
  technicalLog: { type: 'technicalLog', ttlDays: 90, expirationAction: 'delete' },
  memory: { type: 'memory', ttlDays: null, expirationAction: 'delete' },  // Score-based
};

// Cleanup cron job
async function runDataCleanup() {
  for (const [type, schema] of Object.entries(dataSchemas)) {
    if (!schema.ttlDays) continue;

    const cutoff = new Date(Date.now() - schema.ttlDays * 24 * 60 * 60 * 1000);

    switch (schema.expirationAction) {
      case 'delete':
        await db.deleteWhere(type, { createdAt: { lt: cutoff } });
        break;
      case 'archive':
        await db.archiveWhere(type, { createdAt: { lt: cutoff } });
        break;
      case 'anonymize':
        await db.anonymizeWhere(type, { createdAt: { lt: cutoff } });
        break;
    }

    logger.info(`Data cleanup completed for ${type}`, { cutoff, action: schema.expirationAction });
  }
}

// Run daily
cron.schedule('0 3 * * *', runDataCleanup);
```

**Anonymization Pattern:**

```typescript
async function anonymizeRecord(record: UserData): Promise<AnonymizedData> {
  return {
    ...record,
    email: hashEmail(record.email),
    name: 'Anonymous User',
    phone: null,
    address: null,
    // Keep non-PII for analytics
    createdAt: record.createdAt,
    projectCount: record.projectCount,
  };
}
```

##  Orphan Data Cleanup
<sub>`data-orphan-cleanup`</sub>


Orphaned records waste storage and can cause bugs. Regular cleanup is essential.

**Common Orphan Types:**

| Orphan Type | Detection | Action |
|-------------|-----------|--------|
| Project without owner | Cron weekly | Notify admin, archive after 30d |
| Messages without session | Cron daily | Anonymize + archive |
| Files (S3) without DB ref | Cron monthly | Quarantine then delete |
| Broken DB relationships | Cron weekly | Rebuild or delete |
| Unused embeddings | Cron monthly | Delete |

**Implementation:**

```typescript
// Orphan detection and cleanup service
class OrphanCleanupService {
  async findOrphanProjects(): Promise<Project[]> {
    return db.projects.findMany({
      where: {
        OR: [
          { ownerId: null },
          { owner: { deletedAt: { not: null } } },
        ],
        orphanedAt: null,  // Not already marked
      },
    });
  }

  async handleOrphanProjects() {
    const orphans = await this.findOrphanProjects();

    for (const project of orphans) {
      // Mark as orphaned, set deadline
      await db.projects.update({
        where: { id: project.id },
        data: {
          orphanedAt: new Date(),
          archiveDeadline: addDays(new Date(), 30),
        },
      });

      // Notify admins
      await notifyAdmins('orphan_project', {
        projectId: project.id,
        projectName: project.name,
        archiveDeadline: addDays(new Date(), 30),
      });
    }

    logger.info('Orphan projects processed', { count: orphans.length });
  }

  async archiveExpiredOrphans() {
    const expired = await db.projects.findMany({
      where: {
        archiveDeadline: { lt: new Date() },
        archivedAt: null,
      },
    });

    for (const project of expired) {
      await this.archiveProject(project);
    }
  }

  async findOrphanFiles(): Promise<string[]> {
    // List all S3 files
    const s3Files = await s3.listObjects({ Bucket: 'uploads' });

    // Get all referenced files from DB
    const referencedFiles = await db.files.findMany({
      select: { s3Key: true },
    });
    const referencedSet = new Set(referencedFiles.map(f => f.s3Key));

    // Find orphans
    return s3Files
      .filter(f => !referencedSet.has(f.Key))
      .map(f => f.Key);
  }

  async cleanupOrphanFiles() {
    const orphans = await this.findOrphanFiles();

    // Move to quarantine first (safety)
    for (const key of orphans) {
      await s3.copyObject({
        CopySource: `uploads/${key}`,
        Bucket: 'uploads-quarantine',
        Key: key,
      });
    }

    logger.info('Orphan files quarantined', { count: orphans.length });

    // Delete from main bucket after 30 days in quarantine
    // (separate cron job)
  }
}

// Schedule cleanup jobs
cron.schedule('0 2 * * 0', () => orphanService.handleOrphanProjects());  // Weekly
cron.schedule('0 3 * * *', () => orphanService.archiveExpiredOrphans());  // Daily
cron.schedule('0 4 1 * *', () => orphanService.cleanupOrphanFiles());     // Monthly
```

**Database Integrity Check:**

```typescript
async function checkDatabaseIntegrity() {
  const issues: IntegrityIssue[] = [];

  // Check foreign key references
  const brokenRefs = await db.$queryRaw`
    SELECT m.id, m.session_id
    FROM messages m
    LEFT JOIN sessions s ON m.session_id = s.id
    WHERE s.id IS NULL
  `;

  if (brokenRefs.length > 0) {
    issues.push({
      type: 'broken_reference',
      table: 'messages',
      count: brokenRefs.length,
      ids: brokenRefs.map(r => r.id),
    });
  }

  return issues;
}
```

##  Forward-Only, Branch-First Migrations
<sub>`data-migrations-forward-only`</sub>


Schema evolution is a migration of state, not a rewrite. Treat migrations like contract changes: additive, ordered, reversible by rolling forward, and proven on a branch before they touch production data.

> **Forward-only, additive, tested on a branch, then main.**

**Rules:**

1. **Versioned and contiguous.** Files are numbered `0001`, `0002`, ... A runner applies them in order and refuses a gap or a re-order (anti-skip guard).
2. **Forward-only.** No destructive down-migration in normal operation; you fix forward with a new migration. Removal of a column is the *contract* phase of expand-then-contract, run only once nothing reads it.
3. **Branch-first.** Run the migration on a throwaway branch (Neon copy-on-write costs ~0), verify the schema and the schema-drift test, keep the branch as a return net, then apply to main.
4. **Idempotent seeds.** Seed with `on conflict (id) do nothing` so re-running is safe.

**Migration runner guard (the order is enforced, not trusted):**

```typescript
// scripts/migrate.ts - transactional, contiguity + anti-skip
const applied = await db.appliedMigrations();          // e.g. [1, 2]
const onDisk  = listMigrations();                      // e.g. [1, 2, 3]
assertContiguous(onDisk);                              // no gap 1,3 without 2
assertNoReorder(applied, onDisk);                      // applied prefix unchanged
for (const m of onDisk.filter(m => !applied.includes(m.n))) {
  await db.tx(async (t) => { await t.run(m.sql); await t.recordApplied(m.n); });
}
```

**Incorrect:**

```sql
-- Editing an applied migration in place, or dropping a live column.
ALTER TABLE facts DROP COLUMN value;   -- BAD: breaks readers, irreversible
```

**Correct:**

```sql
-- 0007_add_period.sql  (additive, forward-only)
ALTER TABLE facts ADD COLUMN period text;   -- expand
-- backfill in the same or a later migration; readers move over;
-- only later, 0009_drop_legacy.sql removes what nothing reads (contract).
```

**Checklist:**

- [ ] Migrations are numbered, contiguous, applied in order by a runner.
- [ ] No edit to an already-applied migration; fix forward.
- [ ] Proven on a branch (schema-drift green) before main.
- [ ] Column removal is the contract phase, after readers have moved.

##  Externalize State for Scaling
<sub>`scaling-state-externalization`</sub>


> **Scaling ≠ adding instances. Scaling = externalized state.**

In-memory state prevents horizontal scaling. Each instance has its own copy, leading to inconsistencies.

**Incorrect:**

```typescript
// In-memory state - works for single instance only
const rateLimitStore = new Map<string, RateLimitData>();
const sessionStore = new Map<string, SessionData>();
const idempotencyStore = new Map<string, IdempotencyRecord>();

function rateLimit(userId: string): boolean {
  const data = rateLimitStore.get(userId);  // BAD: Instance-local
  // ...
}
```

**Correct:**

```typescript
// External state - works for any number of instances
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function rateLimit(userId: string): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 60);  // 1 minute window
  }

  return current <= 100;  // 100 requests per minute
}
```

**State Migration Table:**

| Component | Single Instance | Multi Instance |
|-----------|-----------------|----------------|
| Token cache | `Map<>` OK | Redis with TTL |
| Rate limiting | In-memory OK | Redis distributed |
| Session state | In-memory OK | Redis or a shared store |
| Locks | Not needed | Redis distributed lock |
| Idempotency | `Map<>` OK | Redis with TTL |

**Files to Audit:**

```typescript
// Common patterns to find and migrate
middleware.ts      rateLimitStore: Map<string, RateLimitData>
middleware.ts      idempotencyStore: Map<string, IdempotencyRecord>
service.ts         sessionStore: Map<string, SessionData>
import.ts          importProgress: Map<string, ImportProgressRecord>
export.ts          exportProgress: Map<string, ExportProgressRecord>
```

**Scaling Checklist:**

```
PRE-REQUISITES
├── [ ] In-memory Maps identified
├── [ ] Rate limiting ready for Redis
├── [ ] DB connection pooling configured
├── [ ] Multi-tenant isolation OK
└── [ ] Healthcheck + readiness probe

MIGRATION (when multi-instance needed)
├── [ ] Rate limiting → Redis
├── [ ] Session state → Redis
├── [ ] Distributed locks → Redis
└── [ ] Load tests validated
```

##  Distributed Rate Limiting
<sub>`scaling-distributed-rate-limiting`</sub>


In-memory rate limiting fails with multiple instances. Use Redis for consistent limits.

**The Problem:**

With 3 instances and 100 req/min limit:
- User can make 100 requests to each instance
- Actual rate: 300 req/min (3x limit bypass)

**Incorrect:**

```typescript
// In-memory - each instance has its own counter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const record = rateLimits.get(userId);
  // BAD: Only counts requests to this instance
}
```

**Correct:**

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

interface RateLimitConfig {
  windowMs: number;    // Time window in ms
  maxRequests: number; // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,    // 1 minute
  maxRequests: 100,
};

async function checkRateLimit(
  key: string,
  config = defaultConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowMs)}`;

  const multi = redis.multi();
  multi.incr(windowKey);
  multi.pttl(windowKey);

  const results = await multi.exec();
  const count = results![0][1] as number;
  const ttl = results![1][1] as number;

  // Set expiry on first request
  if (count === 1) {
    await redis.pexpire(windowKey, config.windowMs);
  }

  const remaining = Math.max(0, config.maxRequests - count);
  const resetIn = ttl > 0 ? ttl : config.windowMs;

  return {
    allowed: count <= config.maxRequests,
    remaining,
    resetIn,
  };
}

// Middleware usage
async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id || req.ip;
  const result = await checkRateLimit(`user:${userId}`);

  // Set standard rate limit headers
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + result.resetIn / 1000));

  if (!result.allowed) {
    res.setHeader('Retry-After', Math.ceil(result.resetIn / 1000));
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}
```

**Sliding Window Algorithm:**

For more precise rate limiting, use sliding window:

```typescript
async function slidingWindowRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Remove old entries and add new one atomically
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.expire(key, Math.ceil(windowMs / 1000));

  const results = await multi.exec();
  const count = results![2][1] as number;

  return count <= maxRequests;
}
```

**Rate Limit Tiers:**

| Tier | Limit | Use Case |
|------|-------|----------|
| Anonymous | 10/min | Public endpoints |
| Free | 60/min | Authenticated users |
| Pro | 300/min | Paid users |
| API | 1000/min | API keys |

##  Database Connection Pooling
<sub>`scaling-db-connection-pooling`</sub>


Configure connection pools to prevent exhaustion under load. Each instance needs its own pool.

**The Problem:**

Without pooling:
- Each request opens a new connection
- Connections are slow to establish
- Database has limited connections
- Under load: "too many connections" errors

**Incorrect:**

```typescript
// New connection per request
async function query(sql: string) {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();  // BAD: Slow, wasteful
  const result = await client.query(sql);
  await client.end();
  return result;
}
```

**Correct:**

```typescript
// PostgreSQL with pg-pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Max connections per instance
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
});

// Reuse connections from pool
async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();  // Return to pool, don't close
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});
```

**Pool Sizing Formula:**

```
connections_per_instance = (db_max_connections - reserved) / num_instances

Example:
- PostgreSQL max_connections: 100
- Reserved for admin: 5
- Instances: 4
- Pool size per instance: (100 - 5) / 4 = ~23
```

**Prisma Configuration:**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Connection pool via URL
// DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

**Drizzle Configuration:**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export const db = drizzle(pool);
```

**Monitoring:**

```typescript
// Log pool stats periodically
setInterval(() => {
  console.info('[DB] Pool stats', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 60000);
```

**Common Issues:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| "too many connections" | Pool too large | Reduce max per instance |
| Slow queries | Pool exhausted | Increase max or optimize queries |
| Connection timeout | Pool full, queries slow | Add connection_timeout, optimize |

##  Tiered Memory Router
<sub>`patterns-memory-router-tiered`</sub>


Not every query needs full memory search. Route to appropriate tier based on complexity.

**The Problem:**

Fetching all memory sources for every query:
- Slow (full graph traversal, vector search)
- Expensive (embedding generation)
- Unnecessary for simple queries

**Tiered Approach:**

```
Tier 0 (casual) - ~50ms
└── Presence, timezone, basic stats only

Tier 1 (task) - ~400ms
└── Tier 0 + vector search + recent memories

Tier 2 (deep) - ~1200ms
└── Tier 0 + Tier 1 + graph traversal + archival search
```

**Incorrect:**

```typescript
// Always fetch everything
async function getContext(userId: string, query: string): Promise<Context> {
  const [presence, memories, graph, archives] = await Promise.all([
    getPresence(userId),
    searchMemories(query),          // BAD: Always runs
    traverseGraph(userId, query),   // BAD: Always runs
    searchArchives(query),          // BAD: Always runs
  ]);
  return { presence, memories, graph, archives };
}
```

**Correct:**

```typescript
type MemoryTier = 0 | 1 | 2;

interface MemoryRouterConfig {
  tier: MemoryTier;
  sources: MemorySource[];
  timeout: number;
}

const tierConfigs: Record<MemoryTier, MemoryRouterConfig> = {
  0: {
    tier: 0,
    sources: ['presence', 'basicStats'],
    timeout: 100,
  },
  1: {
    tier: 1,
    sources: ['presence', 'basicStats', 'vectorSearch', 'recentMemories'],
    timeout: 500,
  },
  2: {
    tier: 2,
    sources: ['presence', 'basicStats', 'vectorSearch', 'recentMemories', 'graphTraversal', 'archivalSearch'],
    timeout: 2000,
  },
};

function selectTier(complexity: ComplexityLevel): MemoryTier {
  switch (complexity) {
    case 'casual': return 0;
    case 'task': return 1;
    case 'planning':
    case 'deep': return 2;
  }
}

async function getContext(
  userId: string,
  query: string,
  complexity: ComplexityLevel
): Promise<Context> {
  const tier = selectTier(complexity);
  const config = tierConfigs[tier];

  const fetchers: Record<MemorySource, () => Promise<any>> = {
    presence: () => getPresence(userId),
    basicStats: () => getBasicStats(userId),
    vectorSearch: () => searchMemories(query),
    recentMemories: () => getRecentMemories(userId),
    graphTraversal: () => traverseGraph(userId, query),
    archivalSearch: () => searchArchives(query),
  };

  const promises = config.sources.map(source => fetchers[source]());

  const results = await Promise.race([
    Promise.all(promises),
    sleep(config.timeout).then(() => { throw new Error('Memory timeout'); }),
  ]).catch(() => {
    // Timeout: return partial results
    console.warn(`[MEMORY] Tier ${tier} timeout, degrading`);
    return [];
  });

  return buildContext(results);
}
```

**Latency Impact:**

| Query Type | Old (all sources) | New (tiered) | Savings |
|------------|-------------------|--------------|---------|
| "Hi" | 1200ms | 50ms | **96%** |
| "Summarize project" | 1200ms | 400ms | **67%** |
| "Analyze market trends" | 1200ms | 1200ms | 0% |

**Average latency reduction: 76%** (weighted by traffic distribution)

# 4. Resilience

##  Fail-Open for the Non-Critical, Fail-Closed for the Sensitive
<sub>`resilience-fail-open`</sub>


> **A non-critical service down is not the application down. A sensitive action in doubt is a denied action, never a guessed one.**

The failure policy is not global. You choose it per dependency, by criticality. Getting this split wrong in either direction is a bug: fail-closed on a cache makes you brittle; fail-open on an authorisation makes you unsafe.

**Fail-open (degrade and continue) for reads and the non-critical:**

```typescript
// Cache failure means slower, not broken.
async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await cache.get<T>(key);
  } catch (error) {
    log.error("[CACHE] get failed, continuing without cache", { error });
    return null;                       // fail-open: continue degraded
  }
}
```

**Fail-closed (deny, explicitly) for the sensitive:**

```typescript
// Authorisation, the grounding guard, a payment: doubt means deny.
async function authorise(req: Request): Promise<void> {
  try {
    const ok = await authz.check(req);
    if (!ok) throw new Forbidden();
  } catch (error) {
    // Never "allow on error". A guard you fail open is not a guard.
    throw new Forbidden();             // fail-closed: deny on doubt
  }
}
```

**Suspend, do not block.** Fail-closed does not mean freezing the process. A sensitive action that needs a human serialises the agent's state and rehydrates it on the decision; low-urgency approvals are batched in a prioritised queue. You get the safety of fail-closed without a frozen agent.

**Service classification:**

| Service / action | Policy | On failure |
|---|---|---|
| Database (read of record) | Critical | Error to the user |
| Model call | Critical | Error after retries |
| Cache | Non-critical | Continue, slower (fail-open) |
| Audit / analytics logging | Non-critical | Log locally, continue (fail-open) |
| Optional enrichment (search, memory) | Non-critical | Skip, continue (fail-open) |
| Authorisation / tenant isolation | Sensitive | Deny (fail-closed) |
| Grounding / safety guard | Sensitive | Reject the response (fail-closed) |
| Payment, irreversible write | Sensitive | Abort + require confirmation (fail-closed) |

**The test that tells them apart:** ask "if this dependency is wrong or absent, is the safe answer *continue* or *deny*?" Continue -> fail-open. Deny -> fail-closed. Anything touching safety, authorisation, money, or the truth of a served figure is fail-closed.

**Checklist:**

- [ ] Every external dependency has an explicit failure policy, chosen by criticality.
- [ ] No safety/authorisation/guard path fails open.
- [ ] No read-side enrichment fails closed and takes the request down with it.
- [ ] Fail-closed sensitive actions suspend-and-rehydrate rather than freeze.

##  LLM Retry with Exponential Backoff
<sub>`resilience-retry-backoff`</sub>


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

##  Retryable vs Non-Retryable Errors
<sub>`resilience-retryable-errors`</sub>


Not all errors should be retried. Distinguishing them prevents wasted time and API calls.

**Error Classification:**

| Retryable (transient) | Non-Retryable (permanent) |
|----------------------|---------------------------|
| `rate_limit_error` | `invalid_request_error` |
| `overloaded_error` | `authentication_error` |
| `api_error` (500s) | `invalid_api_key` |
| Network timeout | `model_not_found` |
| Connection reset | Validation errors |
| `service_unavailable` | `content_policy_violation` |

**Incorrect:**

```typescript
// Retries everything, including permanent errors
async function callLLM(request: Request): Promise<Response> {
  for (let i = 0; i < 3; i++) {
    try {
      return await model.complete(request);
    } catch (error) {
      await sleep(1000 * Math.pow(2, i));  // BAD: Retries invalid_api_key
    }
  }
  throw new Error('Failed after retries');
}
```

**Correct:**

```typescript
const RETRYABLE_ERRORS = new Set([
  'rate_limit_error',
  'overloaded_error',
  'api_error',
  'service_unavailable',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
]);

function isRetryable(error: unknown): boolean {
  if (error instanceof ModelAPIError) {
    // provider SDK specific
    if (error.status === 429) return true;  // Rate limit
    if (error.status >= 500) return true;   // Server error
    return false;  // Client errors (4xx except 429)
  }

  if (error instanceof Error) {
    // Network errors
    return RETRYABLE_ERRORS.has(error.name) ||
           RETRYABLE_ERRORS.has((error as any).code);
  }

  return false;
}

async function callLLM(request: Request): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await model.complete(request);
    } catch (error) {
      lastError = error as Error;

      // Fail fast on permanent errors
      if (!isRetryable(error)) {
        console.error('[LLM] Non-retryable error:', error);
        throw error;
      }

      // Retry with backoff for transient errors
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`[LLM] Retryable error, waiting ${delay}ms:`, error);
      await sleep(delay);
    }
  }

  throw lastError!;
}
```

**HTTP Status Code Guide:**

| Status | Meaning | Retry? |
|--------|---------|--------|
| 400 | Bad Request | No |
| 401 | Unauthorized | No |
| 403 | Forbidden | No |
| 404 | Not Found | No |
| 429 | Rate Limited | **Yes** |
| 500 | Server Error | **Yes** |
| 502 | Bad Gateway | **Yes** |
| 503 | Unavailable | **Yes** |
| 504 | Timeout | **Yes** |

##  Multi-Provider Fallback
<sub>`resilience-multi-provider-fallback`</sub>


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

# 5. Observability and cost

##  Structured JSON Logs
<sub>`observability-structured-json-logs`</sub>


Use structured JSON logs for queryable, parseable logging in production.

**Incorrect:**

```typescript
// Unstructured logs - hard to parse and query
console.log(`User ${userId} created project ${projectId} in ${duration}ms`);
console.log('Error:', error.message);
console.log(`Request from ${req.ip} to ${req.path}`);
```

**Correct:**

```typescript
// Structured logger
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

class StructuredLogger {
  private context: Partial<LogEntry> = {};

  child(context: Partial<LogEntry>): StructuredLogger {
    const child = new StructuredLogger();
    child.context = { ...this.context, ...context };
    return child;
  }

  private log(level: LogEntry['level'], message: string, data: object = {}) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    // Redact sensitive fields
    const redacted = this.redactSensitive(entry);

    console.log(JSON.stringify(redacted));
  }

  private redactSensitive(entry: LogEntry): LogEntry {
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    const redacted = { ...entry };

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  debug(message: string, data?: object) { this.log('debug', message, data); }
  info(message: string, data?: object) { this.log('info', message, data); }
  warn(message: string, data?: object) { this.log('warn', message, data); }
  error(message: string, data?: object) { this.log('error', message, data); }
}

export const logger = new StructuredLogger();

// Usage
logger.info('Project created', {
  userId: 'usr_123',
  projectId: 'prj_456',
  duration: 45,
});

// Output:
// {"level":"info","message":"Project created","timestamp":"2025-01-24T10:30:00.000Z","userId":"usr_123","projectId":"prj_456","duration":45}
```

**Request Context Logger:**

```typescript
// Middleware to add request context
function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  const requestLogger = logger.child({
    requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
  });

  req.logger = requestLogger;

  // Log request start
  requestLogger.info('Request started');

  // Log request end
  const start = Date.now();
  res.on('finish', () => {
    requestLogger.info('Request completed', {
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
}
```

**Log Query Examples (the telemetry sink/Datadog):**

```sql
-- Find slow LLM requests
SELECT * FROM logs
WHERE message = 'LLM request completed'
AND duration > 5000
ORDER BY timestamp DESC

-- Error rate by endpoint
SELECT path, COUNT(*) as errors
FROM logs
WHERE level = 'error'
GROUP BY path
ORDER BY errors DESC
```

##  LLM Metrics Tracking
<sub>`observability-llm-metrics`</sub>


Track comprehensive metrics for every LLM call to enable cost control and optimization.

**Essential Metrics:**

```typescript
interface LLMMetrics {
  // Request metadata
  requestId: string;
  userId: string;
  model: string;
  provider: string;

  // Token usage
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;

  // Performance
  latencyMs: number;
  timeToFirstToken?: number;

  // Cost
  estimatedCost: number;

  // Context
  complexity: string;
  cached: boolean;
  retries: number;

  // Timestamp
  timestamp: Date;
}
```

**Implementation:**

```typescript
// LLM wrapper with metrics
async function completeLLM(request: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();
  const metrics: Partial<LLMMetrics> = {
    requestId: request.requestId,
    userId: request.userId,
    model: request.model,
    provider: llmConfig.provider,
    complexity: request.complexity,
    timestamp: new Date(),
    retries: 0,
  };

  try {
    const response = await withLLMRetry(
      () => llmClient.complete(request),
      { onRetry: () => metrics.retries!++ }
    );

    // Extract usage
    metrics.inputTokens = response.usage.input_tokens;
    metrics.outputTokens = response.usage.output_tokens;
    metrics.cacheReadTokens = response.usage.cache_read_input_tokens || 0;
    metrics.cacheWriteTokens = response.usage.cache_creation_input_tokens || 0;
    metrics.latencyMs = Date.now() - start;
    metrics.cached = metrics.cacheReadTokens > 0;
    metrics.estimatedCost = calculateCost(metrics as LLMMetrics);

    // Log metrics
    logger.info('LLM request completed', metrics);

    // Send to metrics service
    telemetry.record('llm_request', metrics);

    return response;
  } catch (error) {
    logger.error('LLM request failed', {
      ...metrics,
      error: error.message,
      latencyMs: Date.now() - start,
    });
    throw error;
  }
}

// Cost calculation
function calculateCost(metrics: LLMMetrics): number {
  const pricing = MODEL_PRICING[metrics.model];

  // Cache read tokens are discounted (90% off on some providers)
  const effectiveInputTokens =
    metrics.inputTokens - metrics.cacheReadTokens * 0.9;

  return (
    (effectiveInputTokens * pricing.input +
    metrics.outputTokens * pricing.output) / 1_000_000
  );
}
```

**Aggregated Metrics:**

```typescript
// Daily cost aggregation
interface DailyMetrics {
  date: string;
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  cacheHitRate: number;
  modelBreakdown: Record<string, { requests: number; cost: number }>;
  errorRate: number;
}

async function aggregateDailyMetrics(date: string): Promise<DailyMetrics> {
  const metrics = await db.llmMetrics.findMany({
    where: { date: startOfDay(date) },
  });

  return {
    date,
    totalRequests: metrics.length,
    totalCost: sum(metrics.map(m => m.estimatedCost)),
    avgLatency: avg(metrics.map(m => m.latencyMs)),
    cacheHitRate: metrics.filter(m => m.cached).length / metrics.length,
    modelBreakdown: groupByModel(metrics),
    errorRate: metrics.filter(m => m.error).length / metrics.length,
  };
}
```

**Alert Thresholds:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Cost/day | >$50 | >$100 |
| Error rate | >2% | >5% |
| P95 latency | >5s | >10s |
| Cache hit rate | <50% | <30% |

##  Alert Configuration
<sub>`observability-alert-configuration`</sub>


Configure alerts to catch issues before they impact users.

**Alert Tiers:**

| Tier | Response Time | Examples |
|------|---------------|----------|
| P0 - Critical | <15 min | Service down, data loss |
| P1 - High | <1 hour | Error rate spike, degraded performance |
| P2 - Medium | <4 hours | Elevated latency, cache degradation |
| P3 - Low | Next business day | Cost anomaly, capacity warning |

**Recommended Alerts:**

```yaml
# alerts.yaml
alerts:
  # P0 - Critical
  - name: service_down
    condition: healthcheck_failures > 3
    window: 5m
    severity: critical
    notify: [pagerduty, slack-critical]

  - name: error_rate_critical
    condition: error_rate > 10%
    window: 5m
    severity: critical
    notify: [pagerduty, slack-critical]

  # P1 - High
  - name: error_rate_elevated
    condition: error_rate > 5%
    window: 5m
    severity: high
    notify: [slack-alerts]

  - name: llm_provider_failing
    condition: llm_error_rate > 5%
    window: 5m
    severity: high
    notify: [slack-alerts]

  - name: latency_degraded
    condition: p95_latency > 5000ms
    window: 10m
    severity: high
    notify: [slack-alerts]

  # P2 - Medium
  - name: cache_hit_low
    condition: cache_hit_rate < 50%
    window: 30m
    severity: medium
    notify: [slack-engineering]

  - name: db_connections_high
    condition: db_pool_usage > 80%
    window: 15m
    severity: medium
    notify: [slack-engineering]

  # P3 - Low
  - name: daily_cost_anomaly
    condition: daily_cost > 2x avg_daily_cost
    window: 24h
    severity: low
    notify: [email-team]

  - name: disk_space_warning
    condition: disk_usage > 70%
    window: 1h
    severity: low
    notify: [slack-engineering]
```

**Implementation with the telemetry sink:**

```typescript
// Alert configuration in code
const alertRules = [
  {
    name: 'High Error Rate',
    query: `
      SELECT count(*) as errors
      FROM logs
      WHERE level = 'error'
      AND timestamp > now() - 5m
    `,
    threshold: { errors: 100 },
    severity: 'high',
    channels: ['slack-alerts'],
  },
  {
    name: 'LLM Cost Spike',
    query: `
      SELECT sum(estimatedCost) as cost
      FROM llm_metrics
      WHERE timestamp > now() - 1h
    `,
    threshold: { cost: 50 },
    severity: 'medium',
    channels: ['slack-engineering'],
  },
];

// Alert evaluation
async function evaluateAlerts() {
  for (const rule of alertRules) {
    const result = await telemetry.query(rule.query);

    if (exceedsThreshold(result, rule.threshold)) {
      await sendAlert({
        name: rule.name,
        severity: rule.severity,
        channels: rule.channels,
        data: result,
      });
    }
  }
}

// Run every minute
cron.schedule('* * * * *', evaluateAlerts);
```

**Alert Message Format:**

```typescript
interface AlertMessage {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  metrics: Record<string, number>;
  runbook?: string;
  dashboardUrl?: string;
}

// Example Slack message
const message = {
  title: 'High Error Rate Detected',
  severity: 'high',
  summary: 'Error rate exceeded 5% threshold for 5 minutes',
  metrics: {
    errorRate: 7.2,
    errorCount: 156,
    affectedEndpoints: 3,
  },
  runbook: 'https://wiki/runbooks/high-error-rate',
  dashboardUrl: 'https://grafana/d/errors',
};
```

##  Log Providers at Startup
<sub>`observability-startup-provider-log`</sub>


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
  realtime: true,
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

##  Request ID Propagation
<sub>`patterns-request-id-propagation`</sub>


Propagate a unique request ID through all services for end-to-end tracing.

**Implementation:**

```typescript
// src/lib/context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string {
  return getRequestContext()?.requestId || 'no-request-id';
}

// Middleware
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  const context: RequestContext = {
    requestId,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
    startTime: Date.now(),
  };

  // Set response header
  res.setHeader('x-request-id', requestId);

  // Run handler within context
  asyncLocalStorage.run(context, () => next());
}
```

**Logger Integration:**

```typescript
// src/lib/logger.ts
import { getRequestContext } from './context';

class Logger {
  private log(level: string, message: string, data: object = {}) {
    const ctx = getRequestContext();

    console.log(JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      tenantId: ctx?.tenantId,
      ...data,
    }));
  }

  info(message: string, data?: object) { this.log('info', message, data); }
  error(message: string, data?: object) { this.log('error', message, data); }
  // ...
}

export const logger = new Logger();
```

**Propagate to External Services:**

```typescript
// Include requestId in external API calls
async function callExternalService(endpoint: string, data: object) {
  const requestId = getRequestId();

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,  // Propagate to external service
    },
    body: JSON.stringify(data),
  });
}

// Include in LLM metadata
async function callLLM(request: LLMRequest) {
  const requestId = getRequestId();

  return model.complete({
    ...request,
    metadata: {
      user_id: getRequestContext()?.userId,
      request_id: requestId,  // Appears in the provider dashboard
    },
  });
}
```

**Database Query Tagging:**

```typescript
// Tag queries with request ID for debugging
async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const requestId = getRequestId();

  // Add comment with request ID (visible in slow query logs)
  const taggedSql = `/* requestId=${requestId} */ ${sql}`;

  return db.query(taggedSql, params);
}
```

**Full Request Trace Example:**

```
[2025-01-24T10:30:00.000Z] {"level":"info","message":"Request started","requestId":"abc-123","path":"/api/chat"}
[2025-01-24T10:30:00.050Z] {"level":"info","message":"Memory retrieval","requestId":"abc-123","memories":5}
[2025-01-24T10:30:00.100Z] {"level":"info","message":"LLM request started","requestId":"abc-123","model":"balanced"}
[2025-01-24T10:30:02.500Z] {"level":"info","message":"LLM request completed","requestId":"abc-123","tokens":1234}
[2025-01-24T10:30:02.550Z] {"level":"info","message":"Request completed","requestId":"abc-123","duration":2550}
```

##  Prompt Cache Stability (a Cost Lever, Provider-Specific)
<sub>`cache-three-tier-architecture`</sub>


This is a **cost lever, not an architecture principle.** Cost is driven first by the model boundary (keep deterministic work out of the model) and by routing; prompt caching is a secondary optimisation, and only where the provider bills a cached prefix cheaper than a fresh one. Reach for it once cost is measured and the prompt has a genuinely stable prefix, not before.

> **Cache stability beats token reduction.** A layer that varies between requests gets a 0% cache hit and costs more than the same layer sent stable. A 15K-token stable prefix at 90% hit is cheaper than a 10K-token prefix at 0%.

**Order the prompt from most stable to most dynamic, and mark the stable cut points:**

```
Layer 1 - CORE      identity, methodology, format, safety rules   changes: never (mid-session)
Layer 2 - TOOLS     generic tool schemas and guidelines           changes: on feature updates
Layer 3 - DYNAMIC   retrieved context, history, the user message  changes: every request
```

**Correct:**

```typescript
const response = await model.complete({
  system: [
    { text: corePrompt,  cacheable: true },   // stable prefix, cached
    { text: toolsPrompt, cacheable: true },   // semi-stable, cached
    { text: dynamicContext },                 // never cached
  ],
  messages,
});
```

**What breaks a cache (anti-patterns):** injecting user/tenant data into Layer 1-2, timestamps in stable layers, conditionally including sections, reordering content within a cached layer. Keep variable content in Layer 3, always.

**Measure it or skip it:** track cache-read vs cache-write tokens in your LLM metrics. If the hit rate on the stable prefix is not materially above zero, the prefix is not actually stable and the lever is doing nothing.

**Checklist:**

- [ ] Cost is measured first; caching is applied as a deliberate lever, not by default.
- [ ] The stable prefix is byte-identical across requests (no per-request variation).
- [ ] Variable content lives only in the dynamic layer.
- [ ] Cache hit rate on the stable prefix is monitored, not assumed.

##  Smart Routing by Complexity
<sub>`routing-smart-complexity`</sub>


Route requests to the appropriate model based on complexity. Not every request needs Deep.

**The Problem:**

Everything goes to the same model, even "Hello" or "OK thanks".

**Routing Pattern:**

```
User message
        ↓
detectWithRegex() → confidence ≥ 0.6?
    ├─ YES → Use this result (~1ms, $0)
    └─ NO → detectWithFastModel() (~100ms, ~$0.0003)
              ↓
        ComplexityLevel
              ↓
    ┌─────────┴─────────┐
    │   Smart Routing   │
    └─────────┬─────────┘
              ↓
    casual   → Fast      ($0.005/req)   ~25%
    task     → Balanced     ($0.025/req)   ~45%
    planning → Balanced     ($0.025/req)   ~20%
    deep     → Deep       ($0.10/req)    ~10%
```

**Incorrect:**

```typescript
// Same model for everything
const response = await model.complete({
  model: 'mid-tier-model',  // BAD: Always Balanced
  messages,
});
```

**Correct:**

```typescript
type ComplexityLevel = 'casual' | 'task' | 'planning' | 'deep';

interface ComplexityResult {
  level: ComplexityLevel;
  confidence: number;
}

// Step 1: Try regex first (free, instant)
function detectWithRegex(message: string): ComplexityResult | null {
  const casualPatterns = [
    /^(hi|hello|hey|thanks|ok|bye)/i,
    /^(yes|no|sure|got it)/i,
  ];

  const deepPatterns = [
    /compare.*and.*analyze/i,
    /design.*architecture/i,
    /evaluate.*strategy/i,
  ];

  for (const pattern of casualPatterns) {
    if (pattern.test(message)) {
      return { level: 'casual', confidence: 0.8 };
    }
  }

  for (const pattern of deepPatterns) {
    if (pattern.test(message)) {
      return { level: 'deep', confidence: 0.7 };
    }
  }

  return null;  // Fallback to LLM classification
}

// Step 2: Use Fast for uncertain cases
async function detectComplexity(message: string): Promise<ComplexityResult> {
  const regexResult = detectWithRegex(message);
  if (regexResult && regexResult.confidence >= 0.6) {
    return regexResult;
  }

  // Use Fast for classification (~$0.0003)
  return await classifyWithFastModel(message);
}

// Step 3: Select model
function selectModel(result: ComplexityResult): string {
  if (result.confidence < 0.6) {
    return upgradeModel(result.level);  // Safety upgrade
  }

  switch (result.level) {
    case 'casual': return 'small-fast-model';
    case 'task':
    case 'planning': return 'mid-tier-model';
    case 'deep': return 'top-tier-model';
  }
}
```

**Expected Distribution:**

| Level | Model | % Traffic | Cost |
|-------|-------|-----------|------|
| casual | Fast | 25% | $0.005 |
| task | Balanced | 45% | $0.025 |
| planning | Balanced | 20% | $0.025 |
| deep | Deep | 10% | $0.10 |

**Weighted average: ~$0.028/request** (vs $0.06 if all Balanced)

##  If Doubt, Upgrade the Model
<sub>`routing-confidence-upgrade`</sub>


When the complexity classifier isn't confident, always upgrade to a more capable model. The cost of a wrong downgrade (poor response) exceeds the cost of unnecessary upgrade.

**The Rule:**

> **CRITICAL: If confidence < 0.6, ALWAYS upgrade to the next tier.**

**Incorrect:**

```typescript
// Uses lower model even when uncertain
function selectModel(complexity: ComplexityResult): Model {
  switch (complexity.level) {
    case 'casual': return 'fast';
    case 'task': return 'balanced';
    case 'deep': return 'deep';
  }
  // BAD: No confidence check - may misroute
}
```

**Correct:**

```typescript
interface ComplexityResult {
  level: 'casual' | 'task' | 'planning' | 'deep';
  confidence: number;  // 0-1
}

function selectModel(complexity: ComplexityResult): Model {
  const { level, confidence } = complexity;

  // If confidence is low, upgrade to be safe
  if (confidence < 0.6) {
    console.info(`[ROUTING] Low confidence (${confidence}), upgrading from ${level}`);
    return upgradeModel(level);
  }

  switch (level) {
    case 'casual': return 'fast';
    case 'task':
    case 'planning': return 'balanced';
    case 'deep': return 'deep';
  }
}

function upgradeModel(level: string): Model {
  switch (level) {
    case 'casual': return 'balanced';   // fast → balanced
    case 'task': return 'balanced';     // stay balanced
    case 'planning': return 'deep';   // balanced → deep
    case 'deep': return 'deep';       // stay deep
    default: return 'balanced';         // safe default
  }
}
```

**Cost Analysis:**

| Scenario | Model | Cost | Quality Risk |
|----------|-------|------|--------------|
| Confident casual → Fast | $0.005 | Low |
| Uncertain casual → Fast | $0.005 | **HIGH** (wrong model) |
| Uncertain casual → Balanced | $0.025 | Low |

**The Math:**

- Wrong model = user frustration + retry = 2x cost minimum
- Upgrade cost = 5x base (Balanced vs Fast)
- But: upgrade only when uncertain (~30% of cases)
- Net: slight cost increase, major quality improvement

**Detection Flow:**

```
Message → detectWithRegex() → confidence ≥ 0.6?
    ├─ YES → Use regex result
    └─ NO → detectWithFastModel() → confidence ≥ 0.6?
              ├─ YES → Use Fast result
              └─ NO → UPGRADE MODEL
```

##  Model Cost Ratios
<sub>`routing-model-cost-ratios`</sub>


Understanding cost ratios is essential for routing decisions.

**Cost ratios (illustrative orders of magnitude, verify current vendor prices):**

| Model | Input ($/M tokens) | Output ($/M tokens) | Ratio vs Balanced |
|-------|-------------------|---------------------|-----------------|
| Fast | $0.25 | $1.25 | **0.08x** |
| Balanced | $3.00 | $15.00 | 1.0x |
| Deep | $15.00 | $75.00 | 5.0x |

**Cost per typical request:**

| Model | Typical Request Cost | Use Case |
|-------|---------------------|----------|
| Fast | ~$0.005 | Greetings, simple Q&A, confirmations |
| Balanced | ~$0.025 | Standard tasks, analysis, coding |
| Deep | ~$0.10 | Complex reasoning, architecture, deep analysis |

**Key Insight:**

> Fast is **12x cheaper** than Balanced.
> Using Fast for 25% of traffic saves ~$0.015/request average.

**Incorrect:**

```typescript
// No cost awareness
const model = 'mid-tier-model';  // Always mid-tier
```

**Correct:**

```typescript
const MODEL_COSTS = {
  'small-fast-model': { input: 0.25, output: 1.25 },
  'mid-tier-model': { input: 3.00, output: 15.00 },
  'top-tier-model': { input: 15.00, output: 75.00 },
} as const;

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model];
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// Log costs for monitoring
console.info('[LLM] Request completed', {
  model,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  estimatedCost: estimateCost(model, response.usage.input_tokens, response.usage.output_tokens),
});
```

**Cost Optimization Levers:**

1. **Smart routing** → Use Fast when possible (-40% average)
2. **Cache optimization** → Reduce input tokens (-60% on cached)
3. **Output limits** → Constrain max_tokens where appropriate
4. **Prompt engineering** → Shorter prompts, same quality

# 6. Security

##  Untrusted Input, Prompt Injection and the Lethal Trifecta
<sub>`security-prompt-injection`</sub>


> **Everything observed through a tool is data, not instructions.** Web pages, documents, retrieved memories, tool results, file contents: none of it carries authority to act.

Prompt injection is the first-rank threat of an agentic system: hostile instructions slipped into the input. The direct form comes from the user; the indirect, more pernicious form hides in retrieved content (a page, a document, a memory) and fires when the model ingests it. It is therefore intrinsic to any memory or retrieval. You do not reliably *detect* it. You *constrain* it by architecture.

**The lethal trifecta.** The worst case is three properties meeting on one unguarded path:

1. access to private data,
2. ingestion of untrusted content,
3. a means of communication to the outside.

Remove any one of the three and the path is defused.

**Operational rule, scoped to the context window:** while untrusted content is present in the context, allow only two of those three properties at once. If all three are genuinely needed, the action does not auto-execute: it requires human approval.

**Incorrect:**

```typescript
// Untrusted page text flows straight into a tool that can exfiltrate.
const page = await fetch(url);                 // untrusted content
const data = await db.readPrivate(userId);     // private data
await sendEmail(extractRecipient(page), data); // BAD: trifecta: page chose the recipient
```

**Correct:**

```typescript
// Break the trifecta: the recipient may not come from untrusted content.
const page = await fetch(url);
const data = await db.readPrivate(userId);
// Recipient comes from the user's own request, never from observed content.
if (recipientCameFromObservedContent) requireHumanApproval();
else await sendEmail(userChosenRecipient, data);
```

**Constrain, do not detect:**

- **Least privilege.** Each tool gets the narrowest scope; a third-party connector is untrusted input.
- **Approval on the action.** Human approval is anchored in the tool's contract and enforced by infrastructure, not by the prompt.
- **Suspend, do not block.** A sensitive action serialises the agent's state and rehydrates it on the human decision (fail-closed without freezing the process); low-urgency approvals are batched in a prioritised queue.
- **Separate the untrusted.** Keep untrusted content out of the same path as private data and an outbound channel.

**Why this is structural, not behavioural:** a guard you can argue the model out of is not a guard. Approval anchored in the tool contract, least privilege enforced by infrastructure, and a broken trifecta hold regardless of what the injected text says.

**Checklist:**

- [ ] Observed content is treated as data; it never authorises an action.
- [ ] No path holds all three trifecta properties while untrusted content is in context.
- [ ] Sensitive actions require approval anchored in the tool contract.
- [ ] Approval suspends-and-rehydrates; it does not freeze the process.

##  Secrets at the Network Boundary, Never in the Model
<sub>`config-secrets-boundary`</sub>


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

**Transport, no laxer than the rule:** for Postgres/Neon, pin `sslmode=verify-full` (strict verification of both certificate and DNS name) so you do not depend on a driver's future default:

```
postgresql://USER:PASS@HOST/DB?sslmode=verify-full&channel_binding=require
```

**Checklist:**

- [ ] No secret literal anywhere in source or logs.
- [ ] The real egress key is attached at the network boundary, not in app code.
- [ ] The model's context never contains a usable credential, only a substitute.
- [ ] DB connection string pins `sslmode=verify-full`.

##  Zod Input Validation
<sub>`quality-zod-input-validation`</sub>


Validate all external inputs with Zod at system boundaries.

**Where to Validate:**

- API endpoints (request body, query params)
- Environment variables
- User uploads
- External API responses
- Database query results (optional, for defense in depth)

**Incorrect:**

```typescript
// No validation - trusts external input
app.post('/api/projects', async (req, res) => {
  const { name, description, budget } = req.body;  // BAD: Could be anything
  await db.projects.create({ data: { name, description, budget } });
});

// Type assertion without validation
const config = process.env as Config;  // BAD: Not validated
```

**Correct:**

```typescript
import { z } from 'zod';

// Define schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  budget: z.number().positive().optional(),
  tags: z.array(z.string()).max(10).optional(),
});

type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// Validate at API boundary
app.post('/api/projects', async (req, res) => {
  // Parse throws ZodError if invalid
  const input = CreateProjectSchema.parse(req.body);

  // input is now typed and validated
  await db.projects.create({ data: input });
});

// Or with safe parsing
app.post('/api/projects', async (req, res) => {
  const result = CreateProjectSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten(),
    });
  }

  await db.projects.create({ data: result.data });
});
```

**Environment Variables:**

```typescript
// src/lib/env.ts
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  MODEL_API_KEY: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Validate once at startup
export const env = EnvSchema.parse(process.env);

// Usage: env.DATABASE_URL is typed and validated
```

**API Response Validation:**

```typescript
// Validate external API responses
const ExternalAPIResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
  })),
  meta: z.object({
    page: z.number(),
    total: z.number(),
  }),
});

async function fetchExternalData(): Promise<ExternalAPIResponse> {
  const response = await fetch('https://api.external.com/data');
  const json = await response.json();

  // Validate response matches expected shape
  return ExternalAPIResponseSchema.parse(json);
}
```

**Error Handling:**

```typescript
// Middleware for Zod error handling
function zodErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  next(err);
}
```

# 7. Evaluation

##  Evaluation Loop (Test + Evaluate, Hold-out, Anchored Judge)
<sub>`eval-loop`</sub>


> **A deterministic system is tested. An agentic system is tested *and* evaluated.**

The code around the agent is verified like any software (unit, integration, contract). The agent's behaviour is non-deterministic, so it needs a second instrument: an evaluation rubric replayed over scenarios, scored over time.

**Two distinct instruments, never confused:**

| | Test | Evaluation |
|---|---|---|
| Subject | Deterministic code | Agent behaviour |
| Verdict | Pass / fail | Score on a rubric |
| Guarantee | Hard | Behavioural signal |
| Owns | Safety, authorisation, schema, idempotency | Faithfulness, clarity, abstention quality |

**Abstention is scored.** For a grounded system, refusing to invent a figure counts as much as recalling one. A hallucinated number where the agent should have abstained is the worst outcome, scored zero, even if the rest is perfect.

**The hold-out is non-manipulable.** A naive closed loop that optimises the judge's score drifts toward what flatters the judge without improving real quality. What makes self-tuning safe is a guard the optimiser never sees: a hold-out with verifiable ground truth that triggers a rollback when the hallucination rate climbs. The hold-out is only valid where ground truth is verifiable; for purely subjective quality, the net is a human sample and the self-tuning envelope stays narrow.

**The judge is anchored.** The model that scores behavioural quality is frozen in version; on any judge change you replay an anchoring set to recalibrate, otherwise the quality series becomes incomparable in silence. The judge covers only irreducible behavioural quality. The hard floor (is the figure exactly the one in the store, is the source the right one) stays deterministic, compared directly to the store, never handed to the judge.

**No chorus of verifiers replaces a deterministic guard.** Stacking fallible LLM checkers that re-read each other does not manufacture a hard property: their errors correlate (shared data, shared blind spots), an adversarial input that fools one fools the chorus, and each check is one more slow, costly inference where a deterministic control is free and certain. Deterministic for what admits a guarantee; judge only for behavioural quality; always under the hold-out.

**The loop is open at the action boundary.** It produces signals and recommendations. Acting on them goes through a bounded, audited tuning envelope or a human decision, never an autonomous rewrite of the agent.

**Eval runbook (per scenario):**

```
Add     describe the multi-turn conversation, the final question,
        the expected and forbidden terms, the capability targeted.
Run     replay the turns in order against the current system,
        ask the final question, compare to expected/forbidden terms.
Score   apply the rubric, track the score per capability over time
        to catch behavioural regressions.
```

**Continuous faithfulness metric (monitoring, not gating):** alongside the deterministic guard, run a faithfulness metric of the RAGAS / FActScore family over a traffic sample: decompose each synthesis into atomic claims, verify each against the served facts and their source, aggregate into a per-request score and a time series. The guard blocks; the metric alerts. They are complementary.

**Checklist:**

- [ ] Tests and evaluation are separate; safety lives in tests, not in the rubric.
- [ ] Abstention is a scored capability.
- [ ] A non-manipulable hold-out with verifiable ground truth gates regressions.
- [ ] The judge is version-anchored; the deterministic floor never goes to the judge.
- [ ] Acting on eval signals is bounded-and-audited or human, never autonomous.

# 8. Process and evidence

##  ADR Discipline and Working Journal
<sub>`process-adr-and-journal`</sub>


A structural decision that lives only in someone's head is a decision that will be re-debated. Two lightweight records keep the system legible: ADRs for structural choices, a journal for the running thread.

**ADR (Architecture Decision Record):**

- One ADR per structural decision: a boundary, a port, a model, a persistence choice, a safety guard.
- An accepted ADR is **never edited**. A new decision that changes it is a **new ADR that supersedes or refines** the old one (the trail stays intact).
- Each ADR records its **trigger**: the objective signal that would reopen it. "Default: sober; trigger: this measured condition." A decision with no trigger is a decision you cannot revisit on evidence.

```
# ADR-008 - Grounding guard over an expanded set
Status: accepted · Refines: ADR-001 · Date: 2026-06-22
Context: the guard rejected a legitimate figure present in a served fact's label.
Decision: the grounded set = fact values ∪ numbers in served labels ∪ years.
Trigger to revisit: wiring the model in structured outputs -> switch to {fN}
                    slot references -> write ADR-009 at that point.
Consequences: the unit test now feeds realistic facts with their labels.
```

**Journal (one entry per working session):**

```
## YYYY-MM-DD - short title
- Done: ...
- Decided: ... (if structural, point to ADR-xxx)
- Blocked / to dig: ...
- Next: ...
```

The journal carries minor decisions and progress; structural ones graduate to an ADR. Together they answer "why is it like this?" without archaeology.

**Commits and the code as evidence:**

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) so history is scannable.
- The code is the final proof: a decision that matters has a test, a guard, or a runnable check that demonstrates it. An ADR points at that proof, it does not replace it.

**Checklist:**

- [ ] Every structural choice has an ADR with an explicit revisit trigger.
- [ ] Accepted ADRs are immutable; change means a new, superseding ADR.
- [ ] A journal entry closes each session (done / decided / blocked / next).
- [ ] Decisions that matter are backed by a test or guard in the code.

##  Config Typing with Zod
<sub>`config-typing-zod`</sub>


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

##  Codebase Metrics Thresholds
<sub>`quality-codebase-metrics`</sub>


Monitor codebase health with these thresholds.

**File Size Thresholds:**

| Metric | Warning | Refactor Needed |
|--------|---------|-----------------|
| File > 300 lines | ⚠️ | > 500 lines |
| Function > 50 lines | ⚠️ | > 100 lines |
| Cyclomatic complexity > 10 | ⚠️ | > 15 |
| Nesting depth > 4 | ⚠️ | > 6 |

**Code Smell Indicators:**

| Pattern | Threshold | Action |
|---------|-----------|--------|
| Switch statement cases | > 10 | Use registry pattern |
| Function parameters | > 5 | Use options object |
| Class methods | > 15 | Split class |
| Import statements | > 20 | Check for god file |
| Tools count | > 30 | Group by domain |
| In-memory Maps | Any | Document for scaling |

**Automated Checks:**

```typescript
// scripts/codebase-metrics.ts
import * as fs from 'fs';
import * as path from 'path';

interface FileMetrics {
  path: string;
  lines: number;
  functions: number;
  maxFunctionLength: number;
  imports: number;
  switchCases: number;
}

function analyzeFile(filePath: string): FileMetrics {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  return {
    path: filePath,
    lines: lines.length,
    functions: (content.match(/function\s+\w+|=>\s*{|\w+\s*\([^)]*\)\s*{/g) || []).length,
    maxFunctionLength: calculateMaxFunctionLength(content),
    imports: (content.match(/^import\s+/gm) || []).length,
    switchCases: (content.match(/case\s+/g) || []).length,
  };
}

function reportIssues(metrics: FileMetrics[]): void {
  const issues: string[] = [];

  for (const file of metrics) {
    if (file.lines > 500) {
      issues.push(`${file.path}: ${file.lines} lines (max 500)`);
    } else if (file.lines > 300) {
      issues.push(`${file.path}: ${file.lines} lines (warning > 300)`);
    }

    if (file.switchCases > 20) {
      issues.push(`${file.path}: ${file.switchCases} switch cases - use registry pattern`);
    }

    if (file.imports > 20) {
      issues.push(`${file.path}: ${file.imports} imports - possible god file`);
    }
  }

  if (issues.length > 0) {
    console.log('Codebase Issues Found:');
    issues.forEach(i => console.log(i));
    process.exit(1);  // Fail CI
  } else {
    console.log('yes No codebase issues found');
  }
}
```

**ESLint Rules:**

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-depth': ['warn', 4],
    'max-params': ['warn', 5],
    'complexity': ['warn', 10],
  },
};
```

**PR Checklist:**

```markdown
## Code Quality Checklist
- [ ] No file exceeds 500 lines
- [ ] No function exceeds 100 lines
- [ ] No switch with > 10 cases
- [ ] New Maps documented for scaling
- [ ] Complex logic has comments
```

##  Day-Zero Project Setup Checklist
<sub>`checklist-day-zero-project`</sub>


The foundation to lay before the first feature. Sober by default: only what runs everywhere, with the disciplines that are expensive to retrofit wired from commit one.

```
ARCHITECTURE (30 min)
├── [ ] Hexagonal structure (core/, adapters/, infrastructure/)
├── [ ] Ports defined (even if empty); the model is one of them
├── [ ] Config typed and validated once with Zod (no scattered process.env)
├── [ ] Unified error model
└── [ ] Structured JSON logger with request-id propagation

BOUNDARIES (15 min)  [the boundary disciplines]
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

This is the layout of the reference floor (`floor-ts/` in the Runward repo); follow it so every project built from it speaks the same structure.

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

##  Pre-Production Security Checklist
<sub>`checklist-pre-production-security`</sub>


Security items that MUST be validated before any production deployment.

```
SECURITY CHECKLIST
├── [ ] Secrets in env vars only (not in code, not in logs)
├── [ ] Input validation with Zod on ALL external inputs
├── [ ] Rate limiting configured and tested
├── [ ] CORS configured (specific origins, not '*')
├── [ ] Security headers set (CSP, HSTS, X-Frame-Options)
├── [ ] SQL injection protection (parameterized queries)
├── [ ] XSS protection (output encoding)
├── [ ] Authentication on all protected routes
├── [ ] Authorization checks (tenant isolation)
├── [ ] Prompt injection: observed content is data; lethal trifecta broken on the context window
├── [ ] Grounding guard on any model output that surfaces facts (fail-closed)
├── [ ] Secret never reaches the model (substitute only; real key at the network boundary)
└── [ ] Dependency audit (npm audit / yarn audit)
```

**Incorrect:**

```typescript
// Secrets in code
const apiKey = "sk-abc123...";  // BAD: 

// No input validation
app.post('/api/project', async (req, res) => {
  const { name, data } = req.body;  // BAD: Unvalidated
  await db.insert(projects).values({ name, data });
});

// CORS wide open
app.use(cors({ origin: '*' }));  // BAD: 
```

**Correct:**

```typescript
// Secrets from environment
const apiKey = process.env.API_KEY;

// Zod validation
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  data: z.record(z.unknown()),
});

app.post('/api/project', async (req, res) => {
  const validated = CreateProjectSchema.parse(req.body);  // GOOD: 
  await db.insert(projects).values(validated);
});

// Specific CORS origins
app.use(cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true,
}));
```

**Security Headers (set at the edge or in the framework):**

```typescript
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

##  Pre-Production Resilience Checklist
<sub>`checklist-pre-production-resilience`</sub>


Resilience items that MUST be validated before any production deployment.

```
RESILIENCE CHECKLIST
├── [ ] LLM retry with exponential backoff
├── [ ] Timeout on ALL external requests (LLM, APIs, DB)
├── [ ] Healthcheck endpoint (/health or /api/health)
├── [ ] Readiness probe (for Kubernetes)
├── [ ] Graceful shutdown (handle SIGTERM)
├── [ ] Fallback providers configured (a model gateway or manual)
├── [ ] Circuit breaker for flaky services
├── [ ] Fail-open for non-critical services
└── [ ] Error boundaries in UI (React)
```

**Incorrect:**

```typescript
// No timeout, no retry
const response = await fetch(externalApi);  // BAD: Can hang forever

// No graceful shutdown
process.on('SIGTERM', () => process.exit(0));  // BAD: Drops in-flight requests
```

**Correct:**

```typescript
// Timeout on external calls
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(externalApi, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}

// Graceful shutdown
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  console.info('[SHUTDOWN] Received SIGTERM, starting graceful shutdown');
  isShuttingDown = true;

  // Stop accepting new requests
  server.close();

  // Wait for in-flight requests (max 30s)
  await Promise.race([
    waitForInflightRequests(),
    sleep(30000),
  ]);

  // Close database connections
  await db.destroy();

  console.info('[SHUTDOWN] Graceful shutdown complete');
  process.exit(0);
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness probe (checks dependencies)
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});
```

**LLM Retry Configuration:**

```typescript
const LLM_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['rate_limit_error', 'overloaded_error', 'api_error'],
};
```

##  Pre-Production Observability Checklist
<sub>`checklist-pre-production-observability`</sub>


Observability items to validate before production deployment.

```
OBSERVABILITY CHECKLIST
├── [ ] Structured logs (JSON format)
├── [ ] Request ID propagated through all services
├── [ ] LLM metrics tracked (tokens, cost, latency, model)
├── [ ] Error rates tracked and alerted
├── [ ] Alerts configured for critical metrics
├── [ ] Dashboard for operational monitoring
├── [ ] Log retention policy defined
└── [ ] Sensitive data redacted from logs
```

**Structured Logging:**

```typescript
// BAD: Incorrect: unstructured logs
console.log(`User ${userId} created project ${projectId}`);

// GOOD: Correct: structured JSON
logger.info('Project created', {
  userId,
  projectId,
  tenantId,
  requestId: ctx.requestId,
  duration: Date.now() - start,
});
```

**Request ID Propagation:**

```typescript
// Middleware to create/propagate request ID
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  // Add to async local storage for logging
  asyncLocalStorage.run({ requestId }, next);
}

// All logs include requestId
const logger = {
  info(message: string, data: object) {
    const ctx = asyncLocalStorage.getStore();
    console.log(JSON.stringify({
      level: 'info',
      message,
      requestId: ctx?.requestId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
};
```

**LLM Metrics:**

```typescript
// Track every LLM call
interface LLMMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  estimatedCost: number;
}

function logLLMMetrics(metrics: LLMMetrics) {
  logger.info('LLM request completed', metrics);

  // Send to metrics service
  telemetry.record('llm_request', {
    ...metrics,
    timestamp: Date.now(),
  });
}
```

**Alert Configuration:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 5% over 5 min | Page on-call |
| LLM latency P95 | > 5s | Investigate |
| Cache hit rate | < 50% | Investigate |
| Cost per request | > $0.10 | Review routing |

##  Pre-Production Performance Checklist
<sub>`checklist-pre-production-performance`</sub>


Performance items to validate before production deployment.

```
PERFORMANCE CHECKLIST
├── [ ] LLM cache 3-tier implemented
├── [ ] Smart routing active (Fast/Balanced/Deep)
├── [ ] DB connection pooling configured
├── [ ] DB queries indexed (check slow query log)
├── [ ] Frontend assets optimized (images, bundle) if a UI is served
├── [ ] Code splitting enabled
├── [ ] Bundle size analyzed (<500KB initial)
├── [ ] API response times measured (<200ms P95 for non-LLM)
└── [ ] Load testing completed
```

**Cache Verification:**

```typescript
// Log cache hit rates at startup and periodically
setInterval(() => {
  const stats = cacheStats.get();
  logger.info('Cache statistics', {
    layer1HitRate: stats.layer1.hits / stats.layer1.total,
    layer2HitRate: stats.layer2.hits / stats.layer2.total,
    totalSavings: stats.estimatedSavings,
  });
}, 60000);

// Alert if cache performance degrades
if (stats.layer1HitRate < 0.8) {
  logger.warn('Layer 1 cache hit rate below threshold', { rate: stats.layer1HitRate });
}
```

**Database Performance:**

```typescript
// Enable slow query logging
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// Log slow queries
pool.on('query', (event) => {
  if (event.duration > 100) {  // > 100ms
    logger.warn('Slow query detected', {
      query: event.query.substring(0, 200),
      duration: event.duration,
    });
  }
});
```

**Bundle Analysis:**

```bash
# Analyze bundle size
npm run build -- --analyze

# Check for large dependencies
npx @next/bundle-analyzer
```

**Load Testing:**

```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustain
    { duration: '2m', target: 100 },  // Spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Performance Targets:**

| Metric | Target | Critical |
|--------|--------|----------|
| API response (non-LLM) | <200ms P95 | >500ms |
| LLM response (Fast) | <500ms P95 | >2s |
| LLM response (Balanced) | <2s P95 | >5s |
| Initial bundle size | <500KB | >1MB |
| Cache hit rate (L1) | >80% | <60% |
