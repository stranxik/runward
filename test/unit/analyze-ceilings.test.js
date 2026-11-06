// RWD-2026-0203: the readings of the verdict path stay linear on files built to make them quadratic.
//
// On 2026-11-06 the symbol family tried each cited name against `function\s*\*?\s*NAME`, quadratic on a
// run of blanks: one file holding `function` and blanks took 2.6 s at 50 KB, 42 s at 200 KB, 167 s at
// 400 KB, inside the policy's 1 MB limit. An audit of every regular expression of the analyzers, the
// evidence layer's comment reader and the globs of the mission's own files, and a measurement of each
// family end to end with adversarial files, found the same class elsewhere: two quantifiers over blanks
// with an optional between them, a scan restarted from every opener, a fixpoint re-reading every body, a
// glob of many stars compiled to a backtracking pattern. Each shape below is one of them, at the size the
// policy still reads (999,000 bytes); before the corrections each took from 4 s to hours, and now each is
// read far inside the ceiling. The ceiling is CPU time, set for a slow runner, not for this machine: what
// it catches is a return of the quadratic, which at this size takes minutes.
//
// The two readings rewritten in place of a pattern are also held to the pattern's answers, on generated
// inputs: the allowance file's heading and the glob dialect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyzeDelivery, headingText } from "../../dist/lib/analyze.js";
import { withoutComments } from "../../dist/lib/evidence.js";
import { globMatcher, globToRegExp } from "../../dist/lib/rules.js";

const SIZE = 999_000;
const CEILING_MS = 6000;
const fill = (unit, n = SIZE) => unit.repeat(Math.max(1, Math.floor(n / unit.length)));
const territory = (...extra) => ["# Territory", "", "| Pattern | Category | Effect | Why |", "|---|---|---|---|",
  "| `src/core/**` | `domain-core` | declare | the domain core, declared for the test |", ...extra, ""].join("\n");
const cites = ["# Architecture", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
  "| cited-symbols | applied | file:src/core/x.ts#guardFields |", ""].join("\n");
const base = (files) => ({ "package.json": JSON.stringify({ name: "m", type: "module" }), "runward/territory.md": territory(),
  "runward/architecture.md": cites, "src/core/y.ts": "export const y = 1;\n", ...files });
const core = (src) => base({ "src/core/x.ts": src });
const testFile = (src) => base({ "src/core/x.ts": "export function guardFields(a: number) { return a; }\n", "test/x.test.ts": src });
const IMPORT = "import { guardFields } from '../src/core/x.ts';\n";

/**
 * The CPU time of one reading, in milliseconds. Until 2026-11-06 the ceiling was read on the wall
 * clock, and one run of the suite at a load average near 50 stretched the star re-export shape from
 * 1.4 s, measured on a quiet machine, to 9.6 s: a ceiling that reddens on a busy machine is not a
 * measure of the reading.
 */
function cpu(fn) {
  const t0 = process.cpuUsage();
  fn();
  const t = process.cpuUsage(t0);
  return (t.user + t.system) / 1000;
}

