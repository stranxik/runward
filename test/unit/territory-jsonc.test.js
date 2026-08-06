// Unit tests for the JSONC scanner behind `deriveCloudflareWorkers` (ADR-0043).
//
// Found by the full mutation pass of 2026-08-04: `stripJsonc` carried 20 survivors that the
// existing territory suite lets through. It is a two-state automaton run twice — once to drop
// comments, once to drop trailing commas — and both passes decide the same thing: whether the
// character under the cursor is INSIDE a string literal. Get that parity wrong for one character
// and it stays wrong for the rest of the file.
//
// What is at stake is not the gate. Measured on 2026-08-05: with the scanner broken so hard that
// every JSONC manifest becomes unreadable, `check --strict` still exits 0 — no gated deliverable
// reads a derivation. What breaks is the answer to "which rules govern this file": `rules --for`
// went from 3 matched rules to 1, and `status` from 1 covered file to 0, both silently and both
// exit 0. A rule that is never surfaced is a rule that is never applied. That is a lying proof
// surface under a correct verdict, which for this tool is a defect of its own.
//
// Each case states the decision it pins and the direction that would be dangerous. Refusal cases
// sit beside acceptance cases on purpose: a suite that only ever asserts "derives the two
// categories" is satisfied by a scanner that returns its input unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers } from "../../dist/lib/territory.js";

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-jsonc-"));
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}
const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();
const SCHEDULED = ["src/index.ts:background-work", "src/index.ts:scheduled-work"];

// ── Pass one: the comment stripper ──────────────────────────────────────────────────────────────

test("an escaped quote does not end the string, so a `//` inside a value is never a comment", () => {
  // Pins: `if (c === "\\")` in the comment pass. Dangerous direction: dropping the escape makes
  // the NEXT character close the string, so the scanner is outside a literal while the file says
  // it is inside — and the `//` of a quoted URL then eats the rest of the line, `main` included.
  // A message that quotes a link is the ordinary shape here, not an adversarial one.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "vars": { "MOTD": "see \\"https://runward.dev//gate\\" before you push" },
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] }
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), SCHEDULED,
      "the declarations after a quoted URL are still read");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a block comment ends at its `*/`, not at the first `*` it contains", () => {
  // Pins the closing test of the block-comment skip. Dangerous direction: stopping at any `*`
  // spills the tail of the comment into the JSON, and the manifest becomes unreadable. `/** … */`
  // is how people decorate a comment, and a cron written out in prose contains `*` too.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  /** the entry point — runs on a 0 3 * * * schedule */
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] }
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), SCHEDULED,
      "the whole block comment is skipped, and what follows it is read");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a manifest that does not parse is UNREAD — never quietly repaired into one that does", () => {
  // The opposite direction, and the module's own contract: what does not parse throws, so the
  // refusal is free and we never guess. Pins `c === "/" && text[i+1] === "*"`. Dangerous
  // direction: loosening either half turns a stray `*/`, or a `/ *` typed with a space, into a
  // comment that swallows the damage — and runward then derives categories from a file it should
  // have declined to read. Deriving from a broken manifest is worse than deriving nothing.
  const dangling = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": ["0 3 * * *"] } }\n*/\n`,
  });
  const typo = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{ / * the entry */ "main": "src/index.ts", "triggers": { "crons": ["0 3 * * *"] } }`,
  });
  try {
    for (const [label, dir] of [["a dangling `*/`", dangling], ["a `/ *` typo", typo]]) {
      const d = deriveCloudflareWorkers(dir);
      assert.equal(d.bindings.length, 0, `${label}: nothing is derived from a manifest that does not parse`);
      assert.equal(d.notes[0].outcome, "unread", `${label}: and the outcome is 'unread', not 'nothing declared'`);
    }
  } finally {
    rmSync(dangling, { recursive: true, force: true });
    rmSync(typo, { recursive: true, force: true });
  }
});

test("a `//` comment on the last line, with no newline after it, terminates", () => {
  // Pins the bound of the line-comment skip. Dangerous direction: dropping `i < text.length`
  // leaves the cursor walking past the end forever. This one cannot be reddened in process — a
  // synchronous spin blocks the runner's own timer — so it is measured in a child that is given
  // four seconds to answer. A file whose last line is a comment and whose last byte is not a
  // newline is not exotic; several editors write exactly that.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] }
}
// the scheduled worker`,
  });
  const mod = new URL("../../dist/lib/territory.js", import.meta.url).href;
  try {
    const out = execFileSync(process.execPath, ["-e",
      `import(${JSON.stringify(mod)}).then((m) => {
         const d = m.deriveCloudflareWorkers(${JSON.stringify(dir)});
         console.log(d.bindings.map((b) => b.category).sort().join(","));
       })`,
    ], { encoding: "utf8", timeout: 4000 });
    assert.equal(out.trim(), "background-work,scheduled-work", "and the manifest is still read correctly");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Pass two: the trailing-comma remover ────────────────────────────────────────────────────────

test("a trailing comma sitting right after a string value is removed", () => {
  // Pins `if (c === '"') inStr = false` in the trailing-comma pass. Dangerous direction: a scanner
  // that leaves the string state on after the closing quote treats the comma that follows as
  // literal text, keeps it, and JSON.parse then refuses the whole manifest. A last key holding a
  // string, with a trailing comma after it, is the most ordinary JSONC there is.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] },
  "compatibility_date": "2026-08-05",
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), SCHEDULED,
      "the trailing comma after the last string value is dropped, and the manifest reads");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a trailing comma before a closing BRACKET is removed, not only before a brace", () => {
  // Pins both halves of `out[k] === "}" || out[k] === "]"`. Dangerous direction: handling only the
  // brace leaves `["…", ]` in place, and the whole manifest becomes unreadable — a trailing comma
  // in a cron list is exactly what an editor leaves behind when a schedule is deleted.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *", ] }
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), SCHEDULED,
      "the trailing comma inside the array is dropped");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an escaped quote does not flip the trailing-comma pass into thinking it is inside a string", () => {
  // Pins `if (c === "\\")` in the trailing-comma pass. Dangerous direction: dropping the escape
  // inverts the string parity for the REST of the file — every structural comma then looks like
  // literal text, the trailing one is kept, and the manifest stops parsing. A single escaped quote
  // is enough to flip it: here a var holds the quote character a CSV export uses.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "vars": { "CSV_QUOTE": "\\"" },
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] },
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), SCHEDULED,
      "one escaped quote does not cost the rest of the manifest");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Both passes: an escape is unescaped, never dropped ──────────────────────────────────────────

test("a JSON escape inside `main` is kept for JSON.parse, never swallowed by the scanner", () => {
  // Pins `out += c + (text[i+1] ?? "")` in both passes. Dangerous direction: emitting nothing
  // instead of the pair silently deletes two characters from a value runward actually reads —
  // `src\/index.ts` becomes `srcindex.ts`, resolves to no file, and the entry module loses its
  // categories while the manifest still parses. `\/` is legal JSON and several encoders emit it
  // by default, so the file is valid and the failure is silent: the worst combination.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{ "main": "src\\/index.ts", "triggers": { "crons": ["0 3 * * *"] } }`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), SCHEDULED, "the escaped separator resolves to the real entry module");
    assert.equal(d.notes.length, 0, "and no 'does not resolve' note is produced");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
