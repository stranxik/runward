---
title: Zod Input Validation
impact: MEDIUM
impactDescription: Prevents invalid data from entering the system and provides type safety
tags: [quality, validation, security, typescript]
---

## Zod Input Validation

Validate all external inputs with Zod at system boundaries.

**Where to Validate:**

- API endpoints (request body, query params)
- Environment variables
- User uploads
- External API responses
- Database query results (optional, for defense in depth)

**Incorrect:**

```typescript
// No validation - trusts external input
app.post('/api/projects', async (req, res) => {
  const { name, description, budget } = req.body;  // BAD: Could be anything
  await db.projects.create({ data: { name, description, budget } });
});

// Type assertion without validation
const config = process.env as Config;  // BAD: Not validated
```

**Correct:**

```typescript
import { z } from 'zod';

// Define schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  budget: z.number().positive().optional(),
  tags: z.array(z.string()).max(10).optional(),
});

type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// Validate at API boundary
app.post('/api/projects', async (req, res) => {
  // Parse throws ZodError if invalid
  const input = CreateProjectSchema.parse(req.body);

  // input is now typed and validated
  await db.projects.create({ data: input });
});

// Or with safe parsing
app.post('/api/projects', async (req, res) => {
  const result = CreateProjectSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten(),
    });
  }

  await db.projects.create({ data: result.data });
});
```

**Environment Variables:**

```typescript
// src/lib/env.ts
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  MODEL_API_KEY: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Validate once at startup
export const env = EnvSchema.parse(process.env);

// Usage: env.DATABASE_URL is typed and validated
```

**API Response Validation:**

```typescript
// Validate external API responses
const ExternalAPIResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
  })),
  meta: z.object({
    page: z.number(),
    total: z.number(),
  }),
});

async function fetchExternalData(): Promise<ExternalAPIResponse> {
  const response = await fetch('https://api.external.com/data');
  const json = await response.json();

  // Validate response matches expected shape
  return ExternalAPIResponseSchema.parse(json);
}
```

**Error Handling:**

```typescript
// Middleware for Zod error handling
function zodErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  next(err);
}
```
