# The built-in analyzers on three repositories runward did not write

**Measured**: 2026-11-06 · **Answers**: [ADR-0117](../adr/ADR-0117-the-verdict-measures-what-the-accountable-people-declared-against-what-the-agent-delivered-decisions-code-and-execution-each-at-a-named-level.md), "What would settle it", criterion 2 · **Reading measured**: the analysis policy `runward-analysis/1` ([ADR-0118](../adr/ADR-0118-built-in-analyzers-read-the-delivered-code-against-what-the-mission-declares-under-a-policy-it-pins.md))

ADR-0117 moves the default of new missions to "the analyzers read the code" only when the analyzers show
zero false reds on at least three real repositories runward did not write, with every finding classified true
or false by a reviewer session that did not write them, and the classification published with its commands.
A family that cannot reach zero stays opt-in. This page publishes the measurement: the repositories and the
commits they are pinned at, the commands that collect every finding, how the findings were classified and by
whom, and the reviewers' files.

What it measures is runward's reading. A finding classified true is a true reading of what the mission
declares (or of what the harness declared for it, below), never a defect of the measured project; a finding
classified false is runward's false red. Zero false reds on these three repositories says nothing of a fourth.

## The repositories

Pinned in [`scripts/measure-analyzers.repos.json`](../../scripts/measure-analyzers.repos.json), at the commit
named, under the licence named:

