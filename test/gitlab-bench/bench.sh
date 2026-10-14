#!/usr/bin/env bash
# The GitLab bench, layer 2 (docs/gitlab-bench.md): a GitLab CE instance and a GitLab Runner booted
# on a Docker network with no route out, a fixture repository pushed to it, runward installed from
# its packed tarball without any registry, `runward check --strict` run by GitLab CI with its exit
# code checked both ways, and the GitLab API responses recorded as fixtures for layer 1.
#
# Usage: test/gitlab-bench/bench.sh <workdir>
# Needs: docker, jq, node and npm, and the network for the first phase only (image pulls, npm cache).
# Written for the GitHub-hosted runner of .github/workflows/gitlab-bench.yml; it needs about 6 GB of
# free memory, which is why it is not run on a maintainer's laptop.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
# shellcheck source=test/gitlab-bench/images.env
source "$HERE/images.env"

WORK="${1:?usage: bench.sh <workdir>}"
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
PKGS="$WORK/pkgs"; FIX="$WORK/fixtures"; LOGS="$WORK/logs"; REPO="$WORK/repo"
mkdir -p "$PKGS" "$FIX" "$LOGS"
NET=rwbench
RUN_URL="${GITHUB_SERVER_URL:-local}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-0}"
T0=$(date +%s)

elapsed() { echo $(( $(date +%s) - T0 )); }
mark() { # mark <phase>: one line per phase in timings.tsv, and a notice in the log
  printf '%s\t%s\n' "$1" "$(elapsed)" >> "$WORK/timings.tsv"
  echo "::notice::[$(elapsed)s] $1"
}
fail() { echo "::error::$*"; exit 1; }
finding() { printf '%s\t%s\n' "$1" "$2" >> "$WORK/findings.tsv"; echo "finding: $1 = $2"; }

# --- Phase 1, online: everything the offline phase needs is fetched here and nowhere else. -----
for img in "$GITLAB_IMAGE" "$RUNNER_IMAGE" "$HELPER_IMAGE" "$NODE_IMAGE"; do
  docker pull -q "$img" >/dev/null
done
mark images-pulled

( cd "$ROOT" && npm pack --silent --pack-destination "$PKGS" >/dev/null )
mv "$PKGS"/runward-*.tgz "$PKGS/runward.tgz"
# Warm an npm cache with runward's runtime dependencies, then ship the cache as a tarball: the job
# installs with `npm install --offline` against it, so no registry is ever asked for anything.
mkdir -p "$WORK/warm" "$WORK/npm-cache"
( cd "$WORK/warm" && npm install --silent --no-audit --no-fund --omit=dev --cache "$WORK/npm-cache" "$PKGS/runward.tgz" )
tar -czf "$PKGS/npm-cache.tgz" -C "$WORK/npm-cache" .
cp "$HERE/serve.mjs" "$PKGS/serve.mjs"
mark packages-ready

# The fixture repository: the example mission shipped in the tarball, twice. green/ is as shipped
# (the gate must exit 0); red/ lost one deliverable (the gate must exit 1).
mkdir -p "$WORK/unpack" "$REPO"
tar -xzf "$PKGS/runward.tgz" -C "$WORK/unpack"
cp -R "$WORK/unpack/package/examples/request-triage" "$REPO/green"
cp -R "$WORK/unpack/package/examples/request-triage" "$REPO/red"
rm "$REPO/red/runward/handover.md"
sed "s|__NODE_IMAGE__|$NODE_IMAGE|" "$HERE/gitlab-ci.yml" > "$REPO/.gitlab-ci.yml"
git -C "$REPO" init -q -b main
git -C "$REPO" add -A
git -C "$REPO" -c user.name=bench -c user.email=bench@example.invalid commit -q -m "bench fixture"

# --- Phase 2, the cut. -------------------------------------------------------------------------
# A Docker network created with --internal has no gateway: its containers reach each other by name
# and nothing else. Every bench container (GitLab, the runner, the package server, the job and
# helper containers the runner starts) is attached to it and to nothing else.
docker network create --internal "$NET" >/dev/null
mark network-cut

docker run -d --name pkgs --network "$NET" -v "$PKGS:/srv:ro" "$NODE_IMAGE" node /srv/serve.mjs /srv 8080 >/dev/null

