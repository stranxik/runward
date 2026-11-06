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
function junit(xml) {
  // A report written by Node.js up to 24.21.x escapes a `"` twice; read it as runward does.
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
  const gone = was.filter((x) => !now.includes(x));
  const added = now.filter((x) => !was.includes(x));
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
