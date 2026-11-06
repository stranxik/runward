// saboteur.js: the catalogue saboteur@1, replayed offline with the gate a repository pins (PRV-03).
//
// The gate is run as a program, never imported: `node <cli> check --strict` in a fixed environment
// (no colour, UTC, C locale, an empty HOME, no git configuration), on a fresh copy per case. Only exit
// codes and normalised refusal lines are kept, never a path of the run and never a time.
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./git.js";
import { cmp, sha256, ratio } from "./canon.js";
import { GATED, manifestRows, rowPointers, evidenceCell } from "./mission.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = join(HERE, "..", "corpus", "saboteur-1");
export const CASES = JSON.parse(readFileSync(join(CORPUS_DIR, "cases.json"), "utf8"));

/** The payloads, rendered: the fake credentials are assembled here, never stored in a file. */
const FILL = { FAKE_KEY: "sk" + "-live-" + "FAKE".repeat(9) + "00", DB_URL: "postgres://" + "admin" + ":" + "admin" + "@prod-db:5432/triage" };
export const render = (template) => template.replace(/\{\{(\w+)\}\}/g, (_, k) => FILL[k]);
export function payload(name) {
  const t = render(readFileSync(join(CORPUS_DIR, "payloads", name + ".tmpl"), "utf8"));
  const want = CASES.payloads[name];
  if (sha256(t) !== want) throw new Error(`corpus drift: payload ${name} renders to ${sha256(t)}, saboteur@1 pins ${want}`);
  return t;
}

