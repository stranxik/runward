// `runward-fleet build` is a pure function of the files fleet.json declares (ADR-0093 decision 10):
// the same files give the same index and the same page, byte for byte; a declared file that is not
// there is a finding and never a reason to stop; a private path never reaches the page; the page
// loads nothing from elsewhere; and the join keys do not move when the inventory grows. Each with
// its positive control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, exampleCheck, fixture, indexFrom, manifestOf, missionWith, pageFor, PKG, realCheck, ROOT, rules, site } from "../support/fleet.js";

const records = () => fixture("exports", "runward.records.jsonl");

function realFleet() {
  const manifest = manifestOf([
    { id: "runward", name: "stranxik/runward", repository: "github.com/stranxik/runward", commit: "32d8425b1cb41568eab3ce29dce24f63bad8a32a",
      expects: ["check", "attestation", "verify", "witness", "summary", "history"],
      exports: {
        check: { file: "exports/runward/check.json", producedBy: "runward check --strict --json" },
        attestation: { file: "exports/runward/verdict.intoto.json" },
        verify: { file: "exports/runward/verify.json" },
        witness: { file: "exports/runward/witness.json" },
        summary: { file: "exports/runward/summary.md" },
        history: { file: "exports/runward/records.jsonl" },
      } },
    { id: "example", name: "stranxik/runward · examples/request-triage", repository: "github.com/stranxik/runward", exports: { check: { file: "exports/example/check.json" } } },
  ]);
  const files = {
    "exports/runward/check.json": realCheck(),
    "exports/runward/verdict.intoto.json": fixture("exports", "runward.verdict.intoto.json"),
    "exports/runward/verify.json": fixture("exports", "runward.verify.json"),
    "exports/runward/witness.json": fixture("exports", "runward.witness.json"),
    "exports/runward/summary.md": fixture("exports", "runward.summary.md"),
    "exports/runward/records.jsonl": records(),
    "exports/example/check.json": exampleCheck(),
  };
  return { manifest, files };
}

test("the index of real exports: the contract, the groupings with their lists, a digest per source", () => {
  const { manifest, files } = realFleet();
  const index = indexFrom(manifest, files);
  assert.equal(index.format, "runward-fleet-index/0");
  assert.deepEqual(index.fleet.byVerdict.map((g) => [g.state, g.n, g.N, g.list]), [["clean", 2, 2, ["runward", "example"]], ["gaps", 0, 2, []], ["level-not-met", 0, 2, []], ["not-observed", 0, 2, []], ["not-available", 0, 2, []]]);
  const [rw, ex] = index.missions;
  assert.equal(rw.latest.from, "check");
  assert.equal(rw.latest.implemented, "ci-declared", "no signature: a CLI record reads ci-declared at most");
  assert.equal(rw.latest.origin, "undetermined");
  assert.deepEqual(rw.latest.deliverables.byState.find((g) => g.state === "filled").n, 13);
  assert.equal(rw.verify.verified, true);
  assert.equal(rw.witness.format, "runward-witness/1");
  const series = rw.history.series;
  assert.equal(series.length, 1);
  assert.equal(series[0].origin, "replayed");
  assert.equal(series[0].size, 40);
  assert.deepEqual(series[0].byVerdict.map((g) => [g.state, g.n]), [["clean", 34], ["gaps", 6], ["level-not-met", 0], ["not-observed", 0]]);
  assert.ok(series[0].records.every((r) => r.signatureVerified === false));
  assert.equal(ex.latest.verdict, "clean");
  for (const s of index.sources) assert.match(s.sha256, /^[0-9a-f]{64}$/, `${s.id} carries its digest`);
  assert.deepEqual(rules.checkIndex(index), []);
  assert.ok(!JSON.stringify(index).includes('"mission":'), "the checkout path check --json carries is never projected");
});

