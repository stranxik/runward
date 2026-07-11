---
title: Deterministic Boundary of the Model
impact: CRITICAL
asi: [ASI01]
phases: [floor]
impactDescription: Keeps every fact, figure and decision that can be checked out of the model, so the system is verifiable and cannot hallucinate load-bearing values
tags: [architecture, llm, frontier, grounding, safety, determinism]
---

## Deterministic Boundary of the Model

> **The model writes prose. The program owns the facts.**
> Anything that can be retrieved, computed, validated or decided deterministically must live in code, never in the model's free generation. The model is rented and non-deterministic; the boundary around it is owned and tested.

This is the strongest form of that boundary: not only move deterministic *logic* out (routing, classification), but move deterministic *truth* out. The model is allowed to phrase, summarise and connect. It is never the source of a number, a citation, a price, a date, or an authorisation.

**Why structured outputs are not enough:** constrained decoding and JSON schema guarantee the *shape* of the output, never its *meaning*. A model can emit a perfectly valid JSON number that is invented. Shape validation and truth validation are two different jobs.

**Incorrect:**

```typescript
// The model is asked to "report the figures". It will, including ones it invents.
const answer = await model.complete(`
  Summarise the company's AI budget from these notes: ${notes}
  Give exact percentages and the source.
`);
// BAD: Any % in `answer` is the model's word, unverifiable, potentially hallucinated.
```

**Correct (data-to-text / slot-filling):**

```typescript
// 1. Facts come from a structured store, each with value, unit, period, source.
const facts = await portFacts.query({ topic, edition });   // deterministic

// 2. The model writes the narrative and emits SLOTS, never raw numbers.
//    Prompt: "Refer to a served fact as {f0}, {f1}... Never write a figure yourself."
const draft = await model.complete(buildPrompt(question, facts));

// 3. The program substitutes value + unit + period into each slot.
const answer = fillSlots(draft, facts);                    // deterministic

// 4. A guard rejects the response if any number in it is not grounded in served facts.
assertGrounded(answer, facts);                             // fail-closed
```

**The grounding guard (executable specification of the boundary):**

```typescript
// Extract numbers that are not part of a word/identifier, normalise FR decimals.
const NUMBER = /(?<![\p{L}\d-])\d+(?:[.,]\d+)?/gu;

// Grounded set = fact values ∪ numbers appearing in served fact labels ∪ plausible years.
function groundedSet(facts: Pick<Fact, "value" | "indicator">[]): Set<string> {
  const set = new Set<string>();
  for (const f of facts) {
    set.add(normalise(f.value));
    for (const n of f.indicator.match(NUMBER) ?? []) set.add(normalise(n));
  }
  return set;
}

// Reject any figure in the synthesis that is not in the grounded set (years excepted).
export function assertGrounded(text: string, facts: Pick<Fact, "value" | "indicator">[]): void {
  const grounded = groundedSet(facts);
  for (const n of text.match(NUMBER) ?? []) {
    const v = normalise(n);
    if (!grounded.has(v) && !isPlausibleYear(v)) {
      throw new GroundingError(`Ungrounded figure in synthesis: ${n}`);
    }
  }
}
```

**Layered defence, by maturity of the model wiring:**

| Stage | Mechanism | Guarantee |
|-------|-----------|-----------|
| Floor | Guard checks every figure against the served facts (value ∪ label numbers ∪ years) | No invented number reaches the user |
| Wired with structured outputs | Model emits `{fN}` slots, program substitutes value+unit+period | Attribution is exact (AIS: Attributable to Identified Sources) |
| Monitoring | Faithfulness metric (RAGAS / FActScore family) over a traffic sample | Drift in narrative faithfulness is measured and alerted, not blocked |

The guard **guarantees and blocks** ("can we serve this?"). The metric **measures and alerts** ("how faithful is the prose over time?"). They are complementary, never redundant.

**Boundary checklist for any feature that surfaces facts:**

- [ ] Every load-bearing value comes from a typed store, not from the model.
- [ ] The model's output passes a grounding guard before it reaches a user.
- [ ] The guard **fails closed**: on doubt it rejects, it does not pass through.
- [ ] Abstention is a first-class answer: "not in the corpus" beats a plausible guess.
- [ ] The guard has unit tests that feed realistic facts *with their labels* (the spec is executable).

**Where this sits in the Runward method:** the deterministic boundary is the practical form of the guiding principle — the deterministic stays out of the model. It is also a security control: a hallucinated figure is an integrity failure, not just a quality one.
