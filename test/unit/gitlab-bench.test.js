// The GitLab bench (G12, docs/gitlab-bench.md). Layer 1: the recorded or documented GitLab API
// responses under test/fixtures/gitlab/ and the loopback stub that replays them, so the forge code of
// D1 (the merge request note, the reports) is tested with no GitLab and no network. Layer 2: the
// guards on the CI bench that boots GitLab CE with its network cut, which these tests cannot run but
// can keep honest (images pinned by digest, the cut asked for, both exit codes checked, never on a PR).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGitlabFixtures, startGitlabStub } from "../support/gitlab-stub.js";
import { shape } from "../gitlab-bench/compare-fixtures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const fixtures = loadGitlabFixtures();

// ---- Layer 1: the fixtures. ------------------------------------------------------------------

test("gitlab fixtures: there are some, and each says where it came from and when", () => {
  assert.ok(fixtures.length >= 5, `expected the documented set, found ${fixtures.length}`);
  for (const fx of fixtures) {
    if (fx.source === "docs-example") {
      // A documentation example is never passed off as a measurement.
      assert.equal(fx.gitlab.version, null, `${fx.fixture}: a docs example claims no GitLab version`);
      assert.match(fx.docs.file, /^https:\/\/gitlab\.com\/gitlab-org\/gitlab\/-\/blob\/[0-9a-f]{40}\/doc\/api\/\S+\.md$/, `${fx.fixture}: docs file pinned to a commit`);
      assert.match(fx.note, /not recorded from an instance/, `${fx.fixture}: says it was not recorded`);
    } else {
      assert.match(fx.gitlab.version, /^\d+\.\d+\.\d+/, `${fx.fixture}: recorded GitLab version`);
      assert.match(fx.gitlab.image, /@sha256:[0-9a-f]{64}$/, `${fx.fixture}: recorded image pinned by digest`);
      assert.match(fx.recorded_by, /\/actions\/runs\/\d+$/, `${fx.fixture}: recorded by a named workflow run`);
    }
  }
});

test("gitlab fixtures: the request path is an instance of the endpoint it claims", () => {
  for (const fx of fixtures) {
    const [method, template] = fx.endpoint.split(" ");
    assert.equal(fx.request.method, method, `${fx.fixture}: method`);
    const pattern = new RegExp(`^/api/v4${template.replace(/:[a-z_]+/g, "[^/?]+")}(\\?.*)?$`);
    assert.match(fx.request.path, pattern, `${fx.fixture}: ${fx.request.path} is not ${fx.endpoint}`);
  }
});

test("gitlab fixtures: no credential is committed", () => {
  const walk = (v, at) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (/token/i.test(k) && typeof x === "string" && !/_at$/.test(k)) assert.equal(x, "[redacted]", `${at}.${k} must be redacted`);
        walk(x, `${at}.${k}`);
      }
    }
  };
  for (const fx of fixtures) {
    walk(fx.response.body, fx.fixture);
    // GitLab's token prefixes: personal access, runner authentication, runner registration.
    assert.doesNotMatch(JSON.stringify(fx), /\bgl(pat|rt|rtr)-[A-Za-z0-9_-]{8,}/, `${fx.fixture}: a GitLab token shape`);
  }
});

test("gitlab fixtures: the loader refuses a fixture that does not say where it came from", () => {
  const good = structuredClone(fixtures[0]);
  for (const [mutate, why] of [
    [(f) => { f.source = "made-up"; }, /source/],
    [(f) => { delete f.recorded_at; }, /recorded_at/],
    [(f) => { f.endpoint = "the notes one"; }, /endpoint/],
    [(f) => { f.source = "recorded"; f.gitlab = { version: null }; }, /GitLab version/],
  ]) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.throws(() => loadFromObjects([bad]), why);
  }
});