test("pure: the same files build the same index and the same page, byte for byte", () => {
  const { manifest, files } = realFleet();
  const a = indexFrom(manifest, files), b = indexFrom(manifest, files);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(pageFor(a), pageFor(b));
  // And the inputs reach the output: a changed export changes the index.
  const changed = indexFrom(manifest, { ...files, "exports/example/check.json": exampleCheck().toString("utf8").replace('"verdict": "clean"', '"verdict": "gaps"') });
  assert.notEqual(JSON.stringify(changed), JSON.stringify(a));
});

test("silence is a finding: a declared export that is absent is shown, counted, and never stops the build", () => {
  const index = indexFrom(manifestOf([missionWith("a"), missionWith("b", { expects: ["check", "history", "signature"] })]), { "exports/a/check.json": realCheck() });
  const silent = index.fleet.byVerdict.find((g) => g.state === "not-observed");
  assert.deepEqual([silent.n, silent.N, silent.list], [1, 2, ["b"]]);
  const b = index.missions.find((m) => m.id === "b");
  assert.equal(b.latest, "not-observed");
  assert.deepEqual(b.findings.map((f) => [f.what, f.why]), [["check", "declared-file-absent"], ["history", "expected-none-declared"], ["signature", "expected-none-declared"]]);
  // Positive control: the same mission, its export present, is not silent.
  const loud = indexFrom(manifestOf([missionWith("a"), missionWith("b")]), { "exports/a/check.json": realCheck(), "exports/b/check.json": realCheck() });
  assert.equal(loud.fleet.byVerdict.find((g) => g.state === "not-observed").n, 0);
});

test("an export that is present and unreadable is a finding, not a crash", () => {
  const index = indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": "{ not json" });
  assert.equal(index.missions[0].latest, "not-observed");
  assert.deepEqual(index.missions[0].findings.map((f) => f.why), ["unreadable"]);
});

test("no private path reaches the page: a projected field that holds one stops the build, and names it", () => {
  const check = JSON.parse(realCheck().toString("utf8"));
  check.currentGate = "all gates passed at /Users/someone/work/app";
  assert.throws(() => indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": check }),
    (e) => e instanceof build.BuildError && /missions\[0\]\.latest\.currentGate/.test(e.message));
  for (const p of ["/private/var/folders/x/T/m", "/home/ci/app", "/tmp/x/y", "C:\\Users\\ci\\app"]) {
    check.currentGate = `at ${p}`;
    assert.throws(() => indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": check }), build.BuildError, p);
  }
  // Positive control: a URL whose path holds /home/ is not a filesystem path, and the field builds.
  check.currentGate = "see https://example.com/home/docs";
  assert.equal(indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": check }).missions[0].latest.currentGate, "see https://example.com/home/docs");
  // fleet.json may not name an absolute file either.
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "/Users/someone/check.json" } } }]), {}), build.BuildError);
});

test("fleet.json is validated: a manifest this version cannot read stops the build", () => {
  assert.throws(() => indexFrom({ format: "runward-fleet-manifest/9", missions: [] }), /format/);
  assert.throws(() => indexFrom(manifestOf([missionWith("a"), missionWith("a")])), /used twice/);
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), repository: "not-a-repo" }])), /repository/);
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), exports: { sbom: { file: "x" } } }])), /not a kind/);
  assert.throws(() => indexFrom(manifestOf([], { lang: "de" })), /lang/);
  assert.equal(indexFrom(manifestOf([])).missions.length, 0, "an empty inventory builds, and says so");
});

test("join keys are stable: mission ids are declared, source ids follow them, never the order", () => {
  const one = indexFrom(manifestOf([missionWith("a")]), { "exports/a/check.json": realCheck() });
  const two = indexFrom(manifestOf([missionWith("z"), missionWith("a")]), { "exports/a/check.json": realCheck(), "exports/z/check.json": realCheck() });
  const a1 = one.sources.find((s) => s.id === "a:check"), a2 = two.sources.find((s) => s.id === "a:check");
  assert.ok(a1 && a2, "the export of mission a keeps the id a:check");
  assert.equal(a1.sha256, a2.sha256);
  assert.equal(two.missions.find((m) => m.id === "a").latest.src, "a:check");
});

