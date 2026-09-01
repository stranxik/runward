// A `hole` claims the WHOLE NET misses the mutant. This guards what backs that claim.
//
// The survivor register's vocabulary is explicit: `hole`, `equivalent` and `display-only` mean the
// mutant survived the unit suite AND the whole net — the self-gate, OSCAL and in-toto validation,
// smoke, the spelling corpus, the SARIF shape check, the audit corpus. The second half of that
// sentence is a claim about a SET OF FILES. Change one and every such filing becomes a statement
// about a net that no longer exists.
//
// It happened, and the way it happened is the reason this guard is here rather than a note.
// `test/sarif-shape.js` was extended on 2026-08-29 with the fixtures a campaign had shown were
// missing. Every `hole` filed on `sarif` immediately rested on the earlier net. A pass-1
// measurement run two days later reported that the extension had retired nothing — and that number
// was then explained as "the schema leg is outside the mutation net", which is false: `sarif-shape`
// is a leg of the net. What was stale was the second pass. Nothing in the tree could say so,
// because nothing recorded which net a filing had been measured against.
//
// The fix is disclosure, not refusal (ADR-0060). Re-running seven legs over hundreds of survivors
// because one test file gained a fixture is exactly the instrument that makes honest work wait, and
// ADR-0046 decision 3 refuses those. So the register PRINTS which net each module's second pass ran
// against, and says plainly when that net has moved. This guard holds the machinery that makes the
// printing possible: one definition of the net, a digest that moves when a leg does, and a record
// whose shape a reader can trust.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NET, netDigest, readWholeNetRecord, WHOLENET_RECORD } from "../../scripts/mutation-net.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("the net has one definition, and the pass that runs it does not keep a copy", () => {
  const wholenet = readFileSync(join(ROOT, "scripts", "mutation-wholenet.mjs"), "utf8");
  assert.match(wholenet, /from "\.\/mutation-net\.mjs"/,
    "the whole-net pass does not import the net — a second copy drifts, and the digest would then " +
    "describe a net nobody runs");
  assert.equal(/^const NET = \[/m.test(wholenet), false,
    "the whole-net pass declares its own NET again");
  const register = readFileSync(join(ROOT, "scripts", "mutation-register.mjs"), "utf8");
  assert.match(register, /from "\.\/mutation-net\.mjs"/,
    "the register does not read the net's identity, so it cannot say which net a filing is about");
});

test("every leg of the net is a script that exists, and the composition is written down", () => {
  // WRITTEN OUT, not derived from NET: a list built from the thing it checks agrees with it by
  // construction. The net's composition is a DECISION — `spelling-corpus` and `sarif-shape` were
  // added on 2026-08-27 after a week in which every mutant they catch was reported as surviving
  // the net — so dropping a leg must be a deliberate edit here, not a quiet one there.
  assert.deepEqual(NET.map((l) => l.name), [
    "self-gate", "oscal-schema", "smoke", "intoto-schema",
    "spelling-corpus", "sarif-shape", "audit-corpus",
  ], "the net's composition changed. Every `hole` ever filed claims THIS net misses the mutant; " +
     "removing a leg makes the claim weaker than the register's vocabulary says, and adding one " +
     "makes every existing filing stale. Either way it is a decision, recorded here in the same commit.");
  for (const leg of NET) {
    assert.ok(typeof leg.name === "string" && leg.name.length > 0, "a leg with no name");
    assert.ok(existsSync(join(ROOT, leg.argv[0])),
      `${leg.name}: ${leg.argv[0]} does not exist. A leg the pass cannot run is a leg the ` +
      "measurement silently denies exists — the defect that put `sarif-shape` and " +
      "`spelling-conformance` outside both passes for a week");
  }
});

test("the digest moves when a leg's content moves, and not otherwise", () => {
  const before = netDigest().digest;
  assert.equal(netDigest().digest, before, "the digest is not stable across two reads of one tree");
  const leg = join(ROOT, "test", "smoke.js");
  const original = readFileSync(leg);
  try {
    writeFileSync(leg, Buffer.concat([original, Buffer.from("\n// a fixture was added here\n")]));
    assert.notEqual(netDigest().digest, before,
      "a leg gained content and the net's identity did not move — every `hole` filing would go on " +
      "claiming the whole net misses it, about a net that has changed");
  } finally { writeFileSync(leg, original); }
  assert.equal(netDigest().digest, before, "the digest did not come back after the leg was restored");
});

test("the digest ignores what is rebuilt rather than edited", () => {
  // `dist/cli.js` is a leg's argv and is regenerated on every build. Digesting it would make the
  // net's identity move on every commit, which turns a real signal into noise nobody reads.
  const { legs } = netDigest();
  assert.equal(legs.some((l) => l.startsWith("dist/")), false,
    "a built artifact is in the digest: the net would look different after every compile");
  assert.ok(legs.length >= 4, `only ${legs.length} leg scripts are digested`);
});