export function cliEnv(home, nodePath = process.execPath, extra = {}) {
  return { PATH: `${dirname(nodePath)}:/usr/bin:/bin`, HOME: home, TZ: "UTC", LC_ALL: "C", LANG: "C", NO_COLOR: "1", FORCE_COLOR: "0",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", CI: "1", ...extra };
}
export const ENV_RECORD = { CI: "1", FORCE_COLOR: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", HOME: "<empty-tmp>", LANG: "C", LC_ALL: "C", NO_COLOR: "1", PATH: "<node-bin>:/usr/bin:/bin", TZ: "UTC" };

/** One gate run: exit code and refusal lines with the run's own paths taken out. */
export function gate(cli, cwd, args, home, { node = process.execPath, env = {} } = {}) {
  const r = run(node, [cli, ...args], { cwd, env: cliEnv(home, node, env), timeout: 180000 });
  const norm = (s) => s.split(cwd).join("<mission>").split(home).join("<home>");
  const refusals = [...new Set((r.out + "\n" + r.err).split("\n").map((l) => norm(l).trim()).filter((l) => l.startsWith("✗")).map((l) => l.slice(0, 160)))].sort(cmp);
  const exit = r.code ?? (r.error ? `error:${r.error}` : `signal:${r.signal}`);
  return { exit, refusals, stdout: norm(r.out) };
}

// ---- manifest helpers --------------------------------------------------------------------------
function eachRow(root, files, fn) {
  let rows = 0;
  for (const m of files) {
    const p = join(root, m);
    if (!existsSync(p)) continue;
    const { lines, idx } = manifestRows(readFileSync(p, "utf8"));
    for (const i of idx) { const cells = lines[i].split("|"); if (cells.length < 4) continue; const out = fn(cells, m); if (out) { lines[i] = out.join("|"); rows++; } }
    writeFileSync(p, lines.join("\n"));
  }
  return rows;
}
function pointersOf(root, files) {
  const out = [];
  for (const m of files) {
    const p = join(root, m);
    if (!existsSync(p)) continue;
    const { lines, idx } = manifestRows(readFileSync(p, "utf8"));
    for (const i of idx) {
      const cells = lines[i].split("|");
      const status = (cells[2] ?? "").trim().toLowerCase();
      for (const ptr of rowPointers(evidenceCell(lines[i]))) out.push({ manifest: m, status, ...ptr });
    }
  }
  return out;
}
const rmrf = (p) => rmSync(p, { recursive: true, force: true });
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
function walk(root, rel = "") {
  const out = [];
  for (const n of readdirSync(join(root, rel)).sort(cmp)) {
    const r = rel ? rel + "/" + n : n;
    const st = statSync(join(root, r));
    if (st.isDirectory()) out.push(...walk(root, r)); else out.push(r);
  }
  return out;
}
function replaceWord(root, dir, from, to, filter = () => true) {
  if (!existsSync(join(root, dir))) return 0;
  let n = 0;
  for (const f of walk(root, dir).filter(filter)) {
    const p = join(root, f); const t = readFileSync(p, "utf8"); const re = new RegExp(`\\b${from}\\b`, "g");
    if (re.test(t)) { writeFileSync(p, t.replace(re, to)); n++; }
  }
  return n;
}
const decodeXml = (v) => { let prev, x = v; do { prev = x; x = x.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); } while (x !== prev); return x; };
export function removeJUnitCase(xml, pointerName) {
  const want = decodeXml(pointerName); let removed = 0;
  const out = xml.replace(/[ \t]*<testcase\b([^>]*?)(\/>|>[\s\S]*?<\/testcase>)\n?/g, (whole, attrs) => {
    const a = (k) => { const m = attrs.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? decodeXml(m[1]) : null; };
    const name = a("name"), cls = a("classname");
    if (name === want || (cls !== null && `${cls}::${name}` === want)) { removed++; return ""; }
    return whole;
  });
  return { xml: out, removed };
}

// ---- the example corpus ------------------------------------------------------------------------
const TEST_FILE = "code/test/triage.test.ts", JUNIT = "code/reports/junit.xml", ADR1 = "runward/adr/ADR-0001-single-orchestrator.md";
function stub(root) {
  const made = new Map();
  for (const p of pointersOf(root, GATED)) {
    if (p.kind === "adr" || !p.path.startsWith("code/")) continue;
    if (!made.has(p.path)) made.set(p.path, { sym: new Set(), cases: new Set() });
    if (p.suffix.startsWith("#")) made.get(p.path).sym.add(p.suffix.slice(1));
    if (p.suffix.startsWith("::")) made.get(p.path).cases.add(p.suffix.slice(2).replace(/^"|"$/g, ""));
  }
  for (const [path, w] of [...made].sort((a, b) => cmp(a[0], b[0]))) {
    const full = join(root, path);
    if (path.endsWith(".xml")) write(full, '<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n' + [...w.cases].sort(cmp).map((n) => `\t<testcase name="${n}" classname="test"/>\n`).join("") + "</testsuites>\n");
    else if (path.endsWith(".json")) write(full, '{ "name": "stub" }\n');
    else write(full, "// stub\n" + [...w.sym].sort(cmp).map((s) => `export const ${s} = 0;\n`).join(""));
  }
  return made.size;
}
function genericFill(root) {
  const gf = (t) => t.replace(/\[[^\]\n]*\]/g, "the value recorded during the mission") +
    "\n\nThe team reviewed this deliverable during the mission and recorded the outcome here.\nEvery point below was discussed with the stakeholders and the conclusion was written down.\nThe records were checked again before the phase was declared complete.\nNothing further was found to add at the time of writing.\n";
  let n = 0;
  for (const rel of ["framing.md", "mission-contract.md", "architecture.md", "execution-topology.md", "decision-matrix.md", "floor.md",
    "governance/threat-model.md", "governance/evaluation-rubric.md", "governance/observability-schema.md", "runbook.md", "handover.md"]) {
    const p = join(root, "runward", rel); if (!existsSync(p)) continue; writeFileSync(p, gf(readFileSync(p, "utf8"))); n++;
  }
  const cdir = join(root, "runward", "contracts");
  if (existsSync(cdir)) for (const c of readdirSync(cdir).sort(cmp).filter((f) => f.endsWith(".md"))) { const p = join(cdir, c); writeFileSync(p, gf(readFileSync(p, "utf8"))); n++; }
  write(join(root, "runward/adr/ADR-0001-generic-decision.md"), "# ADR-0001 — Generic decision\n\n**Date**: 2026-11-05\n**Status**: accepted\n**Deciders**: the team\n\n## Context\n\nThe team discussed the options during the mission.\n\n## Decision\n\nThe team decided and wrote it down.\n\n## Reevaluation trigger (mandatory)\n\nRevisit when the situation changes.\n");
  return n + 1;
}
function emptyTests(root) {
  const p = join(root, TEST_FILE); if (!existsSync(p)) return null;
  const names = [...readFileSync(p, "utf8").matchAll(/^test\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
  writeFileSync(p, ['// Tests "emptied": same names, every assertion removed.', 'import { test } from "node:test";', "", ...names.map((n) => `test("${n}", () => {});`)].join("\n") + "\n");
  return names.length;
}
function dropTest(root, name) {
  const p = join(root, TEST_FILE); if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split("\n");
  const s = lines.findIndex((l) => l.startsWith(`test("${name}"`)); if (s < 0) return 0;
  let e = s + 1; while (e < lines.length && !/^\}\);\s*$/.test(lines[e])) e++;
  lines.splice(s, e - s + 1); writeFileSync(p, lines.join("\n")); return 1;
}
function junitAfter(root, dropName) {
  const p = join(root, JUNIT); if (!existsSync(p)) return "absent";
  let x = readFileSync(p, "utf8"); let removed = null;
  if (dropName) { const r = removeJUnitCase(x, dropName); x = r.xml; removed = r.removed; }
  x = x.replace(/<(failure|error|skipped)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g, "");
  writeFileSync(p, x); return dropName ? `kept-consistent (${removed} case removed)` : "kept-consistent";
}
const need = (root, paths) => { const miss = (paths ?? []).filter((p) => !existsSync(join(root, p))); return miss.length ? `absent at this version: ${miss.join(", ")}` : null; };