# What is cut is measured, and the probe gets a positive control first: the same probe, from the
# same image, on the default bridge, must reach the registry, or a "blocked" below proves nothing.
probe() { # probe <container> -> reachable | blocked
  if docker exec "$1" node -e "fetch('https://registry.npmjs.org/',{signal:AbortSignal.timeout(8000)}).then(()=>process.exit(0),()=>process.exit(1))"; then
    echo reachable; else echo blocked; fi
}
if docker run --rm "$NODE_IMAGE" node -e "fetch('https://registry.npmjs.org/',{signal:AbortSignal.timeout(15000)}).then(()=>process.exit(0),()=>process.exit(1))"; then
  finding positive-control-default-bridge reachable
else
  finding positive-control-default-bridge blocked
  fail "positive control failed: the probe cannot reach the registry even from the default bridge, so it cannot tell a cut from a blind probe"
fi
finding egress-from-internal-network "$(probe pkgs)"
finding dns-from-internal-network "$(docker exec pkgs getent hosts registry.npmjs.org >/dev/null 2>&1 && echo resolves || echo no-answer)"
finding default-route-in-internal-container "$(docker exec pkgs awk 'NR>1 && $2=="00000000"{n++} END{print (n?"present":"absent")}' /proc/net/route)"
[ "$(probe pkgs)" = blocked ] || fail "the internal network reaches the registry: the cut is not a cut"

# --- Phase 3, GitLab CE, booted with no network. ----------------------------------------------
GITLAB_CONFIG="external_url 'http://gitlab'
puma['worker_processes'] = 0
sidekiq['concurrency'] = 5
prometheus_monitoring['enable'] = false
gitlab_kas['enable'] = false
registry['enable'] = false
gitlab_rails['registry_enabled'] = false
gitlab_rails['usage_ping_enabled'] = false
letsencrypt['enable'] = false"
docker run -d --name gitlab --hostname gitlab --network "$NET" --shm-size 256m \
  -e GITLAB_OMNIBUS_CONFIG="$GITLAB_CONFIG" "$GITLAB_IMAGE" >/dev/null
mark gitlab-started

ready=""
for _ in $(seq 1 180); do  # 180 x 10 s = 30 min, then it is a finding, not a hang
  [ "$(docker inspect -f '{{.State.Running}}' gitlab)" = true ] || { docker logs --tail 200 gitlab; fail "the GitLab container stopped while booting"; }
  if docker exec gitlab curl -sf -o /dev/null "http://localhost/-/readiness?all=1"; then ready=yes; break; fi
  sleep 10
done
[ -n "$ready" ] || { docker logs --tail 200 gitlab > "$LOGS/gitlab-boot-tail.log"; fail "GitLab CE not ready after 30 minutes on an internal network"; }
mark gitlab-ready
finding egress-from-gitlab-container "$(docker exec gitlab sh -c 'curl -s -m 8 -o /dev/null https://registry.npmjs.org/ && echo reachable || echo blocked')"

# An API token for root, made by the Rails runner (the only door with no token yet). It lives as
# long as this job; it is masked in the log and redacted from every fixture.
TOKEN="$(docker exec gitlab gitlab-rails runner '
  u = User.find_by_username("root")
  attrs = { scopes: [:api, :write_repository], name: "bench", expires_at: 2.days.from_now }
  if PersonalAccessToken.column_names.include?("organization_id") && defined?(Organizations::Organization)
    attrs[:organization] = Organizations::Organization.first
  end
  t = u.personal_access_tokens.create!(attrs)
  puts t.token' | tail -n1)"
[ -n "$TOKEN" ] || fail "no API token from the Rails runner"
echo "::add-mask::$TOKEN"
mark token-made

# --- The API, recorded. -----------------------------------------------------------------------
api() { # api <METHOD> <path> [json-body] -> body, then the HTTP status on the last line
  local args=(-sS -X "$1" -H "PRIVATE-TOKEN: $TOKEN" -w '\n%{http_code}' "http://localhost/api/v4$2")
  if [ -n "${3:-}" ]; then args+=(-H "Content-Type: application/json" --data "$3"); fi
  docker exec gitlab curl "${args[@]}"
}
VERSION_JSON="$(api GET /version | sed '$d')"
GL_VERSION="$(jq -r .version <<<"$VERSION_JSON")"
GL_REVISION="$(jq -r .revision <<<"$VERSION_JSON")"
finding gitlab-version "$GL_VERSION ($GL_REVISION)"

