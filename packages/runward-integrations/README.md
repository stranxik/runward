# runward-integrations

The recipes of [ADR-0122](https://github.com/stranxik/runward/blob/main/docs/adr/ADR-0122-runward-integrations-mit-recipes-outside-the-verdict-each-regenerates-its-report-out-of-the-agents-reach-and-counts-only-while-its-control-passes.md):
each one regenerates one report a runward mission cites, from the project's own tools, in a CI step the
agent cannot write, before the gate reads it. A gate that reads the reports the agent committed vouches for
what the agent wrote; a gate that reads reports regenerated from the code refuses what the code does.

MIT. Node.js 22.12 or later, no dependency. It sits outside runward's verdict: `runward` imports nothing
from it, never runs it and does not ship it, and it imports nothing from `runward`
(`test/unit/runtime-boundary.test.js` and `test/unit/packaging.test.js` in the repository, with planted
controls). A recipe changes which files exist when the gate runs, never how they are judged.

## What is counted

A recipe is counted only while its control passes on the runward of this tree; one whose control failed,
or has not run on this runward, reads "not counted", with the reason. The block below is rendered from the
manifests, and the repository's CI refuses a text that counts a recipe whose control does not pass.

<!-- runward-integrations:count — generated from the recipes' manifests by `node packages/runward-integrations/src/cli.js count --write`; CI refuses a text that counts a recipe whose control does not pass on the tree (runward ADR-0122 decision 3) -->
| Recipe | Report | `requires:` | Steps | Level of its report | Maintainer | Count |
|---|---|---|---|---|---|---|
| [`sarif`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/sarif/manifest.json) | SARIF 2.1.0 | `sarif` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |
| [`junit`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/junit/manifest.json) | JUnit XML | `junit` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |
| [`coverage`](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/recipes/coverage/manifest.json) | LCOV | `coverage` | GitHub Actions, GitLab CI | `declared` as a CI step; `attested` as a runward-run leg, once the run is signed | stranxik | counted: its control passed on 2026-11-06, with runward 0.46.0 |

**Counted: 3** (`sarif`, `junit`, `coverage`). **Not counted: 0**.
<!-- /runward-integrations:count -->

## What a recipe is

A directory under `recipes/` with a [manifest](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/schema/recipe-manifest.schema.json)
and its files:

- **the step**, for GitHub Actions (`github/action.yml`, a composite action) and for GitLab CI
  (`gitlab/<id>.gitlab-ci.yml`, a hidden job to extend). It runs the project's own command, which writes
  its report to `{raw}`, a scratch file outside the tree; normalises it as ADR-0073 option 1 does (no
  absolute path, no timing, every verdict and count kept); and replaces the report the mission cites. It
  exits with the tool's status. When the command writes no report of the recipe's format, it removes the
  cited report and exits 3, so that the gate cannot read a report this tree did not produce;
- **the rows**: the `requires:` natures the report satisfies, each with the citable form
  `runward explain` prints for it, and the pointer the shipped example cites;
- **the control**: the shipped example, a planted sabotage only the regenerated report refuses, and the
  exits the control asserts (below);
- **the maintainer**, with the date and the runward version of the last passing control.

## Install a recipe from its manifest

The step must run where the agent cannot write it, and so must its command, which decides what the
report says.

**GitHub Actions.** Call the step by a 40-character commit of `stranxik/runward`, never a branch or a tag,
from a reusable workflow in a repository of yours the agent cannot write, and call that workflow by commit
from the mission: [samples/github/integrations.yml](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/samples/github/integrations.yml)
and [samples/github/caller.yml](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/samples/github/caller.yml).

```yaml
      - uses: stranxik/runward/packages/runward-integrations/recipes/junit/github@<40-character commit>
        with:
          working-directory: code
          report: reports/junit.xml
          command: '["node", "--import", "tsx", "--test", "--test-reporter=junit", "--test-reporter-destination={raw}", "test/*.test.ts"]'
      - uses: stranxik/runward@<40-character commit>
        if: ${{ !cancelled() }}
        with:
          version: "X.Y.Z"
          hooks: "false"
```

**GitLab CI.** Include the template at a pinned commit of a project the agent cannot write, or from
runward's repository with `integrity:`, and extend its hidden job in the pipeline of that project, run for
the mission's commit: [samples/gitlab/integrations.gitlab-ci.yml](https://github.com/stranxik/runward/blob/main/packages/runward-integrations/samples/gitlab/integrations.gitlab-ci.yml).
The job fetches this package by a URL pinned with its sha256 (`RWI_PACKAGE_URL`, `RWI_PACKAGE_SHA256`),
and keeps the regenerated report as an artifact for the gate job.

```yaml
junit:
  extends: .runward-integrations-junit
  variables:
    RWI_CWD: mission/code
    RWI_REPORT: reports/junit.xml
    RWI_COMMAND: '["node", "--import", "tsx", "--test", "--test-reporter=junit", "--test-reporter-destination={raw}", "test/*.test.ts"]'
```

A command is an argument vector, never a shell line. `{raw}` is the file the tool writes, `{rwi}` the root
of this package (the SARIF recipe's ESLint writer lives at `{rwi}/src/tools/eslint-sarif.mjs`), and `node`
is the Node.js that runs the step.

Called from the mission's own workflow instead, the step's code is still pinned, and the command is the
agent's to change: a command that copies the committed report to `{raw}` gives the gate the agent's report
back. The samples keep the commands out of the mission for that reason.

## What each control plants, and what it does not catch

Each control runs on fresh copies of the shipped example (`runward init --example` by the runward under
test, with its lockfile), with the example's dependencies installed and the recipe's own step:

1. the healthy tree, after the step: accepted;
2. the sabotaged tree, without the recipe: accepted by the gate, built-in analyzers included. This is
   what makes the recipe worth having, and the control measures it rather than assuming it;
3. the sabotaged tree, after the step: refused, on the rows the manifest names;
4. each other recipe's sabotage, after this recipe's step: still accepted. What a recipe does not catch
   is measured too.

<!-- runward-integrations:controls — generated from the recipes' manifests by `node packages/runward-integrations/src/cli.js count --write`; each row is what that recipe's control asserts, and CI runs the controls (runward ADR-0122 decision 1) -->
| Recipe | Planted sabotage | Gate, without the recipe | Gate, after the recipe's step | Healthy tree, after the step | The other sabotages, after this step |
|---|---|---|---|---|---|
| `sarif` | a bearer token written as a literal in a new adapter that no row cites, a shape the built-in analyzers do not know and the example's lint configuration refuses; the committed SARIF log still records no result | exit 0: accepted | exit 1: `checklist-day-zero-project` in `runward/floor.md` refused | exit 0: accepted | `junit`'s: exit 0, not caught (the guard's change breaks a test, not a lint rule: the regenerated log records no result, as the committed one); `coverage`'s: exit 0, not caught (the tests and the journal changed within what the lint configuration allows: the regenerated log records no result) |
| `junit` | the guard promotes an account reference the registry does not know as verified, so the record routes instead of escalating to review; the committed JUnit report still records the case that proves the guard green | exit 0: accepted | exit 1: `frontier-deterministic-boundary` in `runward/floor.md`, `security-prompt-injection` in `runward/governance/threat-model.md` refused | exit 0: accepted | `coverage`'s: exit 0, not caught (the tests swapped the journal for a copy of their own: every case still runs green, so a regenerated JUnit report records what the committed one does); `sarif`'s: exit 0, not caught (a credential literal in a file no test loads changes no case: the suite is as green as before) |
| `coverage` | the event-sourced journal overwrites instead of appending, and the tests swapped it for a copy of their own, so every case stays green, still asserts and still imports the code it tests; the committed LCOV report still records the adapter as executed | exit 0: accepted | exit 1: `state-event-sourcing` in `runward/floor.md` refused | exit 0: accepted | `junit`'s: exit 0, not caught (the failing case still executes the guard: the regenerated coverage records it as before, and the step goes red on the failing suite while the gate reads the committed JUnit report); `sarif`'s: exit 0, not caught (the file holding the credential is loaded by no test and cited by no row: coverage has nothing to say about it) |
<!-- /runward-integrations:controls -->

Measured on 2026-11-06 under Node.js 24.22.1, on macOS and on Linux: every exit above, and on the
healthy tree each regenerated report byte-identical to the one the example commits. The same exits through
the GitLab steps, on GitLab CE 19.4.2 with the network cut (the GitLab bench of the repository,
`docs/gitlab-bench.md`).

Run them yourself from a checkout of this repository (they install the example's dependencies, so they
need the network, and they run the example's code):

```sh
npm ci && npm run build
node packages/runward-integrations/src/cli.js control --json controls.json
node packages/runward-integrations/src/cli.js count --check --results controls.json
```

`control --record` writes the date and the runward version of a passing control into each recipe's
manifest; `count --write` renders the blocks again; `count --json` prints the same count as data, for a
surface that renders it elsewhere, each recipe counted or not with its reason. A recipe whose control fails is withdrawn with the
manifest's `withdrawn` field and its reason, and reads "not counted" until it passes again.

## Declared, or attested

A recipe run as a plain CI step regenerates the report, and the report is still **declared** (ADR-0119
decision 1): nothing binds it to the tree once the job ends, and an auditor who runs the gate on the
repository later reads the committed report. Every step says so on every run.

The same command can be a leg of a [runward-run](https://github.com/stranxik/runward/blob/main/packages/runward-run/README.md)
run policy (ADR-0122 decision 5, ADR-0120): runward-run executes it in a container pinned by digest with the
network cut, binds the report to the tree by its run Statement, and the operator's CI signs that Statement;
the report then reaches **attested**. Each manifest carries its leg (`runwardRun.leg`), which runward-run's
policy reader accepts. The JUnit and LCOV legs are the shipped example's run policy's own
(`packages/runward-run/samples/request-triage.run-policy.json`), argument for argument. The SARIF leg needs
an image that carries this package; the sample policy runs the example's own lint script instead.

## What this does not catch

- The project's tests, sources and lint configuration stay the agent's to write: a recipe regenerates what
  the project's tools say about the tree, and a test written to pass whatever the code does still passes.
- Each manifest lists its own limits (`limits`); the table above is what each control measured, on the
  shipped example, in one language. A control that passes here and fails on a real repository in another
  language narrows the recipe's reach to what its control covers (ADR-0122, "what would settle it").
- A compromised CI provider or runner, or an agent holding the credentials of the repository that runs the
  steps, is outside it.

## Install

Not on npm: `private` in its package.json, and nothing in this repository publishes it. From the first
release that carries it, the release attaches it as `runward-integrations-X.Y.Z.tgz`, packed and attested
by runward's isolated builder (ADR-0121 decision 5); Step 9 of runward's `docs/verifying-a-release.md`
verifies it. The steps take it from a commit of this repository (`node packages/runward-integrations/src/cli.js`),
and so can you, before that release or without it.
