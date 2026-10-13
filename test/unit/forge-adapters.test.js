// runward-forge, the adapters behind the port (ADR-0094 decisions 2 and 3).
//
// The GitLab summary poster is tested against a loopback stub of the merge request notes API, built
// below and bound to 127.0.0.1 only. Its note shape follows GitLab's notes API documentation (read
// 2026-10-13); it is a stub, not a recording. The recorded fixtures and the shared stub of PR
// "ci/gitlab-offline-bench" (G12) replace it once that bench has run against GitLab CE: until then no
// test here claims to match a live GitLab.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as gitlab from "../../packages/runward-forge/src/gitlab.js";
import * as github from "../../packages/runward-forge/src/github.js";
import { ADAPTERS, PORT_FUNCTIONS, SUMMARY_MARKER, detectForge } from "../../packages/runward-forge/src/index.js";
import { main as cli } from "../../packages/runward-forge/src/cli.js";

const TOKEN = "stub-project-token";
const NOTES = /^\/api\/v4\/projects\/([^/]+)\/merge_requests\/(\d+)\/notes(?:\/(\d+))?$/;

/** A loopback stub of GitLab's merge request notes. `script` answers some requests itself (a status,
 *  a malformed body, a hang) before the stateful model sees them. */
function stub(script = () => null) {
  const notes = [];
  const requests = [];
  let next = 501;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const url = new URL(req.url, "http://127.0.0.1");
      requests.push({ method: req.method, path: url.pathname, token: req.headers["private-token"] ?? null });
      const send = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
      const scripted = script(req, requests.length);
      if (scripted === "hang") return; // never answers: the client's timeout decides
      if (scripted) return send(scripted.status, scripted.body);
      if (req.headers["private-token"] !== TOKEN) return send(401, { message: "401 Unauthorized" });
      const m = NOTES.exec(url.pathname);
      if (!m) return send(404, { message: "404 Not Found" });
      const body = raw ? JSON.parse(raw) : null;
      if (req.method === "GET" && !m[3]) return send(200, notes);
      if (req.method === "POST" && !m[3]) {
        const note = { id: next++, body: body.body, system: false, noteable_type: "MergeRequest", noteable_iid: Number(m[2]) };
        notes.push(note);
        return send(201, note);
      }
      const note = notes.find((n) => n.id === Number(m[3]));
      if (note && req.method === "PUT") { note.body = body.body; return send(200, note); }
      return send(404, { message: "404 Not Found" });
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    resolve({
      ctx: { apiUrl: `http://127.0.0.1:${port}/api/v4`, projectId: "42", mrIid: "7", token: TOKEN, timeoutMs: 300 },
      notes, requests,
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
    });
  }));
}

const SUMMARY = "## runward gate: clean\n\n| what | result |\n|---|---|\n| verdict | clean |\n";

test("forge port: both adapters implement every function of the port, and nothing reads as half an adapter", () => {
  assert.deepEqual([...PORT_FUNCTIONS], ["readChangeFacts", "postSummary", "setExternalStatus", "identifyChange", "renderPath"]);
  for (const [name, a] of Object.entries(ADAPTERS)) {
    for (const fn of PORT_FUNCTIONS) assert.equal(typeof a[fn], "function", `${name}.${fn}`);
  }
  assert.equal(detectForge({ GITLAB_CI: "true" }), "gitlab");
  assert.equal(detectForge({ GITHUB_ACTIONS: "true" }), "github");
  assert.equal(detectForge({}), null);
});

test("GitLab summary note: created once, then updated in place, found by its marker", async () => {
  const s = await stub();
  try {
    const first = await gitlab.postSummary(SUMMARY, s.ctx);
    assert.equal(first.posted, true, first.message);
    assert.equal(first.action, "created");
    const second = await gitlab.postSummary(SUMMARY.replace("clean", "gaps"), s.ctx);
    assert.equal(second.action, "updated");
    assert.equal(second.noteId, first.noteId, "the same note, not a second one");
    assert.equal(s.notes.length, 1);
    assert.ok(s.notes[0].body.startsWith(SUMMARY_MARKER + "\n"), "the marker leads the note");
    assert.ok(s.requests.every((r) => r.token === TOKEN), "every call carries the project token");
  } finally { await s.close(); }
});

test("GitLab summary note, closed behaviour: no token is said, nothing is sent, and the job is not failed", async () => {
  const s = await stub();
  try {
    const r = await gitlab.postSummary(SUMMARY, { ...s.ctx, token: null });
    assert.deepEqual([r.ok, r.posted, r.message], [true, false, "summary not posted: no token"]);
    assert.equal(s.requests.length, 0);
    const noMr = await gitlab.postSummary(SUMMARY, { ...s.ctx, mrIid: null });
    assert.equal(noMr.posted, false);
    assert.match(noMr.message, /no merge request/);
  } finally { await s.close(); }
});

test("GitLab summary note, closed behaviour: 401, 403, 404 and a malformed body are named, never posted, never retried", async () => {
  for (const [scripted, reason] of [
    [{ status: 401, body: { message: "401 Unauthorized" } }, "HTTP 401"],
    [{ status: 403, body: { message: "403 Forbidden" } }, "HTTP 403"],
    [{ status: 404, body: { message: "404 Not Found" } }, "HTTP 404"],
    [{ status: 200, body: "{not json" }, "malformed response (HTTP 200)"],
    [{ status: 200, body: { not: "an array" } }, "malformed response (HTTP 200)"],
  ]) {
    const s = await stub(() => scripted);
    try {
      const r = await gitlab.postSummary(SUMMARY, s.ctx);
      assert.deepEqual([r.ok, r.posted, r.reason], [true, false, reason], JSON.stringify(scripted));
      assert.equal(s.requests.length, 1, `${reason}: no retry outside 5xx and timeouts`);
    } finally { await s.close(); }
  }
});

