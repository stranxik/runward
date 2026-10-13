# The GitLab bench

runward's GitLab support (the component, the merge request note, the Code Quality and JUnit reports,
the approval reads) needs a GitLab to be tested against. The maintainer's machine cannot run one, and
the unit tests must not touch the network. The bench is how runward gets a GitLab anyway, in two
layers. It is item G12 of the GitLab gap analysis, delivered in D0 of the observability plan, before
any GitLab code it is meant to test.

## Status

| | State on 2026-10-13 |
|---|---|
| Layer 1: fixtures and stub | in the tree; the 7 fixtures are **GitLab documentation examples**, not recordings (`"source": "docs-example"`) |
| Layer 2: GitLab CE in CI | written, linted, **never run**: GitHub dispatches a workflow only once its file is on the default branch, so the first run, its duration and its recorded fixtures come after the merge |
| GitLab version | the bench pins GitLab CE 19.4.2 (`gitlab/gitlab-ce:19.4.2-ce.0`) and GitLab Runner 19.4.1 by digest in [`test/gitlab-bench/images.env`](../test/gitlab-bench/images.env); no fixture is from that version yet |

What is not measured yet is said as such below. Nothing in this page says GitLab CE boots on a
GitHub-hosted runner with its network cut: that is what the first run is for.

## Layer 1: recorded responses and a loopback stub

- [`test/fixtures/gitlab/`](../test/fixtures/gitlab/): one JSON file per API response. Each one
  names its endpoint (`"endpoint": "GET /projects/:id/merge_requests/:merge_request_iid/approvals"`),
  its date (`recorded_at`) and its source:
  - `"source": "recorded"`: recorded by the bench from the GitLab CE instance it booted, with the
    GitLab version, revision and image digest, and the workflow run that recorded it;
  - `"source": "docs-example"`: copied from the response example of the GitLab API documentation, at
    one pinned commit of `gitlab-org/gitlab`, by
    [`test/gitlab-bench/docs-fixtures.py`](../test/gitlab-bench/docs-fixtures.py). Its GitLab version
    is `null`, because the documentation does not give one; neither does it give the HTTP status,
    which is the REST default (200 for a read, 201 for a create) and flagged `status_from_docs: false`.
    The documentation says some of these examples are Enterprise responses: on Community Edition,
    `GET .../approvals` returns only `approved`, `approved_by`, `user_can_approve` and
    `user_has_approved`. A recording is what will show what CE 19.4.2 actually returns.
- [`test/support/gitlab-stub.js`](../test/support/gitlab-stub.js): an HTTP server for the unit
  tests. It binds `127.0.0.1` on a port the system picks (the host is not a parameter), requires a
  `PRIVATE-TOKEN` header, replays a fixture when the method and path match one, and answers
  `404 {"message":"404 Not Found"}` otherwise. It also models merge request notes (create, list,
  update) with the shape of the `mr-note-get` fixture, which is what D1's summary note needs: find the
  one note carrying the marker, update it in place, or create it. The shape comes from the fixture;
  the behaviour is the stub's own, and the test that uses it says so.
- [`test/unit/gitlab-bench.test.js`](../test/unit/gitlab-bench.test.js): every fixture says where it
  came from, its path is an instance of its endpoint, no credential is committed (every `token` field
  is `[redacted]`, no GitLab token prefix appears), the loader refuses a fixture with no provenance,
  the stub binds loopback only and replays every fixture, and the D1 note flow creates once and then
  updates in place. It also guards layer 2 (below), which it cannot run.

### What layer 1 proves, and what it does not

It proves that code written against these responses parses them, and that a test of the note flow
needs neither GitLab nor the network. It does not prove that a real GitLab answers this way: for a
docs example, nothing has been measured; for a recorded fixture, only the version it was recorded
from has.

## Layer 2: GitLab CE in GitHub Actions, network cut

[`.github/workflows/gitlab-bench.yml`](../.github/workflows/gitlab-bench.yml) runs
[`test/gitlab-bench/bench.sh`](../test/gitlab-bench/bench.sh) on a GitHub-hosted `ubuntu-latest`
runner, on demand (`workflow_dispatch`) and on Wednesdays at 04:41 UTC, never on a push or a pull
request (GitLab CE takes minutes to boot). The job has a 75-minute limit, a read-only token and no
secret. Steps:

1. **Online phase.** Pull the four images by digest (GitLab CE, GitLab Runner, the runner helper,
   `node:22`). `npm pack` runward from the checked-out tree. Install that tarball once with a fresh
   npm cache, and pack the cache. Build the fixture repository from the example mission shipped in
   the tarball, twice: `green/` as shipped, `red/` with `runward/handover.md` removed.
2. **The cut.** `docker network create --internal rwbench`. Every bench container is attached to that
   network and to no other: the package server, GitLab, the runner, and the job and helper containers
   the runner starts (`--docker-network-mode rwbench`). The runner never pulls an image
   (`--docker-pull-policy never`): every image was pulled in step 1.