test("the recorded provenance, when there is one, is shaped so a reader can act on it", () => {
  const record = readWholeNetRecord(ROOT);
  const perimeter = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8"))
    .mutate.map((f) => f.replace(/^.*\//, "").replace(/\.js$/, ""));
  for (const [mod, r] of Object.entries(record)) {
    assert.ok(perimeter.includes(mod), `${mod} is recorded and is not in the mutation perimeter`);
    assert.match(String(r.at), /^\d{4}-\d{2}-\d{2}$/, `${mod}: no date on the pass`);
    assert.match(String(r.digest), /^[0-9a-f]{64}$/, `${mod}: the recorded net digest is not a digest`);
    assert.ok(Number.isInteger(r.trials) && r.trials >= 0, `${mod}: trials is not a count`);
    assert.ok(Number.isInteger(r.detected) && r.detected >= 0 && r.detected <= r.trials,
      `${mod}: detected (${r.detected}) is not a count within trials (${r.trials})`);
  }
});

test("the register says, per module, which net its filings are about", () => {
  const md = readFileSync(join(ROOT, "docs", "compliance", "mutation-register.md"), "utf8");
  const modules = [...md.matchAll(/^## Module: (.+)$/gm)].map((m) => m[1]);
  assert.ok(modules.length > 0, "the register carries no module section");
  const record = readWholeNetRecord(ROOT);
  for (const mod of modules) {
    const section = md.slice(md.indexOf(`## Module: ${mod}`));
    const head = section.slice(0, section.indexOf("### ") === -1 ? section.length : section.indexOf("### "));
    assert.match(head, /Whole net:/,
      `${mod}: the section does not say which net its filings are about. A reader takes "hole" at ` +
      "the vocabulary's word — nothing catches it, in the unit suite AND the whole net — and has " +
      "no way to learn that the second half was measured against something else");
    if (!record[mod]) {
      assert.match(head, /never run for this module/,
        `${mod}: no pass is recorded and the section does not say so`);
    }
  }
});

// ── what a trial is allowed to conclude ──────────────────────────────────────────────────────────

test("the pass refuses to count a splice that does not parse", () => {
  // RWD-2026-0092. The pass applies a mutant by splicing Stryker's `replacement` at the reported
  // offsets, and that text is an AST node's — valid where the AST puts it, not necessarily where a
  // splice puts it. `(cols[0] ?? "").trim()` has the replacement `cols[0] ?? ""`, and spliced into
  // a `&&` chain it gives `??` mixed with `&&` without parentheses: a SyntaxError. Every leg then
  // fails at module load and the first one is filed as the catcher.
  const wholenet = readFileSync(join(ROOT, "scripts", "mutation-wholenet.mjs"), "utf8");
  assert.match(wholenet, /function splicedParses/,
    "the pass runs legs against a file it never checked it could load — an apparatus fault then " +
    "reads as a verdict about the code");
  assert.match(wholenet, /if \(!splicedParses\(target\)\)/,
    "the check exists and is not called before the legs run");
  assert.match(wholenet, /unapplicable/,
    "a trial whose splice does not parse must be neither a detection nor a survivor — it measured nothing");
  // The usage, not the mention: the script's own comment names `node --check` precisely to say why
  // it is the wrong tool here, and a guard that forbids the WORD would forbid the explanation.
  assert.equal(/["'`]--check["'`]/.test(wholenet), false,
    "`--check` is passed to a child process: it parses a .js file as a SCRIPT, where the offending " +
    "text is legal, so the check would pass on a file no leg can import");
  assert.match(wholenet, /import\(\$\{JSON\.stringify\(url\)\}\)/,
    "the parse check does not import the file as a module, which is the only way it sees the fault");
});

test("a detection is confirmed before it counts", () => {
  // RWD-2026-0093. A leg over its bound returns the sentinel `timeout`, never equal to a baseline
  // exit code, so a leg merely slowed is indistinguishable from a leg the mutant broke; and
  // `self-gate` judges THIS repository, so a concurrent write changes its answer. Pass 1 has always
  // refused to call a Timeout a kill until it reproduces alone.
  const wholenet = readFileSync(join(ROOT, "scripts", "mutation-wholenet.mjs"), "utf8");
  assert.match(wholenet, /if \(got !== baseline\[leg\.name\]\) got = await runLeg\(leg\);/,
    "the first difference a leg shows is accepted as a detection — a first difference is a reading, " +
    "not a measurement");
  assert.match(wholenet, /observed, expected/,
    "the ledger does not record what the leg returned, so the next contaminated reading will be " +
    "arguable instead of self-diagnosing");
});

test("the resume cache is keyed by module, not by position alone", () => {
  // RWD-2026-0094, fourth site of the family RWD-2026-0089 names — and the first where the
  // collision is real: four positions are shared between modules in the current reports.
  const wholenet = readFileSync(join(ROOT, "scripts", "mutation-wholenet.mjs"), "utf8");
  assert.match(wholenet, /const keyOf = \(mod, m\)/,
    "the ledger key carries no module, so a mutant at the same position in two files shares one " +
    "verdict — and the entry records no module either, so nothing afterwards can detect it");
  assert.match(wholenet, /module: t\.mod/, "the ledger entry does not record its module");
});
