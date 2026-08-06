// The manifest shapes derivation must survive (ADR-0043).
//
// Found by the full mutation pass of 2026-08-04: `readOneWrangler` carried 27 survivors that no
// net caught — unit suite, `check --strict`, OSCAL validation, smoke. The reason is visible in
// the existing file: territory.test.js proves the SCANNERS (JSONC comments, TOML strings, bracket
// balance) on well-formed manifests, and proves the JSONC control flow. It almost never exercises
// the refusal branches of the TOML reader, and never the JSONC branches that answer "I could not
// read this".
//
// Those branches are guards. Each one turns a shape the reader cannot model into a NAMED refusal
// instead of a wrong answer or a crash, and all of them collapse to `if (false)` with the whole
// suite still green. What they protect is not a verdict — `runward check --strict` never imports
// this module (measured 2026-08-05: a manifest crafted to crash derivation leaves the gate at
// exit 0 and takes `runward status` and `runward rules --for` down to exit 1 instead). What they
// protect is the derivation surface itself: which file carries which category, and on the evidence
// of which declaration, at which line. A binding pointing at a path outside the project, at `null`,
// or at a `crons` key that lives in `[vars]`, is the "plausible answer" this module exists to
// refuse.
//
// Each case below states the decision it pins and the direction that would be dangerous, and each
// decision is exercised in BOTH directions — a guard that refuses everything is as broken as one
// that refuses nothing, and only the pair forbids a constant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers } from "../../dist/lib/territory.js";

/** A throwaway tree. Keys are project-relative paths; nested directories are created. */
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-terrshape-"));
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}
const drop = (...dirs) => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); };
const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();
const decls = (d) => d.bindings.map((b) => b.via.declaration).sort();

// ── `main` must land inside the project ─────────────────────────────────────────────────────────
// `if (!rel || rel.startsWith("..")) return null`. Disabling this guard — or turning its `||` into
// `&&` — lets a manifest bind a path that escapes the project root.

test("a `main` that escapes the project root binds nothing, and says so", () => {
  // The dangerous direction: emitting a binding whose `path` is `../…`. Every consumer of a
  // binding treats `path` as project-relative (the coverage count in `status` intersects it with
  // the walked tree, `rules --for` matches rule globs against it), so a path leaving the project
  // is not a slightly-wrong answer, it is a category asserted about a file this project does not
  // contain.
  const outer = mkdtempSync(join(tmpdir(), "rw-terrshape-out-"));
  mkdirSync(join(outer, "project"), { recursive: true });
  mkdirSync(join(outer, "shared"), { recursive: true });
  writeFileSync(join(outer, "shared", "worker.ts"), "export default {}\n");
  writeFileSync(join(outer, "project", "wrangler.toml"),
    `main = "../shared/worker.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n`);
  try {
    const d = deriveCloudflareWorkers(join(outer, "project"));
    assert.deepEqual(d.bindings, [], "a target outside the project is not this project's territory");
    assert.match(d.notes[0].detail, /does not resolve/, "and the refusal is named, never silent");
  } finally { drop(outer); }
});

test("a `main` inside the project still resolves and binds — the guard is not a wall", () => {
  // The opposite direction, so the guard cannot be satisfied by refusing everything.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `main = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)),
      ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
  } finally { drop(dir); }
});

// ── The TOML refusal branches ───────────────────────────────────────────────────────────────────
// Three guards in a row — no root table, no root `main`, an unresolvable `main` — each of which
// answers "nothing derived" and returns. Removed, they do not answer wrongly: they throw, and the
// throw travels out of `deriveAll` into whatever asked (`runward status`, `runward rules --for`).

test("a TOML manifest with no root table at all is read, not crashed on", () => {
  // The shape: `main` declared per environment, so the root table never exists. Dropping the
  // optional chain on `t.values.get("")` turns this ordinary manifest into a TypeError.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `# entry declared per environment\n[env.production]\nmain = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n`,
  });
  try {
    let d;
    assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); }, "a manifest is data, never a crash");
    assert.deepEqual(d.bindings, [], "no root `main` binds nothing");
    assert.equal(d.notes[0].outcome, "read", "and it is READ — the file was understood, it declared no root entry");
  } finally { drop(dir); }
});

test("a TOML root table without `main` is read, not crashed on", () => {
  // Same guard, one step later: the root table exists but carries no `main`. Skipping the
  // emptiness test dereferences `undefined`.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `name = "acme-api"\ncompatibility_date = "2026-01-01"\n\n[triggers]\ncrons = ["0 3 * * *"]\n`,
  });
  try {
    let d;
    assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); });
    assert.deepEqual(d.bindings, []);
    assert.equal(d.notes[0].outcome, "read");
  } finally { drop(dir); }
});

