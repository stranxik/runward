---
title: The Runbook Is Executable, Not Descriptive
impact: HIGH
asi: [ASI08]
phases: [handover]
impactDescription: The recovery runbook carries real commands for the gestures that matter at 3 a.m. — start, observe, debug, resume, swap the provider, rerun the bench, process a suspended approval — so an incident meets procedures, not prose
tags: [handover, runbook, operations, recovery, resilience]
---

## The Runbook Is Executable, Not Descriptive

> **A runbook is judged at 3 a.m., by someone who was not there when the system was built.**
> Every gesture it promises must be a command that runs, a path that exists, a signal that can actually be read — not a paragraph explaining that such things are possible.

Agentic systems fail in cascades (ASI08): a provider degrades, a queue backs up, an approval hangs, and the operator's margin is measured in minutes. The runbook is the artifact that converts a cascade into a sequence of known gestures. A descriptive runbook — "the system can be restarted; logs are available" — is a cascade accelerant: it costs the reader the minutes it pretends to save.

**The seven gestures the runbook must carry, each with its real command or path:**

1. **Start / stop** — the exact commands, including the safe-stop that drains instead of kills.
2. **Observe** — where the structured logs and metrics are, and the one query that answers "is it healthy?".
3. **Debug a trajectory** — how to reconstruct a full run from one request ID.
4. **Resume from a checkpoint** — where suspended state lives and the command that rehydrates it.
5. **Swap the model provider** — the adapter switch, the config to change, and what to re-run afterwards.
6. **Rerun the evaluation bench** — the command, and where the report lands.
7. **Process a suspended approval** — where it queues, who may approve, the command or UI path that releases it.

**Incorrect:**

```markdown
## Recovery
The system is resilient and can be restarted. Observability is in place.
```

**Correct:**

```markdown
## 4. Resume from a checkpoint
Suspended runs live in var/journal/ (one file per request ID).
    npm run resume -- --request <id>
Verify: the trajectory for <id> continues in the structured log within 30 s.
```

**Checklist:**

- [ ] All seven gestures present, each with a command or concrete path — no gesture "described" without one.
- [ ] Commands were executed at least once by someone other than their author (the redone task is the natural occasion).
- [ ] The runbook names its own verification: how the reader confirms each gesture worked.
- [ ] Paths and commands are pointed at from the manifest with typed evidence, so the gate catches drift when they move.

**Where this sits in the Runward method:** the runbook is scaffolded at `init` and demanded by the hand-over workflow since day one; this rule makes its *executability* a gated fact (ADR-0026) instead of a review opinion.
