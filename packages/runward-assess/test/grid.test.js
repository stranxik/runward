// The grid is data, versioned, and a change that can move a result cannot hide under the same rev.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gridProblems, normativeDigest, criterionFacts } from "../src/grid.js";
import { G } from "./helpers.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

test("grille@1: 35 criteria on 7 axes, stable AXE-NN identifiers, no structural problem", () => {
  assert.equal(G.grid.criteria.length, 35);
  assert.deepEqual(G.grid.axes.map((a) => a.id), ["FIA", "SEC", "GOU", "PRV", "PRO", "ADO", "MAR"]);
  assert.deepEqual(gridProblems(G), []);
  const perAxis = Object.fromEntries(G.grid.axes.map((a) => [a.id, G.grid.criteria.filter((c) => c.axis === a.id).length]));
  assert.deepEqual(perAxis, { ADO: 4, FIA: 7, GOU: 6, MAR: 2, PRO: 3, PRV: 5, SEC: 8 });
});

test("a threshold changed without raising rev is refused by the lock", () => {
  const g = clone(G);
  const c = g.grid.criteria.find((x) => x.id === "FIA-02");
  c.tiers.P2.all[0].value = [70, 100];
  assert.ok(gridProblems(g).some((p) => /FIA-02: its normative content changed and its rev did not/.test(p)));
  // raising rev without updating the lock is refused too, with another message
  c.rev = 2;
  assert.ok(gridProblems(g).some((p) => /FIA-02: rev 2 in the grid, 1 in the lock/.test(p)));
});

test("wording is not normative: a text correction keeps the normative digest (grille@1.m)", () => {
  const c = clone(G.grid.criteria.find((x) => x.id === "GOU-05"));
  const before = normativeDigest(c);
  c.title = "Decisions recorded, and kept current";
  c.tiers.P1.text = "a journal of decisions, every status readable";
  c.procedure = "reworded";
  assert.equal(normativeDigest(c), before);
  // positive control: an applicability change is normative
  c.applies.profiles = ["L"];
  assert.notEqual(normativeDigest(c), before);
});

test("identifiers are never reused: a criterion removed from the grid must stay in the lock, retired", () => {
  const g = clone(G);
  g.grid.criteria = g.grid.criteria.filter((c) => c.id !== "ADO-04");
  assert.ok(gridProblems(g).some((p) => /ADO-04: in the lock and not in the grid/.test(p)));
  g.lock.criteria["ADO-04"].retired_in = "grille@2";
  assert.ok(!gridProblems(g).some((p) => /ADO-04/.test(p)));
});

test("a criterion's class says whether it reads the snapshot, and the check sees a lie", () => {
  const g = clone(G);
  g.grid.criteria.find((x) => x.id === "GOU-04").class = ["M", "X"];
  assert.ok(gridProblems(g).some((p) => /GOU-04: class M,X declares X but the criterion does not read a snapshot fact/.test(p)));
});

test("a criterion that reads an undefined fact, or a duplicate identifier, is refused", () => {
  const g = clone(G);
  g.grid.criteria.find((x) => x.id === "SEC-04").tiers.P1.all[0].fact = "m.sec04.typo";
  g.grid.criteria.push(clone(g.grid.criteria[0]));
  const p = gridProblems(g);
  assert.ok(p.some((x) => /SEC-04: reads m\.sec04\.typo/.test(x)));
  assert.ok(p.some((x) => /FIA-01: identifier used twice/.test(x)));
});

test("every fact a criterion reads is in the catalogue, and the catalogue says what is not mechanized", () => {
  const reads = new Set(G.grid.criteria.flatMap(criterionFacts));
  for (const f of reads) assert.ok(G.catalogue.facts[f], f);
  const notMech = Object.entries(G.catalogue.facts).filter(([, f]) => f.mechanized === false).map(([k]) => k);
  assert.ok(notMech.length > 0 && notMech.every((k) => G.catalogue.facts[k].procedure), "a fact not collected names the procedure that would collect it");
});

test("a shared table that can move a result (a threshold of the snapshot) is locked too", () => {
  const g = clone(G);
  g.grid.tables.vulnerabilities.openDays = 60;
  assert.ok(gridProblems(g).some((p) => /tables: a shared table that can move a result changed/.test(p)));
  const h = clone(G);
  h.grid.tables.scorecardRisk.source = "reworded";
  assert.ok(!gridProblems(h).some((p) => /tables/.test(p)), "positive control: wording of a table is not normative");
});
