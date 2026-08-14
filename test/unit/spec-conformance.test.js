// Wave C obj 10 (ADR-0056): deterministic spec/constitution conformance — the hard verdict the
// LLM-prose-gated SDD tools (spec-kit, OpenSpec, BMAD) cannot produce.
//
// It checks LINKAGE and only linkage: every acceptance criterion carries a typed pointer to a
// present, non-empty delivered artifact. The load-bearing test is the NON-SCOPE one: a criterion
// linked to a file whose content is unrelated still resolves green, because the check never judges
// whether the artifact SATISFIES the criterion. The instant it did, it would need a model and
// GATE_NON_SCOPE would break.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { specConformance, SPEC_NON_SCOPE } from "../../dist/lib/spec-conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

function project() {
  const dir = mkdtempSync(join(tmpdir(), "rw-spec-"));
  mkdirSync(join(dir, "code"), { recursive: true });
  writeFileSync(join(dir, "code", "config.ts"), "export const config = {};\n");
  writeFileSync(join(dir, "code", "router.test.ts"), "test('classifies', () => {});\n");
  return { dir, drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("obj 10: a criterion linked to a present artifact is linked; no pointer or a dead pointer is not", () => {
  const p = project();
  const spec = [
    "# Spec", "", "## Acceptance Criteria", "",
    "- AC1 the router classifies -> test:code/router.test.ts::classifies",
    "- AC2 config validated -> file:code/config.ts",
    "- AC3 no pointer at all",
    "- AC4 dead link -> file:code/missing.ts",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.hasSection, true);
  assert.equal(r.criteria.length, 4);
  assert.equal(r.criteria[0].linked, true, "a test: pointer to a present file links");
  assert.equal(r.criteria[1].linked, true, "a file: pointer to a present file links");
  assert.equal(r.criteria[2].linked, false, "no pointer is not linked");
  assert.equal(r.criteria[3].linked, false, "a pointer that does not resolve is not linked");
  assert.equal(r.unlinked, 2);
  p.drop();
});

test("obj 10: NON-SCOPE — linkage only, never satisfaction (unrelated content still links)", () => {
  const p = project();
  // The artifact's content has nothing to do with the criterion. Linkage is present; satisfaction is
  // not judged. This is the boundary that keeps a model out of the verdict.
  writeFileSync(join(p.dir, "code", "config.ts"), "// totally unrelated to any criterion\n");
  const r = specConformance("## Criteria\n- the config is validated at boot -> file:code/config.ts", p.dir);
  assert.equal(r.criteria[0].linked, true, "a present artifact links regardless of whether it satisfies the criterion");
  assert.ok(SPEC_NON_SCOPE.length > 0 && /never/i.test(SPEC_NON_SCOPE) && /satisf/i.test(SPEC_NON_SCOPE),
    "and the non-scope says so, in words that travel with the verdict");
  p.drop();
});

test("obj 10: containment — a criterion may not link out of the tree", () => {
  const p = project();
  const r = specConformance("## Acceptance\n- escapes -> file:../../etc/passwd", p.dir);
  assert.equal(r.criteria[0].linked, false, "a `..`-escaping pointer never resolves");
  p.drop();
});

test("obj 10: no acceptance-criteria section is a distinct state, not an empty pass", () => {
  const p = project();
  assert.equal(specConformance("# Spec\n\njust prose, no criteria", p.dir).hasSection, false);
  p.drop();
});

test("obj 10: the CLI exits 0 all-linked, 1 on a gap, 2 without a criteria section, and carries the non-scope", () => {
  const p = project();
  const run = (spec, extra = []) => {
    writeFileSync(join(p.dir, "s.md"), spec);
    try { execFileSync(process.execPath, [CLI, "spec-check", "s.md", "-p", ".", ...extra], { cwd: p.dir, stdio: "pipe" }); return 0; }
    catch (e) { return e.status; }
  };
  assert.equal(run("## Acceptance\n- AC1 -> file:code/config.ts"), 0, "every criterion linked");
  assert.equal(run("## Acceptance\n- AC1 -> file:code/config.ts\n- AC2 unlinked"), 1, "one gap");
  assert.equal(run("# Spec\nno section"), 2, "no criteria section is misuse");
  // The JSON contract carries the non-scope with the numbers.
  writeFileSync(join(p.dir, "s.md"), "## Acceptance\n- AC1 -> file:code/config.ts");
  const j = JSON.parse(execFileSync(process.execPath, [CLI, "spec-check", "s.md", "-p", ".", "--json"], { cwd: p.dir, encoding: "utf8" }));
  assert.equal(j.verdict, "linked");
  assert.ok(j.specNonScope && /satisf/i.test(j.specNonScope), "the caveat travels in --json");
  p.drop();
});

// ── Audit 2026-08-14, blocking finding 2: the declared depth is honored, never silently dropped ────
// The first version verified presence + non-vacuity of the PATH only: a criterion linked to an
// absent symbol or a red test case read "linked" — the silent degradation `symbolDeclared`
// (evidence.ts) was created to refuse, reproduced in the newest feature. These tests pin the wiring
// of spec-check onto the SAME evidence layer the gate uses (symbolPresent, junitTestResult).

test("audit 2026-08-14: #SYMBOL is verified at an identifier boundary — a lost symbol fails loud", () => {
  const p = project();
  writeFileSync(join(p.dir, "code", "guard.ts"), "export function guardFieldsLegacy() {}\n");
  const spec = [
    "## Acceptance Criteria",
    "- AC1 present symbol -> file:code/config.ts#config",
    "- AC2 lost symbol -> file:code/guard.ts#guardFields",
    "- AC3 empty declared symbol -> file:code/config.ts#",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.criteria[0].linked, true, "a symbol present at an identifier boundary links");
  assert.equal(r.criteria[1].linked, false, "a PREFIX of a longer identifier is not the symbol — the renamed-identifier case");
  assert.match(r.criteria[1].reason, /symbol "guardFields" not found/);
  assert.equal(r.criteria[2].linked, false, "a `#` the author wrote must verify or fail loud, never be dropped");
  p.drop();
});

test("audit 2026-08-14: ::NAME against a committed JUnit report — green links, red and absent fail", () => {
  const p = project();
  writeFileSync(join(p.dir, "code", "junit.xml"),
    `<testsuite><testcase name="green"/><testcase name="red"><failure>x</failure></testcase></testsuite>\n`);
  const spec = [
    "## Acceptance Criteria",
    "- AC1 green case -> test:code/junit.xml::green",
    "- AC2 red case -> test:code/junit.xml::red",
    "- AC3 absent case -> test:code/junit.xml::missing",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.criteria[0].linked, true, "a recorded-green case links");
  assert.equal(r.criteria[1].linked, false, "a RED test is not evidence");
  assert.match(r.criteria[1].reason, /not green/);
  assert.equal(r.criteria[2].linked, false, "an absent case is not evidence");
  assert.match(r.criteria[2].reason, /no JUnit test case/);
  p.drop();
});

test("audit 2026-08-14: EVERY pointer must verify — one green path cannot mask a broken #SYMBOL beside it", () => {
  const p = project();
  const spec = [
    "## Acceptance Criteria",
    "- AC1 two pointers, one broken -> file:code/config.ts; file:code/config.ts#absentSymbol",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.criteria[0].linked, false, "the previous some() semantics let the green path mask the lost symbol");
  assert.match(r.criteria[0].reason, /absentSymbol/);
  p.drop();
});

test("audit 2026-08-14: ::NAME on a non-JUnit test source keeps the includes() semantics of the gate", () => {
  const p = project();
  const spec = [
    "## Acceptance Criteria",
    "- AC1 named test present -> test:code/router.test.ts::classifies",
    "- AC2 named test absent -> test:code/router.test.ts::doesNotExist",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.criteria[0].linked, true);
  assert.equal(r.criteria[1].linked, false, "a named test the file does not contain is not evidence");
  p.drop();
});

test("audit 2026-08-14: line depth — file:PATH:LINE beyond the file fails, like the gate", () => {
  const p = project();
  const spec = [
    "## Acceptance Criteria",
    "- AC1 within -> file:code/config.ts:1",
    "- AC2 beyond -> file:code/config.ts:9999",
  ].join("\n");
  const r = specConformance(spec, p.dir);
  assert.equal(r.criteria[0].linked, true);
  assert.equal(r.criteria[1].linked, false, "a line the file does not reach is not evidence");
  assert.match(r.criteria[1].reason, /fewer than 9999 lines/);
  p.drop();
});
