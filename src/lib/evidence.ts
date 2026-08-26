import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { parseManifest, evidencePathTokens, adrIdExists, adrDecision, adrFilename, ruleSignatures, GATED_DELIVERABLES, VALID_STATUS } from "./conformance.js";
import { isJUnitReport, junitTestResult, isSarifReport, sarifRuleResult, isLcovReport, lcovFileResult, isCoberturaReport, coberturaFileResult, isEslintReport, eslintFileResult, isCycloneDxSbom, sbomComponentPresent } from "./tool-adapters.js";
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
  // Line terminators are folded to a space FIRST, and this is a correctness fix, not tidiness.
  //
  // `POINTER_PREFIX` ends in `$`, and JavaScript's `.` never matches a line terminator, so a single
  // CR, U+2028 or U+2029 anywhere after the prefix makes `$` unreachable and the pointer is dropped
  // in SILENCE: the row still reads as typed, and the cited file is never opened. Measured on
  // 2026-08-21 against 0.36.0, on a row citing a file that does not exist — `exit 1` with an
  // ordinary cell, `exit 0` with a U+2028 in it. A character nobody can see turned a refusal into a
  // pass, which is RWD-2026-0006, the pointer that looks precise and verifies nothing.
  //
  // A manifest cell is one logical line by construction, so an embedded terminator is invisible
  // junk a paste left behind; folding it to a space makes such a cell parse exactly like the same
  // cell typed by hand. Space is already a pointer separator, so no well-formed cell changes
  // meaning — only cells that used to be swallowed now get read.
  for (const segment of splitSegments(evidence.replace(/[\r\n\u2028\u2029]+/g, " "))) {
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
  // The backtick joined this set on 2026-08-26. `- login works \`file:src/auth.ts#login\`` — a
  // pointer written the way markdown is written — parsed its symbol as ``login` `` and the gate
  // reported *symbol "login`" not found*. An undue refusal, and the operator sees a pointer that
  // is correct being called wrong. It only surfaced where the pointer ends the line: in a manifest
  // cell something usually follows it. No path segment and no identifier ends in a backtick.
  return token.replace(/[),.:`]+$/, "");
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

  // 3. THE SAME ATOM QUANTIFIED TWICE IN A ROW: `a*a*`, `\d+\d+`, `[-\s]?[-\s]?`. No group is
  // involved, so both scans above are blind to it, and it is exponential in the number of repeats:
  // measured 2026-08-26 against a 40-character subject, 4 repeats cost 13 ms, 6 cost 713 ms, and
  // **8 exceeded 20 s** — `a*a*a*a*a*a*a*a*X` is a seventeen-character signature that renders no
  // verdict at all. The audit reached the same wall with twenty; the real cliff is at eight.
  // Adjacency plus identity is the whole test: `\s*\d+` is two disjoint atoms and stays legal,
  // and every signature this corpus ships separates its quantifiers with literal text.
  const ATOM = String.raw`(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\\\[\](){}|*+?^$])`;
  const QUANT = String.raw`(?:[*+?]|\{\d+(?:,\d*)?\})`;
  if (new RegExp(`(${ATOM})${QUANT}\\1${QUANT}`).test(source)) return true;

  // Nested GROUPS hide the pattern from a flat scan: in `((a+))+` the outer body contains
  // parentheses, so `[^()]*` never matches. Collapse the innermost group to a token, KEEPING any
  // quantifier that followed it, and scan again. Bounded so a pathological input cannot spin.
  let t = norm;
  // The budget was a flat 20 and the loop fell through to `return false`. Two defects in one line:
  // the reducer collapsed ONE group per pass, so 20 passes bought 20 levels, and past that the
  // screen ACCEPTED the pattern. Measured 2026-08-26: depths 18-21 caught, 22 and beyond accepted,
  // and `(((…25…)))a+(((…25…)))+$` then killed `check --strict` at 25 s with NO VERDICT AT ALL —
  // in CI, a gate that renders nothing. The realistic carrier is not the operator attacking their
  // own gate: it is `update --corpus <path>` (ADR-0057), which vendors a third party's rules.
  //
  // Now the replace is global, so one pass removes one whole LEVEL however wide it is, and the
  // budget comes from the input — a pattern cannot need more passes than it has opening groups.
  const opens = (norm.match(/\(/g) || []).length;
  // Past this, refuse rather than reduce. A rule signature is a shape like /sand[-\s]?box/; nothing
  // legitimate in this corpus carries dozens of nested groups, and an unbounded reduction is its own
  // way to spend the operator's CPU.
  if (opens > 64) return true;
  for (let i = 0; i <= opens; i++) {
    const next = t.replace(/\((?:\?[:=!]|\?<[^>]*>)?([^()]*)\)([+*?]|\{\d+(?:,\d*)?\})?/g, (_m, body, q) =>
      // Keep WHAT the body carried, not just that it existed: `((a+))+` reduces to `(G+)+`, which the
      // flat scan catches, instead of `(G)+`, which it cannot. Dropping that mark is how the two
      // nested forms survived the first pass.
      `G${/[+*}]/.test(body) ? "+" : ""}${q ?? ""}`);
    if (next === t) break;
    t = next;
    if (flat(t)) return true;
  }
  // Groups still standing means the reduction never reached a fixpoint, so this function has NO
  // OPINION on the pattern. The safe answer to "is this regex catastrophic?" when you cannot tell is
  // refuse — the old code answered "no", which is how the cliff above was a cliff and not a ceiling.
  // A pattern that is not a valid regex keeps its own, better message from the caller.
  if (/[()]/.test(t)) {
    try { new RegExp(source); } catch { return false; }
    return true;
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

/** Returned when the spelling could not be established at all — never confused with "it matches".
 *  A string that cannot be a path, so no caller can mistake it for one. */
export const UNCHECKABLE = "\u0000unchecked";

/** The walk reached the end and every segment was listed exactly as written: a VERIFIED match.
 *
 *  `null` used to mean this AND "a segment matched nothing, I have no opinion", and the two are
 *  opposite facts. `resolvePointer` consults the realpath fallback on `null`, so a verified match
 *  was being overruled by a rung that cannot tell a case divergence from a symlink traversal —
 *  RWD-2026-0033. The walk already computes the distinction; it was throwing it away. */
export const SPELLING_VERIFIED = "\u0000verified";

/** Is this a real on-disk spelling, rather than one of the walk's sentinels?
 *
 *  Both sentinels are strings, so path arithmetic accepts them happily: `relative()` and `join()`
 *  will splice `\u0000unchecked` into a path and hand it to the operator. Measured 2026-08-26 with
 *  the equality branch defeated, the gate emitted
 *  ``The file is spelled `../../../…/\u0000unchecked` `` into `--json`, `--sarif` and the in-toto
 *  attestation, and nothing downstream rejects a control character in that field.
 *
 *  In the shipped build the identity test runs first, so the sentinel does not reach there — which
 *  is exactly the objection: the property held by ORDERING, not by construction, and an equivalence
 *  verdict resting on branch order is one refactor from being a false green. Every sentinel here is
 *  prefixed U+0000 precisely so ONE structural test excludes all of them, including any added later. */
function isSpelling(v: string | null | undefined): v is string {
  return typeof v === "string" && v !== "" && !/[\u0000-\u001f]/.test(v);
}

/** Two names the filesystem would treat as one, folded to a single form.
 *
 *  Unicode case folding is the operation this wants, and JavaScript does not expose it, so the fold
 *  goes through case conversion: `toLowerCase()` alone leaves ſ, ς, ϑ and ß where they are, while a
 *  round trip collapses each onto the name a case-insensitive filesystem opens. NFC first, because a
 *  divergence can be in form and in case at once.
 *
 *  LOWER FIRST, and that leading `toLowerCase()` is a fix, not decoration. `toUpperCase()` is a
 *  no-op on a character that is ALREADY upper case, so a round trip starting there never reaches the
 *  filesystem's own fold for such a character. Measured 2026-08-26: `"ß".toUpperCase()` is `"SS"`, so
 *  the lower-case sharp s folded correctly — but `"ẞ".toUpperCase()` is `"ẞ"` and lower-cases to
 *  `"ß"`, never to `"ss"`. APFS opens `ssharp.ts` under BOTH spellings, so `file:…/ẞharp.ts` cited a
 *  file the gate then declared correctly spelled: `check --strict` exit 0 / verdict clean, and
 *  `--freeze` SEALED `"…/ẞharp.ts"` into the lock — a key no case-sensitive filesystem holds. The
 *  corpus asserted in the test carried the lower-case half of that pair and not its upper-case twin,
 *  which is exactly how a fold that is not idempotent survives a subsumption test.
 *
 *  The widening is bounded, and measured rather than argued: swept over the whole BMP, this fold
 *  merges exactly ONE pair the previous one separated (ß ~ ẞ) and separates NOTHING the previous one
 *  merged. So it is a strict refinement — it can only ever widen what the gate refuses. */
const caseFold = (s: string): string =>
  s.normalize("NFC").toLowerCase().toUpperCase().toLowerCase();

/** The path as the filesystem actually spells it, `UNCHECKABLE`, or null when it already matches.
 *
 *  macOS and Windows are case-insensitive, so `file:SRC/Guard.TS` resolves locally and fails on a
 *  Linux CI runner — a green that turns red somewhere else, which is the surprise that makes
 *  people stop trusting a gate. `realpathSync` does NOT canonicalise case, so the mis-spelling
 *  also reached the seal: the same file was sealed twice, under two names, and the lock counted
 *  13 files for 12.
 *
 *  EXPORTED FOR TESTING, and the reason is this function's own central problem. Driven through the
 *  gate it is UNREACHABLE on a case-sensitive filesystem: `file:src/Guard.TS` does not resolve
 *  there, so `resolvePointer` refuses the pointer for an entirely different reason and never calls
 *  this. The tests that appear to guard the ladder therefore pass on a Linux runner for a reason
 *  unrelated to the code they name. Measured on the chunked CI run of 2026-08-25 (ubuntu-latest,
 *  950 mutants over this module): `onDiskSpelling` 22 % and `spellingViaRealpath` 26 %, against
 *  50-100 % for every other function here, while the same mutants die on macOS. The survivor list
 *  was not describing the code; it was describing the code plus the filesystem.
 *
 *  The function itself is filesystem-INDEPENDENT — it lists directories and compares strings,
 *  nothing more — so a test that calls it directly pins it everywhere. That test is
 *  test/unit/evidence-spelling-ladder.test.js. Through the gate stays right for integration and is
 *  wrong for this unit. */
export function onDiskSpelling(abs: string): string | null {
  // Segment by segment: `SRC/Guard.TS` is wrong twice, and reporting `SRC/guard.ts` would send the
  // operator to fix half of it and meet the same red on the next run.
  const parts = abs.split(sep);
  // A bare drive letter ("D:") is a DRIVE-RELATIVE path on Windows — readdirSync("D:") lists the
  // drive's current directory, not its root, so the walk diverged and the whole check silently
  // returned null: the mis-spelled pointer the test plants was never flagged (found by the first
  // windows-latest CI leg, 2026-08-17). The drive root is "D:\".
  let cur = parts[0] === "" ? sep : (/^[A-Za-z]:$/.test(parts[0]) ? parts[0] + sep : parts[0]);
  let differs = false;
  // Index 1, not a ternary: `parts[0] === "" ? 1 : 1` had the same literal in both branches, so it
  // read like a decision and made none. A POSIX absolute path splits with an empty first component
  // and a Windows path starts with the drive letter; `cur` above already absorbed both, so the walk
  // starts at 1 either way.
  for (let i = 1; i < parts.length; i++) {
    const want = parts[i];
    if (!want) continue;
    let entries: string[];
    // A directory that is traversable but not listable answers EACCES here. Returning null said
    // "the spelling is fine", because null is what this function returns when it already matches —
    // so one permission bit silently cleared the case check for everything beneath it. Measured
    // 2026-08-24 on 0.36.1: `file:./src/Guard.TS` is refused under 0755 and passes under 0111, on
    // a filesystem where it resolves only because the filesystem is forgiving. That is the same
    // family as RWD-2026-0016 — a green here that turns red on the runner where it counts.
    //
    // UNCHECKABLE is its own answer. ADR-0045: where the gate cannot verify, it says so IN THE RUN.
    try { entries = readdirSync(cur); } catch { return UNCHECKABLE; }
    if (entries.includes(want)) { cur = join(cur, want); continue; }
    // ONE rung, and it has to be at least as strong as the filesystem's own fold or the check has a
    // hole shaped exactly like the surprise it exists to prevent. This used to be two rungs,
    // `toLowerCase()` and `normalize("NFC")`, and both are weaker than APFS. Measured 2026-08-26 on
    // this machine, five names the filesystem opens under a different spelling:
    //
    //     query          on disk   toLowerCase   NFC     NFKC    NFC+upper+lower
    //     ſ (U+017F)     s         no            no      yes     yes
    //     ς (U+03C2)     σ         no            no      no      yes
    //     ϑ (U+03D1)     θ         no            no      yes     yes
    //     K (U+212A)     k         yes           no      no      yes
    //     ß (U+00DF)     ss        no            no      no      yes
    //
    // So `file:code/ſguard.ts` opened `sguard.ts`, no rung matched, `if (!hit) return null` said
    // "the spelling already matches", and `check --strict` answered exit 0 / clean on a mission a
    // case-sensitive runner refuses. That is the RWD-2026-0016 family, one level below case.
    //
    // `toUpperCase().toLowerCase()` is not elegant and it is what JavaScript gives: there is no
    // `toCaseFold`, and round-tripping through upper case is what collapses ς onto σ and ß onto ss.
    // It SUBSUMES both rungs it replaces rather than sitting beside them — dead rungs in a
    // comparison this load-bearing are worse than one clear one — and that subsumption is asserted
    // over a corpus in test/unit/evidence-spelling-ladder.test.js, so this can only ever have
    // widened what the gate refuses, never narrowed it.
    const hit = entries.find((e) => caseFold(e) === caseFold(want));
    if (!hit) return null;
    differs = true;
    cur = join(cur, hit);
  }
  // Reaching here means every segment was found. `differs` says whether any of them was found under
  // a different spelling. Both are POSITIVE answers — the early `return null` above, where a segment
  // matched nothing at all, is the only "no opinion" this function has.
  return differs ? cur : SPELLING_VERIFIED;
}

/** Windows fallback for the segment walk: realpath canonicalises case AND expands 8.3 short
 *  names ("RUNNER~1" -> the long form), which defeats onDiskSpelling — the parent directory lists
 *  the long name, the walked path carries the short one, no match, null, and the case check
 *  silently skips on the exact platform it exists for (first windows-latest leg, 2026-08-17).
 *  The canonical path itself IS the on-disk spelling: compare only the pointer's own suffix below
 *  the (already-canonical) base.
 *
 *  THIS COMMENT USED TO SAY "on macOS realpath echoes the queried case, so this returns null and
 *  the walk's verdict stands". That is false, and it was false about the very call this function
 *  makes. Measured 2026-08-26 on APFS: plain `realpathSync` returns `SRC/Guard.TS` unchanged, but
 *  `realpathSync.native` returns `src/guard.ts` — and this function deliberately uses `.native`.
 *  The fallback is LIVE on macOS, not inert. That mattered: it is why 18 of 19 mutants in
 *  `onDiskSpelling` read identical when probed through an ordinary macOS mission, because this
 *  function silently re-derived the verdict the walk had lost. Anyone instructing the ladder from
 *  an ordinary mission concludes "harmless" for mutants that are not.
 *
 *  EXPORTED FOR TESTING for the same reason as `onDiskSpelling` above: through the gate this rung
 *  is reached only when the walk returns null, which on a case-insensitive volume implies the walk
 *  already saw the divergence — so the rung is dead code there and no mission can drive it. It
 *  measured 26 % on the Linux runner of 2026-08-25. Called directly, it is testable anywhere. */
export function spellingViaRealpath(pointerPath: string, baseAbs: string, abs: string): string | null {
  // realpathSync PLAIN is the JS walker and does NOT canonicalise case on Windows; only .native
  // (GetFinalPathNameByHandle) returns the true on-disk spelling and expands 8.3 names. Both sides
  // go through .native so the prefix comparison holds whatever form the caller resolved with.
  let canonBase: string, canon: string;
  try { canonBase = realpathSync.native(baseAbs); canon = realpathSync.native(abs); } catch { return null; }
  if (!canon.startsWith(canonBase + sep)) return null;
  const disk = canon.slice(canonBase.length + 1);
  // NORMALISE what the operator wrote before comparing it to what the disk says. `disk` comes out of
  // a canonical path and carries no `./`; `pointerPath` is the raw cell, so `file:./src/Guard.TS`
  // gave `.\src\Guard.TS` against `src\guard.ts`, the comparison failed on the prefix rather than
  // on the case, and the mis-spelling was ACCEPTED.
  //
  // Windows only, and silently: there `onDiskSpelling` is already defeated by 8.3 short names
  // (`RUNNER~1`), so this function is the only rung left and its failure is the whole ladder's.
  // Measured on the windows-latest leg, 2026-08-25 — `file:src/Guard.TS` refused, the same pointer
  // written `file:./src/Guard.TS` accepted, on a tree where it resolves only because the filesystem
  // is case-insensitive. A green there that turns red on a case-sensitive runner.
  const wrote = normalize(pointerPath.split("/").join(sep));
  return disk.toLowerCase() === wrote.toLowerCase() && disk !== wrote ? canon : null;
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
    if (real === baseAbs || real.startsWith(baseAbs + sep)) {
      // `??` only falls through on null — "already matches". UNCHECKABLE is carried, not replaced:
      // the realpath fallback answers a different question (it canonicalises), and letting it
      // overwrite "I could not look" would restore the false green this sentinel exists to stop.
      const walked = onDiskSpelling(abs);
      // The fallback is consulted ONLY where the walk has no opinion. A walk that reached the end
      // with every segment listed verbatim has READ the answer off the directory entries, and the
      // realpath rung must not overrule it: that rung compares a canonical suffix against what was
      // written, and cannot tell a case divergence from a traversal through a symlink whose own
      // name is a case-variant of its target (`SRC -> src`). Measured 2026-08-25 on a case-sensitive
      // volume: `file:probe/SRC/guard.ts` refused, with a message false in both halves — it named a
      // case-insensitive filesystem that was not, and prescribed rewriting a path already correct.
      const spelling = walked === null ? spellingViaRealpath(p, baseAbs, abs)
        : walked === SPELLING_VERIFIED ? null : walked;
      return { abs: real, spelling };
    }
    // A symlink whose target stays inside the enclosing REPOSITORY is an ordinary npm/pnpm
    // workspace (`packages/api/src/shared -> ../../shared`). Hardening containment to the real path
    // closed a genuine escape and broke that pattern in the same stroke: a green mission went red
    // on upgrade with no spelling that worked. The repository root is found the way
    // `findMissionRoot` finds a mission — by looking for a marker on disk, never by reading git
    // configuration (ADR-0039).
    const repo = repoRootAbove(baseAbs);
    if (repo && (real === repo || real.startsWith(repo + sep))) {
      const walked = onDiskSpelling(abs);
      return { abs: real, spelling: walked === SPELLING_VERIFIED ? null : walked };
    }
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
/** The deliverable minus its own Rule conformance table(s) — the only text a self-citation may
 *  legitimately point at.
 *
 *  Fence-aware, and that is the whole point. `readManifest` already refuses a table inside a
 *  ```` ``` ```` fence, because "an example of the format pasted above the real table" was a real
 *  audit finding. This function used to take the FIRST heading it saw, fenced or not, so a format
 *  illustration above the table made the excluded slice run from the illustration to the real
 *  heading — leaving the real table inside the "outside" text, where every rule slug is found.
 *  Measured on 2026-08-21 against 0.36.0: the same `file:<self>#<own slug>` row exits 1 without the
 *  illustration and 0 with it. That is RWD-2026-0002, the universal green key, reopened by a code
 *  fence.
 *
 *  Every non-fenced section is excluded rather than the first, and a fenced heading neither starts
 *  nor ends one. `readManifest` refuses a deliverable with two real sections, so the plural case is
 *  already dead upstream; excluding all of them keeps this function safe on its own terms instead of
 *  relying on that. Excluding more text is the strict direction: it can only refuse a self-citation,
 *  never admit one. */