test("records of two origins are two series: a replayed record is never mixed with another origin", () => {
  const lines = records().toString("utf8").trim().split("\n");
  const other = JSON.parse(lines[0]);
  other.origin = "undetermined";
  const index = indexFrom(manifestOf([{ ...missionWith("a"), exports: { check: { file: "c.json" }, history: { file: "r.jsonl" } } }]), { "c.json": realCheck(), "r.jsonl": `${lines.join("\n")}\n${JSON.stringify(other)}\n` });
  const series = index.missions[0].history.series;
  assert.deepEqual(series.map((s) => [s.origin, s.size]), [["replayed", 40], ["undetermined", 1]]);
  for (const s of series) assert.ok(s.records.length === s.size);
});

test("the page is one self-contained file: nothing is loaded from elsewhere, and the rule sees a planted load", () => {
  const { manifest, files } = realFleet();
  const html = pageFor(indexFrom(manifest, files));
  assert.deepEqual(rules.checkPage(html), []);
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
  assert.ok(html.includes('id="runward-fleet-index">{"format":"runward-fleet-index/0"'), "the index is inlined");
  for (const plant of ['<script src="https://cdn.example.com/x.js"></script>', '<link rel="stylesheet" href="https://fonts.example.com/a.css">', "<style>body{background:url(https://example.com/a.png)}</style>", '<script type="module">fetch("https://example.com/i.json")</script>', '<img src="https://example.com/p.gif">']) {
    assert.ok(rules.checkPage(html.replace("</body>", `${plant}</body>`)).length > 0, `a planted ${plant.slice(0, 30)}… reddens`);
  }
});