const APPLY = {
  T00: { apply: () => ({}) },
  T01: { needs: ["code/src/core/domain/guard.ts", "code/src/core/domain/triage.ts", "code/src/core/application/triage-request.usecase.ts"],
    apply: (r) => { for (const [s, d] of [["guard.pg.ts", "code/src/core/domain/guard.ts"], ["triage.pg.ts", "code/src/core/domain/triage.ts"], ["usecase.pg.ts", "code/src/core/application/triage-request.usecase.ts"]]) writeFileSync(join(r, d), payload(s)); return {}; } },
  T02: { needs: ["code/src/core/application"], apply: (r) => { writeFileSync(join(r, "code/src/core/application/autopilot.ts"), payload("autopilot.ts")); return {}; } },
  T03: { needs: ["code"], apply: (r) => { rmrf(join(r, "code")); const files = stub(r); const g = join(r, "code/src/core/domain/guard.ts"); if (existsSync(g)) appendFileSync(g, "// fail-closed\n"); return { stubFiles: files }; } },
  T04: { needs: [TEST_FILE], apply: (r) => ({ emptied: emptyTests(r), junit: junitAfter(r, null) }) },
  T05: { needs: ["code"], apply: (r) => { rmrf(join(r, "code")); return { rowsNa: eachRow(r, GATED, (c) => { c[2] = " n/a "; c[3] = " not applicable at this stage of the mission "; return c; }) }; } },
  T06: { apply: (r) => ({ rowsNa: eachRow(r, GATED, (c) => { c[2] = " n/a "; c[3] = " not applicable at this stage of the mission "; return c; }), filled: genericFill(r) }) },
  T07: { needs: [TEST_FILE], apply: (r) => { const n = "guard: a fabricated account reference never routes — escalated to review"; return { dropped: dropTest(r, n), junit: junitAfter(r, n) }; } },
  T08: { needs: [ADR1], apply: (r) => { writeFileSync(join(r, ADR1), "# ADR-0001\n\n**Status**: accepted\n\nNothing here.\n"); return {}; } },
  T09: { needs: [ADR1], apply: (r) => { writeFileSync(join(r, ADR1), ""); return {}; } },
  T10: { needs: ["code/src/core/domain/guard.ts"], apply: (r) => ({ files: replaceWord(r, "code", "guardFields", "validateFields") }) },
  T11: { needs: ["code/src/core/domain/guard.ts"], apply: (r) => ({ files: replaceWord(r, "code", "guardFields", "validateFields") + replaceWord(r, "runward", "guardFields", "validateFields", (f) => f.endsWith(".md")) }) },
  T12: { needs: ["code/src/core/domain/guard.ts"], apply: (r) => { const n = replaceWord(r, "code", "guardFields", "validateFields"); appendFileSync(join(r, "code/src/core/domain/guard.ts"), "\n// guardFields: former name, kept for reference\n"); return { files: n }; } },
  T13: { needs: ["code/src/core/domain/triage.ts"], apply: (r) => { writeFileSync(join(r, "code/src/core/domain/triage.ts"), "junk\n"); return {}; } },
};