test("GitLab summary note, closed behaviour: a 5xx is retried once, then said; one 5xx then a success posts", async () => {
  const always = await stub(() => ({ status: 503, body: { message: "503" } }));
  try {
    const r = await gitlab.postSummary(SUMMARY, always.ctx);
    assert.deepEqual([r.posted, r.reason], [false, "HTTP 503"]);
    assert.equal(always.requests.length, 2, "one retry, not more");
  } finally { await always.close(); }
  const once = await stub((_req, n) => (n === 1 ? { status: 502, body: { message: "502" } } : null));
  try {
    const r = await gitlab.postSummary(SUMMARY, once.ctx);
    assert.equal(r.posted, true, r.message);
  } finally { await once.close(); }
});

test("GitLab summary note, closed behaviour: a timeout is retried once, then said", async () => {
  const s = await stub(() => "hang");
  try {
    const r = await gitlab.postSummary(SUMMARY, { ...s.ctx, timeoutMs: 80 });
    assert.deepEqual([r.ok, r.posted, r.reason], [true, false, "timeout"]);
    assert.equal(s.requests.length, 2);
  } finally { await s.close(); }
});

test("forge port, closed behaviour: facts and the external status fail closed on both forges; a planted 403 never yields a green", async () => {
  for (const a of Object.values(ADAPTERS)) {
    const facts = await a.readChangeFacts({ id: "x" });
    const status = await a.setExternalStatus({ exitCode: 0, verdict: "clean" }, "deadbeef");
    for (const r of [facts, status]) {
      assert.equal(r.ok, false, r.message);
      assert.equal(r.refused, true);
      assert.match(r.message, /^refused: /);
    }
    assert.match(status.reason, /no customer policy/);
  }
  // The summary's "not posted" is ok:true by decision 3, so it must never carry `posted: true`.
  const s = await stub(() => ({ status: 403, body: { message: "403 Forbidden" } }));
  try {
    const r = await gitlab.postSummary(SUMMARY, s.ctx);
    assert.equal(r.posted, false);
  } finally { await s.close(); }
});

test("forge port: the same Markdown, byte for byte, reaches the GitLab note and the GitHub job summary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-forge-"));
  const s = await stub();
  try {
    const file = join(dir, "summary.md");
    writeFileSync(file, "");
    const gh = await github.postSummary(SUMMARY, { summaryFile: file });
    assert.equal(gh.posted, true);
    await gitlab.postSummary(SUMMARY, s.ctx);
    assert.equal(readFileSync(file, "utf8"), SUMMARY);
    assert.equal(s.notes[0].body, `${SUMMARY_MARKER}\n${SUMMARY}`, "the note is the marker line, then the same bytes");
    const none = await github.postSummary(SUMMARY, { summaryFile: null });
    assert.deepEqual([none.ok, none.posted], [true, false]);
  } finally { await s.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("forge port: identifyChange reads each forge's merge message, and only that", () => {
  assert.deepEqual(gitlab.identifyChange("Merge branch 'feat' into 'main'\n\nAdd x\n\nSee merge request group/sub/project!42"),
    { forge: "gitlab", id: "group/sub/project!42", project: "group/sub/project", number: 42 });
  assert.deepEqual(github.identifyChange("Merge pull request #386 from stranxik/docs/adr-0093-observability"),
    { forge: "github", id: "#386", number: 386 });
  assert.equal(github.identifyChange("feat: something (#12)"), null, "a squash subject anyone can type is not read");
  assert.equal(gitlab.identifyChange("Merge pull request #3 from a/b"), null);
  assert.equal(github.identifyChange("See merge request g/p!3"), null);
  assert.equal(gitlab.identifyChange(undefined), null);
});

test("forge port: renderPath links a file at a ref on each forge, and refuses to guess a missing part", () => {
  assert.equal(gitlab.renderPath("runward/governance/delivery report.html", { serverUrl: "https://gitlab.example/", projectPath: "g/p", ref: "abc123" }),
    "https://gitlab.example/g/p/-/blob/abc123/runward/governance/delivery%20report.html");
  assert.equal(github.renderPath("./runward/framing.md", { serverUrl: "https://github.com", repository: "o/r", ref: "abc123" }),
    "https://github.com/o/r/blob/abc123/runward/framing.md");
  assert.equal(gitlab.renderPath("x", { serverUrl: "https://gitlab.example", projectPath: "g/p", ref: null }), null);
});

test("runward-forge CLI: exit 0 whether or not the summary is posted, exit 2 on a usage error", async () => {
  const lines = [];
  const out = { log: (m) => lines.push(m), error: (m) => lines.push(m) };
  const dir = mkdtempSync(join(tmpdir(), "rw-forge-cli-"));
  try {
    const f = join(dir, "s.md");
    writeFileSync(f, SUMMARY);
    assert.equal(await cli(["post-summary", f], { GITLAB_CI: "true" }, out), 0);
    assert.equal(lines.at(-1), "summary not posted: no token");
    assert.equal(await cli(["post-summary", join(dir, "missing.md"), "--forge", "gitlab"], {}, out), 0);
    assert.match(lines.at(-1), /not readable/);
    assert.equal(await cli(["post-summary", f], {}, out), 2, "no forge detected and none named");
    assert.equal(await cli(["nope"], {}, out), 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
