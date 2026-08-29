# Engineering decisions (ADRs) — runward itself

These are **runward's own** Architecture Decision Records: the tool dogfooding the method it ships. Each records one structural decision about runward's development, dated, with a mandatory re-evaluation trigger.

**These are not a mission's ADRs.** When you run `runward init`, your project's decision journal lives in your own `runward/adr/`, scaffolded from the template. The files here concern the runward tool itself and are **not** part of the npm package (`files` ships only `dist`, `templates`, `README.md`, `NOTICE.md`) — a coding agent working a mission never receives them.

| | Mission ADRs (your project) | These ADRs (runward itself) |
|---|---|---|
| Location | `runward/adr/` in your repo | `docs/adr/` in this repo |
| Shipped to npm | scaffolded by `init` | no |
| About | your system's decisions | the runward tool's decisions |

## Decisions not yet made

A journal holds decisions that were made — every entry here is `accepted`, which is the right shape
for a journal and leaves nowhere to put a question that was raised and has not been arbitrated.
Those live in [open-questions.md](open-questions.md), with what was measured, what each option
costs, and what evidence would settle it. An entry there closes by an ADR in this journal, and names
it; it does not close by going quiet.

## A decision that is not taken yet

The template's status vocabulary is `proposed | accepted | superseded by ADR-[n] | deprecated`, and
`proposed` is the one that carries a question rather than an answer. An ADR written that way records
the behaviour the tree currently has, argues the alternatives, and — the part that keeps it from
being a note nobody acts on — states **what would settle it**: the evidence that would ratify or
reverse it. Until that evidence exists it stays `proposed`, and `test/unit/adr-proposed.test.js`
holds it to that shape.

This is the mechanism, not a second register beside it. runward already reads a decision's status:
`readReopeningTriggers` watches the triggers of accepted ADRs only, because a `proposed`,
`superseded` or `deprecated` decision is not a live backlog, and in a MISSION journal the gate
surfaces `Status: hypothesis` and `DRAFT-` files as unratified decisions. The product knows what an
undecided decision is; the journal uses that, rather than inventing a parallel place where a
question could sit unenforced.