test("the CLI writes index.json and index.html, refuses without writing, and reads no clock", async () => {
  const { main } = await import(pathToFileURL(join(PKG, "src", "cli.js")).href);
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-cli-"));
  try {
    mkdirSync(join(dir, "exports", "a"), { recursive: true });
    writeFileSync(join(dir, "exports", "a", "check.json"), realCheck());
    writeFileSync(join(dir, "fleet.json"), JSON.stringify(manifestOf([missionWith("a")])));
    const log = [];
    const out = { log: (s) => log.push(s), error: (s) => log.push(s) };
    assert.equal(await main(["build", join(dir, "fleet.json"), "--out", join(dir, "site")], out), 0);
    const index = JSON.parse(readFileSync(join(dir, "site", "index.json"), "utf8"));
    assert.equal(index.format, "runward-fleet-index/0");
    assert.ok(readFileSync(join(dir, "site", "index.html"), "utf8").startsWith("<!doctype html>"));
    // Refused: a private path in an export. Nothing is written.
    const bad = JSON.parse(realCheck().toString("utf8"));
    bad.currentGate = "/home/ci/x";
    writeFileSync(join(dir, "exports", "a", "check.json"), JSON.stringify(bad));
    assert.equal(await main(["build", join(dir, "fleet.json"), "--out", join(dir, "site2")], out), 1);
    assert.throws(() => readFileSync(join(dir, "site2", "index.html")), /ENOENT/);
    assert.equal(await main(["nope"], out), 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the build reads no clock, and the scan for one sees a planted one", () => {
  const files = ["src/build.js", "src/trust.js", "src/sigstore.js", "src/der.js", "src/ed25519.js", "src/rules.js", "src/site.js", "src/cli.js", "src/errors.js", "ui/views.js"];
  // A clock read: Date.now, a Date built from nothing, performance.now, process.hrtime. Parsing a
  // date the input carries (Date.parse, Date.UTC, new Date(x)) reads no clock.
  const READS = /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|(?<!new\s)\bDate\s*\(\s*\)|performance\.now|process\.hrtime/;
  for (const f of files) assert.ok(!READS.test(readFileSync(join(PKG, f), "utf8")), `${f} reads a clock`);
  for (const plant of ["const t = Date.now();", "const d = new Date();", "performance.now()", "process.hrtime.bigint()"]) assert.ok(READS.test(plant), plant);
  assert.ok(!READS.test("Date.UTC(2026, 0, 1); new Date(t).toISOString(); Date.parse(s)"));
  void ROOT;
});

test("the specification names every key the index carries: a key added without its line reddens", () => {
  const spec = readFileSync(join(ROOT, "docs", "spec", "runward-fleet-index.md"), "utf8");
  const { manifest, files } = realFleet();
  const index = indexFrom({ ...manifest, missions: [{ ...manifest.missions[0], commitSource: "the upload's workload identity token", signatures: [{ covers: "check", kind: "sigstore-bundle", file: "b.jsonl" }] }, manifest.missions[1]] },
    { ...files, "b.jsonl": fixture("sigstore", "runward-0.46.0.provenance.intoto.jsonl") });
  const m = index.missions[0];
  const keys = new Set([...Object.keys(index), ...Object.keys(index.fleet), ...Object.keys(m), ...Object.keys(m.commit), ...Object.keys(m.latest), ...Object.keys(m.signatures[0]), ...Object.keys(index.sources[0]), ...Object.keys(m.history.series[0]), ...Object.keys(m.history.series[0].records[0])]);
  const missing = [...keys].filter((k) => !new RegExp(`\`${k}\`|\\b${k}\\b`).test(spec));
  assert.deepEqual(missing, [], "docs/spec/runward-fleet-index.md names every key of runward-fleet-index/0");
  assert.ok(new RegExp("\\bnotAKeyOfTheIndex\\b").test(spec) === false, "control: a key the spec does not name is detected as missing");
});

test("commitSource: the inventory may say where its commit was read from; the index carries it as declared, only when declared", () => {
  const SOURCE = "claim sha of the upload's workload identity token";
  const commit = "32d8425b1cb41568eab3ce29dce24f63bad8a32a";
  const index = indexFrom(manifestOf([missionWith("a", { commit, commitSource: SOURCE }), missionWith("b", { commit })]), { "exports/a/check.json": realCheck(), "exports/b/check.json": realCheck() });
  assert.deepEqual(index.missions[0].commit, { value: commit, source: "fleet.json (declared)", commitSource: SOURCE });
  assert.deepEqual(index.missions[1].commit, { value: commit, source: "fleet.json (declared)" }, "without one, the member is absent and the index keeps its bytes");
  assert.deepEqual(rules.checkIndex(index), []);
  // Refused, nothing built: a source with no commit to qualify, a source that is not a short label, a private path.
  assert.throws(() => indexFrom(manifestOf([missionWith("a", { commitSource: SOURCE })])), /commit is absent/);
  for (const bad of [42, "", " ", "x".repeat(201)]) assert.throws(() => indexFrom(manifestOf([missionWith("a", { commit, commitSource: bad })])), /200 characters at most/, JSON.stringify(bad).slice(0, 20));
  assert.throws(() => indexFrom(manifestOf([missionWith("a", { commit, commitSource: "read at /home/ci/work" })])), (e) => e instanceof build.BuildError && /missions\[0\]\.commit\.commitSource/.test(e.message));
  // Positive control: 200 characters is a label.
  assert.equal(indexFrom(manifestOf([missionWith("a", { commit, commitSource: "x".repeat(200) })])).missions[0].commit.commitSource.length, 200);
});

// ADR-0121 decision 1, and its "what would settle it": the same index.json, rendered by the static build
// and by a hosted deployment through runward-fleet/site, gives the same page; the golden files hold the
// index and the page of one inventory, so a change of either is read in a diff before it lands.
// Regenerate with UPDATE_GOLDEN=1 node --test test/unit/fleet-build.test.js, then read the diff.
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "fleet");

test("one interface, two deployments: runward-fleet/site renders, from the index.json the build wrote, the page it wrote; both are golden", async () => {
  // Through the package's exports map, as a hosted deployment imports it: a consumer directory whose
  // node_modules holds the package, and a module of that consumer that imports runward-fleet/site.
  const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
  assert.equal(pkg.exports["./site"], "./src/site.js");
  const dir = mkdtempSync(join(tmpdir(), "rw-fleet-site-"));
  try {
    mkdirSync(join(dir, "node_modules"));
    symlinkSync(PKG, join(dir, "node_modules", "runward-fleet"), "junction");
    writeFileSync(join(dir, "consumer.mjs"), 'export * from "runward-fleet/site";\nexport { buildIndex } from "runward-fleet";\n');
    const hosted = await import(pathToFileURL(join(dir, "consumer.mjs")).href);
    assert.deepEqual(["buildIndex", "renderPage", "renderSite", "siteAssets"].filter((k) => typeof hosted[k] !== "function"), [], "runward-fleet/site exports what a hosted deployment calls");
    const assets = hosted.siteAssets();
    assert.equal(assets.views, readFileSync(join(PKG, "ui", "views.js"), "utf8"), "the views it serves are the package's own file, not a copy");
    assert.equal(assets.template, readFileSync(join(PKG, "ui", "template.html"), "utf8"));
    assert.deepEqual(assets.fonts.map((f) => [f.family, f.weight]), [["Inter", 300], ["Inter", 400], ["Inter", 500], ["Inter", 600], ["Departure Mono", 400]]);

    // The static build writes index.json and index.html; the hosted rendering of those index.json bytes is index.html.
    const { manifest, files } = realFleet();
    for (const [rel, bytes] of Object.entries(files)) { mkdirSync(join(dir, "fleet", rel, ".."), { recursive: true }); writeFileSync(join(dir, "fleet", rel), bytes); }
    writeFileSync(join(dir, "fleet", "fleet.json"), JSON.stringify(manifest));
    const { main } = await import(pathToFileURL(join(PKG, "src", "cli.js")).href);
    assert.equal(await main(["build", join(dir, "fleet", "fleet.json"), "--out", join(dir, "site")], { log: () => {}, error: (e) => assert.fail(e) }), 0);
    const written = readFileSync(join(dir, "site", "index.html"), "utf8");
    assert.equal(hosted.renderPage(JSON.parse(readFileSync(join(dir, "site", "index.json"), "utf8"))), written, "the page rendered from the received index.json is not the page the build wrote");
    // Control: a received index that differs by one value renders another page.
    const other = JSON.parse(readFileSync(join(dir, "site", "index.json"), "utf8"));
    other.title = "another fleet";
    assert.notEqual(hosted.renderPage(other), written);

    // The golden inventory: the real fleet, a mission whose commit names its source, and a silent one.
    const golden = { ...manifest, missions: [{ ...manifest.missions[0], commitSource: "the upload's workload identity token (claim sha)" }, manifest.missions[1], missionWith("silent", { expects: ["check"] })] };
    const index = indexFrom(golden, files);
    const json = `${JSON.stringify(index, null, 2)}\n`;
    const page = `${createHash("sha256").update(hosted.renderPage(index)).digest("hex")}\n`;
    if (process.env.UPDATE_GOLDEN === "1") { mkdirSync(GOLDEN, { recursive: true }); writeFileSync(join(GOLDEN, "index.json"), json); writeFileSync(join(GOLDEN, "page.sha256"), page); }
    for (const f of ["index.json", "page.sha256"]) assert.ok(existsSync(join(GOLDEN, f)), `${f} is missing: run with UPDATE_GOLDEN=1 once, then read the diff`);
    assert.equal(json, readFileSync(join(GOLDEN, "index.json"), "utf8"), "the index moved: regenerate with UPDATE_GOLDEN=1 and read the diff");
    assert.equal(page, readFileSync(join(GOLDEN, "page.sha256"), "utf8"), "the page moved: regenerate with UPDATE_GOLDEN=1 and read the diff");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
