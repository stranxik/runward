// RWD-2026-0121: the security scan's spawn claim, with its positive control.
//
// `security/detect-child-process` was cited as the proof that no file spawns a process outside the
// crossings ADR-0054 names, and it read 0. It only sees `require("child_process")`; every file in src/
// is ESM and imports `node:child_process`, so hooks.ts and characterize.ts passed it silently. A zero
// from an instrument that was never shown the thing it is supposed to catch does not distinguish
// "nothing" from "blind". So this test SHOWS it: an ESM import planted in a temporary src/lib must be
// refused by the committed config, and the same import in an allowed file must pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";
import { sarifRuleResult } from "../../dist/lib/tool-adapters.js";

const ROOT = join(import.meta.dirname, "..", "..");
const CONFIG = join(ROOT, "eslint.security.config.js");
const SPAWN_RULES = ["no-restricted-imports", "no-restricted-syntax"];

async function lintTree(files) {
  // realpath: on macOS the temporary directory is a /var -> /private/var link, and a config whose
  // `files` globs are matched against the wrong spelling would ignore the probe and read clean.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "runward-spawn-control-")));
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), body);
    }
    const eslint = new ESLint({ cwd: dir, overrideConfigFile: CONFIG });
    const results = await eslint.lintFiles(["src"]);
    const out = {};
    for (const r of results) {
      out[relative(dir, r.filePath).split("\\").join("/")] = r.messages.filter((m) => SPAWN_RULES.includes(m.ruleId)).map((m) => m.ruleId);
    }
    return out;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("RWD-2026-0121: the scan refuses an ESM child_process import outside the named crossings", async () => {
  const found = await lintTree({
    "src/lib/probe.ts": 'import { execSync } from "node:child_process";\nexport const run = () => execSync("true");\n',
    "src/lib/probe-bare.ts": 'import { spawn } from "child_process";\nexport const run = spawn;\n',
    "src/lib/probe-dynamic.ts": 'export const load = () => import("node:child_process");\n',
    "src/lib/hooks.ts": 'import { execSync } from "node:child_process";\nexport const run = () => execSync("true");\n',
  });
  assert.deepEqual(found["src/lib/probe.ts"], ["no-restricted-imports"], "the ESM spelling every file in src/ uses must be seen");
  assert.deepEqual(found["src/lib/probe-bare.ts"], ["no-restricted-imports"]);
  assert.deepEqual(found["src/lib/probe-dynamic.ts"], ["no-restricted-syntax"]);
  // The other half: an allowed crossing passes, or the rule would be switched off the first time it
  // cried on a file ADR-0054 already accepted.
  assert.deepEqual(found["src/lib/hooks.ts"], [], "an allowed crossing must pass");
});

test("RWD-2026-0121: the allowance names exactly the files that spawn, and the committed scan holds the claim", async () => {
  const { SPAWN_ALLOWED } = await import(pathToFileURL(CONFIG).href);
  const importers = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".ts") && /from\s+["'](node:)?child_process["']/.test(readFileSync(p, "utf8"))) {
        importers.push(relative(ROOT, p).split("\\").join("/"));
      }
    }
  };
  walk(join(ROOT, "src"));
  // A dead allowance is a hole waiting for a file; a new importer is a decision nobody took.
  assert.deepEqual(importers.sort(), [...SPAWN_ALLOWED].sort());
  const scan = readFileSync(join(ROOT, "reports", "eslint-security.sarif"), "utf8");
  for (const rule of SPAWN_RULES) assert.equal(sarifRuleResult(scan, rule), "clean", `${rule} is active in the committed scan and finds nothing`);
});
