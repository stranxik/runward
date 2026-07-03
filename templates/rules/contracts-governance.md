---
title: Contract Governance (Versioned, Additive, Expand-then-Contract)
impact: CRITICAL
impactDescription: Lets the system evolve without breaking consumers, by governing the contract at the boundary rather than the implementation behind it
tags: [architecture, contracts, ports, versioning, compatibility]
---

## Contract Governance

A port is a contract. The whole point of the hexagon is that you can change what is *behind* a port freely, but what *crosses* the port is governed. Break that discipline and the decoupling is cosmetic.

> **Behind the port: free. Across the port: governed, versioned, additive.**

**Rules of change at a boundary:**

1. **Additive by default.** Add new optional fields; never remove or repurpose an existing one in place.
2. **Versioned.** A breaking change is a new version of the contract, not an edit to the old one.
3. **Expand-then-contract** (the safe migration of any contract):
   - *Expand*: introduce the new shape alongside the old, both supported.
   - *Migrate*: move producers and consumers over, observed on real traffic.
   - *Contract*: only once nothing reads the old shape, remove it.
4. **Consumer-driven.** The consumers' expectations are encoded as tests the producer must satisfy. The contract is owned jointly, not dictated by the producer.

**The schema-drift test (executable contract):**

The cheapest consumer-driven contract test is one that fails the build when the implementation drifts from the domain contract. In practice the domain `zod` types are the single source of truth, and a test asserts that the live SQL columns match them:

```typescript
// test/schema-drift.test.ts (runs only when DATABASE_URL is set)
test("SQL columns match the domain contract", async () => {
  const columns = await db.columnsOf("facts");        // live schema
  const expected = factSchema.keyof().options;        // zod domain type
  expect(new Set(columns)).toEqual(new Set(expected.map(toSnakeCase)));
});
```

When the database and the domain type disagree, the build goes red before a single request is served. The contract is not a document anyone can forget; it is a test.

**The model port is a contract too.** Promoting a new model is the sibling of expand-then-contract: the candidate runs first in *shadow deployment* behind the same port, on real traffic but silent, its behavioural divergence measured against the serving model; only if divergence stays under a pre-set threshold do you shift a growing share of traffic, with immediate rollback on any regression. You never switch in one move.

**Incorrect:**

```typescript
// Renaming a field in place. Every consumer breaks at once.
interface FactDTO { value: string; /* was: amount */ }   // BAD: breaking, unversioned
```

**Correct:**

```typescript
// Expand: add the new field, keep the old, mark it deprecated.
interface FactDTO {
  /** @deprecated use `value` */ amount?: string;
  value: string;
}
// Migrate consumers, observe on real traffic, THEN contract (remove `amount`).
```

**Checklist before changing anything that crosses a boundary:**

- [ ] Is the change additive? If not, it is a new version.
- [ ] Is there a contract test (schema-drift, consumer test) that will catch a regression?
- [ ] Are the old and new shapes both live during the migration (expand-then-contract)?
- [ ] For a model swap: shadow first, switch by stages, rollback ready.
