# Running runward with no network, or inside a qualified cloud offer

**Written**: 2026-11-06 · **Measured on**: `main` at `382e2f0`, unreleased (its `package.json` still reads
0.46.0), with Node.js 24.22.1 and npm 11.19.1 on macOS 26.2 arm64; it applies from the release after
0.46.0 · every measurement below was made that day, positive controls included.

Your code has to stay inside an air-gapped network, or inside a cloud offer that ANSSI, the French
national cybersecurity agency, has qualified under SecNumCloud, and you ask of every tool: does anything
leave the environment when it runs? This page answers for the `runward` package, command by command,
names the steps that do need a network, and says what replaces each of them. For a security or
procurement review, see [regulated-adoption.md](compliance/regulated-adoption.md).

## The short answer

**Scope.** A full clone, on the machine named above. On Linux, CI runs part of these commands with the
network cut; on Windows, none was ever run with the network cut. Where the published 0.46.0 behaves
otherwise, the page says so.

- **On that machine, running runward needed no network, apart from the commands you give `check --hooks`.**
  The gate (`check`, `check --strict`), `verify`, ratification, and the commands that write the
  attestations, the witness, the SARIF, JUnit and Code Quality reports, the HTML report, the OSCAL pack
  and the seal gave the same exit codes, the same output byte for byte and the same files with the
  network denied as with it open.
- **In a partial clone** (`git clone --filter=blob:none`), runward's own git reads run with
  `GIT_NO_LAZY_FETCH=1`: git fetches nothing, and a read that needs an object the clone lacks is reported
  unknown. Up to 0.46.0, `characterize` (from 0.21.1), `doctor` and `sample` (from 0.43.0) made git
  fetch from the remote there, and with a git older than 2.45.0, which ignores the variable, they still
  do (RWD-2026-0202 in [known-defects.md](compliance/known-defects.md)).
- **Bringing runward in needs a network.** Installing the package, `npx` when the pinned version is not
  installed, and a build from source fetch from an npm registry. A mirror (not measured) replaces it, and
  so, for the install, does a tarball with an npm cache carried across (measured).
- **Steps around runward may need one too**, such as keyless signing, the online steps of release
  verification, the Action, templates and plugins fetched from GitHub, and the optional `runward-forge`
  summary poster: the table below lists them all, with what replaces each.

## How it was measured

Each command ran twice, on fresh missions at the same path and with an empty `HOME`: once under

```sh
sandbox-exec -p '(version 1)(allow default)(deny network*)' <command>
```

and once with the network open. `sandbox-exec` is deprecated by Apple and works on macOS 26.2. The cut
was checked first, both ways: under the profile, `curl` to the npm registry, a Node.js `fetch`,
`git ls-remote`, a TCP connection to a literal IP address and a loopback `listen` all failed; with the
network open, all five succeeded.

| What ran (on the example mission of `init --example`, unless named) | What it writes | Exit code, both modes |
|---|---|---|
| `check`, `check --strict` | nothing | 0 |
| `check --strict` with `--json`, `--attest`, `--attest --whole-tree`, `--sarif`, `--vsa --resource-uri <uri>` | the document, on standard output | 0 |
| `check --strict` with `--witness <file>`, `--junit <file>`, `--codequality <file>` | the files named | 0 |
| `check --freeze` | `runward/evidence-lock.json` | 0 |
| `verify <attestation>`, on a plain and on a `--whole-tree` attestation, and `verify --json <attestation>` | nothing | 0, verified |
| `propose`, then `ratify --by <person>` at a terminal, and `ratify --agent <name> --for <person>` with `--list` and `--accept <id>` (on a new mission where `propose` proposed one rule, in two manifests) | the ratification lines, in the manifests | 0 |
| `report`, `report --format md` | `runward/governance/delivery-report.html`; standard output | 0 |
| `compliance iso-42001`, `nist-ai-rmf`, `eu-ai-act` | `runward/compliance/` | 0 |
| `init`, `bundle`, `characterize`, `update`, `manifest`, `manifest --sync`, `status`, `rules`, `explain`, `wire`, `gate-hook --harness claude`, `check --coverage` | the mission files, for those that write | 0 |
| `doctor`; `sample` | nothing | 1 (one warning: no tool profile); 2 (no delegation charter) |

Each gave the same exit code and byte-identical output in both modes; the files the runs left outside
`.git` were byte-identical between the two, and the empty `HOME` was still empty afterwards. One command
behaved differently, as it should: `check --strict --hooks`, with a hook that runs `curl`, exited 1 under
the sandbox, because the hook failed, and 0 with the network open.

