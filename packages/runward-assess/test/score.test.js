// The score: coverage, the two parts, concordance, aggregation, the annex, regressions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { score, coverage, CoverageError, InputError, isoSeconds } from "../src/score.js";
import { canonJSON, isCanonical } from "../src/canon.js";
import { bundle, inputs, stateOf, PKG, G } from "./helpers.js";

const FX = JSON.parse(readFileSync(join(PKG, "test", "fixtures", "criteria.json"), "utf8")).criteria;
const allHeld = () => Object.fromEntries(Object.entries(FX).flatMap(([, f]) => Object.entries(f.held)));

test("coverage refuses a record that lacks a criterion of the version, carries a foreign one, or one twice", () => {
  const r = score({ ...bundle, ...inputs({ facts: allHeld(), prof: { build_cmd: "npm run build", gate_declare: "x", docs_conformite: ["d.json"], perimetre_mutation: "s.json", publie_paquet: "p" } }) });
  const results = [...r.internal.criteria, ...r.external.criteria];
  assert.equal(results.length, 35);
  assert.equal(coverage(G.grid, results), true, "the full set passes");
  assert.throws(() => coverage(G.grid, results.slice(1)), CoverageError, "one criterion dropped is refused");
  assert.throws(() => coverage(G.grid, [...results, { ...results[0], id: "ZZZ-99" }]), CoverageError, "a foreign criterion is refused");
  assert.throws(() => coverage(G.grid, [...results, results[0]]), CoverageError, "a criterion twice is refused");
  assert.throws(() => coverage(G.grid, results.map((x, i) => (i === 0 ? { ...x, state: undefined } : x))), CoverageError, "a criterion without a state is refused");
});

test("the score refuses to emit when a criterion reads a fact its version does not define", () => {
  const catalogue = JSON.parse(JSON.stringify(G.catalogue));
  delete catalogue.facts["m.gou04.absence_factor"];
  assert.throws(() => score({ ...bundle, catalogue, ...inputs({}) }), CoverageError);
  // positive control: the intact catalogue emits
  assert.ok(score({ ...bundle, ...inputs({}) }).digest);
});

test("an input fact the catalogue does not define is refused (an input from another version)", () => {
  assert.throws(() => score({ ...bundle, ...inputs({ facts: { "m.gou99.unknown": 1 } }) }), InputError);
  assert.ok(score({ ...bundle, ...inputs({ facts: { "m.gou04.absence_factor": 1 } }) }).digest, "positive control: a known fact passes");
});

test("the record is canonical, and its two parts carry their own digests", () => {
  const r = score({ ...bundle, ...inputs({ facts: allHeld() }) });
  assert.ok(isCanonical(canonJSON(r)));
  assert.ok(r.internal.criteria.every((c) => c.class.length === 1 && c.class[0] === "M" || !c.class.includes("X")), "internal criteria read no snapshot fact");
  assert.ok(r.external.criteria.every((c) => c.class.includes("X")), "every external criterion reads the snapshot");
  assert.equal(r.internal.criteria.length + r.external.criteria.length, 35);
  assert.match(r.internal.digest, /^[0-9a-f]{64}$/);
  assert.notEqual(r.internal.digest, r.external.digest);
});

test("the internal part does not depend on the snapshot: valid for the commit for ever", () => {
  const with_ = score({ ...bundle, ...inputs({ facts: allHeld() }) });
  const without = score({ ...bundle, ...inputs({ facts: allHeld(), snapshot: false }) });
  assert.equal(with_.internal.digest, without.internal.digest);
  // positive control: the external part does depend on it
  assert.notEqual(with_.external.digest, without.external.digest);
});

test("a repository setting read when the default branch pointed elsewhere is not applied to this commit", () => {
  const concordant = score({ ...bundle, ...inputs({ facts: FX["GOU-02"].held }) });
  assert.equal(stateOf(concordant, "GOU-02").tiers.P1.state, "met");
  const other = score({ ...bundle, ...inputs({ facts: FX["GOU-02"].held, head: "f".repeat(40) }) });
  const g = stateOf(other, "GOU-02");
  assert.equal(g.tiers.P1.state, "not-observed", "repo-now facts are not observed for a past commit");
  assert.match(g.tiers.P1.why.join(" "), /does not describe/);
  assert.equal(other.external.concordant, false);
  // a registry fact (immutable) stays valid for a past commit
  const reg = score({ ...bundle, ...inputs({ facts: FX["GOU-06"].held, prof: { publie_paquet: "fixture-pkg" }, head: "f".repeat(40) }) });
  assert.equal(stateOf(reg, "GOU-06").tiers.P1.state, "met");
});

test("a snapshot of another commit is refused", () => {
  const i = inputs({});
  i.snapshot.manifest.subject.commit = "e".repeat(40);
  assert.throws(() => score({ ...bundle, ...i }), InputError);
});