test("a TOML `main` that points at nothing binds nothing — never `null` as a path", () => {
  // The dangerous direction is not a crash here, it is a binding whose `path` is `null`: a
  // category asserted about no file at all, carried into the report as if it were evidence.
  // territory.test.js pins this for JSONC only; the TOML branch is a separate guard.
  const dir = repo({
    "wrangler.toml": `main = "src/does-not-exist.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(d.bindings, [], "a declaration pointing nowhere binds nothing");
    assert.match(d.notes[0].detail, /does not resolve/);
  } finally { drop(dir); }
});

// ── What counts as a schedule declaration ───────────────────────────────────────────────────────
// `if (!isRoot && !env) continue` selects the tables that may declare a cron. It is the only thing
// that keeps a `crons` key in an unrelated table from being read as a schedule.

test("a `crons` key outside a triggers table is not a schedule declaration", () => {
  // Dangerous direction: reading `[vars] crons` — an application variable that happens to be
  // named `crons` — as scheduled work, or (with the table filter gone) blowing up on the
  // environment capture of a table that has no environment.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `main = "src/index.ts"\n\n[vars]\ncrons = ["0 3 * * *"]\n\n[triggers]\ncrons = ["0 9 * * *"]\n`,
  });
  try {
    let d;
    assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); });
    assert.deepEqual(decls(d), ["triggers.crons", "triggers.crons"],
      "only the triggers table declares a schedule; the same word in [vars] declares nothing");
    assert.deepEqual(cats(d), ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
  } finally { drop(dir); }
});

test("a `crons` that is not an array derives nothing, and does not crash", () => {
  // A scalar where the format wants a list — the ordinary typo. `tomlStringList` answers `null`
  // for it, and the `crons === null` guard is what turns that into "nothing declared" rather than
  // a dereference of `null`.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `main = "src/index.ts"\n\n[triggers]\ncrons = "0 3 * * *"\n`,
  });
  try {
    let d;
    assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); });
    assert.deepEqual(d.bindings, []);
    assert.equal(d.notes.length, 1);
    assert.equal(d.notes[0].outcome, "read");
  } finally { drop(dir); }
});

test("an empty TOML `crons` array is a declared absence, and binds nothing", () => {
  // The docs are explicit that commenting the key does not disable a trigger, so `crons = []` is
  // a positive statement of "no schedule". Dangerous direction: deriving scheduled work from it —
  // a category asserted on the strength of a declaration that says the opposite. territory.test.js
  // pins this for JSONC; the TOML branch is its own guard.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `main = "src/index.ts"\n\n[triggers]\ncrons = []\n`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(d.bindings, [], "a declared absence of scheduling derives no scheduled work");
    assert.match(d.notes[0].detail, /declared absence of scheduling/);
  } finally { drop(dir); }
});

// ── Which array-of-tables is background work ────────────────────────────────────────────────────
// `table === "queues.consumers" || /^env\.[^.]+\.queues\.consumers$/.test(table)`. Four operators
// in one line, each able to widen it to every `[[…]]` in the file or narrow it to none.

test("only queue CONSUMER tables are background work, root and per-environment alike", () => {
  // Both directions in one fixture. Widening it (any array-of-tables counts) makes a KV namespace
  // binding "background work"; narrowing it (either half dropped) silently loses a consumer that
  // is declared. The declarations are asserted exactly, so neither survives.
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.toml": `main = "src/index.ts"

[[kv_namespaces]]
binding = "CACHE"
id = "0123456789abcdef"

[[queues.consumers]]
queue = "jobs"

[[env.production.queues.consumers]]
queue = "jobs-prod"
`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(decls(d), ["env.production.queues.consumers[]", "queues.consumers[]"],
      "a KV namespace is not background work, and an environment-scoped consumer is");
    assert.deepEqual([...new Set(d.bindings.map((b) => b.category))], ["background-work"]);
    for (const b of d.bindings) {
      assert.equal(typeof b.via.line, "number", "a consumer binding carries the line of its declaration");
      assert.ok(b.via.line > 0, "evidence with no line is evidence a reader cannot check");
    }
  } finally { drop(dir); }
});

// ── The JSONC "I could not read this" branches ──────────────────────────────────────────────────
// ADR-0035's discipline, at the top of the JSONC path: "nothing is declared" and "I could not read
// it" are different answers. Valid JSON that is not an object is the case that separates them.

test("valid JSON that is not an object is UNREAD, never read-and-empty", () => {
  // Dangerous direction: answering `read` — i.e. "this manifest declares no scheduled work" —
  // about a file that was never a manifest. And with the null guard gone it is worse than wrong:
  // `null.main` throws out of the command.
  const asNull = repo({ "src/index.ts": "x\n", "wrangler.json": `null` });
  const asNumber = repo({ "src/index.ts": "x\n", "wrangler.json": `42` });
  const asString = repo({ "src/index.ts": "x\n", "wrangler.json": `"main"` });
  try {
    for (const [name, dir] of [["null", asNull], ["number", asNumber], ["string", asString]]) {
      let d;
      assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); }, `a JSON ${name} is data, never a crash`);
      assert.deepEqual(d.bindings, [], `a JSON ${name} binds nothing`);
      assert.equal(d.notes[0].outcome, "unread", `a JSON ${name} is unread, not "nothing declared"`);
    }
  } finally { drop(asNull, asNumber, asString); }
});

test("an object manifest IS read — the unread answer is reserved for what cannot be read", () => {
  // The opposite direction: a constant `unread` would satisfy the test above.
  const dir = repo({ "src/index.ts": "x\n", "wrangler.json": `{ "main": "src/index.ts", "triggers": { "crons": ["0 3 * * *"] } }` });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
    assert.deepEqual(d.notes, [], "a manifest that declared work needs no note");
  } finally { drop(dir); }
});

test("a JSONC manifest with no usable `main` is read, not crashed on", () => {
  // The assets-only Worker is a shipped Cloudflare shape, and a non-string `main` is the ordinary
  // typo. Both must produce a named "nothing derived"; without the guard both reach `path.resolve`
  // with a non-string and throw.
  const assetsOnly = repo({ "wrangler.jsonc": `{ "name": "w", "assets": { "directory": "./public" } }` });
  const wrongType = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": 42, "triggers": { "crons": ["0 3 * * *"] } }` });
  try {
    for (const dir of [assetsOnly, wrongType]) {
      let d;
      assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); });
      assert.deepEqual(d.bindings, []);
      assert.equal(d.notes[0].outcome, "read");
    }
  } finally { drop(assetsOnly, wrongType); }
});

