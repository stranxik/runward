// What runward counts as "still the file it scaffolded" (RWD-2026-0142 in `propose`, RWD-2026-0144
// in the gate): one map, `scaffoldedProjectHashes`, that both read to refuse runward's own template
// as a project's evidence.
//
// Found by the mutation measure of 2026-09-28 (release 0.42.3): every source of that map survived
// the unit suite. The gate's refusal was tested through `check --strict` in a child process, where
// no mutant is active, so the skills and tool profiles could leave the map, or be keyed by an
// absolute path nobody cites, and every template became evidence again. Pinned here, source by
// source: the charter template, every baseline skill, every tool profile, and the lock's record of
// what `init` wrote, keyed project-relative, with the three mission-relative directories left out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldedProjectHashes, hashText } from "../../dist/lib/scaffold-lock.js";
import { baselineSkills, TOOL_PROFILES } from "../../dist/lib/tools.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const posix = (p) => p.split("\\").join("/");

function project(lockFiles) {
  const root = mkdtempSync(join(tmpdir(), "rw-scaffolded-"));
  mkdirSync(join(root, "runward"));
  if (lockFiles) writeFileSync(join(root, "runward", "scaffold-lock.json"), JSON.stringify({ version: 1, writtenBy: "t", files: lockFiles }));
  return root;
}

test("the charter template, every baseline skill and every tool profile are in the map, keyed project-relative", () => {
  const root = project();
  try {
    const map = scaffoldedProjectHashes(root, join(root, "runward"));
    assert.ok(map.get("AGENTS.md")?.has(hashText(readFileSync(join(ROOT, "templates", "targets", "AGENTS.md"), "utf8"))),
      "the blank charter init writes");
    const expected = [...baselineSkills(root), ...TOOL_PROFILES.flatMap((p) => p.files(root))];
    assert.ok(baselineSkills(root).length > 0 && expected.length > baselineSkills(root).length, "both sources are non-empty");
    for (const f of expected) {
      const key = posix(relative(root, f.path));
      assert.ok(map.get(key)?.has(hashText(f.content)), `${key} is runward's own words`);
    }
    for (const key of map.keys()) assert.ok(!key.startsWith("/") && !key.startsWith(".."), `${key} is project-relative`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the lock's record joins the map, except the mission-relative workflows, rules and adapters", () => {
  const root = project({
    "AGENTS.md": "h-older-charter",
    "docs/rules/local.md": "h-docs-rules",
    "workflows/cadrer.md": "h-workflow",
    "rules/some-rule.md": "h-rule",
    "adapters/x.md": "h-adapter",
  });
  try {
    const map = scaffoldedProjectHashes(root, join(root, "runward"));
    assert.ok(map.get("AGENTS.md").has("h-older-charter"), "an older release's charter is still runward's words");
    assert.ok(map.get("AGENTS.md").size >= 2, "beside the installed template, not instead of it");
    assert.ok(map.get("docs/rules/local.md")?.has("h-docs-rules"), "only a key STARTING with rules/ is mission-relative");
    for (const k of ["workflows/cadrer.md", "rules/some-rule.md", "adapters/x.md"]) {
      assert.equal(map.has(k), false, `${k} names a file under runward/, not the project`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
