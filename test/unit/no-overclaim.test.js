// Claims runward is not entitled to make, refused across the whole shipped surface.
//
// `positioning-drift.test.js` already guards one doctrine file. A reliability review of the project
// (2026-08-04) noted the gap: the overclaim it caught that week lived in the SITE repo, which that
// test cannot read, and the compliance document handed to regulated buyers carried a claim nothing
// checked. So this guard scans everything the project ships: the README, the docs, the templates a
// mission receives, runward's own mission files, and the strings the CLI itself prints.
//
// ADR-0050 decision 2: the forbidden-claim list is no longer defined here. It lives in
// `src/lib/claims-rules.ts` and ships with the package (the `runward/claims` export), so a
// site-build guard can consume the SAME list from the pinned dependency — two lists cannot drift
// when there is one. This file consumes it and keeps its three meta-guards: the safe-list tested in
// both directions, the frozen citations, and the assertion that the scan reaches the whole surface.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CLAIMS_RULES as RULES, NEGATED, FROZEN_CITATIONS } from "../../dist/lib/claims-rules.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN = ["README.md", "docs", "templates", "runward", "src"];
const SKIP = /node_modules|\.git|dist|coverage|\.stryker/;

function files(rel) {
  const abs = join(ROOT, rel);
  let st; try { st = statSync(abs); } catch { return []; }
  if (st.isFile()) return [abs];
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (SKIP.test(p)) continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(md|ts|json|ya?ml)$/.test(e.name)) out.push(p);
    }
  };
  walk(abs);
  return out;
}

const CORPUS = SCAN.flatMap(files).map((abs) => ({
  path: relative(ROOT, abs).split(sep).join("/"),
  lines: readFileSync(abs, "utf8").split("\n"),
}));

// The two files that DEFINE the forbidden phrases in order to forbid them are not subject to them:
// this test, and the rules module it now consumes.
const DEFINES_THE_RULES = (path) => path.endsWith("no-overclaim.test.js") || path.endsWith("claims-rules.ts");

test("no forbidden claim anywhere on the shipped surface", () => {
  const hits = [];
  for (const { path, lines } of CORPUS) {
    if (DEFINES_THE_RULES(path)) continue;
    lines.forEach((line, i) => {
      for (const r of RULES) {
        if (!r.re.test(line)) continue;
        if (NEGATED.test(line)) continue;
        if (FROZEN_CITATIONS.some((c) => line.includes(c))) continue; // a decision, not a regex accident
        hits.push(`${path}:${i + 1}\n      claim: ${r.name}\n      line:  ${line.trim().slice(0, 120)}\n      why:   ${r.why}\n      say:   ${r.instead}`);
      }
    });
  }
  assert.deepEqual(hits, [],
    `\n\n${hits.length} forbidden claim(s) on the shipped surface:\n\n    ${hits.join("\n\n    ")}\n\n` +
    `Each of these was ruled out with a source by the 2026-08-04 reliability review. If a claim has since\n` +
    `become TRUE, back it with a mechanism first and then relax the rule here, in that order.\n`);
});

test("the guard consumes a non-trivial rule set from the package", () => {
  // ADR-0050 decision 2: the list is externalised, so a broken or empty import would silently turn
  // the guard into a no-op. Assert it carries the shipped rules and the frozen citations it needs.
  assert.ok(RULES.length >= 10, `expected the shipped rule set, got ${RULES.length}`);
  assert.ok(RULES.every((r) => r.re instanceof RegExp && r.name && r.instead && r.why), "each rule is well-formed");
  assert.ok(FROZEN_CITATIONS.length >= 2, "the frozen citations travel with the rules");
});

