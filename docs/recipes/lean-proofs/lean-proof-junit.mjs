#!/usr/bin/env node
// Reference script of the recipe docs/recipes/lean-proofs-as-junit.md (ADR-0091, increment 0).
//
// It runs in the ADOPTER's repository and CI, never inside runward's gate: runward reads the JUnit
// file this script writes, as it reads any committed JUnit report, and never runs Lean (ADR-0054).
//
// What it does, in this order, from the root of a Lake project:
//   1. runs `comparator` on the given config (comparator must run before anything else builds the
//      solution, as its README requires); its exit code is its verdict, for every theorem at once;
//   2. requires a second kernel in the config (`external_kernels`, or `enable_nanoda`);
//   3. refuses a config whose `permitted_axioms` reaches outside runward's list;
//   4. scans every .lean file of the project, comments removed, for the forbidden constructs;
//   5. prints the axioms of each theorem the config names (`Lean.collectAxioms`, what `#print axioms`
//      reads) and judges them against runward's list;
//   6. writes one JUnit case per theorem, whose name carries the theorem, the SHA-256 of the frozen
//      statement file and the axioms. A case with any failed check carries a <failure>.
//
// Node only, no dependency. The output is deterministic (no time, no duration, no host) so a CI job
// can re-run it and compare the result with the committed file byte for byte.
//
// Usage:
//   node lean-proof-junit.mjs --config comparator.json --out reports/lean-proofs.xml
//        [--project .] [--statement Challenge.lean] [--comparator comparator]
//
//   --comparator  the comparator binary (default: `comparator` on the PATH). It is run as
//                 `lake env <comparator> <config>` from the project root, so the environment variables
//                 comparator reads (COMPARATOR_LANDRUN, COMPARATOR_LEAN4EXPORT, COMPARATOR_NANODA) pass through.
//   --statement   the frozen statement file, relative to the project (default: the path of
//                 `challenge_module`, `A.B` read as `A/B.lean`).
//
// Exit code: 0 when every case is green, 1 when one is not, 2 when the inputs cannot be read.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

// runward's list (ADR-0091). No option widens it: a project that needs another axiom records the row
// `deviated` with an ADR instead of citing this report.
export const PERMITTED_AXIOMS = ["Classical.choice", "Quot.sound", "propext"];
// Named so a refusal says what it is. Any other axiom is refused too, as a user axiom.
export const REFUSED_AXIOMS = {
  sorryAx: "a `sorry` or an elaboration error reached the proof",
  "Lean.ofReduceBool": "`native_decide` or `bv_decide`: the compiler joins the trusted base",
  "Lean.trustCompiler": "the compiler joins the trusted base",
};
// Forbidden constructs, matched as whole Lean identifiers in code with comments removed. A forbidden
// word inside a string literal is a false red, named in the message: it fails on the safe side.
const FORBIDDEN_EVERYWHERE = ["native_decide", "implemented_by", "extern", "unsafe", "axiom", "skipKernelTC"];
const FORBIDDEN_OUTSIDE_STATEMENT = ["sorry", "admit"]; // the statement's own proofs are `sorry` by design
const FORBIDDEN_IN_STATEMENT = ["partial", "opaque"];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

/** SHA-256 as runward's seal computes it: CRLF folded to LF, so a Windows checkout reads the same. */
export function statementSha256(buf) {
  if (buf.includes(0)) return createHash("sha256").update(buf).digest("hex");
  return createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

/** Lean source with comments blanked (line `--`, nested block `/- -/`), string literals kept. */
export function stripComments(src) {
  let out = "", i = 0, depth = 0, inString = false;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (depth > 0) {
      if (two === "/-") { depth++; i += 2; continue; }
      if (two === "-/") { depth--; i += 2; continue; }
      out += src[i] === "\n" ? "\n" : " "; i++; continue;
    }
    if (inString) {
      if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === '"') inString = false;
      out += src[i]; i++; continue;
    }
    if (src[i] === '"') { inString = true; out += src[i]; i++; continue; }
    if (two === "/-") { depth = 1; i += 2; continue; }
    if (two === "--") { while (i < src.length && src[i] !== "\n") i++; continue; }
    out += src[i]; i++;
  }
  return out;
}

