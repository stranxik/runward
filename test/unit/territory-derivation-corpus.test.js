// The manifests an operator actually commits, and what runward derives from them.
//
// `territory` reads a deployment manifest and turns what it DECLARES into category bindings
// (ADR-0043). A wrong reading is a wrong derivation, and it hurts in both directions: a lost
// binding is a rule silently not applied, an invented one is a rule refusing a file it never
// governed. The `via` matters as much as the binding — it is the reason the operator reads to
// learn WHY a rule concerns them, and a wrong reason is worse than no reason.
//
// The module has NO second layer, and that is measured rather than assumed. An agent instrumented
// `readOneWrangler` with a tracer on 2026-08-29 and ran smoke, `check --strict`, `check --json` and
// audit-corpus: `deriveCloudflareWorkers` is called six times, `readOneWrangler` NEVER ONCE — no
// wrangler manifest exists in any root those layers touch. Every gap here is a gap in the last net,
// which is why this is a corpus and not a handful of cases.
//
// What the campaign's 89 survivors say the existing 84 territory tests do not see:
//
//   · COMPACT TOML. `main="src/index.ts"` — wrangler's own documented style — derives NOTHING if
//     the whitespace around `=` is required rather than optional. Same for a column-aligned
//     `main   = "..."`.
//   · WHAT AN EDITOR LEAVES. A CRLF manifest and a UTF-8 BOM manifest both fall to zero bindings
//     and gain a manufactured "no root `main` (assets-only Worker)" note — runward inventing an
//     absence rather than reporting a read failure.
//   · A DECOY. `my-wrangler.toml` and `wrangler.toml.bak` become manifests if the filename test
//     loses an anchor, and a backup file then lands in the fail-loud `couldNotRead` list.
//   · A DECLARED ABSENCE. An empty `queues.consumers: []` derives a consumer if the length test
//     goes wrong — a category asserted from a line that declares the opposite.
//   · NO ANSWER AT ALL. An empty `catch` on the read leaves `text` undefined and `rules --for`
//     dies with "Cannot read properties of undefined"; an unreadable project root does the same
//     through a different path. The module's own comment says this must not happen.
//
// Regenerate the golden deliberately, after reading the diff:
//   UPDATE_GOLDEN=1 node --test test/unit/territory-derivation-corpus.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveCloudflareWorkers, deriveAll } from "../../dist/lib/territory.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "territory-derivation.txt");

/** A throwaway project: manifests by filename, plus the source files they point at. */
const dirs = [];
function project(files, sources = ["src/index.ts"]) {
  const dir = mkdtempSync(join(tmpdir(), "rw-terr-"));
  dirs.push(dir);
  for (const rel of sources) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), "export default {};\n");
  }
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const TOML = (body) => ({ "wrangler.toml": body });
const JSONC = (body) => ({ "wrangler.jsonc": body });

