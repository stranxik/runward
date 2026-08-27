// A survivor's identity has ONE implementation. ADR-0059 ratification criterion 5.
//
// The register and the ratchet compare on that identity. Two implementations would drift, and a
// ratchet whose sides key differently reports noise on every run until someone switches it off —
// the failure mode ADR-0046 decision 3 names for instruments that make honest work wait.
//
// The properties pinned here are the ones the key exists for: it survives code moving ABOVE the
// mutant (three fixes in 0.36.1 shifted 84 mutants by 47 lines) and it changes when the mutated code
// changes. Both directions matter — a key that never changes guards nothing, and one that changes on
// re-indentation cries on every honest commit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SEP, assignOrdinals, stableKey, describeKey } from "../../scripts/mutation-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = join(ROOT, "scripts");
const VERDICTS = join(ROOT, "docs", "compliance", "mutation-survivors");
const PERIMETER = new Set(
  (JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8")).mutate ?? [])
    .map((p) => p.replace(/^.*\//, "").replace(/\.js$/, "")));

const base = {
  module: "evidence",
  function: "resolvePointer",
  mutator: "ConditionalExpression",
  replacement: "true",
  original: "p.symbol !== undefined",
  source: "if (p.symbol !== undefined) return null;",
};

test("moving code above a mutant does not change its identity", () => {
  // The whole point. Nothing in the key is an offset, so a mutant that did not move relative to its
  // own line keeps its identity when a hundred lines land above it.
  assert.equal(stableKey(base), stableKey({ ...base }));
});

test("re-indentation does not change its identity", () => {
  assert.equal(
    stableKey({ ...base, source: "      if (p.symbol !== undefined)   return null;" }),
    stableKey({ ...base, source: "if (p.symbol !== undefined) return null;" }),
  );
});

test("changing the mutated code changes its identity", () => {
  for (const field of ["module", "function", "mutator", "replacement", "original", "source"]) {
    assert.notEqual(stableKey({ ...base, [field]: `${base[field]}-changed` }), stableKey(base),
      `${field} must take part in the identity, or two different mutants can share one`);
  }
});

test("an empty replacement is a legitimate mutation, not a missing field", () => {
  // `StringLiteral -> ""` is one of the most common mutations there is. A truthiness check on
  // `replacement` would reject it, and the register carries 68 of them.
  assert.equal(typeof stableKey({ ...base, replacement: "" }), "string");
});

test("a partial mutant is refused rather than keyed", () => {
  for (const field of ["module", "mutator", "source", "replacement"]) {
    const partial = { ...base };
    delete partial[field];
    assert.throws(() => stableKey(partial), /missing/,
      `a key built without ${field} is not stable, it is merely different`);
  }
});

test("describeKey round-trips the parts a human has to act on", () => {
  const described = describeKey(stableKey(base));
  for (const part of [base.function, base.mutator, base.replacement, base.original]) {
    assert.ok(described.includes(part), `"${part}" is missing from the human form`);
  }
});

// --- criterion 5 proper: there is only one implementation ---------------------------------------

test("every consumer imports the key rather than rebuilding it", () => {
  // A second implementation is the failure this criterion exists to prevent, and it would not
  // announce itself: both sides would keep producing keys, and only the comparison would rot.
  const offenders = [];
  for (const f of readdirSync(SCRIPTS).filter((x) => x.endsWith(".mjs"))) {
    if (f === "mutation-key.mjs") continue;
    const src = readFileSync(join(SCRIPTS, f), "utf8");
    const usesKey = /stableKey|describeKey/.test(src);
    if (!usesKey) continue;
    const imports = /from\s+"\.\/mutation-key\.mjs"/.test(src);
    if (!imports) offenders.push(f);
  }
  assert.deepEqual(offenders, [],
    "these scripts name the key but do not import it — a second implementation has appeared");
});

test("the committed verdicts carry keys this implementation still produces", () => {
  // Binds the artifact to the code: if the key ever changes shape, every committed verdict becomes
  // uncomparable, and the ratchet would report the entire register as vanished. That must fail here,
  // loudly, rather than in a release job at midnight.
  const files = readdirSync(VERDICTS).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "no verdicts to check the key against");
  let checked = 0;
  const shape = stableKey(base).split(SEP).length;
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(VERDICTS, f), "utf8"));
    for (const v of j.verdicts) {
      assert.ok(v.stableKey, `${f}: a verdict carries no stableKey`);
      // This compared 1 to 1 until 2026-08-27: it split on String.fromCharCode(31) while SEP is
      // \x01, so every key was one part and the assertion could not fail. Pointed at the real
      // separator it failed at once — because its statement was also wrong. A key carries the six
      // base components, PLUS an ordinal from the second textually identical sibling on a line on.
      const parts = v.stableKey.split(SEP);
      assert.ok(parts.length === shape || parts.length === shape + 1,
        `${f}: a committed key has ${parts.length} parts, this implementation produces ${shape} ` +
        `(or ${shape + 1} with a sibling ordinal) — the key changed shape and the register is ` +
        "now uncomparable");
      if (parts.length === shape + 1) assert.match(parts[shape], /^#\d+$/,
        `${f}: the extra component is not a sibling ordinal but ${JSON.stringify(parts[shape])}`);
      // Was `startsWith("evidence")` — true only while evidence was the one module measured, and
      // it reddened the day compliance entered the perimeter. The property is that a key names a
      // module the perimeter actually covers, which is what makes keys from two modules comparable.
      const mod = v.stableKey.split(SEP)[0];
      assert.ok(PERIMETER.has(mod),
        `${f}: key names module ${JSON.stringify(mod)}, which is not in the mutation perimeter ` +
        `(${[...PERIMETER].sort().join(", ")})`);
      checked++;
    }
  }
  assert.ok(checked > 200, `only ${checked} verdicts checked — expected the whole register`);
});

