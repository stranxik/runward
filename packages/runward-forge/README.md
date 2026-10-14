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
release chain: the isolated builder packs and attests it, the release holds it as an asset
(`runward-forge-X.Y.Z.tgz`), and npm receives that file, published with provenance by the release
workflow, never from a maintainer's machine. Install the version of `runward` you run:

```sh
npm install --save-dev runward-forge@X.Y.Z
```

Verify the file before you trust it, as for `runward`
([docs/verifying-a-release.md](https://github.com/stranxik/runward/blob/main/docs/verifying-a-release.md), Step 9):

```sh
gh release download vX.Y.Z --repo stranxik/runward --pattern runward-forge-X.Y.Z.tgz
gh attestation verify runward-forge-X.Y.Z.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml
curl -fsSL https://registry.npmjs.org/runward-forge/-/runward-forge-X.Y.Z.tgz | shasum -a 256
shasum -a 256 runward-forge-X.Y.Z.tgz   # the two digests are equal: npm serves the released file
```

The only other version on npm is `0.0.0-bootstrap.0`, a deprecated placeholder that reserved the name
and contains no code.

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
bench's fixtures are documentation examples until it has run against GitLab CE.
