// The snapshot on recorded answers: no network in a test. Each external fact has its control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { snapshot, readSnapshot, inRange } from "../src/snapshot.js";
import { G, repo } from "./helpers.js";

function fakeTransport({ head, controlVulns = [{ id: "GHSA-ctrl" }], scorecardCommit = head, rules = [{ type: "non_fast_forward" }, { type: "deletion" }, { type: "required_status_checks", parameters: { required_status_checks: [{ context: "test" }] } }] } = {}) {
  const log = [];
  const ok = (value) => ({ status: "ok", value });
  const gh = (path) => {
    log.push({ kind: "gh", request: path, status: "ok" });
    if (path === "repos/o/r") return ok({ default_branch: "main", visibility: "public", owner: { type: "User" }, stargazers_count: 3, forks_count: 1 });
    if (path === "repos/o/r/commits/main") return ok({ sha: head });
    if (path.startsWith("repos/o/r/private-vulnerability-reporting")) return ok({ enabled: true });
    if (path.startsWith("repos/o/r/rules/branches/")) return ok(rules);
    if (path.startsWith("repos/o/r/branches/")) return { status: "http-404" };
    if (path.startsWith("repos/o/r/collaborators?permission=admin")) return ok([{ login: "o", type: "User" }, { login: "helper[bot]", type: "Bot" }]);
    if (path.startsWith("repos/o/r/collaborators")) return ok([{ login: "o", type: "User" }]);
    if (path.startsWith("repos/o/r/security-advisories")) return ok([]);
    if (path.startsWith("repos/o/r/pulls?")) return ok([]);
    if (path.startsWith("repos/o/r/issues")) return ok([{ created_at: "2026-11-01T10:00:00Z", user: { login: "someone", type: "User" } }, { created_at: "2026-11-01T10:00:00Z", user: { login: "dependabot[bot]", type: "Bot" } }]);
    return { status: "http-404" };
  };
  const get = async (url, opts = {}) => {
    log.push({ kind: opts.method === "POST" ? "post" : "get", request: url, status: "ok" });
    if (url === "https://api.osv.dev/v1/querybatch") {
      const qs = opts.body.queries;
      return ok({ results: qs.map((q, i) => (i === 0 ? { vulns: controlVulns } : q.package.name === "bad" ? { vulns: [{ id: "GHSA-bad" }] } : {})) });
    }
    if (url === "https://api.osv.dev/v1/vulns/GHSA-bad") return ok({ id: "GHSA-bad", published: "2026-01-01T00:00:00Z", database_specific: { severity: "HIGH" }, aliases: [] });
    if (url.startsWith("https://api.securityscorecards.dev/")) return ok({ score: 7.5, repo: { commit: scorecardCommit }, scorecard: { version: "v5.6.0" }, checks: [{ name: "Code-Review", score: 0 }, { name: "Maintained", score: 0 }, { name: "Pinned-Dependencies", score: 10 }] });
    return { status: "http-404" };
  };
  return { gh, get, tls: async () => ({ status: "ok", protocol: "TLSv1.3", authorized: true, validTo: null }), npm: () => ({ code: 1, out: "", err: "" }), log, now: () => "2026-11-06T00:00:00.000Z" };
}

const profile = { schema: "runward-assess-profile/1", profiles: ["L"], facts: { publie_paquet: null, surfaces_publiques: { files: [], urls: [] }, exceptions: [] } };
const lock = JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/bad": { version: "1.0.0" }, "node_modules/good": { version: "2.0.0" } } });

async function take(t, r) {
  const out = mkdtempSync(join(tmpdir(), "runward-assess-snap-"));
  const s = await snapshot({ repo: r.dir, rev: "HEAD", slug: "o/r", profile, out, transport: t, lexicon: G.data.lexicon, osvControl: G.data.osvControl, bots: G.data.bots, tables: G.grid.tables, acquire: false, gridData: G.digests.gridData });
  return { out, s, facts: JSON.parse(readFileSync(join(out, "facts.json"), "utf8")) };
}

