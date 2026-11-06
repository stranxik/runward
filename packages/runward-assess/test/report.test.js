// The two reports: views of the record, in the house identity, self-contained, with no path of a run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { score } from "../src/score.js";
import { reportMarkdown } from "../src/report-md.js";
import { reportHtml, CSS } from "../src/report-html.js";
import { evolution, evolutionMarkdown, evolutionHtml } from "../src/diff.js";
import { bundle, inputs, PKG, G } from "./helpers.js";

const FX = JSON.parse(readFileSync(join(PKG, "test", "fixtures", "criteria.json"), "utf8")).criteria;
const facts = Object.fromEntries(Object.values(FX).flatMap((f) => Object.entries(f.held)));
const rec = score({ ...bundle, ...inputs({ facts }), label: "fixture" });

test("the HTML report: archive minérale tokens, gold once, no banned hue, nothing fetched", () => {
  const html = reportHtml(rec, G.grid);
  for (const token of ["#191715", "#E9E4DB", "#E1DCD2", "#C9D2C6", "#2A2622", "#C9A45C"]) assert.ok(CSS.includes(token), `token ${token}`);
  assert.equal((CSS.match(/var\(--or\)/g) ?? []).length, 2, "gold is used by one rule only (border and fill of one mark)");
  assert.equal((html.match(/class="proof"/g) ?? []).length, 1, "and that rule styles one element: the record's digest");
  assert.doesNotMatch(html, /indigo|241CC4|7B74FF|#0A0A0A|#FAFAFA/i, "no banned hue");
  assert.doesNotMatch(html, /<script|<link\b|@import|url\(http|src="http|href="http/i, "self-contained: no script, no fetched style, font or image");
  assert.match(html, /--mono:"Departure Mono"/);
  assert.equal((CSS.match(/font-family:var\(--mono\)/g) ?? []).length, 1, "Departure Mono for the survey marks only");
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /<html lang="en">/);
  // positive control: the assertion sees a banned hue when there is one
  assert.match(html.replace("--basalte:#191715", "--basalte:#241CC4"), /241CC4/);
});

test("the Markdown report names every criterion and the face; neither report carries a path of a run", () => {
  const md = reportMarkdown(rec, G.grid);
  for (const c of G.grid.criteria) assert.ok(md.includes(`| ${c.id} r${c.rev} `), c.id);
  assert.match(md, /## The face/);
  for (const text of [md, reportHtml(rec, G.grid), JSON.stringify(rec)]) assert.doesNotMatch(text, /\/Users\/|\/private\/|\/home\/|\/var\/folders|[A-Z]:\\\\/);
  assert.ok(!/\b\d+(\.\d+)? ?% of the grid|\bglobal score:|\baverage:/i.test(md), "no composite score anywhere");
});

test("the evolution: tiers per record, a real loss apart from a loss by observation, the same grid said", () => {
  const prof = { build_cmd: "npm run build", gate_declare: "x", docs_conformite: ["d.json"], perimetre_mutation: "s.json", publie_paquet: "fixture-pkg" };
  const a = score({ ...bundle, ...inputs({ facts, prof }), label: "a" });
  const b = score({ ...bundle, ...inputs({ facts: { ...facts, "m.gou04.absence_factor": 1 }, prof }), label: "b" });
  const lost = { ...facts }; delete lost["m.sec04.secrets_unexcepted"];
  const c = score({ ...bundle, ...inputs({ facts: lost, prof }), label: "c" });
  const ev = evolution([{ label: "a", record: a }, { label: "b", record: b }, { label: "c", record: c }], G.grid);
  assert.equal(ev.sameGrid, true);
  assert.ok(ev.axisChanges.some((x) => x.axis === "GOU" && x.kind === "real-loss"));
  assert.ok(ev.axisChanges.some((x) => x.axis === "SEC" && x.kind === "observation-loss"));
  assert.ok(ev.transitions.some((t) => t.id === "GOU-04" && t.kind === "real-loss"));
  const md = evolutionMarkdown(ev, G.grid), html = evolutionHtml(ev, G.grid);
  assert.match(md, /GOU P3 → P1, real loss/);
  assert.match(html, /observation loss/);
  assert.doesNotMatch(html, /<script|url\(http/);
});