function textOutsideManifest(abs: string): string {
  let raw = "";
  try { raw = readFileSync(abs, "utf8"); } catch { return ""; }
  const lines = raw.split("\n");

  const fenced: boolean[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) { fenced.push(true); inFence = !inFence; continue; }
    fenced.push(inFence);
  }
  const heading = (i: number) => !fenced[i] && /^#{1,6}\s/.test(lines[i]);

  const keep: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (heading(i) && /^#{1,6}\s+Rule conformance/i.test(lines[i])) {
      i++;
      while (i < lines.length && !heading(i)) i++;
      i--;                                    // the loop's own i++ lands on the next heading
      continue;
    }
    // A CONFORMANCE ROW IS NEVER "text outside the manifest", wherever it sits.
    //
    // Measured 2026-08-26 on the shipped example. A deliverable whose only citation is
    // `file:<self>#<its own slug>` is refused, correctly: exit 1, one conformance gap. Paste a
    // fenced illustration of a manifest row above the section — the kind of block any document
    // explaining the format carries — and the same mission returns exit 0, verdict clean. Fenced
    // text is KEPT on purpose (a code sample can be honest evidence), so the row became a valid
    // self-citation target, one fence removed. RWD-2026-0002's universal green key, re-armed by an
    // illustration.
    //
    // The unfenced variant is the same hole and was never reported: a bare `| slug | applied | … |`
    // line sitting outside the Rule conformance section is not read by `readManifest`, and was kept
    // here. Measured the same day, same tree: exit 0 as well.
    //
    // So the test is on the SHAPE, not on the fence: three cells or more, whose second is one of
    // the three decisions a row may carry. That is a row DECLARING conformance, which is exactly
    // what circularEvidence's own sentence excludes — "cite the section that states the fact, not
    // the row that declares it". An ordinary documentation table (`| rule | where it lives |`) has
    // no status cell and is untouched, which is asserted rather than assumed in
    // test/unit/evidence-circular-rows.test.js, along with the prose form that must keep passing.
    if (conformanceRow(lines[i])) continue;
    keep.push(lines[i]);
  }
  return keep.join("\n");
}

