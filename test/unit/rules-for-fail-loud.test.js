// Wave A obj 2: `rules --for --json` refuses rather than guesses.
//
// The machine surface a fleet orchestrator drives on must earn the verdict's fail-loud integrity. A
// territory carrier that could not be read (a derivation adapter hitting a construct it does not
// model, a territory map runward could not parse, a map row it refused) must be visible in ONE
// top-level field — `couldNotRead` — so a consumer knows the matched list may be short and does not
// treat a plausible answer as exhaustive. Before this the signal was scattered across
// derivation.notes / map.structural / map.problems and left to the consumer to reassemble, which is
// exactly the plausible-but-wrong answer this surface exists to refuse. Both directions are pinned:
// a clean read reports an EMPTY list, a faulted read a non-empty one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-forfl-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-forfl-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}
function forJson(cwd) {
  return JSON.parse(execFileSync(process.execPath, [CLI, "rules", "--for", "src/x.ts", "--json", "-p", "."], { cwd, encoding: "utf8" }));
}

test("obj 2: a clean read reports couldNotRead: [] — the matched list is exhaustive", () => {
  const m = mission();
  const j = forJson(m.dir);
  assert.deepEqual(j.couldNotRead, [], "no territory map, no manifest: nothing failed to read");
  m.drop();
});

test("obj 2: a territory map with no table is surfaced as a read fault, not silently ignored", () => {
  const m = mission();
  writeFileSync(join(m.mission, "territory.md"), "some notes, but no Territory section at all\n");
  const j = forJson(m.dir);
  assert.equal(j.couldNotRead.length, 1, "the unreadable map is one fault");
  assert.equal(j.couldNotRead[0].source, "territory-map");
  assert.match(j.couldNotRead[0].detail, /Territory/, "and it names why the map was not read");
  m.drop();
});

test("obj 2: a refused map row is surfaced per line — the declaration had no effect and the run says so", () => {
  const m = mission();
  writeFileSync(join(m.mission, "territory.md"),
    "## Territory\n\n| pattern | category | effect | why |\n| --- | --- | --- | --- |\n| src/x.ts | not-a-category | declare | a deliberately bad row |\n");
  const j = forJson(m.dir);
  assert.ok(j.couldNotRead.length >= 1, "the refused row is a fault");
  assert.ok(j.couldNotRead.some((f) => /territory\.md:\d+/.test(f.carrier)), "and it names the row's line");
  m.drop();
});

test("obj 2: both directions on one mission — adding a fault flips couldNotRead from empty to non-empty", () => {
  const m = mission();
  assert.deepEqual(forJson(m.dir).couldNotRead, [], "green: clean read");
  writeFileSync(join(m.mission, "territory.md"), "no heading here\n");
  assert.ok(forJson(m.dir).couldNotRead.length > 0, "red: the same query now reports it could not read");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
