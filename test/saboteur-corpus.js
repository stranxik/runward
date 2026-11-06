// Saboteur corpus — the sabotages of 2026-11-05 and the variants of 2026-11-06, replayable by anyone.
//
// On 2026-11-05 an investigation planted sabotages in the shipped example mission, each keeping the
// cited names in place, and measured which ones `check --strict` let through (ADR-0117's table). On
// 2026-11-06 the integration train refused most of them, four still passed, and ADR-0124 closed those
// four and wrote seven variants to bound what it closed. The scripts lived in a session scratchpad.
// This file is that corpus, in the shape of test/audit-corpus.js: the REAL CLI against missions built
// on the fly from `init --example`, one stable identifier per case.
//
// What each case asserts is the exit code of `check --strict` measured after ADR-0124, in each mode
// where it was measured:
//
//   N  the sabotage on the example as shipped, no seal;
//   S  the example sealed first (`check --strict --freeze`), then the sabotage;
//   H  the sabotage, then `check --strict --hooks` (the example's hook installs its dependencies and
//      regenerates its reports): only where an execution is what refuses the case, and on the control,
//      whose green proves the hook can run here at all.
//
// Two cases stay GREEN on purpose, each with the limit ADR-0124 writes down: b4 and g6 without a seal.
// They are pinned, not hidden: the day a change closes one of them, its code flips and this file says
// so, and the change updates the expectation, and the record, knowingly.
//
// Run: `node test/saboteur-corpus.js` (needs a build). The H mode installs the example's dependencies
// with npm, so it needs the registry; `--no-hooks` leaves it out and says so, and so does a run that
// cannot reach the registry (`registryReach`): offline, the H cases are skipped with that reason, never
// failed and never passed.
//
// Options:
//   --cli <path>    the `cli.js` to judge (default: this checkout's `dist/cli.js`).
//   --json <file>   also write one machine-readable result per case and mode to <file> (`-` for stdout).
//   --no-hooks      skip the H mode.
//
// Each case carries a stable identifier, `SC-NNN`, declared in the case and never derived from its
// position, pinned to its name by `test/fixtures/saboteur-corpus-ids.json` (append-only, as the attack
// corpus's ledger is). What this measures: whether each of these known sabotages is still handled as it
// was measured; a regression result on a fixed set, not a detection rate, and no score is computed.
import { execFileSync, spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { connect } from "node:net";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FAKE_KEY, GUARD_PG, TRIAGE_PG, USECASE_PG, autopilot, emptied, dropCase, reportWithout } from "./support/saboteur-payloads.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let CLI = join(ROOT, "dist", "cli.js");
const MANIFESTS = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "handover.md"];
const TEST_FILE = "code/test/triage.test.ts";
const REPORT = "code/reports/junit.xml";

// Run under `node --test` (test/unit/saboteur-corpus.test.js), the environment carries NODE_TEST_CONTEXT,
// and the example's hook runs a `node --test` of its own, which would then report to the outer runner
// instead of writing its JUnit file: the control's hook fails for a reason that is not the example's.
// Cleared, as test/unit/mutation-select-tests.test.js and the qualification kit clear it.
const { NODE_TEST_CONTEXT: _context, NODE_V8_COVERAGE: _coverage, ...ENV } = process.env;

/** Run the CLI, never throw: the exit code IS the result. */
function cli(args, cwd) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...ENV, NO_COLOR: "1" } });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const at = (dir, rel) => join(dir, rel);
const read = (dir, rel) => readFileSync(at(dir, rel), "utf8");
const write = (dir, rel, text) => { mkdirSync(dirname(at(dir, rel)), { recursive: true }); writeFileSync(at(dir, rel), text); };
/** The investigation's `codeout`: the code leaves the tree. */
const codeOut = (dir) => rmSync(at(dir, "code"), { recursive: true, force: true });

/** A stub that keeps the title and an accepted status, and says nothing (g2, g4, g5). */
const stubAdr = (n) => `# ADR-${n}\n\n**Status**: accepted\n\nNothing here.\n`;

/** c3b: every file the gated manifests' applied rows cite into code/, written to carry what its pointer
 *  asks and nothing else (the investigation's forge.py): sources keep the cited names as constants, each
 *  cited report says what its row claims. */
