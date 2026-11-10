// runward-integrations' normalisers (runward ADR-0122 decision 1, as ADR-0073 option 1 makes a report
// committable): no absolute path, no timing, every verdict and count kept, idempotent. Held here on
// planted reports carrying what a machine writes into them (a checkout path in each spelling a tool may
// print it, the timings, the host), on the shipped example's committed reports (which they must leave as
// they are), and against runward-run's normaliser, which a recipe's command meets when it runs as a leg
// of a run policy (ADR-0122 decision 5): the two must agree on what the gate reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, runModule } from "../support/run-lab.js";

const N = await import(pathToFileURL(join(ROOT, "packages", "runward-integrations", "src", "normalize.js")).href);
const REPORTS = join(ROOT, "examples", "request-triage", "code", "reports");
const committed = (f) => readFileSync(join(REPORTS, f), "utf8");
const W = "/home/runner/work/app/app/code";
const REAL = "/private/var/folders/xy/T/app/code";
const WIN = "C:\\actions-runner\\_work\\app\\code";
const ABS = /\/(home|Users|private|var|tmp)\/|[A-Za-z]:\\\\|file:\/\//;

const JUNIT_RAW = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
	<testsuite name="guard" time="0.012" timestamp="2026-11-06T10:00:00.000Z" hostname="runner-7">
		<testcase name="green case" classname="test" time="0.003" file="${W}/test/a.test.ts"/>
		<testcase name="red case" classname="test" time="0.004" file="${W}/test/a.test.ts">
			<failure type="testCodeFailure" message="expected 1">
AssertionError: expected 1
    at TestContext.&lt;anonymous> (${W}/test/a.test.ts:8:10)
    at file://${W}/node_modules/tsx/dist/x.mjs:1:1
		</failure>
		</testcase>
		<testcase name="skipped case" classname="test" time="0"><skipped type="skipped"/></testcase>
	</testsuite>
	<!-- tests 3 -->
	<!-- fail 1 -->
	<!-- duration_ms 15.2 -->
