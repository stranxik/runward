// ADR-0077: `rules --for` shows the rules the mission already answered for on these files.
//
// The case that opened it: `code/src/core/domain/guard.ts` — the file the example mission cites as
// evidence for four CRITICAL/HIGH rules — answered "0 rules", because each of those rules DECLARED
// it has no file territory (ADR-0041). The mission had already said which rules it answered for on
// that file, in its own manifests. That declaration is now surfaced, in its own section, and it is
// pinned here in both directions: what it shows, and everything it must never claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readManifest } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GUARD = "code/src/core/domain/guard.ts";

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-cited-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-cited-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
function forJson(cwd, ...paths) {
  return JSON.parse(execFileSync(process.execPath, [CLI, "rules", "--for", ...paths, "--json", "-p", "."], { cwd, encoding: "utf8" }));
}
function forText(cwd, ...paths) {
  return execFileSync(process.execPath, [CLI, "rules", "--for", ...paths, "-p", "."], { cwd, encoding: "utf8" });
}

test("ADR-0077: guard.ts surfaces the four rules the mission cites it for, each with its manifest line", () => {
  const m = mission();
  const j = forJson(m.dir, GUARD);
  const got = j.citedByMission.citations.map((x) => `${x.rule} ${x.status} ${x.via.file}:${x.via.line}`);
  assert.deepEqual(got, [
    "frontier-deterministic-boundary applied runward/floor.md:22",
    "hexa-move-deterministic-out applied runward/floor.md:23",
    "security-human-agent-trust applied runward/governance/threat-model.md:60",
    "security-prompt-injection applied runward/governance/threat-model.md:50",
  ]);
  for (const x of j.citedByMission.citations) {
    assert.equal(x.path, GUARD);
    assert.equal(x.resolves, true, `${x.rule}: the pointer resolves today`);
    // The line named is the row itself — read back, not trusted.
    const row = readFileSync(join(m.dir, x.via.file), "utf8").split("\n")[x.via.line - 1];
    assert.match(row, new RegExp(`\\|\\s*${x.rule}\\s*\\|`), `${x.via.file}:${x.via.line} is ${x.rule}'s row`);
  }
  m.drop();
});

test("ADR-0077: a citation is never a match — count, rules and every territory counter are unchanged", () => {
  const m = mission();
  const j = forJson(m.dir, GUARD);
  // Territory may match (ADR-0078 binds guard.ts to domain-core); a rule that is ONLY cited never does.
  const cited = new Set(j.citedByMission.citations.map((x) => x.rule));
  assert.deepEqual(j.rules.map((r) => r.slug).filter((s) => cited.has(s)), [],
    "none of the four cited rules becomes a match by being cited");
  assert.equal(j.count, j.rules.length);
  assert.equal(j.territoryStates.matched, j.rules.length);
  assert.equal(j.unscoped.count, j.territoryStates.declaredNoTerritory + j.territoryStates.unreviewed);
  assert.deepEqual(j.couldNotRead, [], "the top-level fail-loud list speaks for territory carriers only");
  assert.match(j.citedByMission.note, /not a territory/);
  m.drop();
});

test("ADR-0077: a renamed symbol keeps the reminder and says it no longer resolves", () => {
  const m = mission();
  const f = join(m.dir, GUARD);
  writeFileSync(f, readFileSync(f, "utf8").replace(/\bguardFields\b/g, "verifyFields"));
  const j = forJson(m.dir, GUARD);
  const byRule = Object.fromEntries(j.citedByMission.citations.map((x) => [x.rule, x]));
  assert.equal(byRule["security-prompt-injection"].resolves, false);
  assert.match(byRule["security-prompt-injection"].note, /symbol "guardFields" not found/);
  assert.equal(byRule["hexa-move-deterministic-out"].resolves, true, "a pointer to a symbol still present is unaffected");
  const text = forText(m.dir, GUARD);
  assert.match(text, /cited, no longer resolves/);
  m.drop();
});

test("ADR-0077: a deleted file is still reminded of, and said to be missing", () => {
  const m = mission();
  unlinkSync(join(m.dir, GUARD));
  const j = forJson(m.dir, GUARD);
  assert.equal(j.citedByMission.citations.length, 4);
  assert.ok(j.citedByMission.citations.every((x) => !x.resolves && /does not exist/.test(x.note)));
  m.drop();
});

test("ADR-0077: a file nobody cited gets nothing — the source is a reminder, never a territory", () => {
  const m = mission();
  const j = forJson(m.dir, "code/src/core/domain/new-file.ts");
  assert.deepEqual(j.citedByMission.citations, []);
  assert.ok(j.citedByMission.manifestsRead > 0, "the manifests were read: the empty list is an answer");
  assert.doesNotMatch(forText(m.dir, "code/src/core/domain/new-file.ts"), /Already cited as evidence/);
  m.drop();
});

test("ADR-0077: a proposed row is named, never listed as the mission's declaration", () => {
  const m = mission();
  const floor = join(m.mission, "floor.md");
  writeFileSync(floor, readFileSync(floor, "utf8").replace(/\| hexa-move-deterministic-out \| applied \|/, "| hexa-move-deterministic-out | proposed:applied |"));
  const j = forJson(m.dir, GUARD);
  assert.ok(!j.citedByMission.citations.some((x) => x.rule === "hexa-move-deterministic-out"));
  assert.deepEqual(j.citedByMission.proposedSkipped.map((x) => x.rule), ["hexa-move-deterministic-out"]);
  m.drop();
});

test("ADR-0077: a manifest the gate refuses to read is a named fault, not a blind zero", () => {
  const m = mission();
  const floor = join(m.mission, "floor.md");
  writeFileSync(floor, "## Rule conformance\n\n| rule | status | evidence |\n|---|---|---|\n\n" + readFileSync(floor, "utf8"));
  const j = forJson(m.dir, GUARD);
  assert.ok(!j.citedByMission.citations.some((x) => x.via.file === "runward/floor.md"));
  assert.equal(j.citedByMission.couldNotRead.length, 1);
  assert.equal(j.citedByMission.couldNotRead[0].carrier, "runward/floor.md");
  m.drop();
});

test("ADR-0077: readManifest carries lines beside the rows, never on them", () => {
  const md = "# x\n\n## Rule conformance\n\n| rule | status | evidence |\n|---|---|---|\n| a | applied | file:x.ts |\n\n| b | n/a | reason |\n";
  const { rows, lines } = readManifest(md);
  assert.deepEqual(lines, [7, 9]);
  // Rows are spread into the compliance payload: their shape is a machine surface (ADR-0024).
  assert.deepEqual(rows.map((r) => Object.keys(r)), [["rule", "status", "evidence"], ["rule", "status", "evidence"]]);
});
