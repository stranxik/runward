// Unit tests for the compliance assembly (dist/lib/compliance.js): inputs, OSCAL, regime drafts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  gatherComplianceInputs, renderOscal,
  renderIso42001Readiness, renderNistAiRmf, renderEuAiAct,
} from "../../dist/lib/compliance.js";
import { loadRegime } from "../../dist/lib/regimes.js";

// Fixture: rule-one covers ASI01+ASI02 (applied), rule-two covers ASI01 (deviated) —
// so ASI02 must come out implemented, ASI01 partial, the other eight planned.
function makeMission() {
  const dir = mkdtempSync(join(tmpdir(), "runward-comp-"));
  mkdirSync(join(dir, "rules"), { recursive: true });
  mkdirSync(join(dir, "adr"), { recursive: true });
  mkdirSync(join(dir, "governance"), { recursive: true });
  writeFileSync(join(dir, "rules", "rule-one.md"), "---\ntitle: Rule One\nimpact: CRITICAL\nasi: [ASI01, ASI02]\nphases: [floor]\n---\n\nBody.\n");
  writeFileSync(join(dir, "rules", "rule-two.md"), "---\ntitle: Rule Two\nimpact: HIGH\nasi: [ASI01]\nphases: [floor]\n---\n\nBody.\n");
  writeFileSync(join(dir, "floor.md"), [
    "# Floor", "",
    "## Rule conformance", "",
    "| Rule | Status | Evidence |",
    "|---|---|---|",
    "| rule-one | applied | src/x.ts:1 |",
    "| rule-two | deviated | ADR-0001 |",
    "| [rule-slug] | applied | [file:line] |", "",
  ].join("\n"));
  writeFileSync(join(dir, "adr", "ADR-0000-template.md"), "# Template\n");
  writeFileSync(join(dir, "adr", "README.md"), "# Journal\n");
  writeFileSync(join(dir, "adr", "DRAFT-0002-guess.md"), "# Guess\n");
  writeFileSync(join(dir, "adr", "ADR-0001-choice.md"), "# Use one queue\n\n**Status**: accepted\n");
  writeFileSync(join(dir, "governance", "threat-model.md"), "# Threat model\n");
  return dir;
}

