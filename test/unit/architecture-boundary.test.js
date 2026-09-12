// The hexagon, as a rule a machine applies (ADR-0075, ratified 2026-09-12).
//
// `hexa-architecture` and `hexa-adapter-pattern` are HIGH rules of runward's own manifest and both
// carry `requires: eslint` in the shipped corpus, because an architecture rule states a boundary and a
// boundary is provable by a lint rule that refuses the forbidden import — not by a sentence saying the
// boundary holds. Until this landed, this repository had no linter while `src/lib/styles.ts` carried an
// `eslint-disable` directive addressed to one: it believed it was linted.
//
// These tests exist because the boundary currently PASSES, which is the dangerous state for a new
// guard: a config that lost its rule, or a rule whose pattern never matches, is indistinguishable from
// a clean tree. So the rule is measured refusing a deliberate violation, and measured allowing the
// import that is legitimate one directory over.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";

// `import.meta.dirname`, not `new URL(import.meta.url).pathname`: on Windows the latter yields
// `/C:/…`, with a leading slash that turns every join into a path that does not exist. The Windows
// leg caught it, which is what that leg is for.
const ROOT = join(import.meta.dirname, "..", "..");
const FORBIDDEN = 'import { checkCommand } from "../commands/check.js";\nexport const x = checkCommand;\n';

test("the library may not import a command, and the linter says so", async () => {
  const eslint = new ESLint({ cwd: ROOT });
  const [res] = await eslint.lintText(FORBIDDEN, { filePath: join(ROOT, "src", "lib", "__boundary-probe.ts") });
  const errors = res.messages.filter((m) => m.severity === 2);
  assert.equal(errors.length, 1, `expected one error, got ${JSON.stringify(res.messages)}`);
  assert.equal(errors[0].ruleId, "no-restricted-imports");
  // The message has to teach the boundary, not just name a rule. An operator who reads "restricted
  // import" learns nothing; one who reads which way the arrow runs can fix it.
  assert.match(errors[0].message, /the dependency runs one\s+way only|library may never import a command/);
});

test("the same import from an adapter is allowed — the rule encodes a direction, not a ban", async () => {
  // The inverse failure is the one that gets a linter switched off: a rule that refuses honest code.
  // `src/commands/init.ts` really does import `checkCommand`, because init runs a check when it
  // finishes, and that composition is deliberate.
  const eslint = new ESLint({ cwd: ROOT });
  const [res] = await eslint.lintText(FORBIDDEN, { filePath: join(ROOT, "src", "commands", "__boundary-probe.ts") });
  assert.deepEqual(res.messages.filter((m) => m.severity === 2), []);
});

test("the committed lint report is what the manifests cite, and it is a report the gate can read", () => {
  // A row citing `file:reports/eslint.json#src/lib/x.ts` is only evidence if the file is a real ESLint
  // report AND records that source file. Both are the adapter's questions, asked here with its reader.
  const report = readFileSync(join(ROOT, "reports", "eslint.json"), "utf8");
  assert.match(report, /"filePath"/);
  assert.match(report, /"messages"/);
  const entries = JSON.parse(report);
  assert.ok(Array.isArray(entries) && entries.length > 0);
  // Every path is project-relative: an absolute one is the generating machine's layout, which is what
  // makes a report uncommittable (the same defect the JUnit step strips and ADR-0071 removed from the
  // delivery report).
  for (const e of entries) {
    assert.ok(!e.filePath.startsWith("/") && !/^[A-Za-z]:/.test(e.filePath), `absolute path in report: ${e.filePath}`);
  }
  // And it carries the files the manifests point at.
  const paths = new Set(entries.map((e) => e.filePath));
  for (const cited of ["src/lib/conformance.ts", "src/lib/mission.ts", "src/lib/evidence.ts", "src/lib/verdict.ts", "src/lib/manifest-sync.ts", "src/lib/harness.ts", "src/lib/tools.ts"]) {
    assert.ok(paths.has(cited), `${cited} is cited by a manifest row and absent from the report`);
  }
});

test("CI runs the boundary and proves the committed reports are current (RWD-2026-0113)", () => {
  // A guard nobody runs is a comment. The staleness this closes was measured, not imagined: the
  // committed JUnit report was already missing the cases two PRs had added the same day, and renaming
  // a cited case out of the suite left `runward check --strict` at exit 0 — the gate vouching for a
  // test that no longer exists.
  const ci = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(ci, /npm run lint/, "the boundary is not enforced in CI");
  assert.match(ci, /npm run test:reports/, "nothing proves the committed reports are current");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.lint, "node node_modules/eslint/bin/eslint.js src");
  assert.match(pkg.scripts["test:reports"], /reports-fresh\.mjs/);
});
