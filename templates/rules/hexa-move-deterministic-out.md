---
title: Move the Deterministic out of the Model
requires: junit
impact: CRITICAL
asi: [ASI01, ASI02]
phases: [floor]
impactDescription: Reduces LLM costs and latency by moving deterministic logic out of LLM calls
tags: [architecture, llm, cost-optimization, performance]
noTerritory: This is a property of the system's split between code and model — it is judged at every point where an LLM is called, and no class of files carries it.
---

## Move the Deterministic out of the Model

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
