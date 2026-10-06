// Direct tests of src/lib/identity.ts (ADR-0088 decision 4), written from the survivors the 0.43.0
// ratchet filed as "not yet instructed" (ADR-0046 decision 4). Each assertion below is a behaviour of
// the exported API that a surviving mutant changed and no test observed: the lock read whole or not at
// all, a name that folds to nothing never declared, the no-reply login read only from GitHub's two
// shapes, and a committer matched on its name, its login or its e-mail local part, never on an empty
// string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readIdentities, resolveIdentity, spellingsOf, forgeLoginFromEmail, byMatchesCommitter,
} from "../../dist/lib/identity.js";

/** A mission directory whose scaffold-lock.json holds `text` verbatim. */
function withLock(text, f) {
  const dir = mkdtempSync(join(tmpdir(), "rw-identity-"));
  try {
    writeFileSync(join(dir, "scaffold-lock.json"), text);
    return f(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("a lock that is the JSON literal null, or whose identities are null, declares nothing and never throws", () => {
  assert.deepEqual(withLock("null", readIdentities), {});
  assert.deepEqual(withLock(JSON.stringify({ identities: null }), readIdentities), {});
  // The positive side, so the empty answers above are not the only answer this reader gives.
  assert.deepEqual(withLock(JSON.stringify({ identities: { "github:ada": ["Ada", 7, ""] } }), readIdentities), { "github:ada": ["Ada"] });
});

test("a name that folds to nothing is never declared, even against an id or an alias that also folds to nothing", () => {
  for (const name of ["", "---", "  "]) {
    assert.deepEqual(resolveIdentity(name, { "---": [] }), { id: "", declared: false }, JSON.stringify(name));
    assert.deepEqual(resolveIdentity(name, { "github:ada": ["!!!"] }), { id: "", declared: false }, JSON.stringify(name));
  }
  assert.deepEqual(resolveIdentity("Ada", { "github:ada": ["ada"] }), { id: "github:ada", declared: true });
});

test("the spellings of a declared id are its own and its aliases, and nothing else when it has none listed", () => {
  assert.deepEqual(spellingsOf({ id: "github:ada", declared: true }, "Ada", {}), ["github:ada"]);
  assert.deepEqual(spellingsOf({ id: "github:ada", declared: true }, "Ada", { "github:ada": ["Ada"] }), ["github:ada", "Ada"]);
  assert.deepEqual(spellingsOf({ id: "ada", declared: false }, "Ada", { "github:ada": ["Ada"] }), ["Ada"]);
});

test("the no-reply login is read from GitHub's two shapes only, and nothing else is a login", () => {
  const cases = [
    ["12345+octocat@users.noreply.github.com", "octocat"],
    ["7+octocat@users.noreply.github.com", "octocat"],
    ["octocat@users.noreply.github.com", "octocat"],
    ["  12345+OctoCat@users.noreply.github.com \n", "octocat"],
    // Not GitHub's no-reply domain: no login, whatever the local part says.
    ["octocat@example.com", null],
    ["12345+octocat@example.com", null],
    // Longer than the no-reply domain, so cutting the domain's length off would leave a plausible login.
    ["octocat-with-a-long-name@x.io", null],
    // The prefix before `+` is an account number only when it is all digits.
    ["abc+octocat@users.noreply.github.com", null],
    ["a1+octocat@users.noreply.github.com", null],
    ["1a+octocat@users.noreply.github.com", null],
    // An empty login is no login.
    ["12345+@users.noreply.github.com", null],
    ["@users.noreply.github.com", null],
  ];
  for (const [email, login] of cases) assert.equal(forgeLoginFromEmail(email), login, JSON.stringify(email));
});

test("a committer is matched on its name, its no-reply login or its e-mail local part, and never on an empty name", () => {
  const ids = { "github:ada": ["Ada Lovelace", "ada"] };
  // The local part alone carries the match: the name says someone else, the domain is not no-reply.
  assert.equal(byMatchesCommitter("ada", { name: "Someone Else", email: "ada@example.com" }, {}), true);
  assert.equal(byMatchesCommitter("github:ada", { name: "Someone Else", email: "ada@example.com" }, ids), true);
  assert.equal(byMatchesCommitter("ada", { name: "Someone Else", email: "bob@example.com" }, {}), false);
  // The login of a no-reply address.
  assert.equal(byMatchesCommitter("octocat", { name: "Someone Else", email: "1+octocat@users.noreply.github.com" }, {}), true);
  // A declared `by:` that folds to nothing names nobody, so it matches no committer, not even one with
  // no login (the empty login is filtered out, never compared).
  for (const by of ["", "---"]) {
    assert.equal(byMatchesCommitter(by, { name: "Alice", email: "bob@example.com" }, {}), false, JSON.stringify(by));
    assert.equal(byMatchesCommitter(by, { name: "Alice", email: "bob@example.com" }, ids), false, JSON.stringify(by));
  }
});
