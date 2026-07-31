---
title: Codebase Metrics Thresholds
impact: MEDIUM
impactDescription: Identifies code quality issues before they become problems
tags: [quality, metrics, maintainability]
noTerritory: These are health thresholds measured across the whole codebase and enforced in CI and review, so they hold for every source file without a territory of their own.
---

## Codebase Metrics Thresholds

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
