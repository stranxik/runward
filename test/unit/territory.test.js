// Unit tests for category derivation (ADR-0043).
//
// The whole value of this module is that a derivation is a FACT about a declaration the operator
// already wrote — never a guess about code. So these tests spend most of their weight on the
// cases where a naive line-scan was measured to answer wrongly in silence: an environment cron
// taken for the root one, a decoy `main`, a `[triggers]` inside a multi-line string. Answering
// "I could not read this" is a success here; answering plausibly is the failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCloudflareWorkers, CATEGORIES, isCategory } from "../../dist/lib/territory.js";

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "rw-terr-"));
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}
const cats = (d) => d.bindings.map((b) => `${b.path}:${b.category}`).sort();

test("ADR-0043: the vocabulary is closed, and it grew only on field evidence", () => {
  // Code-unit order, not intuition: "sched" < "schem", so scheduled-work precedes schema-migration.
  assert.deepEqual([...CATEGORIES].sort(), [
    "background-work", "configuration", "model-provider", "port-adapter",
    "scheduled-work", "schema-migration", "secret-boundary", "startup",
  ]);
  // Ratification named seven. `secret-boundary` was split out of `configuration` when a mission
  // reported that two rules shared that word with different subjects: declaring a file
  // "configuration" would have surfaced the typed-config rule as a false positive beside the
  // secret-boundary one it was meant to reach, and a signal that arrives with noise stops being
  // read. Granularity is set by what missions must be able to declare separately — never by quota.
  assert.equal(CATEGORIES.length, 8, "a category is added when a shipped rule needs one, never in anticipation");
  assert.ok(isCategory("background-work"));
  assert.ok(!isCategory("invented-category"), "a category outside the vocabulary is not one");
});

