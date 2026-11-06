# runward-run

The executor of [ADR-0120](https://github.com/stranxik/runward/blob/main/docs/adr/ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md):
it runs a mission's tests and the commands of its declared reports in a container pinned by digest, the
network cut, on a copy of the judged tree, and writes the reports and one unsigned in-toto Statement
that binds them to the tree (`https://runward.dev/run/v1`,
[docs/spec/runward-run.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-run.md)).
The operator's CI signs that Statement in another job; runward reads the reports, the Statement and its
signature bundle as files at rest, at `check --strict --require attested`.

MIT. Node.js 22.12 or later, no dependency. It imports nothing from `runward` and reads the files
runward writes; runward imports nothing from it, never spawns it and does not ship it
(`test/unit/runtime-boundary.test.js` and `test/unit/packaging.test.js` in the repository, with
planted controls). Unlike runward, it runs processes: the container runtime, and through it the
project's code. It holds no key, opens no socket of its own and keeps no state between runs.

This version delivers R1, the tests leg and the declared-reports leg, and R2, the coverage and the
mutation of the cited lines, JavaScript and TypeScript first. The evals leg (R3) is refused by name until
it ships.

## What it does, in order, and when it refuses

```sh
runward check -p mission --strict --require attested --json > check.json   # the expected set, from the tree
runward-run run --policy run-policy.json --tree mission --check check.json --out out \
  [--runtime docker|podman|<path>] [--scratch <dir>] \
  [--repository <host/owner/repo>] [--commit <sha>] [--ref <ref>]
```

1. It refuses, before anything runs: a run policy inside the judged tree (the agent would choose the
   commands that produce its own evidence), an output directory inside it or not empty, an image not
   pinned by digest, an install whose scripts are not disabled, a leg this version does not deliver.
2. It hashes the source files of the expected set from the checkout, before any leg. The set is the one
   runward derived from the tree (`levels.execution.expected` of `check.json`), never one it chooses.
3. The runtime must answer, pull the image by its digest and name it by that digest.
4. It copies the tree (without `.git` and `node_modules`) and installs the dependencies from the
   lockfile on the copy, the network open and install scripts disabled; the lockfile's digest is
   recorded.
5. A probe container started with `--network none` must see the loopback only. A runtime that cannot
   cut the network, or accepts the flag and leaves an interface up, is refused.
6. Each leg runs in its own container, the network cut, as the calling user, writing only to the output
   directory. The mutation leg runs last: its command once on the unmutated copy, then once per mutant
   of the lines runward cited (`levels.execution.mutationTargets` of `check.json`), each mutant written
   into the copy and the file restored after its run.
7. Each report is normalised (no absolute path, no timing, no verdict touched), the sources are hashed
   again, and only then are the reports, the run Statement and its in-toto test-result Statement
   written.

Exit codes: `0` written, every leg exited 0; `1` written, a leg exited non-zero (recorded: a red run is a
fact); `2` a usage error, nothing written; `3` refused, fail closed, nothing written.

## The run policy

It lives with the workflow that runs runward-run, never in the mission: the image, the install, the legs.
The shipped example's is [samples/request-triage.run-policy.json](https://github.com/stranxik/runward/blob/main/packages/runward-run/samples/request-triage.run-policy.json).

```json
{
  "format": "runward-run-policy/0",
  "image": "node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c",
  "install": { "cwd": "code", "lockfile": "code/package-lock.json", "command": ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"] },
  "legs": [
    { "leg": "tests", "cwd": "code",
      "command": ["node", "--import", "tsx", "--test", "--test-reporter=junit", "--test-reporter-destination=${out}/code/reports/junit.xml", "test/*.test.ts"],
      "reports": [{ "path": "code/reports/junit.xml", "nature": "junit" }] },
    { "leg": "mutation", "cwd": "code",
      "command": ["node", "--import", "tsx", "--test", "--test-reporter=junit", "--test-reporter-destination=${out}/code/reports/junit.xml", "test/*.test.ts"],
      "junit": "code/reports/junit.xml" }
  ]
}
```

A command is an argument vector, never a shell line. `${out}` is the output directory as the container
sees it, `${work}` the copy of the tree. Every report of a run is written to one directory, the one its
Statement is written to, because runward reads a run Statement beside the reports it binds. The natures
are runward's: `junit`, `sarif`, `eslint`, `coverage`, `sbom`, `loadtest`.

The mutation leg binds no report: its facts go into the run Statement (`predicate.mutation`). For each
applied row that cites a code location and a test, runward reads whether one of its cited tests failed
on an assertion against a mutant of its cited lines; a row whose tests kill none that way is below
`attested`, named, its survivors listed. Each mutant's run is bounded (`timeoutSeconds`, default 300), and
so are the mutants of one cited location (`maxMutantsPerLocation`, default 40, the first in source order,
the Statement recording how many there were). A coverage leg writes the LCOV runward-run reads for the
coverage of the cited lines, shown on each row; it sets no level. `docs/spec/runward-run.md` §7 gives the
whole contract.

## The CI layout: two jobs, a workflow the agent cannot write

The samples are inert: copy them into a repository of your own, replace what is marked `REPLACE`, pin.

- [samples/github/runward-run.yml](https://github.com/stranxik/runward/blob/main/packages/runward-run/samples/github/runward-run.yml),
  a reusable workflow, called by commit from the mission
  ([samples/github/caller.yml](https://github.com/stranxik/runward/blob/main/packages/runward-run/samples/github/caller.yml)).
  `execute` holds no `id-token` and no secret; `sign` runs no project code and signs under the reusable
  workflow's own identity; `gate` reads the outputs at `attested` and verifies the signature.
- [samples/gitlab/runward-run.gitlab-ci.yml](https://github.com/stranxik/runward/blob/main/packages/runward-run/samples/gitlab/runward-run.gitlab-ci.yml),
  the pipeline of a project the agent cannot write, triggered for the mission's commit: the same policy
  and the same three jobs.

A gate job that only downloads the outputs gets a verdict for that run, which an auditor cannot
re-derive later from the repository. To keep it, commit the reports, the Statement and its bundle with
the tree they judge (the `commit` job of the GitHub sample).

## Signing recipes (the signing job)

**`actions/attest`, keyless (GitHub).** The signing job's OIDC identity is the reusable workflow's; the
certificate names the file and its commit (Build Signer URI and Digest) and the mission's repository and
commit (Source Repository URI and Digest).

```yaml
permissions: { id-token: write, attestations: write }
steps:
  # subjects.sha256: one "<sha256>  <path>" line per subject of the run Statement, each re-hashed;
  # predicate.json: the Statement's predicate. The sample writes both after checking the hand-over.
  - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
    id: attest
    with:
      subject-checksums: subjects.sha256
      predicate-type: https://runward.dev/run/v1
      predicate-path: predicate.json
  - run: cp "$BUNDLE" code/reports/runward-run.sigstore.json
    env: { BUNDLE: "${{ steps.attest.outputs.bundle-path }}" }
```

**`cosign attest-blob`, keyless or with a key (GitLab, offline instances).** cosign 2.6 (the GitLab
sample pins v2.6.1, whose `attest-blob` documents `--statement`, `--new-bundle-format` and
`--tlog-upload`) signs the Statement runward-run wrote, byte for byte:

```sh
cosign attest-blob --yes --new-bundle-format --statement out/code/reports/runward-run.intoto.json \
  --bundle out/code/reports/runward-run.sigstore.json                    # keyless (SIGSTORE_ID_TOKEN)
cosign attest-blob --yes --new-bundle-format --key "$COSIGN_PRIVATE_KEY" --tlog-upload=false \
  --statement out/code/reports/runward-run.intoto.json \
  --bundle out/code/reports/runward-run.sigstore.json                    # the operator's own key, offline
```

The key is the signing project's (a protected, masked variable), never the mission's.

## Verifying the identity (runward-fleet, D4a)

runward re-derives the binding and counts the signature; it never verifies one, and says so
(« attested: the binding is re-derived by this command; the signature is verified outside it »). The
identity is verified offline against the operator's trust policy by `runward-fleet verify-run`, in a job
the agent cannot change:

```sh
runward-fleet verify-run code/reports/runward-run.sigstore.json --policy trust-policy.json \
  --repository github.com/org/app --commit "$GITHUB_SHA" --statement code/reports/runward-run.intoto.json
```

```json
{
  "format": "runward-fleet-trust-policy/0",
  "trustedRoots": ["trust/sigstore-public-good.trusted_root.json"],
  "signers": [{
    "id": "runward-run", "kind": "sigstore", "repositories": ["github.com/org/app"],
    "issuer": "https://token.actions.githubusercontent.com",
    "workflow": "https://github.com/org/ci/.github/workflows/runward-run.yml@refs/heads/main",
    "workflowDigests": ["<the commit of that workflow file>"], "ref": "refs/heads/main"
  }]
}
```

It refuses, by name, a Statement signed from the mission's own workflow (whatever the policy says: the
agent can write that file), by a signer workflow the policy does not pin or pins without a commit, by
the pinned workflow at another commit, for another repository, or for another commit; and a key
signature under no key the policy pins (`"kind": "key"`, a PEM file and its `keyDigest`, for an offline
instance). Exit 0 accepted, 1 refused, 2 a question it cannot ask. A signature on another ref than
`refs/heads/main` verifies and raises no landing (ADR-0093 decision 8).

## What this does not catch

The project's code runs inside the container as written: a test written to print results it did not
compute, or to recognise a mutant, is executed as written. A weak assertion that kills one mutant and
misses the rest meets the row: its survivors are listed, never summed. The mutator changes one operator
at a time, by a lexer and not a parser: an equivalent mutant survives as any other. A run policy written too loosely, a compromised CI provider or runner,
or an agent that holds the operator's CI administration credentials, are outside it. So is anything the
trust policy should not have trusted: the policy is the operator's.

## Install

Not on npm (the bootstrap `runward-forge` still waits on, RWD-2026-0195). From the first release that
carries it, the release holds `runward-run-X.Y.Z.tgz`, packed and attested by the release workflow's
isolated builder, like `runward`. Verify it before you install it:

```sh
gh release download vX.Y.Z --repo stranxik/runward --pattern runward-run-X.Y.Z.tgz
gh attestation verify runward-run-X.Y.Z.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml \
  --source-ref refs/tags/vX.Y.Z \
  --deny-self-hosted-runners
npm install --save-dev ./runward-run-X.Y.Z.tgz
```

Before that release, take it from a commit of this repository, as the samples do
(`node packages/runward-run/src/cli.js`).
