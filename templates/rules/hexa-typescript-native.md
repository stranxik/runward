---
title: A Thin Model Abstraction You Own (Not a Heavy Chain Framework)
impact: HIGH
phases: [architect]
asi: [ASI04]
impactDescription: Reduces token overhead, improves debuggability, removes volatile dependencies by keeping a light abstraction you control instead of a heavy framework
tags: [architecture, typescript, llm, frameworks]
noTerritory: This is a dependency posture — what the project refuses to let own its control flow — judged on the imports of the whole codebase rather than on a locatable class of files.
---

## A Thin Model Abstraction You Own

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
