// runward-run's JUnit reader (`junitCases`, packages/runward-run/src/statement.js) reads a report in
// linear time.
//
// CodeQL raised its comment reader on the second integration pull request of 2026-11-06 (alerts 89 and
// 94: `xml.replace(/<!--[\s\S]*?-->/g, "")`, a polynomial regular expression on a value the project
// controls). The `<testcase …>` pattern after it, quote-aware and lazy, and the search for each case's
// body, are of the same class: each restarts from every opener that does not close. The report is
// written by the project's test runner, from the code under review, and runward-run reads it to write the
// test-result Statement; runward-run is a release asset. The example's `reports.mjs` was made linear by
// the second train (RWD-2026-0207); runward-run shares no code with another package, so it carries its
// own reader, written the same way. Measured on 2026-11-06 as CPU time, the former reader at 100,000
// characters: 1.3 s for a run of `<!--`, 1.9 s for the tag pattern's attack string, 2.0 s for a quote
// opened in a tag and never closed, 0.8 s for cases that never close; this one reads 1,000,000
// characters of each in 0.12 s or less.
//
// Held here: the reader as it ships gives the former one's answers on generated reports and on the JUnit
// reports this repository commits; it reads 1,000,000 characters of each adversarial shape under a
// ceiling of CPU time. That the example's run Statements keep their bytes was measured on 2026-11-06 by
// running the laboratory (test/support/run-lab.js) through runward-run with the former reader and with
// this one, the tests-and-reports policy and the policy with the coverage and mutation legs: every file
// written, the two Statements included, the same bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..", "..");
const { junitCases } = await import(pathToFileURL(join(ROOT, "packages", "runward-run", "src", "statement.js")).href);
const SIZE = 1_000_000;
const CEILING_MS = 2000;

// The former reader, kept as the reference (packages/runward-run/src/statement.js at d85f39b).
function oldJunitCases(xml) {
  const text = xml.replace(/<!--[\s\S]*?-->/g, "");
  const passed = [], failed = [], warned = [];
  const tag = /<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
  const decode = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, n) =>
    n ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[n.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));
  for (let m = tag.exec(text); m; m = tag.exec(text)) {
    const name = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
    const n = name ? decode(name[1] ?? name[2]) : "";
    let outcome = "passed";
    if (m[2] !== "/") {
      const end = text.indexOf("</testcase>", tag.lastIndex);
      const body = text.slice(tag.lastIndex, end === -1 ? undefined : end);
      outcome = /<(?:error|failure)\b/i.test(body) ? "failed" : /<skipped\b/i.test(body) ? "warned" : "passed";
    }
    (outcome === "passed" ? passed : outcome === "failed" ? failed : warned).push(n);
  }
  return { passed, failed, warned };
}

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const answer = (f, xml) => { try { return JSON.stringify(f(xml)); } catch (e) { return `throws ${e.name}`; } };

test("junitCases, as shipped, gives the former reader's answers on every generated report", () => {
  const FRAGMENTS = ["<testsuite", "<testcase", "<TestCase", "<TESTCASE", "</testsuite>", "</testcase>", "</TestCase>", "<testcases", "<testcase-x", " name=\"a\"", " name='b'",
    " classname=\"c\"", " NAME=\"d\"", " xname=\"e\"", ">", "/>", "/", "\"", "'", "<!--", "-->", "<!-", "--", "<failure", "<error", "<skipped", "<Error/>", "<SKIPPED>",
    "<errorx", "<failure>", "<failures", " ", "\n", "&quot;", "&amp;", "&#65;", "&#x42;", "&lt;", "x", "<", "name=\"f\">", "</failure>"];
  const r = prng(17);
  let n = 0;
  for (let i = 0; i < 40_000; i++) {
    let xml = "";
    const parts = Math.floor(r() * 30);
    for (let j = 0; j < parts; j++) xml += FRAGMENTS[Math.floor(r() * FRAGMENTS.length)];
    const [a, b] = [answer(oldJunitCases, xml), answer(junitCases, xml)];
    if (a !== b) assert.fail(`differs on ${JSON.stringify(xml)}:\n${a}\n${b}`);
    n++;
  }
  assert.equal(n, 40_000);
  // And on the JUnit reports this repository commits: the example's and runward's own.
  for (const rel of [["examples", "request-triage", "code", "reports", "junit.xml"], ["reports", "junit.xml"]]) {
    const committed = readFileSync(join(ROOT, ...rel), "utf8");
    assert.equal(answer(junitCases, committed), answer(oldJunitCases, committed), rel.join("/"));
    const c = junitCases(committed);
    assert.ok(c.passed.length > 1, `${rel.join("/")}: the committed report's cases are read`);
  }
});

test("junitCases: a positive control, the outcomes as the test-result predicate names them", () => {
  const xml = "<testsuite><testcase name=\"a\"/><testcase name='b &amp; c'><failure/></testcase><!-- <testcase name=\"hidden\"/> -->"
    + "<TestCase NAME=\"d\"><skipped/></testcase><testcase name=\"e\"><error message=\"x\"></error></testcase><testcase name=\"f\">"
    + "<skippedx/></testcase></testsuite>";
  assert.deepEqual(junitCases(xml), { passed: ["a", "f"], failed: ["b & c", "e"], warned: ["d"] });
  // A body runs to the next `</testcase>`, spelled so, as the former reader read it: a case closed
  // another way reads on into the next one.
  assert.deepEqual(junitCases(xml.replace("<skipped/></testcase>", "<skipped/></TestCase>")), { passed: ["a", "f"], failed: ["b & c", "d", "e"], warned: [] });
});

function cpu(fn) {
  const t0 = process.cpuUsage();
  fn();
  const t = process.cpuUsage(t0);
  return (t.user + t.system) / 1000;
}
const fill = (unit, prefix = "") => prefix + unit.repeat(Math.floor((SIZE - prefix.length) / unit.length));

for (const [what, xml] of [
  ["comment openers that never close (CodeQL's line)", fill("<!--")],
  ["a quoted tag restarted from every `<` (the tag pattern's attack string)", fill('"<TESTCASE"E')],
  ["a quote opened in a tag and never closed, the tag restarted from every `<testcase`", fill("<testcase \"")],
  ["cases that open and never close, each read to the end before", fill("<testcase>")],
  ["cases whose body holds a failure that never closes", fill("<testcase><failure ")],
  ["cases with quoted names, in the shape a writer produces", fill("<testsuite name='s'><testcase name=\"c\" classname=\"k\"/></testsuite>\n")],
]) {
  test(`junitCases, ${what}: 1,000,000 characters read in linear time`, () => {
    const ms = cpu(() => junitCases(xml));
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms of CPU, over the ${CEILING_MS} ms ceiling`);
  });
}
