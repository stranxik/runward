// The second pass of `stripJsonc`: what it may edit, and what it must leave alone (ADR-0043).
//
// `stripJsonc` runs two two-state automata over the manifest — one drops comments, one drops
// trailing commas — and both decide the same thing on every character: am I inside a string
// literal? The comment pass is pinned by `territory-jsonc.test.js`. The trailing-comma pass is
// not: the mutation pass of 2026-08-05 left three survivors there, all with the same effect —
// `if (inStr)` forced false, `if (c === '"')` forced false, and `inStr = true` flipped to false.
// Measured on 2026-08-08, the three produce byte-identical output on 100 000 random inputs: each
// one makes the trailing-comma pass STRING-BLIND, and a string-blind pass eats a comma that lives
// inside a string literal whenever a `}` or a `]` follows it.
//
// What that costs. The manifest still parses — removing a character from inside a string keeps
// the JSON valid — so nothing refuses. Only the CONTENT of a string changes, and the one string
// content runward reads is `main`. Measured on a real mission: the entry module silently loses
// every category, `status` goes from "1 of 129 walked file(s) carry a category" to "0 of 129",
// and the note printed blames the operator for a path that is sitting right there on disk
// ("`main` does not resolve to a file in the project"). `check --strict` exits 0 throughout, in
// both directions — no gated deliverable reads a derivation. So this is not a verdict defect: it
// is a proof surface that lies under a correct verdict, which for this tool is a defect of its
// own, and nothing in the 346-test suite sees it.
//
// The fixture is deliberately adversarial — a directory named `[a,]` is not what anyone ships.
// That is the point and it is stated rather than dressed up: the invariant being pinned is that
// the trailing-comma pass has NO business rewriting string content, whatever that content is.
// A pass that is right only on the paths we happened to imagine is right by luck.
//
// Both directions are exercised, in two isolated cases: one manifest that may not be edited
// inside its strings, one manifest whose structural trailing commas must still be removed. A
// suite holding only the first is satisfied by a pass that removes nothing at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers } from "../../dist/lib/territory.js";

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-jsonc-str-"));
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}
const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();

test("a comma inside a string literal is content, never a trailing comma to remove", () => {
  // Pins the string state of the trailing-comma pass: `if (inStr)`, `if (c === '"')`, and
  // `inStr = true` — the three are one decision and one test reddens all three. Dangerous
  // direction: a pass that ignores string state deletes the comma in `[a,]` from the value of
  // `main`, the entry resolves to nothing, the file loses its categories, and runward reports a
  // path it cannot find while the file exists. The manifest still parses, so no refusal fires and
  // the loss is silent — the worst shape a derivation error can take.
  //
  // Isolated on purpose: this manifest carries NO structural trailing comma anywhere, so the only
  // thing that can redden it is the pass editing a string.
  const dir = repo({
    "src/[a,]/worker.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "main": "src/[a,]/worker.ts",
  "triggers": { "crons": ["0 3 * * *"] }
}`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), ["src/[a,]/worker.ts:background-work", "src/[a,]/worker.ts:scheduled-work"],
      "the entry module keeps the exact path the manifest declared, comma included");
    assert.deepEqual(d.notes, [], "and no note claims the entry does not resolve");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a structural trailing comma is still removed, so the pass is not merely inert", () => {
  // The opposite direction, isolated in its own fixture: no string in this manifest contains a
  // comma, so nothing here can redden except the removal itself failing. Dangerous direction: a
  // pass made string-BLIND in the other sense — one that thinks it is inside a string forever —
  // keeps every trailing comma, `JSON.parse` refuses the manifest, and the outcome flips to
  // `unread`. Cloudflare's own canonical manifest carries trailing commas, so this is the
  // nominal case and not an edge one.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *", ] },
}`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), ["src/index.ts:background-work", "src/index.ts:scheduled-work"],
      "both trailing commas are dropped and the manifest reads");
    assert.equal(d.notes.length, 0, "and the manifest is never declared unread");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
