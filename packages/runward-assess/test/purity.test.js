// The score is a pure function: it reaches no file, clock, environment, network, process or chance,
// statically (its import closure) and at run time (everything it could reach is poisoned).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { PKG } from "./helpers.js";

const SPEC = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const IMPURE_CALL = /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bDate\s*\(|\bMath\.random\s*\(|\bprocess\.(?:env|argv|cwd|hrtime|platform|version)\b|\bperformance\.now\s*\(|\bfetch\s*\(|\bglobalThis\.fetch\b|\blocaleCompare\s*\(|\btoLocale\w*\s*\(|\bIntl\./;
const ALLOWED_BUILTINS = new Set(["node:crypto"]);

/** The import closure of a module: relative imports followed, every builtin and package recorded. */
export function closure(entry) {
  const seen = new Set();
  const queue = [resolve(entry)];
  const external = new Map();
  const impure = [];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(SPEC)) {
      if (m[1].startsWith(".")) queue.push(resolve(dirname(f), m[1]));
      else if (!external.has(m[1])) external.set(m[1], f);
    }
    if (/\brequire\s*\(|createRequire/.test(src)) impure.push(`${f}: require or createRequire`);
    const call = src.match(IMPURE_CALL);
    if (call) impure.push(`${f}: ${call[0]}`);
  }
  return { files: seen, external, impure };
}

const PURE = ["src/score.js", "src/diff.js", "src/report-md.js", "src/report-html.js", "src/predicates.js", "src/grid-model.js", "src/canon.js"];

test("the score, the reports and the evolution import nothing but node:crypto and each other", () => {
  for (const rel of PURE) {
    const { files, external, impure } = closure(join(PKG, rel));
    assert.ok(files.size >= 1);
    for (const [spec, from] of external) assert.ok(ALLOWED_BUILTINS.has(spec), `${from} imports ${spec}: the score must stay pure`);
    assert.deepEqual(impure, [], `${rel} reaches something impure`);
  }
  const { files } = closure(join(PKG, "src/score.js"));
  assert.ok(files.size >= 4, `the walk followed the real graph (${files.size} modules)`);
});

test("positive control: the same walk sees a planted file system import, clock read and environment read", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-assess-purity-"));
  try {
    writeFileSync(join(dir, "a.js"), 'import { b } from "./b.js";\nexport const a = () => b();\n');
    writeFileSync(join(dir, "b.js"), 'import { readFileSync } from "node:fs";\nexport const b = () => Date.now() + process.env.TZ;\n');
    writeFileSync(join(dir, "c.js"), 'export const c = (x, y) => x.localeCompare(y);\n');
    const r = closure(join(dir, "a.js"));
    assert.ok(r.external.has("node:fs"), "the file system import is seen through a relative hop");
    assert.ok(r.impure.some((x) => /Date\.now/.test(x)), "the clock read is seen");
    assert.ok(closure(join(dir, "c.js")).impure.some((x) => /localeCompare/.test(x)), "a locale-dependent sort is seen");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("at run time, with Date, Math.random, fetch and process.env poisoned, the score still emits", () => {
  const script = `
    const poison = (name) => new Proxy(function () {}, { get() { throw new Error("touched " + name); }, apply() { throw new Error("called " + name); }, construct() { throw new Error("constructed " + name); } });
    const { score } = await import(${JSON.stringify(join(PKG, "src/score.js"))});
    const { reportMarkdown } = await import(${JSON.stringify(join(PKG, "src/report-md.js"))});
    const { reportHtml } = await import(${JSON.stringify(join(PKG, "src/report-html.js"))});
    const h = await import(${JSON.stringify(join(PKG, "test/helpers.js"))});
    const inp = h.inputs({ facts: { "m.gou04.absence_factor": 1, "x.gou02.reviewed": { n: 1, d: 2 } } });
    globalThis.Date = poison("Date"); Math.random = poison("Math.random"); globalThis.fetch = poison("fetch");
    Object.defineProperty(process, "env", { get() { throw new Error("touched process.env"); } });
    const r = score({ ...h.bundle, ...inp });
    reportMarkdown(r, h.G.grid); reportHtml(r, h.G.grid);
    console.log("ok " + r.digest);`;
  const p = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /^ok [0-9a-f]{64}/);
  // positive control: the poison does fire on code that reads the clock
  const c = spawnSync(process.execPath, ["--input-type=module", "-e", `globalThis.Date = new Proxy(function(){}, { get(){ throw new Error("touched Date"); } }); Date.now();`], { encoding: "utf8" });
  assert.notEqual(c.status, 0);
  assert.match(c.stderr, /touched Date/);
});
