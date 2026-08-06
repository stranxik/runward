// Guards the distribution packagings (ADR-0028): every shipped manifest's version must equal the
// package version, and every hook must carry the same one-line gate. A drifted stamp (0.17.0 left
// on a 0.18.0 release) would ship the flagship feature mislabelled — this catches it in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

// The files expected to carry a product-version stamp. This is the INVENTORY, not the check:
// the check below finds stamps by sweeping, so a new packaging cannot go unverified by being
// forgotten here. Its job is to make a *disappearance* fail too — a manifest silently dropped
// from a release is as wrong as one left behind.
const VERSIONED = [
  ".claude-plugin/marketplace.json",
  "plugins/runward-gate/.claude-plugin/plugin.json",
  "packaging/gemini/gemini-extension.json",
  "packaging/codex/.codex-plugin/plugin.json",
  "packaging/cursor/.cursor-plugin/plugin.json",
  "packaging/mcp/server.json",
];
const STAMP_ROOTS = ["packaging", "plugins", ".claude-plugin"];
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Every `"version": "x.y.z"` under the packaging roots, wherever it is nested.
 *  Swept rather than listed: a hand-kept list of what to verify is a list that can be
 *  incomplete without failing — the defect this corpus refuses everywhere else. A host's own
 *  schema version (kiro's `"v1"`, copilot's `1`) is not a semver and stays out of scope by
 *  shape, not by an exception someone must remember to maintain. */
function versionStamps() {
  const out = [];
  const visit = (node, path, rel) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "version" && typeof v === "string" && SEMVER.test(v)) out.push({ rel, at: `${path}${k}`, value: v });
      else visit(v, `${path}${k}.`, rel);
    }
  };
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const abs = join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (e.name.endsWith(".json")) visit(JSON.parse(readFileSync(abs, "utf8")), "", r); // throws on invalid JSON
    }
  };
  for (const root of STAMP_ROOTS) walk(join(ROOT, root), root);
  return out;
}

test("every distribution manifest is valid JSON and stamped with the current version", () => {
  const stamps = versionStamps();
  assert.ok(stamps.length >= VERSIONED.length, `found ${stamps.length} version stamp(s)`);
  // Report ALL stale stamps at once. Failing on the first one turns a release bump into a
  // guess-and-retry loop, and the test already knows the whole answer — the same defect as a
  // diagnostic that is correct and unreachable.
  const stale = stamps.filter((s) => s.value !== VERSION);
  assert.equal(stale.length, 0,
    `${stale.length} stamp(s) not at package version ${VERSION} — bump ALL of them:\n` +
    stale.map((s) => `    ${s.rel} (${s.at} = ${s.value})`).join("\n"));
});

test("the set of version-stamped manifests is exactly the declared inventory", () => {
  // Two failures in one assertion, both real: a NEW packaging that carries a product version
  // and was never added here would otherwise ship correct-by-luck, and a manifest DROPPED from
  // the tree would pass unnoticed. `marketplace.json` carries two stamps in one file
  // (`metadata.version` and `plugins[].version`) — the previous check read only the first.
  const found = [...new Set(versionStamps().map((s) => s.rel))].sort();
  assert.deepEqual(found, [...VERSIONED].sort(),
    "a manifest carries a product version without being declared here (or a declared one vanished)");
  for (const rel of VERSIONED) assert.ok(existsSync(join(ROOT, rel)), `${rel} exists`);
});

test("ROADMAP.md is groomed at the current version (stale-roadmap guard)", () => {
  // ROADMAP.md rotted silently from v0.14.2 to v0.21.0 — long-shipped items still listed as
  // ahead — because it was the one versioned surface outside every guard. Same discipline as
  // the manifest stamps: bumping the package version now requires re-grooming the roadmap
  // (re-read it, then update the stamp).
  const roadmap = readFileSync(join(ROOT, "ROADMAP.md"), "utf8");
  const m = roadmap.match(/Last groomed: \d{4}-\d{2}-\d{2} \(v(\d+\.\d+\.\d+)\)/);
  assert.ok(m, "ROADMAP.md carries a 'Last groomed: YYYY-MM-DD (vX.Y.Z)' stamp");
  assert.equal(m[1], VERSION,
    `ROADMAP.md groomed at v${m[1]} but package is v${VERSION} — re-read the roadmap (prune what shipped) and update the stamp`);
});

test("every packaging hook carries the same one-line gate (runward check --strict)", () => {
  // Walk packaging/ + plugins/ for hook files and assert each command runs the gate.
  const hookFiles = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/hook/i.test(e.name) && f.endsWith(".json") || e.name.endsWith(".kiro.hook")) hookFiles.push(f);
  } };
  walk(join(ROOT, "packaging"));
  walk(join(ROOT, "plugins"));
  assert.ok(hookFiles.length >= 5, `found ${hookFiles.length} hook files`);
  for (const f of hookFiles) {
    const raw = readFileSync(f, "utf8");
    JSON.parse(raw); // valid JSON
    assert.match(raw, /runward check --strict/, `${f} runs the gate`);
  }
});
