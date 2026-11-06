// Every criterion of grille@1 has a held and a not-held fixture, and the score reads each as said.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { score } from "../src/score.js";
import { bundle, inputs, stateOf, PKG, G } from "./helpers.js";

const FX = JSON.parse(readFileSync(join(PKG, "test", "fixtures", "criteria.json"), "utf8")).criteria;
const TOP = (c) => ["P3", "P2", "P1"].find((t) => c.tiers[t]) ?? null;

test("every criterion of the version has a held and a not-held fixture, and nothing else has one", () => {
  const ids = G.grid.criteria.map((c) => c.id);
  assert.equal(ids.length, 35, "grille@1 has 35 criteria");
  for (const id of ids) {
    assert.ok(FX[id], `${id} has no fixture`);
    assert.ok(FX[id].held && FX[id].notHeld, `${id} needs both a held and a not-held fixture`);
  }
  for (const id of Object.keys(FX)) assert.ok(ids.includes(id), `a fixture for ${id}, which grille@1 does not define`);
});

for (const c of G.grid.criteria) {
  test(`${c.id} r${c.rev}: held reads ${FX[c.id]?.expect?.held ?? "met"}, not held reads ${FX[c.id]?.expect?.notHeld ?? "not-met"}`, () => {
    const fx = FX[c.id];
    const want = { held: fx.expect?.held ?? "met", notHeld: fx.expect?.notHeld ?? "not-met" };
    const held = score({ ...bundle, ...inputs({ profiles: fx.profile?.profiles, prof: fx.profile?.facts, facts: fx.held }) });
    const h = stateOf(held, c.id);
    assert.equal(h.state, want.held, `${c.id} held: ${JSON.stringify(h.tiers)}`);
    if (want.held === "met") assert.equal(h.reached, TOP(c), `${c.id} held reaches its top tier`);
    if (want.held === "indicator") for (const [k, v] of Object.entries(h.values)) assert.ok("value" in v, `${c.id} held: ${k} observed`);
    const nh = fx.notHeldProfile ?? fx.profile;
    const notHeld = score({ ...bundle, ...inputs({ profiles: nh?.profiles, prof: nh?.facts, facts: fx.notHeld, snapshot: fx.notHeldValues !== "not-observed" }) });
    const n = stateOf(notHeld, c.id);
    assert.equal(n.state, want.notHeld, `${c.id} not held: ${JSON.stringify(n.tiers)}`);
    if (want.notHeld === "not-met") {
      const lowest = ["P1", "P2", "P3"].find((t) => c.tiers[t]);
      assert.equal(n.tiers[lowest].state, "not-met", `${c.id} not held fails its lowest tier ${lowest}`);
    }
    if (fx.notHeldValues === "not-observed") for (const [k, v] of Object.entries(n.values)) assert.ok("notObserved" in v, `${c.id} not held: ${k} not observed`);
  });
}

test("a tier-level n/a is decided by a fact, and only that tier is skipped (SEC-03 P3)", () => {
  const facts = { ...FX["SEC-03"].held, "x.sec03.advisories_published": 0, "x.sec03.advisories_not_visible": 0, "x.sec03.affected_not_deprecated": 0 };
  const r = stateOf(score({ ...bundle, ...inputs({ facts }) }), "SEC-03");
  assert.equal(r.tiers.P3.state, "na");
  assert.equal(r.state, "met");
  assert.equal(r.reached, "P2", "the reached tier is the highest met one, never an n/a one");
  // positive control: one advisory published and not visible, P3 is read and fails
  const r2 = stateOf(score({ ...bundle, ...inputs({ facts: { ...facts, "x.sec03.advisories_published": 1, "x.sec03.advisories_not_visible": 1 } }) }), "SEC-03");
  assert.equal(r2.tiers.P3.state, "not-met");
});

test("a fact absent from the inputs is not-observed, never false; a fact the version does not collect says so", () => {
  const r = score({ ...bundle, ...inputs({ facts: {} }) });
  const f = stateOf(r, "FIA-01");
  assert.equal(f.state, "not-observed");
  assert.match(f.tiers.P1.why.join(" "), /not mechanized in runward-assess 0\.1\.0/);
  const g = stateOf(r, "GOU-04");
  assert.equal(g.state, "not-observed");
  assert.match(g.tiers.P2.why.join(" "), /absent from the record/);
  // positive control: the same criterion with its facts is decided
  const g2 = stateOf(score({ ...bundle, ...inputs({ facts: FX["GOU-04"].notHeld }) }), "GOU-04");
  assert.equal(g2.state, "not-met");
});
