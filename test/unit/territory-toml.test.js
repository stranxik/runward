// The TOML scanner behind category derivation (ADR-0043).
//
// Found by the full mutation pass of 2026-08-04: `readToml` in src/lib/territory.ts carried 42
// survivors that the whole net — unit suite, `check --strict`, OSCAL validation, smoke — left
// alive. The reason it survives the gate is worth stating plainly: NOTHING on the gate path reads
// territory. `check` does not import it; the derivation reaches `runward rules --for` (which
// always exits 0 by design) and the territory section of `runward status`. Corrupting this
// scanner therefore cannot turn a refusal into a pass.
//
// What it does corrupt is the evidence. `rules --for --json` is a machine contract an agent drives
// on, and each match is rendered on the `git check-ignore -v` model: this rule governs this file
// BECAUSE of that declaration, in that file, at that line. A mis-scan there does not say "I could
// not read it" — it answers plausibly with the wrong list, which is the one failure mode this
// module exists to avoid. Measured on 2026-08-04: with `if (arrHead)` forced false, a mission's
// derivation silently drops a queue-consumer binding and `check --strict` still exits 0.
//
// So these cases pin the scanner itself, not a verdict. Each one names the decision it holds and
// the direction that would be dangerous, and every guard is pinned in both directions — a fixture
// that only ever expects "derives nothing" is satisfied by a scanner that derives nothing at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers } from "../../dist/lib/territory.js";

