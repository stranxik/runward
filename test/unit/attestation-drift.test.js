// The nets the attestation campaign named (PR #192). Every post-attestation drift fixture in the
// existing tests touches a TOP-LEVEL file of runward/, where the rel-key mutant (`${prefix}/${e.name}`
// emptied) leaves the key intact — so a digest INSENSITIVE to any change under adr/, contracts/ or
// governance/ survived the whole net: attest, alter a contract, verify said "verified". These
// fixtures drift subdirectories, pin the shipped symlink policy, and pin one golden digest of a
// fixed synthetic tree — the sole mechanised witness of the cross-version digest contract that
// verify.js promises ("same tree, same digest, whatever build computes it").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, renameSync, unlinkSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { missionStateDigest } from "../../dist/lib/attestation.js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dirname2 = () => dirname(fileURLToPath(import.meta.url));

function tree() {
  const root = mkdtempSync(join(tmpdir(), "rw-digest-"));
  const m = join(root, "runward");
  for (const d of ["adr", "contracts", "governance"]) mkdirSync(join(m, d), { recursive: true });
  writeFileSync(join(m, "framing.md"), "# Framing\n\nA fixed framing note for the digest golden.\n");
  // "contracts.md" beside the "contracts/" DIRECTORY is deliberate: "." sorts before "/", so the
  // walk's insertion order (contracts/port.md before contracts.md) differs from the canonical
  // sorted order — the one pair that makes the canonicalisation sort load-bearing. Without it a
  // sorted directory walk emits keys already in order and the sort mutant is invisible.
  writeFileSync(join(m, "contracts.md"), "# Contracts index\n\nA fixed index beside the directory.\n");
  writeFileSync(join(m, "adr", "ADR-0001-fixed.md"), "# Fixed decision\n\n**Status**: accepted\n\nA body long enough to be a decision.\n");
  writeFileSync(join(m, "contracts", "port.md"), "# Port contract\n\nA fixed port contract body.\n");
  writeFileSync(join(m, "governance", "threat-model.md"), "# Threat model\n\nA fixed threat model body.\n");
  return { root, m, digest: () => missionStateDigest(root, m), drop: () => rmSync(root, { recursive: true, force: true }) };
}

// Regenerate deliberately if the digest ALGORITHM changes — that is a cross-version breaking
// change of the verify contract and deserves the diff this constant forces.
const GOLDEN = "50f4cf4de17a26bf8afca4a9dd6ad2b979d659e965f60ec95bb984026ba75a04";

test("the digest of a fixed tree is the pinned constant — the cross-version contract, mechanised", () => {
  const t = tree();
  try { assert.equal(t.digest(), GOLDEN); } finally { t.drop(); }
});

test("the digest sees every change under a subdirectory", () => {
  const base = (() => { const t = tree(); try { return t.digest(); } finally { t.drop(); } })();
  const cases = [
    ["an altered byte in contracts/", (m) => writeFileSync(join(m, "contracts", "port.md"), "# Port contract\n\nA fixed port contract body!\n")],
    ["a file added in adr/", (m) => writeFileSync(join(m, "adr", "ADR-0002-added.md"), "# Added\n\n**Status**: accepted\n\nAnother real decision body.\n")],
    ["a file removed from adr/", (m) => unlinkSync(join(m, "adr", "ADR-0001-fixed.md"))],
    ["a renamed contract", (m) => renameSync(join(m, "contracts", "port.md"), join(m, "contracts", "port2.md"))],
    ["two subdir files swapping contents", (m) => {
      const a = join(m, "contracts", "port.md"), b = join(m, "governance", "threat-model.md");
      const ca = readFileSync(a), cb = readFileSync(b); writeFileSync(a, cb); writeFileSync(b, ca);
    }],
  ];
  for (const [name, mutate] of cases) {
    const u = tree();
    try {
      mutate(u.m);
      assert.notEqual(u.digest(), base,
        `${name}: the digest did not move — the seal that does not seal (the rel-key mutant class)`);
    } finally { u.drop(); }
  }
});

test("a symlink under runward/ is NOT sealed — the shipped policy, pinned", () => {
  const t = tree();
  try {
    const base = t.digest();
    writeFileSync(join(t.root, "note-target.txt"), "outside the mission\n");
    symlinkSync(join(t.root, "note-target.txt"), join(t.m, "ghost.md"));
    assert.equal(t.digest(), base,
      "a symlink entered the digest — the non-regular-file policy of the tree walk changed");
  } finally { t.drop(); }
});

// The four VSA/bundle holes of the same campaign: the emitted envelopes lose their verifier
// version, their gate-non-scope caveat, the name of the verified gate, or the bundle's predicate
// body — and every existing assertion stops one field short.
test("the VSA and bundle envelopes carry what their consumers are promised", async () => {
  const { execFileSync } = await import("node:child_process");
  const { cpSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ROOT = join(dirname2(), "..", "..");
  const CLI = join(ROOT, "dist", "cli.js");
  const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_NOW: "2026-01-01" };
  const parent = mkdtempSync(join(tmpdir(), "rw-vsa-"));
  try {
    const dir = join(parent, "m");
    cpSync(join(ROOT, "examples", "request-triage"), dir, { recursive: true });
    const run = (args) => execFileSync("node", [CLI, ...args], { cwd: dir, encoding: "utf8", env: ENV });
    const vsa = JSON.parse(run(["check", "--strict", "--vsa", "--resource-uri", "pkg:npm/demo@1"]));
    assert.ok(vsa.predicate.verifier.version?.runward,
      "the VSA names the verifier's runward version — the consumer replays the verification with it");
    assert.ok(vsa.predicate.policy.annotations?.["runward.dev/gate-non-scope"],
      "the gate-non-scope caveat rides the VSA — the envelope built for the consumer who reads nothing else");
    const through = JSON.parse(run(["check", "--through", "floor", "--vsa", "--resource-uri", "pkg:npm/demo@1"]));
    assert.match(through.predicate.verifiedLevels[0], /PRESENCE_THROUGH_FLOOR/,
      "the level names WHICH gate was verified — a Kyverno/OPA rule is written on these strings");
    const bundle = JSON.parse(run(["bundle", "runward/framing.md", "runward/floor.md"]));
    for (const field of ["runward", "mission", "artifacts", "gateNonScope"]) {
      assert.ok(bundle.predicate[field] !== undefined && bundle.predicate[field] !== "",
        `the bundle predicate carries ${field} — the emptied-predicate mutant shipped {}`);
    }
    assert.equal(bundle.predicate.artifacts, 2);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
