import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseManifest, evidencePathTokens, adrIdExists, adrDecision, ruleSignatures, GATED_DELIVERABLES } from "./conformance.js";
import { isJUnitReport, junitTestResult } from "./tool-adapters.js";
import type { Violation } from "./conformance.js";
import { toPosix } from "./paths.js";

/**
 * The evidence layer (ADR-0019/0020/0021): deterministic checks on what an `applied`
 * pointer points at. Existence, non-vacuity, line count, substring, hash — bytes,
 * never judgment. It reads files; it never executes anything and never calls a model.
 *
 * Pointer grammar (opt-in per row, several per cell separated by `;`, prose untouched):
 *   file:PATH[:LINE][#SYMBOL] · test:PATH[::NAME] · adr:NNNN
 */

export interface EvidencePointer {
  kind: "file" | "test" | "adr";
  raw: string;
  path?: string;
  line?: number;
  symbol?: string;
  testName?: string;
  adrId?: string;
  /** The author WROTE a `#` / `::`, whether or not anything usable followed it. Without this the
   *  gate cannot tell "no symbol requested" from "a symbol was requested and lost", and the second
   *  case was silently treated as the first. */
  symbolDeclared?: boolean;
  testNameDeclared?: boolean;
  /** Set when the pointer was WRITTEN but cannot be used. Silence here is what let a bad `adr:`
   *  reference pass as prose while the row still looked typed to every other check. */
  malformed?: string;
}

/**
 * Does the file contain the pointer's symbol, at an identifier boundary?
 *
 * ADR-0051 decision 1, amending the declared substring depth of ADR-0019. Until 2026-08-13 this was
 * a bare `content.includes(symbol)`: a pointer `#guardFields` was green over a file that contained
 * only `guardFieldsLegacy`, so a renamed identifier — the exact case the violation message names —
 * stayed green whenever the old name was a prefix or fragment of the new one, and a seal could sit
 * on a pointer naming an identifier that no longer exists.
 *
 * For a symbol of identifier form the match now requires an occurrence not embedded in a larger
 * identifier (wrapped in `\w$`-boundaries; the character class is exactly what an identifier is made
 * of, so no escaping is needed). Non-identifier symbols — operators, dotted or quoted names — keep
 * the exact-substring semantics they have by construction, because an identifier boundary has no
 * meaning there. Test names (`::NAME`) are prose and are checked elsewhere, unchanged.
 */
export function symbolPresent(content: string, symbol: string): boolean {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol)) {
    return new RegExp(`(?<![\\w$])${symbol}(?![\\w$])`).test(content);
  }
  return content.includes(symbol);
}

const POINTER_PREFIX = /\b(file|test|adr):(\S.*)$/;

/** Parse the typed pointers out of an Evidence cell. One pointer per `;`-separated segment. */
/** Split on `;`, but never inside a quoted symbol or test name.
 *
 *  `evidence.split(";")` ran before anything knew about quotes, so
 *  `#"the guard fails closed; nothing passes"` became the symbol `"the` — present in nearly every
 *  file, so GREEN. The same cell with a comma was RED. A gate whose verdict depends on the
 *  punctuation inside a sentence is not deterministic in any useful sense. */
