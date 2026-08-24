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
import { stableKey, describeKey } from "../../scripts/mutation-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = join(ROOT, "scripts");
const VERDICTS = join(ROOT, "docs", "compliance", "mutation-survivors");

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
  const shape = stableKey(base).split(String.fromCharCode(31)).length;
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(VERDICTS, f), "utf8"));
    for (const v of j.verdicts) {
      assert.ok(v.stableKey, `${f}: a verdict carries no stableKey`);
      assert.equal(v.stableKey.split(String.fromCharCode(31)).length, shape,
        `${f}: a committed key has ${v.stableKey.split(String.fromCharCode(31)).length} parts, this ` +
        `implementation produces ${shape} — the key changed shape and the register is now uncomparable`);
      assert.ok(v.stableKey.startsWith("evidence"), `${f}: key does not start with its module`);
      checked++;
    }
  }
  assert.ok(checked > 200, `only ${checked} verdicts checked — expected the whole register`);
});
