// The string sub-scanner of `readToml` — where a TOML string STARTS, where it ENDS, and what it
// carries (ADR-0043, src/lib/territory.ts).
//
// Measured, not assumed. The full mutation pass of 2026-08-05 left 179 mutants alive against the
// whole net; three of them live in these six lines, and on 2026-08-08 each was applied to `dist/`
// and the 346-test suite stayed green:
//
//   L126  `line.split(openMulti[1]).length === 2`  ->  true   (a one-line `"""…"""` opens a block)
//   L136  `c + (line[i + 1] ?? "")`                ->  `&&`   (an escape drops its second char)
//   L145  `c === '"' || c === "'"`                 ->  `|| false` (a literal string never opens)
//
// What is at stake, stated honestly and no higher. NOTHING on the gate path reads territory:
// `check`, `check --strict` and `check --json` never import it, so no mutant here can turn a
// refusal into a pass. Verified again for this lot on 2026-08-08 — with L145 mutated, `runward
// init --yes --example` + `check --strict` still exits 0, unchanged. The derivation reaches
// `runward rules --for` (which always exits 0 by design) and the territory section of
// `runward status`.
//
// What it corrupts instead is the proof surface. `rules --for --json` publishes, per the
// `git check-ignore -v` model, WHICH declaration in WHICH file bound a path to a category. A
// mis-scan never says "I could not read this manifest": it answers plausibly, with a schedule that
// vanished or an environment name that was never written. That silent-plausible answer is the one
// failure mode this module exists to avoid (ADR-0035: "nothing is declared" and "I could not read
// it" are different answers).
//
// Every guard below is pinned in BOTH directions. A fixture that only ever expects "derives
// nothing" is satisfied by a scanner that derives nothing at all, and a fixture that only ever
// expects "derives the schedule" is satisfied by a scanner that never opens a string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers } from "../../dist/lib/territory.js";

