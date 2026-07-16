---
title: The Succession Is Named
impact: HIGH
asi: []
phases: [handover]
impactDescription: The system leaves the mission with a named owner, an escalation path and a review cadence — an unowned agentic system in production is an incident with a start date
tags: [handover, ownership, succession, governance, operations]
---

## The Succession Is Named

> **Systems do not stay owned by default; they become orphans by default.**
> The day the builder leaves, either a named person owns the system — its budget, its keys, its incidents, its re-evaluation triggers — or nobody does, and every ADR trigger, every drift signal, every suspended approval now fires into a void.

runward's whole discipline rests on someone reading the signals: re-evaluation triggers are *watched*, drift is *re-verified*, approvals are *processed*, the usage registry is *reviewed*. Those are verbs with a subject. Hand-over is the moment the subject changes — and the moment it silently becomes no one, unless the succession is written down where the gate can see it.

**What the record must carry** (in `handover.md`):

- **The owner** — a named person or standing role (not "the team") who owns the system after the departure: incidents, cost, keys, and the decision journal's open triggers.
- **The escalation path** — who is called when the owner is not enough: security contact, sponsor, provider support entry points.
- **The review cadence** — when the usage registry, the ADR triggers and the evidence seal are re-read (the iterate-gate rhythm surviving the builder), and in which forum.
- **The credentials boundary** — where the keys live and who may rotate them; the departing builder's accesses are revoked as part of the hand-over, and the record says so.

**Incorrect:**

```markdown
| handover-succession-named | applied | the team owns it going forward |
```

A team is not a subject; "going forward" is not a cadence.

**Correct:**

```markdown
| handover-succession-named | applied | file:runward/handover.md#Succession — owner: ops lead (named); escalation: security officer, then sponsor; registry + ADR triggers reviewed monthly in the ops review; builder's accesses revoked 2026-06-30 |
```

**Checklist:**

- [ ] One named owner (person or standing role) — for incidents, cost, keys and open ADR triggers.
- [ ] An escalation path with real names or roles, reachable.
- [ ] A written cadence for re-reading the registry, the triggers and the seal.
- [ ] The builder's credentials revoked, and the revocation recorded.
- [ ] The record lives in `handover.md`, verified by `runward check --strict`.

**Where this sits in the Runward method:** governance from day zero only matters if it survives day last. This rule is the difference between transmitting a system and abandoning it politely (ADR-0026).
