---
title: Tool Registry Pattern
impact: HIGH
asi: [ASI02, ASI03]
impactDescription: Replaces giant switch statements with maintainable, extensible tool management
tags: [tools, architecture, patterns, maintainability]
---

## Tool Registry Pattern

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