STATUS=""; BODY=""
record() { # record <name> <endpoint template> <METHOD> <path> [json-body]
  local name="$1" endpoint="$2" method="$3" path="$4" req="${5:-}" out
  out="$(api "$method" "$path" "$req")"
  STATUS="${out##*$'\n'}"; BODY="${out%$'\n'*}"
  jq -n --arg name "$name" --arg endpoint "$endpoint" --arg method "$method" --arg path "/api/v4$path" \
    --arg req "$req" --arg status "$STATUS" --arg body "$BODY" \
    --arg version "$GL_VERSION" --arg revision "$GL_REVISION" --arg image "$GITLAB_IMAGE" \
    --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg run "$RUN_URL" '
    def redact: walk(if type == "object" then with_entries(
      if (.key | test("token"; "i")) and (.value | type) == "string" then .value = "[redacted]" else . end) else . end);
    { fixture: $name, source: "recorded", endpoint: $endpoint,
      gitlab: { edition: "ce", version: $version, revision: $revision, image: $image },
      recorded_at: $at, recorded_by: $run,
      request: { method: $method, path: $path, body: (if $req == "" then null else ($req | fromjson) end) },
      response: { status: ($status | tonumber), body: ($body | try fromjson catch .) | redact } }' \
    > "$FIX/$name.json"
  echo "recorded $name: $method /api/v4$path -> $STATUS"
}

record version "GET /version" GET /version

record project-create "POST /projects" POST /projects '{"name":"bench","path":"bench","visibility":"private"}'
PID="$(jq -r .id <<<"$BODY")"; [ "$STATUS" = 201 ] || fail "project not created ($STATUS)"

record runner-create "POST /user/runners" POST /user/runners '{"runner_type":"instance_type","description":"bench","run_untagged":true}'
[ "$STATUS" = 201 ] || fail "runner not created ($STATUS)"
RUNNER_TOKEN="$(jq -r .token <<<"$BODY")"
echo "::add-mask::$RUNNER_TOKEN"
mark project-and-runner-created

# --- The runner: docker executor, job containers on the internal network, no pulls at all. -----
docker run -d --name runner --network "$NET" -v /var/run/docker.sock:/var/run/docker.sock "$RUNNER_IMAGE" >/dev/null
docker exec runner gitlab-runner register --non-interactive \
  --url http://gitlab --clone-url http://gitlab --token "$RUNNER_TOKEN" --name bench \
  --executor docker --docker-image "$NODE_IMAGE" --docker-helper-image "$HELPER_IMAGE" \
  --docker-network-mode "$NET" --docker-pull-policy never > "$LOGS/runner-register.log" 2>&1 \
  || { cat "$LOGS/runner-register.log"; fail "runner registration failed"; }
mark runner-registered

# --- Push the fixture repository from inside the network (the host cannot reach it). -----------
AUTH="$(printf 'root:%s' "$TOKEN" | base64 | tr -d '\n')"
docker cp "$REPO" gitlab:/tmp/bench-repo
gitlab_git() { docker exec gitlab git -c safe.directory='*' -c "http.extraHeader=Authorization: Basic $AUTH" -C /tmp/bench-repo "$@"; }
gitlab_git push -q http://localhost/root/bench.git main
mark fixture-pushed

PIPE=""
for _ in $(seq 1 60); do
  PIPE="$(api GET "/projects/$PID/pipelines?ref=main" | sed '$d' | jq -r '.[0].id // empty')"
  [ -n "$PIPE" ] && break; sleep 5
done
[ -n "$PIPE" ] || fail "no pipeline was created for the push"
PSTATUS=""
for _ in $(seq 1 120); do  # 120 x 10 s = 20 min
  PSTATUS="$(api GET "/projects/$PID/pipelines/$PIPE" | sed '$d' | jq -r .status)"
  case "$PSTATUS" in success|failed|canceled|skipped) break ;; esac
  sleep 10
done
mark "pipeline-$PSTATUS"
record pipelines-list "GET /projects/:id/pipelines" GET "/projects/$PID/pipelines?ref=main"
record pipeline-get "GET /projects/:id/pipelines/:pipeline_id" GET "/projects/$PID/pipelines/$PIPE"
record pipeline-jobs "GET /projects/:id/pipelines/:pipeline_id/jobs" GET "/projects/$PID/pipelines/$PIPE/jobs"
JOBS="$BODY"

