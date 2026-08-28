// Golden test: the three readiness markdowns are byte-identical to versioned fixtures, on TWO
// missions. The compliance mutation campaign measured why one golden was not enough: the OSCAL
// golden renders a FRESH mission (red gate, empty tables), so nothing walked `clean`,
// `implemented`, the filled governance lines or a single byte of the documents a regulated buyer
// reads — 191 renderer mutants survived, from deleted caveats ("not legal advice", the
// operator-required list) to the join separator that flattens a whole document onto one line
// while every substring assertion still passes. A byte fixture is the one net a substring
// cannot satisfy.
//
// Regenerate deliberately with UPDATE_GOLDEN=1 node --test test/unit/readiness-golden.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN_DIR = join(ROOT, "test", "fixtures", "golden");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };
const REGIMES = [
  ["iso-42001", "iso-42001-readiness.md"],
  ["nist-ai-rmf", "nist-ai-rmf-readiness.md"],
  ["eu-ai-act", "eu-ai-act-readiness.md"],
];

const run = (args, cwd) => execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] });

function check(missionRoot, prefix) {
  for (const [regime, file] of REGIMES) {
    run(["compliance", regime], missionRoot);
    const got = readFileSync(join(missionRoot, "runward", "compliance", file), "utf8");
    const fixture = join(GOLDEN_DIR, `${prefix}-${file}`);
    if (process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(fixture, got);
    } else {
      assert.equal(got, readFileSync(fixture, "utf8"),
        `${prefix}/${regime}: the readiness draft drifted from the golden fixture — inspect the ` +
        `diff, then regenerate deliberately with UPDATE_GOLDEN=1 if the change is intended`);
    }
  }
}

test("golden: a fresh mission's three readiness drafts, byte for byte", () => {
  const parent = mkdtempSync(join(tmpdir(), "runward-rgold-"));
  try {
    const missionRoot = join(parent, "golden-mission");
    mkdirSync(missionRoot);
    run(["--yes", "init"], missionRoot);
    check(missionRoot, "fresh");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("golden: the packaged reference mission's three readiness drafts — the side the fresh golden never sees", () => {
  const parent = mkdtempSync(join(tmpdir(), "runward-rgold-"));
  try {
    // The shipped example is the mission that DID the work: 36 manifest rows, ratified ADRs,
    // filled governance — the branches (counts, evidence pointers, `**filled**`, the ADR journal)
    // that stay unvisited on a fresh scaffold.
    const missionRoot = join(parent, "golden-mission");
    cpSync(join(ROOT, "examples", "request-triage"), missionRoot, { recursive: true });
    assert.ok(existsSync(join(missionRoot, "runward", "framing.md")), "the packaged example is a mission");
    check(missionRoot, "rich");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
