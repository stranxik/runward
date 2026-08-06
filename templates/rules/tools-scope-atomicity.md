---
title: Tool Scope and Atomicity
impact: HIGH
asi: [ASI02]
phases: [floor]
impactDescription: Reduces token usage and improves LLM tool selection accuracy
tags: [tools, llm, architecture, cost-optimization]
noTerritory: It constrains the shape of each tool declaration — one atomic action, a description that says when to use it — wherever tools are declared, so it has no file territory.
---

## Tool Scope and Atomicity

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
