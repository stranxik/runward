// The attack corpus identifiers are stable (ADR-0087). A third party who re-runs
// `node test/audit-corpus.js --json` against two versions compares results case by case, by
// identifier; an identifier derived from position, or renumbered when a case is added or removed,
// would make that comparison silently pair different cases. So each case declares its identifier,
// and `test/fixtures/audit-corpus-ids.json` is the append-only ledger that pins each identifier to
// its case name and keeps the retired ones out of reach.
//
// Importing the corpus only declares its cases (it runs them when invoked directly), so this file
// reads the real case list, not a copy of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cases } from "../audit-corpus.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEDGER = JSON.parse(readFileSync(join(ROOT, "test/fixtures/audit-corpus-ids.json"), "utf8"));
const ID = /^AC-\d{3}$/;

/** Every way the case list and the ledger disagree, as sentences. Empty means they agree. */
function idProblems(list, ledger) {
  const out = [];
  const assigned = ledger.assigned ?? {};
  const retired = ledger.retired ?? {};
  const seen = new Map();
  for (const c of list) {
    if (typeof c.id !== "string" || !ID.test(c.id)) { out.push(`case "${c.name}" has no identifier of the form AC-NNN (got ${JSON.stringify(c.id)})`); continue; }
    if (seen.has(c.id)) out.push(`${c.id} is declared by two cases: "${seen.get(c.id)}" and "${c.name}"`);
    seen.set(c.id, c.name);
    if (c.id in retired) out.push(`${c.id} is retired (${retired[c.id].reason ?? "no reason recorded"}) and may not be given to "${c.name}"`);
    else if (!(c.id in assigned)) out.push(`${c.id} ("${c.name}") is not in the ledger: append it to test/fixtures/audit-corpus-ids.json`);
    else if (assigned[c.id] !== c.name) out.push(`${c.id} is pinned to "${assigned[c.id]}" in the ledger but names "${c.name}" in the corpus: a renumbering, or a rename the ledger did not record`);
  }
  for (const id of Object.keys(assigned)) {
    if (id in retired) out.push(`${id} is both assigned and retired in the ledger`);
    else if (!seen.has(id)) out.push(`${id} ("${assigned[id]}") is in the ledger and in no case: move it to "retired" with a date and a reason, never reuse it`);
  }
  for (const [id, r] of Object.entries(retired)) {
    if (!ID.test(id)) out.push(`retired identifier ${id} is not of the form AC-NNN`);
    if (!r || !r.retired || !r.reason) out.push(`${id} is retired without a date ("retired") and a reason ("reason")`);
  }
  const nums = [...Object.keys(assigned), ...Object.keys(retired)].filter((id) => ID.test(id)).map((id) => Number(id.slice(3))).sort((a, b) => a - b);
  for (let n = 1; n <= (nums.at(-1) ?? 0); n++)
    if (!nums.includes(n)) out.push(`AC-${String(n).padStart(3, "0")} is missing from the ledger: numbers are given in order and a removed case is retired, not deleted`);
  return out;
}

test("every attack corpus case declares a stable identifier, and the ledger agrees with the corpus", () => {
  assert.ok(cases.length >= 16, `the corpus declares ${cases.length} cases`);
  assert.deepEqual(idProblems(cases, LEDGER), []);
});

test("every case names its direction and where it came from", () => {
  const bad = cases.filter((c) => !["REFUSE", "ACCEPT"].includes(c.want) || !Array.isArray(c.origin) || c.origin.length === 0
    || c.origin.some((o) => !/^(ADR-\d{4}|RWD-\d{4}-\d{4})$/.test(o)));
  assert.deepEqual(bad.map((c) => c.id), []);
});

test("positive control: a missing, duplicate, renumbered, reused or dropped identifier each redden the check", () => {
  const base = cases.map(({ id, name }) => ({ id, name }));
  const [a, b] = base;
  const retiredLedger = (id) => ({ assigned: Object.fromEntries(Object.entries(LEDGER.assigned).filter(([k]) => k !== id)),
                                   retired: { [id]: { retired: "2026-10-01", reason: "planted" } } });
  const variants = {
    missing: [{ ...a, id: undefined }, ...base.slice(1)],
    duplicate: [a, { ...b, id: a.id }, ...base.slice(2)],
    "positional renumbering": [{ ...a, id: b.id }, { ...b, id: a.id }, ...base.slice(2)],
    "case dropped and its number left assigned": base.slice(1),
  };
  for (const [what, list] of Object.entries(variants))
    assert.ok(idProblems(list, LEDGER).length > 0, `${what} was not caught`);
  // A retired number given to a new case.
  assert.ok(idProblems(base, retiredLedger(a.id)).length > 0, "a reused retired identifier was not caught");
  // A ledger entry deleted instead of retired leaves a hole.
  const holed = { assigned: Object.fromEntries(Object.entries(LEDGER.assigned).filter(([k]) => k !== a.id)), retired: {} };
  assert.ok(idProblems(base.slice(1), holed).some((s) => /missing from the ledger/.test(s)), "a deleted ledger line was not caught");
  // Sensitivity in the other direction: the case removed AND its number retired properly is clean.
  assert.deepEqual(idProblems(base.slice(1), retiredLedger(a.id)), []);
});

test("the register's sentence about the corpus gives the counts the corpus holds", () => {
  // known-defects.md describes the corpus with a count a reader can falsify in one run. It read 14
  // cases, 10 refusals, while the corpus held 16 and 12; the figure is now compared, not trusted.
  const register = readFileSync(join(ROOT, "docs/compliance/known-defects.md"), "utf8");
  const m = register.match(/`node test\/audit-corpus\.js`, (\d+) cases, (\d+) refusals and (\d+) acceptances/);
  assert.ok(m, "the sentence describing the corpus in known-defects.md is missing");
  const refuse = cases.filter((c) => c.want === "REFUSE").length;
  assert.deepEqual([Number(m[1]), Number(m[2]), Number(m[3])], [cases.length, refuse, cases.length - refuse]);
});
