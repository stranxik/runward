// The decision journal names what its reader set aside (RWD-2026-0172, RWD-2026-0173, TOR-244 to
// TOR-247). Reported by an adopter on 0.44.0 and reproduced on main: under the structure contract
// (the default for new missions since ADR-0069), an ADR without a `## Reevaluation trigger` section
// left the count (3 -> 2) while the verdict stayed clean and nothing named the file; a journal whose
// every ADR was written with localized headings read "Decision journal — raw template". The reader
// was right to refuse those files as decisions; it was wrong to say nothing about which, and why.
// It also refused `## Reevaluation` written by an operator who wrote the
// section under a shorter heading than the template's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { adrSetAside, adrSetAsideReason, analyze, artifactState, incompleteContracts, isRealAdr, readReopeningTriggers, PHASES }
  from "../../dist/lib/mission.js";

const CLI = join(process.cwd(), "dist/cli.js");
const run = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

const CONTEXT = "A real context long enough to clear the character floor. ".repeat(6);
const adr = (n, { heading = "## Reevaluation trigger (mandatory, dated)", date = "**Date**: 2026-09-03", status = "**Status**: accepted", trigger = "The measured trigger that reopens this, set on 2026-09-03." } = {}) =>
  `# ADR-000${n}: a decision\n\n${date}\n${status}\n\n## Context\n\n${CONTEXT}\n\n${heading === null ? "" : `${heading}\n\n${trigger}\n`}`;

/** A bare mission directory with an adr/ folder, armed or not. */
function missionDir(armed) {
  const dir = mkdtempSync(join(tmpdir(), "rw-setaside-"));
  mkdirSync(join(dir, "adr"));
  if (armed) writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ version: 1, files: {}, structureContract: true }));
  return dir;
}