/** A project root holding an entry module and one wrangler.toml. */
function repo(toml) {
  const dir = mkdtempSync(join(tmpdir(), "rw-toml-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), "export default {}\n");
  writeFileSync(join(dir, "wrangler.toml"), toml);
  return dir;
}
const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();
const SCHEDULED = ["src/index.ts:background-work", "src/index.ts:scheduled-work"];

/** Run a fixture and hand the derivation to the assertions, always cleaning up. */
function derive(toml, assertions) {
  const dir = repo(toml);
  try { assertions(deriveCloudflareWorkers(dir)); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ── The comment scanner ─────────────────────────────────────────────────────────────────────────
// `#` outside a string ends the line; inside one it is a character. Both halves are load-bearing
// and both are pinned here, because either constant alone satisfies a one-sided test.

test("a `#` comment after a quoted value is stripped, so `main` still resolves", () => {
  // The dangerous direction: any mutation that leaves the scanner permanently "inside a string"
  // (`inStr = true` at the top, `if (inStr)` forced true, the escape branch widened to every
  // character) never strips this comment. `main` then reads `src/index.ts" # the entry module`,
  // resolves to nothing, and the manifest reports "nothing derived" for a Worker that declares a
  // cron. A trailing comment on `main` is the nominal shape of a hand-written wrangler.toml.
  derive(`name = "acme # 1"
main = "src/index.ts" # the entry module

[triggers]
crons = ["0 3 * * *"] # nightly
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the comment ends the line; the value before it is intact");
    assert.deepEqual(d.notes, [], "a manifest this ordinary produces no note at all");
  });
});

test("a `#` inside a string is a character, and never truncates the array holding it", () => {
  // The opposite direction, without which a scanner that simply never enters a string would pass
  // the case above. Truncating here costs the closing bracket, the bracket-balance loop then eats
  // the rest of the FILE, and the `[triggers]` two lines below disappears. The `#` does not even
  // sit on a line runward reads — a documentation anchor in `[vars]` is enough.
  derive(`main = "src/index.ts"

[vars]
DOC_LINKS = ["https://acme.dev/docs#install", "https://acme.dev/docs#gates"]

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED,
    "an anchored URL in an unrelated table must not eat the declarations below it"));
});

test("an escaped quote does not end its string, so the `#` after it stays literal", () => {
  // Pins the escape branch. Dropping it (or restricting it to single-quoted strings) closes the
  // string on the escaped `"`, the following `#` is then read as a comment, the array loses its
  // `]`, and the bracket loop swallows `[triggers]`. Same corruption as above, reached through the
  // other half of the scanner.
  derive(`main = "src/index.ts"

[vars]
QUOTED = ["say \\" then # not a comment"]

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED,
    "\\\" is one escaped character, not the end of the string"));
});

test("a backslash in a LITERAL string escapes nothing, so the string still ends on its own quote", () => {
  // The counterweight to the case above, and the reason the escape branch is guarded by the quote
  // type. TOML literal strings ('...') process no escapes at all — `'C:\'` is the canonical
  // Windows volume root from the spec. Let the escape branch fire there and it eats the closing
  // quote, the trailing comment is then read as string content, and the aside it opens is never
  // closed — so the array loop keeps walking and swallows every declaration below. An unclosed
  // bracket in a hand-written comment is exactly the debris a manifest accumulates; a scanner
  // that reads comments only because it lost track of a string is how it gets weaponised.
  derive(`main = "src/index.ts"

[vars]
WINDOWS_ROOTS = ['C:\\']  # volume roots [the backslash is literal here

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED,
    "a backslash before a literal string's closing quote is a character, not an escape"));
});

// ── Multi-line strings ──────────────────────────────────────────────────────────────────────────
// A `"""` block can contain anything, including a decoy `[triggers]`. It must swallow exactly its
// own body: one line less and prose becomes a declaration, one line more and real declarations
// vanish. Both errors are pinned.

test("a multi-line string gives the file back when it closes", () => {
  // The dangerous direction: a block that never closes (the close test forced false, or the flag
  // set to `true` instead of `false` so the next line is tested against the string "true") eats
  // every declaration below it. The manifest then reports "no schedule declared" for a Worker
  // whose only fault was carrying a description.
  derive(`main = "src/index.ts"
description = """
Nightly rebuild. See [triggers] below.
"""

[triggers]
crons = ["0 3 * * *"]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the block ends at its own delimiter, not at the end of file");
    for (const b of d.bindings) assert.ok(b.via.line > 0, "each binding still carries its line");
  });
});

test("a decoy table on the second line of a multi-line string is not a declaration", () => {
  // The opposite direction, and the reason the decoy is on the SECOND body line: a block that
  // closes one line too early was invisible to the existing fixture, whose decoy sat on the first.
  // Here the early close turns documented prose into a real `[triggers]` table and derives a
  // schedule nobody declared — evidence pointing at a line that says the opposite.
  derive(`main = "src/index.ts"
description = """
Scheduling is documented right here.
[triggers]
crons = ["6 6 * * *"]
"""
`, (d) => {
    assert.deepEqual(d.bindings, [], "prose inside a string declares nothing");
    assert.equal(d.notes.length, 1);
    assert.equal(d.notes[0].outcome, "read", "read-and-silent is not the same answer as unread");
  });
});

// ── Line shapes runward does not model ──────────────────────────────────────────────────────────

test("a legal TOML line runward does not model is skipped, never fatal", () => {
  // A quoted key carrying spaces is valid TOML and matches no key/value shape this scanner
  // recognises. Dropping the guard that skips it turns the miss into a TypeError, and an adapter
  // that throws takes `rules --for` and `status` down with it — a crash where the contract is a
  // note. Refusing to read a line is an answer; dying on it is not.
  derive(`main = "src/index.ts"
"key with spaces" = 1

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED, "the unmodelled line is stepped over, the rest is read"));
});

test("an unterminated array at the end of the file stops at the end of the file", () => {
  // The bracket loop walks forward while brackets are unbalanced. Off by one on its bound and it
  // reads past the last line, splits `undefined`, and throws. Malformed input must degrade to a
  // note, never to a stack trace.
  derive(`main = "src/index.ts"

[triggers]
crons = ["0 3 * * *"]

[vars]
BROKEN = ["a",
`, (d) => assert.deepEqual(cats(d), SCHEDULED,
    "the declarations read before the broken line are kept, and nothing throws"));
});

test("a bracket inside a scalar string does not open a multi-line array", () => {
  // The opposite bound of the same loop: only a value that STARTS with `[` continues across
  // lines. Let every value in, and one unclosed bracket inside an ordinary string sends the loop
  // through the rest of the manifest, taking `[triggers]` with it.
  derive(`main = "src/index.ts"

[vars]
LOG_PREFIX = "[acme"

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED,
    "a `[` inside a scalar is a character, not the start of an array"));
});

// ── Arrays that span lines ──────────────────────────────────────────────────────────────────────
// Several crons are normally written one per line. If the continuation is not consumed, the value
// read is the bare `[` — and `tomlStringList` answers "no strings", which the caller reports as
// `crons` being an EMPTY array: a declared ABSENCE of scheduling. A declared schedule inverted
// into a declared absence is the worst answer this module can give, because it is a positive
// statement about the manifest rather than a silence.

test("a cron array spanning several lines is a declared schedule", () => {
  // The comment line inside the array is deliberate: it is the first continuation line and it
  // carries no bracket at all, which is what separates a depth counter that keeps counting from
  // one that gives up (NaN) or dies (null) on it.
  derive(`main = "src/index.ts"

[triggers]
crons = [
  # nightly rebuild
  "0 3 * * *",
  "0 4 * * *"
]
`, (d) => {
    assert.deepEqual(cats(d), SCHEDULED, "the array is read whole, across its lines and past its comment");
    assert.deepEqual(d.notes, [], "nothing here is an absence of scheduling");
  });
});

test("a multi-line array that really is empty is a declared absence, not a schedule", () => {
  // The direction that forbids satisfying the case above with "always emit". The docs are explicit
  // that commenting the key does not disable a trigger, so `crons = []` is a positive statement
  // and must survive as one — spread over two lines exactly like the schedule above.
  derive(`main = "src/index.ts"

[triggers]
crons = [
]
`, (d) => {
    assert.deepEqual(d.bindings, [], "an empty array declares no scheduled work");
    assert.match(d.notes.map((n) => n.detail).join(" "), /declared absence of scheduling/);
    assert.ok(d.notes.every((n) => n.outcome === "read"), "read-and-empty is never 'unread'");
  });
});

// ── One table, several keys ─────────────────────────────────────────────────────────────────────

test("a root key declared after `main` does not erase it", () => {
  // The table map is created once per table and filled key by key. Re-creating it on every key
  // keeps only the LAST one, and `main` is almost never last: `main` then `compatibility_date` is
  // the canonical head of a wrangler.toml. The manifest would then report "no root `main`
  // (assets-only Worker)" about a Worker that declares one two lines up.
  derive(`name = "acme-api"
main = "src/index.ts"
compatibility_date = "2024-05-01"

[triggers]
crons = ["0 3 * * *"]
`, (d) => assert.deepEqual(cats(d), SCHEDULED, "every key of a table survives the next one"));
});

test("an `[[array of tables]]` header is a queue consumer, and a plain header is not", () => {
  // `[[queues.consumers]]` is the only shape that makes a Worker background work without a cron.
  // Missing the double-bracket header loses that binding in silence — measured: the derivation
  // drops it and `check --strict` still exits 0, so the report is the only place the loss shows.
  derive(`main = "src/index.ts"

[[queues.consumers]]
queue = "jobs"
`, (d) => assert.deepEqual(cats(d), ["src/index.ts:background-work"],
    "the consumer binds the entry module as background work"));

  // The counterweight: a queue PRODUCER is declared under a single-bracket table and is NOT
  // background work in this Worker (ADR-0043). Without this half, "treat every header as an array
  // of tables" would pass the case above.
  derive(`main = "src/index.ts"

[queues]
producers = [{ binding = "Q", queue = "jobs" }]
`, (d) => assert.deepEqual(d.bindings, [], "a producer declares nothing about this Worker's own work"));
});