// Two mutants of the SAME text, same mutator, same replacement, on the SAME line.
//
// Measured twice: two empty string literals on one line of `unsafeSignature` (among the 217
// committed verdicts), and `normalize("NFC")` twice on one line of `onDiskSpelling`, each
// occurrence its own mutant. The key used to collapse them, so a register keyed on it held one and
// dropped the other.
//
// The separator is an ORDINAL, not a column. A column is the offset this key exists not to depend
// on; a rank among siblings survives re-indentation and reformatting, and changes only when a
// sibling is added or removed.
const twin = {
  module: "evidence", function: "onDiskSpelling", mutator: "StringLiteral",
  replacement: "", original: '"NFC"', source: 'x("NFC") === y("NFC")',
};

test("two identical mutations on one line no longer share an identity", () => {
  const a = { ...twin, line: 303, column: 28 };
  const b = { ...twin, line: 303, column: 54 };
  assert.equal(stableKey(a), stableKey(b), "without ordinals they are the same key, which is the problem");
  assignOrdinals([a, b]);
  assert.notEqual(stableKey(a), stableKey(b), "with ordinals they are two mutants again");
  assert.deepEqual([a.ordinal, b.ordinal], [1, 2]);
});

test("the ordinal follows position on the line, never the order they were collected in", () => {
  const later = { ...twin, line: 303, column: 54 };
  const earlier = { ...twin, line: 303, column: 28 };
  assignOrdinals([later, earlier]);   // deliberately out of order
  assert.equal(earlier.ordinal, 1, "the first occurrence on the line is always #1");
  assert.equal(later.ordinal, 2);
});

test("a mutant with no twin keeps the key it had before ordinals existed", () => {
  // The extension is backwards compatible on purpose: 216 of the 217 committed verdicts must not
  // move, or a key change would read as drift in the very artifact that detects drift.
  const solo = { ...twin, line: 1, column: 1 };
  const before = stableKey(solo);
  assignOrdinals([solo]);
  assert.equal(stableKey(solo), before);
  assert.equal(solo.ordinal, 1);
});

test("an ordinal survives re-indentation, which is the whole reason it is not a column", () => {
  const a = { ...twin, line: 303, column: 28 };
  const b = { ...twin, line: 303, column: 54 };
  assignOrdinals([a, b]);
  const keys = [stableKey(a), stableKey(b)];
  // The same two mutants after the line is re-indented by four spaces: columns move, the trimmed
  // source text does not, and neither does the rank.
  const a2 = { ...twin, source: `    ${twin.source}`, line: 303, column: 32 };
  const b2 = { ...twin, source: `    ${twin.source}`, line: 303, column: 58 };
  assignOrdinals([a2, b2]);
  assert.deepEqual([stableKey(a2), stableKey(b2)], keys,
    "a column would have changed here; a rank among siblings does not");
});

test("three siblings number 1, 2, 3 and stay distinct", () => {
  const three = [58, 30, 44].map((column) => ({ ...twin, line: 12, column }));
  assignOrdinals(three);
  assert.equal(new Set(three.map(stableKey)).size, 3);
  assert.deepEqual(three.map((m) => m.ordinal).sort(), [1, 2, 3]);
});
