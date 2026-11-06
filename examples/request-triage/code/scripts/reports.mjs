#!/usr/bin/env node
// Every report the mission's manifests cite, regenerated from this tree (runward ADR-0115).
//
//   node scripts/reports.mjs           regenerate reports/: junit.xml, lcov.info, eslint.json,
//                                      eslint.sarif. Commit the result.            (npm run reports)
//   node scripts/reports.mjs --check   regenerate into a scratch directory and compare with the
//                                      committed reports/; never writes reports/. (npm run reports:fresh)
//
// WHY THE CHECK EXISTS. runward reads a committed report and never runs the tool (runward ADR-0054),
// so a report is only as good as the proof that this tree produces it. A JSON file of a hundred bytes
// written by hand reads as an ESLint report; a JUnit file listing the cited cases reads as a green
// suite. `--check` is that proof, run where the tests run: in CI, before `runward check --strict`
// (runward/hooks.json, `check --strict --hooks`). Recipe: runward docs/recipes/junit-freshness-in-ci.md.
//
// WHAT IT COMPARES: what the gate reads of each report, and whatever else the report records that does
// not depend on the machine. Never the bytes, because honest runs differ in bytes: measured on this
// suite, Node.js 22 and 24 write the same coverage with different hit counts on two lines.
//   junit.xml    every case (suite, classname, name) and its verdict: passed, failure, error, skipped
//   lcov.info    every source file measured, and whether anything executed it
//   eslint.json  every file linted, its error and warning counts, and each message's rule and line
//   eslint.sarif every rule in force, and each result's rule, level, file and line
//
// It exits 0 when every committed report records what this tree produces, 1 when one does not or when
// a tool is not green (a red suite or a lint error: fix that first, the report cannot be evidence), and
// 2 when a tool could not run at all.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const out = check ? mkdtempSync(join(tmpdir(), "reports-fresh-")) : join(ROOT, "reports");
const GENERATORS = [
  ["tests (JUnit)", "junit-committable.mjs"],
  ["coverage (LCOV)", "coverage-committable.mjs"],
  ["lint (ESLint, SARIF)", "lint-committable.mjs"],
];

let worst = 0;
const problems = [];
for (const [label, script] of GENERATORS) {
  const run = spawnSync(process.execPath, [join(ROOT, "scripts", script), check ? out : "reports"], { cwd: ROOT, stdio: ["ignore", check ? "ignore" : "inherit", "inherit"] });
  const code = run.status ?? 2;
  if (code !== 0) problems.push(`${label}: the tool is not green (exit ${code}) — fix that first: a red run is not evidence`);
  worst = Math.max(worst, code === 0 ? 0 : code === 1 ? 1 : 2);
}
if (!check) process.exit(worst);

// ── The projections: what each report says, without the machine that wrote it ──────────────────────

const decodeXml = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, n) =>
  n ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[n.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));

// The readers of a JUnit report read it in one pass, whatever it holds: a committed report is a file of
// the tree like any other, and a regular expression that restarts from every `<!--` or every
// `<testcase` that does not close reads the rest of the file again each time (measured at 100,000
// characters: 1.4 s for a run of `<!--`, 1.9 s for a tag left open inside quotes; runward
// RWD-2026-0207).

/** `s` without its comments, each `<!--` to the first `-->` after it, as an XML reader drops them. */
function withoutComments(s) {
  let out = "";
  let at = 0;
  for (;;) {
    const i = s.indexOf("<!--", at);
    if (i === -1) break;
    const j = s.indexOf("-->", i + 4);
    if (j === -1) break;
    out += s.slice(at, i);
    at = j + 3;
  }
  return out + s.slice(at);
}

/** The first `what` at or after a position, for positions asked in increasing order: one scan for all. */
function forward(s, what) {
  let from = Infinity, at = -1;
  return (i) => {
    if (i >= from && (at === -1 || at >= i)) return at;
    from = i;
    at = s.indexOf(what, i);
    return at;
  };
}

const isWord = (c) => c !== undefined && /\w/.test(c);

/**
 * Each `<testsuite …>`, `</testsuite>` and `<testcase …>` of `text`, in order: a tag ends at its first
 * `>` outside a quoted value, and a quote that never closes ends no tag. Where a tag's attributes end
 * depends only on where they start, so each position is read once, for every tag that reaches it.
 */
function* tags(text) {
  const low = text.replace(/[A-Z]+/g, (w) => w.toLowerCase());
  const ends = new Int32Array(text.length + 1); // 0 not read yet, -1 no end, else the end of the attributes + 1
  const attrsEnd = (from) => {
    const seen = [];
    let y = from;
    let r;
    for (;;) {
      if (ends[y] !== 0) { r = ends[y]; break; }
      seen.push(y);
      const c = text[y];
      if (c === undefined) { r = -1; break; }
      if (c === ">" || (c === "/" && text[y + 1] === ">")) { r = y + 1; break; }
      if (c === '"' || c === "'") {
        const q = text.indexOf(c, y + 1);
        if (q === -1) { r = -1; break; }
        y = q + 1;
        continue;
      }
      y++;
    }
    for (const p of seen) ends[p] = r;
    return r === -1 ? -1 : r - 1;
  };
  for (let x = text.indexOf("<"); x !== -1; x = text.indexOf("<", x + 1)) {
    const close = text[x + 1] === "/" ? "/" : "";
    const c = x + 1 + close.length;
    const name = low.startsWith("testsuite", c) ? 9 : low.startsWith("testcase", c) ? 8 : 0;
    if (!name || isWord(text[c + name])) continue;
    const e = attrsEnd(c + name);
    if (e === -1) continue;
    const self = text[e] === "/" ? "/" : "";
    const end = e + self.length + 1;
    yield { close, name: text.slice(c, c + name), attrs: text.slice(c + name, e), self, end };
    x = end - 1;
  }
}

