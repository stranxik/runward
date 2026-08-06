---
title: Prompt Cache Stability (a Cost Lever, Provider-Specific)
impact: MEDIUM
impactDescription: Cuts input-token cost when a provider bills cached prefixes cheaper, by keeping the stable part of the prompt byte-identical across requests
tags: [cache, llm, cost, observability]
noTerritory: This rule governs a property of the prompt assembled at call time — the byte-stability of its prefix across requests — not a class of files identifiable by path.
---

## Prompt Cache Stability

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
