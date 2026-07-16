---
title: The Agent Charter Is Finalized as the Leave-Behind
impact: HIGH
asi: [ASI10]
phases: [handover]
impactDescription: AGENTS.md leaves the mission as the standing constraint on every future agent — verification commands, judgment boundaries, never/PR rules — so the next agent inherits the discipline, not just the code
tags: [handover, agents-md, charter, governance, succession]
---

## The Agent Charter Is Finalized as the Leave-Behind

> **The next agent was not in the room.**
> Everything the mission learned about where agents must stop, ask, or prove is worthless if it leaves with the builder. `AGENTS.md` is where that judgment survives the succession — finalized, specific, and pointing at the gate.

During the mission, the charter accumulated defaults. At hand-over it must be **rewritten as the leave-behind**: the document a receiving team's agent reads on day one, with no builder nearby to fill the gaps. An inherited agent operating without a finalized charter is the quiet path to a rogue one (ASI10) — not through malice, but through inherited ambiguity: nothing says what it may touch, what proves its work, or when it must stop and ask a human.

**What "finalized" means, concretely:**

- **Verification commands, exact.** The charter names how work is proven here — `runward check --strict` at minimum, the behavioral proof command, the evaluation bench. An agent that cannot verify will assert.
- **Judgment boundaries, mission-specific.** Not the scaffold's generic five: the boundaries this mission actually discovered — which data classes are untouchable, which actions are approval-gated, which files no agent edits.
- **Never / PR rules.** What is never done autonomously, and what always goes through a reviewed change — stated as rules, not anecdotes.
- **The pointers resolve.** The workflows, rules and deliverables the charter cites still exist where it says — typed evidence in the manifest lets the gate verify that.

**Incorrect:**

```markdown
| handover-agents-charter-final | applied | AGENTS.md exists since init |
```

Existing since `init` is the opposite of the point: the scaffold is the starting text, the leave-behind is the mission's learned judgment.

**Correct:**

```markdown
| handover-agents-charter-final | applied | file:AGENTS.md#Non-negotiable — finalized at hand-over: verification commands (check --strict + npm test + bench), the two mission-specific boundaries (registry data read-only; compliance-flagged routing always approval-gated), never/PR rules |
```

**Checklist:**

- [ ] The charter was re-edited at hand-over, not merely left as scaffolded.
- [ ] Verification commands are exact and were run by the receiving side (see the redone task).
- [ ] Mission-specific boundaries and never/PR rules are present and dated.
- [ ] Every path the charter cites resolves — the manifest points at the charter with typed evidence.

**Where this sits in the Runward method:** ADR-0010 made `AGENTS.md` a first-class hand-over deliverable; ADR-0026 makes its finalization a gated fact. The charter is how the mission's judgment outlives the mission.
