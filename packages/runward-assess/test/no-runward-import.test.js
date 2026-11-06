// runward-assess imports nothing from runward: not the package, not a sibling package, not a file of
// the repository it sits in. It reads what runward writes, and runs runward's CLI as a program.
// Built so the package can leave this repository for its own without a line changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { PKG } from "./helpers.js";

const SPECIFIERS = (src) => [
  ...[...src.matchAll(/(?:from|import)\s*\(?\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
  ...[...src.matchAll(/\brequire\s*\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
];
const RUNWARD = /^runward(?:-(?!assess\b)[a-z]+)?(?:\/|$)/;

/** Every way a file of this package could reach runward: by name, by a path out of the package, by a loader. */
export function runwardImports(file, src) {
  const found = [];
  for (const s of SPECIFIERS(src)) {
    if (RUNWARD.test(s)) found.push(`${file} imports "${s}"`);
    if (s.startsWith(".") && !resolve(dirname(file), s).startsWith(PKG + sep)) found.push(`${file} reaches outside its package with "${s}"`);
    if (/(^|\/)(dist|src)\/(lib|commands)\//.test(s) && !s.startsWith("./") && !s.startsWith("../src/")) found.push(`${file} imports runward's tree "${s}"`);
  }
  if (/createRequire\s*\(/.test(src)) found.push(`${file} uses createRequire, which this scan cannot follow`);
  return found;
}

const files = (dir) => readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.(m?js|cjs)$/.test(f)).map((f) => join(dir, f));

test("no file of runward-assess imports runward, a sibling package, or a file outside the package", () => {
  const all = ["bin", "src", "test"].flatMap((d) => files(join(PKG, d)));
  assert.ok(all.length >= 20, `the scan walked the package (${all.length} files)`);
  const found = all.filter((f) => !f.endsWith("no-runward-import.test.js")).flatMap((f) => runwardImports(f, readFileSync(f, "utf8")));
  assert.deepEqual(found, []);
});

test("the package declares no dependency at all, and runward least of all", () => {
  const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
  for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "bundleDependencies"]) {
    assert.ok(!pkg[k] || Object.keys(pkg[k]).length === 0, `${k} is empty`);
  }
  assert.equal(pkg.name, "runward-assess");
});

test("positive controls: the scan reddens on every planted way of importing runward, and not on honest text", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-assess-plant-"));
  try {
    const plants = {
      "static.js": 'import { CLAIMS_RULES } from "runward/claims";',
      "bare.js": 'import runward from "runward";',
      "dynamic.js": 'const m = await import("runward");',
      "require.js": 'const r = require("runward");',
      "sibling.js": 'import { postSummary } from "runward-forge";',
      "escape.js": 'import { computeVerdict } from "../../../dist/lib/verdict.js";',
      "loader.js": 'import { createRequire } from "node:module"; const req = createRequire(import.meta.url);',
    };
    for (const [n, s] of Object.entries(plants)) writeFileSync(join(dir, n), s);
    for (const n of Object.keys(plants)) assert.equal(runwardImports(join(dir, n), readFileSync(join(dir, n), "utf8")).length >= 1, true, `${n} is caught`);
    const honest = [
      'import { score } from "../src/score.js";',
      'const cli = join(snapshotDir, "tools/runward-0.46.0/node_modules/runward/dist/cli.js"); run(node, [cli, "check", "--strict"]);',
      '// reads what runward writes, never imports it',
      'import { x } from "runward-assess/score";',
    ];
    for (const h of honest) assert.deepEqual(runwardImports(join(PKG, "src", "x.js"), h), [], `honest: ${h}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("and runward's own package does not import runward-assess, nor ship it", () => {
  const root = resolve(PKG, "..", "..");
  let rootPkg;
  try { rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")); } catch { return; }
  if (rootPkg.name !== "runward") return; // extracted into its own repository: nothing to check here
  for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"]) assert.ok(!rootPkg[k]?.["runward-assess"], `runward-assess is not a ${k} entry of runward`);
  assert.ok(!(rootPkg.files ?? []).some((f) => f.startsWith("packages")), "packages/ is not in the runward tarball");
  const src = files(join(root, "src")).length ? files(join(root, "src")) : [];
  const ts = readdirSync(join(root, "src"), { recursive: true }).map(String).filter((f) => f.endsWith(".ts")).map((f) => join(root, "src", f));
  for (const f of [...src, ...ts]) for (const s of SPECIFIERS(readFileSync(f, "utf8"))) assert.ok(!/runward-assess|packages\//.test(s), `${f} imports "${s}"`);
});
