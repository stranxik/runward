---
title: Provenance on Every Field, So the Human Never Trusts a Guess
impact: HIGH
asi: [ASI09]
phases: [govern]
impactDescription: Stops a model-proposed value being read as a verified fact at the approval point — the human decides on real provenance, never on fabricated confidence
tags: [security, trust, provenance, human-oversight]
noTerritory: Provenance is carried by every field the system produces and by every approval surface, so the rule governs the shape of outputs rather than a class of files.
---

## Provenance on Every Field, So the Human Never Trusts a Guess

> **The model writes the prose; the program owns the facts — and the human must be able to tell which is which.** A model-proposed value is never presented as verified.

Human-agent trust breaks when a person approves an action believing the agent's output was checked, when it was only proposed. The guard is provenance made visible, and approval placed on the action:

- **Every field carries a provenance marker** — `computed`, `verified`, or `model-proposed` — so the human, and the code, can tell a fact the program owns from a value the model guessed. A `model-proposed` value that would act on the world is refused fail-closed until it is verified or approved (see `frontier-deterministic-boundary`, `data-memory-provenance`).
- **Approval is on the action, shown with its provenance**, never on a wall of confident prose. The human sees what is proposed versus verified before deciding, so a sign-off is a real decision, not a reflex.
- **The agent never impersonates a human or an authority.** It is an identified principal, distinct from the user it serves; its outputs are attributable to the agent, and it never claims a certainty, a sign-off, or an identity it does not have.

Confident tone is not correctness. The system makes the difference legible, so the human's trust is placed on evidence, not on fluency.
