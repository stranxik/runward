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

## Before you explain a number

The section above is about not building what exists. This one is its twin, and it caught me a third
time on 2026-09-01, in a form the first rule does not cover.

A whole-perimeter measurement reported that an extended `test/sarif-shape.js` had retired **zero**
survivors. I explained the zero: *the schema leg must be outside the mutation net*. It is not — it
is a leg, named in `scripts/mutation-net.mjs`. What was stale was the second pass, which nobody had
re-run, and the register I had regenerated dozens of times says so in a section headed **Pass 1 /
Pass 2**.

The failure is not "I did not look". It is that a surprising number arrived with a ready
explanation, and an explanation feels like an answer. So:

1. **When a measurement surprises you, find what PRODUCED it before you say what it means.** Which
   command, which pass, which scope. A number is evidence about a run, never about a design.
2. **An observation can refute a claim about the system; it cannot establish one.** "Zero retired"
   refutes "the net caught things here". It establishes nothing about where the net lives.
3. **Suspect yourself hardest when the explanation is elegant.** "That leg is outside the net" was
   tidy, plausible, and consistent with everything I had in mind — which is exactly why it needed
   the two minutes of reading it did not get.

The general rule behind all three failures is one sentence: **never infer a specification from an
observation.** A corpus of 63 `accepted` ADRs is not the status vocabulary; a grep that returns
nothing is not the absence of a mechanism; a zero is not an architecture.
