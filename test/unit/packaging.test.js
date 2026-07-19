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

// Manifests that declare a version and must track the package version.
const VERSIONED = [
  ".claude-plugin/marketplace.json",
  "plugins/runward-gate/.claude-plugin/plugin.json",
  "packaging/gemini/gemini-extension.json",
  "packaging/codex/.codex-plugin/plugin.json",
  "packaging/cursor/.cursor-plugin/plugin.json",
  "packaging/mcp/server.json",
];

test("every distribution manifest is valid JSON and stamped with the current version", () => {
  for (const rel of VERSIONED) {
    const p = join(ROOT, rel);
    assert.ok(existsSync(p), `${rel} exists`);
    const j = JSON.parse(readFileSync(p, "utf8")); // throws on invalid JSON
    const v = j.version ?? j.metadata?.version;
    assert.equal(v, VERSION, `${rel} version (${v}) must equal package version (${VERSION})`);
  }
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