function forgeCitedFiles(dir) {
  const ptr = /(file|test):(code\/[^\s;,)|]+?)(::"[^"]*"|::[^\s;,)|]+|#[^\s;,)|]+|:\d+)?(?=[\s;,)|]|$)/g;
  const want = new Map();
  for (const m of MANIFESTS) {
    for (const line of read(dir, `runward/${m}`).split("\n")) {
      if (!/^\|\s*`?[a-z][a-z0-9-]+`?\s*\|\s*applied\s*\|/.test(line)) continue;
      for (const mo of (line.split("|")[3] ?? "").matchAll(ptr)) {
        const w = want.get(mo[2]) ?? { sym: new Set(), cases: new Set() };
        const suf = mo[3] ?? "";
        if (suf.startsWith("#")) w.sym.add(suf.slice(1));
        else if (suf.startsWith("::")) w.cases.add(suf.slice(2).replace(/^"|"$/g, ""));
        want.set(mo[2], w);
      }
    }
  }
  const ident = (s) => /^[A-Za-z_$][\w$]*$/.test(s);
  for (const [path, w] of [...want].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const syms = [...w.sym].sort(), cases = [...w.cases].sort();
    if (path.endsWith("junit.xml")) {
      write(dir, path, `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n\t<testsuite name="test" tests="${cases.length}" failures="0" errors="0" skipped="0">\n` +
        cases.map((c) => `\t\t<testcase name="${c.replace(/"/g, "&quot;")}" classname="test" time="0.001"/>\n`).join("") + "\t</testsuite>\n</testsuites>\n");
    } else if (path.endsWith("lcov.info")) {
      write(dir, path, syms.map((s) => `TN:\nSF:${s}\nFN:1,stub\nFNDA:1,stub\nFNF:1\nFNH:1\nDA:1,1\nLF:1\nLH:1\nend_of_record\n`).join(""));
    } else if (path.endsWith("eslint.json")) {
      write(dir, path, JSON.stringify(syms.map((s) => ({ filePath: s, messages: [], errorCount: 0, fatalErrorCount: 0, warningCount: 0 })), null, 2) + "\n");
    } else if (path.endsWith(".sarif")) {
      write(dir, path, JSON.stringify({ version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [{ tool: { driver: { name: "ESLint", rules: syms.map((id) => ({ id })) } }, results: [] }] }, null, 2) + "\n");
    } else if (path.endsWith(".json")) {
      write(dir, path, '{ "name": "stub" }\n');
    } else if (path.endsWith(".mjs") && syms.length && !syms.every(ident)) {
      write(dir, path, "// stub\n" + syms.map((s) => `// ${s}\n`).join("") + "export default [];\n");
    } else {
      const names = syms.filter(ident);
      write(dir, path, "// stub\n" + names.map((s) => `export const ${s} = 0;\n`).join("") + (names.length ? "" : "export {};\n"));
    }
  }
}

/** c4: every row of every gated manifest `n/a`, with one generic sentence (the investigation's na-all). */
function everyRowNotApplicable(dir) {
  for (const m of MANIFESTS) {
    const lines = read(dir, `runward/${m}`).split("\n");
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("| Rule | Status | Evidence")) { inTable = true; continue; }
      if (inTable && !lines[i].startsWith("|")) inTable = false;
      if (inTable && lines[i].startsWith("|") && !lines[i].startsWith("|---")) {
        const cells = lines[i].split("|");
        cells[2] = " n/a ";
        cells[3] = " not applicable at this stage of the mission ";
        lines[i] = cells.join("|");
      }
    }
    write(dir, `runward/${m}`, lines.join("\n"));
  }
}

/** A case of the test file deleted, and the report written as its regeneration writes it. */
function dropAndRegenerate(dir, name) {
  write(dir, TEST_FILE, dropCase(read(dir, TEST_FILE), name));
  write(dir, REPORT, reportWithout(read(dir, REPORT), name));
}

export const cases = [];
const sabotage = (id, origin, name, why, expect, build, limit = null) => cases.push({ id, origin, name, why, expect, build, limit });

// ── The control ──────────────────────────────────────────────────────────────────────────────────