</testsuites>
`;

test("JUnit: the machine goes, every verdict, message and count stays, and a second pass changes nothing", () => {
  const out = N.normalizeJUnit(JUNIT_RAW, [W]);
  assert.doesNotMatch(out, ABS, "no absolute path, in an attribute or in a failure's stack");
  assert.doesNotMatch(out, /\btime=|timestamp=|hostname=|duration_ms/, "no timing, no host");
  assert.match(out, /<failure type="testCodeFailure" message="expected 1">/, "the failure is kept as written");
  assert.match(out, /\(test\/a\.test\.ts:8:10\)/, "the stack names the test file relative to the working directory");
  assert.match(out, /node_modules\/tsx\/dist\/x\.mjs:1:1/, "a file:// URL under the root is relative too");
  assert.match(out, /<skipped type="skipped"\/>/);
  assert.match(out, /<!-- tests 3 -->/, "the counts the reporter writes are kept");
  assert.deepEqual(N.junitCensus(out), { cases: 3, notGreen: 2 });
  assert.equal(N.normalizeJUnit(out, [W]), out, "idempotent");
});

test("JUnit: the shipped example's committed report goes through unchanged", () => {
  const text = committed("junit.xml");
  assert.equal(N.normalizeJUnit(text, [W]), text);
  assert.equal(N.junitCensus(text).notGreen, 0);
});

test("the roots are matched in every spelling, longest first, never inside a longer name", () => {
  const r = N.relativizer(["/var/folders/xy/T/app/code", REAL]);
  assert.equal(r.text(`at ${REAL}/test/a.ts:1`), "at test/a.ts:1", "the realpath spelling (/private/var… on macOS) is not cut at /var");
  assert.equal(r.text(`cwd ${REAL}`), "cwd .", "a bare root is the working directory");
  assert.equal(r.text(`${REAL}2/x`), `${REAL}2/x`, "a sibling directory sharing the prefix is not rewritten");
  const w = N.relativizer([WIN]);
  assert.equal(w.text(`at ${WIN}\\test\\a.ts:1`), "at test\\a.ts:1");
  assert.equal(w.path(`${WIN}\\src\\core\\guard.ts`), "src/core/guard.ts", "a path value becomes /-separated");
  assert.equal(w.text("file:///C:/actions-runner/_work/app/code/src/x.ts"), "src/x.ts");
  assert.equal(N.relativizer(["/"]).text("/etc/x"), "/etc/x", "the filesystem root is never a root: everything is under it");
});

test("LCOV: each SF: record relative and /-separated, every count kept, idempotent; an empty tracefile is one", () => {
  const raw = `TN:\nSF:${W}/src/core/guard.ts\nDA:1,3\nLH:1\nLF:1\nend_of_record\nTN:\nSF:${WIN}\\src\\adapters\\x.ts\nDA:1,0\nLH:0\nLF:1\nend_of_record\n`;
  const out = N.normalizeLcov(raw, [W, WIN]);
  assert.match(out, /^SF:src\/core\/guard\.ts$/m);
  assert.match(out, /^SF:src\/adapters\/x\.ts$/m);
  assert.match(out, /^DA:1,3$/m);
  assert.match(out, /^DA:1,0$/m, "a file nothing executed stays a file nothing executed");
  assert.doesNotMatch(out, ABS);
  assert.deepEqual(N.lcovCensus(out), { files: 2, executed: 1 });
  assert.equal(N.normalizeLcov(out, [W]), out);
  const text = committed("lcov.info");
  assert.equal(N.normalizeLcov(text, [W]), text, "the shipped example's committed report goes through unchanged");
  assert.equal(N.normalizeLcov("", [W]), "", "nothing measured is written as nothing measured");
  assert.equal(N.lcovCensus("").files, 0);
});

test("SARIF: timings and the invoking machine go, every rule and result stays, every uri relative, idempotent", () => {
  const raw = JSON.stringify({
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "a-scanner", rules: [{ id: "rule-a" }, { id: "rule-b" }] } },
      invocations: [{ executionSuccessful: true, startTimeUtc: "2026-11-06T10:00:00Z", endTimeUtc: "2026-11-06T10:00:09Z", machine: "runner-7", account: "runner", processId: 4242,
        environmentVariables: { HOME: "/home/runner" }, commandLine: `scanner --root ${W}`, workingDirectory: { uri: `file://${W}` } }],
      results: [{ ruleId: "rule-a", level: "error", message: { text: `found in ${W}/src/x.ts` },
        locations: [{ physicalLocation: { artifactLocation: { uri: `file://${W}/src/x.ts` }, region: { startLine: 3 } } }] }],
    }],
  });
  const out = N.normalizeSarif(raw, [W]);
  const doc = JSON.parse(out);
  const inv = doc.runs[0].invocations[0];
  assert.deepEqual(Object.keys(inv).sort(), ["commandLine", "executionSuccessful", "workingDirectory"]);
  assert.equal(inv.commandLine, "scanner --root .");
  assert.equal(inv.workingDirectory.uri, ".");
  assert.equal(doc.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "src/x.ts");
  assert.equal(doc.runs[0].results[0].message.text, "found in src/x.ts");
  assert.deepEqual(doc.runs[0].tool.driver.rules.map((r) => r.id), ["rule-a", "rule-b"]);
  assert.equal(doc.runs[0].results[0].level, "error", "a finding keeps its level");
  assert.doesNotMatch(out, ABS);
  assert.deepEqual(N.sarifCensus(out), { rules: 2, results: 1 });
  assert.equal(N.normalizeSarif(out, [W]), out);
  const text = committed("eslint.sarif");
  assert.equal(N.normalizeSarif(text, [W]), text, "the shipped example's committed log goes through unchanged");
});

test("a report that is not the document its format names is refused, never written under its name", () => {
  assert.throws(() => N.normalizeJUnit("<html></html>", [W]), /not a JUnit XML report/);
  assert.throws(() => N.normalizeSarif("{}", [W]), /not a SARIF 2\.1\.0 log/);
  assert.throws(() => N.normalizeSarif("not json", [W]), /not JSON/);
  assert.throws(() => N.normalizeLcov("<testsuites/>", [W]), /not an LCOV tracefile/);
  assert.ok(N.isJUnit("<testsuite/>") && !N.isJUnit("{}"));
  assert.ok(N.isSarif('{"version":"2.1.0","runs":[]}') && !N.isSarif('{"version":"2.0.0","runs":[]}'));
});