/** The positions of `<name` (any case, then no word character) in `text`, in order. */
function marks(text, name) {
  const low = text.replace(/[A-Z]+/g, (w) => w.toLowerCase());
  const at = [];
  for (let i = low.indexOf(`<${name}`); i !== -1; i = low.indexOf(`<${name}`, i + 1)) if (!isWord(text[i + name.length + 1])) at.push(i);
  return at;
}
/** Whether one of the sorted `at` lies in [from, to - len]. */
function within(at, from, to, len) {
  let lo = 0, hi = at.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (at[mid] < from) lo = mid + 1; else hi = mid; }
  return lo < at.length && at[lo] <= to - len;
}

function junit(xml) {
  // A report written by Node.js up to 24.21.x escapes a `"` twice; read it as runward does.
  const twice = !xml.includes("&quot;") && xml.includes("&amp;quot;");
  const value = (v) => decodeXml(twice ? v.replace(/&amp;quot;/g, "&quot;") : v);
  const text = withoutComments(xml);
  const out = [];
  const suites = [];
  const caseEnd = forward(text, "</testcase>");
  const found = { error: marks(text, "error"), failure: marks(text, "failure"), skipped: marks(text, "skipped") };
  for (const { close, name, attrs, self, end } of tags(text)) {
    const attr = (k) => { const a = new RegExp(`\\b${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs); return a ? value(a[1] ?? a[2]) : null; };
    if (name.toLowerCase() === "testsuite") { if (close) suites.pop(); else if (!self) suites.push(attr("name")); continue; }
    if (close) continue;
    let verdict = "passed";
    if (!self) {
      // The case's body runs to the next `</testcase>`, or to the end of the report.
      const stop = caseEnd(end);
      const to = stop === -1 ? text.length : stop;
      const has = (k) => within(found[k], end, to, k.length + 1);
      verdict = has("error") ? "error" : has("failure") ? "failure" : has("skipped") ? "skipped" : "passed";
    }
    out.push(JSON.stringify([suites, attr("classname"), attr("name"), verdict]));
  }
  out.push(JSON.stringify(["failures and errors anywhere", found.error.length + found.failure.length]));
  return out.sort();
}
function lcov(text) {
  const files = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) { current = line.slice(3); if (!files.has(current)) files.set(current, false); continue; }
    if (current === null) continue;
    if (line === "end_of_record") { current = null; continue; }
    const hit = (line.startsWith("LH:") && Number(line.slice(3)) > 0) || (line.startsWith("DA:") && Number(line.split(",")[1]) > 0);
    if (hit) files.set(current, true);
  }
  return [...files].map(([f, covered]) => JSON.stringify([f, covered ? "exercised" : "never executed"])).sort();
}
function eslintJson(text) {
  return JSON.parse(text).map((e) => JSON.stringify([e.filePath, e.errorCount, e.warningCount,
    (e.messages ?? []).map((m) => [m.ruleId, m.severity, m.line]).sort()])).sort();
}
function sarif(text) {
  const out = [];
  for (const run of JSON.parse(text).runs ?? []) {
    for (const r of run.tool?.driver?.rules ?? []) out.push(JSON.stringify(["rule in force", r.id]));
    for (const r of run.results ?? []) {
      const at = r.locations?.[0]?.physicalLocation;
      out.push(JSON.stringify(["result", r.ruleId ?? null, r.level ?? null, at?.artifactLocation?.uri ?? null, at?.region?.startLine ?? null]));
    }
  }
  return out.sort();
}
const REPORTS = [["junit.xml", junit], ["lcov.info", lcov], ["eslint.json", eslintJson], ["eslint.sarif", sarif]];

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
for (const [name, project] of REPORTS) {
  const committed = read(join(ROOT, "reports", name));
  const fresh = read(join(out, name));
  if (committed === null) { problems.push(`reports/${name} is not committed — a row citing it points at nothing`); continue; }
  if (fresh === null) { problems.push(`reports/${name}: this tree did not produce it — the generator wrote nothing`); continue; }
  let was, now;
  try { was = project(committed); } catch (e) { problems.push(`reports/${name} cannot be read as the report it claims to be (${e.message})`); continue; }
  now = project(fresh);
  // Looked up in a set: in the other list, each line cost a scan of it (9.4 s for 50,000 cases).
  const [inWas, inNow] = [new Set(was), new Set(now)];
  const gone = was.filter((x) => !inNow.has(x));
  const added = now.filter((x) => !inWas.has(x));
  if (gone.length + added.length === 0) continue;
  const show = (list) => list.slice(0, 8).map((x) => `\n      ${x}`).join("") + (list.length > 8 ? `\n      … and ${list.length - 8} more` : "");
  problems.push(`reports/${name} is not the report this tree produces:`
    + (gone.length ? `\n    recorded in the committed report, not produced by this tree (${gone.length}):${show(gone)}` : "")
    + (added.length ? `\n    produced by this tree, not in the committed report (${added.length}):${show(added)}` : ""));
}
rmSync(out, { recursive: true, force: true });

if (problems.length === 0) {
  console.log(`reports-fresh: the ${REPORTS.length} committed report(s) record what this tree produces`);
  process.exit(0);
}
console.error("reports-fresh: the committed reports are not what this tree produces\n");
for (const p of problems) console.error(`  - ${p}`);
console.error("\n  Run `npm run reports`, read the diff of reports/, commit it, and push again.");
process.exit(Math.max(worst, 1));