function splitSegments(evidence: string): string[] {
  const out: string[] = [];
  let buf = "", quote: string | null = null;
  for (let i = 0; i < evidence.length; i++) {
    const ch = evidence[i];
    if (quote) { if (ch === quote) quote = null; buf += ch; continue; }
    if (ch === '"') { quote = ch; buf += ch; continue; }
    if (ch === ";") { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/** Cut a segment where a NEW pointer starts, honouring quotes. A space or a comma between two
 *  pointers is the natural way to write them; only `;` was ever handled. */
function splitPointers(segment: string): string[] {
  const out: string[] = [];
  let buf = "", quote: string | null = null;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) { if (ch === quote) quote = null; buf += ch; continue; }
    if (ch === '"') { quote = ch; buf += ch; continue; }
    if (/\s|,/.test(ch) && /(^|[\s,])(file|test|adr):\S/.test(segment.slice(i))) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.filter((x) => x.trim());
}

export function parseEvidencePointers(evidence: string): EvidencePointer[] {
  const out: EvidencePointer[] = [];
  for (const segment of splitSegments(evidence)) {
    // Several pointers may share a segment, separated by a space or a comma. `.match` took the
    // FIRST and `(\S.*)$` swallowed the rest, so `file:a.ts#Sym file:deleted.ts` verified only the
    // first while the row still read as typed — a deleted file, cited, invisible to the gate.
    for (const chunk of splitPointers(segment)) {
    const m = chunk.trim().match(POINTER_PREFIX);
    if (!m) continue;
    const kind = m[1] as EvidencePointer["kind"];
    const rest = m[2];
    const raw = `${kind}:${rest.split(/\s/)[0]}`;
    if (kind === "adr") {
      const id = rest.match(/^(\d{1,6})\b/)?.[1];
      // `adr:ADR-9999` produced NO pointer at all and said nothing: the row then read as prose,
      // the drift check skipped it because the cell looked typed, and the operator believed a
      // decision had been cited. A malformed id is now a pointer that fails, not a pointer that
      // never existed.
      if (id) out.push({ kind, raw: `adr:${id}`, adrId: id });
      else out.push({ kind, raw: `adr:${rest.split(/\s/)[0]}`, adrId: undefined, malformed: "an ADR pointer is `adr:NNNN` — digits only, no `ADR-` prefix" });
      continue;
    }
    if (kind === "test") {
      const sep = rest.indexOf("::");
      const firstWs = rest.search(/\s/);
      if (sep !== -1 && (firstWs === -1 || sep < firstWs)) {
        const after = rest.slice(sep + 2);
        // A quoted name ends at its closing quote, so prose may follow it. Unquoted, the name runs
        // to the end of the segment — which is why a test name containing spaces cannot be followed
        // by a comment unless it is quoted.
        // The single quote is NOT a delimiter: in French it is an apostrophe, so
      // `::'l'invariant tient'` closed after one character and the gate then looked for `l` —
      // true of every non-empty file. A tautology dressed as a precise pointer.
      const q = after.match(/^\s*(")([\s\S]*?)\1/);
        const name = q ? q[2] : after.trim().replace(/^["'`]|["'`]$/g, "");
        out.push({ kind, raw, path: clean(rest.slice(0, sep)), testName: name || undefined, testNameDeclared: true });
      } else {
        out.push({ kind, raw, path: clean(rest.split(/\s/)[0]) });
      }
      continue;
    }
    // file:PATH[:LINE][#SYMBOL]
    //
    // A SYMBOL may contain spaces when quoted: `file:doc.md#"the exact sentence"`. Without quotes
    // the token ended at the first space, so `#the exact sentence` silently became `#the` — a
    // pointer the operator believed was precise, matching a word that appears everywhere. That is
    // a false positive in an evidence checker, the one failure mode it must not have. Quoted forms
    // are exact; unquoted ones keep the old single-token behaviour.
    let symbol: string | undefined;
    let token: string;
    const quoted = rest.match(/^([^\s#]+)#(")([\s\S]*?)\2/);
    let symbolDeclared = false;
    if (quoted) {
      token = clean(quoted[1]);
      symbol = quoted[3] || undefined;
      symbolDeclared = true;
    } else {
      token = clean(rest.split(/\s/)[0]);
      const hash = token.indexOf("#");
      if (hash !== -1) { symbolDeclared = true; symbol = token.slice(hash + 1) || undefined; token = token.slice(0, hash); }
    }
    let line: number | undefined;
    const ln = token.match(/:(\d+)$/);
    if (ln) { line = Number(ln[1]); token = token.slice(0, -ln[0].length); }
    // `raw` is what the OPERATOR reads in the error message. Computed from the leading token it
    // showed `file:doc.md#"the` for a pointer nobody wrote that way, sending them to look for a
    // typo that was not there. Rebuild it from what was actually parsed.
    const shown = `file:${token}${line !== undefined ? `:${line}` : ""}${symbolDeclared ? `#${symbol !== undefined && /\s/.test(symbol) ? `"${symbol}"` : symbol ?? ""}` : ""}`;
    out.push({ kind, raw: shown, path: token, line, symbol, ...(symbolDeclared ? { symbolDeclared: true } : {}) });
    }
  }
  return out;
}

/** Strip the trailing punctuation prose leaves on a token (`src/x.ts),` → `src/x.ts`). */
function clean(token: string): string {
  return token.replace(/[),.:]+$/, "");
}

/**
 * A rule signature is operator-authored data the gate compiles into a RegExp and runs against file
 * content — so a catastrophic-backtracking pattern could hang the gate on adversarial input (a
 * self-inflicted DoS in CI). Reject the two known-dangerous shapes up front, deterministically:
 *   1. a quantifier applied to a group that itself contains a quantifier — `(a+)+`, `([a-z]+)*`;
 *   2. a quantifier applied to a group holding an alternation — `(a|a)+`, `(ab|a)+`, `(\d|\d)*` —
 *      whose branches can overlap and blow up (the class the shape-1 screen misses).
 * This is a conservative screen (it may reject a rare safe pattern like `(a|b)+` — the operator
 * rewrites it), never a promise to catch every pathological regex; a linear-time engine (RE2) would
 * be the complete fix, at the cost of a native dependency this zero-dep core avoids. Signatures are
 * simple token alternations in practice. See ADR-0020.
 */
export function unsafeSignature(source: string): boolean {
  // Normalize character classes ([...], including [^()]) to a single token first: a quantifier INSIDE
  // a class (e.g. `([^()]+)+`) otherwise hides the inner quantifier from the scan, because the scan's
  // own `[^()]` stops at the `(` that lives literally inside the class. After normalization the class
  // becomes `C`, so `([^()]+)+` reads as `(C+)+` and is caught.
  const norm = source.replace(/\[(?:\\.|[^\]\\])*\]/g, "C");
  // 1. group whose body holds a quantifier, immediately followed by another quantifier: (…+…)+ (…*…)* etc.
  // `(?![?])` excluded `(?:...)` — the MOST common grouping form — so `(?:a+)+b` sailed through and
  // hung `check --strict` for over 20s on 38 characters. In CI that is a gate that renders no
  // verdict at all. Non-capturing, lookahead and named groups are matched the same way now: the
  // catastrophic backtracking does not care which kind of group it is.
  const NESTED = /\((?:\?[:=!]|\?<[^>]*>)?[^()]*[+*}][^()]*\)[+*{]/;
  // 2. group holding an alternation, immediately followed by a quantifier: (…|…)+ (…|…)* etc.
  const ALT = /\((?:\?[:=!]|\?<[^>]*>)?[^()]*\|[^()]*\)[+*{]/;
  const flat = (t: string) => NESTED.test(t) || ALT.test(t);
  if (flat(norm) || flat(source)) return true;

  // Nested GROUPS hide the pattern from a flat scan: in `((a+))+` the outer body contains
  // parentheses, so `[^()]*` never matches. Collapse the innermost group to a token, KEEPING any
  // quantifier that followed it, and scan again. Bounded so a pathological input cannot spin.
  let t = norm;
  for (let i = 0; i < 20; i++) {
    const next = t.replace(/\((?:\?[:=!]|\?<[^>]*>)?([^()]*)\)([+*?]|\{\d+(?:,\d*)?\})?/, (_m, body, q) =>
      // Keep WHAT the body carried, not just that it existed: `((a+))+` reduces to `(G+)+`, which the
      // flat scan catches, instead of `(G)+`, which it cannot. Dropping that mark is how the two
      // nested forms survived the first pass.
      `G${/[+*}]/.test(body) ? "+" : ""}${q ?? ""}`);
    if (next === t) break;
    t = next;
    if (flat(t)) return true;
  }
  return false;
}

/** The same three resolution bases as the drift pass (ADR-0004). */
export function resolutionBases(missionDir: string, deliverable: string): string[] {
  return [dirname(missionDir), missionDir, dirname(join(missionDir, deliverable))];
}

/** Resolve a pointer strictly WITHIN one of the three project bases (ADR-0019): an absolute
 *  path, or a `../` that climbs out of every base, is not "evidence in your project" — it is
 *  rejected, not resolved. `resolve` normalizes `..`; the containment check is a prefix test on
 *  the normalized path (with a separator, so `/a/project-evil` never counts as under `/a/project`). */
function resolveFile(p: string, bases: string[]): string | null {
  return resolvePointer(p, bases).abs;
}

/** The one definition of "inside the project", exported so the drift layer uses it too rather than
 *  keeping a looser copy that made prose succeed where a typed pointer failed. */
export function resolveEvidencePath(p: string, bases: string[]): string | null {
  return resolvePointer(p, bases).abs;
}

/** The path as the filesystem actually spells it, or null when it already matches.
 *
 *  macOS and Windows are case-insensitive, so `file:SRC/Guard.TS` resolves locally and fails on a
 *  Linux CI runner — a green that turns red somewhere else, which is the surprise that makes
 *  people stop trusting a gate. `realpathSync` does NOT canonicalise case, so the mis-spelling
 *  also reached the seal: the same file was sealed twice, under two names, and the lock counted
 *  13 files for 12. */
function onDiskSpelling(abs: string): string | null {
  // Segment by segment: `SRC/Guard.TS` is wrong twice, and reporting `SRC/guard.ts` would send the
  // operator to fix half of it and meet the same red on the next run.
  const parts = abs.split(sep);
  // A bare drive letter ("D:") is a DRIVE-RELATIVE path on Windows — readdirSync("D:") lists the
  // drive's current directory, not its root, so the walk diverged and the whole check silently
  // returned null: the mis-spelled pointer the test plants was never flagged (found by the first
  // windows-latest CI leg, 2026-08-17). The drive root is "D:\".
  let cur = parts[0] === "" ? sep : (/^[A-Za-z]:$/.test(parts[0]) ? parts[0] + sep : parts[0]);
  let differs = false;
  for (let i = parts[0] === "" ? 1 : 1; i < parts.length; i++) {
    const want = parts[i];
    if (!want) continue;
    let entries: string[];
    try { entries = readdirSync(cur); } catch { return null; }
    if (entries.includes(want)) { cur = join(cur, want); continue; }
    const hit = entries.find((e) => e.toLowerCase() === want.toLowerCase()
      || e.normalize("NFC") === want.normalize("NFC"));
    if (!hit) return null;
    differs = true;
    cur = join(cur, hit);
  }
  return differs ? cur : null;
}

/** Windows fallback for the segment walk: realpath canonicalises case AND expands 8.3 short
 *  names ("RUNNER~1" -> the long form), which defeats onDiskSpelling — the parent directory lists
 *  the long name, the walked path carries the short one, no match, null, and the case check
 *  silently skips on the exact platform it exists for (first windows-latest leg, 2026-08-17).
 *  The canonical path itself IS the on-disk spelling: compare only the pointer's own suffix below
 *  the (already-canonical) base. On macOS realpath echoes the queried case, so this returns null
 *  and the walk's verdict stands — behavior unchanged where the walk already worked. */
function spellingViaRealpath(pointerPath: string, baseAbs: string, real: string): string | null {
  if (!real.startsWith(baseAbs + sep)) return null;
  const disk = real.slice(baseAbs.length + 1);
  const wrote = pointerPath.split("/").join(sep);
  return disk.toLowerCase() === wrote.toLowerCase() && disk !== wrote ? real : null;
}

/** Resolve, and say WHY when it fails. "does not resolve" was printed for a file that exists, is
 *  readable, and sits in the same repository — the operator checks the path, finds it correct, and
 *  concludes the gate is broken. Refusing is often right; refusing without naming the reason is
 *  never right. */
function resolvePointer(p: string, bases: string[]): { abs: string | null; why?: "absolute" | "outside" | "unreadable"; at?: string; spelling?: string | null } {
  if (isAbsolute(p)) return { abs: null, why: "absolute" }; // never valid
  let sawOutside: string | undefined;
  for (const b of bases) {
    const baseAbs = realpathOr(resolve(b));
    const abs = resolve(resolve(b), p);
    if (!existsSync(abs)) continue;
    // The containment test must run on the REAL path. It used to be purely lexical, so a symlink
    // inside the project pointing at /etc/hosts passed it and was then read — and the seal turned
    // into an arbitrary-file read oracle, the very thing the code's own comment promised it
    // prevented. `characterize.ts` already lstat'd correctly; the gate did not.
    const real = realpathOr(abs);
    if (real === baseAbs || real.startsWith(baseAbs + sep)) return { abs: real, spelling: onDiskSpelling(abs) ?? spellingViaRealpath(p, baseAbs, real) };
    // A symlink whose target stays inside the enclosing REPOSITORY is an ordinary npm/pnpm
    // workspace (`packages/api/src/shared -> ../../shared`). Hardening containment to the real path
    // closed a genuine escape and broke that pattern in the same stroke: a green mission went red
    // on upgrade with no spelling that worked. The repository root is found the way
    // `findMissionRoot` finds a mission — by looking for a marker on disk, never by reading git
    // configuration (ADR-0039).
    const repo = repoRootAbove(baseAbs);
    if (repo && (real === repo || real.startsWith(repo + sep))) return { abs: real, spelling: onDiskSpelling(abs) };
    sawOutside = real;
  }
  return { abs: null, why: sawOutside ? "outside" : undefined, at: sawOutside };
}

/** The nearest enclosing directory carrying a repository marker, or null. Existence only. */
function repoRootAbove(from: string): string | null {
  let dir = from;
  for (let i = 0; i < 24; i++) {
    for (const marker of [".git", "pnpm-workspace.yaml", "lerna.json", "turbo.json", "nx.json"]) {
      if (existsSync(join(dir, marker))) return realpathOr(dir);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}


/** A deliverable's prose, with its Rule conformance table removed. A documentary rule may be proven
 *  by the section that states the fact; it may never be proven by the row that claims it. */
function textOutsideManifest(abs: string): string {
  let raw = "";
  try { raw = readFileSync(abs, "utf8"); } catch { return ""; }
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /^#{1,6}\s+Rule conformance/i.test(l));
  if (start === -1) return lines.join("\n");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^#{1,6}\s/.test(lines[i])) { end = i; break; }
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

/** Why this pointer proves nothing about the code, or null when it is a legitimate target. */
function circularEvidence(abs: string, missionDir: string, deliverable: string, symbol?: string): string | null {
  const self = realpathOr(resolve(join(missionDir, deliverable)));
  if (abs === self) {
    // Some rules ARE documentary: the usage registry, the named successor, the port placement map.
    // Their only honest evidence is the section of the deliverable that states the fact — and
    // refusing it outright made the gate contradict its own advice, since "What this gate verified"
    // pushes operators to type their pointers. Proof it was not theoretical: in the shipped example
    // and in runward's own mission, the rows left in prose are exactly those.
    //
    // The audit's actual vector was `file:<self>#<the rule's own slug>` — column 1 of the very row
    // making the claim, so it always matched. So the line is: cite a fact that lives OUTSIDE the
    // manifest table, not the row that declares it.
    if (!symbol) return "this is the manifest that carries the row, and it names nothing in it: cite the section that states the fact, or the code that applies the rule";
    const outside = textOutsideManifest(abs);
    if (!outside.includes(symbol)) return `this is the manifest that carries the row, and "${symbol}" appears only in its Rule conformance table: cite the section that states the fact, not the row that declares it`;
    return null;
  }
  const rulesHome = realpathOr(resolve(join(missionDir, "rules")));
  if (abs === rulesHome || abs.startsWith(rulesHome + sep)) return "this is the rule's own text, not its application — cite the code, the test or the ADR that applies it";
  return null;
}

/** The real path, or the input when it cannot be resolved (a broken link, a race). Never throws:
 *  an unresolvable path simply fails the containment test below, which is the safe direction. */
function realpathOr(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}

function isRegularFile(abs: string): boolean {
  try { return statSync(abs).isFile(); } catch { return false; }
}

/**
 * Blocking evidence checks for one gated deliverable (ADR-0019/0020):
 * typed pointers verified per type, resolvable pointed files non-empty,
 * signed rules matched against their signature.
 */
export function evidenceReport(missionDir: string, deliverable: string, signatures: Record<string, string>): Violation[] {
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) return [];
  const bases = resolutionBases(missionDir, deliverable);
  const out: Violation[] = [];

  for (const row of parseManifest(readFileSync(path, "utf8"))) {
    if (row.status !== "applied") continue;
    if (/^\[.*\]$/.test(row.rule)) continue; // template placeholder row
    const pointers = parseEvidencePointers(row.evidence);
    const resolvedFiles = new Map<string, string>(); // abs path → content (read once)

    for (const p of pointers) {
      if (p.malformed) { out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — ${p.malformed}` }); continue; }
      if (p.kind === "adr") {
        const why = adrDecision(missionDir, `ADR-${p.adrId}`);
        if (why) out.push({ rule: row.rule, problem: `typed pointer adr:${p.adrId} — ${why}` });
        continue;
      }
      const r = p.path ? resolvePointer(p.path, bases) : { abs: null as string | null };
      const abs = r.abs;
      if (!abs) {
        // "does not resolve" was printed for a file that exists, is readable, and sits in the same
        // repository. The operator checks the path, finds it correct, and concludes the gate is
        // broken. Name the real reason.
        const why = "why" in r && r.why === "outside"
          ? `resolves to ${("at" in r && r.at) || "a path"} — outside the project this mission audits (ADR-0019). Evidence must live in the repository under audit.`
          : "why" in r && r.why === "absolute"
            ? "an absolute path is never evidence in your project (ADR-0019) — cite a project-relative path"
            : "update it or remove the row";
        out.push({ rule: row.rule, problem: `typed pointer does not resolve: ${p.raw} — ${why}` });
        continue;
      }
      // CIRCULAR EVIDENCE. `file:<the manifest itself>#<the rule slug>` was a universal green key:
      // the slug is column 1 of every row, so the pointer always resolved and always matched. An
      // audit reached "36 of 36 typed pointers the gate opened and checked (100%)" on a mission
      // containing no evidence at all, then sealed it and assembled the ISO 42001 pack. Pointing at
      // `runward/rules/` is the same move one step removed: a rule cannot be its own application,
      // and its file contains the very tokens its `signature:` looks for.
      const selfRef = circularEvidence(abs, missionDir, deliverable, p.symbol);
      if (selfRef) { out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — ${selfRef}` }); continue; }
      if (!isRegularFile(abs)) { out.push({ rule: row.rule, problem: `typed pointer resolves to a directory, not a file: ${p.raw}` }); continue; }
      // Case (and Unicode form) only resolve here because this filesystem is forgiving. On a Linux
      // CI runner the same pointer fails, so a green obtained locally turns red where it counts.
      // Refuse now, with the spelling to copy, rather than let CI deliver the surprise.
      if ("spelling" in r && r.spelling) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — this filesystem is case-insensitive; on a case-sensitive one (Linux CI) it would not resolve. The file is spelled \`${toPosix(relative(resolve(dirname(missionDir)), r.spelling))}\``, });
        continue;
      }
      let content: string;
      try { content = readFileSync(abs, "utf8"); }
      catch (e) {
        // An unreadable file used to crash the process: the output stopped mid-section and `--json`
        // stopped being JSON at all, so an agent driving on the machine contract got nothing
        // parseable. The gate has no verdict on a file it cannot open — that is a verdict.
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — cannot be read (${(e as NodeJS.ErrnoException).code ?? "unknown"}): the gate has no verdict on a file it cannot open` });
        continue;
      }
      resolvedFiles.set(abs, content);
      if (!/\S/.test(content)) { out.push({ rule: row.rule, problem: `typed pointer resolves to an empty file: ${p.raw} — an empty file is not evidence` }); continue; }
      if (p.line !== undefined && content.split("\n").length < p.line) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the file has fewer than ${p.line} lines` });
      }
      // A pointer that LOOKS precise and checks nothing is worse than a bare path: the operator
      // believes a claim was verified. `#`, `#""`, `::` and a one-character symbol all produced a
      // silent no-op before this.
      if (p.symbolDeclared && (p.symbol === undefined || p.symbol.trim().length < 2)) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the \`#\` names nothing to look for (a symbol must be at least 2 characters); drop the \`#\` or name the symbol` });
      }
      if (p.testNameDeclared && (p.testName === undefined || p.testName.trim().length < 2)) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the \`::\` names no test; drop it or name the test` });
      }
      if (p.symbol !== undefined && !symbolPresent(content, p.symbol)) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — symbol "${p.symbol}" not found in the file (moved or renamed? update the pointer)` });
      }
      if (p.testName !== undefined) {
        // ADR-0056: when the pointed file is a committed JUnit report, resolve the named case
        // STRUCTURALLY — present and green — rather than by substring, which a failed case (its name
        // is still in the XML) would pass. Non-JUnit test files (a `.ts`/`.py` source) keep the
        // substring check: they carry the name, never a machine-readable result. The adapter READS
        // the committed report; it never runs the tool (the ADR-0054 crossing).
        if (isJUnitReport(content)) {
          const r = junitTestResult(content, p.testName);
          if (r === "absent") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — no JUnit test case named "${p.testName}" in the committed report` });
          else if (r === "fail") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the JUnit case "${p.testName}" is present but not green (failed, errored or skipped) — a red test is not evidence` });
        } else if (!content.includes(p.testName)) {
          out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — test named "${p.testName}" not found in the file` });
        }
      }
    }

    // Non-vacuity for every row (ADR-0019): a path token that resolves must resolve to real content.
    for (const t of evidencePathTokens(row.evidence)) {
      const abs = resolveFile(t, bases);
      if (!abs || !isRegularFile(abs) || resolvedFiles.has(abs)) continue;
      let content: string;
      try { content = readFileSync(abs, "utf8"); }
      catch (e) {
        out.push({ rule: row.rule, problem: `evidence points at a file the gate cannot read: ${t} (${(e as NodeJS.ErrnoException).code ?? "unknown"})` });
        continue;
      }
      resolvedFiles.set(abs, content);
      if (!/\S/.test(content)) {
        out.push({ rule: row.rule, problem: `evidence points at an empty file: ${t} — an empty file is not evidence` });
      }
    }

    // Signature (ADR-0020): a signed rule's applied evidence must contain the rule's shape.
    const sig = signatures[row.rule];
    if (sig) {
      if (unsafeSignature(sig)) { out.push({ rule: row.rule, problem: `unsafe signature regex (nested or overlapping-alternation quantifiers risk catastrophic backtracking): /${sig}/ — simplify it in runward/rules/${row.rule}.md` }); continue; }
      let re: RegExp;
      try { re = new RegExp(sig, "i"); }
      catch { out.push({ rule: row.rule, problem: `invalid signature regex in the rule file: /${sig}/ — fix runward/rules/${row.rule}.md` }); continue; }
      if (resolvedFiles.size === 0) {
        out.push({ rule: row.rule, problem: `this rule declares an evidence signature — point the applied evidence at a file (file: or test:) whose content matches /${sig}/i` });
      } else if (![...resolvedFiles.values()].some((c) => re.test(c))) {
        out.push({ rule: row.rule, problem: `evidence does not match the rule's signature /${sig}/i — the pointed content lacks the rule's shape (cited, not applied?)` });
      }
    }
  }
  return out;
}

