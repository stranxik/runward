---
title: Pre-Production Security Checklist
phases: [govern]
requires: sarif
impact: CRITICAL
asi: [ASI02, ASI03, ASI06]
impactDescription: Ensures security requirements are met before production deployment
tags: [checklist, security, production, deployment]
noTerritory: A pre-production checklist is a gate on the system as a whole, not on a class of files: it is confronted at the crossing, not while editing any particular path.
---

## Pre-Production Security Checklist

Security items that MUST be validated before any production deployment.

```
SECURITY CHECKLIST
├── [ ] Secrets in env vars only (not in code, not in logs)
├── [ ] Input validation with Zod on ALL external inputs
├── [ ] Rate limiting configured and tested
├── [ ] CORS configured (specific origins, not '*')
├── [ ] Security headers set (CSP, HSTS, X-Frame-Options)
├── [ ] SQL injection protection (parameterized queries)
├── [ ] XSS protection (output encoding)
├── [ ] Authentication on all protected routes
├── [ ] Authorization checks (tenant isolation)
├── [ ] Prompt injection: observed content is data; lethal trifecta broken on the context window
├── [ ] Grounding guard on any model output that surfaces facts (fail-closed)
├── [ ] Secret never reaches the model (substitute only; real key at the network boundary)
└── [ ] Dependency audit (npm audit / yarn audit)
```

**Incorrect:**

```typescript
// Secrets in code
const apiKey = "sk-abc123...";  // BAD: 

// No input validation
app.post('/api/project', async (req, res) => {
  const { name, data } = req.body;  // BAD: Unvalidated
  await db.insert(projects).values({ name, data });
});

// CORS wide open
app.use(cors({ origin: '*' }));  // BAD: 
```

**Correct:**

```typescript
// Secrets from environment
const apiKey = process.env.API_KEY;

// Zod validation
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  data: z.record(z.unknown()),
});

app.post('/api/project', async (req, res) => {
  const validated = CreateProjectSchema.parse(req.body);  // GOOD: 
  await db.insert(projects).values(validated);
});

// Specific CORS origins
app.use(cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true,
}));
```

**Security Headers (set at the edge or in the framework):**

```typescript
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```
