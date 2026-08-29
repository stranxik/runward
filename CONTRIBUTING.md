# Contributing

Thanks for considering a contribution. Two rules keep this simple.

## What accepts contributions

Everything in this repository is **MIT tooling**: the CLI (`src/`), the templates, the **workflows and craft rules** (`templates/workflows/`, `templates/rules/` — the main contribution surface), the tool profiles, the examples and the docs. Bug reports, fixes, new tool profiles and workflow/rule improvements are all welcome.

## What does not

The doctrine *"Designing and Running Agentic Systems"* is a separate work under **CC BY-ND 4.0** — it does not accept pull requests, and contributions here must not copy its text. See [NOTICE.md](NOTICE.md) for the boundary.

## Before you open a PR

- Run `npm test` (build + smoke test, including the gate audit of the example mission). It must pass.
- Keep changes small and focused; one concern per PR.
- A structural change to the method (a workflow's gates, a rule's default) needs a short rationale in the PR description — defaults move on evidence here too.

## Before you add a place for something

This applies to people and to coding agents working here, and it is written down because the failure
it prevents already happened, on 2026-08-29: an agent decided a question awaiting arbitration had
nowhere to live, and added a register beside the decision journal — next to `Status: proposed`, which
the journal's own template declares and which the tool itself reads (`readReopeningTriggers` watches
accepted decisions only; in a mission journal the gate surfaces `hypothesis` and `DRAFT-` files as
unratified).

The reasoning that produced it was: *look at how the thing is used, infer what it supports*. Sixty-
three ADRs all read `accepted`, so `accepted` looked like the whole vocabulary. **That is reading the
data as the schema**, and it is a trap with a shape: the more consistent a corpus is, the more
confidently it hides an option nobody has exercised yet.

So before adding a file, a register, a status or a directory:

1. **Search the product's vocabulary, not your solution's name.** Grepping for *"open question"*,
   *"awaiting decision"* or *"undecided"* returns nothing here, because the product calls it
   `proposed`, `hypothesis`, `unratifiedAdrs`. A search for the words of your intended answer returns
   nothing, and *nothing found* reads exactly like *nothing exists*. Search the enums, the status
   words, the exported names, the rule ids.
2. **Read the specification, not the instances.** The vocabulary of a field is in whatever declares
   it — for statuses, the ADR template. A directory of examples is evidence of what has been used,
   never of what is allowed.
3. **Prefer the page that already has the charge.** If a mechanism exists, extend it. A second place
   beside a first one is a place where something can sleep with nothing holding it, and the thing
   holding it was right there.
