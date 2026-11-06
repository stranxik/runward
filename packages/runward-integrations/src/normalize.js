// The three reports of the first recipes, made committable as runward ADR-0073 option 1 makes them:
// no absolute path, no timing, and nothing else changed. A verdict is never touched: a failed case
// keeps its failure and its message, a finding keeps its rule, level and location, a file nothing
// executed stays a file nothing executed, and every count keeps its value.
//
// `roots` are the absolute directories whose spelling ties a report to the machine that wrote it: the
// working directory of the command, in every spelling a tool may print it (as given, resolved through
// symbolic links, with `\` on Windows, as a `file://` URL). A path under a root is rewritten relative to
// the first root, `/`-separated: the form the shipped example's committed reports carry
// (`src/core/domain/guard.ts`, `test/triage.test.ts:108:10`).
//
// Each normaliser is idempotent: a report the project's own script already normalised comes out byte
// for byte as it went in. Each throws when the text is not the document its format names, so a step
// never writes, under a report's name, something no tool of that kind wrote.
import { isAbsolute, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** The spellings of the roots, longest first, each ending with its separator. */
function prefixesOf(roots) {
  const out = new Set();
  for (const r of roots) {
    if (typeof r !== "string" || r === "") continue;
    const fwd = r.replaceAll("\\", "/").replace(/\/+$/, "");
    if (fwd === "" || !/\/./.test(fwd)) continue; // never the filesystem root: everything is under it
    out.add(`${fwd}/`);
    out.add(`${fwd.replaceAll("/", "\\")}\\`);
    out.add(`file://${fwd.startsWith("/") ? "" : "/"}${fwd}/`);
    try { out.add(`${pathToFileURL(r).href.replace(/\/+$/, "")}/`); } catch { /* not a path this platform can spell as a URL */ }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Rewrites, in any text, every path under a root as relative to it, and a bare root as `.`. */
export function relativizer(roots) {
  const prefixes = prefixesOf(roots);
  const bare = prefixes.map((p) => p.slice(0, -1));
  const prefixRe = prefixes.length ? new RegExp(prefixes.map(escapeRe).join("|"), "g") : null;
  // A bare root, not glued to a longer name (`/w/code` in `/w/code2` stays as written).
  const bareRe = bare.length ? new RegExp(`(?:${bare.map(escapeRe).join("|")})(?![\\w.-])`, "g") : null;
  const text = (s) => {
    let t = prefixRe ? s.replace(prefixRe, "") : s;
    if (bareRe) t = t.replace(bareRe, ".");
    return t;
  };
  /** A path value: relative to the first root, `/`-separated. */
  const path = (p) => {
    const s = String(p);
    for (const pre of prefixes) if (s.startsWith(pre)) return s.slice(pre.length).replaceAll("\\", "/");
    if (bare.includes(s)) return ".";
    if (isAbsolute(s) && roots[0]) {
      const r = relative(roots[0], s);
      if (!isAbsolute(r)) return r.split(sep).join("/");
    }
    return s;
  };
  return { text, path, prefixes };
}

// ── JUnit XML ────────────────────────────────────────────────────────────────────────────────────

/** Is this text a JUnit XML report? The gate's own reading is by shape too (`isJUnitReport`). */
export const isJUnit = (text) => /<testsuites?\b/.test(text);

/**
 * Removes the `file`, `time`, `timestamp` and `hostname` attributes, the trailing `duration_ms`
 * comment Node.js writes, and the roots from every text (a failure's stack names the test file by its
 * absolute path). Every suite, case, verdict, message and count is kept as the runner wrote it.
 */
export function normalizeJUnit(text, roots) {
  const t = String(text).replace(/^﻿/, "");
  if (!isJUnit(t)) throw new Error("not a JUnit XML report: no <testsuites> or <testsuite> element");
  const r = relativizer(roots);
  return r.text(t
    .replace(/(?<!\s)\s+(?:file|time|timestamp|hostname)\s*=\s*"[^"]*"/g, "")
    .replace(/(?<!\s)\s+(?:file|time|timestamp|hostname)\s*=\s*'[^']*'/g, "")
    .replace(/^[ \t]*<!--\s*duration_ms\b[^>]*-->\r?\n/gm, ""));
}

/** The cases a JUnit report records, and the verdict of each: what the step prints, never a judgement. */
export function junitCensus(text) {
  const cases = [...String(text).matchAll(/<testcase\b[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)];
  const notGreen = cases.filter((m) => m[1] !== "/>" && /<(?:failure|error|skipped)\b/.test(m[2] ?? "")).length;
  return { cases: cases.length, notGreen };
}

// ── LCOV ─────────────────────────────────────────────────────────────────────────────────────────

/** Is this text an LCOV tracefile? An empty one (nothing measured) is still one, and says so. */
export const isLcov = (text) => /^(?:TN:|SF:)/m.test(text) || /^\s*$/.test(text);

/** Rewrites each `SF:` record relative to the first root, `/`-separated. Every count is kept. */
export function normalizeLcov(text, roots) {
  const t = String(text).replace(/^﻿/, "");
  if (!isLcov(t)) throw new Error("not an LCOV tracefile: no TN: or SF: record");
  const r = relativizer(roots);
  const out = t.split(/\r?\n/).map((l) => (l.startsWith("SF:") ? `SF:${r.path(l.slice(3))}` : l)).join("\n");
  return out === "" || out.endsWith("\n") ? out : `${out}\n`;
}

/** The source files an LCOV tracefile records, and how many of them anything executed. */
export function lcovCensus(text) {
  const files = new Map();
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const l = raw.trim();
    if (l.startsWith("SF:")) { current = l.slice(3); if (!files.has(current)) files.set(current, false); continue; }
    if (current === null) continue;
    if (l === "end_of_record") { current = null; continue; }
    if ((l.startsWith("LH:") && Number(l.slice(3)) > 0) || (l.startsWith("DA:") && Number(l.split(",")[1]) > 0)) files.set(current, true);
  }
  return { files: files.size, executed: [...files.values()].filter(Boolean).length };
}

// ── SARIF 2.1.0 ──────────────────────────────────────────────────────────────────────────────────

/** The keys that carry a time, removed wherever they are. */
const TIMING = new Set(["startTimeUtc", "endTimeUtc", "timeUtc"]);
/** The keys of an invocation that name the machine that ran it, removed from `invocations[]`. */
const MACHINE = new Set(["machine", "account", "processId", "environmentVariables"]);

export function isSarif(text) {
  try { const d = JSON.parse(String(text).replace(/^﻿/, "")); return d?.version === "2.1.0" && Array.isArray(d.runs); }
  catch { return false; }
}

/**
 * Removes every timing and, in each invocation, the machine, account, process and environment; rewrites
 * every string under a root relative to it (an `artifactLocation.uri`, a working directory, a command
 * line). Every rule, result, level, message and location is kept.
 */
export function normalizeSarif(text, roots) {
  const t = String(text).replace(/^﻿/, "");
  let doc;
  try { doc = JSON.parse(t); } catch (e) { throw new Error(`not a SARIF log: not JSON (${e.message})`); }
  if (doc?.version !== "2.1.0" || !Array.isArray(doc.runs)) throw new Error("not a SARIF 2.1.0 log: no version \"2.1.0\" with a runs array");
  const r = relativizer(roots);
  const walk = (node, key, inInvocation) => {
    if (Array.isArray(node)) return node.map((x) => walk(x, key, inInvocation || key === "invocations"));
    if (node && typeof node === "object") {
      const o = {};
      for (const [k, v] of Object.entries(node)) {
        if (TIMING.has(k)) continue;
        if (inInvocation && MACHINE.has(k)) continue;
        o[k] = walk(v, k, inInvocation);
      }
      return o;
    }
    if (typeof node !== "string") return node;
    return key === "uri" ? r.path(node) : r.text(node);
  };
  return `${JSON.stringify(walk(doc, "", false), null, 2)}\n`;
}

/** The rules a SARIF log lists as in force, and its results: what the step prints. */
export function sarifCensus(text) {
  const doc = JSON.parse(String(text));
  let rules = 0, results = 0;
  for (const run of doc.runs ?? []) { rules += (run.tool?.driver?.rules ?? []).length; results += (run.results ?? []).length; }
  return { rules, results };
}

/** The normaliser of each recipe, by the id its manifest carries. */
export const NORMALIZERS = {
  junit: { format: "JUnit XML", is: isJUnit, normalize: normalizeJUnit, census: junitCensus },
  coverage: { format: "LCOV", is: isLcov, normalize: normalizeLcov, census: lcovCensus },
  sarif: { format: "SARIF 2.1.0", is: isSarif, normalize: normalizeSarif, census: sarifCensus },
};