const verdict = (expect, exit) => expect === "pass" ? (exit === 0 ? "green" : exit === 1 ? "false-red" : "error")
  : (exit === 0 ? "missed" : exit === 1 ? "caught" : "error");

/** T14: an honest attestation, then fields written by hand; verify must refuse the forgery. */
function forgedVerify(cli, dir, home, rw) {
  const att = rw(cli, dir, ["check", "--strict", "--attest"], home);
  if (att.exit !== 0) return { status: "not-applicable", reason: `check --strict --attest exit ${att.exit}` };
  let statement;
  try { statement = JSON.parse(att.stdout); } catch { return { status: "not-applicable", reason: "this version's --attest does not print a JSON statement" }; }
  if (!statement?.predicate) return { status: "not-applicable", reason: "no predicate in the statement" };
  const scratch = join(dirname(dir), `${dirname(dir).split("/").pop()}-att`);
  mkdirSync(scratch, { recursive: true });
  const control = JSON.parse(JSON.stringify(statement));
  control.predicate.verdict = control.predicate.verdict === "clean" ? "gaps" : "clean";
  writeFileSync(join(scratch, "control.json"), JSON.stringify(control, null, 2));
  const c = rw(cli, dir, ["verify", join(scratch, "control.json"), "-p", "."], home);
  const forged = JSON.parse(JSON.stringify(statement));
  forged.predicate.currentGate = "all gates passed, independently audited";
  forged.predicate.adrCount = 42;
  forged.predicate.independentAudit = { by: "an external auditor", result: "passed" };
  writeFileSync(join(scratch, "forged.json"), JSON.stringify(forged, null, 2));
  const f = rw(cli, dir, ["verify", join(scratch, "forged.json"), "-p", "."], home);
  rmrf(scratch);
  if (c.exit !== 1) return { status: "error", reason: `the control (verdict flipped) was not refused: verify exit ${c.exit}`, control: c.exit, exit: f.exit };
  return { status: verdict("refuse", f.exit), exit: f.exit, control: c.exit, refusals: f.refusals.length };
}

/** T15: one cited case named with a double quote, the report in each of the two Node.js spellings. */
function quoteInvariance(cli, base, work, home, rw) {
  const junit = join(base, JUNIT), floor = join(base, "runward/floor.md");
  if (!existsSync(junit) || !existsSync(floor)) return { status: "not-applicable", reason: `absent at this version: ${[JUNIT, "runward/floor.md"].filter((p) => !existsSync(join(base, p))).join(", ")}` };
  const exits = {};
  for (const [spelling, attr] of [["once", "a &quot;quoted&quot; name"], ["twice", "a &amp;quot;quoted&amp;quot; name"]]) {
    const dir = join(work, `T15-${spelling}`); cpSync(base, dir, { recursive: true });
    const x = readFileSync(join(dir, JUNIT), "utf8");
    const at = x.lastIndexOf("</testsuites>");
    writeFileSync(join(dir, JUNIT), x.slice(0, at) + `\t<testcase name="${attr}" classname="test"/>\n` + x.slice(at));
    let inserted = false;
    const { lines, idx } = manifestRows(readFileSync(join(dir, "runward/floor.md"), "utf8"));
    for (const i of idx) {
      const cells = lines[i].split("|");
      if ((cells[2] ?? "").trim().toLowerCase() !== "applied" || !/file:/.test(cells[3] ?? "")) continue;
      cells[3] = ` test:${JUNIT}::a "quoted" name;${cells[3]}`; lines[i] = cells.join("|"); inserted = true; break;
    }
    if (!inserted) { rmrf(dir); return { status: "not-applicable", reason: "no applied row with a file pointer in runward/floor.md" }; }
    writeFileSync(join(dir, "runward/floor.md"), lines.join("\n"));
    exits[spelling] = rw(cli, dir, ["check", "--strict"], home).exit;
    rmrf(dir);
  }
  const status = exits.once === 0 && exits.twice === 0 ? "invariant" : exits.once !== exits.twice ? "divergent" : exits.once === 1 ? "false-red" : "error";
  return { status, exits };
}

