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
  ["eu-ai-act", "2026-1744-r2"],
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

test("eu-ai-act: a revision of the same legal text sorts after it and becomes the default; the older lens stays pinnable (ADR-0101)", () => {
  // `-r<n>` appended to a version is the revision of a lens over the SAME text: a string sorts after
  // its own prefix, so it is the default without touching the sort. The older lens keeps its data
  // exactly: no `printNotes`, the previous operator-required list.
  const versions = listRegimeVersions("eu-ai-act");
  assert.deepEqual(versions, ["2024-1689", "2026-1744", "2026-1744-r2"]);
  const live = loadRegime("eu-ai-act");
  const pinned = loadRegime("eu-ai-act", "2026-1744");
  assert.equal(live.version, "2026-1744-r2");
  assert.equal(live.printNotes, true);
  assert.equal(pinned.printNotes, undefined);
  assert.equal(pinned.operatorRequired.length, 3);
  // the revision adds rows in front and keeps every row of the lens it revises, in order
  assert.deepEqual(live.operatorRequired.slice(-pinned.operatorRequired.length), pinned.operatorRequired);
  // same legal text: the Annex IV map, the high-risk dates and the source watch are carried over
  assert.deepEqual(live.annexIv, pinned.annexIv);
  assert.deepEqual(live.highRisk, pinned.highRisk);
  assert.deepEqual(live.source, pinned.source);
  assert.ok(live.notes.startsWith(pinned.notes), "the revision's notes extend the dated notes, they do not rewrite them");
});
