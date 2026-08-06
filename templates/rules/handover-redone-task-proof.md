---
title: The Redone-Task Proof
impact: CRITICAL
asi: [ASI09]
phases: [handover]
impactDescription: A hand-over is proven by a real task redone end to end without the departing builder — recorded, dated, pointed at — so autonomy is a fact, not a farewell promise
tags: [handover, succession, autonomy, proof, transmission]
noTerritory: It rests on a proof of autonomy — a real task redone without the builder — which is a fact of the mission recorded under runward/, never a class of product files.
---

## The Redone-Task Proof

> **You transfer autonomy, not documents.**
> The hand-over is proven the day the receiving side redoes a real task, end to end, without the person who built the system. Until that has happened and been recorded, the succession is a hope with a runbook attached.

A kit can be complete and dead: every document present, nobody able to act. The only observable that distinguishes a live succession from a paper one is the **redone task** — a real change, run, fix or evaluation executed by the receiving team alone, from the leave-behinds, with the builder unavailable by agreement.

**What the record must carry** (in `handover.md`, the proof record):

- **The task** — a real one from the mission's actual work, not a rehearsed demo. Fixing a routing rule, re-running the evaluation bench after a model swap, processing a suspended approval, resuming from a checkpoint: something that exercises the runbook, the code and a decision.
- **The date and the doer** — who redid it, when, explicitly without the builder in the loop.
- **The evidence** — a pointer the gate can verify (`file:`, `test:`, or the artifact the task produced). "It went fine" is not evidence; the merged change, the produced report, the closed approval is.
- **What broke, honestly** — every step where the doer had to guess is a defect in the kit. Route each one back into the runbook or the charter before the gate is crossed.

**Incorrect:**

```markdown
| handover-redone-task-proof | applied | the team is confident and has been walked through everything twice |
```

A walkthrough is the builder performing; the proof is the builder absent.

**Correct:**

```markdown
| handover-redone-task-proof | applied | file:runward/handover.md#Redone-task — 2026-06-28, ops engineer re-ran the eval bench after the provider swap, alone, from runbook §4; report at code/eval/reports/2026-06-28.md; two runbook gaps found and fixed |
```

**Checklist:**

- [ ] The task was real mission work, chosen from the backlog, not staged.
- [ ] The builder was genuinely out of the loop (agreed beforehand, verifiable).
- [ ] The record names task, date, doer, and points at the produced artifact.
- [ ] Every gap the doer hit was folded back into the runbook or charter.
- [ ] The record lives in `handover.md` where `runward check --strict` reads it.

**Where this sits in the Runward method:** phase 6 is where every other scaffold has already stopped. This rule is the difference between handing over a repository and handing over a running responsibility — and it is why the hand-over claim is gated, not narrated (ADR-0026).
