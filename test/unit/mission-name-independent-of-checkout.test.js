// RWD-2026-0186 / ADR-0109: the name a machine surface gives the mission comes from what the mission
// DECLARES (the title of runward/mission-contract.md), never from the checkout folder.
//
// Measured on 2026-10-28 at 20b56d2: `check --strict --attest`, `--vsa` (under SOURCE_DATE_EPOCH) and
// the bundle predicate were byte-identical across macOS and Linux only when the two checkouts had the
// same folder name. With `demo-mac/` and `w/`, the attestation differed in `subject[].name` and
// `predicate.mission`, and the VSA in `subject[].name`. The folder name is not part of the tree, so
// this broke ADR-0054 ("same working tree ⇒ same verdict and same machine outputs").
//
// The two-folder control below was RED on 20b56d2 (digests differed) and is GREEN after the fix.
// The positive control at the end shows the name is really read from the declaration: changing the
// contract's title changes the attestation where the folder name no longer can.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { declaredMissionName, UNDECLARED_MISSION_NAME } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const sha = (s) => createHash("sha256").update(s).digest("hex");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-name-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

/** Two copies of the SAME tree under two folder names that share nothing. */
function twoFolders() {
  const parent = mkdtempSync(join(tmpdir(), "rw-name-"));
  const a = join(parent, "demo-mac");
  const b = join(parent, "w");
  cpSync(REFERENCE, a, { recursive: true });
  cpSync(REFERENCE, b, { recursive: true });
  return { a, b, drop: () => rmSync(parent, { recursive: true, force: true }) };
}

// Stdout is the whole emission whatever the exit code; the clock is pinned so the VSA can be compared.
function run(cwd, args) {
  const env = { ...process.env, NO_COLOR: "1", SOURCE_DATE_EPOCH: "1761600000", RUNWARD_NOW: "2026-10-28" };
  try { return execFileSync(process.execPath, [CLI, ...args, "-p", "."], { cwd, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return e.stdout; }
}

test("RWD-2026-0186: check --strict --attest is byte-identical across two checkout folder names", () => {
  const f = twoFolders();
  try {
    const a = run(f.a, ["check", "--strict", "--attest"]);
    const b = run(f.b, ["check", "--strict", "--attest"]);
    assert.equal(sha(a), sha(b), `the attestation depends on the checkout folder name:\n${a}\n---\n${b}`);
    const s = JSON.parse(a);
    assert.equal(s.subject[0].name, "Inbound Request Triage", "the subject names what the contract declares");
    assert.equal(s.predicate.mission, "Inbound Request Triage", "the predicate names what the contract declares");
  } finally { f.drop(); }
});

test("RWD-2026-0186: check --strict --vsa under SOURCE_DATE_EPOCH is byte-identical across two checkout folder names", () => {
  const f = twoFolders();
  try {
    const args = ["check", "--strict", "--vsa", "--resource-uri", "pkg:npm/runward@0.46.0"];
    const a = run(f.a, args);
    const b = run(f.b, args);
    assert.equal(sha(a), sha(b), "the VSA depends on the checkout folder name");
    assert.equal(JSON.parse(a).subject[0].name, "Inbound Request Triage");
  } finally { f.drop(); }
});

test("RWD-2026-0186: check --strict --json differs across folders ONLY in `mission`, the documented project root", () => {
  const f = twoFolders();
  try {
    const a = JSON.parse(run(f.a, ["check", "--strict", "--json"]));
    const b = JSON.parse(run(f.b, ["check", "--strict", "--json"]));
    // docs/interop.md: `mission` is the project root, an absolute path, on purpose — the local
    // payload says where it ran. It is the one field that may differ.
    // (The real path: macOS resolves /var to /private/var, so the tail is what is compared.)
    assert.ok(a.mission.endsWith("/demo-mac"), a.mission);
    assert.ok(b.mission.endsWith("/w"), b.mission);
    delete a.mission; delete b.mission;
    assert.deepEqual(a, b, "a field other than `mission` carries the checkout folder");
  } finally { f.drop(); }
});

test("RWD-2026-0186: the bundle predicate and the OSCAL pack name the declared mission, not the folder", () => {
  const f = twoFolders();
  try {
    for (const dir of [f.a, f.b]) {
      writeFileSync(join(dir, "artifact.txt"), "the same bytes\n");
      const bundle = JSON.parse(run(dir, ["bundle", "artifact.txt"]));
      assert.equal(bundle.predicate.mission, "Inbound Request Triage");
      run(dir, ["compliance", "iso-42001"]);
    }
    const oscal = (dir) => readFileSync(join(dir, "runward", "compliance", "oscal-component-definition.json"), "utf8");
    assert.equal(sha(oscal(f.a)), sha(oscal(f.b)), "the OSCAL pack (UUID seeds, component title) depends on the folder name");
    const doc = JSON.parse(oscal(f.a));
    assert.equal(doc["component-definition"].components[0].title, "Inbound Request Triage");
  } finally { f.drop(); }
});

test("positive control: a different declared title changes the attestation where the folder name no longer can", () => {
  const f = twoFolders();
  try {
    const contract = join(f.b, "runward", "mission-contract.md");
    writeFileSync(contract, readFileSync(contract, "utf8").replace("# Mission Contract: Inbound Request Triage", "# Mission Contract: Renamed Triage"));
    const a = JSON.parse(run(f.a, ["check", "--strict", "--attest"]));
    const b = JSON.parse(run(f.b, ["check", "--strict", "--attest"]));
    assert.equal(b.subject[0].name, "Renamed Triage");
    assert.equal(b.predicate.mission, "Renamed Triage");
    assert.notEqual(a.subject[0].digest.sha256, b.subject[0].digest.sha256, "the contract is in the tree, so the digest moves too");
  } finally { f.drop(); }
});

test("declaredMissionName: the contract's title, or the undeclared name — never a folder name or a path", () => {
  const parent = mkdtempSync(join(tmpdir(), "rw-name-unit-"));
  try {
    const mission = join(parent, "some-folder-name", "runward");
    mkdirSync(mission, { recursive: true });
    const name = () => declaredMissionName(mission);
    const contract = (text) => writeFileSync(join(mission, "mission-contract.md"), text);
    assert.equal(name(), UNDECLARED_MISSION_NAME, "no contract at all");
    contract("# Mission Contract: [system or mission name]\n\nscaffold\n");
    assert.equal(name(), UNDECLARED_MISSION_NAME, "the scaffold's placeholder is not a name");
    contract("# Mission Contract:\n");
    assert.equal(name(), UNDECLARED_MISSION_NAME, "an empty title is not a name");
    contract("# Something else\n");
    assert.equal(name(), UNDECLARED_MISSION_NAME, "no contract heading");
    contract("# Mission Contract:   Inbound   Request Triage  \n\n## Principle\n");
    assert.equal(name(), "Inbound Request Triage", "trimmed, inner runs of white space collapsed");
    contract("Preamble line\n# Mission Contract: Later heading\n");
    assert.equal(name(), "Later heading", "the heading need not be the first line");
    contract("# Mission Contract: a triage bot [for inbound requests]\n");
    assert.equal(name(), "a triage bot [for inbound requests]", "a bracket inside a real title is kept; only a whole-bracket title is the placeholder");
    for (const v of [UNDECLARED_MISSION_NAME, "Inbound Request Triage"]) {
      assert.ok(!v.includes("some-folder-name") && !v.includes(parent), "neither the folder name nor a path ever leaks");
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test.after(() => rmSync(REFERENCE, { recursive: true, force: true }));
