// The repository rules recipe (docs/recipes/repository-rules-as-junit.md), held to what it documents.
//
// The recipe is documentation plus a script an adopter copies; runward's gate never runs the script.
// What this file pins is the contract between the recipe and the gate, by RUNNING the recipe's worked
// example on `init --example`: the rule vendored with `update --corpus` makes the gate require a row,
// the script's case name is the documented one, a row citing it is green, a guarded change without a
// bump turns the cited case absent (red), `--record` refuses to rewrite a released version, and a bump
// recorded and cited is green again. The fingerprints are the ones the recipe prints, so the recipe's
// pasted output cannot drift from what the script writes on the shipped example.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEvidencePointers } from "../../dist/lib/evidence.js";
import { junitTestResult } from "../../dist/lib/tool-adapters.js";
import { caseName, fingerprint, readVersion } from "../../docs/recipes/repository-rules/repo-rule-junit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const SCRIPT = join(ROOT, "docs", "recipes", "repository-rules", "repo-rule-junit.mjs");
const RECIPE = readFileSync(join(ROOT, "docs", "recipes", "repository-rules-as-junit.md"), "utf8");
const V1 = "2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920";
const V2 = "00812e442911e192e52cbb26669ff3c95bd5f2c18c41347eb24fe5637d154bd3";
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const run = (cwd, file, args) => spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
const kit = (cwd, ...extra) => run(cwd, SCRIPT, ["--rule", "repo-kit-version-bump", "--version-file", "code/KIT_VERSION", "--key", "KIT_VERSION",
  "--guard", "code/src/core/ports", "--lock", "code/repo-rules.lock.json", "--out", "code/reports/repo-rules.xml", ...extra]);
/** The rule file, exactly as the recipe prints it. */
const RULE = RECIPE.match(/`\.\.\/corpus\/repo-kit-version-bump\.md`:\n\n```markdown\n([\s\S]*?)```/)[1];
const row = (v, sha) => `| repo-kit-version-bump | applied | test:code/reports/repo-rules.xml::"${caseName("repo-kit-version-bump", "KIT_VERSION", v, sha)}"; file:code/repo-rules.lock.json — the port kit's fingerprint is recorded under the current KIT_VERSION |`;