for job in gate-green gate-red; do
  JID="$(jq -r --arg n "$job" '.[] | select(.name == $n) | .id' <<<"$JOBS")"
  [ -n "$JID" ] || fail "job $job missing from the pipeline"
  record "job-trace-$job" "GET /projects/:id/jobs/:job_id/trace" GET "/projects/$PID/jobs/$JID/trace"
  printf '%s\n' "$BODY" > "$LOGS/$job.trace.log"
  finding "$job-job-status" "$(jq -r --arg n "$job" '.[] | select(.name == $n) | .status' <<<"$JOBS")"
  finding "$job-runward-exit" "$(grep -o 'bench-runward-exit=[0-9]*' <<<"$BODY" | tail -n1 | cut -d= -f2)"
  finding "$job-egress" "$(grep -o 'bench-egress=[a-z]*' <<<"$BODY" | tail -n1 | cut -d= -f2)"
done

# --- A merge request, for D1's summary note and G5's approval reads. --------------------------
gitlab_git checkout -q -b bench-change
docker exec gitlab sh -c 'echo "bench change" > /tmp/bench-repo/CHANGE.md'
gitlab_git add CHANGE.md
gitlab_git -c user.name=bench -c user.email=bench@example.invalid commit -q -m "bench change"
gitlab_git push -q http://localhost/root/bench.git bench-change
record mr-create "POST /projects/:id/merge_requests" POST "/projects/$PID/merge_requests" \
  '{"source_branch":"bench-change","target_branch":"main","title":"bench change"}'
IID="$(jq -r .iid <<<"$BODY")"; [ "$STATUS" = 201 ] || fail "merge request not created ($STATUS)"
MR="/projects/$PID/merge_requests/$IID"
NOTE_BODY='<!-- runward:summary -->\n**runward gate**: bench note, first version.'
record mr-note-create "POST /projects/:id/merge_requests/:merge_request_iid/notes" POST "$MR/notes" "{\"body\":\"$NOTE_BODY\"}"
NID="$(jq -r .id <<<"$BODY")"
record mr-note-get "GET /projects/:id/merge_requests/:merge_request_iid/notes/:note_id" GET "$MR/notes/$NID"
record mr-notes-list "GET /projects/:id/merge_requests/:merge_request_iid/notes" GET "$MR/notes?sort=asc&order_by=created_at"
record mr-note-update "PUT /projects/:id/merge_requests/:merge_request_iid/notes/:note_id" PUT "$MR/notes/$NID" \
  '{"body":"<!-- runward:summary -->\n**runward gate**: bench note, updated in place."}'
record mr-versions "GET /projects/:id/merge_requests/:merge_request_iid/versions" GET "$MR/versions"
record mr-commits "GET /projects/:id/merge_requests/:merge_request_iid/commits" GET "$MR/commits"
record mr-approvals "GET /projects/:id/merge_requests/:merge_request_iid/approvals" GET "$MR/approvals"
record mr-approval-state "GET /projects/:id/merge_requests/:merge_request_iid/approval_state" GET "$MR/approval_state"
record mr-approve "POST /projects/:id/merge_requests/:merge_request_iid/approve" POST "$MR/approve"
record mr-approvals-after-approve "GET /projects/:id/merge_requests/:merge_request_iid/approvals" GET "$MR/approvals"
record mr-pipelines "GET /projects/:id/merge_requests/:merge_request_iid/pipelines" GET "$MR/pipelines"
mark fixtures-recorded

# Late egress probe, after GitLab ran its background jobs for a while: still cut?
finding egress-from-gitlab-container-at-end "$(docker exec gitlab sh -c 'curl -s -m 8 -o /dev/null https://registry.npmjs.org/ && echo reachable || echo blocked')"
docker exec runner gitlab-runner --version > "$LOGS/runner-version.txt" 2>&1 || true
mark bench-done

# --- The verdict of the bench: what it set out to show, each read back, not assumed. ----------
get() { awk -F'\t' -v k="$1" '$1 == k { v = $2 } END { print v }' "$WORK/findings.tsv"; }
[ "$PSTATUS" = success ] || fail "pipeline ended $PSTATUS"
[ "$(get gate-green-runward-exit)" = 0 ] || fail "gate-green: runward exit $(get gate-green-runward-exit), expected 0"
[ "$(get gate-red-runward-exit)" = 1 ] || fail "gate-red: runward exit $(get gate-red-runward-exit), expected 1"
for k in gate-green-egress gate-red-egress egress-from-gitlab-container egress-from-gitlab-container-at-end; do
  [ "$(get "$k")" = blocked ] || fail "$k = $(get "$k"), expected blocked"
done
echo "bench passed in $(elapsed)s"