3. **The cut, measured.** A positive control first: the same probe (a Node `fetch` of
   `https://registry.npmjs.org/`) from the same image on Docker's default bridge must succeed, or the
   bench stops, because a probe that cannot see the registry from anywhere proves nothing. Then, from
   a container on the internal network: the registry must be unreachable, and the bench also records
   whether the name resolves and whether the container has a default route. The same probe runs from
   the GitLab container once it is up and again at the end, and from inside each CI job.
4. **GitLab CE boots on the internal network** (Puma in single mode, Sidekiq at 5, monitoring, KAS
   and the container registry off). The bench waits for `/-/readiness?all=1`, up to 30 minutes.
5. A root API token from the Rails runner, masked in the log and redacted from the fixtures; a
   project and an instance runner by the API (`POST /projects`, `POST /user/runners`); the runner
   registered with the docker executor; the fixture repository pushed from inside the network.
6. **The pipeline** ([`test/gitlab-bench/gitlab-ci.yml`](../test/gitlab-bench/gitlab-ci.yml)): each
   job downloads runward's tarball and the npm cache from the package server, installs with
   `npm install --offline`, and runs `runward check --strict`. `gate-green` requires exit 0,
   `gate-red` requires exit 1. Each job prints the code it saw, and the bench reads it back from the
   job log through the API: a job that passed for another reason fails the bench.
7. **Recording.** A merge request is opened and a marked summary note created, read and updated; the
   merge request's versions, commits, approvals, approval state, approval by its author and pipelines
   are read; the pipeline and its jobs and logs too. Each response is written as a fixture.
8. The job summary gives the time of every phase since the start and every finding (version,
   egress per container, exit codes), and compares the recorded fixtures with the committed ones
   (status and key paths; values are expected to differ).

### What is cut, and what is not

| | Cut? |
|---|---|
| GitLab, the runner, the package server, every CI job container | yes, by the internal network: measured by the probes in steps 3 and 6, against the positive control |
| The GitHub-hosted VM and its Docker daemon | **no**: the VM needs the network to report to GitHub and upload artifacts. The runner drives the host's Docker daemon through its socket; that daemon could pull, and it is the pull policy `never`, not the network, that keeps it from doing so |
| `iptables` rules of its own | none: the bench relies on Docker's `--internal` (which Docker implements with its own `iptables` rules) and measures the result instead of adding rules |

### What layer 2 proves, and what it does not

When it passes, it proves that on GitLab CE 19.4.2 with GitLab Runner 19.4.1, a pipeline with no
registry and no internet installs runward from a tarball and that `runward check --strict` exits 0 on
a green mission and 1 on a red one, through GitLab CI. It does not prove anything about gitlab.com
(the analysis's other half of G12, a test project on gitlab.com, is not built), about GitLab Premium
or Ultimate (CE has no approval rules, no external controls), about another GitLab version, or about
an air-gapped installation's own constraints (proxies, internal CAs, a mirrored registry). It does
not install runward through a GitLab CI/CD component or `include: remote` with `integrity`: those
are D1 (G1), which the bench will then exercise.

## How to run it

```sh
gh workflow run gitlab-bench.yml --ref <branch>                          # the bench
gh workflow run gitlab-bench.yml --ref <branch> -f update_fixtures=true  # and upload the fixtures
gh run watch                                                             # then read the job summary
```

### Updating the fixtures

Run with `update_fixtures=true`; the run uploads an artifact named `gitlab-fixtures` in the layout of
`test/fixtures/gitlab/`. Then, on a branch:

```sh
gh run download <run-id> -n gitlab-fixtures -D test/fixtures/gitlab
node --test test/unit/gitlab-bench.test.js
git diff --stat test/fixtures/gitlab
```

Read the diff before committing it: a recorded fixture replaces the docs example of the same name,
and a fixture the bench records that has no docs example is new. The workflow never commits
anything itself.

### Bumping GitLab

Change the digest in `test/gitlab-bench/images.env` (the tag goes in the comment above it), run the
bench with `update_fixtures=true`, read the shape comparison in the summary, and commit the new
fixtures with the new version in the same pull request.

### By hand, on a machine with Docker and about 8 GB of free memory

`test/gitlab-bench/bench.sh <workdir>` runs the same bench locally (it needs `docker`, `jq`, `node`
and `npm`, and the network for its first phase). Clean up with
`docker rm -f gitlab runner pkgs; docker network rm rwbench`.

## If GitLab CE cannot boot there

If the first runs show that GitLab CE does not reach readiness within the limits of a GitHub-hosted
runner, the bench says so in its summary (the phase times, and the last 400 lines of each container log
are kept as an artifact), and this page will record the measurement. The fallback is then layer 1
plus the procedure above on a machine that can run it, with the version it was run on.
