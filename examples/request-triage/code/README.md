# Request triage — runnable floor

The executable counterpart of the [request-triage example mission](../README.md).
The mission documents in [`../runward/`](../runward/) decide; this code does
exactly what they decided — nothing more. Standalone package, MIT, no key, no
network: the default model adapter is a deterministic keyword classifier.

## What the code shows

- **Classification into a closed vocabulary** (`support`, `sales`,
  `compliance`, `unknown`): the model proposes a category; anything outside
  the vocabulary is treated as `unknown`. Abstention is a first-class answer:
  an unknown category or a low confidence goes to the human review queue,
  never to a plausible guess.
- **Deterministic guard on extracted fields**
  ([ADR-0002](../runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md)):
  the model never supplies a value the system can compute or verify itself.
  An account reference is resolved against a hard-coded registry — resolved
  means `verified`, unresolved means the request escalates to review, it is
  never routed on. A deadline is re-parsed from the source text by a
  deterministic parser and the model's proposal is discarded, even when it
  looks right.
- **Guarded routing** (`RoutingPort`,
  [contract](../runward/contracts/routing-port.md)): the system's only action
  on the world. The adapter enforces the invariants itself: fail-closed
  refusal of any record whose action-bearing fields are still
  `model-proposed`, no compliance assignment without a recorded approval,
  idempotency on the request id.
- **Fail-closed compliance without a frozen process**: a compliance request
  suspends — the validated record is serialized, the call returns
  `suspended`, and `resumeTriage(requestId, "approve" | "reject", decidedBy)`
  rehydrates it on the human decision. Approve routes with the approval
  recorded; reject means the routing never happens. The summary the approver
  sees is built by code from the validated fields, never a model
  reformulation.

## Quickstart

Prerequisite: Node 22.13+ (ESLint 10's floor; `npm test` alone runs on Node 20).

```bash
npm install
npm test               # 14 deterministic tests via node:test + tsx
npm run demo           # five requests end to end, including a compliance suspension and a fabricated account the guard refuses
npm run lint           # the hexagon, eval and credential literals, refused by eslint.config.mjs
npm run reports        # regenerate reports/: junit.xml, lcov.info, eslint.json, eslint.sarif; commit the result
npm run reports:fresh  # regenerate into a scratch directory and compare with reports/; never writes reports/
```

## The reports the mission cites

runward reads a committed report and never runs a tool, so the reports are produced here and
committed beside the code they describe. Each script runs its tool, removes only what ties the
output to the machine that ran it (absolute paths, timings), and exits with the tool's own verdict:

| Report | Script | What a manifest row cites | Refused when |
|---|---|---|---|
| `reports/junit.xml` | `scripts/junit-committable.mjs` | a case: `test:code/reports/junit.xml::"<name>"` | the case is absent, failed or skipped |
| `reports/lcov.info` | `scripts/coverage-committable.mjs` | a source file: `file:code/reports/lcov.info#src/core/domain/guard.ts` | nothing executed the file |
| `reports/eslint.json` | `scripts/lint-committable.mjs` | a source file: `file:code/reports/eslint.json#src/core/domain/guard.ts` | the file was not linted, or ESLint recorded an error in it |
| `reports/eslint.sarif` | `scripts/lint-committable.mjs` | a rule: `file:code/reports/eslint.sarif#no-restricted-imports` | the rule was not in force, or fired anywhere under `src/` |

`npm run reports:fresh` (`scripts/reports.mjs --check`) is the proof that the committed reports are
the ones this tree produces. It compares what the gate reads of each report, and whatever else the
report records that does not depend on the machine, never the bytes: Node.js 22 and 24 write this
suite's coverage with different hit counts on two lines. `runward/hooks.json` runs it before the gate
under `runward check --strict --hooks`, the command the CI samples run. Change the code, run
`npm run reports`, read the diff of `reports/`, commit it.

What the lint refuses is a set of shapes (an import, a call, a literal); what the coverage says is
that a file ran, never that it was tested well. Both raise the cost of a false green; neither proves
the code right.

## Layout

```
code/
  eslint.config.mjs           # the boundaries as lint rules: the core imports its own modules and zod only
  reports/                    # the committed reports the manifests cite (npm run reports)
  scripts/                    # one script per report, and reports.mjs, which runs them and compares
  src/
    core/
      domain/triage.ts        # TriageRecord contract: categories, provenance markers, queues
      domain/guard.ts         # deterministic guard: registry resolution, deadline re-parse, summary
      ports/                  # model, account registry, routing, triage log
      application/triage-request.usecase.ts  # orchestrate: propose -> guard -> route / suspend
    adapters/
      keyword-model.adapter.ts            # deterministic model (no key, no network)
      hardcoded-account-registry.adapter.ts
      in-memory-routing.adapter.ts        # enforces the routing invariants, fail-closed
      in-memory-triage-log.adapter.ts
    demo.ts
  test/triage.test.ts
```

## Relation to the mission documents

Same categories, same success criterion, same attached condition as the
documents in [`../runward/`](../runward/): no compliance-category request is
ever routed without human review — here that is a routing-port invariant the
tests exercise, not a promise. The architecture note's ports
([architecture.md §3](../runward/architecture.md)) map one to one onto
`src/core/ports/`; the intake port is reduced to the validated input schema
of the use case.
