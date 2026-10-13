#!/usr/bin/env node
// The net-shrink guard (ADR-0090, M3): the logic of `.github/workflows/net-shrink.yml`.
//
// It compares two trees, a pull request's head and its merge base on main, and reports every way the
// test net got smaller between them. A shrink is an escalation event (ADR-0090 decision 5, « the net
// shrank »), not a refusal: the check fails until the maintainer acknowledges the shrink on the pull
// request, and then passes, with the acknowledgment on the record.
//
// What counts as a shrink, each kind read from the tree, deterministically, with no network and no
// clock:
//
//   test-file-deleted        a test file of the base is absent from the head (a file moved to another
//                            directory under the same basename is reported as moved, not deleted)
//   test-case-removed        a case of the committed JUnit inventory (reports/junit.xml) is absent from
//                            the head's. A rename is a removal plus an addition; a removed name is
//                            paired as renamed, and not counted as a shrink, only when the same test
//                            file declares it at the base and declares a new, similar name at the head
//                            (word overlap of at least one half). Unsure is a removal.
//   attack-case-dropped      an attack corpus identifier (test/audit-corpus.js, ADR-0087) assigned at
//                            the base is retired in the ledger or missing from the head's corpus
//   relation-removed         a metamorphic relation (MR-n, test/unit/verdict-metamorphic.test.js,
//                            ADR-0089) checked at the base is not checked at the head
//   runs-lowered             a `numRuns` literal, a `RUNS` constant or the RUNWARD_MR_RUNS default of a
//                            test file is lower at the head, or gone
//   properties-lowered       a test file runs fewer fast-check properties (`fc.assert`, `fc.check`)
//   coverage-floor-lowered   a coverage floor of a workflow (`FLOOR: "N"`) is lower or gone, or the
//                            coverage job stopped running `npm run coverage`
//   mutation-perimeter-shrunk a module of the whole-net mutation record is gone, or Stryker's `mutate`
//                            list lost an entry
//   skip-added               a test file of the base carries more `skip`/`todo` markers, or the JUnit
//                            inventory more skipped cases
//   assertions-lowered       a test file of the base holds fewer assertion calls (`assert(`,
//                            `assert.x(`, `expect(`); counted per file, so a test that moved its
//                            assertions into a helper of the same file is not seen, and one that moved
//                            them into another file is
//
// What it does not see, said as it is: a test whose body was weakened without losing an assertion
// call (an assertion made always-true, a fixture made trivial); a relation or property whose generator
// was narrowed; the coverage measured (the coverage job measures it, this guard reads its floor). It
// reads names and counts, not meaning.
//
// The acknowledgment (stage 1, declared, not proved): the label `net-shrink-acknowledged`, applied by
// an account holding admin permission on the repository that is not a delegate identity, AND a line in
// the pull request's body, `Net shrink acknowledged: <fingerprint> <kinds>`, where the fingerprint is
// the one this guard printed for the exact shrink it found. Any further shrink changes the fingerprint
// and the check fails again. An agent holding the maintainer's credential can apply the label and
// write the line: the label event and the line are a trace on the forge, not a proof of who decided.
//
// Pure functions are exported for test/unit/net-shrink.test.js. The CLI reads two git revisions
// (`--base <rev> --head <rev>`, `git show` only, nothing of either tree is executed) or two
// directories (`--base-dir`, `--head-dir`), and the acknowledgment from the environment the workflow
// sets. Exit 0: no shrink, or an acknowledged one. Exit 1: an unacknowledged shrink. Exit 2: usage.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { charterDelegates } from "./delegation-stop.mjs";

export const ACK_LABEL = "net-shrink-acknowledged";
export const ACK_LINE = "Net shrink acknowledged:";
export const STAGE1_NOTE =
  "stage 1: an agent holding the maintainer's credential can apply the label and write the line; the acknowledgment is declared, not proved (ADR-0088 stage 1)";
export const BUILTIN_DELEGATES = ["runward-steward[bot]"];

export const JUNIT = "reports/junit.xml";
export const CORPUS = "test/audit-corpus.js";
export const LEDGER = "test/fixtures/audit-corpus-ids.json";
export const RELATIONS = "test/unit/verdict-metamorphic.test.js";
export const WHOLENET = "docs/compliance/mutation-wholenet.json";
export const STRYKER = "stryker.config.json";

/** The test files of the net: runward's suites, the reference floor's, the shipped example's. */
export const isTestFile = (p) =>
  /^(test\/(?!fixtures\/)[^]*|floor-ts\/test\/[^]*|examples\/[^/]+\/code\/test\/[^]*)\.(js|mjs|cjs|ts|py)$/.test(p);