/** Is this line a conformance-manifest row — `| rule | applied | evidence |` — rather than prose or
 *  an ordinary table? Judged on the status cell, so a documentation table that happens to name a
 *  rule stays what it is. */
function conformanceRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  if (cells.length < 3 || !VALID_STATUS.has(cells[1].toLowerCase())) return false;
  // OUTER PIPES ARE NOT REQUIRED, and the asymmetry below is the whole difficulty.
  //
  // Requiring a leading pipe closed only one spelling of the hole. Measured 2026-08-26 on the
  // shipped example: the same row written WITHOUT outer pipes — `slug | applied | file:…`, which a
  // markdown renderer still lays out as a table — was kept as "text outside the manifest", and
  // `check --strict` went from exit 1 with one conformance gap to exit 0, verdict clean, with
  // `--freeze` sealing it. RWD-2026-0002's universal green key, re-armed a second time.
  //
  // Simply dropping the pipe test is the obvious repair and it is WRONG, measured on a 571-case
  // battery: it starts refusing honest evidence in a fenced shell pipeline
  // (`runward explain <rule> | applied | head -1`), a fenced `// <rule> | applied | …` comment,
  // pipe-bearing prose, a list item and a blockquote — twelve honest cases that clear a citation on
  // the shipped build. A gate that refuses honest evidence is the one that gets switched off.
  //
  // What separates them is the FIRST cell. With outer pipes the line is unambiguously a table row
  // and nothing more is asked. Without them, the line is only a row if its first cell is a rule id,
  // and a rule id carries no whitespace — which every one of those twelve honest lines does, because
  // each is prose or a command with words before the first pipe.
  //
  // Residue, stated rather than hidden: a rule whose id contained whitespace, pasted without outer
  // pipes, would escape this. Every id the scaffold writes and every id in the shipped corpus is a
  // slug, and a manifest row as runward writes it always carries its outer pipes, so the residue
  // needs a hand-made illustration of a hand-made id. It is narrower than the hole it replaces, and
  // it is not zero.
  return t.startsWith("|") || /^\S+$/.test(cells[0]);
}