/** Every manifest shape the corpus covers, named by what it is about. */
const CORPUS = {
  // — the ordinary manifest, and the spellings a real project uses —
  tomlPlain: TOML('name = "app"\nmain = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n'),
  tomlCompact: TOML('name="app"\nmain="src/index.ts"\n[triggers]\ncrons=["0 3 * * *"]\n'),
  tomlAligned: TOML('name   = "app"\nmain   = "src/index.ts"\n\n[triggers]\ncrons  = ["0 3 * * *"]\n'),
  tomlSingleQuoted: TOML("name = 'app'\nmain = 'src/index.ts'\n\n[triggers]\ncrons = ['0 3 * * *']\n"),
  tomlQuotedKey: TOML('"name" = "app"\n"main" = "src/index.ts"\n\n[triggers]\n"crons" = ["0 3 * * *"]\n'),
  tomlCrlf: TOML('name = "app"\r\nmain = "src/index.ts"\r\n\r\n[triggers]\r\ncrons = ["0 3 * * *"]\r\n'),
  tomlBom: TOML('﻿name = "app"\nmain = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n'),
  tomlNoTrailingNewline: TOML('main = "src/index.ts"\n[triggers]\ncrons = ["0 3 * * *"]'),

  // — arrays written across lines, which is how a real cron list is written —
  tomlMultilineCrons: TOML('main = "src/index.ts"\n\n[triggers]\ncrons = [\n  "0 3 * * *",\n  "30 4 * * *",\n]\n'),
  tomlNestedArrayValue: TOML('matrix = [["a"]]\nmain = "src/index.ts"\n'),
  tomlUnterminatedArray: TOML('main = [\n  "a"\n'),
  // A value that ENDS on `[` without starting with one. Only a value that STARTS with `[` opens an
  // array continuation; testing the other end makes this line swallow the table header below it.
  tomlValueEndingInBracket: TOML('main = "src/index.ts"\nroute = api[\n\n[triggers]\ncrons = ["0 3 * * *"]\n'),

  // — tables, headers, and the lines that look like one —
  tomlHeaderWithTrailer: TOML('main = "src/index.ts"\n[triggers] and a note\ncrons = ["0 3 * * *"]\n'),
  tomlArrayHeaderWithTrailer: TOML('main = "src/index.ts"\n[[queues.consumers]] and a note\nqueue = "q"\n'),
  tomlBlankHeader: TOML('[  ]\nmain = "src/index.ts"\n'),
  tomlBlankArrayHeader: TOML('[[  ]]\nmain = "src/index.ts"\n'),
  tomlKeyInQuotedName: TOML('"my main" = "src/index.ts"\nname = "app"\n'),
  tomlInlineTable: TOML('main = "src/index.ts"\n\n[env.dev]\nvars = { A = "1" }\n'),
  tomlInlineTableRoot: TOML('vars = { A = "1" }\nmain = "src/index.ts"\n'),
  tomlBracesInValue: TOML('main = "src/index.ts"\ndesc = "uses {curly} braces"\n'),
  tomlPerEnvTriggers: TOML('main = "src/index.ts"\n\n[env.prod.triggers]\ncrons = ["0 5 * * *"]\n'),
  tomlNearMissEnvTriggers: TOML('main = "src/index.ts"\n\n[myenv.prod.triggers]\ncrons = ["0 5 * * *"]\n'),
  tomlDeepEnvTriggers: TOML('main = "src/index.ts"\n\n[env.a.triggers.deep]\ncrons = ["0 5 * * *"]\n'),
  tomlNearMissConsumers: TOML('main = "src/index.ts"\n\n[[legacyenv.old.queues.consumers]]\nqueue = "q"\n'),
  tomlDeepConsumers: TOML('main = "src/index.ts"\n\n[[env.c.queues.consumers.extra]]\nqueue = "q"\n'),

  // — JSONC, and the comment shapes that break a naive stripper —
  jsoncPlain: JSONC('{\n  // the entry\n  "main": "src/index.ts",\n  "triggers": { "crons": ["0 3 * * *"] }\n}\n'),
  jsoncBlockComment: JSONC('{\n  /* a block\n     comment */\n  "main": "src/index.ts"\n}\n'),
  jsoncSelfClosingComment: JSONC('{"main":"src/index.ts" /*/ still a comment */ ,"triggers":{"crons":["0 3 * * *"]}}'),
  jsoncUrlInString: JSONC('{"main":"src/index.ts","docs":"https://example.com/x","triggers":{"crons":["0 3 * * *"]}}'),
  jsoncBlockMarkerInString: JSONC('{"main":"src/index.ts","note":"a /* not a comment */ b"}'),
  jsoncTrailingComma: JSONC('{\n  "main": "src/index.ts",\n}\n'),
  jsoncEmptyConsumers: JSONC('{"main":"src/index.ts","queues":{"consumers":[]}}'),
  jsoncOneConsumer: JSONC('{"main":"src/index.ts","queues":{"consumers":[{"queue":"q"}]}}'),
  jsoncCronsNotArray: JSONC('{"main":"src/index.ts","triggers":{"crons":"0 3 * * *"}}'),
  jsoncEnvScalars: JSONC('{"main":"src/index.ts","env":{"a":null,"b":42,"c":"x","d":[1],"e":{"triggers":{"crons":["0 6 * * *"]}}}}'),
  jsoncBroken: JSONC('{"main": "src/index.ts",,,}'),
  jsoncNull: JSONC("null"),
  jsoncArray: JSONC("[1,2,3]"),
  jsoncNoMain: JSONC('{"triggers":{"crons":["0 3 * * *"]}}'),
  jsoncMainMissing: JSONC('{"main":"src/nope.ts"}'),
  jsoncMainEscaping: JSONC('{"main":"../outside.ts"}'),

  // — what is NOT a manifest —
  decoyNames: {
    "my-wrangler.toml": 'main = "src/index.ts"\n',
    "wrangler.toml.bak": 'main = "src/index.ts"\n',
    "wrangler.tomlish": 'main = "src/index.ts"\n',
    "notwrangler.json": '{"main":"src/index.ts"}',
  },
  noManifest: {},

  // — two manifests, agreeing and disagreeing —
  twoManifestsContested: {
    "wrangler.toml": 'main = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n',
    "wrangler.jsonc": '{"main":"src/index.ts","triggers":{"crons":["0 4 * * *"]}}',
  },
  twoManifestsDistinct: {
    "wrangler.toml": 'main = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n',
    "wrangler.jsonc": '{"main":"src/other.ts","triggers":{"crons":["0 4 * * *"]}}',
  },
  // Two manifests contest one entry; a THIRD owns another and declares a schedule for it. The
  // contest must cost that entry and nothing else.
  threeManifestsOneContested: {
    "wrangler.toml": 'main = "src/index.ts"\n\n[triggers]\ncrons = ["0 3 * * *"]\n',
    "wrangler.jsonc": '{"main":"src/index.ts","triggers":{"crons":["0 4 * * *"]}}',
    "wrangler.json": '{"main":"src/other.ts","triggers":{"crons":["0 5 * * *"]}}',
  },
};

