# ADR-0116 — What a user installs is what the release tested: the tarball bundles its runtime dependencies, the SBOM describes the package, and no job that signs runs the build

**Date**: 2026-11-05
**Status**: accepted (2026-11-05) — the release tarball carries its runtime dependencies at the versions
of the tag's lockfile (`bundleDependencies`), the release SBOM is the package's own (CycloneDX 1.6,
derived from the tarball and the lockfile, re-derivable by anyone), the jobs that hold `id-token: write`
in the release chain check out nothing and run no code of the tree or its dependencies, a release whose
`runward-forge` is not yet on npm publishes `runward`, warns and stays green, Node.js 26 joins the unit
test matrix, the OSCAL ingestion installs from a hash-pinned closure, and the CI job that writes the
reference JUnit report keeps it as an artifact
**Deciders**: delegate agent, class D of `runward/delegation.md`, on the maintainer's instruction of
2026-11-05. The change touches `.github/**` and `package.json`, pre-merge paths of the charter: the
pull request waits for the maintainer before merge (ADR-0088 decision 7). Under ADR-0088 decision 4 the
maintainer is the single accountable person, and the agent's writing is disclosed throughput, not
independent review
**Method**: measured on 2026-11-05 on a fresh clone of `stranxik/runward` at `main@8ffdf7c` (0.46.0),
macOS, Node.js 24.22.1, npm 11.19.1, every install into an empty project with its own npm cache and an
empty user configuration: the tarball of `main` installed as it is; the same tarball with a runtime-only
`npm-shrinkwrap.json` (derived from `package-lock.json`, 28 entries, 15,058 bytes), installed from the
file and from a one-package local registry that serves it with `_hasShrinkwrap` set to `true`, then to
`false`, every other request redirected to registry.npmjs.org; the tarball packed with
`bundleDependencies`, installed from the file online, then offline with an empty cache and an unreachable
registry; `npm audit signatures` on the bundled and unbundled installs; on the committed change, the
guide's Step 10 replayed on a tarball packed from it (`cmp` equal) and that tarball installed from the
file, offline and from a local registry (27 of 27 each). Read: the v0.46.0 release assets
(`runward-sbom.cdx.json`), `.github/workflows/build-and-attest.yml`, `release.yml`, `verify-release.yml`,
`ci.yml`, the npm 11.19.1 and 12.2.2 sources (`@npmcli/arborist`, `npm-packlist`, `lib/utils/verify-signatures.js`)
and npm 12.2.2's `docs/content/configuring-npm/package-lock-json.md`, the registry's package documents of
`runward`, `sfdx-cli`, `@salesforce/cli` and `firebase-tools`, nodejs.org/dist/index.json and
github.com/nodejs/Release `schedule.json`, slsa.dev/spec/v1.2 (Build track basics and requirements), the
GitHub API (release and verify-release runs, the failed step's log of run 40684642168, the open
code-scanning alerts, all read with GET), and cmark-gfm's table scanner (`extensions/ext_scanners.re`,
`extensions/table.c`)
**Relates to**: ADR-0031 (the supply-chain evidence a regulated buyer reads),
[ADR-0048](ADR-0048-the-release-carries-verifiable-proof.md),
[ADR-0049](ADR-0049-the-build-is-isolated-from-the-publish.md) (the isolated builder, refined here),
[ADR-0062](ADR-0062-the-sarif-schema-is-validated-against-the-official-one.md) (an emitted document is
validated against the official schema),
[ADR-0085](ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md),
[ADR-0094](ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)
(runward-forge),
[ADR-0110](ADR-0110-the-app-may-change-and-dispatch-workflows-so-no-agent-acts-under-the-maintainers-identity-dispatch-is-a-closed-list-and-every-workflow-change-still-waits.md),
[ADR-0112](ADR-0112-runwards-committed-junit-report-has-one-reference-environment-macos-and-the-nodejs-of-nvmrc.md)
(the reference environment, refined by decision 9)

