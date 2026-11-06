// The mutator (ADR-0120 decision 2), behind a port: for a language it serves, the mutants of a range of
// lines of a source text, in source order, each one change of one operator. The first, and in this
// version the only one, serves JavaScript and TypeScript, the shipped example's languages. A language with
// no mutator yields no mutant and no fact: runward says so on the row, never a guess.
//
// A lexer, not a parser: it tells code from comments, strings, template literals and regular-expression
// literals, and only code is changed. Each operator is one Stryker names (equality, relational boundary,
// logical, arithmetic, boolean literal, negation, conditional expression, block statement), applied where
// the text says it
// is that operator; a block that follows `)`, `=>`, a return type, `else`, `try`, `finally` or `do` is
// emptied; a string or template literal is emptied, except a module specifier, a directive and an object
// key; a relational operator only between spaces (`Array<string>` is a TypeScript generic,
// not a comparison), an arithmetic operator only after an operand (`-1` is a sign), `!` only before one
// (`value!` is TypeScript's non-null assertion). Deterministic, no dependency, nothing executed here.

/** The mutator's name, recorded in the run Statement; a change of its operators is a new name. */
export const MUTATOR = "runward-run/js-ts/1";
/** The languages it serves, by extension: runward holds its own list equal to this one
 *  (src/lib/mutation-targets.ts, MUTATOR_LANGUAGES; test/unit/run-mutation.test.js). */
export const LANGUAGES = Object.freeze({
  ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript", ".cts": "TypeScript",
});

export function languageOf(path) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? null : LANGUAGES[name.slice(dot).toLowerCase()] ?? null;
}

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const WORD = /[A-Za-z0-9_$]/;

/** One flag per character of `text`: 1 where it is code, 0 in a comment, a string, a template literal
 *  (its `${…}` included) or a regular-expression literal. */
export function codeMask(text) {
  return lex(text).mask;
}

/** The lexer: the code mask, and the spans of the string and template literals outside any template. */
function lex(text) {
  const n = text.length;
  const mask = new Uint8Array(n).fill(1);
  const off = (a, b) => { for (let k = a; k < b && k < n; k++) mask[k] = 0; };
  const regexAllowed = (i) => {
    let k = i - 1;
    while (k >= 0 && (/\s/.test(text[k]) || mask[k] === 0)) { if (mask[k] === 0 && !/\s/.test(text[k])) return false; k--; }
    if (k < 0) return true;
    const c = text[k];
    if (WORD.test(c)) {
      let s = k;
      while (s > 0 && WORD.test(text[s - 1])) s--;
      return REGEX_AFTER_WORD.has(text.slice(s, k + 1));
    }
    return !/[)\]}.]/.test(c);
  };
  const skipString = (i, q) => {
    let k = i + 1;
    while (k < n && text[k] !== q && text[k] !== "\n") k += text[k] === "\\" ? 2 : 1;
    return Math.min(n, k + 1);
  };
  const skipTemplate = (i) => {
    let k = i + 1;
    while (k < n && text[k] !== "`") {
      if (text[k] === "\\") { k += 2; continue; }
      if (text[k] === "$" && text[k + 1] === "{") { k = scan(k + 2, true); continue; }
      k++;
    }
    return Math.min(n, k + 1);
  };
  function scan(i, untilBrace) {
    let depth = 0;
    let k = i;
    while (k < n) {
      const c = text[k];
      if (c === "/" && text[k + 1] === "/") { const e = text.indexOf("\n", k); const end = e === -1 ? n : e; off(k, end); k = end; continue; }
      if (c === "/" && text[k + 1] === "*") { const e = text.indexOf("*/", k + 2); const end = e === -1 ? n : e + 2; off(k, end); k = end; continue; }
      if (c === "'" || c === "\"") { const end = skipString(k, c); off(k, end); if (!untilBrace) spans.push({ start: k, end }); k = end; continue; }
      if (c === "`") { const end = skipTemplate(k); off(k, end); if (!untilBrace) spans.push({ start: k, end }); k = end; continue; }
      if (c === "/" && regexAllowed(k)) {
        let e = k + 1, cls = false;
        while (e < n && text[e] !== "\n") {
          if (text[e] === "\\") { e += 2; continue; }
          if (text[e] === "[") cls = true; else if (text[e] === "]") cls = false; else if (text[e] === "/" && !cls) break;
          e++;
        }
        if (e < n && text[e] === "/") { e++; while (e < n && /[a-z]/.test(text[e])) e++; off(k, e); k = e; continue; }
      }
      if (untilBrace) {
        if (c === "{") depth++;
        else if (c === "}") { if (depth === 0) return k + 1; depth--; }
      }
      k++;
    }
    return n;
  }
  const spans = [];
  scan(0, false);
  return { mask, spans };
}

