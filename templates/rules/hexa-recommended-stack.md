---
title: Stack Posture (Sober Default plus Trigger), Not a Fixed Stack
phases: [architect]
impact: MEDIUM
impactDescription: Replaces a frozen product stack with a portable rule for choosing technology by evidence, so the rule does not age with any vendor
tags: [architecture, stack, decision, portability]
noTerritory: This rule governs how a technology choice is made and recorded, not what any file contains; it fires on a decision and an ADR, never on a path.
---

## Stack Posture, Not a Fixed Stack

A method describes functions, never products, so it ages slowly. This rule follows the same discipline: it does not prescribe a vendor stack. It prescribes how to choose one.

> **Start with the smallest stack that proves value on real traffic. Cross a frontier (new service, new database, new provider) only on an objective trigger.**

**Default posture at the floor:**

| Concern | Sober default | Cross the frontier when (trigger) |
|---|---|---|
| Language | One typed language for the core, chosen by the team's fluency and the ecosystem | A second runtime earns a measured, isolated need (e.g. a Python sidecar for OCR/NLP) |
| Topology | Modular monolith, single process | A real, measured reason to split a service (independent scaling, isolation, team boundary) |
| Model | One provider behind a `ModelPort`, ideally via a gateway | Availability fallback, or a validated promotion in shadow deployment |
| Persistence | One relational store (Postgres) for facts; vectors in the same store (pgvector) | Volume that overflows the single store; a real graph traversal becomes central |
| State / scale | In-process, single instance | Horizontal scaling needed -> externalise state first |
| Async | Inline | A workload genuinely needs scheduling or backpressure |

**How to record a stack choice:** each line above is a decision with a default and a trigger. When a trigger fires, the choice is made in an ADR with the options and a preference order, not improvised. Until the trigger fires, you do not pre-build and you do not re-debate.

**What does not belong in the core, whatever the stack:**

- No vendor SDK imported from the domain (model, database, search are adapters).
- No framework owning your control flow that you cannot see through; prefer thin abstractions you own.
- No optional service that crashes the app when absent.

When you pin a concrete stack for a mission, record it as an illustration of the method, not as a stack to copy.
