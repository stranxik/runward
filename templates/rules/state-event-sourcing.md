---
title: State as an Immutable Journal (Event Sourcing, Replay, Provenance)
requires: junit
impact: HIGH
asi: [ASI06]
phases: [floor]
impactDescription: Makes the agent a stateless reducer over an external, replayable journal, so truth, audit and recovery are structural rather than bolted on
tags: [state, event-sourcing, replay, provenance, memory]
noTerritory: It prescribes the shape of the whole system — a stateless agent folding over an external journal — so it governs every module that holds or writes state rather than a class of files.
---

## State as an Immutable Journal

> **The agent is a stateless reducer. State lives outside, in three layers.**

An agent with hidden in-process state cannot be replayed, audited, or scaled. Keep the agent stateless and externalise state into three distinct layers, each with one job:

1. **Immutable interaction journal** - the source of truth. Append-only, never edited. It is what you audit and what you replay. Every consequential step is an event appended here.
2. **Derived working view** - the memory that forgets. A projection of the journal, trimmed and scored for relevance, rebuilt from the journal at any time (see *Memory Scoring*). It is a cache, not a source.
3. **Prompt provenance** - the reconciler. For each inference, the fingerprint of what was actually injected into the model, so you can replay exactly what the model saw even after the working view has moved on.

**Incorrect:**

```typescript
// Hidden mutable state in the agent. Not replayable, not auditable.
class Agent {
  private history: Msg[] = [];          // BAD: in-process truth
  handle(input: string) {
    this.history.push({ role: "user", text: input });
    // ... mutate more fields the journal never sees
  }
}
```

**Correct:**

```typescript
// Truth is the journal. The agent folds events into a view, then appends new ones.
// Appends carry an expected version (optimistic concurrency control): if another
// writer appended in the meantime, the append fails and the caller re-reads and
// retries, instead of two writers silently interleaving into the same run.
async function handle(runId: string, input: Event): Promise<Result> {
  const events = await journal.read(runId);
  const version = events.length;                   // version seen at read time
  await journal.append(runId, [input], { expectedVersion: version });
  const view = project([...events, input]);        // derived, rebuildable
  const result = await reducer(view);              // agent is a pure fold over the view
  await journal.append(runId, result.events, {     // consequences are events too
    expectedVersion: version + 1,
  });
  return result;
}

// Replay is just folding the journal again, deterministically.
const replayed = project(await journal.read(runId));
```

**Why this matters:**

- **Audit and recovery**: the journal answers "what happened, exactly?" and lets you resume a run from any point (see the recovery runbook).
- **Provenance under injection**: keeping what was injected lets you investigate a bad output even after the working memory forgot it; it also pairs with the prompt provenance the single middleware records.
- **Scaling**: because the agent holds no hidden state, externalising the journal and the working view to a shared store is the structural precondition for running many instances — not the whole bill. The real costs come with it: **concurrency control** on appends (expected version, retry on conflict), **idempotence** of event handling (a retried append or redelivered event must not double its effect), and **causal ordering** across writers (events from concurrent instances need an order the projection can trust). Pay these on a trigger, in full knowledge, not by default.

**Checklist:**

- [ ] The agent holds no hidden mutable state; it folds over an external view.
- [ ] The interaction journal is append-only and is the single source of truth.
- [ ] Appends carry an expected version; a conflict re-reads and retries, never overwrites.
- [ ] The working view is a projection, rebuildable from the journal.
- [ ] Prompt provenance is recorded per inference for replay and audit.
