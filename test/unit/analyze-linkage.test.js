// ADR-0124 decision 2: the linkage family of the built-in analyzers.
//
// Case b of the 2026-11-05 saboteur corpus: the example's `code/src/core/domain/triage.ts`, cited bare
// by the `hexa-architecture` row, replaced by one word. Every pointer still resolved, every committed
// report still read green, and no family of ADR-0118 had anything to say: the word imports nothing,
// declares nothing a pointer names, and the tests and their report did not move. What a reading of the
// tree can see is that the files importing from it (the use case, the guard, the ports, the adapters,
// the test) take names it no longer exports. The family checks that, for the files a manifest cites
// and the files of the declared core, and never refuses on a form it does not settle. Every refusal
// here is paired with the acceptance that forbids the reading to refuse what links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeDelivery, exportFacts, importedNames, maskSource } from "../../dist/lib/analyze.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };

const facts = (src) => exportFacts(src, maskSource(src));
const names = (src) => {
  const m = maskSource(src);
  const lit = m.literals.find((l) => l.kind !== "regex");
  return importedNames(m.code, lit.start);
};

test("the export reading: declarations, lists, defaults and re-exports, and what it leaves open", () => {
  const f = facts([
    "export function a() {}", "export async function* b() {}", "export class C {}", "export abstract class D {}",
    "export const enum E { x }", "export interface I {}", "export type T = string;", "export namespace N {}",
    "export const x = 1, y = (2, 3);", "export let z: Map<string, number>;", "const local = 1;",
    "export { local, local as renamed };", "export default function () {}", 'export * as ns from "./ns.js";',
    'export * from "./more.js";', '// export const inComment = 1;', 'const s = "export const inString = 1";',
  ].join("\n"));
  assert.equal(f.open, null);
  for (const n of ["a", "b", "C", "D", "E", "I", "T", "N", "x", "y", "z", "local", "renamed", "default", "ns"]) assert.ok(f.names.has(n), n);
  assert.ok(!f.names.has("inComment") && !f.names.has("inString"), "a comment or a string exports nothing");
  assert.deepEqual(f.stars, ["./more.js"]);
  assert.match(facts("module.exports = { a: 1 };").open ?? "", /CommonJS/);
  assert.match(facts("exports.a = 1;").open ?? "", /CommonJS/);
  assert.match(facts("Object.defineProperty(exports, '__esModule', { value: true });").open ?? "", /CommonJS/);
  assert.match(facts("export = thing;").open ?? "", /export =/);
  assert.match(facts("export const { a, b } = source;").open ?? "", /destructured/);
});

test("the import reading: what a statement takes from its module", () => {
  assert.deepEqual(names('import thing from "./x.js";'), [{ name: "default", type: false }]);
  assert.deepEqual(names('import { a, b as c, type T } from "./x.js";'),
    [{ name: "a", type: false }, { name: "b", type: false }, { name: "T", type: true }]);
  assert.deepEqual(names('import type { R } from "./x.js";'), [{ name: "R", type: true }]);
  assert.deepEqual(names('import d, { e } from "./x.js";'), [{ name: "default", type: false }, { name: "e", type: false }]);
  assert.deepEqual(names('import * as all from "./x.js";'), [], "a namespace takes no name");
  assert.deepEqual(names('import "./x.js";'), [], "a side effect takes no name");
  assert.deepEqual(names('export { f, g as h } from "./x.js";'), [{ name: "f", type: false }, { name: "g", type: false }]);
});

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-linkage-ex-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
  return dir;
}
const linkage = (dir) => analyzeDelivery(join(dir, "runward")).findings.filter((f) => f.family === "linkage");
const TRIAGE = "code/src/core/domain/triage.ts";

