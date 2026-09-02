---
title: Fail-Open for the Non-Critical, Fail-Closed for the Sensitive
requires: junit
impact: CRITICAL
asi: [ASI02, ASI08]
phases: [govern]
impactDescription: Degrades gracefully where safe and denies safely where it matters, instead of applying one failure policy everywhere
tags: [resilience, error-handling, availability, safety]
noTerritory: The failure policy is chosen per dependency by criticality, so it concerns every external call in the system and no particular location.
---

## Fail-Open for the Non-Critical, Fail-Closed for the Sensitive

> **A non-critical service down is not the application down. A sensitive action in doubt is a denied action, never a guessed one.**

The failure policy is not global. You choose it per dependency, by criticality. Getting this split wrong in either direction is a bug: fail-closed on a cache makes you brittle; fail-open on an authorisation makes you unsafe.

**Fail-open (degrade and continue) for reads and the non-critical:**

```typescript
// Cache failure means slower, not broken.
async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await cache.get<T>(key);
  } catch (error) {
    log.error("[CACHE] get failed, continuing without cache", { error });
    return null;                       // fail-open: continue degraded
  }
}
```

**Fail-closed (deny, explicitly) for the sensitive:**

```typescript
// Authorisation, the grounding guard, a payment: doubt means deny.
async function authorise(req: Request): Promise<void> {
  try {
    const ok = await authz.check(req);
    if (!ok) throw new Forbidden();
  } catch (error) {
    // Never "allow on error". A guard you fail open is not a guard.
    throw new Forbidden();             // fail-closed: deny on doubt
  }
}
```

**Suspend, do not block.** Fail-closed does not mean freezing the process. A sensitive action that needs a human serialises the agent's state and rehydrates it on the decision; low-urgency approvals are batched in a prioritised queue. You get the safety of fail-closed without a frozen agent.

**Service classification:**

| Service / action | Policy | On failure |
|---|---|---|
| Database (read of record) | Critical | Error to the user |
| Model call | Critical | Error after retries |
| Cache | Non-critical | Continue, slower (fail-open) |
| Audit / analytics logging | Non-critical | Log locally, continue (fail-open) |
| Optional enrichment (search, memory) | Non-critical | Skip, continue (fail-open) |
| Authorisation / tenant isolation | Sensitive | Deny (fail-closed) |
| Grounding / safety guard | Sensitive | Reject the response (fail-closed) |
| Payment, irreversible write | Sensitive | Abort + require confirmation (fail-closed) |

**The test that tells them apart:** ask "if this dependency is wrong or absent, is the safe answer *continue* or *deny*?" Continue -> fail-open. Deny -> fail-closed. Anything touching safety, authorisation, money, or the truth of a served figure is fail-closed.

**Checklist:**

- [ ] Every external dependency has an explicit failure policy, chosen by criticality.
- [ ] No safety/authorisation/guard path fails open.
- [ ] No read-side enrichment fails closed and takes the request down with it.
- [ ] Fail-closed sensitive actions suspend-and-rehydrate rather than freeze.
