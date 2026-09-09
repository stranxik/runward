---
workflow: review
phase: none
gate: none
produces: []
requires: []
nonScope: Produces review findings for the operator; never a verdict — the review is consultative by decision (ADR-0007), and no gate reads its conclusions.
---

# Review — Expert Panel for Architecture Documents

## When to use

Use this workflow to judge the technical soundness, internal consistency, and editorial quality of an architecture document for agentic systems — an architecture note, design note, RFC, spec, or whitepaper: "does this section hold?", "what would an architect say?", "is this state of the art?". This workflow provides the eyes; `decision-loop` provides the method. Pair them. Review is strictly read-only: the panel criticizes, it never rewrites without validation.

## Inputs

- The document under review.
- Its intended audience (tech leads, engineering managers, CTOs, staff architects).
- Any house editorial rules to enforce.

## Outputs

- Graded verdicts — blocking / important / minor — each with problem, evidence, and proposed fix.
- A whole-document consistency pass.

## Procedure

**Calibrate the register first.** Such a document is usually neither an ML research paper, nor product documentation, nor code. It is applied software architecture for agentic systems, crossing five domains: software engineering (hexagonal, light DDD, event sourcing, evolutionary architecture, cost/reversibility reasoning); distributed systems (explicit state, scaling, consistency, resilience); applied LLM engineering (agent loop, tool use, model boundary, tier routing, memory and context, integration protocols); MLOps and evaluation (continuous evaluation, judge models and their biases, observability, drift, closed loops); governance and security (least privilege, human in the loop, fail-closed, data sovereignty, auditability). Review it with an architect's breadth, sharpened by specialist angles.

**Adopt one Principal Architect wearing five hats** — distributed systems; LLMOps and production ML; memory and retrieval; security and regulated sectors; editorial coherence. Global mandate: uncompromising, strictly factual, zero complacency. Flag overclaims, blind spots, stale state of the art, cross-section inconsistencies, and anything that would not survive an architecture committee in a regulated sector.

1. **Senior distributed-systems engineer.** Judges event sourcing, state externalization and projection, budget leases, service discovery, consistency, resilience, idempotence. Catches scaling naivety.
2. **LLM platform engineer.** Judges evaluation (judge models, online evaluation, drift, Goodhart effects), observability, tier routing, cost, and the dangers of feedback loops — especially systems that rewrite themselves.
3. **Applied research engineer in agent memory** (hardened by default). Judges bi-temporal memory, graph retrieval, decay and consolidation, context engineering, abstention, fact-conflict resolution.
4. **Security and data-governance architect for regulated sectors** (hardened by default). Judges fail-closed behavior, human supervision, erasure and sovereignty, auditability, prompt injection, the lethal trifecta, untrusted inputs.
5. **Technical editor of reference-grade material.** Judges structure, register, naming consistency, repetition, reading rhythm — with the same factual rigor. Enforces documentation-mode separation: do not mix tutorial, how-to, reference, and explanation in one section; an architecture note is explanation and reference, not tutorial.

Rotate the hats one at a time over the same text, then reconcile their verdicts: a multi-persona pass aligns better with expert judgment than a single reviewer. Harden another angle on request.

**Apply the six-criterion grid to every section.**

1. Technical accuracy and state of the art — exact, current, defensible with sources in hand?
2. Internal consistency — do cross-references hold (topology vs. async vs. evaluation; memory vs. state; decomposition vs. state)?
3. Terminological precision — patterns named correctly, protocols described by function, vocabulary stable?
4. Remaining overclaims and blind spots.
5. Readability for the target audience.
6. Compliance with the house editorial rules.

**Neutralize known reviewer biases.** Self-preference: review generated-looking text with extra severity. Verbosity: longer is not better. Position and centrality: vary hat order between passes; prefer a binary holds / does not hold per criterion over a fuzzy scale. Separate substance from style: hats 1–4 judge correctness, hat 5 judges form.

**Deliver graded verdicts.** For each finding: severity (blocking / important / minor), the problem, the evidence, the proposed fix. Discrete verdicts beat continuous scores — wide scales bias toward the center. Finish with a whole-document consistency pass, not only section-by-section. For any finding that demands a real design decision, hand off to `decision-loop` before anything is written into the document.

## Definition of Done

- Every section passed through all five hats and the six criteria.
- Verdicts graded, each with problem, evidence, and fix.
- A whole-document consistency pass completed.
- Design-level findings routed to `decision-loop`; no edits made without validation.

## Anti-patterns

- Rewriting the document during review — the panel is read-only.
- Scoring on a continuous scale instead of discrete verdicts.
- Judging style and substance in one breath.
- Skipping the whole-document pass and reviewing only locally.
- Rewarding length or polish over correctness.
- Softening verdicts because the author is in the room.