/** The cases this code knows how to apply: test/saboteur.test.js holds them equal to cases.json. */
export const IMPLEMENTED = { example: [...Object.keys(APPLY), "T14", "T15"].sort(cmp), mission: ["M00", "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"] };

export function runExampleCorpus(cli, work, rw = gate) {
  const home = join(work, "home"); mkdirSync(home, { recursive: true });
  const pristine = join(work, "pristine"), blank = join(work, "blank");
  mkdirSync(pristine, { recursive: true }); mkdirSync(blank, { recursive: true });
  const init = rw(cli, pristine, ["init", "--example", "--yes", "--path", "."], home);
  const initBlank = rw(cli, blank, ["init", "--yes", "--path", "."], home);
  if (initBlank.exit === 0) rw(cli, blank, ["manifest", "--sync"], home);
  const cases = [];
  for (const c of CASES.cases.filter((x) => x.corpus === "example")) {
    for (const mode of ["N", "S"]) {
      const rec = { expect: c.expect, id: c.id, mode, name: c.name };
      const base = c.blank ? blank : pristine;
      const baseInit = c.blank ? initBlank : init;
      if (baseInit.exit !== 0) { cases.push({ ...rec, reason: `init exit ${baseInit.exit}`, status: "not-applicable" }); continue; }
      if (c.modes && !c.modes.includes(mode)) { cases.push({ ...rec, reason: mode === "S" ? "unsealed only: under a seal every legitimate change needs a new seal" : "sealed only", status: "not-applicable" }); continue; }
      if (c.id === "T15") { cases.push({ ...rec, ...quoteInvariance(cli, base, work, home, rw) }); continue; }
      const def = APPLY[c.id];
      const miss = need(base, def?.needs);
      if (c.id !== "T14" && miss) { cases.push({ ...rec, reason: miss, status: "not-applicable" }); continue; }
      const dir = join(work, `${c.id}-${mode}`); cpSync(base, dir, { recursive: true });
      if (mode === "S") {
        const f = rw(cli, dir, ["check", "--strict", "--freeze"], home);
        if (f.exit !== 0) { cases.push({ ...rec, reason: `--freeze exit ${f.exit}`, status: "not-applicable" }); rmrf(dir); continue; }
      }
      if (c.id === "T14") { cases.push({ ...rec, ...forgedVerify(cli, dir, home, rw) }); rmrf(dir); continue; }
      const details = def.apply(dir);
      const r = rw(cli, dir, ["check", "--strict"], home);
      cases.push({ ...rec, details, exit: r.exit, refusalLines: r.refusals.slice(0, 4), refusals: r.refusals.length, status: verdict(c.expect, r.exit) });
      rmrf(dir);
    }
  }
  return { cases, initBlankExit: initBlank.exit, initExampleExit: init.exit };
}

