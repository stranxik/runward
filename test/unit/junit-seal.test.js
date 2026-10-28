// ADR-0102 D and E: a cited JUnit report is read whole before it is sealed (RWD-2026-0182).
//
// An adopter's report, 2026-10-23: the gate judges a JUnit report by the cases its pointers cite
// (ADR-0056), so `check --strict --freeze` sealed a report holding a `<failure>` on a case no
// pointer cited (a flaky test). The next CI run regenerated the report without that failure, the
// seal drifted, and the gate reddened for a defect unrelated to the change.
//
// D: `--freeze` refuses to seal while a cited report records failures or errors at its root.
// E: every `check` prints an advisory when a cited report is red outside the cited cases, and its
// verdict and exit code do not move. Each refusal is paired with the acceptance that forbids a guard
// refusing everything from passing: an all-green report seals, a skipped uncited case seals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { junitRootFailures, junitProjection, JUNIT_PROJECTION_KIND } from "../../dist/lib/tool-adapters.js";
import { citedJUnitNotGreen, sealHash, normalizedFileSha256, verifyEvidenceLock } from "../../dist/lib/evidence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

// ── The reading: junitRootFailures ─────────────────────────────────────────────────────────────

test("junitRootFailures counts failure and error elements, and not skipped ones", () => {
  const green = `<testsuites><testsuite name="s" tests="2"><testcase name="a"/><testcase name="b"></testcase></testsuite></testsuites>`;
  assert.equal(junitRootFailures(green), 0, "an all-green report records nothing");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><skipped/></testcase></testsuite>`), 0,
    "a skipped case is not a failure for the seal");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><failure message="x"/></testcase><testcase name="b"><error type="E">t</error></testcase></testsuite>`), 2);
  assert.equal(junitRootFailures(`<testsuite errors="0" failures="0"><testcase name="a"><failure/></testcase></testsuite>`), 1,
    "an element counts even when the declared counts say zero");
});

test("junitRootFailures reads the declared counts, and ignores what comments and CDATA quote", () => {
  assert.equal(junitRootFailures(`<testsuites failures="3" errors="1"><testsuite name="s"><testcase name="a"/></testsuite></testsuites>`), 4,
    "the root's declared failures and errors count without an element");
  assert.equal(junitRootFailures(`<testsuite failures="2"><testcase name="a"/></testsuite>`), 2, "a suite's declared count too");
  assert.equal(junitRootFailures(`<testsuites failures="0" errors="0"><testsuite failures="0" errors="0" skipped="3"><testcase name="a"/></testsuite></testsuites>`), 0,
    "zero declared and skipped declared: green");
  assert.equal(junitRootFailures(`<testsuite><testcase name="a"><system-out><![CDATA[expected <failure> here]]></system-out></testcase><!-- <error> --></testsuite>`), 0,
    "a console capture or a comment quoting the tag is not a failure");
});

// ── The ledger: citedJUnitNotGreen ─────────────────────────────────────────────────────────────

function fixture(report, evidence = 'test:reports/junit.xml::"cited case"') {
  const root = mkdtempSync(join(tmpdir(), "rw-junit-seal-"));
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "reports", "junit.xml"), report);
  writeFileSync(join(mission, "floor.md"),
    `# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| r1 | applied | ${evidence} |\n`);
  return { root, mission };
}
const suite = (...cases) => `<testsuites><testsuite name="s">${cases.join("")}</testsuite></testsuites>\n`;

