// `characterize` says what it did and points at what exists (the 2026-10-13 newcomer measurement).
//
// Three findings on an ungoverned Node service: "Entrypoints 0" while package.json declared
// `"start": "node src/server.js"`; next steps naming runward/workflows/brownfield.md, which only
// `init` writes; and a tutorial sentence saying characterize drafts decision records, which it does
// only with --mine. Each is held here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInventory, startScriptFile } from "../../dist/lib/characterize.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

function service() {
  const root = mkdtempSync(join(tmpdir(), "rw-char-onb-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "server.js"), "export const x = 1;\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "svc", scripts: { start: "node src/server.js", test: "node --test" } }));
  return root;
}

test("startScriptFile reads the file a start script runs, and nothing it cannot name", () => {
  assert.equal(startScriptFile("node src/server.js"), "src/server.js");
  assert.equal(startScriptFile("node --env-file=.env ./dist/main.mjs"), "dist/main.mjs");
  assert.equal(startScriptFile("tsx watch src/index.ts && echo done"), "src/index.ts");
  assert.equal(startScriptFile("NODE_ENV=production node server.cjs"), "server.cjs");
  assert.equal(startScriptFile("next start"), null);
  assert.equal(startScriptFile("npm run serve"), null);
});

test("a scripts.start entry point is inventoried when its file exists, and only then", () => {
  const root = service();
  try {
    assert.deepEqual(buildInventory(root).entrypoints, ["src/server.js"]);
    rmSync(join(root, "src", "server.js"));
    assert.deepEqual(buildInventory(root).entrypoints, [], "a start script naming an absent file is no entry point");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("next steps on an ungoverned repo: no DRAFT claimed without --mine, init named before the workflow and check", () => {
  const root = service();
  try {
    const r = spawnSync("node", [CLI, "characterize"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    assert.equal(r.status, 0);
    assert.ok(!existsSync(join(root, "runward", "adr")), "without --mine nothing is drafted");
    const next = r.stdout.slice(r.stdout.indexOf("Next steps"));
    assert.match(next, /No decision record was drafted\. runward characterize --mine/);
    assert.match(next, /runward init .*scaffolds the mission/);
    assert.match(next, /brownfield\.md, written by init/, "the workflow path is said to come from init, since it does not exist yet");
    assert.ok(next.indexOf("runward init") < next.indexOf("brownfield.md"), "init comes before the workflow it writes");
    const md = readFileSync(join(root, "runward", "characterization.md"), "utf8");
    assert.match(md, /No decision record is drafted by default/);
    assert.match(md, /`runward init`[^\n]*`runward\/workflows\/brownfield\.md`/);
    assert.match(md, /\n- `src\/server\.js`\n/, "the start script's file is listed under Entrypoints");
    // Positive control on the claim it replaced: the same run with --mine does draft.
    spawnSync("git", ["init", "-q"], { cwd: root });
    const m = spawnSync("node", [CLI, "characterize", "--mine"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    assert.equal(m.status, 0);
    assert.doesNotMatch(m.stdout, /No decision record was drafted/, "--mine never prints the no-draft step");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
