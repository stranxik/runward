---
title: Smart Routing by Complexity
noAsi: cost and quality arbitration; no agentic-security surface.
noPhase: A cost and latency optimisation adopted on a measured traffic distribution during iteration — the sober default is a single tier, and demanding this at a gate would push premature routing
impact: HIGH
impactDescription: Order-of-magnitude latency cut on simple requests and a substantial cost reduction through intelligent model selection, measured on a reference system — recalibrate on your traffic
tags: [routing, llm, cost-optimization]
noTerritory: It is a model-selection behaviour driven by request complexity, described without any prescribed code location.
---

## Smart Routing by Complexity

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
  // Casual patterns must match the ENTIRE (short) message, anchored on
  // both ends. A prefix match like /^hey/i would classify
  // "hey, can you redesign our auth architecture?" as casual and
  // short-circuit it to the cheapest model.
  const MAX_CASUAL_LENGTH = 25;
  const casualPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|bye)[\s!.]*$/i,
    /^(yes|no|sure|got it)[\s!.]*$/i,
  ];

  const deepPatterns = [
    /compare.*and.*analyze/i,
    /design.*architecture/i,
    /evaluate.*strategy/i,
  ];

  // Test deep patterns FIRST: misrouting a deep request to a small
  // model costs far more than misrouting a greeting to a big one.
  for (const pattern of deepPatterns) {
    if (pattern.test(message)) {
      return { level: 'deep', confidence: 0.7 };
    }
  }

  const trimmed = message.trim();
  if (trimmed.length <= MAX_CASUAL_LENGTH) {
    for (const pattern of casualPatterns) {
      if (pattern.test(trimmed)) {
        return { level: 'casual', confidence: 0.8 };
      }
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

// Step 3: Select model. In doubt, upgrade: a small model on a deep
// question costs more in retries and bad answers than the price gap.
function selectModel(result: ComplexityResult): string {
  if (result.confidence < 0.6) {
    return upgradeModel(result.level);  // Safety upgrade (see Confidence Upgrade rule)
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
