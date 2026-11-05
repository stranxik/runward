# runward-forge

The forge adapters of runward, behind one port
([ADR-0094](https://github.com/stranxik/runward/blob/main/docs/adr/ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)).
A second package of the runward repository, so that the `runward` package keeps zero network code:
`runward` imports nothing from this package, and this package imports nothing from `runward`, it reads
the files `runward` writes. `test/unit/runtime-boundary.test.js`, in the repository, checks both directions,
with planted controls.

Node.js 22.12 or later, no dependency: the platform's `fetch` only, no spawned process.

## Install and verify

`runward-forge` is released with `runward`, at the same version, from the same tag and through the same
release chain: the isolated builder packs and attests it, and the release holds it as an asset
(`runward-forge-X.Y.Z.tgz`, from v0.44.0). The release workflow is meant to publish that file to npm,
with provenance, never from a maintainer's machine. **It has not yet.** On 2026-11-05 `npm view
runward-forge` answers E404: the step that publishes it failed on v0.44.0, v0.44.1, v0.45.0 and
v0.46.0, each time with `npm error 404 Not Found - PUT https://registry.npmjs.org/runward-forge`. npm
attaches a trusted publisher only to a package that already exists, and the one-time placeholder that
would create it (`runward/runbook.md` §3.1 in the repository) has not been published, so there is no
placeholder on npm either. Until a version is there, install the release asset of the version of
`runward` you run, after verifying it as for `runward`
([docs/verifying-a-release.md](https://github.com/stranxik/runward/blob/main/docs/verifying-a-release.md), Step 9):

```sh
gh release download vX.Y.Z --repo stranxik/runward --pattern runward-forge-X.Y.Z.tgz
gh attestation verify runward-forge-X.Y.Z.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml \
  --source-ref refs/tags/vX.Y.Z \
  --deny-self-hosted-runners
npm install --save-dev ./runward-forge-X.Y.Z.tgz
```

Once npm holds the version, `npm install --save-dev runward-forge@X.Y.Z` installs the same file, and
two digests show it:

```sh
curl -fsSL https://registry.npmjs.org/runward-forge/-/runward-forge-X.Y.Z.tgz | shasum -a 256
shasum -a 256 runward-forge-X.Y.Z.tgz   # equal when npm serves the released file
```

## The port

| Function | GitHub | GitLab | On failure |
|---|---|---|---|
| `postSummary(markdown, ctx)` | appends to the job summary (`GITHUB_STEP_SUMMARY`), no network | one merge request note, found by its marker, updated in place, else created (`RUNWARD_FORGE_TOKEN`, a project access token) | `summary not posted: <reason>`, exit 0: a 5xx or a timeout is retried once |
| `identifyChange(message)` | `Merge pull request #N from …` | `See merge request group/project!N` | `null` |
| `renderPath(path, ctx)` | `…/blob/<ref>/<path>` | `…/-/blob/<ref>/<path>` | `null` when a part is missing |
| `readChangeFacts(change)` | refused: ships in D5 | refused: ships in D5 | a named refusal, `ok: false` |
| `setExternalStatus(verdict, ref)` | refused: no customer policy | refused: no customer policy | a named refusal, `ok: false` |

The summary is a convenience, so a failure to post it never fails the job; facts and statuses are
evidence or claims, so they fail closed. No adapter turns a forge error into a green.

```sh
runward-forge post-summary summary.md            # the forge is read from GITLAB_CI / GITHUB_ACTIONS
runward-forge post-summary summary.md --forge gitlab
```

The GitLab poster is tested against loopback stubs (`test/unit/forge-adapters.test.js`), one of them
the offline bench's (`test/support/gitlab-stub.js`), not yet against recorded GitLab responses: the
bench has run against GitLab CE 19.4.2 every week since 2026-10-13, and its fixtures are still
documentation examples, because no run has recorded them yet.
