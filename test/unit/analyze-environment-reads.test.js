// ADR-0118, capability family: the declared domain core reads no environment.
//
// The reading looked for `process.env`, `import.meta.env`, `Deno.env` and `Bun.env` written with a dot.
// The reviewer of hono measured the miss on both builds of 2026-11-06: in the declared profile,
// `src/utils/color.ts:23` reads `'NO_COLOR' in process?.env` inside the core and was not reported, while
// express's `process.env.NODE_ENV` was. Each spelling of the same read is now one: optional chaining, a
// bracket holding the literal `'env'`, the object reached through `globalThis` or `global`, a destructuring
// of `env` from it. What is not that read stays quiet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { analyzeDelivery } from "../../dist/lib/analyze.js";

function delivery(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-analyze-env-"));
  const lock = { version: 1, writtenBy: "test", analysis: "runward-analysis/1", files: {} };
  const all = { "runward/scaffold-lock.json": JSON.stringify(lock), ...files };
  for (const [rel, text] of Object.entries(all)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  try { return analyzeDelivery(join(dir, "runward")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const CORE = ["# Territory", "", "| Pattern | Category | Effect | Why |", "|---|---|---|---|",
  "| `src/core/**` | `domain-core` | declare | the domain core, declared for the test |", ""].join("\n");
const envLines = (src) => delivery({ "runward/territory.md": CORE, "src/core/x.ts": src }).findings
  .filter((f) => f.family === "capability" && f.check === "environment").map((f) => f.line).sort((a, b) => a - b);

test("every spelling of the environment read in the core is a finding, hono's `process?.env` included", () => {
  const src = [
    "export function color() {",
    "  const { process, Deno } = globalThis as any",            // 2: binds the name, reads nothing yet
    "  return 'NO_COLOR' in process?.env",                       // 3: hono src/utils/color.ts:23
    "}",
    "export const a = process.env.NODE_ENV",                     // 5: express's spelling, found before
    "export const b = process['env'].HOME",                      // 6
    "export const c = process?.[\"env\"]",                       // 7
    "export const d = globalThis.process.env.PATH",              // 8
    "export const e = globalThis?.process?.env",                 // 9
    "export const f = global.process['env']",                    // 10
    "const { env } = process",                                   // 11
    "const { env: vars, argv } = globalThis.process",            // 12
    "export const g = import.meta?.env",                         // 13
    "export const h = Deno?.env.get('X')",                       // 14
  ].join("\n") + "\n";
  assert.deepEqual(envLines(src), [3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
});

test("what is not the environment read stays quiet", () => {
  const src = [
    "const key = 'env'",
    "export const a = process[key]",            // a computed member: not settled, not read as one
    "export const b = process.cwd()",
    "export const c = process.environment",     // another member
    "export const d = myprocess.env",           // another object
    "export const e = 'process.env'",           // a string
    "// process.env.SECRET in a comment",
    "export const f = { process: { env: 1 } }.process.env", // a member of an object literal, not the global
    "const { argv } = process",                 // destructured, without env
    "const { env } = process.versions",         // destructured from another object
  ].join("\n") + "\n";
  assert.deepEqual(envLines(src), []);
});

test("an environment allowance of the file still covers every spelling", () => {
  const allow = ["# Analysis", "", "## Allowed capabilities", "", "| Path | Capability | Why |", "|---|---|---|",
    "| `src/core/x.ts` | environment | the colour switch reads NO_COLOR, by decision |", ""].join("\n");
  const r = delivery({ "runward/territory.md": CORE, "runward/analysis.md": allow, "src/core/x.ts": "export const x = 'NO_COLOR' in process?.env\nconst { env } = process\n" });
  assert.deepEqual(r.findings.filter((f) => f.check === "environment"), []);
});
