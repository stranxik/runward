// RWD-2026-0207: the example's `reports.mjs` reads a JUnit report, and compares two reports, in linear
// time.
//
// CodeQL raised the comment reader of `junit()` (`xml.replace(/<!--[\s\S]*?-->/g, "")`) on the first
// integration pull request of 2026-11-06 as an incomplete multi-character sanitization. It is not one:
// the text is read for its tags and never written as markup, and a `<!--` that one pass leaves is what
// an XML reader leaves too. Reading the function for the alert found what is: the comment reader, the
// tag pattern (a quote-aware `<testcase …>` restarted from every `<`) and the search for each case's
// body restart from every opener that does not close, and the comparison looked each projected line
// up in the whole other report. Measured on 2026-11-06, as CPU time at 100,000 characters: 1.4 s for a
// run of `<!--`, 1.9 s for the tag pattern's attack string, 0.9 s for cases that never close; and 9.4 s
// to compare two reports of 50,000 cases. A committed report is a file of the tree under review, and
// `reports:fresh` is the example's hook under `check --strict --hooks`.
//
// Held here: the projection of `junit()` as the script ships it (its source, read from the file) gives
// the former function's answers on generated reports; it reads 1,000,000 characters of each
// adversarial shape in linear CPU time; and `reports.mjs --check` compares two reports of 50,000 cases
// in linear CPU time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = join(ROOT, "examples", "request-triage", "code", "scripts", "reports.mjs");
const SIZE = 1_000_000;
const CEILING_MS = 2000;
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const tmp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };

// The projection as the script ships it: its source from `const decodeXml` to `function lcov`.
const source = readFileSync(SCRIPT, "utf8");
const from = source.indexOf("const decodeXml");
const to = source.indexOf("function lcov(");
assert.ok(from !== -1 && to > from, "reports.mjs still holds `const decodeXml … function lcov(`: re-anchor this test");
const shipped = join(tmp("rw-example-junit-"), "junit.mjs");
writeFileSync(shipped, `${source.slice(from, to)}\nexport { junit };\n`);
const { junit } = await import(pathToFileURL(shipped).href);

// The former function, kept as the reference.
const decodeXml = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, n) =>
  n ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[n.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));
function oldJunit(xml) {
  const twice = !xml.includes("&quot;") && xml.includes("&amp;quot;");
  const value = (v) => decodeXml(twice ? v.replace(/&amp;quot;/g, "&quot;") : v);
  const text = xml.replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const suites = [];
  const tag = /<(\/?)(testsuite|testcase)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
  for (let m = tag.exec(text); m; m = tag.exec(text)) {
    const [, close, name, attrs, self] = m;
    const attr = (k) => { const a = new RegExp(`\\b${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs); return a ? value(a[1] ?? a[2]) : null; };
    if (name.toLowerCase() === "testsuite") { if (close) suites.pop(); else if (!self) suites.push(attr("name")); continue; }
    if (close) continue;
    let verdict = "passed";
    if (!self) {
      const end = text.indexOf("</testcase>", tag.lastIndex);
      const body = text.slice(tag.lastIndex, end === -1 ? undefined : end);
      verdict = /<error\b/i.test(body) ? "error" : /<failure\b/i.test(body) ? "failure" : /<skipped\b/i.test(body) ? "skipped" : "passed";
    }
    out.push(JSON.stringify([suites, attr("classname"), attr("name"), verdict]));
  }
  out.push(JSON.stringify(["failures and errors anywhere", (text.match(/<(?:failure|error)\b/gi) ?? []).length]));
  return out.sort();
}

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const answer = (f, xml) => { try { return JSON.stringify(f(xml)); } catch (e) { return `throws ${e.name}`; } };

test("junit(), as shipped, gives the former function's projection of every generated report", () => {
  const FRAGMENTS = ["<testsuite", "<testcase", "<TestCase", "</testsuite>", "</testcase>", "<testcases", " name=\"a\"", " name='b'", " classname=\"c\"", " NAME=\"d\"", ">", "/>",
    "/", "\"", "'", "<!--", "-->", "<failure", "<error", "<skipped", "<Error/>", "<errorx", "<failure>", " ", "\n", "&quot;", "&amp;quot;", "&lt;", "x", "<", "<!-", "name=\"e\">"];
  const r = prng(11);
  let n = 0;
  for (let i = 0; i < 40_000; i++) {
    let xml = "";
    const parts = Math.floor(r() * 30);
    for (let j = 0; j < parts; j++) xml += FRAGMENTS[Math.floor(r() * FRAGMENTS.length)];
    const [a, b] = [answer(oldJunit, xml), answer(junit, xml)];
    if (a !== b) assert.fail(`differs on ${JSON.stringify(xml)}:\n${a}\n${b}`);
    n++;
  }
  assert.equal(n, 40_000);
  // And on the report the example commits.
  const committed = readFileSync(join(ROOT, "examples", "request-triage", "code", "reports", "junit.xml"), "utf8");
  assert.equal(answer(junit, committed), answer(oldJunit, committed));
  assert.ok(junit(committed).length > 1, "the committed report projects its cases");
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
  ["cases that open and never close, each read to the end before", fill("<testcase>")],
  ["cases whose body holds a failure that never closes", fill("<testcase><failure ")],
  ["suites and cases with quoted names, in the shape a writer produces", fill("<testsuite name='s'><testcase name=\"c\" classname=\"k\"/></testsuite>\n")],
]) {
  test(`junit(), ${what}: 1,000,000 characters read in linear time`, () => {
    const ms = cpu(() => junit(xml));
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms of CPU, over the ${CEILING_MS} ms ceiling`);
  });
}

