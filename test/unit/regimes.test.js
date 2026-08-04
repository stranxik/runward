// Unit tests for the regime-mapping loader (ADR-0022): version listing, default = highest,
// explicit pin, unknown version rejection, determinism, and the shape of the shipped files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listRegimeVersions, loadRegime, regimeLensId, REGIMES_DIR } from "../../dist/lib/regimes.js";

const SHIPPED = [
  ["iso-42001", "2023"],
  ["nist-ai-rmf", "1.0"],
  ["eu-ai-act", "2026-1744"],
];

test("shipped regimes: every regime loads with the expected default version and required keys", () => {
  for (const [regime, version] of SHIPPED) {
    const m = loadRegime(regime);
    assert.equal(m.regime, regime);
    assert.equal(m.version, version);
    assert.ok(m.label.length > 0);
    assert.ok(m.notes.length > 0);
    assert.ok(m.disclaimerTail.length > 0);
    assert.ok(Array.isArray(m.operatorRequired) && m.operatorRequired.length > 0);
    assert.equal(regimeLensId(m), `${regime}@${version}`);
  }
});

test("shipped regimes: no stray file escapes the <regime>@<version>.json contract", () => {
  const known = new Set(SHIPPED.map(([r]) => r));
  for (const f of readdirSync(REGIMES_DIR)) {
    const m = f.match(/^(.+)@(.+)\.json$/);
    assert.ok(m, `unexpected file in regimes/: ${f}`);
    assert.ok(known.has(m[1]), `regime file for an unregistered regime: ${f}`);
  }
});

test("loadRegime: explicit version pins, unknown version throws listing shipped versions", () => {
  const m = loadRegime("iso-42001", "2023");
  assert.equal(m.version, "2023");
  assert.throws(() => loadRegime("iso-42001", "1999"), /Unknown iso-42001 mapping version "1999"\. Shipped versions: 2023\./);
  assert.throws(() => loadRegime("no-such-regime"), /No shipped mapping data/);
});

test("loadRegime: default picks the lexicographically highest version (documented sort)", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-regimes-"));
  try {
    for (const v of ["2023", "2024-01", "2019"]) {
      writeFileSync(join(dir, `fake@${v}.json`), JSON.stringify({ regime: "fake", label: "Fake", version: v, notes: "n", disclaimerTail: "d", operatorRequired: ["x"] }));
    }
    assert.deepEqual(listRegimeVersions("fake", dir), ["2019", "2023", "2024-01"]);
    assert.equal(loadRegime("fake", undefined, dir).version, "2024-01");
    assert.equal(loadRegime("fake", "2019", dir).version, "2019");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadRegime: two identical loads are deeply equal (deterministic data, no ambient state)", () => {
  for (const [regime] of SHIPPED) {
    assert.deepEqual(loadRegime(regime), loadRegime(regime));
  }
});