/** The forbidden words present in one file's code, with their line numbers. */
export function forbiddenIn(code, words) {
  const hits = [];
  for (const w of words) {
    const re = new RegExp(`(?<![A-Za-z0-9_.'!?])${w}(?![A-Za-z0-9_'!?])`, "g");
    for (let m = re.exec(code); m; m = re.exec(code)) {
      hits.push({ word: w, line: code.slice(0, m.index).split("\n").length });
    }
  }
  return hits;
}

/** The exact JUnit case name a mission row cites. Axioms sorted, `none` when there are none. */
export function caseName(theorem, sha, axioms) {
  const list = [...axioms].sort();
  return `lean-proof ${theorem} statement-sha256=${sha} axioms=${list.length ? list.join(",") : "none"}`;
}

const xmlAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function leanFiles(root) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === ".lake" || e.name === ".git" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".lean")) out.push(p);
    }
  };
  walk(root);
  return out;
}

function main() {
  const project = resolve(arg("project", "."));
  const configPath = resolve(project, arg("config", "comparator.json"));
  const outPath = resolve(arg("out", "reports/lean-proofs.xml"));
  const comparator = arg("comparator", "comparator");
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch (e) {
    console.error(`cannot read the comparator config ${configPath}: ${e.message}`); return 2;
  }
  const theorems = Array.isArray(config.theorem_names) ? config.theorem_names : [];
  if (theorems.length === 0) { console.error("the config names no theorem (theorem_names)"); return 2; }
  const badName = theorems.find((t) => typeof t !== "string" || !/^[A-Za-z_][A-Za-z0-9_'!?]*(\.[A-Za-z_][A-Za-z0-9_'!?]*)*$/.test(t));
  if (badName !== undefined) {
    console.error(`theorem name ${JSON.stringify(badName)} is outside the plain dotted form this recipe writes into a case name`);
    return 2;
  }
  const statementRel = arg("statement", `${String(config.challenge_module).split(".").join("/")}.lean`);
  let statementBuf;
  try { statementBuf = readFileSync(resolve(project, statementRel)); } catch (e) {
    console.error(`cannot read the statement file ${statementRel}: ${e.message}`); return 2;
  }
  const sha = statementSha256(statementBuf);
  const common = []; // failures shared by every case

  // 1. comparator first: nothing may have built the solution outside its sandbox before it runs.
  const cmp = spawnSync("lake", ["env", comparator, configPath], { cwd: project, stdio: "inherit" });
  if (cmp.status !== 0) common.push(`comparator did not accept the solution (exit ${cmp.status ?? cmp.error?.message})`);

  // 2. a second kernel, named.
  const kernels = ["lean4", ...Object.keys(config.external_kernels ?? {}).sort()];
  if (config.enable_nanoda === true && !kernels.includes("nanoda")) kernels.push("nanoda");
  if (kernels.length < 2) common.push("no second kernel: the config has no external_kernels (nanoda, for instance)");

  // 3. the config may not reach outside runward's list.
  for (const a of config.permitted_axioms ?? []) {
    if (!PERMITTED_AXIOMS.includes(a)) common.push(`the config permits axiom ${a}, outside runward's list`);
  }

  // 4. the forbidden constructs, independently of anything Lean reports.
  const statementAbs = resolve(project, statementRel);
  for (const f of leanFiles(project)) {
    const isStatement = f === statementAbs;
    const words = [...FORBIDDEN_EVERYWHERE, ...(isStatement ? FORBIDDEN_IN_STATEMENT : FORBIDDEN_OUTSIDE_STATEMENT)];
    for (const h of forbiddenIn(stripComments(readFileSync(f, "utf8")), words)) {
      common.push(`${relative(project, f).split(sep).join("/")}:${h.line} contains "${h.word}" (a false red if it sits in a string literal)`);
    }
  }

  // 5. the axioms of each theorem, read from the built solution, after comparator.
  const axioms = new Map();
  if (cmp.status === 0) {
    const dir = mkdtempSync(join(tmpdir(), "lean-proof-junit-"));
    const probe = join(dir, "Axioms.lean");
    writeFileSync(probe, [
      "import Lean",
      `import ${config.solution_module}`,
      "open Lean Elab Command",
      "run_cmd do",
      "  let env ← getEnv",
      `  for s in ([${theorems.map((t) => JSON.stringify(t)).join(", ")}] : List String) do`,
      "    let n := s.toName",
      "    if env.contains n then",
      "      let axs ← Lean.collectAxioms n",
      '      IO.println s!"RUNWARD-AXIOMS {s} {String.intercalate "," (axs.toList.map toString)}"',
      "    else",
      '      IO.println s!"RUNWARD-AXIOMS-MISSING {s}"',
      "",
    ].join("\n"));
    const build = spawnSync("lake", ["build", String(config.solution_module)], { cwd: project, stdio: "inherit" });
    const run = build.status === 0
      ? spawnSync("lake", ["env", "lean", probe], { cwd: project, encoding: "utf8" })
      : { status: build.status, stdout: "", stderr: "lake build failed" };
    rmSync(dir, { recursive: true, force: true });
    if (run.status !== 0) common.push(`the axiom probe failed: ${(run.stderr || run.stdout || "").trim().slice(0, 300)}`);
    for (const line of (run.stdout ?? "").split("\n")) {
      const m = /^RUNWARD-AXIOMS (\S+) ?(.*)$/.exec(line.trim());
      if (m) axioms.set(m[1], m[2] ? m[2].split(",").filter(Boolean) : []);
    }
  }

  // 6. one case per theorem.
  let failures = 0;
  const cases = theorems.map((t) => {
    const own = [...common];
    const ax = axioms.get(t);
    if (cmp.status === 0 && ax === undefined) own.push(`no axioms printed for ${t}: the theorem is absent from the solution`);
    for (const a of ax ?? []) {
      if (!PERMITTED_AXIOMS.includes(a)) own.push(`axiom ${a} is not permitted${REFUSED_AXIOMS[a] ? `: ${REFUSED_AXIOMS[a]}` : " (a user axiom)"}`);
    }
    const name = caseName(t, sha, ax ?? ["unknown"]);
    if (own.length === 0) return `    <testcase classname="lean-proofs" name="${xmlAttr(name)}"/>`;
    failures++;
    return `    <testcase classname="lean-proofs" name="${xmlAttr(name)}">\n` +
      `      <failure message="${xmlAttr(own[0])}">${xmlAttr(own.join("\n"))}</failure>\n    </testcase>`;
  });
  let toolchain = "";
  try { toolchain = readFileSync(join(project, "lean-toolchain"), "utf8").trim(); } catch { /* reported as empty */ }
  const props = [
    ["allowlist", PERMITTED_AXIOMS.join(",")],
    ["comparator-config-sha256", statementSha256(readFileSync(configPath))],
    ["kernels", kernels.join(",")],
    ["statement-file", statementRel.split(sep).join("/")],
    ["statement-sha256", sha],
    ["toolchain", toolchain],
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="lean-proofs" tests="${theorems.length}" failures="${failures}">`,
    `  <testsuite name="lean-proofs" tests="${theorems.length}" failures="${failures}" errors="0" skipped="0">`,
    "    <properties>",
    ...props.map(([k, v]) => `      <property name="${k}" value="${xmlAttr(v)}"/>`),
    "    </properties>",
    ...cases,
    "  </testsuite>",
    "</testsuites>",
    "",
  ].join("\n");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, xml);
  console.log(`${theorems.length - failures}/${theorems.length} theorem case(s) green, written to ${outPath}`);
  return failures === 0 ? 0 : 1;
}

// Run only when executed, so the helpers can be imported by a test.
if (process.argv[1] && statSync(process.argv[1], { throwIfNoEntry: false }) && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  process.exitCode = main();
}