const SOURCES = ["src/index.ts", "src/other.ts"];

/** Stable, diffable, derived from the module rather than from an expectation. */
function transcript() {
  const out = [];
  for (const [name, files] of Object.entries(CORPUS)) {
    const dir = project(files, SOURCES);
    let d;
    try { d = deriveCloudflareWorkers(dir); } catch (e) { out.push(`${name} THREW ${e?.constructor?.name}`); continue; }
    for (const b of d.bindings) {
      out.push(`${name}.binding => ${JSON.stringify([b.path, b.category, b.via?.file, b.via?.line, b.via?.declaration])}`);
    }
    for (const n of d.notes) {
      out.push(`${name}.note => ${JSON.stringify([n.adapter, n.file, n.outcome, n.detail])}`);
    }
  }
  return out.join("\n") + "\n";
}

test("the derivation corpus is byte-identical to the golden transcript", () => {
  const got = transcript();
  if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(GOLDEN, got); return; }
  const want = readFileSync(GOLDEN, "utf8");
  if (got !== want) {
    const g = got.split("\n"), w = want.split("\n");
    const first = g.findIndex((l, i) => l !== w[i]);
    assert.fail("the derivation changed.\n" +
      `  first difference at line ${first + 1}\n    golden: ${w[first]}\n    now:    ${g[first]}\n` +
      `  ${g.filter((l, i) => l !== w[i]).length} line(s) differ.\n` +
      "  Regenerate with UPDATE_GOLDEN=1 node --test test/unit/territory-derivation-corpus.test.js after reading the diff.");
  }
});

// ── the invariants, written out ──────────────────────────────────────────────────────────────────

const derive = (files, sources = SOURCES) => deriveCloudflareWorkers(project(files, sources));
const paths = (d) => d.bindings.map((b) => b.path).sort();

test("every spelling a real manifest uses derives the same thing", () => {
  const reference = paths(derive(CORPUS.tomlPlain));
  assert.ok(reference.length > 0, "the reference manifest derives nothing — the corpus is broken");
  for (const name of ["tomlCompact", "tomlAligned", "tomlSingleQuoted", "tomlQuotedKey",
    "tomlCrlf", "tomlBom", "tomlNoTrailingNewline"]) {
    assert.deepEqual(paths(derive(CORPUS[name])), reference,
      `${name} derives differently from the plain manifest. Compact spacing is wrangler's own ` +
      "documented style, and CRLF and a BOM are what an editor leaves behind — a reading that " +
      "needs one exact spelling reports a declared absence the operator never declared");
  }
});