test("ADR-0043: a declared cron binds its entry module, with the declaration as evidence", () => {
  const dir = repo({
    "src/index.ts": "export default {}\n",
    "wrangler.jsonc": `{
  // the scheduled worker
  "main": "src/index.ts",
  "triggers": { "crons": ["*/3 * * * *"] },
}`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
    const via = d.bindings[0].via;
    assert.equal(via.source, "derived");
    assert.equal(via.file, "wrangler.jsonc");
    assert.equal(via.declaration, "triggers.crons", "the evidence names the declaration, not just the file");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: comments and trailing commas are the nominal case, and a `//` inside a string survives", () => {
  // Cloudflare's own canonical example carries both, so JSON.parse fails on the normal case.
  // Stripping by regex would eat the `//` of an URL — hence a two-state scanner.
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.jsonc": `{
  /* block */ "name": "w", // line
  "vars": { "API": "https://example.com//v2/path" },
  "main": "src/index.ts",
  "triggers": { "crons": ["0 0 * * *"] },
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)), ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a decoy `main` nested elsewhere never wins over the real one", () => {
  const dir = repo({
    "src/index.ts": "x\n", "DECOY.ts": "x\n",
    "wrangler.jsonc": `{ "build": { "main": "DECOY.ts" }, "main": "src/index.ts", "triggers": { "crons": ["0 0 * * *"] } }`,
  });
  try {
    assert.ok(cats(deriveCloudflareWorkers(dir)).every((s) => s.startsWith("src/index.ts:")), "the tree is read, not scanned");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a TOML environment cron is named as such, even when declared before the root", () => {
  // Table headers are absolute paths, so order does not deceive a table-path automaton — a
  // line-scan was measured to report the production cron as the root schedule.
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.toml": `main = "src/index.ts"\n[env.production.triggers]\ncrons = ["0 3 * * *"]\n[triggers]\ncrons = ["0 0 * * *"]\n`,
  });
  try {
    const decls = deriveCloudflareWorkers(dir).bindings.map((b) => b.via.declaration).sort();
    assert.ok(decls.includes("env.production.triggers.crons"), "the environment is named in the evidence");
    assert.ok(decls.includes("triggers.crons"), "the root schedule is not lost");
    for (const b of deriveCloudflareWorkers(dir).bindings) assert.ok(b.via.line > 0, "each binding carries its line");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a `[triggers]` inside a multi-line string is not a declaration", () => {
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.toml": `main = "src/index.ts"\ndesc = """\n[triggers]\ncrons = ["6 6 * * *"]\n"""\n`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.equal(d.bindings.length, 0);
    assert.equal(d.notes[0].outcome, "read");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: an empty `crons` array is a DECLARED absence, distinct from unread", () => {
  // The docs are explicit that commenting the key does not disable a trigger, so `crons = []`
  // is a positive statement. Reporting it as "nothing declared" would lose that.
  const dir = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": [] } }` });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.equal(d.bindings.length, 0);
    assert.match(d.notes[0].detail, /declared absence of scheduling/);
    assert.equal(d.notes[0].outcome, "read", "read-and-empty is not the same outcome as unread");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: unreadable or unmodelled manifests derive NOTHING and say which", () => {
  const bad = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ main: 'src/index.ts' }` }); // JSON5, not JSONC
  const inline = repo({ "src/index.ts": "x\n", "wrangler.toml": `main = "src/index.ts"\ntriggers = { crons = ["0 0 * * *"] }\n` });
  try {
    const a = deriveCloudflareWorkers(bad);
    assert.equal(a.bindings.length, 0);
    assert.equal(a.notes[0].outcome, "unread", "unparseable is 'unread', never 'nothing declared'");
    const b = deriveCloudflareWorkers(inline);
    assert.equal(b.bindings.length, 0);
    assert.equal(b.notes[0].outcome, "unread");
    assert.match(b.notes[0].detail, /inline table/, "the unmodelled construct is named");
  } finally { rmSync(bad, { recursive: true, force: true }); rmSync(inline, { recursive: true, force: true }); }
});

test("ADR-0043: several named manifests are several Workers, each authoritative for its own entry", () => {
  // `wrangler -c <file>` lets one repository hold several Workers side by side — the shape of the
  // fleet that reported the gap. Refusing on plurality would miss exactly the population served.
  const dir = repo({
    "src/entry.serve.ts": "x\n", "src/entry.app.ts": "x\n",
    "wrangler.serve.jsonc": `{ "main": "src/entry.serve.ts", "triggers": { "crons": ["*/3 * * * *"] } }`,
    "wrangler.app.jsonc": `{ "main": "src/entry.app.ts" }`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(cats(d), ["src/entry.serve.ts:background-work", "src/entry.serve.ts:scheduled-work"]);
    assert.ok(d.notes.some((n) => n.file === "wrangler.app.jsonc"), "the manifest that declared nothing is still reported");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: two manifests claiming the SAME entry is the real ambiguity — nothing derived for it", () => {
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.a.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": ["0 0 * * *"] } }`,
    "wrangler.b.jsonc": `{ "main": "src/index.ts", "triggers": { "crons": ["0 5 * * *"] } }`,
  });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.equal(d.bindings.length, 0, "no documented precedence, so no derivation");
    assert.ok(d.notes.some((n) => n.outcome === "ambiguous"), "and the ambiguity is named");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a queue PRODUCER is not background work in this Worker; a consumer is", () => {
  const consumer = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "queues": { "consumers": [{ "queue": "jobs" }] } }` });
  const producer = repo({ "src/index.ts": "x\n", "wrangler.jsonc": `{ "main": "src/index.ts", "queues": { "producers": [{ "queue": "jobs", "binding": "Q" }] } }` });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(consumer)), ["src/index.ts:background-work"]);
    assert.equal(deriveCloudflareWorkers(producer).bindings.length, 0, "producing to a queue is an outbound call, not background work here");
  } finally { rmSync(consumer, { recursive: true, force: true }); rmSync(producer, { recursive: true, force: true }); }
});

test("ADR-0043: `main` resolves against the manifest's directory, and an unresolvable one derives nothing", () => {
  const missing = repo({ "wrangler.jsonc": `{ "main": "src/does-not-exist.ts", "triggers": { "crons": ["0 0 * * *"] } }` });
  try {
    const d = deriveCloudflareWorkers(missing);
    assert.equal(d.bindings.length, 0, "a declaration pointing nowhere binds nothing");
    assert.match(d.notes[0].detail, /does not resolve/);
  } finally { rmSync(missing, { recursive: true, force: true }); }
});

test("ADR-0043: no manifest is an outcome, not an error, and it names what was looked for", () => {
  const dir = repo({ "src/index.ts": "x\n" });
  try {
    const d = deriveCloudflareWorkers(dir);
    assert.deepEqual(d.bindings, []);
    assert.equal(d.notes[0].outcome, "absent");
    assert.match(d.notes[0].detail, /only the root is scanned/, "the limitation is stated, not hidden");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a block comment ends where it ends, not at the end of its line", () => {
  // Found by mutation: turning `c === "/" && text[i+1] === "/"` into `||` — which makes ANY slash
  // start a line comment — survived, because the existing JSONC test asserts only on keys that sit
  // on later lines. A `/* … */` opening a line would swallow the rest of that line, silently
  // dropping whatever follows it. Here the declaration that matters sits AFTER a block comment on
  // the same line, so a swallowed line is a missing category rather than an unasserted one.
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.jsonc": `{
  "name": "w",
  "main": "src/index.ts", /* the entry */ "triggers": { "crons": ["0 0 * * *"] }
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)),
      ["src/index.ts:background-work", "src/index.ts:scheduled-work"],
      "the cron declared after an inline block comment is still read");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a multi-line block comment is skipped whole, and a `/` in a value is not a comment", () => {
  const dir = repo({
    "src/index.ts": "x\n",
    "wrangler.jsonc": `{
  /* several
     lines of note, with a stray / and a "quote" inside
     spanning to here */
  "main": "src/index.ts",
  "vars": { "PATH": "a/b/c", "URL": "https://x.dev//y" },
  "triggers": { "crons": ["0 0 * * *"] },
}`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)),
      ["src/index.ts:background-work", "src/index.ts:scheduled-work"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0043: a TOML string ends on its OWN quote, so a `#` or `[` inside a value is literal", () => {
  // TOML gives `#` and `[` meaning OUTSIDE strings (comment, table header), so the scanner has to
  // know it is inside one. Single quotes are covered too: TOML has both, and the scanner remembers
  // WHICH one opened. Honest note on where this came from: a mutation of `c === inStr` survived the
  // suite, and this test does not kill it either — analysis showed that mutation is near-equivalent
  // on well-formed TOML, since the character is appended either way and only a literal `#` sitting
  // before real content on a `main`/`crons` line would change an outcome. Writing a contrived
  // fixture to redden it would be theatre. The test stays because the behaviour it pins is real.
  const dir = repo({
    "src/entry.ts": "x\n",
    "wrangler.toml": `name = "a # not-a-comment [not-a-table]"
main = "src/entry.ts"

[triggers]
crons = ["0 0 * * *"]
`,
  });
  const dir2 = repo({
    "src/entry.ts": "x\n",
    "wrangler.toml": `name = 'single # quoted [too]'
main = 'src/entry.ts'

[triggers]
crons = ["0 0 * * *"]
`,
  });
  try {
    assert.deepEqual(cats(deriveCloudflareWorkers(dir)),
      ["src/entry.ts:background-work", "src/entry.ts:scheduled-work"],
      "a `#` inside a double-quoted value does not comment out the rest");
    assert.deepEqual(cats(deriveCloudflareWorkers(dir2)),
      ["src/entry.ts:background-work", "src/entry.ts:scheduled-work"],
      "and the same holds for single quotes");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  }
});
