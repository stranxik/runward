// Every shipped sentence that states how many phases the method has, or how many the gate gates,
// is held to the numbers the code carries. A first concrete instance of a claims check: one claim
// family, a closed grammar, derived from the source, deterministic.
//
// Why it exists: the README guard (conformance.test.js) reads the `## The method:` heading and
// the 1,500 characters after it, and nothing else. `templates/workflows/method.md` said the method
// "sequences six gated phases" and "Run the six phases, each behind a gate" — shipped to every
// mission by `init`, copied into runward's own mission, and invisible to that guard. README's own
// introduction said "six gated phases" forty lines above the heading it did read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The numbers, from the code. PHASES is the presence gate's phase list, numbered as the method
// numbers them ("1 · Frame" … "6 · Hand over"); the phase it does not list is the one with no gate
// (`iterate`, ADR-0033). So: total = the highest ordinal, gated = the entries.
const ordinals = PHASES.map((p) => Number.parseInt(p.label, 10));
const TOTAL = Math.max(...ordinals);
const GATED = PHASES.length;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const N = `(\\d+|${WORDS.join("|")})`;
const num = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS.indexOf(s.toLowerCase()));

/** The closed grammar. Each pattern names what it claims; anything else is not read as a claim. */
const CLAIMS = [
  // "six phases, five of them gated" / "six phases, five of them behind a gate"
  { re: new RegExp(`\\b${N} phases, ${N} of them (?:gated|behind a gate)\\b`, "gi"),
    check: (m) => num(m[1]) === TOTAL && num(m[2]) === GATED },
  // "six gated phases" / "five gated phases"
  { re: new RegExp(`\\b${N} gated phases\\b`, "gi"), check: (m) => num(m[1]) === GATED },
  // "six phases, gated" / "six phases, each behind a gate" / "six phases, each gated": all of them
  { re: new RegExp(`\\b${N} phases, (?:each (?:gated|behind a gate)|gated)\\b`, "gi"),
    check: (m) => num(m[1]) === TOTAL && TOTAL === GATED },
  // "the six phases" / "the six-phase chain": the method's total
  { re: new RegExp(`\\bthe ${N}[ -]phases?\\b`, "gi"), check: (m) => num(m[1]) === TOTAL },
];

/** Every phase-count claim in a text, with whether it holds. Exported shape kept local: the
 *  controls below feed it planted text, so the grammar is tested apart from the file walk. */
function claimsIn(text) {
  const found = [];
  for (const { re, check } of CLAIMS)
    for (const m of text.matchAll(re)) found.push({ sentence: m[0], holds: check(m) });
  return found;
}

// The shipped text surfaces. README and NOTICE ship in the package; templates/** and regimes/** are
// what `init` writes; the example mission ships; runward/workflows/** is runward's own copy of the
// templates; docs/** is where the method is described. Excluded, because they QUOTE retracted
// sentences as history and rewriting a quote would falsify the record: docs/adr/** (decisions as
// taken) and the known-defects register (it cites the false sentences it files).
const SURFACES = ["README.md", "NOTICE.md", "templates", "regimes", "docs", "runward/workflows",
  "examples/request-triage/AGENTS.md", "examples/request-triage/runward"];
const EXCLUDED = [`docs${sep}adr${sep}`, join("docs", "compliance", "known-defects.md")];
const TEXT = /\.(md|txt|ya?ml|toml)$/;

function walk(rel) {
  const abs = join(ROOT, rel);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((e) => walk(join(rel, e)));
}

test("every shipped sentence stating a phase count matches the phases the gate actually gates", () => {
  assert.equal(TOTAL, 6, "the method's phase count moved — update the prose it is stated in, then this line");
  assert.equal(GATED, 5, "the gated phase count moved — update the prose it is stated in, then this line");
  const files = SURFACES.flatMap(walk)
    .map((abs) => relative(ROOT, abs))
    .filter((rel) => TEXT.test(rel) && !EXCLUDED.some((x) => rel.startsWith(x)));
  const wrong = [];
  const seen = new Set();
  for (const rel of files)
    for (const c of claimsIn(readFileSync(join(ROOT, rel), "utf8"))) {
      seen.add(rel);
      if (!c.holds) wrong.push(`${rel}: "${c.sentence}" (the method has ${TOTAL} phases, ${GATED} of them gated)`);
    }
  assert.deepEqual(wrong, [], `phase-count sentences contradict the gate:\n${wrong.join("\n")}`);
  // Non-vacuity: the surfaces that carried the defect are read, and the grammar recognised a claim
  // in each — a renamed directory or a grammar that matches nothing cannot pass this by seeing less.
  for (const rel of ["README.md", join("templates", "workflows", "method.md"), join("runward", "workflows", "method.md")])
    assert.ok(seen.has(rel), `${rel} carries no recognised phase-count claim — the scan is blind to it`);
});

test("the phase-count grammar refuses the shipped false sentences and accepts the true ones (controls)", () => {
  const verdict = (t) => claimsIn(t).map((c) => c.holds);
  // Re-planted, each must be red: the template's two sentences and the README's two.
  assert.deepEqual(verdict("It sequences six gated phases and delegates the detail."), [false]);
  assert.deepEqual(verdict("**Run the six phases, each behind a gate.**"), [false, true]);
  assert.deepEqual(verdict("## The method: six phases, gated"), [false]);
  assert.deepEqual(verdict("From there, a delivery spine: Six Gated Phases (a gate: …)"), [false]);
  assert.deepEqual(verdict("six phases, six of them gated"), [false]);
  assert.deepEqual(verdict("seven phases, five of them gated"), [false]);
  // The true statements stay green.
  assert.deepEqual(verdict("## The method: six phases, five of them gated"), [true]);
  assert.deepEqual(verdict("**Run the six phases, five of them behind a gate.**"), [true, true]);
  assert.deepEqual(verdict("the five gated phases at 6/4/10/12/4"), [true]);
  assert.deepEqual(verdict("re-enter the six-phase chain"), [true]);
  // Not a claim about the method: never read as one.
  assert.deepEqual(verdict("The release runs in two phases (ADR-0085)."), []);
});