/** The on-disk spelling as a path the operator can paste back into the cell, or null when it cannot
 *  be expressed that way.
 *
 *  RWD-2026-0034. When `spellingViaRealpath` is the rung that answers, the spelling is derived from
 *  an ABSOLUTE canonical path. That rung exists for the case where the mission is ADDRESSED
 *  differently from how the filesystem spells it — Windows 8.3, where `dirname(missionDir)` carries
 *  `RUNNER~1` and the canonical path carries the long name — and in exactly that case the two are
 *  not prefixes of one another, so `relative()` returns a path climbing OUT of the mission. The gate
 *  then refused its own instruction: copying the prescribed spelling into the cell produced
 *  `resolves outside the project this mission audits (ADR-0019)`. The only remedy on offer was one
 *  the gate rejects, which is a dead end delivered with confidence.
 *
 *  A refusal whose remedy does not work is worse than a refusal that says it has none, so the caller
 *  says so instead of prescribing a path that fails. */
export function projectRelativeSpelling(spelling: string, ...roots: (string | null)[]): string | null {
  // A sentinel is not a path, whatever the caller believed when it got here.
  if (!isSpelling(spelling)) return null;
  // TWO roots, and the second is what makes this usable rather than merely honest. The spelling
  // comes from a CANONICAL path, and the mission root as the caller holds it may not be canonical:
  // on a Windows runner the mission sits under `RUNNER~1` while the canonical form carries the long
  // name, so `relative()` from the written root climbs out. Measured on the windows-latest leg of
  // 2026-08-26, where this fires on EVERY run of pointer-grammar.test.js. Canonicalising the root
  // restores the prefix `spellingViaRealpath` already checked, and the operator gets a path that
  // works. Only when neither root contains the spelling does the caller say it has no remedy — which
  // is still better than prescribing one that fails.
  // TWO QUESTIONS, and conflating them is what produced a remedy the gate rejects.
  //
  // First: is the spelling somewhere the gate would accept a pointer AT ALL? `resolvePointer` admits
  // evidence anywhere under `repoRootAbove(base)` — the npm/pnpm workspace allowance of
  // RWD-2026-0017 — as well as under the project root, so both are asked. Outside every one of them
  // there is genuinely no remedy, and the caller says so rather than inventing one.
  //
  // Second, and separately: WHICH string does the operator paste? A cell is resolved against
  // `resolutionBases`, whose first entry is the project root, so the remedy has to be expressed
  // against THAT root and nothing else. Measured 2026-08-26: expressing it against the root that
  // CONTAINS the file instead handed back `shared/triage.ts` for a workspace pointer, and the gate
  // answered `typed pointer does not resolve` when it was pasted — the same dead end as
  // RWD-2026-0034, one step milder and just as useless. The form that works is
  // `../shared/triage.ts`: a climbing path is legitimate exactly where the gate accepts evidence
  // outside the project root, which is why the old blanket refusal of `../` was wrong here.
  //
  // The expression base is CANONICALISED, which is also what covers the Windows 8.3 shape: there the
  // written root and the canonical root are one directory under two names, the written one is not an
  // ancestor of the canonical spelling, and relativising against it climbs out for no reason. One
  // rule serves all three shapes.
  const accepted = roots.flatMap((r) => (r ? [r, nativeRealpathOr(r)] : []));
  if (!accepted.length) return null;
  // Containment is asked of `relative()`, never of a string prefix. A prefix test compares
  // SEPARATORS, and this function is exported: measured on the windows-latest leg of 2026-08-26,
  // `"/w/repo/src/guard.ts".startsWith("/w/repo" + sep)` is false there because `sep` is a
  // backslash, so a path the gate would happily resolve was reported as having no remedy. The code
  // this replaced used `relative()` throughout and had no such sensitivity; swapping a path
  // computation for a text comparison is what introduced it.
  const under = (root: string): boolean => {
    const r = relative(root, spelling);
    return r === "" || (r !== ".." && !r.startsWith(`..${sep}`) && !isAbsolute(r));
  };
  if (!accepted.some(under)) return null;
  const rel = toPosix(relative(nativeRealpathOr(accepted[0]), spelling));
  if (!rel || rel === ".." || isAbsolute(rel)) return null;
  return rel;
}

