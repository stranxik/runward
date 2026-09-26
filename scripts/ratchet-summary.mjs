#!/usr/bin/env node
// Writes the summary of a whole-perimeter mutation ratchet run (ADR-0079).
//
// A release ratchet produces ~250 MB of merged reports, kept 30 days, and logs kept 90. After that
// nothing showed a release had passed its ratchet. This writes the few kilobytes that must outlive
// the run: per module, what came back, what the ratchet answered, how many survivors the
// measurement found and how many the register files, and the SHA-256 of the merged report; then the
// overall verdict. A refused or mismatched run is summarised exactly like a green one. The workflow
// signs the file as a GitHub artifact attestation; this script only reads and writes files.
//
//   node scripts/ratchet-summary.mjs --merged <dir> --answers <dir> --out <file.json>
//
// Inputs: `<dir>` trees as actions/download-artifact leaves them (a file may sit one level down).
// Environment (all optional, recorded as given): GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_RUN_ID,
// GITHUB_RUN_ATTEMPT, GITHUB_EVENT_NAME, GITHUB_REF_NAME.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEP } from "./mutation-key.mjs";

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1]; };
const mergedDir = arg("merged"), answersDir = arg("answers"), out = arg("out");
if (!mergedDir || !answersDir || !out) {
  console.error("usage: ratchet-summary.mjs --merged <dir> --answers <dir> --out <file.json>");
  process.exit(2);
}

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Every file under `dir` whose name matches, whatever depth download-artifact chose. */
function find(dir, test) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir).sort(byCodeUnit)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...find(p, test));
    else if (test(name)) found.push(p);
  }
  return found;
}

// The planned perimeter, from the same data the plan job reads: a module that never answered is
// named, never silently absent.
const perimeter = JSON.parse(readFileSync("stryker.config.json", "utf8")).mutate
  .map((e) => e.replace(/:.*$/, "").replace(/^.*\//, "").replace(/\.js$/, ""))
  .sort(byCodeUnit);

const answers = new Map();
for (const f of find(answersDir, (n) => n.endsWith("-answer.json"))) {
  const a = JSON.parse(readFileSync(f, "utf8"));
  answers.set(a.module, a);
}
const merged = new Map();
for (const f of find(mergedDir, (n) => n.endsWith("-merged.json"))) {
  merged.set(f.replace(/^.*\//, "").replace(/-merged\.json$/, ""), f);
}

// What the register files per module, keyed exactly as the ratchet keys it.
const filed = new Map();
const dir = "docs/compliance/mutation-survivors";
for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort(byCodeUnit)) {
  for (const v of JSON.parse(readFileSync(join(dir, f), "utf8")).verdicts ?? []) {
    if (!v.stableKey) continue;
    const m = v.stableKey.split(SEP)[0];
    filed.set(m, (filed.get(m) ?? 0) + 1);
  }
}

const ANSWER = { 0: "describes", 1: "mismatch", 2: "refused" };
const modules = perimeter.map((module) => {
  const a = answers.get(module);
  const reportPath = merged.get(module);
  let survivors = null, sha256 = null;
  if (reportPath) {
    const bytes = readFileSync(reportPath);
    sha256 = createHash("sha256").update(bytes).digest("hex");
    const report = JSON.parse(bytes.toString("utf8"));
    survivors = 0;
    for (const file of Object.values(report.files ?? {})) {
      for (const mutant of file.mutants ?? []) if (mutant.status === "Survived" || mutant.status === "NoCoverage") survivors++;
    }
  }
  return {
    module,
    answer: a ? (ANSWER[a.exit] ?? `exit ${a.exit}`) : "no answer",
    chunks: a ? { expected: a.chunksExpected, measured: a.chunksMeasured } : null,
    survivorsMeasured: survivors,
    survivorsFiled: filed.get(module) ?? 0,
    mergedReportSha256: sha256,
  };
});

const verdict = modules.every((m) => m.answer === "describes") ? "the register describes this tree" : "refused";
const env = process.env;
const summary = {
  schema: "https://runward.dev/ratchet-summary/v1",
  adr: "ADR-0079",
  repository: env.GITHUB_REPOSITORY ?? null,
  version: JSON.parse(readFileSync("package.json", "utf8")).version,
  commit: env.GITHUB_SHA ?? null,
  ref: env.GITHUB_REF_NAME ?? null,
  event: env.GITHUB_EVENT_NAME ?? null,
  run: env.GITHUB_RUN_ID ? { id: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT ?? null } : null,
  verdict,
  modules,
  nonScope: "This summary proves what the ratchet measured and answered on this run. It does not prove that the register's qualifications (hole, equivalent, …) are right: that judgement lives in the reviewed register.",
};
writeFileSync(out, JSON.stringify(summary, null, 1) + "\n");
const counts = modules.reduce((c, m) => ((c[m.answer] = (c[m.answer] ?? 0) + 1), c), {});
console.log(`${out}: ${verdict} · ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