test("the case name is the documented one, and a row citing it reads one test pointer whose name is the whole string", () => {
  const name = caseName("repo-kit-version-bump", "KIT_VERSION", "1", V1);
  assert.equal(name, `repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=${V1}`);
  assert.ok(RECIPE.includes("`repo-rule <rule-id> <KEY>=<version> sha256=<64 hex>`"));
  const t = parseEvidencePointers(row("1", V1).split(" | ")[2]).find((p) => p.kind === "test");
  assert.equal(t.testName, name);
  assert.doesNotMatch(name, /[|;"]|::/);
});

test("the version is read in the spellings a version file uses", () => {
  for (const text of ["KIT_VERSION=3\n", "export const KIT_VERSION = \"3\";\n", "KIT_VERSION: 3\n"]) assert.equal(readVersion(text, "KIT_VERSION"), "3", text);
  assert.equal(readVersion("OTHER=3\n", "KIT_VERSION"), undefined);
});

test("the fingerprint moves with content and paths, never with CRLF", () => {
  const d = mkdtempSync(join(tmpdir(), "rw-rr-fp-")); dirs.push(d);
  writeFileSync(join(d, "a.ts"), "x\n");
  const cwd = process.cwd();
  try {
    process.chdir(d);
    const a = fingerprint(["a.ts"]);
    writeFileSync("a.ts", "x\r\n");
    assert.equal(fingerprint(["a.ts"]), a);
    writeFileSync("a.ts", "y\n");
    assert.notEqual(fingerprint(["a.ts"]), a);
  } finally { process.chdir(cwd); }
});

test("the worked example runs on init --example as the recipe prints it, red and green", () => {
  const d = mkdtempSync(join(tmpdir(), "rw-rr-")); dirs.push(d);
  assert.equal(run(d, CLI, ["init", "--example"]).status, 0);
  const corpus = join(d, "..", `${d.split(/[\\/]/).pop()}-corpus`); dirs.push(corpus);
  mkdirSync(corpus);
  for (const f of readdirSync(join(d, "runward", "rules"))) if (f.endsWith(".md")) copyFileSync(join(d, "runward", "rules", f), join(corpus, f));
  writeFileSync(join(corpus, "repo-kit-version-bump.md"), RULE);
  writeFileSync(join(d, "code", "KIT_VERSION"), "KIT_VERSION=1\n");

  const up = run(d, CLI, ["update", "--corpus", corpus]);
  assert.equal(up.status, 0, up.stderr);
  assert.match(up.stdout, /write runward\/rules\/repo-kit-version-bump\.md/);
  let check = run(d, CLI, ["check", "--strict"]);
  assert.equal(check.status, 1, "positive control: the vendored rule is required, the gate is red without its row");
  assert.match(check.stdout, /✗ Floor · repo-kit-version-bump — not accounted for/);

  let k = kit(d);
  assert.equal(k.status, 1);
  assert.match(k.stdout, /KIT_VERSION=1 has no recorded fingerprint/);
  k = kit(d, "--record");
  assert.equal(k.status, 0, k.stderr);
  assert.ok(k.stdout.includes(`ok  repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=${V1}`), "the fingerprint the recipe prints");
  const report = readFileSync(join(d, "code", "reports", "repo-rules.xml"), "utf8");
  assert.equal(junitTestResult(report, caseName("repo-kit-version-bump", "KIT_VERSION", "1", V1)), "pass");

  const floor = join(d, "runward", "floor.md");
  const original = readFileSync(floor, "utf8");
  const anchorEnd = original.indexOf("\n", original.indexOf("| tools-registry-pattern | n/a |"));
  writeFileSync(floor, original.slice(0, anchorEnd) + "\n" + row("1", V1) + original.slice(anchorEnd));
  check = run(d, CLI, ["check", "--strict"]);
  assert.equal(check.status, 0, check.stdout);

  appendFileSync(join(d, "code", "src", "core", "ports", "routing.port.ts"), "// a new optional field on the routing port\n");
  k = kit(d);
  assert.equal(k.status, 1);
  assert.ok(k.stdout.includes(`KIT_VERSION=1 sha256=${V2}`) && /changed since KIT_VERSION=1 was recorded/.test(k.stdout));
  check = run(d, CLI, ["check", "--strict"]);
  assert.equal(check.status, 1, "a guarded change without a bump, once the report is regenerated, reddens the row");
  assert.match(check.stdout, /no JUnit test case named "repo-rule repo-kit-version-bump KIT_VERSION=1/);
  k = kit(d, "--record");
  assert.equal(k.status, 1);
  assert.match(k.stderr, /already recorded with another fingerprint/, "the old number cannot be re-recorded");

  writeFileSync(join(d, "code", "KIT_VERSION"), "KIT_VERSION=2\n");
  assert.equal(kit(d, "--record").status, 0);
  writeFileSync(floor, readFileSync(floor, "utf8").replace(row("1", V1), row("2", V2)));
  check = run(d, CLI, ["check", "--strict"]);
  assert.equal(check.status, 0, "bumped, recorded and cited: green again");
  for (const sha of [V1, V2]) assert.ok(RECIPE.includes(sha), "the recipe's pasted output is the script's on the example");
});

test("the recipe ships where the Lean one does: the kit carries docs/recipes/ and its README names it", () => {
  const readme = readFileSync(join(ROOT, "scripts", "qualification-kit", "README.md"), "utf8");
  assert.match(readme, /repository-rules-as-junit\.md/);
  assert.match(readFileSync(join(ROOT, "scripts", "build-qualification-kit.mjs"), "utf8"), /startsWith\("docs\/recipes\/"\)/);
});