// The loader reads a directory; to feed it one object, write it to a temporary one.
function loadFromObjects(list) {
  const dir = mkdtempSync(join(tmpdir(), "rw-gitlab-fx-"));
  try {
    for (const fx of list) writeFileSync(join(dir, `${fx.fixture}.json`), JSON.stringify(fx));
    return loadGitlabFixtures(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- Layer 1: the stub. ----------------------------------------------------------------------

test("gitlab stub: binds the loopback address only", async () => {
  const stub = await startGitlabStub({ fixtures });
  try {
    assert.equal(stub.address, "127.0.0.1");
    assert.match(stub.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  } finally {
    await stub.close();
  }
});

test("gitlab stub: replays every fixture, status and body", async () => {
  const stub = await startGitlabStub({ fixtures, token: "t" });
  try {
    for (const fx of fixtures) {
      const res = await fetch(stub.url + fx.request.path, {
        method: fx.request.method,
        headers: { "PRIVATE-TOKEN": "t", "content-type": "application/json" },
        body: fx.request.body ? JSON.stringify(fx.request.body) : undefined,
      });
      assert.equal(res.status, fx.response.status, `${fx.fixture}: status`);
      const text = await res.text();
      assert.deepEqual(typeof fx.response.body === "string" ? text : JSON.parse(text), fx.response.body, `${fx.fixture}: body`);
    }
    assert.deepEqual(stub.unmatched, []);
  } finally {
    await stub.close();
  }
});

test("gitlab stub: no token is a 401, an unknown route a 404, both as GitLab words them", async () => {
  const stub = await startGitlabStub({ fixtures, token: "t" });
  try {
    const noToken = await fetch(`${stub.url}/api/v4/projects/1/pipelines/46`);
    assert.equal(noToken.status, 401);
    assert.deepEqual(await noToken.json(), { message: "401 Unauthorized" });
    const unknown = await fetch(`${stub.url}/api/v4/nowhere`, { headers: { "PRIVATE-TOKEN": "t" } });
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { message: "404 Not Found" });
    assert.deepEqual(stub.unmatched, [{ method: "GET", path: "/api/v4/nowhere" }]);
  } finally {
    await stub.close();
  }
});

// What D1's summary poster will do (docs/gitlab-bench.md, G3): find the one note carrying the
// marker, update it in place, or create it. This reference flow lives here, in the test, until D1
// ships the real one; it shows the stub is enough to test it without GitLab.
async function upsertNote(base, token, project, iid, marker, text) {
  const headers = { "PRIVATE-TOKEN": token, "content-type": "application/json" };
  const notesUrl = `${base}/api/v4/projects/${project}/merge_requests/${iid}/notes`;
  const list = await (await fetch(`${notesUrl}?sort=asc&order_by=created_at`, { headers })).json();
  const mine = list.find((n) => typeof n.body === "string" && n.body.startsWith(marker));
  const body = JSON.stringify({ body: `${marker}\n${text}` });
  const res = mine
    ? await fetch(`${notesUrl}/${mine.id}`, { method: "PUT", headers, body })
    : await fetch(notesUrl, { method: "POST", headers, body });
  return { status: res.status, note: await res.json() };
}

test("gitlab stub: a summary note is created once, then updated in place (the D1 flow)", async () => {
  const stub = await startGitlabStub({ fixtures, token: "t" });
  const marker = "<!-- runward:summary -->";
  try {
    const first = await upsertNote(stub.url, "t", 7, 3, marker, "gate: 1 gap");
    assert.equal(first.status, 201);
    const second = await upsertNote(stub.url, "t", 7, 3, marker, "gate: clean");
    assert.equal(second.status, 200);
    assert.equal(second.note.id, first.note.id, "the same note, not a second one");
    const list = await (await fetch(`${stub.url}/api/v4/projects/7/merge_requests/3/notes`, { headers: { "PRIVATE-TOKEN": "t" } })).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].body, `${marker}\ngate: clean`);
    // The note has the shape of the fixture it is modelled on, key for key.
    const model = fixtures.find((f) => f.fixture === "mr-note-get").response.body;
    assert.deepEqual(Object.keys(list[0]).sort(), Object.keys(model).sort());
    assert.deepEqual(stub.requests.map((r) => r.method), ["GET", "POST", "GET", "PUT", "GET"]);
  } finally {
    await stub.close();
  }
});

test("gitlab bench: the shape comparison sees a renamed key and ignores a changed value", () => {
  assert.deepEqual(shape({ a: 1, b: [{ c: 2 }] }), ["$.a", "$.b", "$.b[].c"]);
  assert.deepEqual(shape({ a: 1, b: [{ c: 2 }] }), shape({ a: 9, b: [{ c: 7 }, { d: 1 }] }));
  assert.notDeepEqual(shape({ approved_at: "x" }), shape({ approvedAt: "x" }));
});

// ---- Layer 2: guards on the CI bench these tests cannot run. --------------------------------

test("gitlab bench: every image is pinned by digest, and the bench reads them from one place", () => {
  const env = read("test/gitlab-bench/images.env");
  const images = [...env.matchAll(/^([A-Z_]+_IMAGE)=(\S+)$/gm)];
  assert.deepEqual(images.map((m) => m[1]).sort(), ["GITLAB_IMAGE", "HELPER_IMAGE", "NODE_IMAGE", "RUNNER_IMAGE"]);
  for (const [, name, ref] of images) assert.match(ref, /^[a-z0-9/-]+@sha256:[0-9a-f]{64}$/, `${name} pinned by digest`);
  const bench = read("test/gitlab-bench/bench.sh");
  assert.match(bench, /source "\$HERE\/images\.env"/);
  assert.doesNotMatch(bench, /gitlab\/gitlab-(ce|runner)(-helper)?:/, "no image by tag in the bench");
});

test("gitlab bench: the network is cut, the cut is measured against a positive control, and no image is pulled after it", () => {
  const bench = read("test/gitlab-bench/bench.sh");
  assert.match(bench, /docker network create --internal "\$NET"/);
  assert.match(bench, /positive-control-default-bridge/);
  assert.match(bench, /--docker-network-mode "\$NET"/);
  assert.match(bench, /--docker-pull-policy never/);
  const cut = bench.indexOf("docker network create --internal");
  assert.ok(bench.lastIndexOf("docker pull") < cut, "every pull happens before the cut");
  assert.ok(bench.lastIndexOf("npm install --silent") < cut, "the npm cache is warmed before the cut");
});

test("gitlab bench: the pipeline checks the exit code both ways, and the bench reads it back", () => {
  const ci = read("test/gitlab-bench/gitlab-ci.yml");
  assert.match(ci, /gate-green:[\s\S]*?cd green[\s\S]*?runward check --strict[\s\S]*?test "\$code" -eq 0/);
  assert.match(ci, /gate-red:[\s\S]*?cd red[\s\S]*?runward check --strict[\s\S]*?test "\$code" -eq 1/);
  assert.match(ci, /npm install --offline/);
  assert.doesNotMatch(ci, /npx|registry\.npmjs\.org\/runward/, "runward never comes from a registry");
  const bench = read("test/gitlab-bench/bench.sh");
  assert.match(bench, /gate-green-runward-exit\)" = 0/);
  assert.match(bench, /gate-red-runward-exit\)" = 1/);
});

test("gitlab bench: the workflow runs on demand and weekly, never on a push or a pull request", () => {
  const wf = read(".github/workflows/gitlab-bench.yml");
  const on = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"));
  assert.match(on, /workflow_dispatch:/);
  assert.match(on, /schedule:/);
  assert.match(on, /update_fixtures:/);
  assert.doesNotMatch(on, /pull_request|push:/);
  assert.match(wf, /^permissions:\n {2}contents: read$/m, "read-only token");
  assert.match(wf, /test\/gitlab-bench\/bench\.sh/);
});

// ---- Layer 2, the recipes of runward-integrations (ADR-0122 decision 6): guards on the jobs these tests
// cannot run. Each recipe's GitLab template is included from a second project of the bench's instance at a
// pinned commit, its job regenerates its report on its sabotaged tree and on the healthy one, and the gate
// reads each tree with the exit code checked three ways, read back from the job trace by bench.sh.
test("gitlab bench: each recipe runs through its own template, included at a pinned commit, with the control's command", async () => {
  const yaml = await import("js-yaml");
  // GitLab's `!reference` tag, read as what it is: a reference, not a sequence of strings.
  const reference = yaml.defineSequenceTag("!reference", { create: () => [], addItem: (c, i) => { c.push(i); }, finalize: (c) => ({ reference: c }) });
  const ci = yaml.load(read("test/gitlab-bench/gitlab-ci.yml"), { schema: new yaml.Schema([...yaml.CORE_SCHEMA.tags, reference]) });
  const { readManifests } = await import(new URL("../../packages/runward-integrations/src/manifest.js", import.meta.url).href);
  const manifests = readManifests();
  assert.deepEqual(ci.include, [{ project: "root/integrations", ref: "__RWI_TEMPLATES_SHA__",
    file: manifests.map((m) => `/${m.steps.gitlab.template}`) }], "the three templates, from the second project, at the commit bench.sh substitutes");
  assert.equal(ci[".rwi"].variables.RWI_PACKAGE_SHA256, "__RWI_SHA256__", "the package the templates fetch is pinned by its sha256");
  for (const m of manifests) {
    for (const tree of [m.id, "healthy"]) {
      const job = ci[`recipe-${m.id}-${tree === "healthy" ? "healthy" : "sabotaged"}`];
      assert.ok(job.extends.includes(m.steps.gitlab.extends), `${m.id}: the job extends the recipe's template`);
      assert.equal(job.variables.RWI_CWD, `recipes/${tree}/code`);
    }
    assert.deepEqual(JSON.parse(ci[`.rwi-${m.id}`].variables.RWI_COMMAND), m.control.command.argv, `${m.id}: the bench runs the control's command`);
    assert.equal(ci[`.rwi-${m.id}`].variables.RWI_REPORT, m.control.command.report);
    assert.deepEqual(ci[`gate-${m.id}-without-recipe`], { extends: ".recipe-gate", needs: [], variables: { TREE: m.id, EXPECT: "0" } }, `${m.id}: the sabotage passes without the recipe`);
    assert.deepEqual(ci[`gate-${m.id}-with-recipe`], { extends: ".recipe-gate", needs: [{ job: `recipe-${m.id}-sabotaged`, artifacts: true }], variables: { TREE: m.id, EXPECT: "1" } }, `${m.id}: refused with it`);
  }
  assert.deepEqual(ci["gate-healthy-with-recipes"].needs.map((n) => n.job).sort(), manifests.map((m) => `recipe-${m.id}-healthy`).sort());
  assert.equal(ci["gate-healthy-with-recipes"].variables.EXPECT, "0");
  assert.equal(ci[".recipe-gate"].when, "always", "the gate reads a red recipe job's report too");
  assert.match(ci[".recipe-gate"].script.at(-1), /echo "bench-runward-exit=\$code"; test "\$code" -eq "\$EXPECT"/);
  assert.equal(ci[".rwi"]["allow_failure"], true, "a red tool fails its own job, not the pipeline: the gate jobs decide");
  const bench = read("test/gitlab-bench/bench.sh");
  for (const m of manifests) {
    assert.match(bench, new RegExp(`gate-${m.id}-without-recipe:0`));
    assert.match(bench, new RegExp(`gate-${m.id}-with-recipe:1`));
  }
  assert.match(bench, /gate-healthy-with-recipes:0/);
  assert.match(bench, /\[ "\$\(get "\$job-runward-exit"\)" = "\$want" \] \|\| fail/, "each exit is read back and compared");
  const cut = bench.indexOf("docker network create --internal");
  for (const step of ["npm ci --silent --ignore-scripts", "npm pack --silent --pack-destination \"$PKGS\" >/dev/null )\nmv \"$PKGS\"/runward-integrations", "RWI_SHA256=", "sabotage --recipe"]) {
    const at = bench.indexOf(step);
    assert.ok(at !== -1 && at < cut, `${step.split("\n")[0]} happens before the cut`);
  }
  assert.ok(bench.indexOf("root/integrations.git main") < bench.indexOf("root/bench.git main"), "the templates' project is pushed before the pipeline that includes it");
});