function timed(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ceiling-"));
  const lock = { version: 1, writtenBy: "test", analysis: "runward-analysis/1", files: {} };
  try {
    for (const [rel, text] of Object.entries({ "runward/scaffold-lock.json": JSON.stringify(lock), ...files })) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
    }
    let reading;
    const ms = cpu(() => { reading = analyzeDelivery(join(dir, "runward")); });
    return { reading, ms };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Each shape: the family it reaches, what made it quadratic, the files. Measured before the corrections at
// 62,500 or 250,000 characters (2026-11-06): the time given is that measurement.
const SHAPES = [
  ["symbol", "`function` and blanks before another name (2.6 s at 50 KB)", () => core("export const guardFields = 1\nfunction" + " ".repeat(SIZE) + "other() {}\n")],
  ["symbol", "the cited name declared again and again with a parameter list left open (4.7 s at 250 KB)", () => core("export const guardFields = 1\n" + fill("function guardFields("))],
  ["symbol", "the same as an arrow (2.4 s at 250 KB)", () => core("export const guardFields = 1\n" + fill("const guardFields = ("))],
  ["linkage", "`export function` and blanks (6.5 s at 62 KB)", () => base({ "src/core/x.ts": "export function" + " ".repeat(SIZE) + "(\n", "src/core/z.ts": "import { guardFields } from './x.ts';\n" })],
  ["linkage", "an imported name and blanks before `as` (3.2 s at 1 MB)", () => base({ "src/core/x.ts": "export const guardFields = 1;\n", "src/core/z.ts": fill("import { a" + " ".repeat(3000) + "b } from './x.ts';\n") })],
  ["linkage", "star re-exports, each looking up its literal from the first (3 s at 1 MB)", () => base({ "src/core/x.ts": fill("export * from './y.ts';\n"), "src/core/z.ts": "import { guardFields } from './x.ts';\n" })],
  ["test-integrity", "cases left open, each scanned to the end (11 s at 250 KB)", () => testFile(IMPORT + fill("test('a', () => {"))],
  ["test-integrity", "cases nested in cases (18 s at 250 KB)", () => testFile(IMPORT + fill("test('a', () => {", SIZE / 2) + "guardFields(1)" + "})".repeat(Math.floor(SIZE / 34)))],
  ["test-integrity", "cases nested with a skip option (4 s at 250 KB)", () => testFile(IMPORT + fill("test('a', { skip: true }, () => {", SIZE / 2) + "guardFields(1)" + "})".repeat(Math.floor(SIZE / 66)))],
  ["test-integrity", "a promise type argument left open (13 s at 250 KB)", () => testFile(IMPORT + "test('a', async () => {\n" + fill("await new Promise<") + "\n});\n")],
  ["test-integrity", "a member chain read once per link (9.5 s at 62 KB)", () => testFile(IMPORT + "test('a', async () => {\nconst app = guardFields(1)\nconst q = app" + fill(".\tapp") + ";\nawait app.x.y();\n});\n")],
  ["test-integrity", "helpers each calling the next, the fixpoint re-reading every body (over 30 s at 62 KB)", () => testFile(IMPORT + "import assert from 'node:assert';\nconst h0 = (a) => assert.ok(a)\n" +
    Array.from({ length: Math.floor(SIZE / 40) }, (_, i) => `const h${i + 1} = (a) => h${i}(a)`).reverse().join("\n") + `\ntest('a', () => { h${Math.floor(SIZE / 40)}(guardFields(1)); });\n`)],
  ["test-integrity", "declarations on one line, each searching it for an arrow (1.8 s at 250 KB)", () => testFile(IMPORT + "test('a', () => {" + fill("const a = guardFields(1);") + "});\n")],
  ["test-integrity", "functions left open beside a case (29 s at 250 KB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\n" + fill("function f("))],
  ["test-integrity", "functions with a return type and no body (2.9 s at 1 MB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\n" + fill("function f(): "))],
  ["test-integrity", "assignments nested in parentheses (3.7 s at 62 KB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\n" + fill("a = ("))],
  ["test-integrity", "a chain of assignments (4.5 s at 62 KB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\nx = " + fill("a = ") + "guardFields\n")],
  ["capability", "`eval(` repeated, each tested for a declaration to its closer (7.7 s at 62 KB)", () => core("export const guardFields = 1;\n" + fill("eval("))],
  ["capability", "loaders of one bound name, each walking every occurrence (7 s at 62 KB)", () => core("export const guardFields = 1;\nconst m = 'node:fs';\n" + fill("require(m);"))],
  ["every family", "regular-expression literals left open, the masker reading each line to its end (5.5 s at 62 KB)", () => core("export const guardFields = 1;\nconst r = " + fill("(/[") + "\n")],
  ["every family", "a chain of arrows, each body read to the end (2.1 s at 62 KB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\nconst f = " + fill("a => ") + "1\n")],
  ["every family", "arrows opening a parenthesis left open (21 s at 250 KB)", () => testFile(IMPORT + "test('a', () => { guardFields(1); });\nconst f = " + fill("(a) => (") + "1\n")],
  ["allowances", "a heading line of `runward/analysis.md` with blank runs around one character (16 s at 4 KB)", () => ({ ...core("export const guardFields = 1;\n"),
    "runward/analysis.md": "# Analysis\n\n#\t" + "\t".repeat(SIZE / 2) + "x" + "\t".repeat(SIZE / 2) + "\u2028#\n" })],
  ["allowances", "a glob of many stars against a long file name (over 60 s for one name)", () => ({ ...core("export const guardFields = 1;\n"), [`src/core/${"a".repeat(200)}.ts`]: "export const z = 1;\n",
    "runward/analysis.md": "# Analysis\n\n## Not analysed\n\n| Path | Why |\n|---|---|\n| `src/core/" + "a*".repeat(14) + "b` | a pattern built to backtrack on long names |\n" })],
  ["territory", "a pattern of `runward/territory.md` holding a long run of slashes, its trailing ones stripped from every slash (7.7 s at 100,000 characters)", () => ({
    ...core("export const guardFields = 1;\n"), "runward/territory.md": territory("| `src/core/" + "/".repeat(SIZE) + "x` | `domain-core` | declare | a pattern built to make its trailing slashes slow |") })],
  ["territory", "the same glob in `runward/territory.md`", () => ({ ...core("export const guardFields = 1;\n"), [`src/core/${"a".repeat(200)}.ts`]: "export const z = 1;\n",
    "runward/territory.md": territory("| `src/core/" + "a*".repeat(14) + "b` | `domain-core` | declare | a pattern built to backtrack on long names |") })],
];