## Context

**What a user ran was not what the release tested.** The tarball declared three dependencies by range and
carried no lock. Installed into an empty project, the 0.46.0 tarball resolved 16 of its 27 runtime
packages to other versions than the tag's `package-lock.json` (every `@inquirer/*` package, by a patch
release each); the suite, the self-gate and the SBOM had all used the lock's versions. For a tool whose
promise is the same verdict on the same tree, the code that runs at an adopter's was neither the tested
code nor the code the SBOM listed.

**What a shrinkwrap would and would not have fixed.** A runtime-only `npm-shrinkwrap.json` in the same
tarball changed nothing for an install from the file: 11 of 27 again. npm reads a dependency's shrinkwrap
only when the registry's metadata marks the version `_hasShrinkwrap: true` (`node.hasShrinkwrap` in
`@npmcli/arborist`), which an install from a file never has. Served by a local registry with the flag
`true`, the same tarball installed 27 of 27; with the flag `false`, 11 of 27. npmjs.org sets the flag
from the tarball (it is `true` on `sfdx-cli` 7.209.6 and on every `@salesforce/cli` version published
with npm 10 and 11, `false` on runward 0.46.0, and the npm 11 client writes no such field: an inference,
since the registry's code is not public). And npm 12 (12.0.0 published on 2026-07-08, 12.2.2 the
registry's `latest` today) reads no shrinkwrap at all: "As of npm v12, `npm-shrinkwrap.json` is no
longer read or written by npm. [...] When npm v12 encounters a dependency that ships an `npm-shrinkwrap.json` inside its tarball, the file is
ignored — publishers who need to ship a locked tree should use `bundleDependencies` instead." Every LTS
line of Node.js bundles npm 10 or 11 today (22.23.4: 10.9.9; 24.22.2: 11.19.1; 26.13.0: 11.20.0), and
27.0.0-alpha bundles npm 12.1.0. A shrinkwrap would have held for registry installs under npm 7 to 11,
and for nothing else: not for the offline install of a verified release asset that a regulated user
makes, and not past the next Node.js line.

**What bundling does.** With `bundleDependencies` naming the three direct dependencies, `npm pack`
carries their closure from the installed tree: 27 packages, 280 files, at the lock's versions. The
tarball installed from the file gave 27 of 27 ("added 1 package"); offline, with an empty cache and no
reachable registry, 27 of 27. Two packs on one machine are byte-identical. The tarball grows from 687,522
to 1,077,435 bytes; a fresh install today downloads 1,108,007 bytes in 28 tarballs (runward and the 27 at
the lock's versions), and afterwards one tarball of 1,077,435 bytes. `npm audit` still audits the bundled
packages (`shouldAudit` in arborist's `audit-report.js` excludes none), and `npm audit signatures` counts
the same 27 verified registry signatures and 19 attestations on the bundled install as on the unbundled
one.

**The SBOM was a scan of the checkout.** The v0.46.0 asset is CycloneDX 1.7 written by Syft 1.54.0 over
the repository: `metadata.component` is `{"type": "file", "name": "."}`, with no name or version of the
product; 117 components, of which 24 are files and 26 libraries outside the runtime tree (the actions of
the workflows, workflows inside development `node_modules`, `floor-ts`, the example); 34 carry a licence;
the versions are the lock's, which an install did not reproduce. It met the letter of "an SBOM is
attached" and would mislead a third-party risk tool reading it as the package's.

**The job that signs ran the build.** In `build-and-attest.yml` the job holding `id-token: write`, the
credential the provenance is signed with, also ran `npm ci` with install scripts enabled, `npm test`
(every test file and every development dependency they load) and `npm pack`. SLSA's Build track asks the
opposite: "Such secret material MUST NOT be accessible to the environment running the user-defined build
steps." (slsa.dev/spec/v1.2/build-requirements, "Provenance is Unforgeable", read 2026-11-05.) The same
was true in `release.yml`, where the job that signs the SBOM attestation ran `npm ci`, `npm test` and the
qualification kit against the installed tarball. runward asserts no SLSA level, and this record claims
none (`test/unit/no-overclaim.test.js`): it closes the gap between the property and the chain.

**The release chain had been red at every release since 0.44.0.** The publish job of 0.44.0, 0.44.1, 0.45.0
and 0.46.0 failed on its last step, `npm error 404 Not Found - PUT https://registry.npmjs.org/runward-forge`:
the package does not exist on npm, the one-time bootstrap of `runward/runbook.md` §3.1 being undone.
`verify-release.yml` runs only after a successful publish run, so it last verified a release on
2026-10-11 (0.43.1) and was skipped at each of the four. A version query cannot tell the two cases this
needs apart: `npm view runward-forge` and `npm view chalk@99.0.0` both exit 1 with E404; the registry's
package document can (404 for a package that does not exist, 200 for one that does).

**Three smaller gaps of the same review.** Node.js 26 has been the active LTS line since 2026-10-28
(github.com/nodejs/Release) and the unit tests ran on 22 and 24 only. OpenSSF Scorecard's
Pinned-Dependencies read `pip install compliance-trestle==4.2.0` (ci.yml) as unpinned: the package is
pinned, its 38 dependencies resolve afresh at every run. Eleven CodeQL alerts of severity high had been
open since 2026-09-29, none triaged.

## Options considered

- **Dependencies. A**: a runtime-only `npm-shrinkwrap.json`, derived from the lock at pack time.
  **B**: `bundleDependencies`. **C**: both. **D**: none; tell users to commit their own lock.
- **SBOM. a**: Syft over the extracted tarball instead of the checkout. **b**: `npm sbom` over an
  installation of the tarball. **c**: a deterministic generator over the tarball and the tag's lock,
  validated against the official CycloneDX schema.
- **Signing. i**: one job builds, tests and packs without privilege; another, holding the signing
  credential, checks the digests of what it received and signs, and runs nothing else. **ii**: an
  external generator (a second builder identity). **iii**: keep the single job and say so.
- **runward-forge. 1**: let the publish step warn and succeed when the package does not exist on npm.
  **2**: run `verify-release.yml` after a failed publish too. **3**: drop runward-forge from the release
  until the bootstrap.

## Decision

**B, c, i and 1** (decisions 1 to 4), and decisions 5 to 9.

1. **The tarball bundles its runtime dependencies.** `package.json` declares `bundleDependencies`, the
   names of `dependencies`, and `npm pack` carries their closure from the tree `npm ci` installed from
   the lock. `test/unit/package-sbom.test.js` packs the tree and refuses a tarball whose bundle is not
   the lock's runtime closure at the lock's versions, so a Dependabot pull request that breaks it is red.
2. **The release SBOM is the package's.** `scripts/package-sbom.mjs` reads the tarball and the tag's
   `package-lock.json` and writes CycloneDX 1.6: `metadata.component` is the application
   `runward@X.Y.Z` with its purl, its licence and the SHA-256 and SHA-512 of the tarball; each bundled
   package is a component with its version, purl, declared licence, the SHA-512 of the registry
   tarball the lock names, its path and the property `cdx:npm:package:bundled`; the dependency graph is
   resolved inside the bundle. It refuses (exit 1) a bundle that differs from the lock in any package,
   path, version or declared licence, or that cannot satisfy a dependency, and writes nothing then. The output is deterministic: the serial number is a UUID
   derived from the tarball's digest and the timestamp is the commit's. It uses Node.js built-ins only
   and no third-party action. The release's `sbom` job, which holds `contents: read`, runs it on the
   builder's tarball; the cross-check job derives it again from its own checkout and refuses a
   difference; `verify-release.yml` derives it a third time from the tag after publication (guide,
   Step 10). The asset keeps its name, `runward-sbom.cdx.json`, and its attestation (`actions/attest`,
   subject the tarball, predicate CycloneDX). The Syft job of `ci.yml` stays, as what it is: a scan of
   the repository that shows drift, not the release's SBOM. The CycloneDX 1.6.1 schemas are vendored
   under `test/fixtures/` and the unit test validates against them (ADR-0062's practice); the document
   this tree produces also passes cyclonedx-python-lib 11.5.0's strict validator.
3. **No job that signs runs the build.** `build-and-attest.yml` has two jobs. `build` holds
   `contents: read` only and runs `npm ci --ignore-scripts`, `npm test`, both packs, the qualification
   kit and the digests of the three files. `attest` holds `id-token: write` and `attestations: write`,
   checks out nothing and runs no npm: it downloads the three files, refuses any whose SHA-256 differs
   from the digest the build job declared or whose name is not the expected one, signs the three
   provenances and hands them on under the artifact name the caller already reads. `release.yml` does
   the same for the SBOM attestation: the job that tests, runs the three byte-for-byte cross-checks
   (unchanged), runs the kit and derives the SBOM again is `verify`, with `contents: read`; `attest`
   only checks the tarball's and the SBOM's digests against the jobs that produced them and signs. The
   `draft` job checks the same two digests before it uploads anything. A unit test holds the rule for
   every job of `release.yml` and `build-and-attest.yml` that holds `id-token: write`: no checkout, no
   `npm ci`, `install`, `test`, `run`, `pack`, `exec` or `npx`, no `node` of a file of the tree, and no
   cache restored anywhere in the two files (a cache is the channel through which one run reaches
   another). The signing identity is unchanged: the certificate still names `build-and-attest.yml` (or
   `release.yml` for the SBOM) at the tag, so no verification command changes.
4. **A release whose runward-forge is not on npm stays green and says so.** Before it publishes
   runward-forge, the publish job asks the registry for the package document. 404: the package has never
   been published, so npm cannot trust this workflow for it yet; the step writes a warning annotation and
   a job-summary section naming runbook §3.1, and ends with exit 0, runward being already published and
   the runward-forge tarball verified on the release. 200: unchanged, so a failed publish of a package
   that exists stays red. Any other answer: exit 1. `verify-release.yml` then runs after the release, as
   it did until 2026-10-11.
5. **Node.js 26 joins the unit test matrix** (22, 24, 26). Which checks are required stays the
   maintainer's setting; the pull request names the one to add.
6. **The OSCAL ingestion installs a hash-pinned closure.** `test/oscal-ingest.requirements.in` names
   `compliance-trestle==4.2.0`; `test/oscal-ingest.requirements.txt` is its closure for CPython 3.12 on
   x86_64 Linux with every file's hash, generated by `uv pip compile` (the command is its header); CI
   installs it with `pip install --require-hashes --only-binary=:all:`, so no package outside it, no
   other file and no source build can enter the job.
7. **CodeQL: the founded alerts are fixed, the others are argued, none is dismissed here.** Fixed: a
   hand-escaped `RegExp` in `test/unit/check-contract.test.js`, and the host test of `floor-ts`' provider
   profile (a substring of the whole URL, now the parsed host name). Argued in the pull request: the six
   ReDoS alerts in the tests of the ReDoS screen (the patterns are its inputs, compiled and never
   matched) and the one in `src/lib/evidence.ts` (the replaced string is one character long). The cells
   of `scripts/mutation-register.mjs` are not changed here: GitHub's renderer shows the five rows first
   read as broken exactly as written (`POST /markdown`, mode `gfm`, 2026-11-06), and the escaping tried
   at first rendered 33 notes and 5 code cells of the register wrong (backslashes doubled inside code
   spans, `\|` shown as `⧵|`). Dismissing an alert is the maintainer's act.
8. **The kit runs against the tarball installed offline, and its runner handles a bundle.** The release's
   kit run installs the tarball with `--offline` and an empty cache, so a bundle that needs the registry
   fails the release instead of reaching npm. Run on a kit built from the bundled tarball, the runner
   (`scripts/qualification-kit/run.mjs`) linked the installation's `node_modules/` into its work
   directory whole, wrote its dependency links through it into the installation, and stopped on EEXIST
   before any test. Linking each bundled package instead failed later: the cited
   `example-packed.test.js` packs the work directory, npm packs a linked bundled dependency under a path
   that leaves the package, and `tar` refused it. The runner now copies into its work directory exactly
   the bundled files the digest comparison matched, and links nothing for a bundled installation
   (`test/unit/qualification-kit.test.js`, failing on the runner before the fix).
9. **The reference JUnit report travels as an artifact** (refines ADR-0112 decision 5). The
   `lint-and-reports` job of `ci.yml`, which regenerates `reports/junit.xml` on macOS with the Node.js
   of `.nvmrc`, uploads the file it wrote as the artifact `junit-reference`, even when the job fails. A
   person or a delegate commits that file, which carries `<!-- generated: node vX.Y.Z darwin -->`,
   without running the suite on their own machine. The job stays red while the committed report
   differs: the artifact corrects the tree, it never replaces the check.

## Alternatives discarded

- **A, the shrinkwrap.** Measured above: honoured only for registry installs flagged by npmjs.org, under
  npm 7 to 11; ignored by any install from the file and by npm 12. **C** adds nothing to B: a bundled
  package is installed from the tarball, never resolved.
- **D.** It moves the lock to every user, and the tested tree still never reaches them.
- **a.** Closer, still a scan: a third-party action in the release path, a random serial number and a
  timestamp of the run, licences as its catalogers find them.
- **b.** CycloneDX 1.5, a random serial number and a timestamp, no component hash without a lockfile,
  and it needs an installation first.
- **ii.** A second builder identity every verification command would have to change to, while GitHub's
  own attestation actions already sign in a job runward chooses.
- **iii.** It leaves the signing credential within reach of every development dependency.
- **2.** A run after a failed publish verifies whatever reached npm, or fails a second time on the same
  cause; decision 4 makes the expected failure a warning and leaves the others red.
- **3.** The runward-forge tarball is already built, cross-checked and attested on every release; its
  absence from npm is a one-time gesture away (runbook §3.1).

## Consequences

- **The tarball is 57 % larger and a fresh install downloads about 3 % less**, in one file instead of
  28. Its unpacked size grows by 1.2 MB.
- **A user can no longer override a bundled package** (`overrides`) or deduplicate it with their own:
  a fix in a dependency reaches them through a runward release. Dependabot keeps opening those updates
  on runward's lock with its 7-day cooldown, security updates without it, and edits only `package.json`
  and the lock, which `bundleDependencies` changes neither (Dependabot itself was not run). What such a
  pull request does to the bundle was measured by doing its edit by hand (`npm install
  @inquirer/prompts@8.7.5 --package-lock-only`, then `npm ci`, `npm pack`): the bundle followed the lock
  (27 packages, `@inquirer/prompts` 8.7.5), and the same tarball checked against the lock before the edit
  was refused, 16 differences, no SBOM written.
- **The qualification kit lists 280 more files** and compares each of them on the user's installation;
  an extra file under `node_modules/` is still not reported, as before.
- **The release SBOM changes nature**: a reader comparing it with an earlier release's sees a named
  product and its runtime tree, not a scan. The 0.46.0 and earlier assets stay as they were.
- **The release run gains two jobs** (the signing jobs); no verification command changes.
- **`verify-release.yml` runs after every release again**, and gains Step 10.
- **CI gains one Node.js 26 leg**, not required until the maintainer makes it so.
- **`test/oscal-ingest.requirements.txt` is regenerated when trestle moves**, by its header's command;
  GitHub's dependency graph now reads it, so an advisory on one of its 39 packages surfaces as an alert.

### What this does not catch

- **A build job that alters what it builds.** The build job still runs every development dependency; one
  that changes the tarball before it is hashed gets it signed as what this run built. The byte-for-byte
  cross-check of a second job and the reproducible rebuild stay the controls, and both run the same
  dependencies: a change that reproduces itself in both packs passes both. Only a rebuild outside the
  chain, from a lock someone has read, sees it.
- **Isolation between runs on GitHub-hosted runners** is GitHub's; the chain's part is to restore no cache.
- **Node.js, npm and the operating system** are not in the bundle.
- **The bundled bytes against the registry's.** The SBOM hashes the registry tarballs the lock names;
  `npm ci` verified the installed files against those hashes in the build job, and the bundle is packed
  from what it installed. The SBOM does not re-hash the extracted files.
- **runward-forge itself**: the warning does not publish it; the bootstrap stays the maintainer's.

## What would settle it

- **For decisions 1 and 2**: on the first release that carries them, `npm install runward@X.Y.Z` into an
  empty project installs the 27 packages at the versions of the tag's lock, the guide's Step 10
  re-derives the SBOM byte for byte, and a third-party CycloneDX reader (Dependency-Track, `cyclonedx
  validate`) accepts it. **Against**: an installation where a bundled package fails where the resolved
  one worked, or a reader that refuses the SBOM.
- **For decision 3**: the first release's Steps 2, 2c and 3 pass unchanged, the certificate still names
  `build-and-attest.yml` at the tag, and the publish job's provenance checks pass. **Against**: a
  verification that needs to change to accept the new jobs.
- **For decision 4**: while runward-forge is absent from npm, the publish run ends green with the warning
  and `verify-release.yml` runs. **Against**: a publish run that ends green while `runward` is not on npm,
  or one that is red for the absence of runward-forge.

## Reevaluation trigger (mandatory, dated)

Reopen at the first release that carries this change (measure the install, the SBOM and the run against
"What would settle it"), when npm changes how it installs bundled dependencies, when the CycloneDX
readers of the ecosystem accept 1.7 widely, when runward-forge is bootstrapped on npm (decision 4's
branch then goes quiet), or on 2027-02-05, whichever comes first.

**Trigger set on**: 2026-11-05 · **Watched via**: `verify-release.yml` (Step 10 and its conclusion), the
publish job's summary, `test/unit/package-sbom.test.js` and `test/unit/release-signing-isolation.test.js`.

## References

- `package.json` (`bundleDependencies`), `scripts/package-sbom.mjs`, `scripts/tgz.mjs`,
  `scripts/qualification-kit/run.mjs` (`buildWorkDir`),
  `test/unit/package-sbom.test.js`, `test/unit/release-signing-isolation.test.js`,
  `test/fixtures/cyclonedx_bom_schema.v1.6.1.json`, `cyclonedx_spdx_schema.v1.6.1.json`,
  `cyclonedx_jsf_schema.v1.6.1.json`, `test/oscal-ingest.requirements.in` and `.txt`.
- `.github/workflows/build-and-attest.yml`, `release.yml`, `verify-release.yml`, `ci.yml`.
- `docs/verifying-a-release.md` (Steps 9 and 10), `runward/runbook.md` (§3 and §3.1).
- npm 12.2.2, `docs/content/configuring-npm/package-lock-json.md`; slsa.dev/spec/v1.2/build-requirements;
  github.com/nodejs/Release `schedule.json`; CycloneDX specification 1.6.1; cmark-gfm
  `extensions/ext_scanners.re`.
- ADR-0031, ADR-0048, ADR-0049, ADR-0062, ADR-0085, ADR-0088 decisions 4 and 7, ADR-0094, ADR-0110, ADR-0112.
