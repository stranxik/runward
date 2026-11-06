// ADR-0119 decision 2 and ADR-0120 decision 2 (R2): the cited lines of a row, read from the tree.
//
// A row that cites a code location and a test has, as part of its execution evidence at `attested`, the
// mutation of its cited lines: mutants of those lines only, its cited tests run against each. Which lines
// are cited is runward's to say, never the run's writer's: `runward-run` mutates the lines this module
// derives (published in `levels.execution.mutationTargets`), and the CLI re-derives them when it reads the
// run Statement, so a Statement that records other lines binds nothing for the row.
//
// A lexer, not a parser: it tells the code of a JavaScript or TypeScript file from its comments, its
// strings, its template literals and its regular-expression literals, which it blanks (same length, line
// breaks kept), so that a brace in a string never closes a block. Deterministic, no dependency, no
// execution (ADR-0054). `runward-run` has its own, for the same languages: the two packages share no code.

/** The languages `runward-run` mutates (ADR-0120 decision 2: JavaScript and TypeScript first), by
 *  extension. A row whose cited code is in another language reaches `attested` without the mutation fact,
 *  and every surface says so. `test/unit/run-mutation.test.js` holds this list equal to runward-run's. */
export const MUTATOR_LANGUAGES: Readonly<Record<string, string>> = Object.freeze({
  ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript", ".cts": "TypeScript",
});

/** A test file is the instrument, not the cited code: its lines are never mutated. */
export function isTestPath(rel: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);
}

export function extensionOf(rel: string): string {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

/**
 * The code of a JavaScript or TypeScript text with its comments, strings, template literals and regular
 * expressions replaced by spaces (line breaks kept): same length, every index where it was.
 */
export function codeOnly(text: string): string {
  const out = text.split("");
  const n = text.length;
  const blank = (from: number, to: number): void => { for (let k = from; k < to && k < n; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " "; };
  // The last significant code character before `i`, for the division/regular-expression question.
  const regexAllowed = (i: number): boolean => {
    let k = i - 1;
    while (k >= 0 && /\s/.test(out[k])) k--;
    if (k < 0) return true;
    const c = out[k];
    if (/[A-Za-z0-9_$]/.test(c)) {
      let s = k;
      while (s > 0 && /[A-Za-z0-9_$]/.test(out[s - 1])) s--;
      return REGEX_AFTER_WORD.has(out.slice(s, k + 1).join(""));
    }
    return !/[)\]}"'`.]/.test(c);
  };
  const skipString = (i: number, q: string): number => {
    let k = i + 1;
    while (k < n && text[k] !== q && text[k] !== "\n") k += text[k] === "\\" ? 2 : 1;
    return Math.min(n, k + 1);
  };
  // Returns the index just past the closing backtick; `${ … }` is code with its own nesting.
  const skipTemplate = (i: number): number => {
    let k = i + 1;
    while (k < n && text[k] !== "`") {
      if (text[k] === "\\") { k += 2; continue; }
      if (text[k] === "$" && text[k + 1] === "{") { k = scan(k + 2, true); continue; }
      k++;
    }
    return Math.min(n, k + 1);
  };
  // Scans code from `i`; with `untilBrace`, stops just past the `}` that closes a template expression.
  function scan(i: number, untilBrace: boolean): number {
    let depth = 0;
    let k = i;
    while (k < n) {
      const c = text[k];
      if (c === "/" && text[k + 1] === "/") { const e = text.indexOf("\n", k); const end = e === -1 ? n : e; blank(k, end); k = end; continue; }
      if (c === "/" && text[k + 1] === "*") { const e = text.indexOf("*/", k + 2); const end = e === -1 ? n : e + 2; blank(k, end); k = end; continue; }
      if (c === "'" || c === '"') { const end = skipString(k, c); blank(k, end); k = end; continue; }
      if (c === "`") { const end = skipTemplate(k); blank(k, end); k = end; continue; }
      if (c === "/" && regexAllowed(k)) {
        let e = k + 1, cls = false;
        while (e < n && text[e] !== "\n") {
          if (text[e] === "\\") { e += 2; continue; }
          if (text[e] === "[") cls = true; else if (text[e] === "]") cls = false; else if (text[e] === "/" && !cls) break;
          e++;
        }
        if (e < n && text[e] === "/") { e++; while (e < n && /[a-z]/.test(text[e])) e++; blank(k, e); k = e; continue; }
      }
      if (untilBrace) {
        if (c === "{") depth++;
        else if (c === "}") { if (depth === 0) return k + 1; depth--; }
      }
      k++;
    }
    return n;
  }
  scan(0, false);
  return out.join("");
}

const lineAt = (text: string, index: number): number => {
  let line = 1;
  for (let k = 0; k < index && k < text.length; k++) if (text[k] === "\n") line++;
  return line;
};

function matchBrace(code: string, open: number): number {
  let depth = 0;
  for (let k = open; k < code.length; k++) {
    if (code[k] === "{") depth++;
    else if (code[k] === "}") { depth--; if (depth === 0) return k; }
  }
  return code.length - 1;
}