// ── Environment scopes in JSONC ─────────────────────────────────────────────────────────────────
// `if (cfg && typeof cfg === "object") scopes.push([name, cfg])` decides whether a per-environment
// declaration is ever looked at.

test("a cron declared only under `env` is derived, and named as that environment's", () => {
  // Dangerous direction: dropping the environment scopes altogether — the manifest declares a
  // schedule, the derivation reports none, and the report says "no schedule or queue consumer
  // declared" about a file that schedules one. A silence that reads like a fact.
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "env": { "production": { "triggers": { "crons": ["0 3 * * *"] } } },
}`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(decls(d), ["env.production.triggers.crons", "env.production.triggers.crons"],
      "the evidence names the environment, never just the file");
    assert.deepEqual(cats(d), ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
  } finally { drop(dir); }
});

test("an environment that declares nothing adds nothing", () => {
  // The opposite direction: scopes must not manufacture work either. The root schedule is derived
  // exactly once, and the empty environment contributes no binding and no second note.
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.jsonc": `{
  "main": "src/index.ts",
  "triggers": { "crons": ["0 3 * * *"] },
  "env": { "preview": {} },
}`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(decls(d), ["triggers.crons", "triggers.crons"]);
  } finally { drop(dir); }
});

// ── The closing note of a JSONC manifest ────────────────────────────────────────────────────────
// `if (!bindings.some((b) => b.via.file === file) && notes.length === 0)`. Its TOML twin is pinned
// by territory.test.js ("a `read` note states what THIS manifest declares"); the JSONC one is not,
// and both halves of the conjunction can be forced true with the whole net green.

test("a JSONC manifest that declared a cron gets NO 'nothing declared' note", () => {
  // Dangerous direction: a note that contradicts the binding sitting beside it. The report then
  // carries both, and a reader has no way to tell which half is true.
  const dir = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": ["0 3 * * *"] } }` });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.equal(d.bindings.length, 2);
    assert.deepEqual(d.notes, [], "the manifest declared work; there is nothing to report as missing");
  } finally { drop(dir); }
});

test("a JSONC manifest that already explained itself gets exactly one note", () => {
  // The second half of the conjunction: `crons: []` already produced "a declared absence of
  // scheduling". Adding "no schedule or queue consumer declared" beneath it turns one clear fact
  // into two statements the reader must reconcile.
  const dir = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": [] } }` });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(d.bindings, []);
    assert.equal(d.notes.length, 1, "one shape, one note");
    assert.match(d.notes[0].detail, /declared absence of scheduling/);
  } finally { drop(dir); }
});

test("a JSONC manifest that declared nothing DOES get the note", () => {
  // And the opposite direction: silence about a silent manifest would be the ADR-0035 failure in
  // its purest form — no binding, no note, nothing to distinguish "read it, it declares nothing"
  // from "never looked".
  const dir = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "name": "w" }` });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(d.bindings, []);
    assert.equal(d.notes.length, 1);
    assert.match(d.notes[0].detail, /no schedule or queue consumer declared/);
  } finally { drop(dir); }
});
