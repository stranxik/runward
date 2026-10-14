# runward on GitLab

The gate does not know which forge reads its exit code: `runward check --strict` is the same command,
with the same verdict, on GitLab, GitHub or a laptop. What is per forge is the envelope around it: how
the job is installed, how it is made required, and where the summary is shown
([ADR-0094](adr/ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)).
This page covers the three for GitLab, on GitLab.com and on a self-managed instance.

**What these statements rest on.** The tier statements below were read in the GitLab documentation on
2026-10-13. They were not measured on a GitLab instance. The offline GitLab CE bench (ADR-0094 decision
7) is the measurement; until it has run, each statement is the documentation's, not runward's.

## 1. Install the gate

Two ways, the same job.

**A. The release asset, pinned by its content (GitLab 17.9 or later).** Each runward release from this
one on carries `runward-gitlab-gate-X.Y.Z.yml`: `templates/ci/gitlab/runward-gate.yml` with its
`version` input pinned to `X.Y.Z`, so the file pins both itself and the runward it runs.

```yaml
include:
  - remote: "https://github.com/stranxik/runward/releases/download/vX.Y.Z/runward-gitlab-gate-X.Y.Z.yml"
    integrity: "sha256-<base64>"
    inputs:
      path: "."          # the directory that holds runward/
```

With `integrity:`, GitLab fails the pipeline when the file it fetches is not the one you pinned. Compute
the value from the file you reviewed:

```sh
printf 'sha256-%s\n' "$(openssl dgst -sha256 -binary runward-gitlab-gate-X.Y.Z.yml | openssl base64 -A)"
```

The asset is reproducible from the tag: at `vX.Y.Z`, `node scripts/gitlab-template-asset.mjs --version
X.Y.Z --out .` writes the same bytes and prints the same value, so you can check the asset against the
source instead of trusting the release page. Not measured: whether a GitLab instance follows the
redirect GitHub answers for a release download; if yours does not, use B.

**B. A copy on your instance (any version, offline).** Copy the file into a project of your instance
that the developers whose merge requests it gates cannot push to, then:

```yaml
include:
  - project: "platform/ci-templates"
    ref: "<commit SHA>"            # a commit, not a branch: the pin
    file: "/runward-gitlab-gate-X.Y.Z.yml"
```

The job needs Node.js 22.12 or later in its image (the default is `node:22`, the job checks the floor)
and either access to an npm registry or a mirror that serves `runward`. It has no other dependency.

**Without the template.** `runward/adapters/gitlab-ci.yml`, which `runward init` writes into every
mission, is the same job to merge by hand into `.gitlab-ci.yml`, with `RUNWARD_VERSION` to pin.

**What the job does.** It refuses a Node below 22.12 and a version that is neither `x.y.z` nor
`latest`/`next` (exit 2), warns on every run when the version is not pinned, as the GitHub Action does,
runs `runward check --strict`, then deposits as artifacts, on a red gate too: `check.json`, the Code
Quality and JUnit renderings written by the same run (declared as `reports: codequality` and
`reports: junit`, section 1.1), the SARIF log, the unsigned attestation, the result of `runward verify`
on that attestation, and the HTML delivery report, linked from the merge request (`expose_as`). With the `spec` input it then runs
`runward spec-check` on those paths, and with `check: false` it runs only that, on a repository with
no mission, as the Action does. The job's exit code is the higher of the two (2 over 1 over 0); a
`verify` that does not re-derive the verdict the same job attested fails the job.

### 1.1 The gate's causes in the merge request, with no token (ADR-0096)

`runward check --strict --json --codequality <file> --junit <file>` computes the verdict once and writes
it three ways: the JSON document on stdout, and two files GitLab reads on every tier.

- **Code Quality** (`gl-code-quality-report.json`, the merge request's Code Quality widget): a JSON
  array, one issue per cause of the verdict, in the gate's order. `check_name` is the SARIF `ruleId` of
  the same cause; `description` is the cause's text, ending « (runward gate: presence, pointers,
  integrity; not a code-quality or security judgement) »; `severity` is `blocker` for a cause that makes
  the gate red and `info` for a deliverable deferred by `--through`, never derived from a rule's impact;
  `location.path` is repository-relative with `/` on every system, `location.lines.begin` the manifest
  row's line (1 for a whole-file fact or a missing file, as SARIF anchors it, ADR-0063). `fingerprint`
  is the SHA-256 (hex) of the canonical JSON encoding (keys sorted, no whitespace,
  [`spec/witness.md`](spec/witness.md) section 3, without its final line feed) of
  `{"check_name", "path", "rule"}`, `rule` being the rule slug or the file the cause is about; the
  second and later causes sharing all three add `"occurrence": n`. Never the line and never the index,
  so a moved row stays the same issue and the widget's new and resolved counts are right.