function nextSignificant(code: string, from: number): number {
  let k = from;
  while (k < code.length && /\s/.test(code[k])) k++;
  return k;
}

/**
 * The lines a `#SYMBOL` names in a JavaScript or TypeScript file: from its declaration to the end of the
 * block or statement it opens. The declaration is the first `function`, `class`, `interface`, `type`,
 * `enum`, `const`, `let`, `var` or `namespace` that names it, else a member (`name(`, `name:`, `name =` at
 * the start of a line), else the first occurrence of the identifier, which is then a single line. Null
 * when the identifier does not occur in the code.
 */
export function symbolRange(text: string, symbol: string): { from: number; to: number } | null {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol)) return null;
  const code = codeOnly(text);
  const id = symbol.replace(/\$/g, "\\$");
  const decl = new RegExp(`(?<![\\w$])(?:function\\s*\\*?|class|interface|type|enum|const|let|var|namespace)\\s+${id}(?![\\w$])`).exec(code);
  const member = decl ? null : new RegExp(`^[ \\t]*(?:(?:export|default|public|private|protected|static|readonly|async|get|set|override|abstract|declare)\\s+)*\\*?${id}\\s*[(:=<!?]`, "m").exec(code);
  const any = decl || member ? null : new RegExp(`(?<![\\w$])${id}(?![\\w$])`).exec(code);
  const m = decl ?? member ?? any;
  if (!m) return null;
  const at = m.index + m[0].length - (member ? 1 : 0);
  const from = lineAt(text, m.index + (m[0].length - m[0].trimStart().length));
  if (any) return { from, to: from };
  let depth = 0;
  for (let k = at; k < code.length; k++) {
    const c = code[k];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ";") return { from, to: lineAt(text, k) };
    else if (depth === 0 && c === "{") {
      const close = matchBrace(code, k);
      const next = nextSignificant(code, close + 1);
      // A return-type literal is followed by the body, or by an arrow and then the body.
      if (code[next] === "{") { k = next - 1; continue; }
      if (code[next] === "=" && code[next + 1] === ">") { k = next + 1; continue; }
      return { from, to: lineAt(text, close) };
    }
  }
  return { from, to: from };
}

/** The cited lines of a `file:` pointer into a source file: its symbol's, its line, else the whole file. */
export function citedLines(text: string, pointer: { line?: number; symbol?: string }): { from: number; to: number } | null {
  if (pointer.symbol !== undefined) return symbolRange(text, pointer.symbol);
  const last = text.length === 0 ? 1 : lineAt(text, text.length - (text.endsWith("\n") ? 1 : 0));
  if (pointer.line !== undefined) return pointer.line >= 1 && pointer.line <= last ? { from: pointer.line, to: pointer.line } : null;
  return { from: 1, to: last };
}

// ── The targets, and the fact runward-run records for each ───────────────────────────────────────

export interface MutationLocation { file: string; from: number; to: number }
/** A row whose cited lines are mutated: its locations, and the JUnit cases it cites. */
/** A cited test: a case of a JUnit report, the report project-relative. */
export interface MutationTest { report: string; name: string }
export interface MutationTarget { deliverable: string; rule: string; locations: MutationLocation[]; tests: MutationTest[] }

export type MutationState =
  | "killed" | "killed-indistinct" | "no-mutant" | "no-mutator"
  | "not-killed" | "baseline-failed" | "mismatch" | "absent" | "unbound" | "unsigned";

/** A row's mutation fact as runward reads it (ADR-0119 decision 2). `met` says whether it lets the row
 *  reach `attested`; the survivors are listed, never summed into a score (ADR-0120). */
export interface RowMutation {
  state: MutationState;
  met: boolean;
  why: string;
  statement?: string;
  mutants?: number;
  killed?: { assertion: number; error: number; timeout: number; indistinct: number };
  survived?: Array<{ file: string; line: number; column: number; operator: string }>;
  languages?: string[];
}