Three results hold only under a condition. The VSA (`--vsa`) carries a time: it was byte for byte the same
across the two modes because `SOURCE_DATE_EPOCH` was set, and without it two runs two seconds apart
differed, where a plain `--attest` gave the same bytes twice. `--whole-tree`, and `verify`'s exit 2 on an
attestation another build produced, are in no release yet: with the network denied, the published 0.46.0
refused `--whole-tree` (`unknown option`, exit 2) and answered "✓ verified", exit 0, on an attestation
made by `main`'s build, while `main` answered an attestation made by 0.46.0 with exit 2 and the command
that re-derives it with 0.46.0.

Not run here. `doctor` and `sample` ran on the example and stopped before their git reads: it carries no
ratification entry and no delegation charter (`test/unit/partial-clone-no-fetch.test.js` runs those
reads, in a partial clone and a full one, with no run under the sandbox). Never run: `wire --install` and
`--uninstall`, `ratify --all`, `--decided` and `--attest-blind`, `check --through`, the interactive
`init`, `spec-check`, `characterize --mine`.

Measured once, and guarded by nothing: the 27 dependencies npm installed with runward on 2026-11-06,
resolved from version ranges, so a later install can resolve others. A search of their 91 JavaScript
files for network modules and `fetch` found none; the same search finds network code in
`packages/runward-forge` (positive control). From the first release after
[ADR-0129](adr/ADR-0129-runward-has-no-runtime-dependency-the-argument-parser-the-terminal-colours-and-inits-questions-are-written-in-the-package-on-nodejs-built-ins.md)
runward has no runtime dependency, so this paragraph has no object: what runs is the package's own
modules, which the test below reads.

### What keeps it true between two measurements