// Punctuation, longest first, so `===` is never read as `==` then `=`.
const PUNCT = [">>>=", "===", "!==", "**=", "<<=", ">>=", ">>>", "...", "&&=", "||=", "??=",
  "==", "!=", "<=", ">=", "&&", "||", "??", "=>", "++", "--", "+=", "-=", "*=", "/=", "%=", "**", "<<", ">>", "?.",
  "<", ">", "+", "-", "*", "/", "%", "!", "=", "&", "|", "^", "~", "?", ":", "(", ")", "[", "]", "{", "}", ";", ",", "."];
const SWAP = {
  "===": ["equality", "!=="], "!==": ["equality", "==="], "==": ["equality", "!="], "!=": ["equality", "=="],
  "<": ["relational", ">="], "<=": ["relational", ">"], ">": ["relational", "<="], ">=": ["relational", "<"],
  "&&": ["logical", "||"], "||": ["logical", "&&"], "??": ["logical", "&&"],
  "+": ["arithmetic", "-"], "-": ["arithmetic", "+"], "*": ["arithmetic", "/"], "/": ["arithmetic", "*"],
};

/**
 * The mutants of `text` whose change starts on a line in [from, to], in source order: each
 * `{ line, column, kind, original, replacement, start, end }`, `start`/`end` the character range replaced.
 */
