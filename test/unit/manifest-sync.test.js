// Unit tests for manifest --sync (ADR-0023): form scaffolded, content never touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncManifest } from "../../dist/lib/manifest-sync.js";
import { parseManifest } from "../../dist/lib/conformance.js";

// A mission with its own rules dir pins the expected set — no dependency on the shipped rules.
function scaffold(rules) {
  const root = mkdtempSync(join(tmpdir(), "runward-sync-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "rules"), { recursive: true });
  for (const [slug, phases] of Object.entries(rules)) {
    writeFileSync(join(mission, "rules", `${slug}.md`), `---\ntitle: ${slug}\nimpact: CRITICAL\nphases: [${phases}]\n---\n\nBody.\n`);
  }
  return { root, mission };
}

test("sync scaffolds missing rows with empty status and retires the template placeholder", () => {
  const { root, mission } = scaffold({ "r-one": "floor", "r-two": "floor" });
  try {
    writeFileSync(join(mission, "floor.md"),
      "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| [rule-slug] | applied \\| deviated \\| n/a | [pointer] |\n");
    const r = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.deepEqual(r.added, ["r-one", "r-two"]);
    assert.ok(r.content.includes("| r-one |  |  |"));
    assert.ok(!r.content.includes("[rule-slug]"));
    // scaffolded rows parse with an empty status — the gate refuses them until the operator decides
    const rows = parseManifest(r.content);
    assert.equal(rows.find((x) => x.rule === "r-one").status, "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("sync creates a missing section, is idempotent, and never invents content", () => {
  const { root, mission } = scaffold({ "r-one": "floor" });
  try {
    const path = join(mission, "floor.md");
    writeFileSync(path, "# Floor\n\nSome prose, no manifest.\n");
    const first = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.equal(first.sectionCreated, true);
    assert.deepEqual(first.added, ["r-one"]);
    writeFileSync(path, first.content);
    const second = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.equal(second.content, null); // nothing left to write
    assert.deepEqual(second.added, []);
    assert.ok(!first.content.includes("applied |")); // no status was invented anywhere
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("sync migrates a renamed slug in place, preserving status and evidence", () => {
  const { root, mission } = scaffold({ "hexa-move-deterministic-out": "floor" });
  try {
    writeFileSync(join(mission, "floor.md"),
      "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| hexa-llm-boundary-principle | applied | src/x.ts:1 |\n");
    const r = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.deepEqual(r.migrated, [{ from: "hexa-llm-boundary-principle", to: "hexa-move-deterministic-out" }]);
    assert.ok(r.content.includes("| hexa-move-deterministic-out | applied | src/x.ts:1 |"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("sync reports duplicates and unknown slugs, deletes nothing", () => {
  const { root, mission } = scaffold({ "r-one": "floor" });
  try {
    const body = "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| r-one | applied | a.ts note |\n| r-one | n/a | duplicate row kept |\n| r-typo | applied | b.ts note |\n";
    writeFileSync(join(mission, "floor.md"), body);
    const r = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.match(r.duplicates.join(" "), /r-one/);
    assert.deepEqual(r.unknown, ["r-typo"]);
    assert.equal(r.content, null); // reports only — the operator edits
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a missing deliverable is reported, never created", () => {
  const { root, mission } = scaffold({ "r-one": "floor" });
  try {
    const r = syncManifest(mission, "floor", "floor.md", "Floor");
    assert.equal(r.fileMissing, true);
    assert.equal(r.content, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
