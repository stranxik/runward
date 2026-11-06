/**
 * The built-in analyzers (ADR-0118): the delivered code, read against the invariants the mission
 * declares.
 *
 * WHAT THIS IS. A deterministic reading of source text at rest. It runs nothing, loads nothing it
 * reads, calls no model and no network, and needs none of the adopter's tooling: it opens the files of
 * the project tree, blanks their comments and the contents of their literals, and looks for what a
 * declaration says must not be there. Same tree, same policy, same findings (ADR-0054, crossing 4).
 *
 * WHAT IT CHECKS, in five families, under the policy the mission pins (analysis-policy.ts):
 *   boundary        the files `runward/territory.md` binds to `domain-core` import nothing outside
 *                   the core except the modules `runward/analysis.md` allows;
 *   capability      no analysed file outside the tests executes code built at run time (eval, the
 *                   Function constructor, the vm module), spawns a process, or loads a module whose
 *                   name is computed; the domain core also reads no environment and opens no network;
 *   secret          no file holds a credential of a known format;
 *   test-integrity  every test case asserts something, a test file can reach the code it tests, and a
 *                   cited JUnit report records no case its sources do not declare;
 *   symbol          a symbol a manifest cites is carried by code, not only by strings, and is not a
 *                   placeholder constant (a name only in comments is the evidence layer's refusal, ADR-0114).
 *
 * WHAT IT NEVER SAYS. That the code is good. A finding is an invariant the mission declared and the
 * code breaks; an empty list is the absence of those findings, nothing more. What the reading cannot
 * settle is a `hypothesis` (ADR-0041's labelled class): reported beside the findings, never counted.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { ANALYSIS_POLICIES, type AnalysisPolicy } from "./analysis-policy.js";
import { applyTerritoryMap, readTerritoryMap, type TerritoryMap } from "./territory-map.js";
import { globToRegExp, normalizeForPath } from "./rules.js";
import { GATED_DELIVERABLES, readManifest } from "./conformance.js";
import { committedJUnitLedger, parseEvidencePointers, resolutionBases, resolveEvidencePath, symbolPresent } from "./evidence.js";
import { junitProjection } from "./tool-adapters.js";
import { toPosix } from "./paths.js";
import { isRunwardStatement } from "./attestation.js";
import { deliveredEntries } from "./delivered-tree.js";

/** The mission file that holds the allowances, beside territory.md. Never written by runward. */
export const ANALYSIS_FILE = "analysis.md";

export type AnalysisFamily = "boundary" | "capability" | "secret" | "test-integrity" | "symbol" | "policy";

export interface AnalysisFinding {
  family: AnalysisFamily;
  /** Stable identifier of the check, e.g. `core-import-package`, `code-execution`, `secret-npm-token`. */
  check: string;
  /** Project-relative, `/`-separated. */
  path: string;
  /** 1-based, or null for a whole-file fact. */
  line: number | null;
  message: string;
}

export interface AnalysisReading {
  /** The policy id the mission pins, as written. */
  policy: string;
  /** False when this version does not ship that policy: nothing was read, one finding says why. */
  known: boolean;
  files: { analysed: number; tests: number; core: number; config: number };
  /** Counted against the verdict under --strict. */
  findings: AnalysisFinding[];
  /** ADR-0041: what the reading cannot settle. Reported, never counted. */
  hypotheses: AnalysisFinding[];
  /** What was not read, and why: languages the policy does not cover, files over its size, links
   *  not followed, families with nothing declared to check against. Disclosed, never counted. */
  notAnalyzed: Array<{ what: string; files: number; examples: string[] }>;
  /** Directories set aside by the policy or by the mission, project-relative. */
  excluded: Array<{ path: string; by: string }>;
  allowances: {
    file: string;
    present: boolean;
    /** Allowance rows that set aside at least one finding or file in this run. */
    used: Array<{ line: number; text: string; uses: number }>;
    /** Rows that set aside nothing: a stale allowance hides the next real one (ADR-0043's rot rule). */
    inert: Array<{ line: number; text: string }>;
    /** Rows that could not be read, named rather than dropped. */
    problems: Array<{ line: number; text: string; problem: string }>;
  };
  nonScope: string;
}

/** What a reading of the analyzers never claims; carried with every reading, like GATE_NON_SCOPE. */
export const ANALYSIS_NON_SCOPE =
  "The built-in analyzers read the delivered source text at rest, under the policy the mission pins; they run " +
  "nothing and call no model. A finding is an invariant the mission declared (its territory, its allowances, its " +
  "cited symbols, its committed reports) that the code breaks. No finding is not a judgment that the code is good, " +
  "correct or secure: it says these checks found nothing, in the languages the policy reads.";

// ── The opt-in ────────────────────────────────────────────────────────────────────────────────────

/** The analysis pin a mission declares in its scaffold-lock, or null when it has not opted in. The
 *  raw value is returned as written: a malformed pin is refused by the reading, never repaired. */
export function analysisPin(missionDir: string): { raw: unknown } | null {
  try {
    const j = JSON.parse(readFileSync(join(missionDir, "scaffold-lock.json"), "utf8")) as Record<string, unknown> | null;
    if (!j || typeof j !== "object" || !("analysis" in j)) return null;
    return { raw: j.analysis };
  } catch { return null; }
}

// ── Masking: comments and literal contents blanked, offsets kept ─────────────────────────────────

export interface Literal {
  start: number;
  /** Index after the closing delimiter. */
  end: number;
  kind: "string" | "template" | "regex";
  /** A template literal with at least one `${…}` substitution. */
  dynamic: boolean;
}

export interface Masked {
  /** The source with comments and the contents of string, template-text and regular-expression
   *  literals replaced by spaces. Delimiters, newlines and every offset are kept, so an index into
   *  `code` is an index into the source; the code inside `${…}` stays readable. */
  code: string;
  literals: Literal[];
  lineStarts: number[];
}

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
/** After one of these, a `/` opens a regular expression; after a value, it divides. */
const REGEX_AFTER_PUNCT = new Uint8Array(128);
for (const ch of "(,=:[!&|?{};+-*%<>~^") REGEX_AFTER_PUNCT[ch.charCodeAt(0)] = 1;
const isWordCode = (c: number): boolean => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95 || c === 36;
const isSpaceCode = (c: number): boolean => c === 32 || c === 10 || c === 9 || c === 13 || c === 11 || c === 12 || c === 160 || c === 0xfeff;
const isWord = (ch: string | undefined): boolean => ch !== undefined && ch.length > 0 && isWordCode(ch.charCodeAt(0));

/** A UTF-16 buffer back to a string. The native decoder where the machine stores the buffer
 *  little-endian, as it decodes it (a byte-order mark kept, so no offset moves); slices of
 *  `fromCharCode` elsewhere. */
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const UTF16 = LITTLE_ENDIAN ? new TextDecoder("utf-16le", { ignoreBOM: true }) : null;
function fromCodes(codes: Uint16Array): string {
  if (UTF16) return UTF16.decode(codes);
  let out = "";
  for (let k = 0; k < codes.length; k += 8192) out += String.fromCharCode(...codes.subarray(k, k + 8192));
  return out;
}