// ── Evidence sealing (ADR-0021) — an opt-in SHA-256 seal of a green gate ──

export const EVIDENCE_LOCK = "evidence-lock.json";

function sha256(abs: string): string {
  // A seal must not crash on a file it cannot open: an unreadable file yields a sentinel that
  // never matches a real hash, so the seal reports drift instead of killing the process.
  let buf: Buffer;
  try { buf = readFileSync(abs); } catch { return "unreadable"; }
  // Same reason as the corpus hash: a Windows checkout rewrites line endings, and a seal that
  // breaks because git did its documented job is a seal people re-run with --freeze without
  // reading, which is exactly the habit the seal exists to prevent. Binary files are untouched:
  // a NUL byte means we hash the bytes as they are.
  if (buf.includes(0)) return createHash("sha256").update(buf).digest("hex");
  return createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

/** The seal's file hash, exported so the verdict attestation (ADR-0055) digests the mission with the
 *  exact same line-ending normalization the seal uses — two hashes of one tree must never disagree. */
export function normalizedFileSha256(abs: string): string {
  return sha256(abs);
}

/** Every evidence file that resolves across the gated manifests, keyed by project-root-relative path. */
export function collectSealableEvidence(missionDir: string): Record<string, string> {
  const root = dirname(missionDir);
  const files = new Map<string, string>();
  for (const { deliverable } of GATED_DELIVERABLES) {
    const path = join(missionDir, deliverable);
    if (!existsSync(path)) continue;
    const bases = resolutionBases(missionDir, deliverable);
    for (const row of parseManifest(readFileSync(path, "utf8"))) {
      if (row.status !== "applied" || /^\[.*\]$/.test(row.rule)) continue;
      const candidates = [
        ...parseEvidencePointers(row.evidence).map((p) => p.path).filter((p): p is string => !!p),
        ...evidencePathTokens(row.evidence),
      ];
      for (const t of candidates) {
        const abs = resolveFile(t, bases);
        // `resolveFile` returns the REAL path (symlinks resolved, ADR-0019 containment), so the key
        // must be computed against the real root too: on macOS /var is /private/var, and a mixed
        // pair produced `../../../private/var/...` as a lock key.
        if (abs && isRegularFile(abs)) files.set(toPosix(relative(realpathOr(resolve(root)), abs)), "");
      }
    }
  }
  // The manifests themselves are sealed too. Without them, an audit sealed 31 files, rewrote every
  // `applied` row to `n/a`, and the gate still said `✓ seal intact — 31 evidence file(s)`: the
  // frozen files were no longer invoked by anything. A seal must cover the claim, not only what the
  // claim happened to cite.
  for (const rel of sealedManifests(missionDir)) files.set(toPosix(relative(realpathOr(resolve(root)), realpathOr(join(missionDir, rel)))), "");
  const out: Record<string, string> = {};
  for (const rel of [...files.keys()].sort()) out[rel] = sha256(join(root, rel));
  return out;
}

/** The lock file content — stable order, byte-idempotent on unchanged evidence. */
export function renderEvidenceLock(missionDir: string, sealedAt: string): string {
  return JSON.stringify({ version: 1, sealedAt, files: collectSealableEvidence(missionDir) }, null, 2) + "\n";
}

/** Verify an existing seal. No lock file → no seal check (opt-in by construction). */
/** The gated manifests themselves. The seal froze the files evidence POINTS AT and never the
 *  documents that give them meaning: an audit sealed 31 files, then rewrote every `applied` row to
 *  `n/a`, and the gate still reported `✓ seal intact — 31 evidence file(s)`. A reader believes a
 *  seal says "this crossing is frozen"; it said "these 31 files have not moved", including when
 *  nothing invoked them any more. */
export function sealedManifests(missionDir: string): string[] {
  return GATED_DELIVERABLES.map((g) => g.deliverable).filter((d) => existsSync(join(missionDir, d)));
}

export function verifyEvidenceLock(missionDir: string): { present: boolean; sealedAt?: string; count: number; violations: Violation[] } {
  const lockPath = join(missionDir, EVIDENCE_LOCK);
  if (!existsSync(lockPath)) return { present: false, count: 0, violations: [] };
  const root = dirname(missionDir);
  let lock: { sealedAt?: string; files?: Record<string, string> };
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); }
  catch { return { present: true, count: 0, violations: [{ rule: "(seal)", problem: `runward/${EVIDENCE_LOCK} is not valid JSON — re-seal with \`runward check --freeze\` or remove it` }] }; }
  const files = lock.files ?? {};
  const violations: Violation[] = [];
  // A lock declaring a version this build does not understand must not be read as a v1. An audit
  // set `version: 999` and it was consumed silently.
  const v = (lock as { version?: unknown }).version;
  if (v !== undefined && v !== 1) {
    violations.push({ rule: "(seal)", problem: `runward/${EVIDENCE_LOCK} declares version ${JSON.stringify(v)}, this runward reads version 1 — upgrade runward or re-seal` });
  }
  // Sealing nothing is not a crossing. Rendered as `✓ seal intact — 0 evidence file(s)`, it looked
  // exactly like a real seal to anyone reading a CI log.
  if (Object.keys(files).length === 0) {
    violations.push({ rule: "(seal)", problem: `runward/${EVIDENCE_LOCK} seals zero files — it certifies nothing; re-seal with \`runward check --freeze\` or remove it` });
  }
  const rootAbs = resolve(root);
  for (const [rel, hash] of Object.entries(files)) {
    // Contain the lock's keys to the project, exactly as the writer does: a forged lock with an
    // absolute or `../`-escaping path must never make the verifier read/hash outside the project
    // (an arbitrary-file read oracle, and a DoS via /dev/zero or a huge file). Same check as resolveFile.
    const abs = resolve(rootAbs, rel);
    if (isAbsolute(rel) || !(abs === rootAbs || abs.startsWith(rootAbs + sep))) {
      violations.push({ rule: "(seal)", problem: `sealed path escapes the project: ${rel} — a lock entry must be a project-relative file. Re-seal with \`runward check --freeze\`` });
      continue;
    }
    if (!existsSync(abs) || !isRegularFile(abs)) {
      violations.push({ rule: "(seal)", problem: `sealed evidence missing: ${rel} — the file the gate crossed on is gone. Re-verify the pointer, then re-seal with \`runward check --freeze\`` });
    } else if (sha256(abs) !== hash) {
      violations.push({ rule: "(seal)", problem: `sealed evidence changed: ${rel} — re-read the pointer, confirm the evidence still holds, then re-seal with \`runward check --freeze\`` });
    }
  }
  return { present: true, sealedAt: lock.sealedAt, count: Object.keys(files).length, violations };
}

