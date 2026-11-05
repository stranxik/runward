# Analysis

What the built-in analyzers allow in this mission, each with its reason (runward ADR-0118). The policy
they apply is pinned in `runward/scaffold-lock.json` (`"analysis"`); the domain core they check is the
one `runward/territory.md` declares. This file describes the example's own tree, which runward wrote:
in your mission you write it, runward never does, and every row is one line of diff a reviewer reads.

## Allowed imports in the domain core

| Module | Why |
|---|---|
| `zod` | validates the shape of the model's proposal inside the domain (`code/src/core/domain/triage.ts`): a pure library, no I/O, no clock, no environment |

## Allowed capabilities

| Path | Capability | Why |
|---|---|---|
| `code/scripts/junit-committable.mjs` | `process-execution` | runs the example's own test suite to write the committed JUnit report; build tooling that no delivered module imports |
