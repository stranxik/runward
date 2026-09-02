---
title: Post-Turn Pipeline (Keep the Interactive Turn Thin)
noAsi: turn latency and work placement, not an attack surface: what the deferred pipeline WRITES is governed by the memory and data rules, which carry their own ASI mapping.
phases: [floor]
impact: HIGH
impactDescription: Keeps response latency bound to what the answer needs by moving extraction, consolidation and summarization into an isolated, event-driven pipeline that runs after the turn
tags: [async, pipeline, events, latency, memory, provenance]
noTerritory: The line it draws is temporal, not spatial — work leaves the turn through an event rather than through a directory — so it is judged on the turn handler and on each step isolation, wherever the project places them.
---

## Post-Turn Pipeline

> **The interactive turn does what the answer needs. Everything else leaves the turn.**

A turn that extracts facts, consolidates memory and writes episode summaries before replying makes the user pay for work the response never needed. The turn stays thin: retrieve context, decide, answer, persist the interaction event. Everything that serves the *next* turn rather than this one — fact extraction, memory consolidation, episode summarization, pre-warming the likely next context — moves to a post-turn pipeline, triggered by an event emitted when the turn completes.

Three properties are non-negotiable:

1. **The provenance fingerprint is deposited at emission.** The event carries a fingerprint of what the model actually saw. By the time a pipeline step runs — possibly minutes later, possibly on retry — working state may have changed; the step works from the recorded truth, not from whatever memory looks like now.
2. **Each step is isolated with its own bounded retry.** A flaky summarizer retries on its own schedule without touching its siblings.
3. **One step failing never fails the others.** No shared fate: fact extraction completes even when summarization is down.

**Incorrect:**

```typescript
// Everything inline: the user waits for work the answer does not need.
async function handleTurn(input: UserInput): Promise<Reply> {
  const context = await memory.retrieve(input);
  const reply = await orchestrator.answer(input, context);

  await extractFacts(reply);          // BAD: not needed to answer
  await consolidateMemory();          // BAD: batch work on the hot path
  await summarizeEpisode(reply);      // BAD: if this throws, the turn fails
  await prewarmNextContext(input);    // BAD: p95 now includes four jobs

  return reply;
}
```

**Correct:**

```typescript
// Thin turn: answer, persist, emit. The pipeline runs after the reply is out.
async function handleTurn(input: UserInput): Promise<Reply> {
  const context = await memory.retrieve(input);
  const reply = await orchestrator.answer(input, context);

  await events.emit({
    type: 'turn.completed',
    turnId: reply.turnId,
    provenance: fingerprint(context),  // what the model saw, sealed now
    occurredAt: new Date(),
  });
  return reply;  // latency = retrieve + answer + one event write
}

// Each step: its own handler, its own bounded retry, no shared fate.
const steps: PipelineStep[] = [
  { name: 'extract-facts',   run: extractFacts },
  { name: 'consolidate',     run: consolidateMemory },
  { name: 'summarize',       run: summarizeEpisode },
  { name: 'prewarm-context', run: prewarmNextContext },
];

events.on('turn.completed', async (event) => {
  const results = await Promise.allSettled(
    steps.map(step =>
      withRetry(() => step.run(event), { maxRetries: 3, name: step.name })
    )
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      log.error('pipeline.step.failed', {
        step: steps[i].name,
        turnId: event.turnId,
        error: String(r.reason),
      });
      // Siblings have already succeeded or failed on their own.
    }
  });
});
```

**Why this matters:**

- **Latency**: the user waits for the answer, not for the housekeeping. Four background jobs on the hot path can double p95 for zero visible value.
- **Resilience**: a degraded summarizer no longer takes fact extraction — or the turn itself — down with it. Each step degrades alone.
- **Audit**: because the fingerprint is sealed at emission, a step that runs late or on retry still reads exactly what the turn saw. Provenance survives asynchrony.
- **Cost**: pipeline steps are off the hot path, so they can run on cheaper model tiers and absorb backpressure without touching the user experience.

Post-turn steps are background jobs like any other: they carry the four guardrails — bounded retry, idempotency, bounded concurrency, job observability (see *Background Job Guardrails*).

**Checklist:**

- [ ] The interactive turn performs only what the response requires; everything else is triggered by a turn-completed event.
- [ ] The event carries the provenance fingerprint, deposited at emission — steps never read mutable state to learn what the model saw.
- [ ] Each pipeline step has its own bounded retry, independent of its siblings.
- [ ] A step's failure is logged with the turn id and isolated; the other steps complete.
- [ ] Pipeline steps follow the background-job guardrails (idempotency keys, concurrency caps, queue metrics).
