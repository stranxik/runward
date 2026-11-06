// The saboteur corpus (test/saboteur-corpus.js), run as regression tests.
//
// Each case is a sabotage of the shipped example measured on 2026-11-05 and 2026-11-06 (ADR-0117,
// ADR-0124); each test asserts the exit codes of `check --strict` measured after ADR-0124, with no seal
// (N), sealed before the sabotage (S) and, where an execution is what refuses the case, with the
// example's hook (H). Two sabotages are pinned green without a seal, b4 and g6, each with the limit
// ADR-0124 writes, quoted here and checked against the record so the citation cannot drift: the day a
// change closes one of them, its test turns red, and the change updates the expectation and the
// record together.
//
// The H mode runs the example's hook, which installs the example's dependencies with npm and
// regenerates its reports. The control's green under H is asserted first, in the same test: a refusal of
// b4 under H then cannot be an environment that could not install.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cases, prepare, runCase, cleanup } from "../saboteur-corpus.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEDGER = JSON.parse(readFileSync(join(ROOT, "test/fixtures/saboteur-corpus-ids.json"), "utf8"));
const ID = /^SC-\d{3}$/;
const flat = (s) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const ADR_0124 = flat(readFileSync(join(ROOT, "docs/adr", readdirSync(join(ROOT, "docs/adr")).find((f) => f.startsWith("ADR-0124-"))), "utf8"));

const prepared = prepare();
test.after(() => cleanup(prepared));

const explain = (c, mode, r) => `${c.id} ${c.name}, ${mode}: expected exit ${c.expect[mode]}, got ${r.code}\n  ${r.gateSaid.join("\n  ")}\n  why it matters: ${c.why}`;

test("every case carries a stable identifier the ledger pins to its name, and the ledger names no other", () => {
  const seen = new Map();
  for (const c of cases) {
    assert.match(c.id, ID, `case "${c.name}"`);
    assert.ok(!seen.has(c.id), `${c.id} is declared by "${seen.get(c.id)}" and by "${c.name}"`);
    seen.set(c.id, c.name);
    assert.ok(!(c.id in LEDGER.retired), `${c.id} is retired and may not be given again`);
    assert.equal(LEDGER.assigned[c.id], c.name, `${c.id}: the ledger pins another name, a renumbering or an unrecorded rename`);
  }
  for (const id of Object.keys(LEDGER.assigned)) assert.ok(seen.has(id), `${id} is in the ledger and in no case: retire it, never reuse it`);
});

test("the two pinned limits are the ones ADR-0124 writes, quoted as the record says them", () => {
  const pinned = cases.filter((c) => c.limit);
  assert.deepEqual(pinned.map((c) => c.id), ["SC-018", "SC-021"], "b4 and g6, and no other case, are pinned green without a seal");
  for (const c of pinned) {
    assert.equal(c.expect.N, 0, `${c.id} is pinned green without a seal`);
    assert.ok(c.expect.S === 1, `${c.id} is refused under a seal`);
    const quote = c.limit.match(/«\s*([^»]+?)\s*»/)?.[1];
    assert.ok(quote, `${c.id} quotes the limit`);
    assert.ok(ADR_0124.includes(flat(quote)), `${c.id}: ADR-0124 no longer says « ${quote} »`);
  }
});

for (const c of cases) {
  const modes = Object.keys(c.expect).filter((m) => m !== "H");
  test(`${c.id} ${c.name}: ${modes.map((m) => `${m} exits ${c.expect[m]}`).join(", ")}`, () => {
    for (const mode of modes) {
      const r = runCase(c, mode, prepared);
      assert.equal(r.code, c.expect[mode], explain(c, mode, r));
    }
  });
}

test("with the example's hook: the control crosses, and b4, which no reading of the tree refuses, does not", () => {
  const withHooks = cases.filter((c) => "H" in c.expect);
  assert.deepEqual(withHooks.map((c) => c.id), ["SC-001", "SC-018"]);
  for (const c of withHooks) {
    const r = runCase(c, "H", prepared);
    assert.equal(r.code, c.expect.H, explain(c, "H", r));
    if (c.expect.H !== 0) assert.ok(r.gateSaid.some((l) => /hook \(before\) failed/.test(l)), `${c.id}: refused by its hook, not by another check`);
  }
});