/** The canonical path with 8.3 short names expanded, or the input when it cannot be resolved.
 *  `realpathSync` PLAIN does not expand them; only `.native` does, which is the same reason
 *  `spellingViaRealpath` uses it on both sides of its own comparison. */
function nativeRealpathOr(p: string): string {
  try { return realpathSync.native(p); } catch { return p; }
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
    // Every target the typed loop ADJUDICATED, accepted or refused. `evidencePathTokens` also
    // extracts the bare path out of `file:x.md#sym`, so without this the loop below re-judges a
    // target the typed loop already ruled on and the operator reads one defect as two.
    const adjudicated = new Set<string>();

    for (const p of pointers) {
      if (p.malformed) { out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — ${p.malformed}` }); continue; }
      if (p.kind === "adr") {
        const why = adrDecision(missionDir, `ADR-${p.adrId}`);
        if (why) out.push({ rule: row.rule, problem: `typed pointer adr:${p.adrId} — ${why}` });
        continue;
      }
      const r = p.path ? resolvePointer(p.path, bases) : { abs: null as string | null };
      const abs = r.abs;
      if (abs) adjudicated.add(abs);
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
      if ("spelling" in r && r.spelling === UNCHECKABLE) {
        out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the gate cannot list a directory on this path, so it cannot tell whether the spelling matches what is on disk. It resolves here; on a case-sensitive runner it may not. Fix the permissions, or cite a path the gate can read.` });
      } else if ("spelling" in r && isSpelling(r.spelling)) {
        const projectRoot = resolve(dirname(missionDir));
        const copyable = projectRelativeSpelling(r.spelling, projectRoot, repoRootAbove(projectRoot));
        out.push({ rule: row.rule, problem: copyable
          ? `typed pointer ${p.raw} — this filesystem is case-insensitive; on a case-sensitive one (Linux CI) it would not resolve. The file is spelled \`${copyable}\``
          : `typed pointer ${p.raw} — the spelling on disk differs from what is written, and this mission is reached under a name the filesystem does not hold, so the gate cannot express the correct spelling as a path relative to the project. The name on disk is \`${toPosix(basename(r.spelling))}\`. Check the case of every segment of this pointer.` });
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
      if (p.symbol !== undefined) {
        // ADR-0056: on a committed SARIF log, `#ruleId` resolves STRUCTURALLY — the scan knows the
        // rule and records no open finding — never by substring: the id is IN the JSON precisely
        // because there ARE findings, so the generic check would green the exact red case.
        if (isSarifReport(content)) {
          const s = sarifRuleResult(content, p.symbol);
          if (s === "unparseable") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the file looks like SARIF but is not valid JSON: the gate has no verdict on a log it cannot parse` });
          else if (s === "absent") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — no rule "${p.symbol}" in the committed scan: the log cannot vouch for what it never checked` });
          else if (s === "findings") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the committed scan records open finding(s) for rule "${p.symbol}" — a red scan is not evidence` });
        } else if (isEslintReport(content)) {
          const e = eslintFileResult(content, p.symbol);
          if (e === "unparseable") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the file looks like an ESLint report but is not valid JSON` });
          else if (e === "absent") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — no record for "${p.symbol}" in the committed lint report: it cannot vouch for a file it never linted` });
          else if (e === "findings") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the committed lint report records error-severity finding(s) for "${p.symbol}" — a file the linter refuses is not evidence` });
        } else if (isCycloneDxSbom(content)) {
          // The SBOM says what the delivery CONTAINS; a vulnerability verdict is the SARIF
          // adapter's job (and every SCA tool worth citing emits SARIF). Presence, nothing else.
          const b = sbomComponentPresent(content, p.symbol);
          if (b === "unparseable") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — the file looks like a CycloneDX SBOM but its components could not be read` });
          else if (b === "ambiguous") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — "${p.symbol}" names no version: cite an exact purl (pkg:npm/name@1.2.3) or name@version, or the pointer would pass whatever version the SBOM happens to carry` });
          else if (b === "absent") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — no component "${p.symbol}" in the committed SBOM` });
        } else if (isLcovReport(content) || isCoberturaReport(content)) {
          // ADR-0056: on a committed coverage report the `#` names a SOURCE FILE, not a symbol —
          // the report is about files. Presence + non-vacuity, never a threshold: a floor is a
          // policy and policy is the operator's CI.
          const l = isLcovReport(content) ? lcovFileResult(content, p.symbol) : coberturaFileResult(content, p.symbol);
          if (l === "absent") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — no record for "${p.symbol}" in the committed coverage report: it cannot vouch for a file it never measured` });
          else if (l === "uncovered") out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — "${p.symbol}" is measured but NOTHING executed it (0 covered lines) — a file no test exercises is not evidence the rule was applied in it` });
        } else if (!symbolPresent(content, p.symbol)) {
          out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — symbol "${p.symbol}" not found in the file (moved or renamed? update the pointer)` });
        }
      }
      if (p.kind === "test") {
        // Nothing verified that a `test:` target was a test. Measured 2026-08-26 on an UNSIGNED rule,
        // so nothing else could refuse it: `test:runward/framing.md::of` — a prose deliverable
        // declared as the test that proves a rule — returned exit 0. `check` is not a runtime and
        // says so; what it CAN say is that no test runner executes a document.
        //
        // Extension only, deliberately. A name convention (`*test*`, `*spec*`) would refuse Rust's
        // `#[cfg(test)]` blocks and Go table tests living in ordinary source files, which are real
        // tests in real projects. "Is this a test?" is not decidable from a path; the form that
        // actually proves a test RAN is `test:` at a committed JUnit report, handled just below.
        if (/\.(md|markdown|txt|rst|adoc|asciidoc)$/i.test(abs)) {
          out.push({ rule: row.rule, problem: `typed pointer ${p.raw} — a ${abs.split(".").pop()} document is not a test. Point at the test file, or at a committed JUnit report where the gate can read the case's result` });
          continue;
        }
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
      if (!abs || !isRegularFile(abs) || resolvedFiles.has(abs) || adjudicated.has(abs)) continue;
      // Circularity is a property of the TARGET, not of the pointer's spelling. This loop resolved
      // and banked the file without asking, so deleting five characters — `file:runward/rules/x.md`
      // to `runward/rules/x.md` — moved the same target out of the checked loop and into this one,
      // and the signature below then matched the rule's own text. Measured on 0.36.2 and on this
      // tree: the four states of one cell on a CRITICAL signed rule read prose→1, unrelated file→1,
      // typed self-pointer→1, bare self-path→0. That is ADR-0019's inverted incentive a second time
      // (RWD-2026-0020, "the gate punished precision"): the vague spelling was the one that passed.
      const selfRef = circularEvidence(abs, missionDir, deliverable);
      if (selfRef) { out.push({ rule: row.rule, problem: `evidence points at ${t} — ${selfRef}` }); continue; }
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
      // A conformance row DECLARES a fact; it never states one. Testing the signature against the
      // whole file let the declaration discharge itself: 7 of the 9 signed rules runward ships carry
      // a signature their own slug satisfies (3 of them CRITICAL — config-secrets-boundary,
      // security-code-execution-sandbox, security-mcp-server-pinning), so `file:<the manifest>#<any
      // word in its prose>` cleared the rule from column 1 of the very row making the claim.
      // Measured: the only line of floor.md matching /secret|vault/ was that row, and the gate
      // returned verdict `clean`, exit 0, 0 violations. The signature now reads the text OUTSIDE the
      // manifest — the same cut circularEvidence already makes one branch above, for the same reason.
      } else if (![...resolvedFiles.keys()].some((a) => re.test(textOutsideManifest(a)))) {
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
      if (/^\[.*\]$/.test(row.rule)) continue;
      // `adr:NNNN` from ANY row, not only `applied`. A deviation's evidence IS its ADR, and the
      // seal covered none of them: measured 2026-08-26, 0 of the 18 lock keys sat under adr/, so
      // replacing every ADR body with filler left `✓ seal intact` and exit 0. Of the three pointer
      // kinds this grammar announces, `adr:` was the only one whose target could never be frozen.
      for (const p of parseEvidencePointers(row.evidence)) {
        if (p.kind !== "adr" || !p.adrId) continue;
        const f = adrFilename(missionDir, `ADR-${p.adrId}`);
        if (!f) continue;
        const abs = join(missionDir, "adr", f);
        if (isRegularFile(abs)) files.set(toPosix(relative(realpathOr(resolve(root)), realpathOr(abs))), "");
      }
      if (row.status !== "applied") continue;
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
  /** `applied` rows whose Evidence cell is IDENTICAL to another row's, grouped by that cell.
   *  Counted, never gated (ADR-0004 intact): one artifact can legitimately evidence several rules —
   *  a threat model does cover more than one security rule. What it usually means, though, is a
   *  cell copied down a column while the rules underneath it differ, and the run said nothing.
   *  Naming it lets the operator confirm the reuse is deliberate; it never decides that for them. */
  duplicated: Array<{ evidence: string; rules: Array<{ deliverable: string; rule: string; status: string }> }>;
} {
  let rows = 0, applied = 0, deviated = 0, na = 0, typed = 0, signed = 0;
  const proseRows: Array<{ deliverable: string; rule: string }> = [];
  const byEvidence = new Map<string, Array<{ deliverable: string; rule: string; status: string }>>();
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
      // The cell census runs for EVERY status. It sat after the applied-only guard, so the one shape
      // where copying a cell down a column is FREE was the shape it could not see: measured
      // 2026-08-26, 36 rows of `| <slug> | deviated | ADR-0001 |` citing one unrelated ADR returned
      // exit 0 with `duplicated` empty, while the same cells under `applied` produced one entry.
      // A detector that exists to name "one cell recopied along a column" was blind to the two
      // columns where nobody has to justify anything.
      // Normalised on whitespace only: `file:a.ts` and `file:a.ts ` are the same citation, while
      // two genuinely different cells stay different. Never lowercased — a path's case is meaning.
      const cell = (row.evidence || "").replace(/\s+/g, " ").trim();
      if (cell) {
        const seen = byEvidence.get(cell) ?? [];
        seen.push({ deliverable: g.deliverable, rule: row.rule, status: row.status });
        byEvidence.set(cell, seen);
      }
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
  // Sorted for determinism: the same tree must render the same run, here as everywhere.
  const duplicated = [...byEvidence.entries()]
    .filter(([, rs]) => rs.length > 1)
    .map(([evidence, rules]) => ({ evidence, rules }))
    .sort((a, b) => a.evidence.localeCompare(b.evidence));
  return { rows, applied, deviated, na, typed, prose: proseRows.length, signed, proseRows, duplicated };
}