const isWorkflow = (p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p);

/** Every path the guard reads; the rest of a tree is never opened. */
export const isRelevant = (p) =>
  isTestFile(p) || isWorkflow(p) || p === JUNIT || p === LEDGER || p === WHOLENET || p === STRYKER;

// ---------------------------------------------------------------------------------------------------
// Extractors. Each takes text and returns plain data; none throws on malformed input.

const XML_ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENT[e.toLowerCase()]);

/** The JUnit inventory: each case keyed by its enclosing suites and name; and the skipped count. */
export function junitCases(text) {
  const cases = [];
  let skipped = 0;
  const stack = [];
  const re = /<testsuite\b([^>]*?)(\/?)>|<\/testsuite>|<testcase\b([^>]*?)(\/?)>|<skipped\b/g;
  let m;
  while ((m = re.exec(text ?? "")) !== null) {
    if (m[0].startsWith("</testsuite")) stack.pop();
    else if (m[0].startsWith("<testsuite")) { if (m[2] !== "/") stack.push(attr(m[1], "name")); }
    else if (m[0].startsWith("<testcase")) cases.push([...stack, attr(m[3], "name")].join(" > "));
    else skipped++;
  }
  return { cases, skipped };
}
function attr(attrs, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs ?? "");
  return m ? unxml(m[1]) : "";
}

/** The names a test file declares with a literal string: test(...), it(...), describe(...). */
export function declaredNames(text) {
  const out = [];
  const re = /\b(?:test|it|describe)(?:\.(?:skip|only|todo))?\(\s*(?:"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\$])*)`)/g;
  let m;
  while ((m = re.exec(text ?? "")) !== null) out.push(unescapeJs(m[1] ?? m[2] ?? m[3]));
  return out;
}

const ESC = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };
/** A string literal's body, unescaped: \uXXXX, \u{...}, \xHH, the single-letter escapes, any other char as itself. */
const unescapeJs = (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, e) =>
  e[0] === "u" ? String.fromCodePoint(parseInt(e[1] === "{" ? e.slice(2, -1) : e.slice(1), 16))
    : e[0] === "x" && e.length === 3 ? String.fromCharCode(parseInt(e.slice(1), 16)) : (ESC[e] ?? e));

