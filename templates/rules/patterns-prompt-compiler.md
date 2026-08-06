---
title: Prompt as Program (Prompt Compiler)
impact: MEDIUM
impactDescription: Enables versioning, testing, and optimization of prompts
tags: [patterns, prompts, llm, architecture]
noTerritory: The rule is about how a prompt is assembled at the moment it is built, and it is verified on the compiled object, not on any file whose path could be predicted.
---

## Prompt as Program (Prompt Compiler)

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