test("ADR-0122 decision 5: on a run's container paths, the recipe's normaliser and runward-run's agree on every byte", async () => {
  const { normalizeReport } = await runModule("normalize.js");
  const base = "/runward-run/work/code";
  const work = "/runward-run/work";
  const junit = JUNIT_RAW.replaceAll(W, base);
  assert.equal(N.normalizeJUnit(junit, [base, work]), normalizeReport("junit", junit, { base, work }), "JUnit");
  const lcov = `TN:\nSF:${base}/src/core/guard.ts\nDA:1,3\nLH:1\nLF:1\nend_of_record\n`;
  assert.equal(N.normalizeLcov(lcov, [base, work]), normalizeReport("coverage", lcov, { base, work }), "LCOV");
  const sarif = JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "ESLint", rules: [{ id: "no-eval" }] } },
    results: [{ ruleId: "no-eval", level: "error", message: { text: "eval" }, locations: [{ physicalLocation: { artifactLocation: { uri: `${base}/src/x.ts` }, region: { startLine: 1 } } }] }],
    properties: { startTimeUtc: "2026-11-06T10:00:00Z" } }] });
  assert.equal(N.normalizeSarif(sarif, [base, work]), normalizeReport("sarif", sarif, { base, work }), "SARIF, with no invocation to strip");
  for (const f of ["junit.xml", "lcov.info", "eslint.sarif"]) {
    const nature = { "junit.xml": "junit", "lcov.info": "coverage", "eslint.sarif": "sarif" }[f];
    assert.equal(normalizeReport(nature, committed(f), { base, work }), committed(f), `runward-run leaves the example's ${f} as it is too`);
  }
});

// CodeQL raised the attribute pattern on the third integration pull request of 2026-11-06 (alert 99,
// `js/polynomial-redos`): `\s+(?:file|time|…)` restarted from every blank of a run that no attribute name
// follows, and read the run again each time. A JUnit report is written by the project's test runner,
// from the code under review. Measured on 2026-11-06 as CPU time: 22 s for 100,000 blanks with the
// former pattern; the pattern as shipped starts only where a run of blanks starts, and gives the same
// bytes (a successful match always started there).
test("the JUnit normalisers read a run of blanks in linear time and strip what the former pattern stripped", async () => {
  const { normalizeReport } = await runModule("normalize.js");
  const former = (t) => t.replace(/\s+(?:file|time|timestamp|hostname)\s*=\s*"[^"]*"/g, "").replace(/\s+(?:file|time|timestamp|hostname)\s*=\s*'[^']*'/g, "");
  const FRAGMENTS = [" ", "\t", "\n", "  ", "file", "time", "timestamp", "hostname", "xfile", "=", " = ", "\"", "'", "\"v\"", "'v'", "<testcase", "/>", ">", "name=\"a\""];
  let seed = 7;
  const next = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 20_000; i++) {
    let body = "";
    for (let j = Math.floor(next() * 24); j > 0; j--) body += FRAGMENTS[Math.floor(next() * FRAGMENTS.length)];
    const t = `<testsuites>${body}</testsuites>`;
    assert.equal(N.normalizeJUnit(t, [W]), former(t), JSON.stringify(t));
  }
  const blanks = `<testsuites><testsuite name="s"${" ".repeat(1_000_000)}x="1"/></testsuites>`;
  for (const [what, fn] of [["runward-integrations", () => N.normalizeJUnit(blanks, [W])],
    ["runward-run", () => normalizeReport("junit", blanks, { base: "/runward-run/work/code", work: "/runward-run/work" })]]) {
    const t0 = process.cpuUsage();
    fn();
    const u = process.cpuUsage(t0);
    const ms = (u.user + u.system) / 1000;
    assert.ok(ms < 2000, `${what}: 1,000,000 blanks read in ${ms.toFixed(0)} ms of CPU, over the 2000 ms ceiling`);
  }
});
