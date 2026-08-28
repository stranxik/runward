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