// The child's own CPU time, written at its exit: the load of the machine does not stretch it.
const CPU_PROBE = `data:text/javascript,${encodeURIComponent('import { writeFileSync } from "node:fs"; process.on("exit", () => { const u = process.cpuUsage(); writeFileSync(process.env.RW_CPU_OUT, String((u.user + u.system) / 1000)); });')}`;
const FAKE = `import { cpSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
const dir = join(process.env.FAKE_DIR, basename(process.argv[1], ".mjs"));
if (existsSync(dir)) cpSync(dir, process.argv[2], { recursive: true });
`;

test("reports.mjs --check compares two reports of 50,000 cases in linear time, and names the difference", () => {
  const dir = tmp("rw-example-diff-");
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "reports"));
  writeFileSync(join(dir, "scripts", "reports.mjs"), source);
  const suite = (names) => `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n${names.map((n) => `\t<testcase name="${n}" classname="test"/>\n`).join("")}</testsuites>\n`;
  const cases = Array.from({ length: 50_000 }, (_, i) => `case ${i}`);
  for (const gen of ["junit-committable", "coverage-committable", "lint-committable"]) {
    writeFileSync(join(dir, "scripts", `${gen}.mjs`), FAKE);
    mkdirSync(join(dir, "fakes", gen), { recursive: true });
  }
  const reports = { "lcov.info": "TN:\nSF:a.ts\nDA:1,1\nend_of_record\n", "eslint.json": "[]\n", "eslint.sarif": '{"version":"2.1.0","runs":[]}\n' };
  for (const [name, body] of Object.entries(reports)) {
    writeFileSync(join(dir, "reports", name), body);
    writeFileSync(join(dir, "fakes", name === "lcov.info" ? "coverage-committable" : "lint-committable", name), body);
  }
  writeFileSync(join(dir, "reports", "junit.xml"), suite(cases));
  writeFileSync(join(dir, "fakes", "junit-committable", "junit.xml"), suite([...cases.slice(1), "case new"]));
  const out = join(dir, "cpu.txt");
  const r = spawnSync(process.execPath, ["--import", CPU_PROBE, join(dir, "scripts", "reports.mjs"), "--check"], { cwd: dir, encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FAKE_DIR: join(dir, "fakes"), RW_CPU_OUT: out } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /recorded in the committed report, not produced by this tree \(1\):\n\s+\[\[\],"test","case 0","passed"\]/);
  assert.match(r.stderr, /produced by this tree, not in the committed report \(1\):\n\s+\[\[\],"test","case new","passed"\]/);
  const ms = Number(readFileSync(out, "utf8"));
  // Measured on 2026-11-06: 9.4 s of CPU for the former comparison, 0.3 s for this one.
  assert.ok(ms < 2 * CEILING_MS, `compared in ${ms.toFixed(0)} ms of CPU, over the ${2 * CEILING_MS} ms ceiling`);
});