for (const [family, why, files] of SHAPES) {
  test(`${family}: ${why}, read in linear time at ${SIZE} bytes`, () => {
    const { reading, ms } = timed(files());
    assert.ok(reading, "the reading ran");
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms of CPU, over the ${CEILING_MS} ms ceiling`);
  });
}

// The evidence layer's comment reader (ADR-0114), which the gate runs on every file a `#SYMBOL` points at.
const COMMENT_SHAPES = [
  ["x.ts", "regular-expression literals left open (54 s at 250 KB)", () => "const r = " + fill("(/[") + "\n"],
  ["x.md", "an HTML comment opened and never closed, again and again (85 s at 250 KB)", () => fill("<!--")],
  ["x.html", "the same in HTML (44 s at 250 KB)", () => fill("<!-- a")],
  ["x.md", "code spans of every length, none closed (11 s at 250 KB)", () => { let s = "", k = 1; while (s.length < SIZE) s += "`".repeat(k++) + " x "; return s; }],
  ["x.yml", "a line of ` #` ending in a line separator (30 s at 250 KB)", () => "key: " + fill(" #") + "\u2028x\n"],
  ["x.yml", "a line of quotes, each read back to the line's start", () => "k: " + fill("a'")],
];
for (const [path, why, text] of COMMENT_SHAPES) {
  test(`evidence, comment reader: ${why}, read in linear time at ${SIZE} bytes`, () => {
    const t = text();
    let out;
    const ms = cpu(() => { out = withoutComments(t, path); });
    assert.equal(out.length, t.length, "every character kept or blanked, none lost");
    assert.ok(ms < CEILING_MS, `read in ${ms.toFixed(0)} ms of CPU, over the ${CEILING_MS} ms ceiling`);
  });
}

// A seeded generator: the same inputs on every run.
function generator(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

test("the allowance file's heading reads as the pattern it replaces read it, on 200,000 generated lines", () => {
  const PATTERN = /^#{1,6}\s+(.+?)\s*$/;
  const rnd = generator(1106);
  const alphabet = ["#", "#", " ", "\t", "\r", "\u2028", "\u00a0", "a", "B", "-", "x"];
  for (let t = 0; t < 200_000; t++) {
    const line = Array.from({ length: Math.floor(rnd() * 12) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join("");
    assert.equal(headingText(line), PATTERN.exec(line)?.[1] ?? null, JSON.stringify(line));
  }
});

test("the glob matcher answers as the dialect's pattern does, on 400,000 generated globs and paths", () => {
  const rnd = generator(611);
  const globParts = ["a", "b", "/", "*", "**", "?", ".", "\n", "**/", "/**", "["];
  const pathParts = ["a", "b", "/", ".", "\n", "\u2028", "\ud83d\ude00", "\r", "*"];
  for (let t = 0; t < 100_000; t++) {
    const glob = Array.from({ length: Math.floor(rnd() * 7) }, () => globParts[Math.floor(rnd() * globParts.length)]).join("");
    const re = globToRegExp(glob), m = globMatcher(glob);
    for (let u = 0; u < 4; u++) {
      const path = Array.from({ length: Math.floor(rnd() * 9) }, () => pathParts[Math.floor(rnd() * pathParts.length)]).join("");
      assert.equal(m.test(path), re.test(path), `${JSON.stringify(glob)} on ${JSON.stringify(path)}`);
    }
  }
});
