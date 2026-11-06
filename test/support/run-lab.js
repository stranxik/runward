// A laboratory for runward-run (ADR-0120), shared by its tests: the shipped example mission as
// `init --example` writes it, with the lockfile the repository's copy carries and its last prose row
// typed (ADR-0119 decision 4 asks it of the example before `re-derived`), and a run policy whose legs
// the fake container runtime (fake-container-runtime.mjs) executes on this machine. The legs re-write the
// reports the example commits, as the real tools do on an unchanged tree (the committed reports are
// regenerated and compared in CI, `reports:fresh`): the run is real, the container is not.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CLI = join(ROOT, "dist", "cli.js");
export const RUN_CLI = join(ROOT, "packages", "runward-run", "src", "cli.js");
export const FAKE = join(ROOT, "test", "support", "fake-container-runtime.mjs");
export const IMAGE = "node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c";
export const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", SOURCE_DATE_EPOCH: "1" };
export const runModule = (name) => import(pathToFileURL(join(ROOT, "packages", "runward-run", "src", name)).href);

/** ADR-0119 decision 2 at `attested`: two rows of the example cite a port's interface, where the mutator
 *  finds no operator to change, so their cited tests kill no mutant of their cited lines. The laboratory
 *  also cites the lines that implement the port, the routing adapter the cited test exercises, as an
 *  author asked for `attested` does; the shipped example does not yet. */
const IMPLEMENTS = "file:code/src/adapters/in-memory-routing.adapter.ts#InMemoryRoutingAdapter; ";
const PORT_ROWS = [
  ["architecture.md", "| contracts-governance | applied | file:code/src/core/ports/model-provider.port.ts#TriageModelPort; "],
  ["floor.md", "| tools-scope-atomicity | applied | file:code/src/core/ports/routing.port.ts#RoutingApproval; "],
];

/** The example as a laboratory repository: `init --example`, the lockfile, the prose row typed, the two
 *  rows that cite a port's interface citing the adapter that implements it too. */
export function makeLab(dir) {
  mkdirSync(dir, { recursive: true });
  execFileSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: dir, env, stdio: "pipe" });
  cpSync(join(ROOT, "examples", "request-triage", "code", "package-lock.json"), join(dir, "code", "package-lock.json"));
  const topo = join(dir, "runward", "execution-topology.md");
  writeFileSync(topo, readFileSync(topo, "utf8").replace(
    "| topology-usage-registry-present | applied | file:runward/execution-topology.md#Usage — §3 usage registry",
    "| topology-usage-registry-present | applied | file:runward/governance/usage-registry.md#triage-bot — §3 usage registry"));
  for (const [file, row] of PORT_ROWS) {
    const p = join(dir, "runward", file);
    const text = readFileSync(p, "utf8");
    if (!text.includes(row)) throw new Error(`the laboratory expects the example's row ${row.trim()} in ${file}`);
    writeFileSync(p, text.replace(row, `${row}${IMPLEMENTS}`));
  }
  writeFileSync(join(dir, "runward", "governance", "usage-registry.md"),
    "# Usage registry — Request Triage\n\n| Deployment | Risk class | Data classes touched | Action scopes | Owner / responsible | Last review |\n|---|---|---|---|---|---|\n" +
    "| triage-bot / prod | medium | request text (personal possible), `TriageRecord` | read intake; write to ticketing (approval-gated for compliance-flagged records) | triage product owner | — |\n");
  try { chmodSync(FAKE, 0o755); } catch { /* read-only checkout: the spawn below says so */ }
  return dir;
}

// The legs write into the report directory and do not create it, as Node.js's test reporter does not:
// runward-run creates the directory of every report the policy declares before any leg runs.
const copyLeg = (files) => ["node", "-e",
  `const fs=require("fs");for(const f of ${JSON.stringify(files)})fs.copyFileSync("reports/"+f,process.argv[1]+"/"+f)`,
  "${out}/code/reports"];

/** The run policy of the laboratory, with what a test changes in it. */
export function labPolicy(over = {}) {
  return {
    format: "runward-run-policy/0",
    image: IMAGE,
    install: { cwd: "code", lockfile: "code/package-lock.json", command: ["node", "-e", "require('fs').mkdirSync('node_modules/.installed',{recursive:true})"] },
    legs: [
      { leg: "tests", cwd: "code", command: copyLeg(["junit.xml"]), reports: [{ path: "code/reports/junit.xml", nature: "junit" }] },
      { leg: "reports", cwd: "code", command: copyLeg(["lcov.info", "eslint.json", "eslint.sarif"]), reports: [{ path: "code/reports/lcov.info", nature: "coverage" }, { path: "code/reports/eslint.json", nature: "eslint" }, { path: "code/reports/eslint.sarif", nature: "sarif" }] },
    ],
    ...over,
  };
}