/** A project root holding one entry module and one hand-written wrangler.toml. */
function derive(toml, assertions) {
  const dir = mkdtempSync(join(tmpdir(), "rw-toml-str-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), "export default {}\n");
  writeFileSync(join(dir, "wrangler.toml"), toml);
  try { assertions(deriveCloudflareWorkers(dir)); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();
const decls = (d) => [...new Set(d.bindings.map((b) => b.via.declaration))].sort();
const SCHEDULED = ["src/index.ts:background-work", "src/index.ts:scheduled-work"];

// ── Where a multi-line string starts ────────────────────────────────────────────────────────────
// `if (openMulti && line.split(openMulti[1]).length === 2)`: a `"""` seen ONCE on a line opens a
// block that runs to the next `"""`; a `"""` seen twice opens and closes on that same line and
// changes nothing. Both halves decide whether the REST OF THE FILE is manifest or string content.

test("a `\"\"\"` opened and closed on ONE line does not swallow the rest of the manifest", () => {
  // The dangerous direction, and the one that survives the whole suite today: drop the
  // occurrence-count test (`… .length === 2` -> `true`) and every line carrying a triple quote
  // opens a block. Here that block never closes, so `[triggers]` and its cron are read as string
  // content, the Worker comes back with ZERO bindings, and the note says "no schedule or queue
  // consumer declared" — runward asserting an absence it manufactured itself. A one-line
  // `"""…"""` description beside `main` is ordinary hand-written TOML, not an edge case.
  derive(`main = "src/index.ts"
description = """one line, opened and closed"""

[triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the block closed on its own line; the cron below it is a declaration");
    assert.deepEqual(d.notes, [], "a manifest that declared a schedule owes no 'nothing declared' note");
  });
});

test("a `\"\"\"` opened and NOT closed does swallow what follows — the guard is not a no-op", () => {
  // The opposite direction, so no constant satisfies the pair. Forcing the open test to `false`
  // would make this file report a schedule that exists only inside a string literal — a decoy
  // `[triggers]` promoted to a declaration, which is the same lie facing the other way.
  derive(`main = "src/index.ts"
description = """
[triggers]
crons = ["0 3 * * *"]
"""
`, (d) => {
    assert.deepEqual(d.bindings, [], "a `[triggers]` inside a block string is text, never a declaration");
    assert.equal(d.notes.length, 1);
    assert.equal(d.notes[0].outcome, "read", "the manifest WAS read — the absence is declared, not a failure");
    assert.match(d.notes[0].detail, /no schedule or queue consumer declared/);
  });
});

// ── Where a string starts: single quotes count too ──────────────────────────────────────────────
// `if (c === '"' || c === "'")`. TOML has two string forms and the comment scanner must honour
// both. Only the double-quoted half is pinned by the existing suite, so the single-quoted half is
// the one a mutation can delete in silence.

test("a `#` inside a LITERAL (single-quoted) string is a character, not the start of a comment", () => {
  // The dangerous direction: with the `'` half of the guard removed, this `#` ends the line, the
  // value truncates to `['sharp` — an array whose bracket never balances — and the array-
  // continuation loop then eats the blank line, the `[triggers]` header AND its cron looking for
  // the closing bracket. Result: zero bindings and a manufactured "no schedule declared" on a
  // manifest that plainly declares one. Single-quoted values are the TOML idiom for text that
  // must not be escaped, which is exactly the text most likely to contain a `#`.
  derive(`main = "src/index.ts"
tags = ['sharp # inside']

[triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the `#` never left the literal string; `[triggers]` is still a header");
    assert.deepEqual(d.notes, []);
  });
});

test("a `#` OUTSIDE any string still ends the line — the guard opens strings, it does not disable comments", () => {
  // The opposite direction. A scanner that treated `#` as an ordinary character everywhere would
  // pass the test above and fail here: the comment carries an unbalanced `[`, so leaving it in the
  // value opens an array continuation that swallows the real `[triggers]` header below it. The
  // pair therefore admits no constant — neither "always inside a string" nor "never".
  derive(`main = "src/index.ts"
tags = ['a']  # TODO: move this into [triggers

[triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the comment was stripped before the bracket count was taken");
    assert.deepEqual(d.notes, []);
  });
});

// ── What an escape carries ──────────────────────────────────────────────────────────────────────
// `stripped += c + (line[i + 1] ?? "")`. Inside a basic string, `\` and the character after it are
// ONE unit and both belong to the value. The `i++` beside it is what stops an escaped quote from
// closing the string; this line is what stops the escaped character from disappearing from the
// text runward then reports as evidence.

test("an escape carries BOTH characters, so the declaration names the environment that was written", () => {
  // The dangerous direction, and the subtle one: mutate `??` to `&&` and the escaped character is
  // dropped while the state machine still steps over it. Nothing crashes, nothing is missing — the
  // schedule is still derived. Only the EVIDENCE changes: `rules --for` reports the cron as
  // declared by `env."d\ev".triggers.crons`, an environment name that appears nowhere in the
  // manifest. A reader who greps the file for the reason runward gave finds nothing, which is
  // worse than no reason at all. Quoted table keys are how TOML spells an environment whose name
  // is not a bare word.
  derive(`main = "src/index.ts"

[env."d\\"ev".triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the escaped quote did not close the key, so this is still a triggers table");
    assert.deepEqual(decls(d), ['env."d\\"ev".triggers.crons'],
      "the declaration is quoted back exactly as written, escape included");
  });
});

test("a plain environment name comes back verbatim too — the escape path is not the only path", () => {
  // The opposite direction: a mutation that rewrote every value, or that never entered the escape
  // branch at all, must not be able to satisfy the test above by accident. An unescaped name is
  // the nominal case and it is pinned to the character.
  derive(`main = "src/index.ts"

[env.dev.triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED);
    assert.deepEqual(decls(d), ["env.dev.triggers.crons"]);
  });
});