// ---- the mission corpus ------------------------------------------------------------------------
export function runMissionCorpus(cli, tree, work, rw = gate) {
  const home = join(work, "home-m"); mkdirSync(home, { recursive: true });
  const manifests = GATED.filter((m) => existsSync(join(tree, m)));
  const ptrs = pointersOf(tree, manifests).filter((p) => p.status === "applied");
  const adrDir = join(tree, "runward", "adr");
  const adrFiles = existsSync(adrDir) ? readdirSync(adrDir).sort(cmp) : [];
  const firstAdr = ptrs.find((p) => p.kind === "adr" && adrFiles.some((f) => f.startsWith(`ADR-${p.path}`)));
  const adrFile = firstAdr ? "runward/adr/" + adrFiles.find((f) => f.startsWith(`ADR-${firstAdr.path}`)) : null;
  const isFile = (p) => existsSync(join(tree, p)) && statSync(join(tree, p)).isFile();
  const firstFile = ptrs.find((p) => p.kind === "file" && !p.path.startsWith("runward/") && isFile(p.path));
  const symOk = (p) => p.kind === "file" && p.suffix.startsWith("#") && isFile(p.path);
  const firstSym = ptrs.find((p) => symOk(p) && !p.path.startsWith("runward/") && !p.path.endsWith(".md")) ?? ptrs.find(symOk);
  const firstCase = ptrs.find((p) => p.kind === "test" && p.suffix.startsWith("::") && p.path.endsWith(".xml") && isFile(p.path));
  const sym = firstSym ? firstSym.suffix.slice(1) : null;
  const APPLYM = {
    M00: { target: "-", apply: () => ({}) },
    M01: { target: adrFile, apply: (r) => { writeFileSync(join(r, adrFile), ""); return {}; } },
    M02: { target: adrFile, apply: (r) => { writeFileSync(join(r, adrFile), "# ADR\n\n**Status**: accepted\n\nNothing here.\n"); return {}; } },
    M03: { target: firstFile?.path, apply: (r) => { rmrf(join(r, firstFile.path)); return {}; } },
    M04: { target: firstSym && `${firstSym.path}#${sym}`, apply: (r) => { const p = join(r, firstSym.path); writeFileSync(p, readFileSync(p, "utf8").replace(new RegExp(`\\b${sym}\\b`, "g"), `${sym}Renamed`)); return {}; } },
    M05: { target: firstSym && `${firstSym.path}#${sym}`, apply: (r) => { const p = join(r, firstSym.path); writeFileSync(p, readFileSync(p, "utf8").replace(new RegExp(`\\b${sym}\\b`, "g"), `${sym}Renamed`) + `\n// ${sym}: former name\n`); return {}; } },
    M06: { target: firstSym && `${firstSym.path}#${sym}`, apply: (r) => { writeFileSync(join(r, firstSym.path), `// stub\nexport const ${sym} = 0;\n`); return {}; } },
    M07: { target: firstCase && `${firstCase.path}${firstCase.suffix}`, apply: (r) => { const p = join(r, firstCase.path); const res = removeJUnitCase(readFileSync(p, "utf8"), firstCase.suffix.slice(2).replace(/^"|"$/g, "")); writeFileSync(p, res.xml); return { removed: res.removed }; } },
    M08: { target: manifests.length ? `${manifests.length} manifest(s)` : null, apply: (r) => ({ rowsNa: eachRow(r, manifests, (c) => { c[2] = " n/a "; c[3] = " not applicable at this stage of the mission "; return c; }) }) },
  };
  const cases = [];
  let control = null;
  for (const c of CASES.cases.filter((x) => x.corpus === "mission")) {
    const def = APPLYM[c.id];
    const rec = { expect: c.expect, id: c.id, mode: "N", name: c.name, target: def.target === "-" ? null : def.target ?? null };
    if (c.id !== "M00" && !def.target) { cases.push({ ...rec, reason: "no pointer of this kind in the gated manifests", status: "not-applicable" }); continue; }
    if (c.id !== "M00" && control !== 0) { cases.push({ ...rec, reason: `the control exits ${control}: a catch is not measurable on a mission already red`, status: "not-applicable" }); continue; }
    const dir = join(work, c.id); cpSync(tree, dir, { recursive: true });
    const details = def.apply(dir);
    const r = rw(cli, dir, ["check", "--strict"], home);
    if (c.id === "M00") control = r.exit;
    // M00 is the repository's own verdict, not a control the gate can fail: red is "red", counted by PRV-03 P1.
    const status = c.id === "M00" ? (r.exit === 0 ? "green" : r.exit === 1 ? "red" : "error") : verdict(c.expect, r.exit);
    cases.push({ ...rec, details, exit: r.exit, refusalLines: r.refusals.slice(0, 4), refusals: r.refusals.length, status });
    rmrf(dir);
  }
  return { cases, controlExit: control, manifests: manifests.length, typedPointers: ptrs.length };
}