sabotage("SC-001", ["ADR-0124"], "control: the example as shipped",
  "every case below starts from it; green with no seal, sealed, and with its hook, which proves the hook can install and run here, so a refusal under H is the sabotage and never the environment",
  { N: 0, S: 0, H: 0 },
  () => {});

// ── The 2026-11-05 corpus (ADR-0117's table, replayed on 2026-11-06) ────────────────────────────────

sabotage("SC-002", ["ADR-0117", "ADR-0118"], "a: the domain rewritten under the cited names, pg in the core, a live key, SQL joined to values",
  "the names every pointer cites survive; the analyzers read the core's imports and the secrets (ADR-0118)",
  { N: 1, S: 1 },
  (dir) => {
    write(dir, "code/src/core/domain/guard.ts", GUARD_PG);
    write(dir, "code/src/core/domain/triage.ts", TRIAGE_PG);
    write(dir, "code/src/core/application/triage-request.usecase.ts", USECASE_PG);
  });

sabotage("SC-003", ["ADR-0124"], "b: a cited core file replaced by one word",
  "every pointer still resolves and every committed report still reads green; the linkage family names the imports that no longer link (ADR-0124 decision 2)",
  { N: 1, S: 1 },
  (dir) => write(dir, "code/src/core/domain/triage.ts", "poubelle\n"));

sabotage("SC-004", ["ADR-0117"], "b2: the guard replaced by one word",
  "the guard's cited symbol is gone, which the evidence layer refuses",
  { N: 1, S: 1 },
  (dir) => write(dir, "code/src/core/domain/guard.ts", "poubelle\n"));

sabotage("SC-005", ["ADR-0117", "ADR-0118"], "d: a core file that asks a model for code and executes it",
  "a file added to the declared core, cited by nothing; the capability and secret families read it (ADR-0118)",
  { N: 1, S: 1 },
  (dir) => write(dir, "code/src/core/application/autopilot.ts", autopilot(FAKE_KEY)));

sabotage("SC-006", ["ADR-0117", "ADR-0118"], "d2: the same executor, imported by the use case",
  "the executor is wired into the delivery, under the cited names",
  { N: 1, S: 1 },
  (dir) => {
    write(dir, "code/src/core/application/autopilot.ts", autopilot(FAKE_KEY));
    const usecase = "code/src/core/application/triage-request.usecase.ts";
    write(dir, usecase, read(dir, usecase) + '\nimport { autopilot } from "./autopilot.ts";\nexport const run = autopilot;\n');
  });

sabotage("SC-007", ["ADR-0117", "ADR-0118"], "e1: every assertion removed, the names kept",
  "the cases still carry their names, so every cited case is still recorded green; the test-integrity family reads that none asserts anything",
  { N: 1, S: 1 },
  (dir) => write(dir, TEST_FILE, emptied(read(dir, TEST_FILE))));

sabotage("SC-008", ["ADR-0117", "ADR-0118"], "e2: every assertion removed, the report regenerated",
  "regenerating an emptied suite writes the committed report again (the same names, all green), so the report says nothing new; the test sources are what is refused",
  { N: 1, S: 1 },
  (dir) => write(dir, TEST_FILE, emptied(read(dir, TEST_FILE))));

sabotage("SC-009", ["ADR-0124"], "f1: a case of the suite deleted, the report regenerated (sales request)",
  "the case was cited by no row until ADR-0124 decision 3: the tree an honest deletion leaves, which no reading can tell apart; the example now cites every case its floor row claims, so the deleted case is a cited case absent from the report",
  { N: 1, S: 1 },
  (dir) => dropAndRegenerate(dir, "sales request: classified and routed to the sales queue"));

sabotage("SC-010", ["ADR-0117"], "f2: the cited guard case deleted, the report regenerated",
  "a cited case absent from the report, which the evidence layer refuses",
  { N: 1, S: 1 },
  (dir) => dropAndRegenerate(dir, "guard: a fabricated account reference never routes — escalated to review"));

