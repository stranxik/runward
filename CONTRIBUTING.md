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