test("only a value that OPENS an array continues onto the next line", () => {
  // `route = api[` ends on a bracket and starts with none. If the continuation test looks at the
  // wrong end, this line swallows the `[triggers]` header beneath it and the schedule disappears —
  // measured: two bindings become zero.
  const d = derive(CORPUS.tomlValueEndingInBracket);
  assert.ok(d.bindings.some((b) => b.category === "scheduled-work"),
    "a value merely ENDING on `[` opened a continuation that ate the table header below it, and " +
    "the schedule declared there vanished with no note saying why");
});

test("a declared absence is not a declaration", () => {
  const empty = derive(CORPUS.jsoncEmptyConsumers);
  assert.equal(empty.bindings.filter((b) => b.category === "background-work").length, 0,
    "an empty `queues.consumers: []` derived a consumer — a category asserted from a line that " +
    "declares the opposite");
  const one = derive(CORPUS.jsoncOneConsumer);
  assert.equal(one.bindings.filter((b) => b.category === "background-work").length > 0, true,
    "and a declared consumer must still derive, or the guard above is satisfied by doing nothing");
});

test("a file that is not a manifest is not read as one", () => {
  const d = derive(CORPUS.decoyNames);
  assert.deepEqual(d.bindings, [],
    "a decoy filename was read as a manifest — `wrangler.toml.bak` is a backup, `my-wrangler.toml` " +
    "is someone else's file, and reading either turns a stray file into evidence");
  assert.equal(d.notes.every((n) => n.outcome === "absent"), true,
    `the decoys produced notes other than "absent": ${JSON.stringify(d.notes.map((n) => [n.file, n.outcome]))}`);
});

test("a near-miss table name declares nothing", () => {
  const reference = paths(derive(CORPUS.tomlPlain.constructor === Object ? TOML('main = "src/index.ts"\n') : {}));
  for (const name of ["tomlNearMissEnvTriggers", "tomlDeepEnvTriggers", "tomlNearMissConsumers",
    "tomlDeepConsumers", "tomlHeaderWithTrailer", "tomlArrayHeaderWithTrailer"]) {
    assert.deepEqual(paths(derive(CORPUS[name])), reference,
      `${name}: a table whose name only RESEMBLES a declaration produced a binding. An unanchored ` +
      "match posts a category on evidence the file does not contain");
  }
});

test("an unreadable carrier is reported as unread, never as nothing declared", () => {
  // A DIRECTORY where the manifest belongs, not a chmod. Permissions are not portable — on Windows
  // `chmod 0o000` only sets the read-only attribute and the file stays readable, which is how the
  // first version of this test passed on POSIX and failed the windows-latest leg. A type mismatch
  // fails to read on every platform (EISDIR), and it reaches the same catch.
  const dir = project({}, SOURCES);
  mkdirSync(join(dir, "wrangler.toml"));
  let d;
  assert.doesNotThrow(() => { d = deriveCloudflareWorkers(dir); },
    "an unreadable manifest threw instead of answering — `rules --for` then dies with " +
    "`Cannot read properties of undefined` and renders no answer at all");
  const unread = d.notes.filter((n) => n.outcome === "unread");
  assert.equal(unread.length, 1, `expected exactly one unread note, got ${JSON.stringify(d.notes)}`);
  assert.ok(String(unread[0].detail).length > 0,
    "the note says the carrier is unread and does not say why — that detail is the machine field " +
    "`couldNotRead[].detail`, and an empty one leaves an orchestrator with a flag and no reason");
  assert.ok(String(unread[0].adapter).length > 0, "the note does not name the reader that produced it");
});

test("a project root that cannot be listed is the same distinction, one level up", () => {
  // Same portability rule: a FILE where a directory is expected fails to list everywhere (ENOTDIR),
  // where a permission bit does not.
  const dir = project(TOML('main = "src/index.ts"\n'), SOURCES);
  const notADirectory = join(dir, "wrangler.toml");
  let d;
  assert.doesNotThrow(() => { d = deriveCloudflareWorkers(notADirectory); },
    "a root that cannot be listed threw — the caller gets no derivation and no reason");
  assert.deepEqual(d.bindings, [], "an unlistable root produced a binding out of nothing");
  assert.equal(d.notes.length > 0, true,
    "an unlistable root reported NO note, so `I could not look` renders as `nothing is declared` " +
    "— the collapse this module documents that it exists to prevent");
  assert.ok(d.notes.every((n) => String(n.outcome).length > 0 && String(n.detail).length > 0),
    `a note carries an empty outcome or detail: ${JSON.stringify(d.notes)}`);
});