test("the ledger names a cited report red outside its cited cases, and nothing on a green one", () => {
  const red = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="flaky"><failure/></testcase>`));
  const green = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="other"/>`));
  const skipped = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="later"><skipped/></testcase>`));
  try {
    assert.deepEqual(citedJUnitNotGreen(red.mission), [{
      report: "reports/junit.xml", failures: 1, citedCasesGreen: true, pointers: ['test:reports/junit.xml::"cited case"'],
    }]);
    assert.deepEqual(citedJUnitNotGreen(green.mission), [], "an all-green report is not listed");
    assert.deepEqual(citedJUnitNotGreen(skipped.mission), [], "a skipped uncited case is not listed");
  } finally { for (const f of [red, green, skipped]) rmSync(f.root, { recursive: true, force: true }); }
});

test("the ledger says when the cited case is itself red, and reads only test: pointers of applied rows", () => {
  const citedRed = fixture(suite(`<testcase name="cited case"><error/></testcase>`));
  const fileOnly = fixture(suite(`<testcase name="cited case"/>`, `<testcase name="flaky"><failure/></testcase>`), "file:reports/junit.xml");
  try {
    const [entry] = citedJUnitNotGreen(citedRed.mission);
    assert.equal(entry.citedCasesGreen, false, "the gate already refuses this row; the advisory sentence would be false");
    assert.equal(entry.failures, 1);
    assert.deepEqual(citedJUnitNotGreen(fileOnly.mission), [], "a report cited by file: is not read as a test result");
  } finally { for (const f of [citedRed, fileOnly]) rmSync(f.root, { recursive: true, force: true }); }
});

// ── End to end on `init --example`, whose floor cites code/reports/junit.xml ───────────────────

const UNCITED = '<testcase name="input boundary: a malformed payload is rejected, unknown keys included" classname="test"/>';
const withChild = (child) => `<testcase name="input boundary: a malformed payload is rejected, unknown keys included" classname="test">${child}</testcase>`;

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-junit-seal-ex-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  const report = join(dir, "code", "reports", "junit.xml");
  const original = readFileSync(report, "utf8");
  assert.ok(original.includes(UNCITED), "the example's report carries the uncited case this test edits");
  return { dir, report, original, lock: join(dir, "runward", "evidence-lock.json") };
}

test("end to end: an uncited failure is advised on every check, verdict and exit unchanged, and refused at --freeze", () => {
  const ex = example();
  try {
    // Positive control: the example seals as shipped, and prints no advisory.
    const sealed = check(ex.dir, "--freeze");
    assert.equal(sealed.status, 0, sealed.stdout);
    assert.match(sealed.stdout, /sealed \d+ evidence file\(s\)/);
    assert.doesNotMatch(sealed.stdout, /Cited test reports|not green, even though/);
    const sealedLock = readFileSync(ex.lock, "utf8");
    rmSync(ex.lock);

    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild('<failure message="flaky">timeout</failure>')));
    // E: advisory on the strict and on the lenient run; the exit code and the verdict do not move.
    for (const flags of [["--strict"], []]) {
      const r = check(ex.dir, ...flags);
      assert.equal(r.status, 0, `${flags.join(" ") || "check"}: an advisory never changes the exit code`);
      assert.match(r.stdout, /advisory code\/reports\/junit\.xml — the report is not green, even though the cited cases are: it records 1 failure\(s\) or error\(s\) outside the cases cited \(ADR-0102\)/);
    }
    const json = JSON.parse(check(ex.dir, "--strict", "--json").stdout);
    assert.equal(json.verdict, "clean");
    assert.equal(json.exitCode, 0);
    assert.deepEqual(json.junitNotGreen.map((j) => [j.report, j.failures, j.citedCasesGreen]), [["code/reports/junit.xml", 1, true]]);

    // D: the seal is refused, the report and the count are named, nothing is written.
    const refused = check(ex.dir, "--freeze");
    assert.equal(refused.status, 1, "a refused seal exits 1, as for a red gate");
    assert.match(refused.stdout, /refusing to seal: 1 JUnit report\(s\) cited by a `test:` pointer record failures or errors — a seal certifies a crossing; a report that says tests failed is not one \(ADR-0102\)\. Nothing was written\./);
    assert.match(refused.stdout, /✗ code\/reports\/junit\.xml — 1 failure\(s\) or error\(s\) at its root, even though the cited cases are green/);
    assert.equal(existsSync(ex.lock), false, "no lock was written");

    // An existing seal is not overwritten by a refused freeze either.
    writeFileSync(ex.lock, sealedLock);
    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild('<error message="boom"/>')));
    assert.equal(check(ex.dir, "--freeze").status, 1);
    assert.equal(readFileSync(ex.lock, "utf8"), sealedLock, "the previous seal keeps its bytes");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("end to end: a skipped uncited case neither advises nor blocks the seal", () => {
  const ex = example();
  try {
    writeFileSync(ex.report, ex.original.replace(UNCITED, withChild("<skipped/>")));
    const r = check(ex.dir, "--freeze");
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /sealed \d+ evidence file\(s\)/);
    assert.doesNotMatch(r.stdout, /Cited test reports|refusing to seal/);
    assert.equal(JSON.parse(check(ex.dir, "--strict", "--json").stdout).junitNotGreen, undefined,
      "the key is absent when nothing is listed: every other payload keeps its bytes");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("junitRootFailures strips comments and CDATA until stable: a crafted nest does not leave a marker behind", () => {
  // One replace pass turned `<!<!---->--` into `<!--`, so a comment survived (CodeQL, PR #433).
  const nested = `<testsuites><testsuite name="s" tests="1"><testcase name="a"/></testsuite><!<!---->-- <failure message="x"/> --></testsuites>`;
  assert.equal(junitRootFailures(nested), 0, "the failure sits inside what is, after stripping, a comment");
  const real = `<testsuites><testsuite name="s" tests="1" failures="1"><testcase name="a"><failure message="x"/></testcase></testsuite></testsuites>`;
  assert.equal(junitRootFailures(real), 1, "a real failure is still counted");
  const cdata = `<testsuites><testsuite name="s" tests="1"><testcase name="a"><system-out><![CDATA[log: <failure> quoted]]></system-out></testcase></testsuite></testsuites>`;
  assert.equal(junitRootFailures(cdata), 0, "a console capture quoting <failure> is not one");
});

// ── ADR-0102 B (decided 2026-10-28): the seal hashes a JUnit report by what the gate reads of it ──
//
// RWD-2026-0181: a sealed report drifted on every test run (time, timestamp, hostname, console
// output, suite order) with no code changed. The seal now hashes a canonical projection of a report
// the JUnit detector recognises: its suites and cases, each case's identity and verdict, and the root
// failures/errors count. Every test below that says "the seal holds" is paired with one that says
// "the seal breaks", so a projection that ignored everything could not pass.

const RUN_A = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="vitest" tests="3" failures="0" errors="0" time="1.234" timestamp="2026-10-28T09:00:00Z">
  <testsuite name="alpha" tests="2" time="0.5" hostname="ci-runner-1" timestamp="2026-10-28T09:00:00Z" file="/home/a/alpha.test.ts">
    <properties><property name="seed" value="1"/></properties>
    <testcase classname="alpha" name="adds" time="0.1" file="/home/a/alpha.test.ts" line="3"/>
    <testcase classname="alpha" name="later" time="0.0"><skipped/></testcase>
    <system-out><![CDATA[run 1 log]]></system-out>
  </testsuite>
  <testsuite name="beta" tests="1" time="0.7" hostname="ci-runner-1">
    <testcase classname="beta" name="subtracts" time="0.2"><system-err>warn 1</system-err></testcase>
  </testsuite>
  <!-- duration_ms 1234 -->
</testsuites>
`;
// The same suite run again: other timings, host, console output, comments, attribute order, white
// space, and the suites in the other order.
const RUN_B = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites timestamp="2026-10-29T17:42:11Z" time="9.876" errors="0" failures="0" tests="3" name="vitest"><testsuite hostname="ci-runner-7" time="3.1" tests="1" name="beta"><testcase time="1.9" name="subtracts" classname="beta"><system-err>another warning</system-err><system-out>more</system-out></testcase></testsuite>
<testsuite timestamp="2026-10-29T17:42:11Z" hostname="ci-runner-7" time="2.2" tests="2" name="alpha"><properties><property name="seed" value="99"/></properties>
<testcase line="4" time="0.9" name="adds" classname="alpha" file="/tmp/x/alpha.test.ts"></testcase>
<testcase name="later" classname="alpha" time="0.0"><skipped message="todo"/></testcase>
<system-out>run 2 log, with &lt;failure&gt; quoted</system-out></testsuite><!-- duration_ms 9876 --></testsuites>
`;

const hashOf = (lines) => lines === null ? null : lines.join("\n");

test("junitProjection: two runs of one suite differing only in volatile parts project alike", () => {
  const a = junitProjection(RUN_A), b = junitProjection(RUN_B);
  assert.ok(a !== null && b !== null, "both runs parse whole");
  assert.equal(hashOf(a), hashOf(b), "time, timestamp, hostname, file, line, properties, console output, comments, attribute order, white space and suite order are out");
  assert.deepEqual(a, [
    `{"projection":"${JUNIT_PROJECTION_KIND}","rootFailuresAndErrors":0}`,
    '["case",["alpha"],"alpha","adds","passed"]',
    '["case",["alpha"],"alpha","later","skipped"]',
    '["case",["beta"],"beta","subtracts","passed"]',
    '["suite",["alpha"]]',
    '["suite",["beta"]]',
  ], "the projection's exact lines, as docs/spec/runward-oscal-mapping.md §6 states them");
});

test("junitProjection: a changed verdict, a renamed, removed or added case moves the projection", () => {
  const base = hashOf(junitProjection(RUN_A));
  const variants = {
    "a passing case becomes skipped": RUN_A.replace('name="adds" time="0.1" file="/home/a/alpha.test.ts" line="3"/>', 'name="adds"><skipped/></testcase>'),
    "a skipped case becomes passing": RUN_A.replace("<testcase classname=\"alpha\" name=\"later\" time=\"0.0\"><skipped/></testcase>", '<testcase classname="alpha" name="later"/>'),
    "a case fails": RUN_A.replace('<testcase classname="beta" name="subtracts" time="0.2">', '<testcase classname="beta" name="subtracts" time="0.2"><failure message="x"/>'),
    "a case is renamed": RUN_A.replace('name="adds"', 'name="adds two"'),
    "a case changes class": RUN_A.replace('classname="alpha" name="adds"', 'classname="gamma" name="adds"'),
    "a case is removed": RUN_A.replace(/\s*<testcase classname="beta"[^]*?<\/testcase>/, ""),
    "a case is added": RUN_A.replace("</testsuite>\n  <!--", '<testcase classname="beta" name="multiplies"/></testsuite>\n  <!--'),
    "a suite is renamed": RUN_A.replace('<testsuite name="beta"', '<testsuite name="delta"'),
  };
  for (const [what, xml] of Object.entries(variants)) {
    assert.notEqual(xml, RUN_A, `${what}: the variant is a variant`);
    const p = junitProjection(xml);
    assert.ok(p !== null, `${what}: still parses`);
    assert.notEqual(hashOf(p), base, `${what}: the projection must move`);
  }
});

test("junitProjection: homonyms are kept and ordered by verdict, so one homonym's verdict still counts", () => {
  const two = (v1, v2) => `<testsuite name="s"><testcase name="same" classname="c">${v1}</testcase><testcase name="same" classname="c">${v2}</testcase></testsuite>`;
  const p = junitProjection(two("", "<skipped/>"));
  assert.equal(p.filter((l) => l.startsWith('["case"')).length, 2, "two homonyms are two lines");
  assert.equal(hashOf(p), hashOf(junitProjection(two("<skipped/>", ""))), "their document order does not matter");
  assert.notEqual(hashOf(p), hashOf(junitProjection(two("", ""))), "one homonym's verdict changing moves the projection");
  assert.notEqual(hashOf(junitProjection(two("", ""))), hashOf(junitProjection('<testsuite name="s"><testcase name="same" classname="c"/></testsuite>')),
    "removing one of two identical homonyms moves the projection");
});

test("junitProjection: refuses what it cannot read whole, and nested suites keep their path", () => {
  for (const [what, xml] of [
    ["an unclosed element", '<testsuites><testsuite name="s"><testcase name="a"/></testsuites>'],
    ["text after the root", '<testsuite name="s"><testcase name="a"/></testsuite>\ntrailing'],
    ["two roots", '<testsuite name="s"/><testsuite name="t"/>'],
    ["a duplicated attribute", '<testsuite name="s"><testcase name="a" name="b"/></testsuite>'],
    ["a root that is not a suite", '<report><testcase name="a"/></report>'],
    ["a case inside a case", '<testsuite name="s"><testcase name="a"><testcase name="b"/></testcase></testsuite>'],
    ["a DOCTYPE with an internal subset", '<!DOCTYPE x [<!ENTITY e "y">]><testsuite name="s"/>'],
    ["a test source quoting a report", 'const xml = `<testsuite name="s"><testcase name="a"/></testsuite>`;\n'],
  ]) assert.equal(junitProjection(xml), null, what);
  const nested = junitProjection('<testsuites><testsuite name="outer"><testsuite name="inner"><testcase name="a" classname="k"/></testsuite></testsuite></testsuites>');
  assert.ok(nested.includes('["case",["outer","inner"],"k","a","passed"]'));
  assert.ok(nested.includes('["suite",["outer","inner"]]') && nested.includes('["suite",["outer"]]'));
});

test("sealHash: a report is hashed by projection, an unreadable report by bytes and said, any other file by bytes silently", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-junit-proj-"));
  try {
    const put = (name, text) => { const f = join(dir, name); writeFileSync(f, text); return f; };
    const a = sealHash(put("a.xml", RUN_A)), b = sealHash(put("b.xml", RUN_B));
    assert.equal(a.kind, JUNIT_PROJECTION_KIND);
    assert.equal(a.hash, b.hash, "two runs, one seal");
    assert.equal(a.bytesBecause, undefined);
    const broken = put("c.xml", RUN_A + "garbage after the root\n");
    const c = sealHash(broken);
    assert.equal(c.kind, "bytes", "never a projection of a file the reader did not understand");
    assert.equal(c.hash, normalizedFileSha256(broken));
    assert.match(c.bytesBecause, /reads as a JUnit report but does not parse whole as one/);
    const src = sealHash(put("t.test.js", 'const xml = "<testsuite><testcase name=\\"a\\"/></testsuite>";\n'));
    assert.deepEqual([src.kind, src.bytesBecause], ["bytes", undefined], "a test source that quotes a report is a source, sealed by bytes, nothing to say");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// End to end on `init --example`: its floor cites code/reports/junit.xml by case name.
let tick = 0;
const t = () => ((++tick * 0.137) % 3).toFixed(3);
const caseLines = (xml) => [...xml.matchAll(/<testcase\b[^>]*\/>/g)].map((m) => m[0]);
/** The example's 14 cases in two suites, written as a runner writes them on one run. */
function regenerate(original, { order = ["first", "second"], host = "ci-1", stamp = "2026-10-28T09:00:00Z", out = "log" } = {}) {
  const cases = caseLines(original);
  const half = { first: cases.slice(0, 7), second: cases.slice(7) };
  const suite = (n) => `  <testsuite name="${n}" tests="${half[n].length}" failures="0" errors="0" time="${t()}" hostname="${host}" timestamp="${stamp}">\n`
    + half[n].map((c) => `    ${c.replace("/>", ` time="${t()}"/>`)}\n`).join("")
    + `    <system-out><![CDATA[${out} ${n}]]></system-out>\n  </testsuite>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="14" failures="0" errors="0" time="${t()}">\n${order.map(suite).join("")}</testsuites>\n`;
}
const sealViolations = (dir) => ({ exitCode: check(dir, "--strict").status, seal: verifyEvidenceLock(join(dir, "runward")) });

test("end to end: a sealed report regenerated by another run keeps the seal; a changed verdict breaks it", () => {
  const ex = example();
  try {
    writeFileSync(ex.report, regenerate(ex.original));
    const sealed = check(ex.dir, "--freeze");
    assert.equal(sealed.status, 0, sealed.stdout);
    assert.match(sealed.stdout, /1 JUnit report\(s\) sealed by their cases and verdicts \(junit-projection-v1\)/);
    const lock = JSON.parse(readFileSync(ex.lock, "utf8"));
    assert.deepEqual(lock.hashKinds, { "code/reports/junit.xml": JUNIT_PROJECTION_KIND }, "the lock records the kind of the one projected entry, and only that one");

    // Another run: other timings, host, timestamps, console output, and the suites swapped.
    const rerun = regenerate(ex.original, { order: ["second", "first"], host: "ci-9", stamp: "2026-10-29T18:00:00Z", out: "other" });
    writeFileSync(ex.report, rerun);
    const green = check(ex.dir, "--strict");
    assert.equal(green.status, 0, green.stdout);
    assert.match(green.stdout, /seal intact/);

    // Positive controls: each of these changes what the gate reads, and each breaks the seal.
    const target = '<testcase name="input boundary: a malformed payload is rejected, unknown keys included" classname="test"';
    const cited = '<testcase name="support request: classified and routed to the support queue" classname="test"';
    assert.ok(rerun.includes(target) && rerun.includes(cited));
    const changes = {
      "an uncited passing case becomes skipped": rerun.replace(new RegExp(`${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( time="[^"]*")/>`), `${target}$1><skipped/></testcase>`),
      "an uncited case is renamed": rerun.replace(target, target.replace("input boundary", "input edge")),
      "an uncited case is removed": rerun.replace(new RegExp(`\\s*${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*/>`), ""),
      "a case is added": rerun.replace("</testsuite>", '<testcase name="a new case" classname="test"/></testsuite>'),
    };
    for (const [what, xml] of Object.entries(changes)) {
      assert.notEqual(xml, rerun, `${what}: the variant is a variant`);
      writeFileSync(ex.report, xml);
      const j = sealViolations(ex.dir);
      assert.equal(j.exitCode, 1, `${what}: the seal must break`);
      assert.ok(j.seal.violations.some((v) => /sealed evidence changed: code\/reports\/junit\.xml — its JUnit cases or verdicts changed since the seal/.test(v.problem)), `${what}: ${JSON.stringify(j.seal.violations)}`);
    }
    writeFileSync(ex.report, rerun);
    assert.equal(check(ex.dir, "--strict").status, 0, "restored: green again");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("end to end: a lock written before this release (no hashKinds) is still verified by bytes, drifts, and a re-freeze migrates it", () => {
  const ex = example();
  try {
    writeFileSync(ex.report, regenerate(ex.original));
    assert.equal(check(ex.dir, "--freeze").status, 0);
    // The lock an older runward wrote: every entry a bytes entry.
    const lock = JSON.parse(readFileSync(ex.lock, "utf8"));
    delete lock.hashKinds;
    lock.files["code/reports/junit.xml"] = normalizedFileSha256(ex.report);
    writeFileSync(ex.lock, JSON.stringify(lock, null, 2) + "\n");
    assert.equal(check(ex.dir, "--strict").status, 0, "an untouched report verifies by bytes: the dual read");

    writeFileSync(ex.report, regenerate(ex.original, { host: "ci-9" }));
    const drift = sealViolations(ex.dir);
    assert.equal(drift.exitCode, 1, "a bytes entry drifts with the timings, as before");
    assert.match(drift.seal.violations.map((v) => v.problem).join("\n"), /sealed evidence changed: code\/reports\/junit\.xml — .*sealed by its bytes.*a re-seal hashes it by its cases and verdicts, ADR-0102/);

    assert.equal(check(ex.dir, "--freeze").status, 0, "re-freeze");
    assert.deepEqual(JSON.parse(readFileSync(ex.lock, "utf8")).hashKinds, { "code/reports/junit.xml": JUNIT_PROJECTION_KIND }, "the re-freeze writes the new kind");
    writeFileSync(ex.report, regenerate(ex.original, { host: "ci-10", out: "third run" }));
    assert.equal(check(ex.dir, "--strict").status, 0, "migrated: the next run keeps the seal");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("end to end: a report that does not parse whole is sealed by its bytes, and the freeze says so", () => {
  const ex = example();
  try {
    // Still a report the gate reads (its cases resolve by name), not one the projection reads whole.
    writeFileSync(ex.report, ex.original.replace("</testsuites>", "</testsuites>\ntrailing text a strict reader refuses"));
    const sealed = check(ex.dir, "--freeze");
    assert.equal(sealed.status, 0, sealed.stdout);
    assert.match(sealed.stdout, /note code\/reports\/junit\.xml — it reads as a JUnit report but does not parse whole as one, so it is sealed by its bytes and its timings will drift the seal \(ADR-0102\)/);
    assert.doesNotMatch(sealed.stdout, /sealed by their cases and verdicts/);
    assert.equal(JSON.parse(readFileSync(ex.lock, "utf8")).hashKinds, undefined, "a lock with no projected entry keeps the shape it always had");
    writeFileSync(ex.report, readFileSync(ex.report, "utf8").replace('classname="test"/>', 'classname="test" time="0.1"/>'));
    assert.equal(check(ex.dir, "--strict").status, 1, "bytes: a timing change drifts, never a silent green");
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});

test("verifyEvidenceLock: an unknown hash kind, or a kind for a path the lock does not seal, is refused", () => {
  const ex = example();
  try {
    assert.equal(check(ex.dir, "--freeze").status, 0);
    const lock = JSON.parse(readFileSync(ex.lock, "utf8"));
    const write = (kinds) => writeFileSync(ex.lock, JSON.stringify({ ...lock, hashKinds: kinds }, null, 2) + "\n");
    const mission = join(ex.dir, "runward");
    write({ "code/reports/junit.xml": "junit-projection-v9" });
    assert.match(verifyEvidenceLock(mission).violations.map((v) => v.problem).join("\n"), /records the hash kind "junit-projection-v9" for code\/reports\/junit\.xml, which this runward does not know/);
    write({ ...lock.hashKinds, "code/elsewhere.xml": JUNIT_PROJECTION_KIND });
    assert.match(verifyEvidenceLock(mission).violations.map((v) => v.problem).join("\n"), /records a hash kind for code\/elsewhere\.xml, which it does not seal/);
    write(["not", "an", "object"]);
    assert.match(verifyEvidenceLock(mission).violations.map((v) => v.problem).join("\n"), /`hashKinds` that is not an object/);
    // Positive control: the lock as written verifies clean, and so does the explicit bytes kind.
    write(lock.hashKinds);
    assert.deepEqual(verifyEvidenceLock(mission).violations, []);
    write({ ...lock.hashKinds, "runward/floor.md": "bytes" });
    assert.deepEqual(verifyEvidenceLock(mission).violations, [], "an explicit bytes kind is a bytes entry");
    // A projection entry over a file that no longer reads as a report breaks the seal.
    write(lock.hashKinds);
    writeFileSync(ex.report, "not a report any more\n");
    assert.match(verifyEvidenceLock(mission).violations.map((v) => v.problem).join("\n"), /sealed as a JUnit report's cases and verdicts \(ADR-0102\) and no longer parses as one/);
  } finally { rmSync(ex.dir, { recursive: true, force: true }); }
});
