// predicates.js: the one evaluator of the grid's conditions. Pure.
//
// A condition reads facts by path and compares them with a threshold the grid holds. A fact is a
// plain value, or {"$unobserved": reason}, or {"$error": message}; a path that resolves to nothing
// is not-observed ("absent from the record"), never false. Precedence inside "all": one observed
// failure makes it not-met (we know it fails); otherwise an error, then a missing observation, block.
import { ratioAtLeast } from "./canon.js";

export const STATES = ["met", "not-met", "na", "not-observed", "error"];

/** A fact's value, or the reason it has none. */
export function lookup(facts, path, catalogue) {
  if (!Object.prototype.hasOwnProperty.call(facts, path)) {
    const def = catalogue?.facts?.[path];
    if (def && def.mechanized === false) return { missing: "not-observed", reason: `not mechanized in runward-assess 0.1.0: ${def.procedure}` };
    return { missing: "not-observed", reason: `${path} is absent from the record` };
  }
  const v = facts[path];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if ("$unobserved" in v) return { missing: "not-observed", reason: String(v.$unobserved) };
    if ("$error" in v) return { missing: "error", reason: String(v.$error) };
  }
  return { value: v };
}

const isRatio = (v) => v && typeof v === "object" && Number.isInteger(v.n) && Number.isInteger(v.d);
const isEmpty = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

function compare(op, v, want) {
  switch (op) {
    case "eq": return v === want;
    case "ne": return v !== want;
    case "gte": return typeof v === "number" && v >= want;
    case "gt": return typeof v === "number" && v > want;
    case "lte": return typeof v === "number" && v <= want;
    case "lt": return typeof v === "number" && v < want;
    case "in": return Array.isArray(want) && want.includes(v);
    case "is_true": return v === true;
    case "is_false": return v === false;
    case "nonempty": return !isEmpty(v);
    case "empty": return isEmpty(v);
    case "ratio_gte": return isRatio(v) && ratioAtLeast(v, want[0], want[1]);
    default: throw new Error(`unknown operator ${op}`);
  }
}

/**
 * Evaluates one condition tree against a flat map of facts.
 * Returns { state, reasons: [text], read: [{ fact, value }] }.
 */
export function evaluate(cond, facts, catalogue) {
  const read = [];
  const reasons = [];
  const walk = (c) => {
    if (Array.isArray(c.all) || Array.isArray(c.any)) {
      const isAll = Array.isArray(c.all);
      const parts = (isAll ? c.all : c.any).map(walk);
      if (isAll) {
        if (parts.includes("not-met")) return "not-met";
        if (parts.includes("error")) return "error";
        if (parts.includes("not-observed")) return "not-observed";
        return "met";
      }
      if (parts.includes("met")) return "met";
      if (parts.includes("error")) return "error";
      if (parts.includes("not-observed")) return "not-observed";
      return "not-met";
    }
    if (c.not) {
      const s = walk(c.not);
      return s === "met" ? "not-met" : s === "not-met" ? "met" : s;
    }
    if (typeof c.fact !== "string") throw new Error("a condition reads a fact");
    const got = lookup(facts, c.fact, catalogue);
    if (got.missing) {
      reasons.push(`${c.fact}: ${got.reason}`);
      read.push({ fact: c.fact, value: null, missing: got.missing });
      return got.missing;
    }
    read.push({ fact: c.fact, value: got.value });
    // A ratio over nothing measures nothing: it neither meets nor fails a threshold.
    if (c.op === "ratio_gte" && isRatio(got.value) && got.value.d === 0) {
      reasons.push(`${c.fact}: empty denominator, nothing to measure`);
      return "not-observed";
    }
    const ok = compare(c.op, got.value, c.value);
    if (!ok) reasons.push(`${c.fact} ${describe(c)} is not met (read ${show(got.value)})`);
    return ok ? "met" : "not-met";
  };
  const state = walk(cond);
  return { state, reasons, read };
}

export function show(v) {
  if (v === null || v === undefined) return "nothing";
  if (isRatio(v)) return `${v.n}/${v.d}`;
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? "" : "s"}]`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function describe(c) {
  const v = c.value;
  switch (c.op) {
    case "eq": return `= ${show(v)}`;
    case "ne": return `!= ${show(v)}`;
    case "gte": return `>= ${show(v)}`;
    case "gt": return `> ${show(v)}`;
    case "lte": return `<= ${show(v)}`;
    case "lt": return `< ${show(v)}`;
    case "in": return `in ${JSON.stringify(v)}`;
    case "is_true": return "is true";
    case "is_false": return "is false";
    case "nonempty": return "is not empty";
    case "empty": return "is empty";
    case "ratio_gte": return `>= ${v[0]}/${v[1]}`;
    default: return c.op;
  }
}
