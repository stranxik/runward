---
title: If Doubt, Upgrade the Model
noAsi: answer quality and cost arbitration; no agentic-security surface.
phases: [govern]
impact: CRITICAL
impactDescription: Prevents quality degradation from incorrect model selection
tags: [routing, llm, cost-optimization, quality]
noTerritory: It is a decision rule over the complexity classifier's output — a model-selection behaviour — not a constraint on a code location.
---

## If Doubt, Upgrade the Model

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