test("gatherComplianceInputs: rules, ASI coverage, manifest rows, ADRs, governance presence", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    assert.deepEqual(inputs.rules.map((r) => r.slug).sort(), ["rule-one", "rule-two"]);
    assert.equal(inputs.rules.find((r) => r.slug === "rule-one").title, "Rule One");
    assert.deepEqual(inputs.asiCoverage.get("ASI01"), ["rule-one", "rule-two"]);
    assert.deepEqual(inputs.asiCoverage.get("ASI02"), ["rule-one"]);
    assert.deepEqual(inputs.asiCoverage.get("ASI03"), []);
    assert.deepEqual(inputs.conformance, [
      { rule: "rule-one", status: "applied", evidence: "src/x.ts:1", source: "Floor" },
      { rule: "rule-two", status: "deviated", evidence: "ADR-0001", source: "Floor" },
    ]);
    assert.deepEqual(inputs.adrs, [{ file: "ADR-0001-choice.md", title: "Use one queue", status: "accepted" }]);
    assert.equal(inputs.threatModel, true);
    assert.equal(inputs.evalRubric, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("every pack carries the declared non-scope, not just the one that stays home", () => {
  // Measured on 2026-08-06: the ADR-0040 reservation appeared once in the ISO/IEC 42001 draft and
  // ZERO times in the NIST AI RMF draft, the EU AI Act draft and the OSCAL component-definition.
  // The artifact that leaves for a third-party GRC tool was the one carrying no caveat, and the
  // prose around a pack does not travel with it. A caveat that stays home was not made.
  //
  // The assertion is on a distinctive fragment of the text rather than on the constant, because
  // what must ship is the sentence a reader sees, not an identifier a bundler could rename.
  const MARK = "It never proves the evidence truly implements";
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const iso = loadRegime("iso-42001");
    const nist = loadRegime("nist-ai-rmf");
    const eu = loadRegime("eu-ai-act");
    const packs = {
      "iso-42001 readiness": renderIso42001Readiness(inputs, "2026-01-01", iso),
      "nist-ai-rmf readiness": renderNistAiRmf(inputs, "2026-01-01", nist),
      "eu-ai-act readiness": renderEuAiAct(inputs, "2026-01-01", eu),
      "oscal component-definition": renderOscal(inputs, "demo-mission", "2026-01-01"),
    };
    for (const [name, text] of Object.entries(packs)) {
      assert.ok(text.includes(MARK), `${name} must carry the declared non-scope`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("renderOscal: 10 implemented-requirements asi-01..asi-10 with derived statuses", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const doc = JSON.parse(renderOscal(inputs, "demo-mission", "2026-01-01"));
    const irs = doc["component-definition"].components[0]["control-implementations"][0]["implemented-requirements"];
    assert.equal(irs.length, 10);
    assert.deepEqual(irs.map((r) => r["control-id"]), Array.from({ length: 10 }, (_, i) => `asi-${String(i + 1).padStart(2, "0")}`));
    const impl = Object.fromEntries(irs.map((r) => [r["control-id"], r.props.find((p) => p.name === "implementation-status").value]));
    assert.equal(impl["asi-01"], "partial");      // mapped, one rule deviated
    assert.equal(impl["asi-02"], "implemented");  // mapped, every mapped rule applied
    for (const id of ["asi-03", "asi-04", "asi-05", "asi-06", "asi-07", "asi-08", "asi-09", "asi-10"]) {
      assert.equal(impl[id], "planned");          // no rule mapped — a gap
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("renderOscal: a rule mapped but absent from every manifest yields partial", () => {
  const dir = makeMission();
  try {
    writeFileSync(join(dir, "floor.md"), "# Floor\n");
    const inputs = gatherComplianceInputs(dir);
    const doc = JSON.parse(renderOscal(inputs, "demo-mission", "2026-01-01"));
    const irs = doc["component-definition"].components[0]["control-implementations"][0]["implemented-requirements"];
    const asi01 = irs.find((r) => r["control-id"] === "asi-01");
    assert.equal(asi01.props.find((p) => p.name === "implementation-status").value, "partial");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("renderOscal: a multi-phase rule's status aggregates ALL its rows, order-independent (spec §3)", () => {
  // A rule mapped to two phases: applied in one deliverable, deviated in another. `find` (first row)
  // would report implemented or partial depending on order; the fix aggregates every row → partial.
  const base = {
    rules: [{ slug: "r", title: "R", impact: "CRITICAL", asi: ["ASI01"] }],
    asiCoverage: new Map([["ASI01", ["r"]], ...Array.from({ length: 9 }, (_, i) => [`ASI${String(i + 2).padStart(2, "0")}`, []])]),
    adrs: [], threatModel: false, evalRubric: false,
  };
  const rowsA = [{ rule: "r", status: "applied", evidence: "x", source: "Floor" }, { rule: "r", status: "deviated", evidence: "ADR-1", source: "Govern" }];
  const statusOf = (rows) => {
    const doc = JSON.parse(renderOscal({ ...base, conformance: rows }, "m", "2026-01-01"));
    const ir = doc["component-definition"].components[0]["control-implementations"][0]["implemented-requirements"].find((r) => r["control-id"] === "asi-01");
    return ir.props.find((p) => p.name === "implementation-status").value;
  };
  assert.equal(statusOf(rowsA), "partial");
  assert.equal(statusOf([...rowsA].reverse()), "partial"); // order must not change the verdict
  assert.equal(statusOf([{ rule: "r", status: "applied", evidence: "x", source: "Floor" }, { rule: "r", status: "applied", evidence: "y", source: "Govern" }]), "implemented");
});

test("renderOscal: the readiness link points at the lens's regime, no dangling href (spec §3)", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const doc = JSON.parse(renderOscal(inputs, "m", "2026-01-01", "eu-ai-act@2026-1744"));
    const ir = doc["component-definition"].components[0]["control-implementations"][0]["implemented-requirements"][0];
    assert.equal(ir.links[0].href, "./eu-ai-act-readiness.md");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("renderOscal: byte-identical across two identical calls, UUIDs move with the mission name", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const a = renderOscal(inputs, "demo-mission", "2026-01-01");
    const b = renderOscal(inputs, "demo-mission", "2026-01-01");
    assert.equal(a, b);
    const uuid = (s) => JSON.parse(s)["component-definition"].uuid;
    assert.match(uuid(a), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const other = renderOscal(inputs, "other-mission", "2026-01-01");
    assert.notEqual(uuid(a), uuid(other));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("readiness drafts: framed as drafts, never a compliance claim, stamped with the lens version", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const iso = renderIso42001Readiness(inputs, "2026-01-01", loadRegime("iso-42001"));
    const nist = renderNistAiRmf(inputs, "2026-01-01", loadRegime("nist-ai-rmf"));
    const eu = renderEuAiAct(inputs, "2026-01-01", loadRegime("eu-ai-act"));
    for (const md of [iso, nist, eu]) {
      assert.match(md, /Draft/);
      assert.ok(!/you are compliant/i.test(md));
      assert.match(md, /2026-01-01/);
      assert.ok(!md.includes("undefined"), "no lens field may render as undefined");
    }
    assert.match(iso, /not a compliance claim/);
    assert.match(nist, /not a compliance claim/);
    assert.match(eu, /not a conformity assessment/);
    // the lens stamp (ADR-0022): a dated lens says its version
    assert.match(iso, /Lens: ISO\/IEC 42001 \(mapping version 2023\) — `iso-42001@2023`/);
    assert.match(nist, /Lens: NIST AI RMF \(mapping version 1\.0\) — `nist-ai-rmf@1\.0`/);
    assert.match(eu, /Lens: EU AI Act \(Annex IV\) \(mapping version 2026-1744\) — `eu-ai-act@2026-1744`/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("readiness drafts: the extracted mapping renders (clauses, crosswalk, Annex IV rows, operator lists)", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const iso = renderIso42001Readiness(inputs, "2026-01-01", loadRegime("iso-42001"));
    assert.match(iso, /risk assessment \(6\.1\.2\) and control selection \(6\.1\.3\)/);
    assert.match(iso, /\*\*Runtime AI event logs\*\* \(A\.6\.2\.8\)/);
    const nist = renderNistAiRmf(inputs, "2026-01-01", loadRegime("nist-ai-rmf"));
    assert.match(nist, /Feeds MEASURE 2\.x/);
    assert.match(nist, /Confirm subcategory selection against AI RMF §5/);
    const eu = renderEuAiAct(inputs, "2026-01-01", loadRegime("eu-ai-act"));
    // High-risk postponed to 2027 by the Digital Omnibus (the date comes from the regime data).
    assert.match(eu, /bind from\n> \*\*2 December 2027 \(Annex III\) \/ 2 August 2028 \(Annex I\)\*\*/);
    for (let p = 1; p <= 9; p++) assert.match(eu, new RegExp(`\\| ${p}\\. `), `Annex IV point ${p} row present`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("renderOscal: the lens id is stamped as a metadata prop when provided", () => {
  const dir = makeMission();
  try {
    const inputs = gatherComplianceInputs(dir);
    const doc = JSON.parse(renderOscal(inputs, "demo-mission", "2026-01-01", "eu-ai-act@2026-1744"));
    const props = doc["component-definition"].metadata.props;
    assert.deepEqual(props, [{ name: "runward-regime-lens", value: "eu-ai-act@2026-1744" }]);
    const bare = JSON.parse(renderOscal(inputs, "demo-mission", "2026-01-01"));
    assert.equal(bare["component-definition"].metadata.props, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
