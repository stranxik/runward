// The nets the verdict campaign named (PR #192): under --through every presence gap was
// swallowed (a certified prefix passed green with an unfilled deliverable — ADR-0053's floor,
// not ceiling), the resigned-lock attack reopened under the corpus-authority mutant, the `extra`
// term could subtract from the verdict, and the non-strict contract promised "empty rather than
// absent" was pinned by a test that asserted a third of it. Every fixture here is the campaign's
// own recipe, re-run as a net.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };
const run = (args, cwd) => {
  try { return { code: 0, out: execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ENV }) }; }
  catch (e) { return { code: e.status, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
};
const rich = () => {
  const parent = mkdtempSync(join(tmpdir(), "rw-vh-"));
  const dir = join(parent, "m"); cpSync(join(ROOT, "examples", "request-triage"), dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(parent, { recursive: true, force: true }) };
};

test("a presence gap at or below the horizon is judged, never deferred (ADR-0053: floor, not ceiling)", () => {
  const p = rich();
  try {
    // Hollow a NON-gated deliverable so only judgeGated cannot mask the presence gap.
    writeFileSync(join(p.mission, "framing.md"),
      readFileSync(join(ROOT, "templates", "mission", "framing.md")));
    for (const through of ["frame", "floor"]) {
      const v = computeVerdict(p.mission, { strict: true, through });
      assert.equal(v.clean, false,
        `--through ${through}: a raw framing.md inside the certified prefix must stay red — ` +
        "the campaign measured exit 1 -> 0 under the deferral mutants");
    }
  } finally { p.drop(); }
});

test("on a finished arc under --through, the deferred list is the real one", () => {
  const p = rich();
  try {
    const v = computeVerdict(p.mission, { strict: true, through: "frame" });
    assert.equal(v.clean, true, "the reference mission defers everything past frame and stays green");
    const d = v.horizon.deferred;
    // Update deliberately if the deliverable set changes — the count is the point: a fabricated
    // entry made it 12, and the all-lines-deferred mutant made gaps.deferred 11 on a FILLED arc.
    assert.equal(d.length, 11, "eleven deliverables sit past the frame horizon");
    for (const e of d) {
      assert.equal(typeof e.relPath, "string");
      assert.ok(e.relPath.length > 0 && e.phase.includes("·"),
        `a deferred entry is a real deliverable line, got: ${JSON.stringify(e)}`);
    }
    assert.equal(d.filter((e) => e.state !== "filled").length, v.gaps?.deferred ?? d.filter((e) => e.state !== "filled").length,
      "deferred gaps count only the unfilled deferred lines");
    assert.equal(d.filter((e) => e.state !== "filled").length, 0,
      "a filled arc has zero deferred gaps — the campaign measured 0 -> 11 under the mutant");
  } finally { p.drop(); }
});

test("a broken gated pointer ABOVE the horizon is deferred — the deferral itself, pinned", () => {
  const p = rich();
  try {
    const arch = join(p.mission, "architecture.md");
    writeFileSync(arch, readFileSync(arch, "utf8").replace(/file:code\/src\/core\/ports\/model-provider\.port\.ts#\S+/, "file:code/src/gone.ts"));
    const v = computeVerdict(p.mission, { strict: true, through: "frame" });
    assert.equal(v.clean, true,
      "a gated deliverable broken PAST the horizon must be deferred, not judged — the " +
      "GATED_TO_PRESENCE ordinal mutants turned this into a false red");
  } finally { p.drop(); }
});

test("the strict critical scope is the real cardinality, and the non-strict one is empty, not absent", () => {
  const p = rich();
  try {
    const s = computeVerdict(p.mission, { strict: true });
    // Update deliberately when a rule's impact or phases change — the cardinals ARE the claim
    // ("scope: 31 of 45"): under the filter mutants they read 64, 17 or 36 of the wrong set.
    assert.equal(s.criticalScope.total, 45);
    assert.ok(s.criticalScope.mapped > 0, "a green mission maps rules — 'scope: 0 of 45' shipped under one mutant");
    assert.equal(s.criticalScope.mapped + s.criticalScope.unmapped.length, s.criticalScope.total);
    const ns = computeVerdict(p.mission, { strict: false });
    assert.deepEqual(ns.corpus, { status: "package", edited: [], missing: [], extra: [] });
    assert.deepEqual(ns.seal, { present: false, count: 0, violations: [] });
    assert.deepEqual(ns.criticalScope, { total: 0, mapped: 0, unmapped: [] });
    assert.deepEqual(ns.breakdown, { rows: 0, applied: 0, deviated: 0, na: 0, typed: 0, prose: 0,
      signed: 0, proseRows: [], duplicated: [], evidenceFiles: { total: 0, external: 0 } });
  } finally { p.drop(); }
});

test("a vendored corpus with one extra house rule reddens, and the summary counts it as +1", () => {
  const p = rich();
  try {
    run(["update", "--corpus", join(ROOT, "templates", "rules")], p.dir);
    writeFileSync(join(p.mission, "rules", "zz-house-rule.md"),
      "---\ntitle: House rule\nimpact: HIGH\nphases: [floor]\n---\n\nA real house rule body.\n");
    const v = computeVerdict(p.mission, { strict: true });
    assert.equal(v.clean, false,
      "an extra CRITICAL/HIGH rule with no manifest row is a gap — under the arithmetic mutant " +
      "`+ extra` became `- extra` and this went exit 0");
    assert.equal(v.corpus.extra.length, 1);
    const r = run(["check", "--strict"], p.dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /1 rule-corpus divergence\(s\)/,
      "the summary names ONE divergence — the counter mutants printed -1 or dropped the line");
  } finally { p.drop(); }
});

test("deleting a shipped rule and re-signing the lock stays red — the package is the authority (ADR-0045)", () => {
  const p = rich();
  try {
    run(["update", "--corpus", join(ROOT, "templates", "rules")], p.dir);
    rmSync(join(p.mission, "rules", "checklist-pre-production-security.md"));
    const lockPath = join(p.mission, "scaffold-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    for (const k of Object.keys(lock.files)) {
      if (k.includes("checklist-pre-production-security")) delete lock.files[k];
    }
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    const v = computeVerdict(p.mission, { strict: true });
    assert.equal(v.clean, false,
      "a shipped rule deleted AND scrubbed from the lock must still be missing — the " +
      "corpus-authority mutant reopened this exact attack (exit 1 -> 0)");
    assert.ok(v.corpus.missing.some((m) => m.includes("checklist-pre-production-security")),
      "the missing rule is named against the installed package, not against the editable lock");
  } finally { p.drop(); }
});

test("an unratified decision is counted as +1 in the summary, never -1", () => {
  const p = rich();
  try {
    writeFileSync(join(p.mission, "adr", "ADR-0099-draft.md"),
      "# A draft decision\n\n**Status**: hypothesis\n\nA body long enough to be a real record.\n");
    const r = run(["check", "--strict"], p.dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /1 unratified decision\(s\)/,
      "the remediation count reads 1 — the counter mutant printed -1 with the same exit code");
  } finally { p.drop(); }
});

test("a refused --freeze carries an honest empty seal in the machine payload", () => {
  const p = rich();
  try {
    writeFileSync(join(p.mission, "adr", "ADR-0099-draft.md"),
      "# A draft decision\n\n**Status**: hypothesis\n\nA body long enough to be a real record.\n");
    const r = run(["check", "--strict", "--freeze", "--json"], p.dir);
    assert.equal(r.code, 1);
    const j = JSON.parse(r.out);
    assert.equal(j.seal.present, false);
    assert.equal(j.seal.violations, 0,
      "a refused freeze reports zero seal violations — the placeholder mutant put a phantom one " +
      "under present:false");
  } finally { p.drop(); }
});
