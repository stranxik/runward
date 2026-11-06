// ADR-0118: the reading under the analyzers — what is code, what is a literal, what a test case is.
//
// Every family reads `maskSource`'s output: comments and literal contents blanked, offsets kept. A
// slip there is a false finding (a string read as a call) or a blind spot (a call read as a string),
// so each shape below is asserted both ways. The test-case reading is held on the shapes node:test,
// Jest and Vitest suites are written in, because a case taken for vacuous when it asserts through a
// helper is the false red that gets a gate switched off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { maskSource, importsOf, literalValue, lineOf, analyzeDelivery } from "../../dist/lib/analyze.js";

const code = (src) => maskSource(src).code;

test("masking keeps every offset and newline, and blanks comments and literal contents only", () => {
  const src = 'const a = "eval(x)"; // fetch(y)\n/* new Function(z) */ const b = \'import(w)\';\n';
  const m = maskSource(src);
  assert.equal(m.code.length, src.length);
  assert.equal(m.code.split("\n").length, src.split("\n").length);
  assert.ok(!/eval|fetch|Function|import\(/.test(m.code), m.code);
  assert.match(m.code, /const a = " {7}";/, "the delimiters stay, the contents go");
  assert.equal(lineOf(m, src.indexOf("const b")), 2);
});

test("a template literal: its text is blanked, the code of its substitutions stays readable", () => {
  const c = code("const t = `eval(${run(x)}) and ${`nested ${eval(y)}`}`;");
  assert.ok(!/eval\(\$/.test(c));
  assert.match(c, /run\(x\)/, "a substitution is code");
  assert.match(c, /eval\(y\)/, "a substitution nested in a template inside a substitution is code too");
  assert.equal(maskSource("const t = `a${b}c`;").literals[0].dynamic, true);
  assert.equal(maskSource("const t = `abc`;").literals[0].dynamic, false);
});

test("a slash is a regular expression after an operator or a keyword, a division after a value", () => {
  assert.doesNotMatch(code("const r = /eval\\(/g.test(s);"), /eval/);
  assert.doesNotMatch(code("return /fetch\\(/.test(s);"), /fetch/);
  assert.doesNotMatch(code("if (x) { y = 1; } /import\\(/.exec(z);"), /import/);
  assert.match(code("const half = total / 2 / eval(x);"), /eval\(x\)/, "two divisions are not a regular expression");
  assert.match(code("const q = a[i] / b) / eval(c);"), /eval\(c\)/);
});

test("a string never runs past its line, and a hashbang line is not code", () => {
  const c = code("#!/usr/bin/env node eval(x)\nconst s = 'unterminated\neval(y);\n");
  assert.ok(!c.split("\n")[0].includes("eval"), "the hashbang line is blanked");
  assert.match(c.split("\n")[2], /eval\(y\)/, "an unterminated string ends with its line");
});

test("imports: every spelling that names a module, and every one that computes it", () => {
  const src = [
    'import a from "pkg-a";',
    'import "side-effect";',
    'import type { T } from "types-only";',
    'export { b } from "./re-export.js";',
    'export * as ns from "@scope/pkg/sub";',
    'const c = await import("dyn-literal");',
    'const d = require("cjs-literal");',
    "const e = await import(`tpl-literal`);",
    "const f = await import(name);",
    "const g = require(`./${name}.js`);",
    'const h = require.resolve("not-an-import");',
    'const i = obj.import("not-an-import-either");',
    'const j = "from \\"not-a-statement\\"";',
  ].join("\n");
  const imports = importsOf(src, maskSource(src));
  assert.deepEqual(imports.map((x) => [x.spec, x.how, x.typeOnly]), [
    ["pkg-a", "static", false], ["side-effect", "static", false], ["types-only", "static", true],
    ["./re-export.js", "static", false], ["@scope/pkg/sub", "static", false], ["dyn-literal", "dynamic", false],
    ["cjs-literal", "call", false], ["tpl-literal", "dynamic", false], [null, "dynamic", false], [null, "call", false],
  ]);
});

test("a literal's value is read as JavaScript reads its escapes", () => {
  const src = String.raw`const s = "a\"b\\cé\x41\u{1F600}\n";`;
  const m = maskSource(src);
  assert.equal(literalValue(src, m.literals[0]), 'a"b\\cé' + "A\u{1F600}\n");
});

// A synthetic mission: a lock that pins the policy, and the files given. Nothing else is needed to read.
function delivery(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-scan-"));
  const lock = { version: 1, writtenBy: "test", analysis: "runward-analysis/1", files: {} };
  const all = { "runward/scaffold-lock.json": JSON.stringify(lock), ...files };
  for (const [rel, text] of Object.entries(all)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  try { return analyzeDelivery(join(dir, "runward")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const checksIn = (r, path) => r.findings.filter((f) => f.path === path).map((f) => f.check);

test("test cases: a case that asserts through a helper, a subtest, a throw or an expect is not vacuous", () => {
  const r = delivery({
    "src/x.ts": "export const x = 1;\n",
    "test/x.test.ts": [
      'import { test } from "node:test";',
      'import assert from "node:assert/strict";',
      'import { x } from "../src/x.ts";',
      "function checkRow(v) { assert.equal(v, 1); }",
      "const verifyAll = (v) => checkRow(v);",
      'test("through a helper", () => { verifyAll(x); });',
      'test("through subtests", async (t) => { await t.test("inner", () => { assert.ok(x); }); });',
      'test("through a throw", () => { if (x !== 1) throw new Error("x"); });',
      'test("with options and a function", { timeout: 10 }, function () { assert.ok(x); });',
      'test("expression body", () => assert.ok(x));',
      'test.skip("skipped and empty", () => {});',
      'test("skipped by option", { skip: "not on this system" }, () => {});',
      'test.todo("later");',
      'test("vacuous", () => { const y = x + 1; void y; });',
      'test(`named ${"at"} run time`, () => {});',
    ].join("\n"),
  });
  assert.deepEqual(checksIn(r, "test/x.test.ts").sort(), ["case-asserts-nothing", "case-asserts-nothing"].sort());
  const names = r.findings.map((f) => f.message.match(/case (".*?"|\(a case whose name is computed\))/)?.[1]).sort();
  assert.deepEqual(names, ['"vacuous"', "(a case whose name is computed)"]);
});

test("test files: an empty one, one that imports only its framework, and one that spawns the code under test", () => {
  const r = delivery({
    "src/x.ts": "export const x = 1;\n",
    "test/empty.test.ts": "// nothing here\n",
    "test/only-framework.test.ts": 'import { test } from "node:test";\nimport assert from "node:assert";\ntest("a", () => { assert.ok(true); });\n',
    "test/cli.test.js": 'import { test } from "node:test";\nimport assert from "node:assert";\nimport { spawnSync } from "node:child_process";\ntest("cli", () => { assert.equal(spawnSync("node", ["src/x.ts"]).status, 0); });\n',
    "test/support/helpers.js": 'import { spawnSync } from "node:child_process";\nexport const run = () => spawnSync("node", []);\n',
    "test/health.test.js": 'import { test } from "node:test";\nimport assert from "node:assert";\ntest("health", async () => { assert.equal((await fetch(process.env.URL)).status, 200); });\n',
    "e2e/home.spec.ts": 'import { test, expect } from "@playwright/test";\ntest("home", async ({ page }) => { await page.goto("/"); await expect(page).toHaveTitle(/Home/); });\n',
  });
  assert.deepEqual(checksIn(r, "test/health.test.js"), [], "a test that drives the delivery over the network reaches it");
  assert.deepEqual(checksIn(r, "e2e/home.spec.ts"), [], "a browser driver is not the test framework");
  assert.deepEqual(checksIn(r, "test/empty.test.ts"), ["file-declares-nothing"]);
  assert.deepEqual(checksIn(r, "test/only-framework.test.ts"), ["file-imports-only-framework"]);
  assert.deepEqual(checksIn(r, "test/cli.test.js"), [], "a test that drives the delivery through a process reaches it");
  assert.deepEqual(checksIn(r, "test/support/helpers.js"), [], "a file under test/ is a test file: spawning there is not a delivered capability");
  assert.equal(r.hypotheses.filter((h) => h.check === "case-asserts-literals").length, 1);
});

test("a test co-located in the declared core is a test: its framework imports are not a boundary finding", () => {
  const territory = "# Territory\n\n| Pattern | Category | Effect | Why |\n|---|---|---|---|\n| `src/core/**` | `domain-core` | declare | the domain, pure, imports nothing from adapters |\n";
  const r = delivery({
    "runward/territory.md": territory,
    "src/core/price.ts": 'import { readFileSync } from "node:fs";\nexport const price = (n: number) => n * 2;\n',
    "src/core/price.test.ts": 'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { price } from "./price.ts";\ntest("doubles", () => { assert.equal(price(2), 4); });\n',
  });
  assert.deepEqual(r.findings.map((f) => `${f.path}:${f.check}`), ["src/core/price.ts:core-import-builtin"], "the core file is judged, its test is not");
  assert.equal(r.files.core, 1);
});

test("scope: build output beside a package.json, dependencies and links are set aside; a src/build directory is read", () => {
  const r = delivery({
    "package.json": "{}",
    "dist/bundle.js": "eval(x);\n",
    "node_modules/pkg/index.js": "eval(x);\n",
    "src/build/step.ts": "eval(x);\n",
    "src/main.py": "eval(x)\n",
  });
  assert.deepEqual(r.findings.map((f) => `${f.path}:${f.check}`), ["src/build/step.ts:code-execution"]);
  assert.deepEqual(r.excluded.map((e) => e.path), ["dist", "node_modules"]);
  assert.deepEqual(r.notAnalyzed.find((n) => n.what.startsWith("Python")).examples, ["src/main.py"]);
});
