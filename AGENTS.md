# AGENTS.md — working on runward itself

runward is a deterministic CLI that gates delivery on evidence. This repository applies it to itself:
`runward/` is its own mission, and the product must pass its own gate. These instructions are for a
coding agent (or a person) changing this repository.

## Verify before you hand anything back

```bash
npm ci
npm test                             # build, unit suites, smoke, schema and corpus checks
npm run lint                         # the architecture boundary: src/lib/** never imports a command
node dist/cli.js check --strict      # the self-gate; must exit 0
npm run test:reports                 # the committed reports still describe the tree
```

A red self-gate is a failing test. If a report is stale, regenerate it (`npm run test:junit`,
`npm run test:eslint`, `npm run test:security`), read the diff, commit it.

## Boundaries (never)

- Never edit a manifest row, a status or a pointer to make the gate pass. Change the code or the
  decision, or say the row is not ready.
- Never ratify under a person's name; an agent ratifies only with `--agent <name> --for <person>`,
  only rows it did not propose and whose proposer answers to another person, compared by canonical
  id (docs/adr/ADR-0082, ADR-0088 decision 4); `--single-accountable` records the one exception, and
  never decides for the maintainer that it applies. Never write a `### Ratification` line by hand.
- Never regenerate a golden (`UPDATE_GOLDEN=1`) without reading the resulting diff line by line.
- Never add a network call, a model call or a process spawn to the verdict path (docs/adr/ADR-0054).
- Never publish from a machine: releases go through `.github/workflows/release.yml` (runward/runbook.md §3).
- Never name a client, an employer or a candidate organisation anywhere in this public repository.
- Never rewrite an accepted ADR's decision: append a dated amendment, or write a new ADR that
  supersedes or refines it.

## Pull requests

- One concern per pull request; a structural change carries its ADR (`docs/adr/`, the next free number).
- A user-visible change gets an `Unreleased` entry in `CHANGELOG.md`; a defect found gets its
  `RWD-` entry in `docs/compliance/known-defects.md`.
- runward has one accountable person, the maintainer, who answers for every merge. The merge itself is
  pressed under the maintainer's account today, by the maintainer or by an agent session that holds the
  same credential, and the forge cannot tell them apart; once the `runward-steward` App is installed on
  this repository, delegated acts run under the App instead (docs/adr/ADR-0088, stage 1). Delegation:
  declared, not proved, while the maintainer's credential is within agent reach.
- Agent ratifications and forge approvals are disclosed throughput, not independent approval; this is
  not a DORA change-approval control. Review by a model is advisory: it produces findings, it
  never crosses a gate.

See `CONTRIBUTING.md` for what accepts contributions, `GOVERNANCE.md` for the decision model and
`runward/runbook.md` for build, release and incidents.