// Under a Stryker sandbox the project is copied partially, so this meta-guard measures the sandbox
// rather than the repository and reports "1 file scanned" on a checkout that has hundreds. It asserts
// a property of the REPOSITORY (the guard's reach), never a behaviour of the code being mutated, so
// skipping it there removes nothing from the mutation net — while leaving it would fail every dry run
// and make the instrument unusable, which is the worse outcome (ADR-0046 decision 3).
const IN_MUTATION_SANDBOX = process.cwd().includes(".stryker-tmp") || !!process.env.__STRYKER_ACTIVE_MUTANT__;

test("the guard scans more than one file, and knows what it scanned", { skip: IN_MUTATION_SANDBOX && "measures the repository, not a mutation sandbox" }, () => {
  // The previous guard read a single doctrine file, which is how an overclaim shipped in the
  // compliance document and another on the website. A guard whose reach is not asserted quietly
  // shrinks to nothing.
  assert.ok(CORPUS.length > 100, `only ${CORPUS.length} files scanned`);
  for (const must of ["README.md", "docs/compliance/regulated-adoption.md", "templates/targets/AGENTS.md"]) {
    assert.ok(CORPUS.some((f) => f.path === must), `${must} must be in the scanned surface`);
  }
});

test("the guard does not fire on legitimate prose", () => {
  // A guard that cries on the safe case gets switched off, and then it guards nothing. Today alone,
  // three guards written here refused an honest input before this lesson landed.
  const safe = [
    "runward is not SOC 2 certified, and cannot be: there is no organisation behind it",
    "Interdit : « CRA-compliant ». Autorisé : « hors champ tant que non monétisé »",
    "SOC 2 (later) — a control-matrix skeleton with criteria mapping",
    "Detect workspace markers without parsing them",
    "npm OIDC Trusted Publishing plus SLSA provenance attestation; verify with npm audit signatures",
    "each release carries a SLSA attestation linking the tarball to the exact workflow run",
    "runward never makes you compliant; it produces pieces an assessment consumes",
    // The tool-confidence section must remain writable: explaining a scheme is not asserting a level.
    "T3 covers tools generating output that contributes to the executable code, and runward does not",
    "the least demanding qualification level draws on fourteen objectives and asks about the use of the tool",
    "It asserts no level and no class for runward, in any scheme",
    "Between T1 and T2, the T2 definition is a literal description of what section 5.1 records",
    "Those are inputs that push a tool confidence analysis upward, meaning more work demanded of the tool",
    "clause 6.7 requires the selection of T2 and T3 tools to be justified by the operator",
    "what runward can supply are the inputs: a declared intended use, a declared non scope, version identity",
  ];
  for (const line of safe) {
    const fired = RULES.filter((r) => r.re.test(line) && !NEGATED.test(line)).map((r) => r.name);
    assert.deepEqual(fired, [], `false positive on: ${line}`);
  }
});

test("a frozen citation is writable verbatim, and every paraphrase of it still fires", () => {
  // Both directions, because each alone is worthless: an exemption tested only on the allowed side
  // is a hole, and one tested only on the refused side is a guard nobody proved lets honest prose
  // through. The paraphrases below are exactly what a well-meaning edit produces: drop the "v1.0",
  // translate, shorten. Each must face the SLSA rule with no accident to hide behind.
  const slsaRule = RULES.find((r) => r.name === "SLSA level asserted without an assessment");
  for (const c of FROZEN_CITATIONS) {
    const line = `GitHub's documentation states: "${c}"`;
    const exempt = FROZEN_CITATIONS.some((x) => line.includes(x));
    assert.ok(exempt, `the verbatim citation must be exempt: ${c.slice(0, 60)}`);
  }
  for (const paraphrase of [
    "this chain meets SLSA Build Level 3",
    "runward reaches SLSA level 3 via reusable workflows",
    "provides SLSA Build L2 provenance",
  ]) {
    assert.ok(slsaRule.re.test(paraphrase), `a paraphrase must still fire: ${paraphrase}`);
    assert.ok(!FROZEN_CITATIONS.some((x) => paraphrase.includes(x)), "and must not be exempt");
  }
});