test("OSV: a vulnerable lock entry is counted, and a blind base (the control comes back clean) observes nothing", async () => {
  const r = repo([{ files: { "package-lock.json": lock } }]);
  const head = (await import("node:child_process")).execFileSync("git", ["-C", r.dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  try {
    const seen = await take(fakeTransport({ head }), r);
    assert.equal(seen.facts["x.sec03.control_detected"], true);
    assert.equal(seen.facts["x.sec03.vulnerable_packages"], 1);
    assert.equal(seen.facts["x.sec03.high_unexcepted"], 1);
    assert.equal(seen.facts["x.sec03.open_over_30d"], 1);
    rmSync(seen.out, { recursive: true, force: true });
    const blind = await take(fakeTransport({ head, controlVulns: [] }), r);
    assert.equal(blind.facts["x.sec03.control_detected"], false);
    assert.ok("$unobserved" in blind.facts["x.sec03.high_unexcepted"], "a blind base is never read as clean");
    rmSync(blind.out, { recursive: true, force: true });
  } finally { r.cleanup(); }
});

test("Scorecard is read only when its result is of the assessed commit; branch rules; bots left out of the admins", async () => {
  const r = repo([{ files: { "package-lock.json": lock } }]);
  const head = (await import("node:child_process")).execFileSync("git", ["-C", r.dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  try {
    const same = await take(fakeTransport({ head }), r);
    assert.equal(same.facts["x.sec05.scorecard_zero_crit_high"], 1, "Maintained at 0 counts; Code-Review is excepted");
    assert.equal(same.facts["x.sec05.scorecard_below_8"], 1);
    assert.deepEqual(same.facts["x.sec05.scorecard_score"], { d: 100, n: 75 });
    assert.equal(same.facts["x.gou02.force_push_blocked"], true);
    assert.equal(same.facts["x.gou02.required_checks"], 1);
    assert.equal(same.facts["x.gou03.admin_humans"], 1, "a bot administrator is not a human one");
    assert.equal(same.facts["x.mar01.third_party_humans"], 1, "the owner and bots are not third parties");
    rmSync(same.out, { recursive: true, force: true });
    const other = await take(fakeTransport({ head, scorecardCommit: "f".repeat(40), rules: [] }), r);
    assert.ok("$unobserved" in other.facts["x.sec05.scorecard_zero_crit_high"]);
    assert.equal(other.facts["x.gou02.force_push_blocked"], false, "no rule, no classic protection: force-push is not blocked");
    rmSync(other.out, { recursive: true, force: true });
  } finally { r.cleanup(); }
});

test("the manifest names every file with its sha256, and a file changed afterwards is refused", async () => {
  const r = repo([{ files: { "package-lock.json": lock } }]);
  const head = (await import("node:child_process")).execFileSync("git", ["-C", r.dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  try {
    const { out, s } = await take(fakeTransport({ head }), r);
    const back = readSnapshot(out);
    assert.equal(back.digest, s.digest);
    assert.equal(back.manifest.subject.headAtCapture, head);
    assert.ok(back.manifest.entries.some((e) => e.path === "facts.json"));
    assert.ok(!readFileSync(join(out, "raw", "requests.json"), "utf8").includes("token"), "no credential is logged");
    const f = join(out, "facts.json");
    writeFileSync(f, readFileSync(f, "utf8").replace('"x.mar02.stars":3', '"x.mar02.stars":300'));
    assert.throws(() => readSnapshot(out), /differs from the snapshot's manifest/);
    rmSync(out, { recursive: true, force: true });
  } finally { r.cleanup(); }
});

test("advisory ranges read as GitHub writes them", () => {
  assert.equal(inRange("0.40.0", ">= 0.35.0, < 0.42.3"), true);
  assert.equal(inRange("0.42.3", ">= 0.35.0, < 0.42.3"), false);
  assert.equal(inRange("0.34.9", ">= 0.35.0, < 0.42.3"), false);
  assert.equal(inRange("1.2.3", "= 1.2.3"), true);
  assert.equal(inRange("1.2.3", "<= 1.2.2"), false);
});