/** How much of a mission's `applied` evidence the gate actually opened, versus how much it took on
 *  the operator's word. Prose is legitimate (ADR-0004) — an absence has no file to cite — but a
 *  gate that accepts it in silence leaves the operator with no idea how thin the mechanical part
 *  is. One field mission ran at 0 typed rows out of 24 for months. Counting, never gating. */
export function evidenceBreakdown(missionDir: string, deliverables = GATED_DELIVERABLES): {
  rows: number; applied: number; deviated: number; na: number;
  typed: number; prose: number; signed: number;
  proseRows: Array<{ deliverable: string; rule: string }>;
} {
  let rows = 0, applied = 0, deviated = 0, na = 0, typed = 0, signed = 0;
  const proseRows: Array<{ deliverable: string; rule: string }> = [];
  // ADR-0051 decision 3: how many `applied` rows rest on a SIGNED rule (the gate checked the
  // evidence's shape), versus rows where the gate only confirmed the evidence exists and resolves.
  // Counting, never gating — the ADR-0020 depth made legible per run so a reader knows how thin the
  // shape-checked part is (one rule of 64 was signed before ADR-0051's slice).
  const signatures = ruleSignatures(missionDir);
  for (const g of deliverables) {
    const path = join(missionDir, g.deliverable);
    if (!existsSync(path)) continue;
    const bases = resolutionBases(missionDir, g.deliverable);
    for (const row of parseManifest(readFileSync(path, "utf8"))) {
      rows++;
      if (row.status === "deviated") { deviated++; continue; }
      if (row.status === "n/a") { na++; continue; }
      if (row.status !== "applied") continue;
      applied++;
      if (signatures[row.rule]) signed++;
      // "Typed" must mean the gate OPENED something, not that the cell looked like a pointer. An
      // audit reached "36 of 36 (100%)" citing the rule files themselves: every pointer parsed,
      // resolved, and proved nothing. A pointer that this gate now refuses must not be counted as
      // coverage — the number was more optimistic than the verdict, which is the worst direction.
      const verified = parseEvidencePointers(row.evidence || "").some((p) => {
        if (p.kind === "adr") return !!p.adrId && adrIdExists(missionDir, `ADR-${p.adrId}`);
        if (!p.path) return false;
        const abs = resolveFile(p.path, bases);
        if (!abs || !isRegularFile(abs)) return false;
        return !circularEvidence(abs, missionDir, g.deliverable);
      });
      if (verified) typed++;
      else proseRows.push({ deliverable: g.deliverable, rule: row.rule });
    }
  }
  return { rows, applied, deviated, na, typed, prose: proseRows.length, signed, proseRows };
}