- **JUnit** (`runward-junit.xml`, the test panel): `<testsuites name="runward gate verdict">`; a first
  suite holding one case, `runward gate`, that fails exactly when the exit code is 1; then one suite per
  scope (a gated phase, or `corpus`, `evidence-seal`, `reconstruction`, `ratification`, `delegation`,
  `hooks`), one failing case per cause and one skipped case per deferred deliverable. No passing case is
  invented per green row, and every suite's name ends « (no test executed) »: the panel's count is the
  gate's causes, not tests runward ran. Every suite carries the properties `runward.rendering`
  (`runward/<version> payload-sha256:<digest>`, the digest of the `check --json` payload of the same run
  with its mission path replaced by the mission's name, as `--attest` does), `runward.strict`,
  `runward.through`, `runward.exit-code` and `runward.non-scope`.

Both are side outputs: stdout and the exit code are the same with or without them. A path inside
`runward/`, in a directory that does not exist, or at an existing file runward did not write is refused
before the gate runs (exit 2); a file that cannot be written is exit 2, the question could not be
asked, and never a change of verdict. Both work without `--strict`; the JUnit's `runward.strict` says
which was run.

**A JUnit file runward wrote is never evidence.** A row that cites it (`test:` or `file:` pointer, or a
bare path) is refused with « a JUnit report runward itself wrote … a previous verdict is not evidence
for this one », recognised by the `runward.rendering` property wherever the file was copied, and it
never satisfies a rule's `requires: junit`. Cite the report your test runner wrote.

**SARIF is not declared as a security report.** The template keeps `check.sarif` as a plain artifact
and does not declare `artifacts:reports:sarif`. GitLab reads that report only on Ultimate, from 19.2,
only when the job succeeds, and files each result in the vulnerability report with a vulnerability's
lifecycle (triage, dismissal, dashboard counts, security approval policies). A runward gap is a missing
deliverable, an unresolved pointer or an unratified decision; the gate judges presence, pointers and
integrity, never code quality or security. An adopter who wants the SARIF there writes that line in
their own pipeline, as their own mapping.

## 2. Make the gate required, per tier

A gate nobody is forced to pass is advice. What GitLab lets you force depends on the tier, and runward
says it as it is: it ships the same job on every tier, it cannot add a control the tier does not have.

| | Free | Premium | Ultimate |
|---|---|---|---|
| The merge waits for the pipeline | yes: Settings > Merge requests > **Pipelines must succeed** | yes | yes |
| The gate job cannot be removed by the merge request that it gates | **not by default**: the job lives in `.gitlab-ci.yml`, which the merge request can edit. Hosting the CI configuration in another project (Settings > CI/CD > CI/CD configuration file, `.gitlab-ci.yml@group/project`) with restricted write access is the way; the page read names no tier for it, to verify on yours | the same, plus **CODEOWNERS** approval on `.gitlab-ci.yml` and `runward/` on the protected branch | a **pipeline execution policy** injects the job into every project of the group; a project cannot drop it |
| An approval is required before merge | **no**: approvals are optional and do not block a merge | yes: approval rules, author and committers prevented from approving, approvals reset on push | yes |
| Approval independence (ADR-0080 part 2, not shipped yet) | **detected after merge, not prevented**: no pipeline starts on an approval, so a check can only read the approvals of a merged change | the forge prevents, runward records | the forge prevents, runward records |
| The gate's findings in the merge request, with no token | the Code Quality widget and the test panel (section 1.1), and the reports linked from the merge request | the same, plus the Code Quality pipeline report | the same, plus Code Quality annotations in the diff; SARIF is not declared, as GitLab would file runward's gaps as vulnerabilities, which they are not (ADR-0096) |
| A summary note on the merge request | self-managed: yes, with a project access token; GitLab.com: no project access token on Free, and runward does not recommend a person's token | yes | yes |

**What Free cannot enforce, plainly.** On GitLab Free the gate blocks a merge only through *Pipelines
must succeed*, and only as long as the job is in the pipeline: a merge request that edits
`.gitlab-ci.yml` can remove it, unless the configuration lives in a project its author cannot write.
No approval is required, so no one is forced to read the gate's verdict before a merge, and the
independence of the person who approved from the person (or agent) who made the change can only be
checked after the merge. runward does not turn any of this into a control. It says it.

## 3. The summary on the merge request

The summary poster lives in a second package of this repository, `packages/runward-forge`, so the
`runward` package keeps zero network code (ADR-0094, question 1; a test checks it). It posts one note
per merge request, found again by its marker and updated in place, with the token you give it in
`RUNWARD_FORGE_TOKEN` (a project access token with the `api` scope; the CI job token only reads notes).
Without a token, or on any API error, it prints `summary not posted: <reason>` and exits 0: the summary
stays an artifact, the job is not failed, and nothing reads a missing summary as a green.

**Not shipped yet**: `runward-forge` is not published to npm, and the neutral `report --format md`
that renders the summary lands in a later part of this delivery (ADR-0093, D1). Until both exist, the
template deposits the reports and posts nothing.

## 4. Azure DevOps and Bitbucket

`runward/adapters/azure-pipelines.yml` and `runward/adapters/bitbucket-pipelines.yml` are minimal
samples: the pinned `check --strict`, its `--json` and the HTML report as artifacts. Make the first a
Build validation policy on the protected branch, the second a required build in the branch
restrictions (which Bitbucket plans offer that merge check was not verified). Their summary posters
and approval readers come later, under the same port.
