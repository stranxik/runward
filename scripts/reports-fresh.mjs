// Prove the committed reports are CURRENT (RWD-2026-0113).
//
// The gate reads a committed report and never runs the tool — that is ADR-0054's boundary and it is
// not negotiable. The consequence nobody had closed: a committed report is paperwork unless something
// proves it still describes the tree. Measured 2026-09-12 on this repository, twice:
//
//   1. `reports/junit.xml` was ALREADY stale — missing the 12 cases two PRs had added the same day.
//   2. The dangerous direction, demonstrated rather than argued: rename a cited case out of the suite,
//      leave the report untouched, and `runward check --strict` returns exit 0. The gate vouches for a
//      test that no longer exists. That is a false green reached through paperwork, which is the one
//      thing ADR-0045 exists to refuse.
//
// So the division of labour is: the GATE reads the report, and CI proves the report is current. That
// is the same shape ADR-0059 ratified for mutation (the ratchet is freshness enforced in CI, not a
// verdict rule), and it is the only answer that stays inside the runtime boundary.
//
// The comparison is SEMANTIC for JUnit and byte-exact for ESLint, and that asymmetry is measured, not
// stylistic: `node --test` emits testcases in completion order across parallel files, so two honest
// runs on machines with different core counts produce the same census in a different order. A byte gate
// there would flap, and a gate that flaps is a gate that gets disabled. The ESLint step sorts its
// entries, so bytes are meaningful.
//
// Every verdict below is read with the PRODUCT's own reader, `junitTestResult`. A second
// implementation of "is this case green" is how this codebase once answered "is this ADR ratified?"
// two different ways, and it published the wrong one.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { junitTestResult } from "../dist/lib/tool-adapters.js";

const ROOT = resolve(import.meta.dirname, "..");
const JUNIT = join(ROOT, "reports", "junit.xml");
const ESLINT = join(ROOT, "reports", "eslint.json");
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

const before = { junit: read(JUNIT), eslint: read(ESLINT) };
const problems = [];

for (const [label, script] of [["junit", "junit-committable.mjs"], ["eslint", "eslint-committable.mjs"]]) {
  const run = spawnSync(process.execPath, [join(ROOT, "scripts", script)], { cwd: ROOT, stdio: "inherit" });
  if (run.status !== 0) problems.push(`${label}: the tool itself is not green (exit ${run.status}) — fix that before the report can be evidence`);
}

const after = { junit: read(JUNIT), eslint: read(ESLINT) };

/** Every `name` a JUnit report records. A census of names is not a verdict, so it is read here; the
 *  verdicts come from the product's reader below. */
function caseNames(xml) {
  const out = new Set();
  for (const m of xml.matchAll(/<testcase\b[^>]*\bname\s*=\s*"([^"]*)"/gi)) {
    out.add(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&amp;/g, "&"));
  }
  return out;
}

/** WHY a case is not green — never whether it is. The gate's verdict authority stays
 *  `junitTestResult` and is used for that above; this asks a different question, and it asks it
 *  because the answer decides whether a difference between two honest runs is staleness or a platform.
 *
 *  Measured 2026-09-12 on the first CI run of this very guard, which is how the distinction was
 *  learned rather than assumed: four case-folding cases
 *  (`a pointer mis-spelling the file component is refused` and its kin) carry
 *  `{ skip: CASE_INSENSITIVE ? false : "this filesystem is case-sensitive…" }`. They RUN and pass on
 *  macOS and are `<skipped>` on Linux, deliberately, with the reason written into the skip. A gate that
 *  failed on that would fail on every machine that is not the one the report was generated on — and a
 *  gate that flaps is a gate that gets disabled. */
function notGreenKind(xml, name) {
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attr = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const open = new RegExp(`<testcase\\b[^>]*\\bname\\s*=\\s*"(?:${esc(attr)}|${esc(name)})"[^>]*?(/?)>`, "ig");
  for (let m = open.exec(xml); m !== null; m = open.exec(xml)) {
    if (m[1] === "/") continue;
    const start = m.index + m[0].length;
    const end = xml.indexOf("</testcase>", start);
    const body = end === -1 ? xml.slice(start) : xml.slice(start, end);
    if (/<(?:failure|error)\b/i.test(body)) return "failed";
    if (/<skipped\b/i.test(body)) return "skipped";
  }
  return null;
}

if (before.junit === null) problems.push("junit: reports/junit.xml is not committed — the rows that cite it point at nothing");
else if (after.junit !== null) {
  const was = caseNames(before.junit), now = caseNames(after.junit);
  const gone = [...was].filter((n) => !now.has(n));
  const added = [...now].filter((n) => !was.has(n));
  const changed = [...now].filter((n) => was.has(n) && junitTestResult(before.junit, n) !== junitTestResult(after.junit, n));
  // A case that genuinely turned RED is staleness the report hides, and it fails. A case that turned
  // SKIPPED, or that was skipped and now passes, is the platform speaking; it is said, not judged.
  const regressed = changed.filter((n) => junitTestResult(before.junit, n) === "pass" && notGreenKind(after.junit, n) === "failed");
  const platform = changed.filter((n) => !regressed.includes(n));
  if (gone.length) problems.push(`junit: ${gone.length} case(s) the committed report vouches for are NO LONGER IN THE SUITE — a row citing one of these is green on a test that does not exist:\n    ${gone.slice(0, 8).map((n) => JSON.stringify(n)).join("\n    ")}`);
  if (added.length) problems.push(`junit: ${added.length} case(s) exist in the suite and not in the committed report — evidence a row cannot cite yet:\n    ${added.slice(0, 8).map((n) => JSON.stringify(n)).join("\n    ")}`);
  if (regressed.length) problems.push(`junit: ${regressed.length} case(s) the committed report records as green are FAILING now:\n    ${regressed.slice(0, 8).map((n) => JSON.stringify(n)).join("\n    ")}`);
  if (platform.length) {
    console.log(`◑ ${platform.length} case(s) differ between the committed report and this machine, by skip rather than by failure — a filesystem or capability the generating machine had and this one does not (or the reverse). Disclosed, not judged:`);
    for (const n of platform.slice(0, 8)) {
      console.log(`    ${JSON.stringify(n)}: ${junitTestResult(before.junit, n)} → ${notGreenKind(after.junit, n) ?? "pass"}`);
    }
  }
}

if (before.eslint === null) problems.push("eslint: reports/eslint.json is not committed — the rows that cite it point at nothing");
else if (after.eslint !== before.eslint) problems.push("eslint: reports/eslint.json is stale — regenerate it with `npm run test:eslint` and commit the result");

if (problems.length === 0) {
  console.log("✓ the committed reports describe this tree: every case the manifests may cite exists, with the verdict recorded");
  process.exit(0);
}
console.error("\n✗ committed reports are not current (RWD-2026-0113):\n");
for (const p of problems) console.error(`  - ${p}`);
console.error("\n  Run `npm run test:junit && npm run test:eslint` and commit reports/. A report the gate\n  re-opens must describe the tree it is committed beside, or the gate vouches for paperwork.\n");
process.exit(1);
