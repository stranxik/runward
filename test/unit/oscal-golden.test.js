// Golden test: the OSCAL export of a fresh mission is byte-identical to the versioned fixture.
// Regenerate deliberately with UPDATE_GOLDEN=1 node --test test/unit/oscal-golden.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "oscal-component-definition.json");

// RUNWARD_NOW pins the date, RUNWARD_YES + piped stdio pin the non-interactive path,
// and the constant basename "golden-mission" pins the UUID seeds and the component title.
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };

function run(args, cwd) {
  execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ENV });
}

test("golden: fresh init + compliance eu-ai-act reproduces the versioned OSCAL byte for byte", () => {
  const parent = mkdtempSync(join(tmpdir(), "runward-golden-"));
  try {
    const missionRoot = join(parent, "golden-mission");
    mkdirSync(missionRoot);
    run(["--yes", "init"], missionRoot);
    run(["compliance", "eu-ai-act"], missionRoot);
    const oscalPath = join(missionRoot, "runward", "compliance", "oscal-component-definition.json");
    const first = readFileSync(oscalPath, "utf8");

    if (process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(GOLDEN, first);
    } else {
      assert.equal(first, readFileSync(GOLDEN, "utf8"), "OSCAL output drifted from the golden fixture — inspect, then UPDATE_GOLDEN=1 if intended");
    }

    run(["compliance", "eu-ai-act"], missionRoot);
    const second = readFileSync(oscalPath, "utf8");
    assert.equal(second, first, "two successive compliance runs must be byte-identical");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