- `test/unit/runtime-boundary.test.js` fails if a module of the `runward` package, in `src/` or in
  `dist/`, imports `http`, `https`, `http2`, `net`, `tls`, `dgram`, `dns` or `undici`, or reaches
  `fetch`, a WebSocket, an EventSource or an `XMLHttpRequest`, and shows it can fail: a planted `fetch`,
  and planted imports of `http`, `https`, `dns`, `http2` and `undici`, must turn it red. It also walks the
  import closure of the verdict and finds none of these modules and no process spawner
  ([ADR-0054](adr/ADR-0054-the-runtime-boundary-is-explicit.md)); that walk follows runward's own modules
  only, never a dependency (through 0.47.0 `commander`, a dependency then, imports `child_process`; since
  ADR-0129 there is no dependency to follow, and `test/unit/zero-runtime-dependencies.test.js` fails if
  a module of the build imports anything but a Node.js built-in or one of the package's own files). It passed, 12 tests of 12, with the
  network open and with it denied.
- The CI job `core tests, network-isolated` (`.github/workflows/ci.yml`) runs on every push to `main`
  and every pull request. Its test step, and only that step, runs inside `sudo unshare -n`, with the
  loopback brought up, and stops if a default route is left; `npm ci` and the build before it run with
  the network. That step runs the smoke suite, the OSCAL schema test, the in-toto schema test (which runs
  `check --strict --attest`, `bundle` and `check --strict --vsa`), runward's own `check --strict`, and
  the vendored-corpus test (`update --corpus <dir>` takes a local path, never a registry coordinate),
  then attests and verifies the example mission, writes its delivery report, and ratifies a proposed row
  as an agent; `test/unit/regulated-posture.test.js` fails if any of these commands leaves the cut. It
  covers part of the table above, on Linux only.
- The CI job `test` searches `src/` for network modules, `fetch(`, `eval` and calls to network tools
  such as `curl`. It finds none on `main`, and a copy with a planted `fetch(` fails it (both run for this
  page). It reads `src/` only.
- Apart from the commands of `runward/hooks.json`, which only `check --hooks` runs, the one program
  runward starts is `git`, for local reads (`log`, `show`, `blame`, `diff`, `ls-tree` and the like) in
  `characterize`, `doctor` and `sample`, never `fetch`, `clone` or `push`, and always with
  `GIT_NO_LAZY_FETCH=1`; `SPAWN_ALLOWED` in `eslint.security.config.js` names the four source files
  allowed to start a process.

## What needs a network, and what replaces it

| Step | What it reaches | Without a network |
|---|---|---|
| Installing, `npm install runward@X.Y.Z` | an npm registry, for runward and its dependencies: three direct (`@inquirer/prompts`, `chalk`, `commander`), 28 packages in all on 2026-11-06 | a mirror (not measured), or the tarball with an npm cache ([below](#installing-without-a-network)). The tarball alone is not enough: with an empty cache, its install failed on the dependencies (`ENOTFOUND registry.npmjs.org`). From the first release after ADR-0129 runward has no dependency and the tarball alone is enough: measured on 2026-11-11 on a tarball packed from that change, `npm install --offline` with an empty cache installed it, one package on disk |
| `npx --yes runward@X.Y.Z`, which the agent hooks (`wire --install`), the CI templates and the samples of `runward/adapters/` use | the registry, whenever that version is not installed | install exactly that version: from inside the directory that holds it, `npx` ran it with no network and an empty cache, and with no install it failed (`ENOTFOUND`); [distribution.md](distribution.md) records the same on an earlier npm. The samples `init` writes are stamped with its version since 0.45.0; older ones run a bare `npx --yes runward`, whatever version the registry or a global install gives, until `runward update` re-pins them, as it did on this repository's own mission on 2026-11-06. `report` and `report --format md` print their replay command as `npx runward@X.Y.Z …`, without `--yes` |
| The Action, `uses: stranxik/runward@<sha>` | GitHub, from which the runner fetches the Action; then the registry, through `npx`, for `version:`, which defaults to `latest` | a runner that reaches GitHub and a registry or a mirror; pin both the commit and `version:` (not measured) |
| The GitLab template | through `include: remote:`, GitHub, from which the instance fetches the release asset `runward-gitlab-gate-X.Y.Z.yml` (its `version` pinned to X.Y.Z), so an instance that cannot reach GitHub cannot load it; the template itself, `templates/ci/gitlab/runward-gate.yml`, defaults `version` to `latest`; either way its job installs runward through `npx`, from the registry | a copy on your instance through `include: project:` ([gitlab.md](gitlab.md), option B), a pinned `version`, and a registry or a mirror the job reaches (not measured here) |
| The plugins for Claude Code, Gemini CLI, Codex and Kiro | GitHub, from which each tool fetches its packaging ([distribution.md](distribution.md)); then the registry, through the `npx --yes runward@<version>` of their hooks | not measured; the hooks behave as `npx` above |
| `verify` of an attestation another runward build produced (not in 0.46.0) | nothing: it exits 2 and prints `npx --yes runward@X.Y.Z verify <file>` | install that version: the printed command then verified offline (measured on an attestation made by the published 0.46.0) |
| Building from source, `npm ci && npm run build` | the registry, for the development dependencies | a mirror. `npm pack` of a built tree needs none |
| Signing an attestation | runward signs nothing: `check --attest` writes an unsigned in-toto Statement. Keyless signing with Sigstore asks Fulcio, its certificate authority, for a short-lived certificate tied to an OIDC identity, and the signature and certificate are "persisted in a transparency log", Rekor ([Sigstore overview](https://docs.sigstore.dev/about/overview/)) | a key you hold, with your own tool ([runward-signing.md](spec/runward-signing.md) names `openssl` for an offline key). Neither was measured here |
| Uploading SARIF | `check --sarif` writes the log on standard output, and its help says "upload it yourself": the upload is yours | keep the file, or upload it to a service inside the environment |
| `check --hooks` | whatever the commands of `runward/hooks.json` reach | they are yours: a hook running `curl` failed under the sandbox, and the gate counted the failure (exit 1) |
| `sample draw`, under a delegation charter only | the signature of a public `drand` round, which runward does not fetch (`src/commands/sample.ts`) | fetch it where you can and pass it with `--signature`; not run here |
| Release verification ([verifying-a-release.md](verifying-a-release.md)) | Steps 0, 1, 2, 2c, 5, 6, 7 and 9, and the first command of Step 8, contact a service | Step 3 and the second command of Step 8 verify offline ([below](#verifying-a-release-without-a-network)); Step 4 has an offline form with `cosign`, not measured here |
| `runward-forge post-summary` (a second package of this repository, optional) | its `gitlab` adapter writes one merge request note through the API at `CI_API_V4_URL`, the instance running the job, with the token in `RUNWARD_FORGE_TOKEN` | its `github` adapter appends to the job summary file and needs none. With the network denied, the `gitlab` adapter printed `summary not posted: network error` and exited 0; with it open, it posted (both against the repository's loopback stub) |

The repository's third package, `packages/runward-assess`, is not published (`"private": true` in its
`package.json`) and reads the network in its `snapshot` stage, by design (its README). Neither it nor
`runward-forge` is in the `runward` tarball.

## Installing without a network

On a connected machine, with the release tarball `runward-X.Y.Z.tgz` (a release asset, the same bytes as
the npm tarball: Step 0 of [verifying-a-release.md](verifying-a-release.md); verify it as in Step 3):

```sh
mkdir fill && cd fill && npm init -y
npm install --cache ../npm-cache ../runward-X.Y.Z.tgz
```

Carry `runward-X.Y.Z.tgz` and `npm-cache/` across, then, inside, in the directory that will hold runward:

```sh
npm init -y
npm install --offline --cache ./npm-cache ./runward-X.Y.Z.tgz
./node_modules/.bin/runward --version
```

Measured on 2026-11-06, as written, with the 0.46.0 release asset: the offline install added the 28
packages, and `npx --yes runward@0.46.0` then ran this install with no network. A tarball packed from
`main`, installed the same way, ran `init --example`, `check --strict`, `check --strict --attest` and
`verify` with the network denied. The bench of [gitlab-bench.md](gitlab-bench.md) does the same every week
in a CI pipeline that has no registry: a tarball, a packed npm cache, `npm install --offline`,
`runward check --strict`.

From the first release after ADR-0129 the cache is not needed: runward has no runtime dependency, so
`npm install --offline ./runward-X.Y.Z.tgz` installs from the file alone (measured on 2026-11-11 on a
tarball packed from that change, with an empty cache: one package on disk, `runward --version` answers),
and the paragraph below has no third-party package left to speak of.

What this route does not check: Step 3 verifies runward's tarball, and no step of it establishes where
the 27 third-party packages the cache carries came from (online, `npm audit signatures`, Step 1 of the
guide, reads the registry signatures of an installed tree). Neither this route nor the bench covers what
your own network adds, such as a proxy or an internal certificate authority.

## Verifying a release without a network

Step 3 of [verifying-a-release.md](verifying-a-release.md) needs three files: the tarball, the bundle
attached to the release, and a trusted root fetched once while online
(`gh attestation trusted-root > trusted-root.jsonl`). `.github/workflows/documented-commands.yml` runs
it, and the second command of Step 8, with the network cut, weekly and on every pull request that touches
the guide. On 2026-11-06, for v0.46.0, with the network denied:

- Step 3 exited 0 with `gh` logged in, and again with an empty `HOME` and no token; the certificate
  named `release.yml@refs/tags/v0.46.0` and a hosted runner;
- the second command of Step 8, for the qualification kit, exited 0;
- a copy of the tarball altered by one byte was refused, exit 1;
- without `--custom-trusted-root`, the verification could not start (`no valid Sigstore verifiers could
  be initialized`, exit 1): fetch the trusted root before you go offline.

The verification runs offline; the trust it rests on is not yours. The file `gh` fetched holds two roots,
the public Sigstore instance's (its certificate authority, Fulcio, its Rekor logs and its timestamp
authority) and GitHub's (its certificate authority and its timestamp authority), fetched from them; what
changes in them after you fetched the file is not seen. What these checks prove and what they do not is
written in the guide, step by step, and in its last section.

## A qualified cloud offer, and a hosted product

A qualification applies to an offer, not to a program run inside it, and runward holds none. Inside such
an offer, what this page measured still holds; running runward there extends no part of the offer's
qualification to it. The URLs in runward's outputs (predicate types such as
`https://runward.dev/verdict/v1`, links to documentation) are names and links, never fetched, and the
HTML report loads nothing: its generator (`src/lib/report.ts`) writes no script, no external stylesheet,
no image and no link. A hosted product:
[ADR-0093](adr/ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
plans one (stage D6): a separate product, which nothing on this page describes.

## Replay it

```sh
# the cut first: this must fail
sandbox-exec -p '(version 1)(allow default)(deny network*)' curl -sS -o /dev/null https://registry.npmjs.org/
# then any command of this page, the same way
sandbox-exec -p '(version 1)(allow default)(deny network*)' runward check --strict
```

On Linux, the CI job `core tests, network-isolated` does the same with `sudo unshare -n`, after checking
that no default route is left.

## What was not measured

- a mirror (not measured): installing through an internal registry;
- signing an attestation, keyless or with a key;
- `cosign` offline (Step 4 of the guide);
- Linux and Windows with the network cut, beyond the part CI covers on Linux;
- the published release, except where this page names 0.46.0;
- a proxy, and an internal certificate authority;
- and the commands listed under "Not run here".

## What this page does not claim

It does not claim that runward holds a qualification of any kind, nor that a green verdict proves the
code correct: it reports which commands ran with the network denied, on the build and the day named at
the top, and how to run them again.
