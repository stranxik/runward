---
title: Model Cost Ratios
impact: HIGH
impactDescription: Essential reference for cost optimization decisions
tags: [routing, llm, cost-optimization, reference]
noTerritory: It is a cost reference table informing every model and prompt decision, prescribing and constraining no file.
---

## Model Cost Ratios

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