sabotage("SC-011", ["ADR-0117"], "g1: ADR-0001 emptied",
  "an empty file is not a decision: the `adr:` pointer refuses it",
  { N: 1, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0001-single-orchestrator.md", ""));

sabotage("SC-012", ["ADR-0124"], "g2: ADR-0001 replaced by an accepted stub",
  "47 characters and an accepted status passed the evidence layer while the journal set the file aside; one bar now (ADR-0124 decision 1)",
  { N: 1, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0001-single-orchestrator.md", stubAdr("0001")));

sabotage("SC-013", ["ADR-0117"], "g3: ADR-0002 emptied",
  "the architecture note's decision table cites an ADR that carries no decision",
  { N: 1, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md", ""));

sabotage("SC-014", ["ADR-0124"], "g4: ADR-0002 replaced by an accepted stub",
  "cited by no `adr:` pointer, and outside the seal: the decision table refuses it by the one bar, and the seal now covers the decisions the manifests name (ADR-0124 decisions 1 and 4)",
  { N: 1, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md", stubAdr("0002")));

sabotage("SC-015", ["ADR-0117", "ADR-0118"], "c3b: no code at all, every cited file a stub, every cited report forged",
  "every pointer resolves and every forged report says what its row asks; the cited symbols are constants and the test file declares nothing",
  { N: 1, S: 1 },
  (dir) => { codeOut(dir); forgeCitedFiles(dir); });

sabotage("SC-016", ["ADR-0114", "ADR-0119"], "c4: no code at all, every row n/a",
  "nothing is applied, so nothing the gate verified stands: exit 5, the level is not met (ADR-0114); sealed, the seal refuses the rewritten manifests",
  { N: 5, S: 1 },
  (dir) => { codeOut(dir); everyRowNotApplicable(dir); });

// ── The variants of 2026-11-06 (ADR-0124) ───────────────────────────────────────────────────────

sabotage("SC-017", ["ADR-0124"], "b3: a cited core file replaced by one export under another name",
  "the weaker check ADR-0124 set aside (a cited file declares something) passes it; the linkage family does not",
  { N: 1, S: 1 },
  (dir) => write(dir, "code/src/core/domain/triage.ts", "export const x = 1;\n"));

sabotage("SC-018", ["ADR-0124"], "b4: a cited core file keeps every imported name as a placeholder",
  "the code links and does nothing: no reading of the tree refuses it, the seal does, and so does an execution of the suite",
  { N: 0, S: 1, H: 1 },
  (dir) => {
    const values = ["CATEGORIES", "CategorySchema", "InboundRequestSchema", "QUEUE_BY_CATEGORY", "REVIEW_QUEUE"];
    const types = ["Category", "Confidence", "Provenance", "TriageField", "InboundRequest", "TriageStatus", "TriageRecord", "TriageResult"];
    write(dir, "code/src/core/domain/triage.ts", values.map((n) => `export const ${n} = 0;\n`).join("") + types.map((t) => `export type ${t} = any;\n`).join(""));
  },
  "ADR-0124, What this does not catch: « A placeholder that keeps every name (b4): the code links and does nothing. Behaviour needs an execution: `--hooks` today, `attested` with `runward-run` (ADR-0120). »");

sabotage("SC-019", ["ADR-0124"], "f3: another case deleted, the report regenerated (routing port idempotent)",
  "a second case the example did not cite before ADR-0124 decision 3, refused as cited now",
  { N: 1, S: 1 },
  (dir) => dropAndRegenerate(dir, "routing port is idempotent on requestId: no duplicate tickets"));

sabotage("SC-020", ["ADR-0124"], "g5: ADR-0003 replaced by an accepted stub",
  "the third decision of the example, cited by an `adr:` pointer and by the decision table",
  { N: 1, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0003-port-placement-and-sovereignty.md", stubAdr("0003")));

sabotage("SC-021", ["ADR-0124"], "g6: ADR-0002 rewritten as a well-formed record that reverses the decision",
  "dated, accepted, with a decision and a trigger: the bar reads shape, never content, so only a baseline sees it, and the seal covers it",
  { N: 0, S: 1 },
  (dir) => write(dir, "runward/adr/ADR-0002-deterministic-guard-on-extracted-fields.md",
    "# ADR-0002: no guard on model-extracted fields\n\n**Date**: 2026-05-12\n**Status**: accepted\n**Deciders**: operator\n\n" +
    "## Context\n\nThe model is reliable enough on the replayed set.\n\n## Decision\n\n" +
    "Model-proposed values are routed as proposed; no deterministic guard runs before RoutingPort.\n\n" +
    "## Reevaluation trigger (mandatory, dated)\n\nReopen if the misrouting rate exceeds 5% on the weekly review, set on 2026-05-12.\n"),
  "ADR-0124, What this does not catch: « A well-formed decision rewritten with no seal, or re-sealed by the agent: the forge protects the seal (ADR-0117 note G). »");

sabotage("SC-022", ["ADR-0124"], "x1: control, a decision kept in docs/adr in another tool's format, cited by a deviated row",
  "honest: the one bar applies where the journal count applies it, the mission's own adr/, so a record with a plain `Date:` and a `## Status` section reads as before; sealed, its change edits a sealed manifest, which any seal refuses",
  { N: 0, S: 1 },
  (dir) => {
    write(dir, "docs/adr/ADR-0042-keep-the-boundary-in-the-lint-configuration.md",
      "# 42. Keep the boundary in the lint configuration\n\nDate: 2026-05-12\n\n## Status\n\nAccepted\n\n## Context\n\n" +
      "The boundary is enforced by the lint rule rather than by a package split.\n\n## Decision\n\n" +
      "The lint rule refuses infrastructure imports in the core.\n\n## Consequences\n\nA package split is revisited when a second team owns the core.\n");
    const floor = read(dir, "runward/floor.md");
    const next = floor.replace(/^\| hexa-architecture \| applied \|[^\n]*\|\s*$/m,
      "| hexa-architecture | deviated | ADR-0042 — the boundary is kept by the lint rule, decided in docs/adr |");
    if (next === floor) throw new Error("x1: the hexa-architecture row was not found");
    write(dir, "runward/floor.md", next);
  });

// ── Can the H mode run here? ────────────────────────────────────────────────────────────────────

/** Whether this machine reaches the npm registry the example's hook installs from: a name lookup, then a
 *  connection, each bounded. `{ ok: true }`, or `{ ok: false, why }` naming the registry and what failed:
 *  with the network cut (`unshare -n`, `sandbox-exec … (deny network*)`), the lookup fails at once, and
 *  the H cases are skipped for that reason instead of failing on an install that cannot happen. */
export async function registryReach({ timeoutMs = 4000 } = {}) {
  const registry = process.env.npm_config_registry || process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";
  let url;
  try { url = new URL(registry); } catch { return { ok: false, why: `the registry ${registry} is not a URL` }; }
  const port = Number(url.port) || (url.protocol === "http:" ? 80 : 443);
  const bounded = (p, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(`${what} took over ${timeoutMs} ms`)), timeoutMs).unref())]);
  try { await bounded(lookup(url.hostname), `looking up ${url.hostname}`); }
  catch (e) { return { ok: false, why: `${url.hostname} does not resolve (${e.code ?? e.message})` }; }
  try {
    await bounded(new Promise((yes, no) => {
      const socket = connect({ host: url.hostname, port }, () => { socket.destroy(); yes(); });
      socket.on("error", no);
    }), `connecting to ${url.hostname}:${port}`);
  } catch (e) { return { ok: false, why: `${url.hostname}:${port} refuses a connection (${e.code ?? e.message})` }; }
  return { ok: true };
}

/** The reason the H cases give when they cannot run here, or null. */
export const hooksSkipReason = (reach) => (reach.ok ? null
  : `the example's hook installs its dependencies from the npm registry, and this machine cannot reach it: ${reach.why}`);

// ── Running a case ──────────────────────────────────────────────────────────────────────────────

/** The example scaffolded once, and once more sealed: every case copies one of them. */
export function prepare({ cli: path } = {}) {
  if (path) CLI = resolve(path);
  const base = realpathSync(mkdtempSync(join(tmpdir(), "rw-saboteur-")));
  const pristine = join(base, "pristine");
  mkdirSync(pristine);
  execFileSync("git", ["init", "-q", "."], { cwd: pristine, stdio: "ignore" });
  const init = cli(["init", "-p", ".", "--yes", "--example"], pristine);
  if (init.code !== 0) throw new Error(`init --example exited ${init.code}:\n${init.out}`);
  const sealed = join(base, "sealed");
  cpSync(pristine, sealed, { recursive: true });
  const seal = cli(["check", "--strict", "--freeze", "-p", "."], sealed);
  if (seal.code !== 0) throw new Error(`the example does not seal (exit ${seal.code}):\n${seal.out}`);
  return { base, pristine, sealed };
}

export const cleanup = (prepared) => rmSync(prepared.base, { recursive: true, force: true });

/** One case in one mode: a fresh copy of the example (sealed for S), the sabotage, the gate. */
export function runCase(c, mode, prepared) {
  const dir = mkdtempSync(join(prepared.base, `${c.id}-${mode}-`));
  try {
    cpSync(mode === "S" ? prepared.sealed : prepared.pristine, dir, { recursive: true });
    c.build(dir);
    const { code, out } = cli(["check", "--strict", "-p", ".", ...(mode === "H" ? ["--hooks"] : [])], dir);
    return { code, gateSaid: out.split("\n").filter((l) => l.includes("✗")).slice(0, 4).map((l) => l.trim()) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ── Run ───────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { cli: null, json: null, hooks: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--cli" || a === "--json") && i + 1 < argv.length) opts[a.slice(2)] = argv[++i];
    else if (a === "--no-hooks") opts.hooks = false;
    else { console.error(`usage: node test/saboteur-corpus.js [--cli <path to cli.js>] [--json <file|->] [--no-hooks]\nunknown or incomplete argument: ${a}`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let offline = null;
  if (opts.hooks) {
    offline = hooksSkipReason(await registryReach());
    if (offline) opts.hooks = false;
  }
  const say = opts.json === "-" ? (...a) => console.error(...a) : (...a) => console.log(...a);
  const prepared = prepare({ cli: opts.cli });
  const results = [];
  try {
    say(`Saboteur corpus — ${cases.length} cases (ADR-0117, ADR-0124)${opts.hooks ? "" : offline ? `, the H mode skipped: ${offline}` : ", the H mode skipped (--no-hooks)"}\n`);
    for (const c of cases) {
      const modes = Object.entries(c.expect).filter(([m]) => opts.hooks || m !== "H");
      const got = modes.map(([mode, want]) => ({ mode, want, ...runCase(c, mode, prepared) }));
      const ok = got.every((g) => g.code === g.want);
      results.push({ id: c.id, name: c.name, origin: c.origin, why: c.why, limit: c.limit, modes: got.map(({ mode, want, code, gateSaid }) => ({ mode, expected: want, observed: code, gateSaid: code === want ? [] : gateSaid })), result: ok ? "pass" : "fail" });
      const shown = got.map((g) => `${g.mode}=${g.code}${g.code === g.want ? "" : ` (expected ${g.want})`}`).join(" ");
      say(`  ${ok ? "ok  " : "FAIL"}  ${c.id}  ${shown.padEnd(14)} ${c.name}${c.limit && ok ? "  [pinned limit]" : ""}`);
    }
  } finally { cleanup(prepared); }
  const failures = results.filter((r) => r.result === "fail");
  if (opts.json) {
    const text = JSON.stringify({ corpus: "runward-saboteur-corpus", schemaVersion: 1, cli: CLI, node: process.version, platform: `${process.platform}-${process.arch}`, hooks: opts.hooks, totals: { cases: results.length, pass: results.length - failures.length, fail: failures.length }, cases: results }, null, 2) + "\n";
    if (opts.json === "-") process.stdout.write(text); else writeFileSync(resolve(opts.json), text);
  }
  say(`\n${results.length - failures.length}/${cases.length} as measured`);
  if (failures.length) {
    for (const f of failures) {
      say(`\n  ${f.id} ${f.name}`);
      for (const m of f.modes.filter((x) => x.observed !== x.expected)) say(`    ${m.mode}: expected exit ${m.expected}, got ${m.observed}${m.gateSaid.length ? `\n      ${m.gateSaid.join("\n      ")}` : ""}`);
      if (f.limit) say(`    a pinned limit moved: ${f.limit}`);
    }
    process.exit(1);
  }
  say("Every case exits as measured; the two pinned limits are still open.");
}

// Imported (by test/unit/saboteur-corpus.test.js), the module only declares its cases; run directly, it
// runs them. Compared through realpath, as the attack corpus does.
const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