// The mutation leg runs the example's tests for real, once per mutant: with Node.js's own type transform
// and a resolve hook standing in for tsx (ts-js-specifiers.mjs), zod linked from runward's node_modules,
// so the unit tests install nothing and reach no network (ADR-0120 R2).
const SPECIFIERS = join(ROOT, "test", "support", "ts-js-specifiers.mjs");
const ZOD = join(ROOT, "node_modules", "zod");
export const labTestCommand = (junit) => ["node", "--experimental-transform-types", "--no-warnings", "--import", SPECIFIERS,
  "--test", "--test-reporter=junit", `--test-reporter-destination=\${out}/${junit}`, "test/*.test.ts"];

/** The laboratory's policy with the legs of R2, as the shipped example's run policy has them: the tests,
 *  the coverage, the other reports, and the mutation of the cited lines (its install linking zod); `over`
 *  applies to the mutation leg. */
export function mutationPolicy(over = {}) {
  const base = labPolicy();
  return {
    ...base,
    install: { ...base.install, command: ["node", "-e", `const fs=require("fs");fs.mkdirSync("node_modules",{recursive:true});fs.symlinkSync(${JSON.stringify(ZOD)},"node_modules/zod","dir")`] },
    legs: [
      base.legs[0],
      { leg: "coverage", cwd: "code", command: copyLeg(["lcov.info"]), reports: [{ path: "code/reports/lcov.info", nature: "coverage" }] },
      { leg: "reports", cwd: "code", command: copyLeg(["eslint.json", "eslint.sarif"]), reports: [{ path: "code/reports/eslint.json", nature: "eslint" }, { path: "code/reports/eslint.sarif", nature: "sarif" }] },
      { leg: "mutation", cwd: "code", command: labTestCommand("code/reports/junit.xml"), junit: "code/reports/junit.xml", timeoutSeconds: 60, maxMutantsPerLocation: 8, ...over },
    ],
  };
}

/** ADR-0117 row 8, the weakened-assertion sabotage: every assertion of a test file replaced by
 *  `assert.ok(true)`. The cases keep their names and all pass. */
export async function weakenAssertions(path) {
  const { codeMask } = await import(pathToFileURL(join(ROOT, "packages", "runward-run", "src", "mutate.js")).href);
  const text = readFileSync(path, "utf8");
  const mask = codeMask(text);
  let out = "", i = 0, n = 0;
  const call = /\bassert(?:\.[A-Za-z]+)?\s*\(/g;
  for (let m = call.exec(text); m; m = call.exec(text)) {
    if (!mask[m.index] || m.index < i || /[\w$.]/.test(text[m.index - 1] ?? "")) continue;
    let depth = 0, k = m.index + m[0].length - 1;
    for (; k < text.length; k++) { if (!mask[k]) continue; if (text[k] === "(") depth++; else if (text[k] === ")" && --depth === 0) break; }
    out += `${text.slice(i, m.index)}assert.ok(true)`;
    i = k + 1;
    n++;
    call.lastIndex = i;
  }
  writeFileSync(path, out + text.slice(i));
  return n;
}

export const check = (dir, ...a) => spawnSync(process.execPath, [CLI, "check", "-p", dir, "--strict", ...a], { encoding: "utf8", env });
export const checkJson = (dir, ...a) => JSON.parse(check(dir, ...a, "--json").stdout);

/** Write the policy and the check output beside the tree (never in it), and run runward-run. */
export function runLab(base, tree, { policy = labPolicy(), runtimeEnv = {}, out = join(base, "out"), args = [] } = {}) {
  const policyPath = join(base, "run-policy.json");
  writeFileSync(policyPath, JSON.stringify(policy, null, 2));
  const checkPath = join(base, "check.json");
  writeFileSync(checkPath, check(tree, "--require", "attested", "--json").stdout);
  const log = join(base, "runtime.log");
  const r = spawnSync(process.execPath, [RUN_CLI, "run", "--policy", policyPath, "--tree", tree, "--check", checkPath, "--out", out, "--runtime", FAKE, ...args],
    { encoding: "utf8", env: { ...env, FAKE_RUNTIME_LOG: log, ...runtimeEnv } });
  let calls = [];
  try { calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { calls = []; }
  return { ...r, out, calls, policyPath, checkPath };
}

/** A DSSE envelope around the run Statement, with one signature COUNTED by runward and never verified
 *  by it: these bytes are not a signature anyone could verify, which is the point of the tests that read
 *  `attested` in the CLI and refuse it in runward-fleet. */
export function countedEnvelope(statementBytes) {
  return JSON.stringify({ payloadType: "application/vnd.in-toto+json", payload: Buffer.from(statementBytes).toString("base64"), signatures: [{ keyid: "", sig: Buffer.from("counted, never verified by runward").toString("base64") }] });
}
