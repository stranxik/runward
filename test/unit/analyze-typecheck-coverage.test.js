// ADR-0118, amendment of 2026-11-06: a compile-time assertion is credited only where a type check covers
// the test file.
//
// The corrected reading of the false reds credited `type verify = Expect<Equal<…>>` and `@ts-expect-error`
// whenever a `package.json` script named a type checker. The reviewer of hono found the false green that
// left open: hono's `tsconfig.build.json` excludes `src/**/*.test.ts`, so a project whose only type check
// is the build's checks no test, and its type assertions assert nothing. Its four fixtures, modelled on
// hono (assertion types in `src/utils/types.ts`, the code under test in its own module, Vitest globals),
// are the first four tests below; the others hold what the reading does not follow, which credits nothing.
// hono itself stays credited: its test script runs `tsc -p tsconfig.spec.json`, which includes `src` and
// excludes nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyzeDelivery } from "../../dist/lib/analyze.js";

function delivery(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-tc-"));
  const lock = { version: 1, writtenBy: "test", analysis: "runward-analysis/1", files: {} };
  const all = { "runward/scaffold-lock.json": JSON.stringify(lock), ...files };
  for (const [rel, text] of Object.entries(all)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  try { return analyzeDelivery(join(dir, "runward")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const lines = (...l) => `${l.join("\n")}\n`;
const at = (r, path) => r.findings.filter((f) => f.path === path).map((f) => `${f.family}/${f.check}:${f.line}`);

// The reviewer's fixture: three cases, each asserting only at compile time on the code under test.
const HONO_LIKE = {
  "tsconfig.base.json": JSON.stringify({ compilerOptions: { target: "ES2022", moduleResolution: "Bundler", strict: true, skipLibCheck: true } }),
  "tsconfig.build.json": JSON.stringify({ extends: "./tsconfig.base.json", compilerOptions: { rootDir: "./src/", outDir: "./dist/types/" },
    include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] }),
  "tsconfig.spec.json": JSON.stringify({ extends: "./tsconfig.base.json", compilerOptions: { noEmit: true, rootDir: "./src", types: ["vitest/globals"] }, include: ["src"] }),
  "src/utils/types.ts": lines(
    "export type Expect<T extends true> = T",
    "export type Equal<X, Y> =",
    "  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false",
  ),
  "src/params.ts": lines(
    "export type ParamKeys<Path> = Path extends `${string}:${infer K}/${infer Rest}`",
    "  ? K | ParamKeys<Rest>",
    "  : Path extends `${string}:${infer K}`",
    "    ? K",
    "    : never",
    "export const route = <P extends string>(path: P) => ({ path })",
  ),
  "src/params.test.ts": lines(
    "import type { Equal, Expect } from './utils/types'",
    "import type { ParamKeys } from './params'",
    "import { route } from './params'",
    "",
    "describe('ParamKeys', () => {",
    "  test('ParamKeys', () => {",
    "    type Actual = ParamKeys<'/posts/:postId/comment/:commentId'>",
    "    type Expected = 'postId' | 'commentId'",
    "    type verify = Expect<Equal<Expected, Actual>>",
    "  })",
    "",
    "  it('route keeps the literal path', () => {",
    "    const r = route('/a/:id')",
    "    type verify = Expect<Equal<'/a/:id', typeof r.path>>",
    "  })",
    "",
    "  it('route refuses a number', () => {",
    "    // @ts-expect-error a number is not a path",
    "    route(42)",
    "  })",
    "})",
  ),
};
const withScripts = (scripts, extra = {}) => ({ ...HONO_LIKE, "package.json": JSON.stringify({ name: "probe", private: true, type: "module", scripts,
  devDependencies: { typescript: "^6.0.3", vitest: "5.0.1" } }), ...extra });
const ALL_RED = ["test-integrity/case-asserts-nothing:6", "test-integrity/case-asserts-nothing:12", "test-integrity/case-asserts-nothing:17"];

test("B, hono's own shape: the test script runs tsc -p tsconfig.spec.json, which includes src, so the type assertions are credited", () => {
  assert.deepEqual(at(delivery(withScripts({ test: "tsc -p tsconfig.spec.json && vp test --run" })), "src/params.test.ts"), []);
});

test("A: the only type check is the build's, whose configuration excludes *.test.ts: nothing is credited", () => {
  assert.deepEqual(at(delivery(withScripts({ build: "tsc -p tsconfig.build.json", test: "vp test --run" })), "src/params.test.ts"), ALL_RED);
});

test("E: the test script runs the build's configuration first: it checks no test file, nothing is credited", () => {
  assert.deepEqual(at(delivery(withScripts({ test: "tsc -p tsconfig.build.json && vp test --run" })), "src/params.test.ts"), ALL_RED);
});

test("C: no script type-checks anything: nothing is credited", () => {
  assert.deepEqual(at(delivery(withScripts({ test: "vp test --run" })), "src/params.test.ts"), ALL_RED);
});

test("a bare tsc reads the tsconfig.json beside its package.json, through relative extends, as TypeScript reads it", () => {
  // Comments and trailing commas, as a tsconfig.json may carry them; the base found without its extension.
  const json = '{\n  // the tests are type-checked\n  "extends": "./tsconfig.base",\n  "include": ["src/**/*.ts",],\n}\n';
  assert.deepEqual(at(delivery(withScripts({ typecheck: "tsc --noEmit" }, { "tsconfig.json": json })), "src/params.test.ts"), []);
  // The same with an exclude that sets the tests aside, inherited from the base: the leaf names none of its own.
  const base = JSON.stringify({ exclude: ["src/**/*.test.ts"] });
  const leaf = JSON.stringify({ extends: "./tsconfig.excluding.json", include: ["src"] });
  assert.deepEqual(at(delivery(withScripts({ typecheck: "tsc" }, { "tsconfig.json": leaf, "tsconfig.excluding.json": base })), "src/params.test.ts"), ALL_RED);
  // `-p` naming a directory reads the tsconfig.json in it.
  assert.deepEqual(at(delivery(withScripts({ typecheck: "npx tsc -p ." }, { "tsconfig.json": JSON.stringify({ include: ["src"] }) })), "src/params.test.ts"), []);
  // A file named on the command line is read whatever the configuration says; another file named is not this one.
  assert.deepEqual(at(delivery(withScripts({ typecheck: "tsc --noEmit src/params.test.ts" })), "src/params.test.ts"), []);
  assert.deepEqual(at(delivery(withScripts({ typecheck: "tsc --noEmit src/params.ts" }, { "tsconfig.json": JSON.stringify({ include: ["src"] }) })), "src/params.test.ts"), ALL_RED);
});

test("fail closed: what the reading does not follow credits nothing", () => {
  const cover = JSON.stringify({ include: ["src"] });
  for (const [why, scripts, extra] of [
    ["an extends from a package", { test: "tsc -p tsconfig.pkg.json" }, { "tsconfig.pkg.json": JSON.stringify({ extends: "@tsconfig/node22/tsconfig.json", include: ["src"] }) }],
    ["build mode, which follows references", { test: "tsc -b" }, { "tsconfig.json": cover }],
    ["a solution file with no files of its own (hono's root tsconfig.json)", { test: "tsc -p tsconfig.json" }, { "tsconfig.json": JSON.stringify({ files: [], references: [{ path: "./tsconfig.spec.json" }] }) }],
    ["a command after a cd, which runs elsewhere", { test: "cd src && tsc -p ../tsconfig.spec.json" }, {}],
    ["a configuration that is not in the tree", { test: "tsc -p tsconfig.missing.json" }, {}],
    ["a configuration that does not parse", { test: "tsc -p tsconfig.broken.json" }, { "tsconfig.broken.json": "{ include: [src" }],
    ["a type-test runner this reading does not read (tsd, tstyche, vitest --typecheck)", { test: "tsd && tstyche && vitest --typecheck" }, { "tsconfig.json": cover }],
  ]) {
    assert.deepEqual(at(delivery(withScripts(scripts, extra)), "src/params.test.ts"), ALL_RED, why);
  }
});

test("a type case whose Expect and Equal come from the module under test stays red under a covering tsc (said in ADR-0118, no real case has that shape)", () => {
  const files = withScripts({ test: "tsc -p tsconfig.spec.json" }, {
    "src/params.ts": HONO_LIKE["src/params.ts"] + HONO_LIKE["src/utils/types.ts"],
    "src/params.test.ts": lines(
      "import type { Equal, Expect, ParamKeys } from './params'",
      "describe('ParamKeys', () => {",
      "  test('ParamKeys', () => {",
      "    type Actual = ParamKeys<'/posts/:postId/comment/:commentId'>",
      "    type verify = Expect<Equal<'postId' | 'commentId', Actual>>",
      "  })",
      "})",
    ),
  });
  assert.deepEqual(at(delivery(files), "src/params.test.ts"), ["test-integrity/case-asserts-nothing:3"]);
});