test("axis tiers are cumulative, not-observed blocks and is counted apart, an all-n/a axis reads n/a", () => {
  const prof = { build_cmd: "npm run build", gate_declare: "x", docs_conformite: ["d.json"], perimetre_mutation: "s.json", publie_paquet: "fixture-pkg" };
  const full = score({ ...bundle, ...inputs({ facts: allHeld(), prof }) });
  for (const a of full.face.axes) {
    const top = ["P3", "P2", "P1"].find((t) => G.grid.criteria.some((c) => c.axis === a.axis && c.tiers[t]));
    assert.equal(a.tier, top, `${a.axis} reaches ${top}, the highest tier its criteria define, when every criterion holds`);
  }
  assert.equal(full.face.axes.find((a) => a.axis === "ADO").cappedAt, "P3", "no ADO criterion defines P3: the axis is capped at P2, never P3 by vacuity");
  const facts = allHeld();
  delete facts["m.fia02.branches"];
  const one = score({ ...bundle, ...inputs({ facts, prof }) });
  const fia = one.face.axes.find((a) => a.axis === "FIA");
  assert.equal(fia.tier, "P2", "FIA stops below the tier that reads the missing fact");
  assert.deepEqual(fia.blockedBy, [{ id: "FIA-02", state: "not-observed", tier: "P3" }]);
  const priv = score({ ...bundle, ...inputs({ facts: allHeld(), prof: { ...prof, repo_public: false } }) });
  assert.equal(priv.face.axes.find((a) => a.axis === "MAR").tier, "na", "MAR-01 n/a and MAR-02 an indicator: the axis reads n/a");
});

test("no tier is reached by vacuity: a tier no applicable criterion defines caps the axis", () => {
  const grid = JSON.parse(JSON.stringify(G.grid));
  // keep in ADO only ADO-03, which defines P2 and nothing else
  grid.criteria = grid.criteria.filter((c) => c.axis !== "ADO" || c.id === "ADO-03");
  const r = score({ ...bundle, grid, ...inputs({ facts: { "m.ado03.interface_gaps": 0 } }) });
  const ado = r.face.axes.find((a) => a.axis === "ADO");
  assert.equal(ado.tier, "P0");
  assert.equal(ado.cappedAt, "P1");
});

test("the judged annex is outside every tier: emptying it changes no tier and no part", () => {
  const a = score({ ...bundle, ...inputs({ facts: allHeld() }) });
  const grid = JSON.parse(JSON.stringify(G.grid));
  grid.annex.items = [];
  const b = score({ ...bundle, grid, ...inputs({ facts: allHeld() }) });
  assert.deepEqual(b.face, a.face);
  assert.equal(b.internal.digest, a.internal.digest);
  assert.equal(b.external.digest, a.external.digest);
  // positive control: the annex is in the record, so the record's digest moves
  assert.notEqual(b.digest, a.digest);
});

test("regressions against a previous record: a real loss apart from a loss by observation", () => {
  const prof = { build_cmd: "npm run build", gate_declare: "x", docs_conformite: ["d.json"], perimetre_mutation: "s.json", publie_paquet: "fixture-pkg" };
  const before = score({ ...bundle, ...inputs({ facts: allHeld(), prof }) });
  const real = score({ ...bundle, previous: before, ...inputs({ facts: { ...allHeld(), "m.gou04.absence_factor": 1 }, prof }) });
  assert.deepEqual(real.face.regressions.map((g) => [g.axis, g.from, g.to, g.kind]), [["GOU", "P3", "P1", "real"]]);
  const lost = allHeld(); delete lost["m.gou04.absence_factor"];
  const obs = score({ ...bundle, previous: before, ...inputs({ facts: lost, prof }) });
  assert.deepEqual(obs.face.regressions.map((g) => [g.axis, g.kind]), [["GOU", "observation"]]);
});

test("dates are read by arithmetic, never by a clock or a time zone", () => {
  assert.equal(isoSeconds("1970-01-01T00:00:00Z"), 0);
  assert.equal(isoSeconds("2026-11-05T23:00:00+01:00"), isoSeconds("2026-11-05T22:00:00Z"));
  assert.equal(isoSeconds("2026-11-05T22:00:00.123Z"), isoSeconds("2026-11-05T22:00:00Z"));
  assert.equal(isoSeconds("2024-02-29T00:00:00Z") - isoSeconds("2024-02-28T00:00:00Z"), 86400, "a leap day exists");
  assert.equal(isoSeconds("not a date"), null);
});

test("a package the registry answers 404 for contradicts the declaration that it is published", () => {
  const i = inputs({ prof: { publie_paquet: "ghost", versions_published: true } });
  i.snapshot.profileEvidence.registryStatus = { ghost: "http-404" };
  const r = score({ ...bundle, ...i });
  assert.equal(r.profile.facts.publie_paquet.basis, "contradicted");
  assert.equal(r.profile.facts.versions_published.basis, "contradicted");
  assert.ok(r.profile.contradictions.some((c) => c.fact === "publie_paquet"));
  // positive control: a package the registry holds is supported by the snapshot
  const j = inputs({ prof: { publie_paquet: "real" } });
  j.snapshot.profileEvidence.registry = { real: true };
  assert.equal(score({ ...bundle, ...j }).profile.facts.publie_paquet.basis, "snapshot");
});

test("inputs collected under other grid tables or lists are refused, never mixed in", () => {
  const i = inputs({});
  i.snapshot.manifest.grid.data = "0".repeat(64);
  assert.throws(() => score({ ...bundle, ...i }), /snapshot applied other grid tables or lists/);
  const j = inputs({});
  j.measure.grid.data = "0".repeat(64);
  assert.throws(() => score({ ...bundle, ...j }), /measure applied other grid tables or lists/);
  assert.ok(score({ ...bundle, ...inputs({}) }).digest, "positive control: the same tables and lists pass");
});