/** The verdict of the commit's own mission, and its re-derivation under other zones, locales, runtime. */
export function gateAndRederive(cli, tree, work, altNode) {
  const home = join(work, "home-g"); mkdirSync(home, { recursive: true });
  const g = gate(cli, tree, ["check", "--strict"], home);
  const variants = [
    { id: "utc-c", node: process.execPath, env: { TZ: "UTC", LC_ALL: "C", LANG: "C" } },
    { id: "kiritimati-fr", node: process.execPath, env: { TZ: "Pacific/Kiritimati", LC_ALL: "fr_FR.UTF-8", LANG: "fr_FR.UTF-8" } },
  ];
  if (altNode) variants.push({ id: "alt-runtime", node: altNode, env: { TZ: "UTC", LC_ALL: "C", LANG: "C" } });
  const outs = variants.map((v) => { const r = gate(cli, tree, ["check", "--strict", "--json"], home, { node: v.node, env: v.env }); return { id: v.id, exit: r.exit, sha256: sha256(r.stdout) }; });
  const identical = outs.every((o) => o.sha256 === outs[0].sha256 && o.exit === outs[0].exit);
  return { exit: g.exit, refusals: g.refusals.length, refusalLines: g.refusals.slice(0, 6), rederive: outs, identical };
}

/** The gate's key in expected.json: a registry version, or a version built from a commit. */
export const gateKey = (g) => (g.source === "built-from-commit" && g.commit ? `runward@${g.version}+${g.commit.slice(0, 12)}` : `runward@${g.version}`);

/** The example corpus against what this gate version did when saboteur@1 was frozen. */
export function againstFrozen(key, example) {
  let exp;
  try { exp = JSON.parse(readFileSync(join(CORPUS_DIR, "expected.json"), "utf8")); } catch { return { frozen: false, reason: "no expected.json" }; }
  const want = exp.observed?.[key];
  if (!want) return { frozen: false, key, reason: `no frozen observation for ${key}` };
  const differences = example.cases.filter((c) => want[`${c.id}/${c.mode}`] !== c.status).map((c) => `${c.id}/${c.mode}: frozen ${want[`${c.id}/${c.mode}`] ?? "absent"}, now ${c.status}`);
  return { differences, frozen: true, key, matches: differences.length === 0 };
}

/** PRV-03's facts from the two corpora. */
export function summarise(example, mission) {
  const all = [...(example?.cases ?? []), ...(mission?.cases ?? [])];
  const refuse = all.filter((c) => c.expect === "refuse" && c.status !== "not-applicable");
  const caught = refuse.filter((c) => c.status === "caught").length;
  // A false red is a refusal of the healthy example, of a legitimate change, or a verdict that moved with
  // something outside the mission's meaning; the repository's own red mission (M00) is not one.
  const bad = all.filter((c) => (c.expect === "pass" && c.status === "false-red") || (c.expect === "invariant" && c.status !== "invariant" && c.status !== "not-applicable"));
  const errors = all.filter((c) => c.status === "error");
  return { caught, errors: errors.length, falseRed: bad.length, mustRefuse: ratio(caught, refuse.length), run: refuse.length,
    missed: refuse.filter((c) => c.status === "missed").map((c) => `${c.id}${c.mode}`).sort(cmp),
    falseRedCases: bad.map((c) => `${c.id}${c.mode}:${c.status}`).sort(cmp) };
}
