// `runward-fleet build` is a pure function of the files fleet.json declares (ADR-0093 decision 10):
// the same files give the same index and the same page, byte for byte; a declared file that is not
// there is a finding and never a reason to stop; a private path never reaches the page; the page
// loads nothing from elsewhere; and the join keys do not move when the inventory grows. Each with
// its positive control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, exampleCheck, fixture, indexFrom, manifestOf, missionWith, pageFor, PKG, realCheck, ROOT, rules } from "../support/fleet.js";

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
  assert.deepEqual(index.fleet.byVerdict.map((g) => [g.state, g.n, g.N, g.list]), [["clean", 2, 2, ["runward", "example"]], ["gaps", 0, 2, []], ["not-observed", 0, 2, []]]);
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
  assert.deepEqual(series[0].byVerdict.map((g) => [g.state, g.n]), [["clean", 34], ["gaps", 6], ["not-observed", 0]]);
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
  const index = indexFrom({ ...manifest, missions: [{ ...manifest.missions[0], signatures: [{ covers: "check", kind: "sigstore-bundle", file: "b.jsonl" }] }, manifest.missions[1]] },
    { ...files, "b.jsonl": fixture("sigstore", "runward-0.46.0.provenance.intoto.jsonl") });
  const m = index.missions[0];
  const keys = new Set([...Object.keys(index), ...Object.keys(index.fleet), ...Object.keys(m), ...Object.keys(m.latest), ...Object.keys(m.signatures[0]), ...Object.keys(index.sources[0]), ...Object.keys(m.history.series[0]), ...Object.keys(m.history.series[0].records[0])]);
  const missing = [...keys].filter((k) => !new RegExp(`\`${k}\`|\\b${k}\\b`).test(spec));
  assert.deepEqual(missing, [], "docs/spec/runward-fleet-index.md names every key of runward-fleet-index/0");
  assert.ok(new RegExp("\\bnotAKeyOfTheIndex\\b").test(spec) === false, "control: a key the spec does not name is detected as missing");
});