export function maskSource(src: string): Masked {
  const n = src.length;
  const out = new Uint16Array(n);
  for (let k = 0; k < n; k++) out[k] = src.charCodeAt(k);
  const literals: Literal[] = [];
  const blank = (a: number, b: number): void => {
    for (let k = a; k < b; k++) { const ch = out[k]; if (ch !== 10 && ch !== 13) out[k] = 32; }
  };
  // One entry per open `${`: the brace depth inside it, and the template literal it belongs to.
  const depth: number[] = [];
  const owner: number[] = [];
  // The last significant character of code (0 before any), and where the last word was, when it was one.
  let last = 0;
  let wordStart = -1;
  let wordEnd = -1;
  const operand = (): void => { last = 120; wordStart = -1; }; // a value: a slash after it divides

  // Template text from `from` (just after a backtick, or after the `}` closing a substitution): blanked
  // up to the closing backtick or the next `${`. Returns where code resumes.
  const templateText = (from: number, lit: number): number => {
    let j = from;
    while (j < n) {
      const ch = src.charCodeAt(j);
      if (ch === 92) { j += 2; continue; }
      if (ch === 96) { blank(from, j); literals[lit].end = j + 1; operand(); return j + 1; }
      if (ch === 36 && src.charCodeAt(j + 1) === 123) {
        blank(from, j);
        literals[lit].dynamic = true;
        depth.push(0); owner.push(lit);
        last = 123; wordStart = -1;
        return j + 2;
      }
      j++;
    }
    blank(from, n); literals[lit].end = n;
    return n;
  };

  let i = 0;
  if (src.startsWith("#!")) { const e = src.indexOf("\n"); i = e < 0 ? n : e; blank(0, i); }
  while (i < n) {
    const ch = src.charCodeAt(i);
    if (ch === 47) {
      const nx = src.charCodeAt(i + 1);
      if (nx === 47) { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
      if (nx === 42) { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
      // A word is the last token only while nothing but white space and comments followed it.
      const afterWord = wordStart !== -1 && REGEX_AFTER_WORD.has(src.slice(wordStart, wordEnd));
      if (last === 0 || (last < 128 && REGEX_AFTER_PUNCT[last] === 1) || afterWord) {
        let j = i + 1;
        let cls = false;
        let ok = false;
        while (j < n) {
          const c = src.charCodeAt(j);
          if (c === 10) break;
          if (c === 92) { j += 2; continue; }
          if (c === 91) cls = true;
          else if (c === 93) cls = false;
          else if (c === 47 && !cls) { ok = true; break; }
          j++;
        }
        if (ok && j > i + 1) {
          let k = j + 1;
          while (k < n && isAsciiLetter(src.charCodeAt(k))) k++;
          blank(i + 1, j);
          literals.push({ start: i, end: k, kind: "regex", dynamic: false });
          operand(); i = k;
          continue;
        }
      }
      last = ch; wordStart = -1; i++;
      continue;
    }
    if (ch === 34 || ch === 39) {
      let j = i + 1;
      while (j < n) { const c = src.charCodeAt(j); if (c === ch || c === 10) break; j += c === 92 ? 2 : 1; }
      const closed = j < n && src.charCodeAt(j) === ch;
      const stop = Math.min(j, n);
      blank(i + 1, stop);
      const end = closed ? j + 1 : stop;
      literals.push({ start: i, end, kind: "string", dynamic: false });
      operand(); i = end;
      continue;
    }
    if (ch === 96) {
      literals.push({ start: i, end: n, kind: "template", dynamic: false });
      i = templateText(i + 1, literals.length - 1);
      continue;
    }
    if (depth.length > 0 && ch === 125) {
      if (depth[depth.length - 1] === 0) {
        depth.pop();
        const lit = owner.pop()!;
        i = templateText(i + 1, lit);
        continue;
      }
      depth[depth.length - 1]--;
    } else if (depth.length > 0 && ch === 123) {
      depth[depth.length - 1]++;
    }
    if (isWordCode(ch)) {
      let j = i + 1;
      while (j < n && isWordCode(src.charCodeAt(j))) j++;
      wordStart = i; wordEnd = j; last = src.charCodeAt(j - 1);
      i = j;
      continue;
    }
    if (!isSpaceCode(ch)) { last = ch; wordStart = -1; }
    i++;
  }
  const lineStarts = [0];
  for (let k = src.indexOf("\n"); k !== -1; k = src.indexOf("\n", k + 1)) lineStarts.push(k + 1);
  return { code: fromCodes(out), literals, lineStarts };
}

const isAsciiLetter = (c: number): boolean => (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
/** Every character a regular expression gives a meaning to, backslash included: a name is escaped
 *  whole before it is built into a pattern, whatever it contains. */
const RE_SPECIAL = /[.*+?^${}()|[\]\\/]/g;

/** 1-based line of an offset. */
export function lineOf(m: Pick<Masked, "lineStarts">, index: number): number {
  let lo = 0;
  let hi = m.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m.lineStarts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

/** The value of a string or substitution-free template literal, its escapes read as JavaScript reads
 *  them. Null for a regex or a template with substitutions. */
export function literalValue(src: string, lit: Literal): string | null {
  if (lit.kind === "regex" || lit.dynamic) return null;
  const close = src[lit.end - 1];
  const open = src[lit.start];
  const inner = src.slice(lit.start + 1, close === open && lit.end - 1 > lit.start ? lit.end - 1 : lit.end);
  return inner.replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|\n|\r)|([\s\S]))/g,
    (_w, cp: string | undefined, u4: string | undefined, x2: string | undefined, nl: string | undefined, ch: string | undefined) => {
      if (cp !== undefined) { const v = parseInt(cp, 16); return v <= 0x10ffff ? String.fromCodePoint(v) : ""; }
      if (u4 !== undefined) return String.fromCharCode(parseInt(u4, 16));
      if (x2 !== undefined) return String.fromCharCode(parseInt(x2, 16));
      if (nl !== undefined) return "";
      return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" } as Record<string, string>)[ch!] ?? ch!;
    });
}

// ── Imports ───────────────────────────────────────────────────────────────────────────────────────

export interface ImportRef {
  /** The module named, or null when the name is computed at run time. */
  spec: string | null;
  how: "static" | "dynamic" | "call";
  typeOnly: boolean;
  index: number;
}

const LOADER = /(?<![\w$.])(import|require)\s*\(/g;

/** The word that ends at `end` in masked code, and where it starts; null when none does. */
function wordEndingAt(code: string, end: number): { word: string; start: number } | null {
  let k = end;
  while (k > 0 && isWordCode(code.charCodeAt(k - 1))) k--;
  return k === end ? null : { word: code.slice(k, end), start: k };
}
/** Is the token before `at` a `.`? A member named like a keyword (`obj.import`) is never a statement. */
function memberBefore(code: string, at: number): boolean {
  let k = at - 1;
  while (k >= 0 && isSpaceCode(code.charCodeAt(k))) k--;
  return k >= 0 && code.charCodeAt(k) === 46;
}

/** Every module a file names, statically or at run time, with the computed ones as `spec: null`. */
export function importsOf(src: string, m: Masked): ImportRef[] {
  const out: ImportRef[] = [];
  const byStart = new Map(m.literals.map((l) => [l.start, l]));
  const code = m.code;
  for (const lit of m.literals) {
    if (lit.kind === "regex" || lit.dynamic) continue;
    // The token right before the literal decides: the keyword `from` or `import` (a static or a
    // side-effect import), or an opening parenthesis after `import` or `require` (a dynamic load).
    let p = lit.start - 1;
    while (p >= 0 && isSpaceCode(code.charCodeAt(p))) p--;
    if (p < 0) continue;
    let how: ImportRef["how"] | null = null;
    if (code.charCodeAt(p) === 40) {
      let q = p;
      while (q > 0 && isSpaceCode(code.charCodeAt(q - 1))) q--;
      const w = wordEndingAt(code, q);
      if (w && !memberBefore(code, w.start)) how = w.word === "import" ? "dynamic" : w.word === "require" ? "call" : null;
    } else if (isWordCode(code.charCodeAt(p))) {
      const w = wordEndingAt(code, p + 1);
      if (w && (w.word === "from" || w.word === "import") && !memberBefore(code, w.start)) how = "static";
    }
    if (how === null) continue;
    const spec = literalValue(src, lit);
    if (spec === null) continue;
    let typeOnly = false;
    if (how === "static") {
      const head = code.slice(Math.max(0, lit.start - 4000), lit.start);
      let stmt = -1;
      for (const k of head.matchAll(/(?<![\w$.])(?:import|export)\b/g)) stmt = k.index;
      if (stmt === -1) continue; // a `from` that belongs to no import or export statement
      typeOnly = /^(?:import|export)\s+type\b/.test(head.slice(stmt));
    }
    out.push({ spec, how, typeOnly, index: lit.start });
  }
  for (const k of code.matchAll(LOADER)) {
    let j = k.index + k[0].length;
    while (j < code.length && isSpaceCode(code.charCodeAt(j))) j++;
    const c = code[j];
    if (c === "\"" || c === "'") continue;
    if (c === "`" && byStart.get(j)?.dynamic === false) continue;
    if (c === ")") continue; // an empty call names nothing
    if (/(?:function|\.)\s*$/.test(code.slice(Math.max(0, k.index - 16), k.index))) continue;
    out.push({ spec: null, how: k[1] === "import" ? "dynamic" : "call", typeOnly: false, index: k.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

interface ImportBinding {
  /** Names bound to the whole module (`import x from`, `import * as x from`, `const x = require()`). */
  wholes: string[];
  /** Members bound or read by name: the member, the local name (null when read in place), a type only. */
  members: Array<{ name: string; local: string | null; type: boolean }>;
  /** [start, end) of the statement that binds them: a name met there is the binding, not a use. */
  clause: [number, number];
}

/** What an import of a literal module binds, read from its statement; null when this reading cannot
 *  follow it (a re-export, a side-effect or dynamic import, a `require` inside an expression or assigned
 *  to an existing name, a rest or nested pattern). */
function bindingsOf(m: Masked, imp: ImportRef): ImportBinding | null {
  const code = m.code;
  const lit = imp.spec === null ? undefined : m.literals.find((l) => l.start === imp.index);
  if (!lit) return null;
  if (imp.how === "static") {
    const from = Math.max(0, imp.index - 4000);
    let stmt = -1;
    for (const k of code.slice(from, imp.index).matchAll(/(?<![\w$.])(?:import|export)\b/g)) stmt = k.index;
    const text = stmt === -1 ? "" : code.slice(from + stmt, imp.index);
    const lead = /^import\s+(?:type\s+)?/.exec(text);
    const tail = /(?<![\w$.])from\s*$/.exec(text);
    if (!lead || !tail || tail.index < lead[0].length) return null; // `export … from`, `import 'x'`
    const out: ImportBinding = { wholes: [], members: [], clause: [from + stmt, lit.end] };
    const clause = text.slice(lead[0].length, tail.index).trim();
    const brace = clause.indexOf("{");
    for (const part of (brace === -1 ? clause : clause.slice(0, brace)).split(",").map((s) => s.trim()).filter(Boolean)) {
      const w = /^(?:\*\s*as\s+)?([A-Za-z_$][\w$]*)$/.exec(part);
      if (!w) return null;
      out.wholes.push(w[1]);
    }
    if (brace !== -1) {
      const inner = /^\{([\s\S]*)\}$/.exec(clause.slice(brace).trim());
      if (!inner) return null;
      for (const item of inner[1].split(",").map((s) => s.trim()).filter(Boolean)) {
        const it = /^(type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(item);
        if (!it) return null;
        if (it[2] === "default") { if (!it[1]) out.wholes.push(it[3] ?? it[2]); continue; }
        out.members.push({ name: it[2], local: it[3] ?? it[2], type: imp.typeOnly || it[1] !== undefined });
      }
    }
    return out;
  }
  if (imp.how !== "call") return null;
  // `require('node:net')`: the call around the literal, then what it is bound to.
  const p = skipBack(code, imp.index - 1);
  const req = code[p] === "(" ? wordEndingAt(code, skipBack(code, p - 1) + 1) : null;
  if (!req || req.word !== "require") return null;
  const e = skipAhead(code, lit.end);
  if (code[e] !== ")") return null;
  const member = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(code.slice(e + 1, e + 200));
  const end = e + 1 + (member ? member[0].length : 0);
  const r = skipBack(code, req.start - 1);
  if (code[r] !== "=" || "=!<>".includes(code[r - 1] ?? "")) {
    return member ? { wholes: [], members: [{ name: member[1], local: null, type: false }], clause: [req.start, end] } : null;
  }
  const t = skipBack(code, r - 1);
  let pattern: string | null = null;
  let name: string | null = null;
  let start: number;
  if (code[t] === "}") {
    start = opening(code, t);
    if (start === -1) return null;
    pattern = code.slice(start + 1, t);
  } else {
    const w = wordEndingAt(code, t + 1);
    if (!w) return null;
    name = w.word;
    start = w.start;
  }
  const kw = wordEndingAt(code, skipBack(code, start - 1) + 1);
  if (!kw || !/^(?:const|let|var|import)$/.test(kw.word)) return null;
  const clause: [number, number] = [kw.start, end];
  if (name !== null) {
    return member ? { wholes: [], members: [{ name: member[1], local: name, type: false }], clause } : { wholes: [name], members: [], clause };
  }
  if (member || pattern === null) return null;
  const members: ImportBinding["members"] = [];
  for (const item of topLevelItems(pattern)) {
    const it = /^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?(?:\s*=[\s\S]*)?$/.exec(item.text);
    if (!it) return null;
    members.push({ name: it[1], local: it[2] ?? it[1], type: false });
  }
  return { wholes: [], members, clause };
}

/** The members of a whole-module binding the file reads (`http.METHODS`); null when the binding is used
 *  otherwise (handed on, called, indexed): what it reaches is then the whole module. */
function memberReads(code: string, name: string, clause: [number, number]): string[] | null {
  const out: string[] = [];
  for (const k of code.matchAll(new RegExp(`(?<![\\w$.])${name.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`, "g"))) {
    if (k.index >= clause[0] && k.index < clause[1]) continue;
    const mm = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(code.slice(k.index + name.length, k.index + name.length + 200));
    if (!mm) return null;
    out.push(mm[1]);
  }
  return out;
}

/** What a network module also exports that opens nothing: constant tables and pure string predicates. An
 *  import that binds and reads only these is a built-in import, judged by the boundary like any other. */
const NETWORK_INERT: Readonly<Record<string, readonly string[]>> = {
  http: ["METHODS", "STATUS_CODES", "maxHeaderSize", "validateHeaderName", "validateHeaderValue"],
  http2: ["constants", "getDefaultSettings", "getPackedSettings", "getUnpackedSettings", "sensitiveHeaders"],
  net: ["isIP", "isIPv4", "isIPv6"],
  tls: ["DEFAULT_CIPHERS", "DEFAULT_ECDH_CURVE", "DEFAULT_MAX_VERSION", "DEFAULT_MIN_VERSION", "getCiphers", "rootCertificates"],
};

/** Does this import of a network module put the network in the file's reach? Judged by what it binds and
 *  reads: a type-only import binds no value, `{ METHODS }` or `http.STATUS_CODES` reads a table. What the
 *  reading cannot follow is judged by what it could reach: the network. */
function opensNetwork(m: Masked, imp: ImportRef, module: string): boolean {
  if (imp.typeOnly) return false;
  const b = bindingsOf(m, imp);
  if (b === null) return true;
  const used = b.members.filter((x) => !x.type).map((x) => x.name);
  for (const w of b.wholes) {
    const reads = memberReads(m.code, w, b.clause);
    if (reads === null) return true;
    used.push(...reads);
  }
  const inert = NETWORK_INERT[module] ?? [];
  return used.some((n) => !inert.includes(n));
}

/** The innermost block `{…}` around `index`, or the whole module. */
function blockAround(code: string, index: number): { start: number; end: number } {
  let depth = 0;
  for (let k = index - 1; k >= 0; k--) {
    if (code[k] === "}") depth++;
    else if (code[k] === "{") {
      if (depth === 0) { const close = closing(code, k); return { start: k, end: close === -1 ? code.length : close }; }
      depth--;
    }
  }
  return { start: 0, end: code.length };
}

/** Is the declaration starting at `head` a statement of its own: not exported (`export function f`), not a
 *  value handed somewhere (`module.exports = function f`, `use(function f() {})`)? */
function standsAlone(code: string, head: number): boolean {
  const p = skipBack(code, head - 1);
  if (p < 0) return true;
  const w = wordEndingAt(code, p + 1);
  if (w?.word === "async") return standsAlone(code, w.start);
  if (w) return !/^(?:export|default|return|await|yield|typeof|void|new|delete|throw|case|in|of|extends)$/.test(w.word);
  return ";{})".includes(code[p]);
}

/** The literal each call of `f` passes at parameter `pos`, when `f` is not exported, is only ever called by
 *  its name in this file (never handed on, never read), and never reassigns that parameter; null otherwise. */
function literalCalls(src: string, m: Masked, f: FnSpan, pos: number, param: string): string[] | null {
  const code = m.code;
  if (f.name === null || f.nameAt < 0 || pos < 0 || !standsAlone(code, f.head)) return null;
  const p = param.replace(RE_SPECIAL, "\\$&");
  if (new RegExp(`(?<![\\w$.])(?:const|let|var)\\s+${p}(?![\\w$])|(?<![\\w$.])${p}\\s*(?:\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])`)
    .test(code.slice(f.bodyStart, f.bodyEnd))) return null;
  const values = new Set<string>();
  for (const k of code.matchAll(new RegExp(`(?<![\\w$.])${f.name.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`, "g"))) {
    if (k.index === f.nameAt) continue;
    const open = skipAhead(code, k.index + f.name.length);
    if (code[open] !== "(") return null; // handed on, exported or read: its callers are not all here
    const close = closing(code, open);
    const item = close === -1 ? undefined : topLevelItems(code.slice(open + 1, close))[pos];
    if (!item) return null;
    const at = open + 1 + item.at;
    const lit = m.literals.find((l) => l.start === at);
    const v = lit && lit.kind !== "regex" && lit.end === at + item.text.length ? literalValue(src, lit) : null;
    if (v === null) return null;
    values.add(v);
  }
  return values.size > 0 ? [...values].sort() : null;
}

/** The modules a loader at `at` (`import(` or `require(`) loads when its argument is a name the file binds
 *  to a literal: a `const` initialised with one in a scope that holds the call (`const cfWorkers =
 *  'cloudflare:workers'` … `import(cfWorkers)`), or the parameter of a local function only ever called with
 *  one (`function format(path) { require(path) }` … `format('./users')`). Null when it is computed at run
 *  time, or when this reading cannot follow the name. */
function boundLoad(src: string, m: Masked, at: number): string[] | null {
  const code = m.code;
  const arg = /^(?:import|require)\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(code.slice(at, at + 200));
  if (!arg) return null;
  const name = arg[1];
  const esc = name.replace(RE_SPECIAL, "\\$&");
  const fns = functionsIn(m);
  const decls = [...code.matchAll(new RegExp(`(?<![\\w$.])(const|let|var|function|class)\\s+${esc}(?![\\w$])`, "g"))];
  if (decls.length === 1 && decls[0][1] === "const") {
    const d = decls[0];
    const after = d.index + d[0].length;
    const init = /^\s*(?::[^=;\n]{1,200})?=\s*/.exec(code.slice(after, after + 260));
    const lit = init ? m.literals.find((l) => l.start === after + init[0].length) : undefined;
    if (!lit || lit.kind === "regex" || lit.dynamic || d.index > at) return null;
    if (!/^[ \t]*(?:[;,\r\n]|$)/.test(code.slice(lit.end, lit.end + 40))) return null; // `'x' + y`: not the literal alone
    if (at >= blockAround(code, d.index).end) return null;
    if (fns.some((f) => f.bodyStart > d.index && f.bodyStart <= at && at < f.bodyEnd && f.params.includes(name))) return null;
    const v = literalValue(src, lit);
    return v === null ? null : [v];
  }
  if (decls.length > 0) return null;
  const holders = fns.filter((f) => f.bodyStart <= at && at < f.bodyEnd && f.params.includes(name));
  if (holders.length === 0) return null;
  const f = holders.reduce((a, b) => (b.bodyStart > a.bodyStart ? b : a));
  return literalCalls(src, m, f, f.params.indexOf(name), name);
}

/** The file's imports, a computed loader whose name is bound to a literal replaced by the module(s) it
 *  loads: judged like a literal import by every family that reads imports. */
function withBoundLoads(src: string, m: Masked, imports: ImportRef[]): ImportRef[] {
  if (!imports.some((i) => i.spec === null)) return imports;
  const out: ImportRef[] = [];
  for (const imp of imports) {
    const specs = imp.spec === null ? boundLoad(src, m, imp.index) : null;
    if (specs === null) { out.push(imp); continue; }
    for (const spec of specs) out.push({ spec, how: imp.how, typeOnly: false, index: imp.index });
  }
  return out;
}

type ModuleKind = "relative" | "builtin" | "package" | "absolute";
function moduleKind(spec: string, policy: AnalysisPolicy): { kind: ModuleKind; name: string } {
  if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../")) return { kind: "relative", name: spec };
  if (spec.startsWith("node:")) return { kind: "builtin", name: spec.slice(5).split("/")[0] };
  if (spec.startsWith("/")) return { kind: "absolute", name: spec };
  const first = spec.split("/")[0];
  if (policy.builtinModules.includes(first)) return { kind: "builtin", name: first };
  return { kind: "package", name: spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : first };
}

// ── The mission's allowances (runward/analysis.md) ───────────────────────────────────────────────

export const CAPABILITIES = ["code-execution", "process-execution", "computed-import", "network", "environment"] as const;
export type Capability = (typeof CAPABILITIES)[number];

interface AllowRow { line: number; text: string; why: string; uses: number }
interface Allowances {
  file: string;
  present: boolean;
  imports: Array<AllowRow & { module: string }>;
  capabilities: Array<AllowRow & { pattern: string; capability: Capability; re: RegExp }>;
  excluded: Array<AllowRow & { pattern: string; re: RegExp }>;
  problems: Array<{ line: number; text: string; problem: string }>;
}

const TRIVIAL_WHY = (s: string): boolean => s.trim().length < 8 || /^\[.*\]$/.test(s.trim());
const cell = (s: string | undefined): string => (s ?? "").trim().replace(/^`|`$/g, "").trim();

export function readAllowances(missionDir: string): Allowances {
  const out: Allowances = { file: `runward/${ANALYSIS_FILE}`, present: false, imports: [], capabilities: [], excluded: [], problems: [] };
  const abs = join(missionDir, ANALYSIS_FILE);
  if (!existsSync(abs)) return out;
  let text: string;
  try { text = readFileSync(abs, "utf8"); } catch { out.problems.push({ line: 0, text: "", problem: "present but unreadable" }); return out; }
  out.present = true;
  let section: "imports" | "capabilities" | "excluded" | null = null;
  text.split("\n").forEach((raw, idx) => {
    const line = idx + 1;
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(raw);
    if (heading) {
      const h = heading[1].toLowerCase();
      section = /^allowed imports in the domain core$/.test(h) ? "imports"
        : /^allowed capabilities$/.test(h) ? "capabilities"
          : /^not analy[sz]ed$/.test(h) ? "excluded" : null;
      return;
    }
    const t = raw.trim();
    if (section === null || !t.startsWith("|")) return;
    const cols = t.split("|").slice(1, -1).map((s) => s.trim());
    if (cols.length === 0 || /^:?-{2,}:?$/.test(cols[0]) || /^(module|path|pattern)$/i.test(cols[0])) return;
    const problem = (p: string) => out.problems.push({ line, text: t, problem: p });
    if (section === "imports") {
      if (cols.length < 2) return problem("expected 2 columns (module | why)");
      const module = cell(cols[0]);
      const why = cols.slice(1).join(" | ").trim();
      if (!module) return problem("empty module");
      if (TRIVIAL_WHY(why)) return problem("the `why` column is empty or a placeholder");
      out.imports.push({ line, text: t, why, uses: 0, module });
    } else if (section === "capabilities") {
      if (cols.length < 3) return problem("expected 3 columns (path | capability | why)");
      const pattern = cell(cols[0]);
      const capability = cell(cols[1]).toLowerCase();
      const why = cols.slice(2).join(" | ").trim();
      if (!pattern || normalizeForPath(pattern.replace(/\*/g, "x")) === null) return problem(`pattern is not project-relative: \`${pattern}\``);
      if (!(CAPABILITIES as readonly string[]).includes(capability)) return problem(`unknown capability \`${capability}\` — the vocabulary is: ${CAPABILITIES.join(", ")}`);
      if (TRIVIAL_WHY(why)) return problem("the `why` column is empty or a placeholder");
      out.capabilities.push({ line, text: t, why, uses: 0, pattern, capability: capability as Capability, re: globToRegExp(pattern) });
    } else {
      if (cols.length < 2) return problem("expected 2 columns (path | why)");
      const pattern = cell(cols[0]);
      const why = cols.slice(1).join(" | ").trim();
      if (!pattern || normalizeForPath(pattern.replace(/\*/g, "x")) === null) return problem(`pattern is not project-relative: \`${pattern}\``);
      if (pattern.startsWith("runward/")) return problem("runward/ is never analysed; this row would set aside nothing");
      if (TRIVIAL_WHY(why)) return problem("the `why` column is empty or a placeholder");
      out.excluded.push({ line, text: t, why, uses: 0, pattern, re: globToRegExp(pattern) });
    }
  });
  return out;
}

// ── The scope: which files are read ──────────────────────────────────────────────────────────────

interface ScopeFile { rel: string; abs: string; ext: string; size: number }
interface Scope {
  analysed: ScopeFile[];
  config: ScopeFile[];
  other: Map<string, string[]>;
  tooLarge: string[];
  links: string[];
  excluded: Array<{ path: string; by: string }>;
}

const extOf = (name: string): string => { const d = name.lastIndexOf("."); return d <= 0 ? "" : name.slice(d).toLowerCase(); };

function walkScope(root: string, policy: AnalysisPolicy, allow: Allowances): Scope {
  const scope: Scope = { analysed: [], config: [], other: new Map(), tooLarge: [], links: [], excluded: [] };
  const excludedBy = (rel: string, asDir: boolean): AllowRow | null => {
    for (const row of allow.excluded) if (row.re.test(rel) || (asDir && row.re.test(`${rel}/`))) return row;
    return null;
  };
  // ADR-0113 decision 5: the analyzers read the files the project delivers, the set the delivered tree
  // binds (what the project's own .gitignore files do not ignore, nested repositories never entered),
  // and never a file outside it. An ignored output written between `check --attest` and `verify` (a
  // CI step, `runward verify att.json --json > out.json`, which the shell empties first) is not an
  // input of the verdict, and a delivered file changed in between still makes it differ.
  const deliveredList = deliveredEntries(root);
  const delivered = new Set(deliveredList.map((d) => d.rel));
  const deliveredDirs = new Set<string>();
  for (const d of deliveredList) {
    for (let i = d.rel.lastIndexOf("/"); i > 0; i = d.rel.lastIndexOf("/", i - 1)) {
      const dir = d.rel.slice(0, i);
      if (deliveredDirs.has(dir)) break;
      deliveredDirs.add(dir);
    }
  }
  const visit = (dirAbs: string, dirRel: string): void => {
    let entries;
    try { entries = readdirSync(dirAbs, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const isPackageRoot = dirRel === "" || entries.some((e) => e.isFile() && e.name === "package.json");
    for (const e of entries) {
      const rel = dirRel === "" ? e.name : `${dirRel}/${e.name}`;
      const abs = join(dirAbs, e.name);
      const key = rel.normalize("NFC"); // the delivered tree names its paths in NFC
      if (e.isSymbolicLink()) { if (delivered.has(key)) scope.links.push(rel); continue; }
      if (e.isDirectory()) {
        if (dirRel === "" && e.name === "runward") continue; // the mission itself: judged by the gate, never analysed
        // runward's own reports, where its CI samples deposit them (check.json, the renderings, the
        // attestation, verify.json): written by the job between `check --attest` and `verify`, never
        // delivered code, and reading them would make the attestation differ from its own job.
        if (dirRel === "" && e.name === "runward-reports") { scope.excluded.push({ path: rel, by: "runward (its own reports, deposited by its CI samples)" }); continue; }
        if (policy.excludedDirectories.includes(e.name)) { scope.excluded.push({ path: rel, by: `${policy.id} (installed dependencies or version control)` }); continue; }
        if (isPackageRoot && policy.buildOutputDirectories.includes(e.name)) { scope.excluded.push({ path: rel, by: `${policy.id} (build output beside ${dirRel === "" ? "the project root" : `${dirRel}/package.json`})` }); continue; }
        const row = excludedBy(rel, true);
        if (row) { row.uses++; scope.excluded.push({ path: rel, by: `runward/${ANALYSIS_FILE}:${row.line}` }); continue; }
        if (!deliveredDirs.has(key)) continue; // nothing below it is delivered
        visit(abs, rel);
        continue;
      }
      if (!e.isFile()) continue;
      if (!delivered.has(key)) continue; // not delivered (the project's .gitignore): never read
      if (policy.skippedFileNames.includes(e.name)) continue;
      const ext = extOf(e.name);
      const analysed = policy.analysedExtensions.includes(ext);
      const config = policy.configExtensions.includes(ext);
      const language = policy.otherLanguages[ext];
      if (!analysed && !config && language === undefined) continue;
      const row = excludedBy(rel, false);
      if (row) { row.uses++; continue; }
      if (language !== undefined) { const l = scope.other.get(language) ?? []; l.push(rel); scope.other.set(language, l); continue; }
      let size = 0;
      try { size = statSync(abs).size; } catch { continue; }
      if (size > policy.maxFileBytes) { scope.tooLarge.push(rel); continue; }
      // A runward Statement is about the tree, never part of it, and `check --attest > verdict.intoto.json`
      // creates its file empty before runward runs: both are left out, as the delivered tree leaves them
      // (ADR-0113 decision 5), so an attestation written into the tree it attests still re-derives.
      if (config) {
        if (size === 0) continue;
        let buf: Buffer;
        try { buf = readFileSync(abs); } catch { buf = Buffer.alloc(0); }
        if (buf.length > 0 && isRunwardStatement(buf)) continue;
      }
      (analysed ? scope.analysed : scope.config).push({ rel, abs, ext, size });
    }
  };
  visit(root, "");
  return scope;
}

// ── The domain core ──────────────────────────────────────────────────────────────────────────────

function coreOracle(map: TerritoryMap, paths: string[]): { has: (p: string) => boolean; declared: boolean; via: (p: string) => string | null } {
  const declared = map.rows.some((r) => r.category === "domain-core" && r.effect === "declare");
  const cache = new Map<string, string | null>();
  const bind = (list: string[]): void => {
    for (const p of list) cache.set(p, null);
    for (const b of applyTerritoryMap([], map, list).bindings) {
      if (b.category === "domain-core" && b.via.source === "map") cache.set(b.path, `${b.via.file}:${b.via.line}`);
    }
  };
  bind(paths);
  const viaOf = (p: string): string | null => {
    if (!cache.has(p)) bind([p]);
    return cache.get(p) ?? null;
  };
  return { has: (p) => viaOf(p) !== null, declared, via: viaOf };
}

/** The project-relative file a relative import names, among the candidates a resolver would try:
 *  the first that exists, else the bare path. Null when it climbs out of the project. */
function resolveImport(fromRel: string, spec: string, exists: (rel: string) => boolean, policy: AnalysisPolicy): { path: string; candidates: string[] } | null {
  const base = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  if (base === ".." || base.startsWith("../") || base.startsWith("/")) return null;
  const candidates = [base];
  const js = /\.([mc]?)jsx?$/.exec(base);
  if (js) candidates.push(base.slice(0, -js[0].length) + `.${js[1]}ts`, base.slice(0, -js[0].length) + `.${js[1]}tsx`);
  for (const ext of policy.analysedExtensions) candidates.push(base + ext);
  for (const ext of policy.analysedExtensions) candidates.push(`${base}/index${ext}`);
  return { path: candidates.find(exists) ?? base, candidates };
}

// ── Test files ───────────────────────────────────────────────────────────────────────────────────

const ASSERTION = /(?<![\w$])(?:assert\w*|expect\w*|should\w*)\b|\.\s*should\b|(?<![\w$])t\s*\.\s*(?:ok|notOk|equal|notEqual|deepEqual|notDeepEqual|strictEqual|is|not|true|false|truthy|falsy|throws|throwsAsync|notThrows|notThrowsAsync|rejects|resolves|regex|notRegex|like|same|match|snapshot|fail|plan)\s*\(|(?<![\w$])throw\b/;
// A case: `test(`, `it(`, with up to two modifiers (`test.skip(`, `it.only.skip(`), or a subtest on
// the context parameter node:test and tap hand a case (`t.test(`). Never `x.test(`: that is a regular
// expression's method far more often than a subtest.
const MODIFIER = "(?:\\.\\s*(?:only|skip|todo|concurrent|serial|failing|sequential)\\s*)?";
const CASE_CALL = new RegExp(`(?<![\\w$.])(?:test|it)\\s*(${MODIFIER}${MODIFIER})\\(|(?<![\\w$.])(?:t|ctx|context)\\s*\\.\\s*test\\s*\\(`, "g");
const SUBTEST = /(?<![\w$.])(?:t|ctx|context)\s*\.\s*test\s*\(/;

/** The index of the bracket that closes the one at `open`, in masked code (literals are blank). */
function closing(code: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: string[] = [];
  for (let k = open; k < code.length; k++) {
    const ch = code[k];
    if (ch === "(" || ch === "{" || ch === "[") stack.push(pairs[ch]);
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return k;
    }
  }
  return -1;
}

// ── Shapes read beyond one token: functions, their parameters, what a bracket belongs to ─────────────
// The false reds measured on three repositories runward did not write (ADR-0117, What would settle it,
// criterion 2) came from readings that stopped at one token: a parameter list over several lines, a
// `done` handed on, a name bound to a literal. These read a little further, on the masked code, and
// each says what it cannot follow rather than guess.

/** The index of the bracket that opens the one closing at `close`, in masked code; -1 when none does. */
function opening(code: string, close: number): number {
  const pairs: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  const stack: string[] = [];
  for (let k = close; k >= 0; k--) {
    const ch = code[k];
    if (ch === ")" || ch === "}" || ch === "]") stack.push(pairs[ch]);
    else if (ch === "(" || ch === "{" || ch === "[") {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return k;
    }
  }
  return -1;
}

/** The bracket left open before `from` (the one a list item at `from` belongs to); -1 at the top level. */
function unmatchedOpener(code: string, from: number): number {
  let depth = 0;
  for (let k = from; k >= 0; k--) {
    const ch = code[k];
    if (ch === ")" || ch === "]" || ch === "}") depth++;
    else if (ch === "(" || ch === "[" || ch === "{") { if (depth === 0) return k; depth--; }
  }
  return -1;
}

const skipBack = (code: string, k: number): number => { while (k >= 0 && isSpaceCode(code.charCodeAt(k))) k--; return k; };
const skipAhead = (code: string, k: number): number => { while (k < code.length && isSpaceCode(code.charCodeAt(k))) k++; return k; };

/** The items of a list at its top level (`a, f(b, c), { d }` is three), trimmed, with their offsets. */
function topLevelItems(s: string): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = [];
  let depth = 0;
  let from = 0;
  for (let k = 0; k <= s.length; k++) {
    const ch = s[k];
    if (k === s.length || (ch === "," && depth === 0)) {
      const raw = s.slice(from, k);
      if (raw.trim()) out.push({ text: raw.trim(), at: from + (raw.length - raw.trimStart().length) });
      from = k + 1;
    } else if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
  }
  return out;
}

/** The names a parameter list binds, in order (`a: T = 1`, `...rest`); a destructured parameter binds no
 *  single name and is "", a TypeScript `this` parameter is no parameter. */
function paramNames(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let k = 0; k <= list.length; k++) {
    const ch = list[k];
    if (k === list.length || (ch === "," && depth === 0)) {
      const item = list.slice(from, k).trim().replace(/^\.\.\./, "");
      const name = /^[A-Za-z_$][\w$]*/.exec(item)?.[0] ?? "";
      if (item && name !== "this") out.push(name);
      from = k + 1;
    } else if (ch === "(" || ch === "{" || ch === "[" || ch === "<") depth++;
    else if (ch === ")" || ch === "}" || ch === "]" || (ch === ">" && list[k - 1] !== "=")) depth--;
  }
  return out;
}

/** Where an arrow's expression body ends: at a `,` `;` or closing bracket of its own level, or at a line
 *  break that no operator carries on. */
function expressionEnd(code: string, from: number): number {
  let depth = 0;
  for (let k = from; k < code.length; k++) {
    const ch = code[k];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") { if (depth === 0) return k; depth--; }
    else if (depth === 0 && (ch === "," || ch === ";")) return k;
    else if (depth === 0 && ch === "\n") {
      const before = code[skipBack(code, k - 1)] ?? "";
      const after = code[skipAhead(code, k + 1)] ?? "";
      if (!/[-+*/%&|^!=<>?:,(.]/.test(before) && !/[-+*/%&|^=<>?:.]/.test(after)) return k;
    }
  }
  return code.length;
}

/** The `{` of a body after a parameter list closing at `close`, a return type between them allowed; -1. */
function blockAfter(code: string, close: number): number {
  const k = skipAhead(code, close + 1);
  if (code[k] === "{") return k;
  if (code[k] !== ":") return -1;
  const brace = code.indexOf("{", k);
  return brace === -1 || /[;=](?!>)/.test(code.slice(k, brace)) ? -1 : brace;
}

interface FnSpan {
  /** The name it is declared or bound under (`function f`, `const f = () =>`, a method), or null. */
  name: string | null;
  /** Where that name is written (-1 when anonymous), and where the declaration starts. */
  nameAt: number;
  head: number;
  params: string[];
  /** [bodyStart, bodyEnd): the block, braces included, or an arrow's expression. */
  bodyStart: number;
  bodyEnd: number;
}

const NOT_A_METHOD = new Set(["if", "for", "while", "switch", "catch", "with", "function", "return", "typeof", "await", "yield",
  "new", "delete", "void", "in", "of", "instanceof", "case", "do", "else", "super", "import", "require", "export"]);
const FN_CACHE = new WeakMap<Masked, FnSpan[]>();

/** Every function of a file, with its parameters and body: declarations, expressions, arrows, methods. */
function functionsIn(m: Masked): FnSpan[] {
  const cached = FN_CACHE.get(m);
  if (cached) return cached;
  const code = m.code;
  const out: FnSpan[] = [];
  // `const f = `, `let f = async ` right before a function or an arrow's parameters: the name it binds.
  const bound = (before: number): { name: string; at: number; head: number } | null => {
    const base = Math.max(0, before - 240);
    const b = /(?<![\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]{1,160})?=\s*(?:async\s+)?$/.exec(code.slice(base, before));
    return b ? { name: b[1], at: base + b.index + b[0].indexOf(b[1], b[0].search(/\s/)), head: base + b.index } : null;
  };
  const push = (name: string | null, nameAt: number, head: number, params: string[], bodyStart: number, bodyEnd: number): void => {
    out.push({ name, nameAt, head, params, bodyStart, bodyEnd });
  };
  for (const k of code.matchAll(/(?<![\w$.])function\b(?:\s*\*)?\s*(?:([A-Za-z_$][\w$]*)\s*)?\(/g)) {
    const open = k.index + k[0].length - 1;
    const close = closing(code, open);
    const brace = close === -1 ? -1 : blockAfter(code, close);
    const end = brace === -1 ? -1 : closing(code, brace);
    if (end === -1) continue;
    const b = k[1] ? null : bound(k.index);
    push(k[1] ?? b?.name ?? null, k[1] ? k.index + k[0].indexOf(k[1], 8) : b?.at ?? -1, b?.head ?? k.index,
      paramNames(code.slice(open + 1, close)), brace, end + 1);
  }
  for (const k of code.matchAll(/=>/g)) {
    const p = skipBack(code, k.index - 1);
    let start: number;
    let params: string[];
    if (code[p] === ")") {
      const open = opening(code, p);
      if (open === -1) continue;
      start = open;
      params = paramNames(code.slice(open + 1, p));
    } else {
      const w = wordEndingAt(code, p + 1);
      if (!w) continue;
      start = w.start;
      params = [w.word];
    }
    const a = wordEndingAt(code, skipBack(code, start - 1) + 1);
    const before = a?.word === "async" ? a.start : start;
    const b = skipAhead(code, k.index + 2);
    let end: number;
    if (code[b] === "{") { const e = closing(code, b); if (e === -1) continue; end = e + 1; } else end = expressionEnd(code, b);
    const named = bound(before);
    push(named?.name ?? null, named?.at ?? -1, named?.head ?? before, params, b, end);
  }
  // A method: `name(…) {` where a member of a class or an object literal starts (after `{`, `}`, `;`, `,`
  // and its modifiers), never a call in an expression.
  const memberStart = (at: number): boolean => {
    let p = at - 1;
    for (;;) {
      p = skipBack(code, p);
      if (p < 0) return true;
      if (code[p] === "*") { p--; continue; }
      const w = wordEndingAt(code, p + 1);
      if (w && /^(?:async|static|get|set|public|private|protected|override|readonly|abstract|accessor)$/.test(w.word)) { p = w.start - 1; continue; }
      return "{};,".includes(code[p]);
    }
  };
  for (const k of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (NOT_A_METHOD.has(k[1]) || !memberStart(k.index)) continue;
    const open = k.index + k[0].length - 1;
    const close = closing(code, open);
    const brace = close === -1 ? -1 : blockAfter(code, close);
    const end = brace === -1 ? -1 : closing(code, brace);
    if (end === -1) continue;
    push(k[1], k.index, k.index, paramNames(code.slice(open + 1, close)), brace, end + 1);
  }
  FN_CACHE.set(m, out);
  return out;
}

/** Is `index`, in a body spanning [from, to), inside a function nested in that body (a handler the code
 *  registers, a callback it hands on) rather than in the body's own code? */
const nestedIn = (fns: FnSpan[], from: number, to: number, index: number): boolean =>
  fns.some((f) => f.bodyStart > from && f.bodyStart < to && f.bodyStart <= index && index < f.bodyEnd);

interface TestCase {
  name: string | null; line: number; skipped: boolean; body: string | null;
  /** Where the body starts in the file (-1 without one), and the names of the callback's parameters. */
  bodyAt: number; params: string[];
}

/** The cases a test file declares, each with its literal name (null when computed) and the masked
 *  text of its inline callback (null when the callback is a reference the reader cannot open). */
function testCases(src: string, m: Masked): TestCase[] {
  const out: TestCase[] = [];
  const byStart = new Map(m.literals.map((l) => [l.start, l]));
  for (const k of m.code.matchAll(CASE_CALL)) {
    const open = k.index + k[0].length - 1;
    const close = closing(m.code, open);
    if (close === -1) continue;
    const args = m.code.slice(open + 1, close);
    let j = open + 1;
    while (j < close && /\s/.test(m.code[j])) j++;
    const lit = byStart.get(j);
    const name = lit && lit.kind !== "regex" ? literalValue(src, lit) : null;
    let skipped = /\.\s*(?:skip|todo)\b/.test(k[1] ?? "");
    if (!skipped && /\{\s*(?:skip|todo)\s*:\s*(?:true|"|'|`)/.test(args)) skipped = true;
    // The callback: the last top-level arrow or function expression among the arguments.
    let body: string | null = null;
    let bodyAt = -1;
    let params: string[] = [];
    let level = 0;
    let fnAt = -1;
    for (let p = 0; p < args.length; p++) {
      const ch = args[p];
      if (ch === "(" || ch === "{" || ch === "[") level++;
      else if (ch === ")" || ch === "}" || ch === "]") level--;
      else if (level === 0 && ch === "=" && args[p + 1] === ">") fnAt = p + 2;
      else if (level === 0 && args.startsWith("function", p) && !isWord(args[p - 1]) && !isWord(args[p + 8])) fnAt = p + 8;
    }
    if (fnAt !== -1) {
      const absAt = open + 1 + fnAt;
      let q = absAt;
      params = callbackParams(args, fnAt);
      // `function (t) {` and `async (t) => {`: skip a parameter list to the body.
      while (q < close && /\s/.test(m.code[q])) q++;
      if (m.code[q] === "(" || isWord(m.code[q])) {
        const isFunctionKeyword = args.slice(fnAt - 8, fnAt) === "function";
        if (isFunctionKeyword) {
          const params = m.code.indexOf("(", q);
          const pclose = params === -1 ? -1 : closing(m.code, params);
          q = pclose === -1 ? q : pclose + 1;
          while (q < close && /\s/.test(m.code[q])) q++;
        }
      }
      if (m.code[q] === "{") {
        const end = closing(m.code, q);
        body = end === -1 ? null : m.code.slice(q, end + 1);
      } else {
        body = m.code.slice(q, close);
      }
      bodyAt = q;
    }
    // A subtest is counted only when it reads as one: a literal name and an inline callback.
    if (k[1] === undefined && (name === null || body === null)) continue;
    out.push({ name, line: lineOf(m, k.index), skipped, body, bodyAt, params });
  }
  return out;
}

/** Functions of the file whose body asserts: a case that calls one asserts through it. */
function assertingHelpers(m: Masked): Set<string> {
  const defs = new Map<string, string>();
  const add = (name: string, open: number): void => {
    const end = closing(m.code, open);
    if (end !== -1) defs.set(name, m.code.slice(open, end + 1));
  };
  for (const k of m.code.matchAll(/(?<![\w$.])function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const pclose = closing(m.code, k.index + k[0].length - 1);
    if (pclose === -1) continue;
    const brace = m.code.indexOf("{", pclose);
    if (brace !== -1) add(k[1], brace);
  }
  // `const name = (…) => …`, `const name = async x => …`, `const name = function (…) {…}`: the value is a
  // function when an arrow or the keyword opens it; its body is the block after it, or the rest of the line.
  for (const k of m.code.matchAll(/(?<![\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
    const from = k.index + k[0].length;
    const stop = m.code.indexOf("\n", from);
    const line = m.code.slice(from, stop === -1 ? m.code.length : stop);
    const arrow = line.indexOf("=>");
    const fn = /^\s*async\s+function\b/.exec(line) ?? /^\s*function\b/.exec(line);
    if (arrow === -1 && !fn) {
      const spread = arrowAfterParams(m.code, from);
      if (spread !== null) defs.set(k[1], spread);
      continue;
    }
    let at = fn ? m.code.indexOf("{", from + fn[0].length) : from + arrow + 2;
    while (at < m.code.length && isSpaceCode(m.code.charCodeAt(at))) at++;
    if (m.code[at] === "{") add(k[1], at);
    else defs.set(k[1], line.slice(arrow + 2));
  }
  const asserting = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, body] of defs) {
      if (asserting.has(name)) continue;
      if (ASSERTION.test(body) || [...asserting].some((h) => new RegExp(`(?<![\\w$.])${h.replace(RE_SPECIAL, "\\$&")}\\s*\\(`).test(body))) {
        asserting.add(name); changed = true;
      }
    }
  }
  return asserting;
}

/** The parameter names of a case's callback, from the masked text of the call's arguments and the offset
 *  `testCases` found the callback at (just after `=>`, or just after the keyword `function`). */
function callbackParams(args: string, fnAt: number): string[] {
  if (args.slice(fnAt - 8, fnAt) === "function") {
    const open = args.indexOf("(", fnAt);
    const close = open === -1 ? -1 : closing(args, open);
    return close === -1 ? [] : paramNames(args.slice(open + 1, close));
  }
  const p = skipBack(args, fnAt - 3);
  if (args[p] === ")") {
    const open = opening(args, p);
    return open === -1 ? [] : paramNames(args.slice(open + 1, p));
  }
  const w = wordEndingAt(args, p + 1);
  return w ? [w.word] : [];
}

/** `const name = async (\n  a,\n  b\n) => {…}`: an arrow whose parameter list spans lines, which the
 *  one-line reading of `assertingHelpers` cannot see. Its body (the block, or the expression), or null. */
function arrowAfterParams(code: string, from: number): string | null {
  const head = /^\s*(?:async\s*)?\(/.exec(code.slice(from, from + 200));
  if (!head) return null;
  const close = closing(code, from + head[0].length - 1);
  if (close === -1) return null;
  const tail = /^\s*(?::[^=;{}]{1,200})?=>/.exec(code.slice(close + 1, close + 400));
  if (!tail) return null;
  const b = skipAhead(code, close + 1 + tail[0].length);
  if (code[b] !== "{") return code.slice(b, expressionEnd(code, b));
  const end = closing(code, b);
  return end === -1 ? null : code.slice(b, end + 1);
}

/** A type whose parameter is constrained to `true` (`type Expect<T extends true> = T`): instantiating it
 *  with a type that is not `true` (`Expect<Equal<A, B>>` when A and B differ) fails the compiler. */
const ASSERTION_TYPE = /(?<![\w$.])type\s+([A-Za-z_$][\w$]*)\s*<\s*[A-Za-z_$][\w$]*\s+extends\s+true\s*[,=>]/g;
const TYPESCRIPT = /\.[cm]?tsx?$/;

/** The assertion types each test file can instantiate: declared in it, or imported by name from a file of
 *  the project that declares them. Built once per reading, read lazily. */
function assertionTypeScope(texts: FileText[], resolves: (from: string, spec: string) => string | null): (t: FileText) => Set<string> {
  let byRel: Map<string, FileText> | null = null;
  const declared = new Map<string, Set<string>>();
  const declaredIn = (rel: string): Set<string> => {
    let s = declared.get(rel);
    if (s === undefined) {
      s = new Set();
      const u = (byRel ??= new Map(texts.map((x) => [x.file.rel, x]))).get(rel);
      if (u && /extends\s+true\b/.test(u.m.code)) for (const k of u.m.code.matchAll(ASSERTION_TYPE)) s.add(k[1]);
      declared.set(rel, s);
    }
    return s;
  };
  return (t) => {
    const out = new Set(declaredIn(t.file.rel));
    for (const imp of t.imports) {
      if (imp.spec === null || imp.how !== "static" || !imp.spec.startsWith(".")) continue;
      const target = resolves(t.file.rel, imp.spec);
      const there = target === null ? null : declaredIn(target);
      if (!there || there.size === 0) continue;
      for (const x of bindingsOf(t.m, imp)?.members ?? []) if (there.has(x.name) && x.local) out.add(x.local);
    }
    return out;
  };
}

/** A `// @ts-expect-error` (or `/* @ts-expect-error *\/`) directive in a comment between `from` and `to`:
 *  the compiler fails when the error it expects is gone, a negative type assertion. */
function expectsTypeError(t: FileText, from: number, to: number): boolean {
  for (const k of t.src.slice(from, to).matchAll(/\/\/\s*@ts-expect-error\b|\/\*+\s*@ts-expect-error\b/g)) {
    const at = from + k.index;
    if (t.m.code[at] !== " ") continue; // still code: not a comment
    if (t.m.literals.some((l) => l.start < at && at < l.end)) continue; // inside a string, a template or a regex
    return true;
  }
  return false;
}

/** The parameter a runner hands a case as its completion callback: the second under node:test, which
 *  hands the test context first; none under the runners whose first parameter is a context (Vitest, tap,
 *  AVA, uvu); the first under Mocha, Jest and Jasmine. */
function doneParam(t: FileText, c: TestCase): string | null {
  const specs = t.imports.map((i) => i.spec ?? "");
  const name = specs.some((s) => s === "node:test" || s === "test") ? c.params[1]
    : specs.some((s) => /^(?:vitest|tap|ava|uvu)(?:\/|$)/.test(s)) ? undefined : c.params[0];
  return name ? name : null;
}

const TIMER = /^(?:(?:globalThis|window|global|self)\.)?(?:setTimeout|setImmediate|setInterval|queueMicrotask|requestAnimationFrame)$|^process\.nextTick$/;

/** The callee of the call whose argument list opens at `open` (`server.close`, `setTimeout`,
 *  `Promise.resolve().then`), spaces removed; null when the parenthesis opens no call (`if (`, `= (`). */
function calleeBefore(code: string, open: number): string | null {
  let k = skipBack(code, open - 1);
  const end = k + 1;
  for (;;) {
    if (k >= 0 && code[k] === ")") { const o = opening(code, k); if (o === -1) return null; k = skipBack(code, o - 1); }
    else if (k >= 0 && isWordCode(code.charCodeAt(k))) { while (k >= 0 && isWordCode(code.charCodeAt(k))) k--; }
    else break;
    const j = skipBack(code, k);
    if (j < 0 || code[j] !== ".") break;
    k = skipBack(code, j - 1);
    if (code[k] === "?") k = skipBack(code, k - 1);
  }
  const text = code.slice(k + 1, end).replace(/\s+/g, "");
  return !text || /^(?:if|for|while|switch|catch|with|return|typeof|await|yield|function|new|in|of|void|delete|throw|case)$/.test(text) ? null : text;
}

/** A function this file declares under `name`: a helper of the test, never the code under test. */
const declaresFunction = (code: string, name: string): boolean => {
  const n = name.replace(RE_SPECIAL, "\\$&");
  return new RegExp(`(?<![\\w$.])function\\s*\\*?\\s*${n}\\s*\\(|(?<![\\w$.])(?:const|let|var)\\s+${n}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`).test(code);
};

/** Does the case hand its `done` to the code under test (`route.dispatch(req, {}, done)`, `{ end: done }`,
 *  `app.on('foo', done)`, `server.close(done)`)? Then the case fails when that code reports an error or
 *  never completes. Handed to a timer, a promise of the runtime or a helper of this file, it checks nothing. */
function handsDone(t: FileText, from: number, to: number, done: string): boolean {
  const code = t.m.code;
  for (const k of code.slice(from, to).matchAll(new RegExp(`(?<![\\w$.])${done.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`, "g"))) {
    const at = from + k.index;
    const next = code[skipAhead(code, at + done.length)];
    if (next !== ")" && next !== "," && next !== "}") continue; // called, read or compared: not handed on
    const p = skipBack(code, at - 1);
    if (code[p] === ":") {
      // `{ end: done }`: a property value, handed with its object.
      const key = wordEndingAt(code, skipBack(code, p - 1) + 1);
      const r = key ? skipBack(code, key.start - 1) : -1;
      if (key && (code[r] === "{" || code[r] === ",")) return true;
      continue;
    }
    if (code[p] !== "(" && code[p] !== "," && code[p] !== "{") continue;
    const open = code[p] === "(" || code[p] === "{" ? p : unmatchedOpener(code, p - 1);
    if (open !== -1 && code[open] === "{") { if (next !== ")") return true; continue; } // `{ res, done }`, shorthand
    if (open === -1 || code[open] !== "(") continue;
    const callee = calleeBefore(code, open);
    if (callee === null || TIMER.test(callee) || /^Promise\b/.test(callee)) continue;
    if (/^[A-Za-z_$][\w$]*$/.test(callee) && declaresFunction(code, callee)) continue;
    return true;
  }
  return false;
}

/** Is the `await` at `at`, whose call opens its arguments at `open`, a statement of its own whose value
 *  nothing uses (`await fastify.ready()`), not part of a larger expression (`const out = await …`)? */
function wholeStatement(code: string, at: number, open: number): boolean {
  const p = skipBack(code, at - 1);
  if (!(p < 0 || ";{}".includes(code[p]) || (/[\w$)\]]/.test(code[p]) && code.slice(p + 1, at).includes("\n")))) return false;
  const close = closing(code, open);
  if (close === -1) return false;
  const n = skipAhead(code, close + 1);
  return n >= code.length || ";}".includes(code[n]) || (code.slice(close + 1, n).includes("\n") && !/[-.?+*/%&|^=<>,)\]]/.test(code[n]));
}

/** Does the case build an object of the code under test, set it up, and await its completion as a
 *  statement of its own (`const fastify = Fastify()`, `fastify.addSchema(…)`, `await fastify.ready()`)?
 *  The promise rejects when the set-up fails: the promise form of handing it `done`. A bare call stays a
 *  bare call when it is a method (nothing set up before it), a value awaited and kept (`const out = await
 *  uc.run(x)`) is a value nothing checks, and a promise of the runtime (`Promise.resolve()`), a module
 *  (`require`), the plumbing of a promise (`then`, `catch`, `finally`) or an await in a nested function is
 *  none of this. */
function awaitsBuiltObject(code: string, fns: FnSpan[], from: number, to: number): boolean {
  const body = code.slice(from, to);
  for (const k of body.matchAll(/(?<![\w$.])await\s+([A-Za-z_$][\w$]*)((?:\s*\??\.\s*[A-Za-z_$][\w$]*)+)\s*\(/g)) {
    const at = from + k.index;
    if (nestedIn(fns, from, to, at) || /(?:^|\.)\s*(?:then|catch|finally)\s*$/.test(k[2])) continue;
    if (!wholeStatement(code, at, at + k[0].length - 1)) continue;
    const recv = k[1].replace(RE_SPECIAL, "\\$&");
    let built = -1;
    for (const d of body.matchAll(new RegExp(`(?<![\\w$.])(?:const|let|var)\\s+${recv}\\s*(?::[^=;\\n]{1,200})?=\\s*(?:await\\s+)?(new\\s+)?([A-Za-z_$][\\w$]*)(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*\\s*[(<]`, "g"))) {
      const declAt = from + d.index;
      if (declAt > at || nestedIn(fns, from, to, declAt)) continue;
      if (d[2] === "Promise" || (!d[1] && /^(?:require|import)$/.test(d[2]))) continue;
      built = declAt;
      break;
    }
    if (built === -1) continue;
    for (const s of code.slice(built, at).matchAll(new RegExp(`(?<![\\w$.])${recv}(?:\\s*\\??\\.\\s*[A-Za-z_$][\\w$]*)+\\s*\\(`, "g"))) {
      if (!nestedIn(fns, from, to, built + s.index)) return true;
    }
  }
  return false;
}

/** Does the case await (or return) a promise it builds whose executor rejects with a value on a failure
 *  path (`setTimeout(() => reject(new Error('response hung')), 2000)`)? That rejection fails the case. */
function awaitsRejectingPromise(code: string, fns: FnSpan[], from: number, to: number): boolean {
  const body = code.slice(from, to);
  for (const k of body.matchAll(/(?<![\w$.])(?:await|return)\s+new\s+Promise\s*(?:<[^>]*>\s*)?\(/g)) {
    const at = from + k.index;
    if (nestedIn(fns, from, to, at)) continue;
    const open = at + k[0].length - 1;
    const close = closing(code, open);
    if (close === -1) continue;
    const args = code.slice(open + 1, close);
    const ex = /^\s*(?:async\s+)?(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)/.exec(args);
    const reject = ex ? paramNames(ex[1] ?? ex[2] ?? "")[1] : undefined;
    if (!reject) continue;
    if (new RegExp(`(?<![\\w$.])${reject.replace(RE_SPECIAL, "\\$&")}\\s*\\(\\s*[^)\\s]`).test(args)) return true;
  }
  return false;
}

/** Does a case with no assertion call still assert, in a way the reading of calls and throws cannot see?
 *  At compile time (an assertion type instantiated, a `@ts-expect-error`, in a TypeScript file), through
 *  its `done` handed to the code under test, or through a promise it awaits that fails the case: a method
 *  of an object it built, or a promise of its own that rejects. A bare call, awaited or not, is none. */
function assertsOtherwise(t: FileText, c: TestCase, assertionTypes: (t: FileText) => Set<string>): boolean {
  if (c.body === null || c.bodyAt < 0) return false;
  const from = c.bodyAt;
  const to = c.bodyAt + c.body.length;
  if (TYPESCRIPT.test(t.file.rel)) {
    const names = assertionTypes(t);
    if (names.size > 0 && new RegExp(`(?<![\\w$.])(?:${[...names].map((n) => n.replace(RE_SPECIAL, "\\$&")).join("|")})\\s*<`).test(c.body)) return true;
    if (expectsTypeError(t, from, to)) return true;
  }
  const done = doneParam(t, c);
  if (done !== null && handsDone(t, from, to, done)) return true;
  if (!/(?<![\w$.])(?:await|return)\b/.test(c.body)) return false;
  const fns = functionsIn(t.m);
  return awaitsBuiltObject(t.m.code, fns, from, to) || awaitsRejectingPromise(t.m.code, fns, from, to);
}

/** Is the name at `at`, whose argument list opens at `open`, DECLARED here rather than called: a
 *  function, a method or an interface member that happens to be named `eval` or `fetch`
 *  (a port's member typed `Promise<Account>`, an adapter's async method of that name)? */
function declaredHere(code: string, at: number, open: number): boolean {
  if (/(?:\bfunction\s*\*?|\bget|\bset|\bstatic|\basync|\babstract|\bpublic|\bprivate|\bprotected|\boverride|\breadonly)\s+$/.test(code.slice(Math.max(0, at - 24), at))) return true;
  const close = closing(code, open);
  if (close === -1) return false;
  const after = code.slice(close + 1, close + 240);
  // A body (`) {`, `): number {`) or a typed signature ending its member (`): Promise<T>;`).
  return /^\s*\{/.test(after) || /^\s*:[^;{]{0,200}\{/.test(after) || /^\s*:[^;{=]{1,200}[;,}]/.test(after);
}

/** An assertion call whose every argument is a literal: it cannot fail on the code. */
function tautological(body: string): boolean {
  const calls = [...body.matchAll(/(?<![\w$])(?:assert\w*\s*\.\s*\w+|assert\w*|expect)\s*\(/g)];
  if (calls.length === 0) return false;
  const LITERAL = /^(?:"\s*"|'\s*'|`\s*`|-?\d[\d_.eE+-]*|true|false|null|undefined)$/;
  for (const c of calls) {
    const open = c.index + c[0].length - 1;
    const close = closing(body, open);
    if (close === -1) return false;
    const args = body.slice(open + 1, close).split(",").map((s) => s.trim()).filter(Boolean);
    if (args.length === 0 || !args.every((a) => LITERAL.test(a))) return false;
  }
  return true;
}

// ── The reading ──────────────────────────────────────────────────────────────────────────────────

interface FileText { file: ScopeFile; src: string; m: Masked; imports: ImportRef[]; test: boolean }

/** Read the delivered code of the mission's project under the policy the mission pins. Null when the
 *  mission has not opted in. Pure apart from reading files under the project root. */
export function analyzeDelivery(missionDir: string): AnalysisReading | null {
  const pin = analysisPin(missionDir);
  if (pin === null) return null;
  const root = join(missionDir, "..");
  const allow = readAllowances(missionDir);
  const policyId = typeof pin.raw === "string" ? pin.raw : JSON.stringify(pin.raw) ?? String(pin.raw);
  const policy = typeof pin.raw === "string" ? ANALYSIS_POLICIES[pin.raw] : undefined;
  const reading: AnalysisReading = {
    policy: policyId, known: policy !== undefined,
    files: { analysed: 0, tests: 0, core: 0, config: 0 },
    findings: [], hypotheses: [], notAnalyzed: [], excluded: [],
    allowances: { file: allow.file, present: allow.present, used: [], inert: [], problems: allow.problems },
    nonScope: ANALYSIS_NON_SCOPE,
  };
  if (policy === undefined) {
    const known = Object.keys(ANALYSIS_POLICIES).join(", ");
    reading.findings.push({ family: "policy", check: "policy-unknown", path: "runward/scaffold-lock.json", line: null,
      message: typeof pin.raw === "string"
        ? `pins the analysis policy \`${pin.raw}\`, which this runward version does not ship (it ships: ${known}). Nothing was read: the gate refuses rather than read the code under a policy the mission did not pin`
        : `declares \`analysis\` as ${policyId}, which is not a policy id (it ships: ${known}). Nothing was read: pin one, e.g. "analysis": "${Object.keys(ANALYSIS_POLICIES)[0]}"` });
    return reading;
  }

  const scope = walkScope(root, policy, allow);
  reading.excluded = scope.excluded;
  const known = new Set(scope.analysed.map((f) => f.rel));
  const exists = (rel: string): boolean => known.has(rel);
  const testName = policy.testFileNames.map((s) => new RegExp(s));
  const isTest = (rel: string): boolean => {
    const parts = rel.split("/");
    const base = parts[parts.length - 1];
    return testName.some((re) => re.test(base)) || parts.slice(0, -1).some((d) => policy.testDirectories.includes(d));
  };
  const namedTest = (rel: string): boolean => {
    const parts = rel.split("/");
    return testName.some((re) => re.test(parts[parts.length - 1])) || parts.slice(0, -1).includes("__tests__");
  };
  const map = readTerritoryMap(missionDir);
  const core = coreOracle(map, [...known, ...[...scope.other.values()].flat()]);
  const finding = (f: AnalysisFinding): void => { reading.findings.push(f); };
  const hypothesis = (f: AnalysisFinding): void => { reading.hypotheses.push(f); };
  const allowedCapability = (rel: string, cap: Capability): boolean => {
    const row = allow.capabilities.find((r) => r.capability === cap && r.re.test(rel));
    if (row) row.uses++;
    return row !== undefined;
  };
  const allowedImport = (spec: string, name: string): boolean => {
    const bare = spec.startsWith("node:") ? spec.slice(5) : spec;
    const row = allow.imports.find((r) => {
      const a = r.module.startsWith("node:") ? r.module.slice(5) : r.module;
      return a === bare || a === name || (spec.startsWith("node:") && a === name);
    });
    if (row) row.uses++;
    return row !== undefined;
  };

  const texts: FileText[] = [];
  for (const file of scope.analysed) {
    let src: string;
    try { src = readFileSync(file.abs, "utf8"); } catch { continue; }
    const m = maskSource(src);
    texts.push({ file, src, m, imports: importsOf(src, m), test: isTest(file.rel) });
  }
  reading.files.analysed = texts.length;
  reading.files.tests = texts.filter((t) => t.test).length;
  reading.files.config = scope.config.length;

  for (const t of texts) {
    const rel = t.file.rel;
    const at = (index: number): number => lineOf(t.m, index);
    // A test co-located in the core is a test, not core code: its framework imports are not a boundary.
    const inCore = core.has(rel) && !t.test;
    if (inCore) reading.files.core++;
    const via = inCore ? core.via(rel) : null;
    // A loader whose name the file binds to a literal loads that module: read like a literal import below.
    const imports = withBoundLoads(t.src, t.m, t.imports);

    // Capabilities, everywhere outside the tests.
    if (!t.test) {
      for (const imp of imports) {
        if (imp.spec === null) {
          if (!allowedCapability(rel, "computed-import")) finding({ family: "capability", check: "computed-import", path: rel, line: at(imp.index),
            message: `loads a module whose name is computed at run time (a ${imp.how === "call" ? "require call" : "dynamic import"} with a non-literal argument): no reader of the tree can say what it loads` });
          continue;
        }
        const mk = moduleKind(imp.spec, policy);
        if (mk.kind !== "builtin") continue;
        if (policy.processExecutionModules.includes(mk.name) && !imp.typeOnly && !allowedCapability(rel, "process-execution")) {
          finding({ family: "capability", check: "process-execution", path: rel, line: at(imp.index),
            message: `imports \`${imp.spec}\`: it can spawn processes, and ${allow.file} allows no process execution in this file` });
        }
        if (policy.codeExecutionModules.includes(mk.name) && !imp.typeOnly && !allowedCapability(rel, "code-execution")) {
          finding({ family: "capability", check: "code-execution", path: rel, line: at(imp.index),
            message: `imports \`${imp.spec}\`: it runs code built at run time, and ${allow.file} allows no code execution in this file` });
        }
      }
      for (const k of t.m.code.matchAll(/(?<![\w$.])eval\s*\(|(?<![\w$])(?:globalThis|window|global|self)\s*\.\s*eval\s*\(|(?<![\w$.])(?:new\s+Function|Function)\s*\(/g)) {
        if (declaredHere(t.m.code, k.index, k.index + k[0].length - 1)) continue;
        if (allowedCapability(rel, "code-execution")) continue;
        const what = /eval/.test(k[0]) ? "calls eval" : "builds a function from a string (the Function constructor)";
        finding({ family: "capability", check: "code-execution", path: rel, line: at(k.index),
          message: `${what}: code built at run time is executed, and ${allow.file} allows no code execution in this file` });
      }
    }

    // The boundary of the declared domain core, and the two capabilities the core alone is refused.
    if (inCore) {
      for (const imp of imports) {
        if (imp.spec === null) continue;
        const mk = moduleKind(imp.spec, policy);
        const kindWord = imp.typeOnly ? "type-only import" : imp.how === "static" ? "import" : imp.how === "dynamic" ? "dynamic import" : "require call";
        if (mk.kind === "relative") {
          const r = resolveImport(rel, imp.spec, exists, policy);
          const inside = r !== null && r.candidates.some((c) => core.has(c));
          if (!inside) finding({ family: "boundary", check: "core-import-outside", path: rel, line: at(imp.index),
            message: `${kindWord} of \`${imp.spec}\`${r ? ` (${r.path})` : " (outside the project)"}, which is outside the declared domain core (${via ?? "runward/territory.md"} binds this file to it)` });
        } else if (mk.kind === "absolute") {
          finding({ family: "boundary", check: "core-import-outside", path: rel, line: at(imp.index),
            message: `${kindWord} of the absolute path \`${imp.spec}\` from the declared domain core (${via ?? "runward/territory.md"})` });
        } else if (mk.kind === "builtin") {
          if (policy.processExecutionModules.includes(mk.name) || policy.codeExecutionModules.includes(mk.name)) continue; // a capability, said once above
          // The network is judged by what the import binds and reads; a table of constants is a built-in import.
          if (policy.networkModules.includes(mk.name) && opensNetwork(t.m, imp, mk.name)) {
            if (!allowedImport(imp.spec, mk.name) && !allowedCapability(rel, "network")) finding({ family: "capability", check: "network", path: rel, line: at(imp.index),
              message: `${kindWord} of \`${imp.spec}\` in the declared domain core (${via ?? "runward/territory.md"}): the network, which the core never opens` });
          } else if (!allowedImport(imp.spec, mk.name)) {
            finding({ family: "boundary", check: "core-import-builtin", path: rel, line: at(imp.index),
              message: `${kindWord} of the Node.js built-in \`${imp.spec}\` in the declared domain core (${via ?? "runward/territory.md"}), which ${allow.file} does not allow` });
          }
        } else if (/^(?:@\/|~\/|#)/.test(imp.spec) && !allowedImport(imp.spec, mk.name)) {
          // A path alias (`@/x`, `~/x`) or a package.json subpath import (`#x`) is no package name: what
          // it reaches is the project's own resolution, which this policy does not read.
          hypothesis({ family: "boundary", check: "core-import-alias", path: rel, line: at(imp.index),
            message: `${kindWord} of the alias \`${imp.spec}\` in the declared domain core (${via ?? "runward/territory.md"}): the reading does not resolve aliases, so whether it stays inside the core is not settled` });
        } else if (!allowedImport(imp.spec, mk.name)) {
          finding({ family: "boundary", check: "core-import-package", path: rel, line: at(imp.index),
            message: `${kindWord} of the package \`${mk.name}\` in the declared domain core (${via ?? "runward/territory.md"}), which ${allow.file} does not allow` });
        }
      }
      for (const k of t.m.code.matchAll(/(?<![\w$.])fetch\s*\(|(?<![\w$])(?:globalThis|window|self)\s*\.\s*fetch\s*\(|(?<![\w$.])new\s+(?:WebSocket|EventSource|XMLHttpRequest)\b/g)) {
        if (/\($/.test(k[0]) && declaredHere(t.m.code, k.index, k.index + k[0].length - 1)) continue; // a port's member of that name
        if (allowedCapability(rel, "network")) continue;
        finding({ family: "capability", check: "network", path: rel, line: at(k.index),
          message: `opens the network from the declared domain core (${/fetch/.test(k[0]) ? "a fetch call" : "a socket or request object"}); ${via ?? "runward/territory.md"} binds this file to the core` });
      }
      for (const k of t.m.code.matchAll(/(?<![\w$.])process\s*\.\s*env\b|(?<![\w$])import\s*\.\s*meta\s*\.\s*env\b|(?<![\w$.])(?:Bun|Deno)\s*\.\s*env\b/g)) {
        if (allowedCapability(rel, "environment")) continue;
        finding({ family: "capability", check: "environment", path: rel, line: at(k.index),
          message: `reads the process environment in the declared domain core (${via ?? "runward/territory.md"}): configuration belongs to an adapter that hands the core its values` });
      }
    }

    // SQL text joined to a value: what a parameterised query would avoid, and what a reading cannot confirm.
    if (!t.test) {
      for (const lit of t.m.literals) {
        if (lit.kind === "regex") continue;
        if (!/^\s*(?:SELECT|INSERT|UPDATE|DELETE)\s/i.test(t.src.slice(lit.start + 1, lit.start + 24))) continue;
        const v = lit.dynamic ? t.src.slice(lit.start + 1, lit.end - 1) : literalValue(t.src, lit);
        if (v === null || !/^\s*(?:SELECT|INSERT|UPDATE|DELETE)\s/i.test(v)) continue;
        const joined = lit.dynamic || /^\s*\+/.test(t.m.code.slice(lit.end, lit.end + 8));
        if (joined) hypothesis({ family: "capability", check: "sql-concatenation", path: rel, line: at(lit.start),
          message: "SQL text joined to a value: whether the value is escaped or bound as a parameter is not something this reading can confirm" });
      }
    }
  }

  // Secrets: every analysed and configuration file, raw text (comments and strings included).
  const formats = policy.secretFormats.map((f) => ({ f, re: new RegExp(f.pattern, "g"), example: f.example ? new RegExp(f.example) : null }));
  const anyNeedle = new RegExp(policy.secretFormats.flatMap((f) => f.needles).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
  const scanSecrets = (rel: string, text: string, lines: Pick<Masked, "lineStarts">): void => {
    if (!anyNeedle.test(text)) return;
    for (const { f, re, example } of formats) {
      // Each format carries the fixed text every match contains: a file without it cannot match.
      if (!f.needles.some((x) => text.includes(x))) continue;
      re.lastIndex = 0;
      for (const k of text.matchAll(re)) {
        if (example && example.test(k[0])) continue;
        if (f.id === "url-credentials" && placeholderCredentials(k[0], policy)) continue;
        if (f.id === "private-key-block" && !pemKeyBody(text, k.index + k[0].length)) continue;
        finding({ family: "secret", check: `secret-${f.id}`, path: rel, line: lineOf(lines, k.index),
          message: `holds a ${f.label}, ${k[0].length} characters long (the value is not printed): a credential of a known format in the delivered tree` });
      }
    }
  };
  for (const t of texts) scanSecrets(t.file.rel, t.src, t.m);
  for (const c of scope.config) {
    let text: string;
    try { text = readFileSync(c.abs, "utf8"); } catch { continue; }
    const lineStarts = [0];
    for (let k = 0; k < text.length; k++) if (text[k] === "\n") lineStarts.push(k + 1);
    scanSecrets(c.rel, text, { lineStarts });
  }

  // Test integrity, read from the test sources, never run.
  const declaredNames = new Set<string>();
  let dynamicNames = false;
  const assertionTypes = assertionTypeScope(texts, (from, spec) => resolveImport(from, spec, exists, policy)?.path ?? null);
  for (const t of texts) {
    if (!t.test) continue;
    const rel = t.file.rel;
    const cases = testCases(t.src, t.m);
    // A table of cases (`test.each`, `it.each`, `describe.each`) names them at run time: the census
    // cannot be complete for this tree, and says so rather than refuse.
    if (/(?<![\w$.])(?:test|it|describe)\s*\.\s*each\b/.test(t.m.code)) dynamicNames = true;
    const helpers = cases.length > 0 ? assertingHelpers(t.m) : new Set<string>();
    const callsHelper = (body: string): boolean => [...helpers].some((h) => new RegExp(`(?<![\\w$.])${h.replace(RE_SPECIAL, "\\$&")}\\s*\\(`).test(body));
    for (const c of cases) {
      if (c.name === null) dynamicNames = true; else declaredNames.add(c.name);
      if (c.skipped || c.body === null) continue;
      const shown = c.name === null ? "(a case whose name is computed)" : `"${c.name.length > 80 ? `${c.name.slice(0, 79)}…` : c.name}"`;
      if (!ASSERTION.test(c.body) && !callsHelper(c.body) && !SUBTEST.test(c.body) && !assertsOtherwise(t, c, assertionTypes)) {
        finding({ family: "test-integrity", check: "case-asserts-nothing", path: rel, line: c.line,
          message: `case ${shown} asserts nothing: its body calls no assertion, no helper of this file that asserts, and throws nothing` });
      } else if (tautological(c.body) && !callsHelper(c.body)) {
        hypothesis({ family: "test-integrity", check: "case-asserts-literals", path: rel, line: c.line,
          message: `case ${shown} asserts only on literals (such as assert.ok(true)): those assertions cannot fail on the code, so the case checks at most that its body does not throw` });
      }
    }
    const codeImports = t.imports.filter((i) => i.spec !== null && !policy.testFrameworkModules.includes(i.spec));
    if (cases.length === 0 && namedTest(rel)) {
      if (t.imports.length === 0) finding({ family: "test-integrity", check: "file-declares-nothing", path: rel, line: null,
        message: "is named as a test and declares no test case and imports nothing: it cannot exercise the delivered code" });
      else hypothesis({ family: "test-integrity", check: "file-no-visible-case", path: rel, line: null,
        message: "is named as a test and declares no test case this reader can see (cases registered through a helper are not followed)" });
    } else if (cases.length > 0 && codeImports.length === 0 && t.imports.every((i) => i.spec !== null)
      // A test that drives the delivery over the network (a global fetch, a socket) reaches it too.
      && !/(?<![\w$.])fetch\s*\(|(?<![\w$.])new\s+(?:WebSocket|EventSource)\b/.test(t.m.code)) {
      const fw = [...new Set(t.imports.map((i) => `\`${i.spec}\``))].join(", ");
      finding({ family: "test-integrity", check: "file-imports-only-framework", path: rel, line: null,
        message: `declares ${cases.length} test case(s) and imports ${fw ? `only the test framework (${fw})` : "nothing"}: it cannot exercise the delivered code` });
    }
  }
  for (const report of committedJUnitLedger(missionDir).reports) {
    const abs = join(root, report);
    let text: string;
    try { text = readFileSync(abs, "utf8"); } catch { continue; }
    const projection = junitProjection(text);
    if (projection === null) { reading.notAnalyzed.push({ what: `JUnit report ${report}, not read whole by the census (not a document this reader parses)`, files: 1, examples: [report] }); continue; }
    const names: string[] = [];
    for (const line of projection) {
      const j = JSON.parse(line) as unknown[];
      if (j[0] === "case" && typeof j[3] === "string") names.push(j[3]);
    }
    // A recorded name matches a declared one written whole, or as its tail after a space: reporters
    // prefix a case with its suites (`suite > case`, `suite case`).
    const tails = (name: string): string[] => {
      const out = [name];
      for (let k = name.indexOf(" "); k !== -1; k = name.indexOf(" ", k + 1)) out.push(name.slice(k + 1));
      return out;
    };
    const matches = (name: string): boolean => tails(name).some((x) => declaredNames.has(x));
    const extra = names.filter((x) => !matches(x));
    const matched = names.length - extra.length;
    const recorded = new Set(names.flatMap(tails));
    const missing = [...declaredNames].filter((d) => !recorded.has(d));
    if (extra.length > 0) {
      const first = extra.slice(0, 3).map((x) => `"${x.length > 60 ? `${x.slice(0, 59)}…` : x}"`).join(", ");
      const f: AnalysisFinding = { family: "test-integrity", check: "junit-case-without-source", path: report, line: null,
        message: `records ${extra.length} case(s) that no test source declares (${first}${extra.length > 3 ? ", …" : ""}): the report does not describe the tests in this tree` };
      if (dynamicNames || matched === 0) hypothesis({ ...f, message: `${f.message}; ${dynamicNames ? "some cases in the tree are named at run time" : "no case of the report matches the tree"}, so the census cannot be sure` });
      else finding(f);
    }
    if (missing.length > 0 && names.length > 0) hypothesis({ family: "test-integrity", check: "junit-source-case-absent", path: report, line: null,
      message: `${missing.length} case(s) the test sources declare are absent from this report (a report may cover part of the suite; regenerate it if it should cover them all)` });
  }

  // Cited symbols: carried by code, and not a placeholder constant.
  const seen = new Set<string>();
  const byRel = new Map(texts.map((t) => [t.file.rel, t]));
  // The evidence layer resolves a pointer to a canonical path (`/private/var` for `/var` on macOS):
  // the project root is matched in both spellings.
  const roots = [toPosix(root)];
  try { const real = toPosix(realpathSync(root)); if (!roots.includes(real)) roots.push(real); } catch { /* the logical root stands */ }
  const relTo = (abs: string): string | null => {
    for (const r of roots) if (abs.startsWith(`${r}/`)) return abs.slice(r.length + 1);
    return null;
  };
  let citedElsewhere = 0;
  for (const { deliverable } of GATED_DELIVERABLES) {
    const path = join(missionDir, deliverable);
    let content: string;
    try { content = readFileSync(path, "utf8"); } catch { continue; }
    for (const row of readManifest(content).rows) {
      if (row.status !== "applied") continue;
      for (const p of parseEvidencePointers(row.evidence)) {
        if (p.kind !== "file" || !p.path || !p.symbol || !/^[A-Za-z_$][\w$]*$/.test(p.symbol)) continue;
        const abs = resolveEvidencePath(p.path, resolutionBases(missionDir, deliverable));
        if (abs === null) continue;
        const rel = relTo(toPosix(abs));
        if (rel === null || rel.startsWith("runward/")) continue;
        const key = `${rel}#${p.symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = byRel.get(rel);
        if (!t) { if (policy.otherLanguages[extOf(rel)] !== undefined) citedElsewhere++; continue; }
        const id = new RegExp(`(?<![\\w$])${p.symbol.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`);
        if (!id.test(t.src)) continue; // absent from the file altogether: the evidence layer refuses it already
        // Present only inside comments: the evidence layer refuses the pointer itself, one violation on
        // its row (ADR-0114, RWD-2026-0194); a finding here would count the same comment twice. What this
        // family keeps is the name carried only by strings, which ADR-0114 reads as code and accepts.
        if (!symbolPresent(t.src, p.symbol, rel)) continue;
        const cited = `runward/${deliverable} (row ${row.rule})`;
        if (!id.test(t.m.code)) {
          const k = id.exec(t.src);
          finding({ family: "symbol", check: "symbol-only-in-comments", path: rel, line: k ? lineOf(t.m, k.index) : null,
            message: `\`${p.symbol}\`, cited by ${cited}, occurs in this file only inside comments or strings: no code carries the name` });
          continue;
        }
        if (/^[A-Z][A-Z0-9_]*$/.test(p.symbol)) continue; // a constant named as one is evidence by its value
        const esc = p.symbol.replace(RE_SPECIAL, "\\$&");
        const stubRe = new RegExp(`(?<![\\w$.])(?:const|let|var)\\s+${esc}\\s*(?::[^=;\\n]{1,200})?=\\s*(-?0(?:\\.0+)?|null|undefined|void\\s+0|"\\s*"|'\\s*'|\`\\s*\`|\\{\\s*\\}|\\[\\s*\\])\\s*(?:;|,|\\n|$)`, "gm");
        // The module's declaration of the name, never a block's local that shares it (`let header = ''`
        // inside a function, beside `Reply.prototype.header`).
        const stub = moduleLevelMatch(stubRe, t.m.code);
        // A string constant is a placeholder only when it is empty in the SOURCE: the masked text blanks
        // every string's contents, so `"   "` there may be `"abc"` here.
        const value = stub ? t.src.slice(stub.index + stub[0].indexOf(stub[1], stub[0].indexOf("=")), stub.index + stub[0].indexOf(stub[1], stub[0].indexOf("=")) + stub[1].length) : "";
        if (stub && (!/^["'`]/.test(stub[1]) || value.length === 2)) {
          // An empty value the code reads (`return [[], emptyParam]`) may be the behaviour itself, a shared
          // sentinel: said, never counted. Nothing reads a placeholder.
          const read = /^["'`[{]/.test(stub[1])
            ? valueRead(t, p.symbol, [stub.index, stub.index + stub[0].length], texts, (from, spec) => resolveImport(from, spec, exists, policy)?.path ?? null)
            : null;
          if (read !== null) {
            hypothesis({ family: "symbol", check: "symbol-sentinel-constant", path: rel, line: lineOf(t.m, stub.index),
              message: `\`${p.symbol}\`, cited by ${cited}, is declared as the empty constant \`${value.replace(/\s+/g, " ")}\` and read as a value (${read}): a shared empty value is behaviour, a placeholder is not, and the reading cannot settle which` });
            continue;
          }
          finding({ family: "symbol", check: "symbol-placeholder-constant", path: rel, line: lineOf(t.m, stub.index),
            message: `\`${p.symbol}\`, cited by ${cited}, is declared as the constant \`${value.replace(/\s+/g, " ")}\`: a placeholder, not behaviour` });
          continue;
        }
        const empty = new RegExp(`(?:(?<![\\w$.])function\\s*\\*?\\s*${esc}\\s*\\([^)]*\\)\\s*(?::[^{]{1,200})?|(?<![\\w$.])(?:const|let|var)\\s+${esc}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*)\\{\\s*\\}`).exec(t.m.code);
        if (empty) hypothesis({ family: "symbol", check: "symbol-empty-body", path: rel, line: lineOf(t.m, empty.index),
          message: `\`${p.symbol}\`, cited by ${cited}, is declared with an empty body` });
      }
    }
  }

  // Disclosures: what the reading did not cover.
  for (const [language, files] of [...scope.other.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    reading.notAnalyzed.push({ what: `${language} source (the policy reads JavaScript and TypeScript)`, files: files.length, examples: files.slice(0, 3) });
  }
  const coreOther = [...scope.other.values()].flat().filter((p) => core.has(p));
  if (coreOther.length > 0) reading.notAnalyzed.push({ what: "domain-core files in a language the policy does not read: their boundary is not checked", files: coreOther.length, examples: coreOther.slice(0, 3) });
  if (scope.tooLarge.length > 0) reading.notAnalyzed.push({ what: `files over the policy's size limit (${policy.maxFileBytes} bytes)`, files: scope.tooLarge.length, examples: scope.tooLarge.slice(0, 3) });
  if (scope.links.length > 0) reading.notAnalyzed.push({ what: "symbolic links, never followed (the reading stays inside the tree)", files: scope.links.length, examples: scope.links.slice(0, 3) });
  if (!core.declared) reading.notAnalyzed.push({ what: "the boundary family: runward/territory.md binds no file to `domain-core`, so there is no core to check (the other families ran)", files: 0, examples: [] });
  if (citedElsewhere > 0) reading.notAnalyzed.push({ what: "cited symbols in files the policy does not read", files: citedElsewhere, examples: [] });

  for (const row of [...allow.imports, ...allow.capabilities, ...allow.excluded].sort((a, b) => a.line - b.line)) {
    if (row.uses > 0) reading.allowances.used.push({ line: row.line, text: row.text, uses: row.uses });
    else reading.allowances.inert.push({ line: row.line, text: row.text });
  }
  const order = (a: AnalysisFinding, b: AnalysisFinding): number =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : (a.line ?? 0) - (b.line ?? 0) || (a.check < b.check ? -1 : a.check > b.check ? 1 : 0) || (a.message < b.message ? -1 : a.message > b.message ? 1 : 0);
  reading.findings.sort(order);
  reading.hypotheses.sort(order);
  return reading;
}

/** A URL credential that is a template, a placeholder or a local or documentation host. */
function placeholderCredentials(match: string, policy: AnalysisPolicy): boolean {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^:]*):([^@]*)@([^/?#]*)/i.exec(match);
  if (!m) return false;
  const [, user, password, hostPort] = m;
  if (/\$\{|\{\{|%s|^<|^\*+$|^x+$|^\.\.\.$/i.test(password) || /\$\{|\{\{|^</.test(user)) return true;
  const host = hostPort.replace(/:\d+$/, "").toLowerCase();
  return policy.placeholderHosts.some((h) => host === h || host.endsWith(`.${h}`)) || /\.(?:example|test|invalid|localhost)$/.test(host);
}

/** The base64 characters of the smallest private key (an Ed25519 key in PKCS #8 is 48 bytes, 64 characters). */
const PEM_MIN_BODY = 64;

/** Does the PEM armour whose BEGIN line ends at `from` hold a key? Its body, up to the END line (or, with
 *  none, the lines right after the armour), read through the syntax that carries it in source and
 *  configuration (quotes, `+`, commas, `\n` escapes, indentation, the headers of an encrypted key), must be
 *  base64, as long as the smallest key at least. An interpolation (`${…}`), a placeholder or code is none. */
function pemKeyBody(text: string, from: number): boolean {
  const endAt = text.indexOf("-----END ", from);
  const closed = endAt !== -1 && endAt - from <= 20_000;
  // The string syntax around a line of the body, stripped from both ends without a backtracking pattern.
  const lead = (c: number): boolean => isSpaceCode(c) || c === 34 || c === 39 || c === 96 || c === 43 || c === 44; // " ' ` + ,
  const trail = (c: number): boolean => lead(c) || c === 59 || c === 41 || c === 93; // and ; ) ]
  let body = "";
  for (const line of text.slice(from, closed ? endAt : Math.min(text.length, from + 20_000)).split(/\r\n|\r|\n|\\r\\n|\\n|\\r/)) {
    let a = 0;
    let b = line.length;
    while (a < b && lead(line.charCodeAt(a))) a++;
    while (b > a && trail(line.charCodeAt(b - 1))) b--;
    const t = line.slice(a, b);
    if (t === "") continue;
    if (body === "" && /^[A-Za-z][A-Za-z0-9-]*:\s/.test(t)) continue; // Proc-Type:, DEK-Info:, Version:
    if (/^[A-Za-z0-9+/=]+$/.test(t)) { body += t; continue; }
    if (closed) return false;
    break; // no END line: the key, if any, is the base64 right after the armour
  }
  return body.length >= PEM_MIN_BODY;
}

/** The first match of the global `re` at the top level of the module, outside every block. */
function moduleLevelMatch(re: RegExp, code: string): RegExpExecArray | null {
  let depth = 0;
  let at = 0;
  for (let k = re.exec(code); k !== null; k = re.exec(code)) {
    for (; at < k.index; at++) { if (code[at] === "{") depth++; else if (code[at] === "}") depth--; }
    if (depth === 0) return k;
  }
  return null;
}

/** Is the name at `index` inside an `import { … }` or `export { … }` list: named there, not read? */
function inSpecifierList(code: string, index: number): boolean {
  const open = code.lastIndexOf("{", index);
  if (open === -1 || code.indexOf("}", open) < index || /[;=()]/.test(code.slice(open, index))) return false;
  return /(?<![\w$.])(?:import|export)\s*(?:type\s*)?(?:[A-Za-z_$][\w$]*\s*,\s*)?$/.test(code.slice(Math.max(0, open - 80), open));
}

/** Where the code reads, as a value, the constant `name` that `t` declares over `decl` (`return [[],
 *  emptyParam]`, `v ?? noValues`): in `t`, outside its declaration and its export lists, or in a delivered
 *  file that imports it from `t`. `path:line` of the first read, or null when nothing reads it. */
function valueRead(t: FileText, name: string, decl: [number, number], texts: FileText[], resolves: (from: string, spec: string) => string | null): string | null {
  const readIn = (u: FileText, local: string, skip: [number, number]): number => {
    const code = u.m.code;
    for (const k of code.matchAll(new RegExp(`(?<![\\w$.#])${local.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`, "g"))) {
      if ((k.index >= skip[0] && k.index < skip[1]) || inSpecifierList(code, k.index)) continue;
      const p = code[skipBack(code, k.index - 1)];
      const q = skipAhead(code, k.index + local.length);
      if ((p === "{" || p === ",") && code[q] === ":") continue; // an object's key
      if (code[q] === "=" && code[q + 1] !== "=" && code[q + 1] !== ">") continue; // assigned, not read
      return k.index;
    }
    return -1;
  };
  const own = readIn(t, name, decl);
  if (own !== -1) return `${t.file.rel}:${lineOf(t.m, own)}`;
  for (const u of texts) {
    if (u === t || u.test) continue;
    for (const imp of u.imports) {
      if (imp.spec === null || !imp.spec.startsWith(".") || resolves(u.file.rel, imp.spec) !== t.file.rel) continue;
      const b = bindingsOf(u.m, imp);
      if (b === null) continue;
      for (const x of b.members) {
        if (x.name !== name || x.type) continue;
        const at = x.local === null ? imp.index : readIn(u, x.local, b.clause);
        if (at !== -1) return `${u.file.rel}:${lineOf(u.m, at)}`;
      }
      for (const w of b.wholes) {
        const k = new RegExp(`(?<![\\w$.])${w.replace(RE_SPECIAL, "\\$&")}\\s*\\??\\.\\s*${name.replace(RE_SPECIAL, "\\$&")}(?![\\w$])`).exec(u.m.code);
        if (k) return `${u.file.rel}:${lineOf(u.m, k.index)}`;
      }
    }
  }
  return null;
}

/** The reading as `check --json` publishes it (ADR-0030, additive): one implementation for every
 *  surface that carries it. */
export function analysisPayload(r: AnalysisReading): Record<string, unknown> {
  return {
    policy: r.policy, known: r.known, files: r.files,
    findings: r.findings, hypotheses: r.hypotheses, notAnalyzed: r.notAnalyzed, excluded: r.excluded,
    allowances: r.allowances, nonScope: r.nonScope,
  };
}