test("RWD-2026-0172: each ADR the reader set aside is named with the reason it was set aside", () => {
  const dir = missionDir(true);
  try {
    const d = join(dir, "adr");
    writeFileSync(join(d, "ADR-0001-good.md"), adr(1));
    writeFileSync(join(d, "ADR-0002-no-trigger.md"), adr(2, { heading: null }));
    writeFileSync(join(d, "ADR-0003-no-date.md"), adr(3, { date: "" }));
    writeFileSync(join(d, "ADR-0004-bad-status.md"), adr(4, { status: "**Status**: approved" }));
    writeFileSync(join(d, "ADR-0005-empty-trigger.md"), adr(5, { trigger: "[to fill]" }));
    writeFileSync(join(d, "ADR-0006-empty.md"), "");
    writeFileSync(join(d, "ADR-0000-template.md"), "the template is not an ADR and is never listed");
    // positive control: the complete decision counts and is not listed
    assert.equal(isRealAdr("ADR-0001-good.md", d), true);
    assert.equal(adrSetAsideReason("ADR-0001-good.md", d), null);
    assert.deepEqual(adrSetAside(d), [
      { adr: "ADR-0002-no-trigger.md", reason: 'no "## Reevaluation trigger" section' },
      { adr: "ADR-0003-no-date.md", reason: 'no "**Date**: YYYY-MM-DD" line' },
      { adr: "ADR-0004-bad-status.md", reason: 'status "approved" is not one of proposed, accepted, superseded, deprecated' },
      { adr: "ADR-0005-empty-trigger.md", reason: 'the "## Reevaluation trigger" section is empty or still a placeholder' },
      { adr: "ADR-0006-empty.md", reason: "empty, or shorter than 40 characters" },
    ]);
    const r = analyze(dir);
    assert.equal(r.adrCount, 1, "the count is unchanged by the naming: one decision counts");
    assert.equal(r.adrSetAside.length, 5, "and every file left out of it is named");
    // every listed file is exactly a file the count refused: one reading, two outputs
    for (const f of readdirSync(d)) {
      if (f === "ADR-0000-template.md") continue;
      assert.equal(isRealAdr(f, d), !r.adrSetAside.some((s) => s.adr === f), f);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0172: without the opt-in only the character floor sets an ADR aside", () => {
  const dir = missionDir(false);
  try {
    const d = join(dir, "adr");
    writeFileSync(join(d, "ADR-0001-no-trigger.md"), adr(1, { heading: null }));
    writeFileSync(join(d, "ADR-0002-empty.md"), "");
    assert.deepEqual(adrSetAside(d), [{ adr: "ADR-0002-empty.md", reason: "empty, or shorter than 40 characters" }],
      "an unarmed mission keeps today's reading: a trigger-less ADR still counts, nothing new is named against it");
    assert.equal(analyze(dir).adrCount, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0173: a heading that starts with ## Reevaluation is the trigger section; a localized one is not read", () => {
  const dir = missionDir(true);
  try {
    const d = join(dir, "adr");
    writeFileSync(join(d, "ADR-0001-short.md"), adr(1, { heading: "## Reevaluation" }));
    writeFileSync(join(d, "ADR-0002-plural.md"), adr(2, { heading: "## Reevaluation triggers" }));
    writeFileSync(join(d, "ADR-0003-fr.md"), adr(3, { heading: "## Déclencheur de réévaluation" }));
    assert.equal(isRealAdr("ADR-0001-short.md", d), true, "`## Reevaluation` is the section the template asks for");
    assert.equal(isRealAdr("ADR-0002-plural.md", d), true);
    // control: a localized heading is still not read (ADR-0097, proposed) — and is now NAMED
    assert.equal(isRealAdr("ADR-0003-fr.md", d), false);
    assert.deepEqual(adrSetAside(d), [{ adr: "ADR-0003-fr.md", reason: 'no "## Reevaluation trigger" section' }]);
    // the reopening watch reads the same heading as the count
    const w = readReopeningTriggers(d);
    assert.deepEqual(w.triggers.map((t) => t.adr), ["ADR-0001-short.md", "ADR-0002-plural.md"]);
    assert.ok(w.triggers.every((t) => t.preview.startsWith("The measured trigger")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0172: check names the set-aside ADR in its output and its JSON, never as a raw template", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-setaside-cli-"));
  try {
    run(root, "init", "--yes");
    // positive control first: an empty journal is still the raw template, and the payload carries
    // no `adrSetAside` key, so every existing payload keeps its bytes
    const empty = run(root, "check");
    assert.match(empty.stdout, /Decision journal \(≥1 ADR\) \(runward\/adr\) — raw template/);
    assert.equal("adrSetAside" in JSON.parse(run(root, "check", "--json").stdout), false);
    const exitBefore = empty.status;

    // the adopter's shape: an ADR written with localized headings, no trigger section
    writeFileSync(join(root, "runward/adr/ADR-0001-etat.md"),
      `# ADR-0001: une décision\n\n**Date**: 2026-10-17\n**Status**: accepted\n\n## Contexte\n\n${CONTEXT}\n\n## Décision\n\n${CONTEXT}\n`);
    const out = run(root, "check");
    assert.equal(out.status, exitBefore, "naming the file changes no exit code");
    assert.doesNotMatch(out.stdout, /Decision journal \(≥1 ADR\) \(runward\/adr\) — raw template/);
    assert.match(out.stdout, /Decision journal \(≥1 ADR\) \(runward\/adr\) — no ADR counted, 1 set aside/);
    assert.match(out.stdout, /set aside runward\/adr\/ADR-0001-etat\.md — no "## Reevaluation trigger" section/);
    assert.match(out.stdout, /ADRs\s+0 .*\(1 set aside, not counted\)/);
    assert.match(out.stdout, /Decision journal \(≥1 ADR\) \(runward\/adr\) — no ADR counted, 1 set aside$/m, "the why-red recap says it too");
    const j = JSON.parse(run(root, "check", "--json").stdout);
    assert.equal(j.adrCount, 0);
    assert.deepEqual(j.adrSetAside, [{ adr: "ADR-0001-etat.md", reason: 'no "## Reevaluation trigger" section' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("TOR-247: under the opt-in, a filled contracts directory names each other contract missing a section, advisory", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-contracts-"));
  try {
    run(root, "init", "--yes");
    const m = join(root, "runward");
    const contracts = PHASES.flatMap((p) => p.artifacts).find((a) => a.relPath === "contracts");
    const body = (sections) => `# Port contract — model\n\n${sections.map((s) => `## ${s}\n\nReal prose for ${s}, written by the operator.\n`).join("\n")}`;
    writeFileSync(join(m, "contracts/a-model.md"), body(["Business intent", "Signature", "Invariants", "Errors"]));
    const exitComplete = run(root, "check").status;
    // positive control: one complete contract alone is filled and nothing is listed
    assert.equal(artifactState(m, contracts), "filled");
    assert.deepEqual(incompleteContracts(m), []);
    writeFileSync(join(m, "contracts/b-store.md"), body(["Business intent", "Signature"]));
    assert.equal(artifactState(m, contracts), "filled", "≥1 filled is unchanged: the verdict does not move");
    assert.deepEqual(incompleteContracts(m), [{ file: "b-store.md", missing: ["Invariants", "Errors"] }]);
    const out = run(root, "check");
    assert.equal(out.status, exitComplete, "the advisory line changes no exit code");
    assert.match(out.stdout, /✓ Port contracts \(≥1 filled\) \(runward\/contracts\)\n\s+advisory runward\/contracts\/b-store\.md — section\(s\) missing: "## Invariants", "## Errors" \(does not affect the verdict\)/);
    // without the opt-in, sections are not read, so nothing is listed
    const lock = join(m, "scaffold-lock.json");
    const j = JSON.parse(readFileSync(lock, "utf8"));
    j.structureContract = false;
    writeFileSync(lock, JSON.stringify(j, null, 2));
    assert.deepEqual(incompleteContracts(m), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
