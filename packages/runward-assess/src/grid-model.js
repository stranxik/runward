// grid-model.js: the pure half of the grid: digests, the normative view of a criterion, the facts it
// reads, the part of a record it belongs to, and the structural checks. No file system, no clock: the
// score imports this module, and the score is a pure function (test/purity.test.js walks its imports).
//
// Two digests matter. The grid digest covers the whole parsed file (any change shows). A criterion's
// NORMATIVE digest covers only what can move a result (its axis, classes, applicability, conditions and
// thresholds), not its wording: a criterion whose normative digest changes without its rev being
// raised is refused by the lock check, so two results never compare under the same (id, rev) while
// meaning different things.
import { canonJSON, sha256, cmp } from "./canon.js";

export const TOOL = { name: "runward-assess", version: "0.1.0" };
export const digestOf = (value) => sha256(canonJSON(value));

/** Keys that word a criterion without deciding anything. */
const WORDING = new Set(["title", "text", "procedure", "positiveControl", "evidence", "naReason", "reason", "comparison", "note", "label", "source", "about", "windowRule", "referenceDate"]);
export function normative(value) {
  if (Array.isArray(value)) return value.map(normative);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort(cmp)) if (!WORDING.has(k)) out[k] = normative(value[k]);
    return out;
  }
  return value;
}
export const normativeDigest = (criterion) => digestOf(normative(criterion));

/** What a measure or a snapshot applies besides the criteria: the grid's tables and its data lists.
 *  Both record it; the score refuses inputs collected under other tables or lists. */
export const gridDataDigest = (grid, data) => digestOf({ data, tables: normative(grid.tables) });

/** Every fact path a condition tree reads. */
export function factsOf(cond, out = new Set()) {
  if (!cond || typeof cond !== "object") return out;
  if (Array.isArray(cond)) { for (const c of cond) factsOf(c, out); return out; }
  if (typeof cond.fact === "string") out.add(cond.fact);
  for (const k of ["all", "any"]) if (Array.isArray(cond[k])) for (const c of cond[k]) factsOf(c, out);
  if (cond.not) factsOf(cond.not, out);
  if (cond.when) factsOf(cond.when, out);
  if (cond.na) factsOf(cond.na, out);
  return out;
}

/** The facts a criterion reads anywhere: applicability, tiers, tier-level n/a, values. */
export function criterionFacts(c) {
  const s = new Set();
  factsOf(c.applies?.when, s);
  for (const t of Object.values(c.tiers ?? {})) { factsOf(t, s); if (t.na) factsOf(t.na.when, s); }
  for (const v of c.values ?? []) s.add(v);
  return [...s].sort(cmp);
}

/** Which part of a record a criterion belongs to: internal if it reads the commit alone. */
export function partOf(c, catalogue) {
  const external = criterionFacts(c).some((f) => f.startsWith("x.") || (f.startsWith("d.") && (catalogue.facts[f]?.derived ?? []).some((i) => i.startsWith("x."))));
  return external ? "external" : "internal";
}

/** Structural problems of a grid: an empty list is the only acceptable answer. */
export function gridProblems({ grid, catalogue, lock }) {
  const problems = [];
  const ids = new Set();
  const axes = new Set(grid.axes.map((a) => a.id));
  for (const c of grid.criteria) {
    if (!/^[A-Z]{3}-\d{2}$/.test(c.id)) problems.push(`${c.id}: an identifier is AXE-NN`);
    if (ids.has(c.id)) problems.push(`${c.id}: identifier used twice`);
    ids.add(c.id);
    if (!axes.has(c.axis) || !c.id.startsWith(c.axis + "-")) problems.push(`${c.id}: axis ${c.axis} is not its prefix or not declared`);
    if (!Number.isInteger(c.rev) || c.rev < 1) problems.push(`${c.id}: rev must be a positive integer`);
    if (!Array.isArray(c.applies?.profiles) || !c.applies.profiles.length) problems.push(`${c.id}: applies.profiles is empty`);
    if (c.applies?.when && !c.applies.naReason) problems.push(`${c.id}: a conditional applicability needs its naReason`);
    const tiers = Object.keys(c.tiers ?? {});
    if (!tiers.length && !c.indicator) problems.push(`${c.id}: no tier and not marked indicator`);
    if (tiers.length && c.indicator) problems.push(`${c.id}: an indicator has no tier`);
    for (const t of tiers) {
      if (!grid.tiers.includes(t)) problems.push(`${c.id}: unknown tier ${t}`);
      if (!c.tiers[t].all && !c.tiers[t].any) problems.push(`${c.id} ${t}: a tier is a condition`);
      if (c.tiers[t].na && !c.tiers[t].na.reason) problems.push(`${c.id} ${t}: a tier-level n/a needs its reason`);
    }
    const facts = criterionFacts(c);
    for (const f of facts) if (!catalogue.facts[f]) problems.push(`${c.id}: reads ${f}, which the fact catalogue does not define`);
    const readsX = facts.some((f) => f.startsWith("x.") || (catalogue.facts[f]?.derived ?? []).some((i) => i.startsWith("x.")));
    if (readsX !== c.class.includes("X")) problems.push(`${c.id}: class ${c.class.join(",")} ${c.class.includes("X") ? "declares" : "does not declare"} X but the criterion ${readsX ? "reads" : "does not read"} a snapshot fact`);
    const entry = lock.criteria?.[c.id];
    if (!entry) problems.push(`${c.id}: absent from grille-1.lock.json`);
    else {
      if (entry.rev !== c.rev) problems.push(`${c.id}: rev ${c.rev} in the grid, ${entry.rev} in the lock`);
      else if (entry.normative !== normativeDigest(c)) problems.push(`${c.id}: its normative content changed and its rev did not (raise rev, or open grille@2)`);
    }
  }
  for (const id of Object.keys(lock.criteria ?? {})) if (!ids.has(id) && !lock.criteria[id].retired_in) problems.push(`${id}: in the lock and not in the grid (a retired criterion keeps its id, marked retired_in)`);
  if (lock.tables !== digestOf(normative(grid.tables))) problems.push("tables: a shared table that can move a result changed (open grille@2, or correct the lock with the change it records)");
  for (const [path, f] of Object.entries(catalogue.facts)) {
    if (!/^[mxpd]\./.test(path)) problems.push(`${path}: a fact path starts with m., x., p. or d.`);
    if (path.startsWith("d.") && !Array.isArray(f.derived)) problems.push(`${path}: a derived fact names its inputs`);
    if ((path.startsWith("m.") || path.startsWith("x.")) && typeof f.mechanized !== "boolean") problems.push(`${path}: says whether it is mechanized`);
  }
  return problems;
}

/** The lock a grid would have: used once to write it, then only to compare. */
export function lockFor(grid) {
  return {
    format: "runward-assess-grid-lock/1",
    grid: grid.grid,
    criteria: Object.fromEntries(grid.criteria.map((c) => [c.id, { rev: c.rev, normative: normativeDigest(c) }])),
    tables: digestOf(normative(grid.tables)),
  };
}