const byLoc = (a: MutationLocation, b: MutationLocation): number => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.from - b.from || a.to - b.to);
const byTest = (a: MutationTest, b: MutationTest): number => (a.report < b.report ? -1 : a.report > b.report ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
/** A target in its canonical form: locations sorted and unique, tests sorted and unique. */
export function canonicalTarget(t: MutationTarget): MutationTarget {
  const seen = new Set<string>();
  const locations = [...t.locations].sort(byLoc).filter((l) => { const k = `${l.file}\u0000${l.from}\u0000${l.to}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const seenT = new Set<string>();
  const tests = [...t.tests].sort(byTest).filter((x) => { const k = `${x.report}\u0000${x.name}`; if (seenT.has(k)) return false; seenT.add(k); return true; });
  return { deliverable: t.deliverable, rule: t.rule, locations, tests };
}

function sameTarget(a: MutationTarget, b: unknown): boolean {
  const o = b as Partial<MutationTarget> | null;
  if (!o || !Array.isArray(o.locations) || !Array.isArray(o.tests)) return false;
  const x = canonicalTarget(a);
  const y = canonicalTarget({ deliverable: String(o.deliverable), rule: String(o.rule), locations: o.locations.map((l) => ({ file: String((l as MutationLocation).file), from: Number((l as MutationLocation).from), to: Number((l as MutationLocation).to) })), tests: o.tests.map((x) => ({ report: String((x as MutationTest)?.report), name: String((x as MutationTest)?.name) })) });
  return JSON.stringify(x.locations) === JSON.stringify(y.locations) && JSON.stringify(x.tests) === JSON.stringify(y.tests);
}

type CaseResult = "passed" | "assertion" | "error" | "failure" | "absent";
interface RecordedMutant { file: string; line: number; column: number; operator: string; timedOut?: boolean; cases?: Record<string, CaseResult> }

/**
 * The mutation fact of one row, read from the `mutation` member of a bound and signed run Statement's
 * predicate (docs/spec/runward-run.md §7). A mutant is killed through a failed assertion when one of the
 * row's cited cases failed on an assertion; through an error when one failed on another error, was absent
 * from the report (the file did not load) or the run timed out; a case that failed with no error class the
 * runner tells is a kill without the distinction. Where no failure of the row's mutants carries the
 * distinction, the row is held to « at least one mutant killed », and the reading says so.
 */
export function mutationOutcome(target: MutationTarget, fact: unknown, statement: string): RowMutation {
  const f = fact as { targets?: unknown[]; leg?: { junit?: unknown }; baseline?: { cases?: Record<string, CaseResult> }; mutants?: RecordedMutant[] } | null;
  const recorded = Array.isArray(f?.targets) ? f!.targets!.find((t) => (t as MutationTarget)?.deliverable === target.deliverable && (t as MutationTarget)?.rule === target.rule) : undefined;
  if (recorded === undefined) return { state: "absent", met: false, statement, why: `the run Statement ${statement} records no mutation of this row's cited lines` };
  if (!sameTarget(target, recorded)) return { state: "mismatch", met: false, statement, why: `the run Statement ${statement} records other cited lines or cited tests for this row than this tree implies` };
  // The mutation leg runs the cases of the one JUnit report its command writes; a row's other cited cases
  // (an eval report, another runner's) are not its to read.
  const junit = typeof f?.leg?.junit === "string" ? f.leg.junit : null;
  const tests = target.tests.filter((t) => t.report === junit).map((t) => t.name);
  if (tests.length === 0) return { state: "absent", met: false, statement, why: `the mutation leg of ${statement} runs the cases of ${junit ?? "no JUnit report"}, and this row cites none of them` };
  const baseline = f?.baseline?.cases ?? {};
  const failing = tests.filter((t) => baseline[t] !== "passed");
  if (failing.length) return { state: "baseline-failed", met: false, statement, why: `its cited tests do not all pass on the unmutated tree (${failing.slice(0, 2).map((t) => `"${t}": ${baseline[t] ?? "absent"}`).join("; ")}): no mutant can be told killed` };
  const inTarget = (m: RecordedMutant): boolean => target.locations.some((l) => m.file === l.file && m.line >= l.from && m.line <= l.to);
  const mutants = (Array.isArray(f?.mutants) ? f!.mutants! : []).filter((m) => m && typeof m.file === "string" && Number.isInteger(m.line) && inTarget(m));
  // ADR-0119 decision 2, read as written: a row whose cited lines hold no operator the mutator changes (a
  // port's interface, a type) has cited tests that kill no mutant of them, and is below `attested`. The two
  // exceptions the record names, a runner that cannot tell an assertion from an error and a language with
  // no mutator, are not this one: such a row cites the lines that implement what it claims.
  if (mutants.length === 0) {
    return { state: "no-mutant", met: false, statement, mutants: 0, why: "no mutant on its cited lines (the mutator changes no operator there: an interface, a type), so its cited tests kill none; cite the lines that implement it" };
  }
  const killed = { assertion: 0, error: 0, timeout: 0, indistinct: 0 };
  const survived: NonNullable<RowMutation["survived"]> = [];
  for (const m of mutants) {
    const results = tests.map((t) => m.cases?.[t] ?? "absent");
    if (results.includes("assertion")) killed.assertion++;
    else if (m.timedOut) killed.timeout++;
    else if (results.includes("error") || results.includes("absent")) killed.error++;
    else if (results.includes("failure")) killed.indistinct++;
    else survived.push({ file: m.file, line: m.line, column: m.column, operator: m.operator });
  }
  const base = { statement, mutants: mutants.length, killed, survived };
  const tally = `${mutants.length} mutant(s): ${killed.assertion} killed through a failed assertion, ${killed.error} through an error, ${killed.timeout} by a timeout${killed.indistinct ? `, ${killed.indistinct} without the distinction` : ""}, ${survived.length} survived`;
  if (killed.assertion > 0) return { state: "killed", met: true, ...base, why: tally };
  if (killed.indistinct > 0 && killed.error === 0) {
    return { state: "killed-indistinct", met: true, ...base, why: `${tally}; the runner did not tell a failed assertion from an error, so the row is held to « at least one mutant of its cited lines killed »` };
  }
  return { state: "not-killed", met: false, ...base, why: `its cited tests kill no mutant of its cited lines through a failed assertion (${tally})` };
}