| Repository | Commit | Date | Licence | Read as | Domain core the harness declares |
|---|---|---|---|---|---|
| [express](https://github.com/expressjs/express) | `43fca52d28a422c8be48fd489cbd4f2d6152bab6` | 2026-11-02 | MIT | JavaScript (CommonJS), mocha and supertest | `index.js`, `lib/**` |
| [fastify](https://github.com/fastify/fastify) | `1b954e5602261115b67708c73a9729231d70d2a0` | 2026-11-04 | MIT | JavaScript and TypeScript declaration tests, node:test | `fastify.js`, `lib/**` |
| [hono](https://github.com/honojs/hono) | `eb754bd5ef22c63f1634a4c374a86be086f85710` | 2026-11-05 | MIT | TypeScript, Vitest cases beside the sources | `src/*.ts`, `src/router/**`, `src/utils/**` |

## The commands

The harness is [`scripts/measure-analyzers.mjs`](../../scripts/measure-analyzers.mjs). From a runward
checkout, built, with the Node.js version its `.nvmrc` names:

```sh
npm ci && npm run build
node scripts/measure-analyzers.mjs --build . --out /path/to/output
```

For each repository it fetches the pinned commit once (`git`, depth 1), then for each of two profiles copies
the tree, sets a mission up the supported way (`runward --yes init --path <tree>`, which pins the analysis
policy, ADR-0118 decision 4), and runs `runward check --strict --json --path <tree>`:

- `default`: nothing else, the configuration of a new mission;
- `declared`: the harness also writes `runward/territory.md`, declaring the domain core in the table above,
  and `applied` rows of `runward/architecture.md` citing the top-level declarations of those files, so the
  boundary and cited-symbol families have code to read. These declarations are the harness's, not the
  project's; the files written are copied to the output.

It writes `findings.json`, `findings.md` and `hypotheses.md`, sorted, without timestamps or local paths, so two
runs of one build write the same bytes. Each finding has a stable id (`hono-5ecd867d44`), and `findings.md`
gives the setup line of each repository and profile and, for each finding, the command that prints it again
(`jq` is the only tool besides git and node). Network: `git fetch` from the repositories' URLs, nothing else.
It installs nothing in the measured trees and runs none of their code: runward reads their files at rest.

## The method

1. **Collection**, by the harness above, on one build. It classifies nothing.
2. **Classification**, by two reviewer sessions that wrote neither the analyzers, nor their correction, nor
   the harness: one for express and fastify, one for hono. Each read the code each finding cites and judged
   its message against that code, never against the analyzers' implementation, and recorded a verdict,
   `TRUE` or `FALSE`, with its reason and the pattern it belongs to.
3. **A later build** is measured with the same harness on the same commits, and classified by finding id:
   an id kept keeps its verdict unless its message changed; a `TRUE` id that disappears is examined as a
   possible false green; a `FALSE` id still present is a false red not yet corrected; a new id is classified
   from the code.

## The classification data

The reviewers' files, in [`analyzers-on-real-repositories/`](analyzers-on-real-repositories/), published as
they wrote them, except for five phrases: four references to the measuring session's scratch directory, each
replaced by the name of the file here, the measurement or the branch it named, and one word in a reason of
hono, where "a runtime built-in" now stands:

| File | Build measured | What it holds |
|---|---|---|
| [`express-fastify-03c5e64.json`](analyzers-on-real-repositories/express-fastify-03c5e64.json) | `03c5e64`, the first integration train | 98 findings of express and fastify, each classified: 79 `TRUE`, 19 `FALSE` |
| [`hono-03c5e64.json`](analyzers-on-real-repositories/hono-03c5e64.json) | `03c5e64` | 123 findings of hono: 13 `TRUE`, 110 `FALSE` |
| [`express-fastify-9004563.json`](analyzers-on-real-repositories/express-fastify-9004563.json) | `9004563`, the corrected reading of `fix/analyzers-false-reds` | the delta by id against the file above: no `TRUE` id gone, no `FALSE` id left, the new ids classified, the 13 hypotheses `case-asserts-completion` checked against an independent scan of 2,938 cases |
| [`hono-9004563.json`](analyzers-on-real-repositories/hono-9004563.json) | `9004563` | the delta by id: the 13 `TRUE` ids kept, the 110 `FALSE` ids gone, one new id classified `TRUE`; the type check of hono checked to cover its tests |

The corrections those classifications led to are recorded in ADR-0118 (the amendment of 2026-11-06 and its
decisions), and their tests are `test/unit/analyze-false-reds.test.js`,
`test/unit/analyze-typecheck-coverage.test.js` and `test/unit/analyze-environment-reads.test.js`, each
beside a case classified true. Under ADR-0118's decision (b), these false reds, measured before any release
carried the analyzers, are this measurement, not `undue-refusal` entries of the
[defect register](known-defects.md).

## The measurement at `51675dc`, and its classification: zero false reds

The head of the second integration train of 2026-11-06, `51675dcf7ddab8665087663eb128773148bd1eb2`, was
measured on the same three commits with the commands above, its tree clean, under Node.js 24.22.1:

```sh
git checkout 51675dcf7ddab8665087663eb128773148bd1eb2
npm ci && npm run build
node scripts/measure-analyzers.mjs --build . --out /path/to/output
```

| Repository | Findings in a new mission's default | More findings with the declared core | Hypotheses (never counted) | Classified `FALSE` |
|---|---|---|---|---|
| express | 3 | 47 | 63 | 0 |
| fastify | 1 | 32 | 56 | 0 |
| hono | 8 | 7 | 10 | 0 |
| **Total** | **12** | **86** | **129** | **0** |

Two reviewer sessions that wrote neither the analyzers, nor their correction, nor the harness, one for express
and fastify and one for hono, classified it by id against `9004563`: 225 of the 227 ids are kept, each with
its message, path, line and verdict unchanged; one finding is new, `hono-b885ee1078` (the process environment
read through a binding of `globalThis` in the declared core, `src/utils/color.ts:23`), classified `TRUE`; one
hypothesis was reworded to name the promise whose `reject` fails its case (`fastify-1f0de68d26`, now
`fastify-dab19f1d22`), classified `TRUE`, and a hypothesis does not count. Every one of the 98 findings is
classified `TRUE`, and no `TRUE` id of the earlier measurement disappeared:

| File | Build measured | What it holds |
|---|---|---|
| [`express-fastify-51675dc.json`](analyzers-on-real-repositories/express-fastify-51675dc.json) | `51675dc`, the second integration train | the delta by id against `9004563`: the 201 kept ids (83 findings, all `TRUE`), the reworded hypothesis classified, the 13 hypotheses `case-asserts-completion` checked again against the independent scan of 2,938 cases; 0 false reds |
| [`hono-51675dc.json`](analyzers-on-real-repositories/hono-51675dc.json) | `51675dc` | the delta by id: the 14 kept ids, all `TRUE`, and the new id classified `TRUE`; the type check of hono checked again; 0 false reds |

The two files are published as the reviewers wrote them, except for five phrases referring to the measuring
session's scratch directory, each replaced by the name of the file here, the measurement or the branch it
named.

**ADR-0117's criterion 2 holds at `51675dc`**: zero false reds on three repositories runward did not write,
in a new mission's default and with a declared core, every finding classified by a reviewer session that did
not write it, the classification published here with its commands. No family had to stay opt-in.

**The head of the third integration train reads the same.** That train changes no analyzer. Measured on
2026-11-06 with the same harness on the same commits, its merge of the second train's head (`30b7bf7`) writes
the same 227 ids, each with every field the same as at `51675dc`: the classification above holds for it.
