// canon.js: the one encoding every record, measure and manifest of runward-assess is written in.
//
// The rules are those of runward's witness (docs/spec/witness.md, section 3), restated here so this
// package depends on no runward code: one JSON text, UTF-8, no byte-order mark, keys sorted by UTF-16
// code units at every depth (RFC 8785 order), no insignificant whitespace, strings as JSON.stringify
// writes them, numbers as non-negative integers only, one final line feed. A ratio is a pair {n, d},
// never a fraction. Lists keep the order their producer fixed.
//
// Nothing here reads a clock, a locale or the environment: the only sort is the default code-unit
// comparison, never localeCompare, whose result depends on ICU and LC_ALL.
import { createHash } from "node:crypto";

/** Code-unit comparison, the only ordering used anywhere in this package. */
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The canonical value: refuses what the encoding cannot carry instead of rounding it silently. */
export function canonValue(v, where = "$") {
  if (v === null) return null;
  if (Array.isArray(v)) return v.map((x, i) => canonValue(x, `${where}[${i}]`));
  switch (typeof v) {
    case "string":
    case "boolean":
      return v;
    case "number":
      if (!Number.isSafeInteger(v) || v < 0) throw new Error(`canonical JSON carries non-negative integers only: ${where} = ${v}`);
      return v;
    case "object": {
      const out = {};
      for (const k of Object.keys(v).sort(cmp)) {
        if (v[k] === undefined) continue;
        out[k] = canonValue(v[k], `${where}.${k}`);
      }
      return out;
    }
    default:
      throw new Error(`canonical JSON cannot carry ${typeof v} at ${where}`);
  }
}

/** One canonical JSON text with its final line feed. */
export const canonJSON = (v) => JSON.stringify(canonValue(v)) + "\n";

/** True when `text` is exactly the canonical encoding of what it parses to. */
export function isCanonical(text) {
  try { return canonJSON(JSON.parse(text)) === text; } catch { return false; }
}

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** A ratio as the encoding carries it. */
export const ratio = (n, d) => ({ d, n });

/** n/d >= a/b, in integers only. A zero denominator is never "at least" anything. */
export const ratioAtLeast = (r, a, b) => r && r.d > 0 && r.n * b >= a * r.d;

/** A percentage for a human reading, rounded down, as a string: reports only, never a record. */
export function percentText(r) {
  if (!r || !r.d) return "n/a";
  const tenths = Math.floor((r.n * 1000) / r.d);
  return `${Math.floor(tenths / 10)}.${tenths % 10} %`;
}