test("two manifests claiming one entry refuse it, and do not take the others down with it", () => {
  const contested = derive(CORPUS.twoManifestsContested);
  assert.deepEqual(contested.bindings, [],
    "a contested entry was derived anyway, with no documented precedence to choose by");
  const amb = contested.notes.filter((n) => n.outcome === "ambiguous");
  assert.equal(amb.length, 1, `expected one ambiguous note, got ${JSON.stringify(contested.notes)}`);
  assert.match(String(amb[0].file), /wrangler\.jsonc/,
    "the ambiguity is reported without naming the manifests that caused it");
  assert.match(String(amb[0].file), /,\s/,
    "the manifest names are run together with no separator — an unparseable field in a machine surface");

  const three = derive(CORPUS.threeManifestsOneContested);
  assert.ok(three.bindings.some((b) => b.path === "src/other.ts"),
    "an UNcontested entry lost its bindings because ANOTHER entry was contested — a filter that " +
    "drops everything as soon as one path is disputed stops applying rules to a file nothing was " +
    "ambiguous about, and nothing says so");
  assert.equal(three.bindings.some((b) => b.path === "src/index.ts"), false,
    "the contested entry was derived anyway");
});

test("the reason carries the file and a line inside the declaration it names", () => {
  // A single-line declaration points at itself; a MULTI-LINE array points at the line where the
  // continuation ENDS, which is inside the declaration's span and is what the delivered code
  // records. The invariant is therefore "inside the span", not "the first line" — asserting a
  // preference here would pin something the code never promised, and the campaign's off-by-two
  // mutants move the line OUT of the span, which is what must fail.
  const dir = project(CORPUS.tomlMultilineCrons, SOURCES);
  const d = deriveCloudflareWorkers(dir);
  const src = readFileSync(join(dir, "wrangler.toml"), "utf8").split("\n");
  const first = src.findIndex((l) => l.startsWith("crons")) + 1;
  const last = src.findIndex((l) => l.trim() === "]") + 1;
  const scheduled = d.bindings.filter((b) => b.category === "scheduled-work");
  assert.ok(scheduled.length > 0, "a multi-line cron array derived no schedule");
  for (const b of scheduled) {
    assert.match(String(b.via.file), /wrangler\.toml$/);
    assert.ok(b.via.line >= first && b.via.line <= last,
      `via.line is ${b.via.line}, outside the declaration's span (${first}..${last}) — the operator ` +
      "is sent to a row of their own file that says nothing about why the rule applies");
  }
  const single = deriveCloudflareWorkers(project(CORPUS.tomlPlain, SOURCES))
    .bindings.filter((b) => b.category === "scheduled-work");
  assert.ok(single.length > 0 && single.every((b) => b.via.line === 5),
    `a single-line declaration must point at itself, got ${JSON.stringify(single.map((b) => b.via.line))}`);
});

test("a manifest truncated inside a comment is answered, not spun on", () => {
  // This one is a HANG under mutation, not a wrong answer: with the block-comment scan's bound
  // opened, `stripJsonc("/*")` never returns. A synchronous infinite loop cannot be interrupted by
  // a test timeout, so the guard here is that the call RETURNS — the mutation runner's own process
  // timeout is what converts the hang into a detected mutant.
  for (const body of ["{\n  /* unterminated", "/*", '{"main":"src/index.ts" /*']) {
    let d;
    assert.doesNotThrow(() => { d = deriveCloudflareWorkers(project({ "wrangler.jsonc": body }, SOURCES)); },
      `a manifest truncated mid-comment threw: ${JSON.stringify(body)}`);
    assert.deepEqual(d.bindings, [], "a truncated manifest derived a binding");
    assert.ok(d.notes.length > 0, "a truncated manifest derived nothing and said nothing");
  }
});

test("deriveAll answers on a project with no manifest, and on no project at all", () => {
  const none = deriveAll(project(CORPUS.noManifest, SOURCES));
  assert.deepEqual(none.bindings, []);
  assert.ok(none.notes.length > 0, "a project with no manifest must say so, not stay silent");
  assert.doesNotThrow(() => deriveAll(null), "deriveAll(null) is the no-project case and must answer");
});