test("the example as shipped links: no finding", () => {
  const dir = example();
  try { assert.deepEqual(linkage(dir), []); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("case b: a cited core file replaced by one word is named at every import that no longer links", () => {
  const dir = example();
  try {
    writeFileSync(join(dir, TRIAGE), "poubelle\n");
    const found = linkage(dir);
    assert.equal(found.filter((f) => f.check === "import-not-exported").length, 4, "the values the use case and the guard take");
    assert.equal(found.filter((f) => f.check === "type-import-not-exported").length, 12, "the types the ports, the adapters and the test take");
    assert.equal(new Set(found.map((f) => f.path)).size, 8);
    assert.ok(found.every((f) => f.message.includes(`(${TRIAGE}), which exports no such name`)));
    assert.ok(found.some((f) => f.path === "code/src/core/application/triage-request.usecase.ts"
      && /imports `InboundRequestSchema` from `\.\.\/domain\/triage\.js`.*does not link$/.test(f.message)));
    // b3: one export under another name is no better.
    writeFileSync(join(dir, TRIAGE), "export const x = 1;\n");
    assert.equal(linkage(dir).length, 16);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the limit: a file that keeps every name as a placeholder links, and only an execution sees it", () => {
  const dir = example();
  try {
    const names = ["CATEGORIES", "CategorySchema", "InboundRequestSchema", "QUEUE_BY_CATEGORY", "REVIEW_QUEUE"];
    const types = ["Category", "Confidence", "Provenance", "TriageField", "InboundRequest", "TriageStatus", "TriageRecord", "TriageResult"];
    writeFileSync(join(dir, TRIAGE), names.map((n) => `export const ${n} = 0;\n`).join("") + types.map((t) => `export type ${t} = any;\n`).join(""));
    assert.deepEqual(linkage(dir), [], "b4 links: the reading says nothing about behaviour (ADR-0124, what this does not catch)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a JavaScript file shipped with its declaration file exports what the declaration declares", () => {
  const dir = example();
  try {
    writeFileSync(join(dir, "code/src/core/domain/vendor.js"), "export function make() { return 1; }\n");
    writeFileSync(join(dir, "code/src/core/domain/uses-vendor.ts"), 'import { make, type Made } from "./vendor.js";\nexport const made: Made = make();\n');
    const before = linkage(dir);
    assert.equal(before.length, 1, "the positive control: without its declaration file, the type is not found");
    assert.match(before[0].message, /the type `Made`/);
    writeFileSync(join(dir, "code/src/core/domain/vendor.d.ts"), "export type Made = number;\nexport declare function make(): Made;\n");
    assert.deepEqual(linkage(dir), [], "with it, the import links");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a CommonJS file is never refused: its exports are not settled, and the reading says so", () => {
  const dir = example();
  try {
    writeFileSync(join(dir, "code/src/core/domain/legacy.cjs"), "module.exports = { legacy: 1 };\n");
    writeFileSync(join(dir, "code/src/core/domain/uses-legacy.ts"), 'import { legacy } from "./legacy.cjs";\nexport const v = legacy;\n');
    const r = analyzeDelivery(join(dir, "runward"));
    assert.deepEqual(r.findings.filter((f) => f.family === "linkage"), []);
    const said = r.notAnalyzed.find((n) => n.what.startsWith("linkage:"));
    assert.ok(said && said.examples.includes("code/src/core/domain/legacy.cjs"), JSON.stringify(r.notAnalyzed));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("linkage reads the delivered tree only (ADR-0113 decision 5): an ignored declaration file is not read", () => {
  const dir = example();
  try {
    writeFileSync(join(dir, "code/src/core/domain/vendor.js"), "export function make() { return 1; }\n");
    writeFileSync(join(dir, "code/src/core/domain/vendor.d.ts"), "export type Made = number;\nexport declare function make(): Made;\n");
    writeFileSync(join(dir, "code/src/core/domain/uses-vendor.ts"), 'import { make, type Made } from "./vendor.js";\nexport const made: Made = make();\n');
    assert.deepEqual(linkage(dir), [], "delivered, the declaration file carries the type");
    // The project ignores the declaration file: it is not delivered, so the reading never opens it, and
    // the import of the type it carried is said not to type-check, as it would not on a fresh checkout.
    writeFileSync(join(dir, ".gitignore"), "code/src/core/domain/vendor.d.ts\n", { flag: "a" });
    const found = linkage(dir);
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.match(found[0].message, /the type `Made` from `\.\/vendor\.js` \(code\/src\/core\/domain\/vendor\.js\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the export reading stays linear on a file built to make it quadratic", () => {
  // An export list was read with a pattern that searched for its closing brace from each `{`: 20,000
  // unclosed lists (220,000 characters) took 3.5 s, on a tree the agent writes. The brace is now
  // searched for once, and the declaration walks of one file share a budget. Both shapes stay open,
  // which never refuses anything, and finish far inside the ceiling.
  for (const src of ["export { a ".repeat(20000), "export const a = (\n".repeat(20000)]) {
    const t0 = process.hrtime.bigint();
    const f = facts(src);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(f.open !== null, "an export set this reading cannot close is open");
    assert.ok(ms < 2000, `read in ${ms.toFixed(0)} ms`);
  }
});