const count = (text, re) => ((text ?? "").match(re) ?? []).length;
export const assertionCount = (text) => count(text, /\bassert(?:\.[A-Za-z]+)?\s*\(/g) + count(text, /\bexpect\s*\(/g);
export const skipCount = (text) =>
  count(text, /\b(?:test|it|describe|t)\.(?:skip|todo)\s*\(/g) + count(text, /[{,]\s*(?:skip|todo)\s*:/g);
export const propertyCount = (text) => count(text, /\bfc\.(?:assert|check)\s*\(/g);

/** The run counts a test file pins: `numRuns: N`, `RUNS = N`, and the RUNWARD_MR_RUNS default. */
export function runCounts(text) {
  const out = [];
  for (const re of [/\bnumRuns\s*:\s*(\d+)/g, /\bRUNS\s*=\s*(\d+)\s*;/g, /RUNWARD_MR_RUNS[^\n]*?\|\|\s*(\d+)/g]) {
    let m;
    while ((m = re.exec(text ?? "")) !== null) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

/** The attack corpus identifiers the corpus file declares. */
export const corpusIds = (text) => [...new Set([...(text ?? "").matchAll(/\b(?:attack|honest)\(\s*["'](AC-\d{3})["']/g)].map((m) => m[1]))].sort();

export function ledgerIds(text) {
  try { const j = JSON.parse(text ?? ""); return { assigned: Object.keys(j.assigned ?? {}), retired: Object.keys(j.retired ?? {}) }; }
  catch { return { assigned: [], retired: [] }; }
}

/** The relations the metamorphic file checks: test names "MR-n: ..." and holds("MR-n") calls, both needed. */
export function relations(text) {
  const named = new Set([...(text ?? "").matchAll(/\btest\(\s*["'`](MR-\d+):/g)].map((m) => m[1]));
  const held = new Set([...(text ?? "").matchAll(/\bholds\(\s*["'](MR-\d+)["']\s*\)/g)].map((m) => m[1]));
  return [...named].filter((r) => held.has(r)).sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
}

export const coverageFloors = (text) => [...(text ?? "").matchAll(/\bFLOOR:\s*["']?(\d+(?:\.\d+)?)["']?/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
export const runsCoverage = (text) => /\bnpm run coverage\b/.test(text ?? "");

export function wholenetModules(text) {
  try { return Object.keys(JSON.parse(text ?? "")).sort(); } catch { return []; }
}
export function strykerMutate(text) {
  try { const j = JSON.parse(text ?? ""); return Array.isArray(j.mutate) ? [...j.mutate].sort() : []; } catch { return []; }
}

// ---------------------------------------------------------------------------------------------------
// Comparison.

const words = (s) => new Set(s.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1));
/** Dice coefficient over the names' words: 1 identical vocabulary, 0 none shared. */
export function similarity(a, b) {
  const A = words(a), B = words(b);
  if (A.size + B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return (2 * shared) / (A.size + B.size);
}
export const RENAME_THRESHOLD = 0.5;

/** Multiset difference a - b. */
function minus(a, b) {
  const left = new Map();
  for (const x of b) left.set(x, (left.get(x) ?? 0) + 1);
  const out = [];
  for (const x of a) { const n = left.get(x) ?? 0; if (n > 0) left.set(x, n - 1); else out.push(x); }
  return out;
}

/** Values of `before` not matched, greedily, by a value of `after` at least as high. Sorted inputs. */
function lowered(before, after) {
  const pool = [...after];
  const out = [];
  for (const v of [...before].sort((a, b) => b - a)) {
    let best = -1;
    for (let i = 0; i < pool.length; i++) if (pool[i] >= v && (best === -1 || pool[i] < pool[best])) best = i;
    if (best === -1) out.push(v); else pool.splice(best, 1);
  }
  return out.sort((a, b) => a - b);
}

/**
 * A snapshot is { paths: string[], read(path): string | null }. Returns the findings, sorted, each
 * { kind, shrink, where, detail }: `shrink: false` marks what is reported for the reader (a rename,
 * a moved file) and does not escalate.
 */
export function compareNets(base, head) {
  const out = [];
  const add = (kind, shrink, where, detail) => out.push({ kind, shrink, where, detail });
  const headPaths = new Set(head.paths);
  const baseTests = base.paths.filter(isTestFile).sort();
  const headTests = head.paths.filter(isTestFile).sort();
  const addedTests = headTests.filter((p) => !base.paths.includes(p));

  // Test files.
  for (const p of baseTests) {
    if (headPaths.has(p)) continue;
    const moved = addedTests.filter((q) => basename(q) === basename(p));
    if (moved.length > 0) add("test-file-moved", false, p, `moved to ${moved.join(", ")}`);
    else add("test-file-deleted", true, p, "a test file of the base is absent from the head");
  }

  // Test cases, from the JUnit inventory, renames paired by file and name.
  const bj = junitCases(base.read(JUNIT)), hj = junitCases(head.read(JUNIT));
  const removed = minus(bj.cases, hj.cases), addedCases = new Set(minus(hj.cases, bj.cases));
  if (removed.length > 0) {
    const declaredAt = (snap, paths) => {
      const m = new Map();
      for (const p of paths) for (const n of declaredNames(snap.read(p))) { if (!m.has(n)) m.set(n, []); m.get(n).push(p); }
      return m;
    };
    const baseDecl = declaredAt(base, baseTests);
    const headDecl = declaredAt(head, headTests);
    const baseNamesOf = new Map(baseTests.map((p) => [p, new Set(declaredNames(base.read(p)))]));
    const taken = new Set();
    for (const r of removed) {
      const leaf = r.split(" > ").at(-1);
      const files = baseDecl.get(leaf) ?? [];
      let pick = null;
      for (const f of files) {
        if (!headPaths.has(f)) continue;
        for (const a of [...addedCases].sort()) {
          if (taken.has(a)) continue;
          const aLeaf = a.split(" > ").at(-1);
          if (!(headDecl.get(aLeaf) ?? []).includes(f) || baseNamesOf.get(f).has(aLeaf)) continue;
          const s = similarity(leaf, aLeaf);
          if (s >= RENAME_THRESHOLD && (!pick || s > pick.s)) pick = { a, f, s };
        }
      }
      if (pick) { taken.add(pick.a); add("test-case-renamed", false, pick.f, `"${r}" -> "${pick.a}" (same file, word overlap ${pick.s.toFixed(2)})`); }
      else add("test-case-removed", true, files[0] ?? JUNIT, `"${r}" is in the base's JUnit inventory and not in the head's${files.length ? "" : " (no test file of the base declares it with a literal name)"}`);
    }
  }
  if (hj.skipped > bj.skipped) add("skip-added", true, JUNIT, `skipped cases ${bj.skipped} -> ${hj.skipped}`);

  // Attack corpus.
  const bl = ledgerIds(base.read(LEDGER)), hl = ledgerIds(head.read(LEDGER));
  const hc = new Set(corpusIds(head.read(CORPUS)));
  const baseIds = [...new Set([...bl.assigned, ...corpusIds(base.read(CORPUS))])].sort();
  for (const id of baseIds) {
    if (hl.retired.includes(id)) add("attack-case-dropped", true, LEDGER, `${id} retired in the ledger`);
    else if (!hc.has(id)) add("attack-case-dropped", true, CORPUS, `${id} is no longer declared by the corpus`);
  }

  // Metamorphic relations.
  const hr = new Set(relations(head.read(RELATIONS)));
  for (const r of relations(base.read(RELATIONS))) if (!hr.has(r)) add("relation-removed", true, RELATIONS, `${r} is no longer checked`);

  // Per test file: run counts, properties, skips, assertions.
  for (const p of baseTests) {
    if (!headPaths.has(p)) continue;
    const b = base.read(p), h = head.read(p);
    if (b === h) continue;
    const low = lowered(runCounts(b), runCounts(h));
    if (low.length) add("runs-lowered", true, p, `run counts [${runCounts(b).join(", ")}] -> [${runCounts(h).join(", ")}]`);
    if (propertyCount(h) < propertyCount(b)) add("properties-lowered", true, p, `fast-check properties ${propertyCount(b)} -> ${propertyCount(h)}`);
    if (skipCount(h) > skipCount(b)) add("skip-added", true, p, `skip/todo markers ${skipCount(b)} -> ${skipCount(h)}`);
    if (assertionCount(h) < assertionCount(b)) add("assertions-lowered", true, p, `assertion calls ${assertionCount(b)} -> ${assertionCount(h)}`);
  }

  // Coverage floor.
  for (const p of base.paths.filter(isWorkflow).sort()) {
    const b = base.read(p), h = headPaths.has(p) ? head.read(p) : null;
    const low = lowered(coverageFloors(b), coverageFloors(h));
    if (low.length) add("coverage-floor-lowered", true, p, `coverage floors [${coverageFloors(b).join(", ")}] -> [${coverageFloors(h).join(", ")}]`);
    if (runsCoverage(b) && !runsCoverage(h)) add("coverage-floor-lowered", true, p, "the workflow no longer runs `npm run coverage`");
  }

  // Mutation perimeter.
  const hm = new Set(wholenetModules(head.read(WHOLENET)));
  for (const m of wholenetModules(base.read(WHOLENET))) if (!hm.has(m)) add("mutation-perimeter-shrunk", true, WHOLENET, `module ${m} left the whole-net record`);
  for (const m of minus(strykerMutate(base.read(STRYKER)), strykerMutate(head.read(STRYKER)))) add("mutation-perimeter-shrunk", true, STRYKER, `mutate entry ${m} removed`);

  const key = (f) => `${f.kind}\u0000${f.where}\u0000${f.detail}`;
  return out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** The shrink's fingerprint: the first 12 hex of SHA-256 over its sorted findings. Empty when none. */
export function fingerprint(findings) {
  const s = findings.filter((f) => f.shrink).map((f) => `${f.kind} ${f.where} ${f.detail}`).sort();
  return s.length ? createHash("sha256").update(s.join("\n")).digest("hex").slice(0, 12) : "";
}

export const shrinkKinds = (findings) => [...new Set(findings.filter((f) => f.shrink).map((f) => f.kind))].sort();

/**
 * Whether a shrink is acknowledged: the label is on the pull request; its last application was by an
 * account with admin permission that is not a delegate; and one line of the body starts with
 * "Net shrink acknowledged:" and carries the fingerprint and every kind found. Returns { ok, reason }.
 */
export function acknowledged({ findings, labels = [], labeler = "", labelerPermission = "", body = "", delegates = [] }) {
  const fp = fingerprint(findings);
  if (!fp) return { ok: true, reason: "no shrink" };
  if (!labels.includes(ACK_LABEL)) return { ok: false, reason: `no \`${ACK_LABEL}\` label` };
  const fold = (s) => String(s).trim().toLowerCase();
  if ([...BUILTIN_DELEGATES, ...delegates].some((d) => fold(d) === fold(labeler))) return { ok: false, reason: `the label was applied by ${labeler}, a delegate identity` };
  if (labelerPermission !== "admin") return { ok: false, reason: `the label was applied by ${labeler || "an unknown account"}, whose permission is ${labelerPermission || "unknown"}, not admin` };
  const lines = String(body ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith(ACK_LINE));
  const kinds = shrinkKinds(findings);
  const good = lines.find((l) => new RegExp(`\\b${fp}\\b`).test(l) && kinds.every((k) => new RegExp(`(^|[^a-z-])${k}([^a-z-]|$)`).test(l)));
  if (!good) return { ok: false, reason: `no body line \`${ACK_LINE} ${fp} ${kinds.join(" ")}\`` };
  return { ok: true, reason: `acknowledged by ${labeler} (admin): "${good}"` };
}

// ---------------------------------------------------------------------------------------------------
// Snapshots and the command line.

export function gitSnapshot(rev, cwd = process.cwd()) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const paths = git("ls-tree", "-r", "--name-only", "-z", rev).split("\0").filter(Boolean).filter(isRelevant);
  const set = new Set(paths);
  const cache = new Map();
  return {
    paths,
    read(p) {
      if (!set.has(p)) return null;
      if (!cache.has(p)) cache.set(p, git("show", `${rev}:${p}`));
      return cache.get(p);
    },
  };
}

export function dirSnapshot(dir) {
  const root = resolve(dir);
  const paths = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) { const rel = relative(root, full).split(sep).join("/"); if (isRelevant(rel)) paths.push(rel); }
    }
  };
  walk(root);
  paths.sort();
  const set = new Set(paths);
  return { paths, read: (p) => (set.has(p) ? readFileSync(join(root, p), "utf8") : null) };
}

export function render(findings) {
  const fp = fingerprint(findings);
  const lines = [];
  const shrinks = findings.filter((f) => f.shrink), notes = findings.filter((f) => !f.shrink);
  lines.push(shrinks.length ? `the net shrank: ${shrinks.length} finding(s), kinds ${shrinkKinds(findings).join(", ")}; fingerprint ${fp}` : "the net did not shrink");
  for (const f of shrinks) lines.push(`  SHRINK ${f.kind}  ${f.where}  ${f.detail}`);
  for (const f of notes) lines.push(`  note   ${f.kind}  ${f.where}  ${f.detail}`);
  return lines;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function main() {
  const base = arg("--base"), head = arg("--head"), baseDir = arg("--base-dir"), headDir = arg("--head-dir");
  if (!((base && head) || (baseDir && headDir))) {
    console.error("usage: net-shrink.mjs --base <rev> --head <rev> [--json]  |  --base-dir <dir> --head-dir <dir> [--json]");
    process.exit(2);
  }
  if (baseDir && !(existsSync(baseDir) && statSync(baseDir).isDirectory())) { console.error(`net-shrink: ${baseDir} is not a directory`); process.exit(2); }
  const findings = compareNets(base ? gitSnapshot(base) : dirSnapshot(baseDir), head ? gitSnapshot(head) : dirSnapshot(headDir));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ fingerprint: fingerprint(findings), kinds: shrinkKinds(findings), findings }, null, 1));
    process.exit(0);
  }
  let labels = [];
  try { labels = JSON.parse(process.env.PR_LABELS || "[]"); } catch { labels = []; }
  const charter = process.env.CHARTER_FILE && existsSync(process.env.CHARTER_FILE) ? readFileSync(process.env.CHARTER_FILE, "utf8") : "";
  const delegates = charterDelegates(charter);
  const ack = acknowledged({ findings, labels, labeler: process.env.ACK_LABELER ?? "", labelerPermission: process.env.ACK_LABELER_PERMISSION ?? "", body: process.env.PR_BODY ?? "", delegates });
  const fp = fingerprint(findings);
  const out = [...render(findings)];
  if (fp) out.push(ack.ok ? `ACKNOWLEDGED: ${ack.reason}` : `ESCALATED: ${ack.reason}. The maintainer acknowledges a legitimate shrink with the \`${ACK_LABEL}\` label and the body line \`${ACK_LINE} ${fp} ${shrinkKinds(findings).join(" ")}\` (runward/runbook.md, section 7)`);
  out.push(STAGE1_NOTE);
  for (const l of out) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### net shrink\n\n\`\`\`\n${out.join("\n")}\n\`\`\`\n`); } catch { /* the log carries it */ }
  }
  if (fp && !ack.ok) {
    console.log(`::error::the net shrank (${shrinkKinds(findings).join(", ")}; fingerprint ${fp}) and the shrink is not acknowledged (ADR-0090, M3)`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
