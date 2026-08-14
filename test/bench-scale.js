// Scale benchmark — the enterprise-monorepo objection, answered with a measurement.
//
// The claim to prove on YOUR machine (`npm run bench`): the gate's cost follows what it actually
// opens — the mission tree and the CITED evidence — never the size of the repository around it.
// `check --strict` walks no source tree: it reads the mission deliverables, the rule corpus, and
// every typed pointer's target. A 10 000-file monorepo around the same mission must therefore gate
// in roughly the same time as the bare reference mission.
//
// This is a measurement harness, not a test: it prints a table and exits 0. It asserts nothing
// about milliseconds (machine-dependent), and it is deliberately NOT in the `npm test` path.
// The fixture is deterministic: same file names, same bytes, every run.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const FILES = Number(process.argv[2] ?? 10_000);   // uncited files to bury the mission under
const RUNS = 5;                                     // per scenario; the MEDIAN is reported

const run = (cwd, args) => {
  const t0 = process.hrtime.bigint();
  try { execFileSync(process.execPath, [CLI, ...args], { cwd, stdio: "pipe" }); }
  catch { /* a red gate times the same work — the bench measures cost, not verdict */ }
  return Number(process.hrtime.bigint() - t0) / 1e6;
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const bench = (label, cwd, args) => {
  run(cwd, args); // warm-up (fs cache), not counted
  const ms = median(Array.from({ length: RUNS }, () => run(cwd, args)));
  console.log(`  ${label.padEnd(58)} ${String(Math.round(ms)).padStart(6)} ms`);
  return ms;
};

console.log(`runward bench — median of ${RUNS} runs (after 1 warm-up), Node ${process.version}`);

// A: the bare reference mission.
const dir = mkdtempSync(join(tmpdir(), "rw-bench-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe" });
console.log(`\nScenario A — reference mission, as scaffolded`);
const a = bench("check --strict", dir, ["check", "--strict", "-p", "."]);
const aAtt = bench("check --strict --attest (digest over mission ∪ cited)", dir, ["check", "--strict", "--attest", "-p", "."]);

// B: the same mission buried in an uncited monorepo. Deterministic bytes, ~2 KB per file.
console.log(`\nScenario B — same mission + ${FILES.toLocaleString("en-US")} uncited repo files (~${Math.round(FILES * 2048 / 1e6)} MB)`);
const pad = "// filler line — deterministic bench content\n".repeat(40);
for (let i = 0; i < FILES; i++) {
  const sub = join(dir, "bulk", `mod-${String(i % 100).padStart(3, "0")}`);
  if (i % 100 === i) mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, `file-${String(i).padStart(5, "0")}.ts`), `export const unit${i} = ${i};\n${pad}`);
}
const b = bench("check --strict (must stay ~flat: nothing here is opened)", dir, ["check", "--strict", "-p", "."]);
const bAtt = bench("check --strict --attest (uncited files are not hashed)", dir, ["check", "--strict", "--attest", "-p", "."]);

// C: what DOES scale — the cited evidence itself. Inflate every file the manifests cite ×~50.
console.log(`\nScenario C — the cited evidence inflated (each cited file +100 KB)`);
const manifests = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "governance/evaluation-rubric.md", "governance/observability-schema.md", "handover.md"];
const cited = new Set();
for (const m of manifests) {
  let text = "";
  try { text = readFileSync(join(dir, "runward", m), "utf8"); } catch { continue; }
  for (const match of text.matchAll(/\bfile:([^\s|:#`]+)/g)) cited.add(match[1]);
}
const filler = `\n// appended bench padding — never cited, changes no symbol\n${"// x\n".repeat(25_000)}`;
let inflated = 0;
for (const rel of cited) {
  try { appendFileSync(join(dir, rel), filler); inflated++; } catch { /* pointer into a non-file — skip */ }
}
console.log(`  (${inflated} cited file(s) inflated)`);
const c = bench("check --strict (opens and scans every cited file)", dir, ["check", "--strict", "-p", "."]);

console.log(`\nShape of the cost`);
console.log(`  repo grew ×${FILES.toLocaleString("en-US")} files  → gate ${a ? (b / a).toFixed(2) : "?"}× baseline (flat ⇒ O(cited evidence), not O(repo))`);
console.log(`  attest on the same     → ${aAtt ? (bAtt / aAtt).toFixed(2) : "?"}× baseline (uncited files are outside the digest)`);
console.log(`  cited evidence ×50     → gate ${a ? (c / a).toFixed(2) : "?"}× baseline (what you cite is what you pay)`);

rmSync(dir, { recursive: true, force: true });