export function mutantsOf(text, from, to) {
  const { mask, spans } = lex(text);
  const n = text.length;
  const lineStarts = [0];
  for (let k = 0; k < n; k++) if (text[k] === "\n") lineStarts.push(k + 1);
  const lineOf = (i) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= i) lo = mid; else hi = mid - 1; } return lo + 1; };
  const out = [];
  const add = (start, end, kind, replacement) => {
    const line = lineOf(start);
    if (line < from || line > to) return;
    out.push({ line, column: start - lineStarts[line - 1] + 1, kind, original: text.slice(start, end), replacement, start, end });
  };
  // The previous significant code character, and whether it ends an operand.
  const prevSig = (i) => { let k = i - 1; while (k >= 0 && /\s/.test(text[k])) k--; return k; };
  const endsOperand = (k) => k >= 0 && (WORD.test(text[k]) || text[k] === ")" || text[k] === "]" || (mask[k] === 0 && /["'`/]/.test(text[k])));
  const nextSig = (i) => { let k = i; while (k < n && /\s/.test(text[k])) k++; return k; };
  const matchParen = (open) => {
    let depth = 0;
    for (let k = open; k < n; k++) {
      if (!mask[k]) continue;
      if (text[k] === "(") depth++;
      else if (text[k] === ")") { depth--; if (depth === 0) return k; }
    }
    return -1;
  };
  // String and template literals: emptied, but never a module specifier (the string after `from`, or the
  // one a dynamic import or a require is called with), a directive (`"use strict"`) or an object key.
  const literal = new Map();
  for (const s of spans) {
    const body = text.slice(s.start + 1, s.end - 1);
    if (s.end - s.start < 3 || text[s.end - 1] !== text[s.start]) continue;
    const before = text.slice(Math.max(0, s.start - 40), s.start);
    if (/(?:\bfrom|\bimport|\brequire\s*\(|\bimport\s*\()\s*$/.test(before) || /^use (?:strict|client|server)$/.test(body)) continue;
    const p = prevSig(s.start), q = nextSig(s.end);
    if ((p < 0 || text[p] === "{" || text[p] === ",") && text[q] === ":") continue;
    literal.set(s.start, s);
  }
  const end0 = (k) => k + 1;
  let i = 0;
  while (i < n) {
    if (literal.has(i)) { const s = literal.get(i); add(s.start, s.end, "string", text[s.start].repeat(2)); i = s.end; continue; }
    if (!mask[i] || /\s/.test(text[i])) { i++; continue; }
    if (WORD.test(text[i])) {
      let e = i;
      while (e < n && WORD.test(text[e]) && mask[e]) e++;
      const word = text.slice(i, e);
      const before = i > 0 ? text[i - 1] : "";
      if (before !== "." && before !== "$") {
        if (word === "true") add(i, e, "boolean", "false");
        else if (word === "false") add(i, e, "boolean", "true");
        else if (word === "if") {
          const open = nextSig(e);
          if (text[open] === "(" && mask[open]) {
            const close = matchParen(open);
            const cond = close === -1 ? "" : text.slice(open + 1, close).trim();
            if (close !== -1 && cond !== "true" && cond !== "false" && cond.length > 0) {
              const line = lineOf(i);
              if (line >= from && line <= to) {
                out.push({ line, column: open + 2 - lineStarts[lineOf(open + 1) - 1], kind: "conditional", original: text.slice(open + 1, close), replacement: "true", start: open + 1, end: close });
                out.push({ line, column: open + 2 - lineStarts[lineOf(open + 1) - 1], kind: "conditional", original: text.slice(open + 1, close), replacement: "false", start: open + 1, end: close });
              }
            }
          }
        }
      }
      i = e;
      continue;
    }
    const op = PUNCT.find((p) => text.startsWith(p, i) && [...p].every((_, k) => mask[i + k]));
    if (!op) { i++; continue; }
    if (op === "{") {
      // A block statement (a function's or a branch's body), emptied: what it does is what its tests check.
      const p = prevSig(i);
      let word = "";
      if (p >= 0 && WORD.test(text[p])) { let s = p; while (s > 0 && WORD.test(text[s - 1])) s--; word = text.slice(s, p + 1); }
      if (p >= 0 && (text[p] === ")" || text[p] === ">" || ["else", "try", "finally", "do"].includes(word))) {
        let depth = 0, close = -1;
        for (let k = i; k < n; k++) { if (!mask[k]) continue; if (text[k] === "{") depth++; else if (text[k] === "}" && --depth === 0) { close = k; break; } }
        if (close !== -1 && text.slice(i + 1, close).split("").some((ch, k) => mask[i + 1 + k] && !/\s/.test(ch))) add(i, close + 1, "block", "{}");
      }
      i = end0(i);
      continue;
    }
    const end = i + op.length;
    const swap = SWAP[op];
    if (swap) {
      const [kind, replacement] = swap;
      if (kind === "relational") {
        // Between spaces only: `a < b` compares, `Array<string>` and `<div>` do not.
        if (/\s/.test(text[i - 1] ?? "") && /\s/.test(text[end] ?? "")) add(i, end, kind, replacement);
      } else if (kind === "arithmetic") {
        if (endsOperand(prevSig(i))) add(i, end, kind, replacement);
      } else add(i, end, kind, replacement);
    } else if (op === "!") {
      // A negation precedes its operand; `value!` (TypeScript's non-null assertion) follows one.
      const p = prevSig(i);
      if (!endsOperand(p)) add(i, end, "negation", "");
    }
    i = end;
  }
  return out;
}

/** The text with one mutant applied. */
export function applyMutant(text, m) {
  return text.slice(0, m.start) + m.replacement + text.slice(m.end);
}
