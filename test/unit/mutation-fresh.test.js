// ADR-0103: before a tag, the register must have been measured on the code the release packs.
//
// The ratchet that ADR-0059 says blocks a stale register starts on `release: published`, with the npm
// publish, and answers hours later: on 0.45.0 it signed `refused` after the release existed
// (RWD-2026-0183). scripts/mutation-fresh.mjs is the check that can run before the tag, in seconds:
// each module's built file against the digest of the source its filing was measured on
// (docs/compliance/mutation-measured-sources.json). These cases hold its four answers apart, and the
// positive control proves a one-character change in a built module is seen, in both directions.
//
// Every case runs the real scripts against a throwaway tree; none reads this repository's dist/, so
// the suite never reddens because a pull request changed a module (ADR-0046 decision 3: not a PR gate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FRESH = join(ROOT, "scripts", "mutation-fresh.mjs");
const RECORD_SOURCE = join(ROOT, "scripts", "mutation-record-source.mjs");
const RECORD = "docs/compliance/mutation-measured-sources.json";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const SOURCES = {
  alpha: "export function alpha() {\n  return 1;\n}\n",
  beta: "export function beta(x) {\n  return x > 0;\n}\n",
};

/** A throwaway tree: a perimeter, a build, and a record. `record` maps module -> entry or omits it. */
function tree({ record, build = SOURCES, dist = true, config = true }) {
  const root = mkdtempSync(join(tmpdir(), "rw-fresh-"));
  if (config) writeFileSync(join(root, "stryker.config.json"), JSON.stringify({ mutate: ["dist/lib/alpha.js", "dist/lib/beta.js:1-40"] }));
  if (dist) {
    mkdirSync(join(root, "dist", "lib"), { recursive: true });
    for (const [m, src] of Object.entries(build)) writeFileSync(join(root, "dist", "lib", `${m}.js`), src);
  }
  if (record !== undefined) {
    mkdirSync(join(root, "docs", "compliance"), { recursive: true });
    writeFileSync(join(root, RECORD), typeof record === "string" ? record : JSON.stringify({ modules: record }));
  }
  return root;
}
const measuredOn = (m, src = SOURCES[m]) => ({ module: m, sha256: sha(src), run: "123", measuredAt: "2026-10-28" });

function fresh(root) {
  const run = spawnSync(process.execPath, [FRESH], { cwd: root, encoding: "utf8" });
  return { code: run.status, out: `${run.stdout}${run.stderr}` };
}
const line = (out, m) => out.split("\n").find((l) => l.startsWith(`${m} `)) ?? "";

test("fresh: every built module is the source its filing was measured on, exit 0", () => {
  const root = tree({ record: [measuredOn("alpha"), measuredOn("beta")] });
  try {
    const { code, out } = fresh(root);
    assert.equal(code, 0, out);
    assert.match(line(out, "alpha"), /\bfresh\b/);
    assert.match(line(out, "beta"), /\bfresh\b/, "a range in `mutate` names the same module");
    assert.match(out, /2 of 2 module\(s\) fresh/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("stale: a module whose build changed since its measurement is named, with the command that re-measures it, exit 1", () => {
  const root = tree({ record: [measuredOn("alpha"), measuredOn("beta", "export function beta(x) {\n  return x >= 0;\n}\n")] });
  try {
    const { code, out } = fresh(root);
    assert.equal(code, 1, out);
    assert.match(line(out, "beta"), /\bstale\b/);
    assert.match(line(out, "alpha"), /\bfresh\b/);
    assert.match(out, /gh workflow run mutation-ratchet\.yml -f module=beta -f mode=measure/);
    assert.doesNotMatch(out, /-f module=alpha/, "a fresh module is not sent back to be measured");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("unknown: a module with no recorded measurement, or one recorded without a digest, is not fresh, exit 1", () => {
  for (const beta of [undefined, { module: "beta", sha256: null, run: null, measuredAt: null, reason: "not knowable from history" }]) {
    const root = tree({ record: beta ? [measuredOn("alpha"), beta] : [measuredOn("alpha")] });
    try {
      const { code, out } = fresh(root);
      assert.equal(code, 1, out);
      assert.match(line(out, "beta"), /\bunknown\b/);
      if (beta) assert.match(line(out, "beta"), /not knowable from history/, "the recorded reason is shown");
      assert.match(out, /-f module=beta -f mode=measure/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("refused: no dist/, a module not built, or a missing or malformed record exit 2, never 0 or 1", () => {
  const cases = {
    "no dist": tree({ record: [measuredOn("alpha"), measuredOn("beta")], dist: false }),
    "a module not built": tree({ record: [measuredOn("alpha"), measuredOn("beta")], build: { alpha: SOURCES.alpha } }),
    "no record": tree({}),
    "a malformed record": tree({ record: "{ not json" }),
    "a record without modules": tree({ record: "{}" }),
    "a module recorded twice": tree({ record: [measuredOn("alpha"), measuredOn("alpha"), measuredOn("beta")] }),
    "no stryker config": tree({ record: [measuredOn("alpha")], config: false }),
  };
  for (const [what, root] of Object.entries(cases)) {
    try {
      const { code, out } = fresh(root);
      assert.equal(code, 2, `${what}: ${out}`);
      assert.match(out, /REFUSED/, what);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("positive control: one character changed in a built module turns it stale, and restoring it turns it fresh", () => {
  const root = tree({ record: [measuredOn("alpha"), measuredOn("beta")] });
  const file = join(root, "dist", "lib", "beta.js");
  try {
    assert.equal(fresh(root).code, 0, "the control starts from a fresh tree");
    writeFileSync(file, SOURCES.beta.replace("x > 0", "x < 0"));
    const after = fresh(root);
    assert.equal(after.code, 1, after.out);
    assert.match(line(after.out, "beta"), /\bstale\b/);
    writeFileSync(file, SOURCES.beta);
    const restored = fresh(root);
    assert.equal(restored.code, 0, restored.out);
    assert.match(line(restored.out, "beta"), /\bfresh\b/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("recording: the digest comes from the report's embedded source, and only once the ratchet answers describes", () => {
  const root = tree({ record: [measuredOn("alpha")] });
  mkdirSync(join(root, "docs", "compliance", "mutation-survivors"), { recursive: true });
  const report = (status) => {
    const p = join(root, `beta-${status}.json`);
    writeFileSync(p, JSON.stringify({ schemaVersion: "1.0", files: { "dist/lib/beta.js": { source: SOURCES.beta, mutants: [
      { id: "1", mutatorName: "EqualityOperator", replacement: "x >= 0", status,
        location: { start: { line: 2, column: 10 }, end: { line: 2, column: 15 } } },
    ] } } }));
    return p;
  };
  const record = (p) => spawnSync(process.execPath, [RECORD_SOURCE, "--module", "beta", "--report", p, "--run", "456", "--measured-at", "2026-10-28"], { cwd: root, encoding: "utf8" });
  try {
    // A survivor nobody filed: the ratchet refuses, so nothing is written.
    const refused = record(report("Survived"));
    assert.equal(refused.status, 2, `${refused.stdout}${refused.stderr}`);
    assert.equal(JSON.parse(readFileSync(join(root, RECORD), "utf8")).modules.length, 1);
    // Every mutant killed: the register (empty for beta) describes it, and the entry is written.
    const ok = record(report("Killed"));
    assert.equal(ok.status, 0, `${ok.stdout}${ok.stderr}`);
    const entry = JSON.parse(readFileSync(join(root, RECORD), "utf8")).modules.find((e) => e.module === "beta");
    assert.deepEqual(entry, { module: "beta", sha256: sha(SOURCES.beta), run: "456", measuredAt: "2026-10-28" });
    assert.equal(fresh(root).code, 0, "the module just recorded is fresh on the build it was measured on");
    // Bad arguments and a module outside the perimeter are refused.
    for (const args of [["--module", "beta"], ["--module", "gamma", "--report", report("Killed"), "--run", "1", "--measured-at", "2026-10-28"],
      ["--module", "beta", "--report", report("Killed"), "--run", "abc", "--measured-at", "2026-10-28"],
      ["--module", "beta", "--report", report("Killed"), "--run", "1", "--measured-at", "28/10/2026"]]) {
      assert.equal(spawnSync(process.execPath, [RECORD_SOURCE, ...args], { cwd: root, encoding: "utf8" }).status, 2, args.join(" "));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the committed record covers exactly the perimeter, sorted, one entry per module, each a digest or a stated reason", () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8"));
  const perimeter = cfg.mutate.map((e) => e.replace(/:.*$/, "").replace(/^.*\//, "").replace(/\.js$/, "")).sort();
  const { modules } = JSON.parse(readFileSync(join(ROOT, RECORD), "utf8"));
  const names = modules.map((e) => e.module);
  assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), "entries are sorted by module");
  assert.deepEqual([...names].sort(), perimeter, "one entry per module of the perimeter, none outside it");
  for (const e of modules) {
    if (e.sha256 === null) assert.ok(typeof e.reason === "string" && e.reason.length > 0, `${e.module}: a null digest states why`);
    else assert.match(e.sha256, /^[0-9a-f]{64}$/, e.module);
    if (e.run !== null) assert.match(e.run, /^\d+$/, e.module);
    if (e.measuredAt !== null) assert.match(e.measuredAt, /^\d{4}-\d{2}-\d{2}$/, e.module);
  }
});
