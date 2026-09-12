// The two committed security scans (ADR-0075 part 2, ratified 2026-09-12).
//
// `config-secrets-boundary` and `checklist-pre-production-security` are CRITICAL rules of runward's own
// manifest and both carry `requires: sarif`. Citing the OSSF Scorecard SARIF this repository already
// uploads was refused: it resolves, it is a real report, and it bears on neither rule — a pointer that
// resolves and does not bear on its rule is the vague spelling that passes.
//
// What these tests hold is not "the scan is green" — CI runs the scan. It is that the committed reports
// are the kind of artifact a gate may re-open, and that the CONFIGURATION decided about every rule
// rather than letting a default decide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isSarifReport, sarifRuleResult } from "../../dist/lib/tool-adapters.js";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

test("the committed security scans are reports the gate can re-open", () => {
  for (const rel of ["reports/secretlint.sarif", "reports/eslint-security.sarif"]) {
    assert.ok(existsSync(join(ROOT, rel)), `${rel} is cited by a CRITICAL row and must be committed`);
    assert.ok(isSarifReport(read(rel)), `${rel} is read as SARIF by the adapter that adjudicates it`);
  }
  const scan = read("reports/eslint-security.sarif");
  // The cited rule, and why it is the one cited: ADR-0054 forbids a spawn in the verdict path, and this
  // is that claim machine-checked across src/.
  assert.equal(sarifRuleResult(scan, "security/detect-child-process"), "clean");
  // A rule with findings is NOT evidence, and the adapter says so rather than averaging it away.
  assert.equal(sarifRuleResult(scan, "security/detect-unsafe-regex"), "findings");
  // A rule the config turned off is `absent`: the scan does not vouch for what it never checked, which
  // is the whole reason the exclusions are named with their counts instead of being silent.
  assert.equal(sarifRuleResult(scan, "security/detect-object-injection"), "absent");
});

test("every security rule the plugin ships is DECIDED about, never left to a default", async () => {
  // The guard that survives a dependency bump. A new rule arriving in a new version of the plugin would
  // otherwise be silently off (or silently on and reddening), and the committed report would change
  // meaning without anyone choosing. Relevance is a judgment; making it every time is not optional.
  const security = (await import("eslint-plugin-security")).default;
  // `pathToFileURL`, not a bare absolute path: a dynamic import of `C:\...` throws
  // ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows. The Windows leg caught it, twice in two changes now —
  // once for `new URL().pathname`, once here. Every path that crosses into ESM needs a URL.
  const config = (await import(pathToFileURL(join(ROOT, "eslint.security.config.js")).href)).default;
  const placed = new Set(Object.keys(config.find((b) => b.rules)?.rules ?? {}));
  const missing = Object.keys(security.rules).map((r) => `security/${r}`).filter((id) => !placed.has(id));
  assert.deepEqual(missing, [], `eslint.security.config.js does not decide about: ${missing.join(", ")}`);
});

test("the secrets scan proves its own sensitivity, and the step says so out loud", () => {
  // secretlint's SARIF carries `"rules": []` when nothing fires (measured 2026-09-12), so a clean report
  // is indistinguishable from a scan that checked nothing. "A zero without a positive control does not
  // distinguish nothing from blind" is this project's rule, and it applies to its own evidence first.
  // The proof is an artifact, not a log line: three rules the scanner demonstrably fired on, beside the
  // empty repository scan they give meaning to.
  const control = JSON.parse(read("reports/secretlint-control.json"));
  assert.ok(Array.isArray(control.rulesProvenLive));
  for (const rule of ["aws", "github", "npm"]) {
    assert.ok(control.rulesProvenLive.some((r) => r.includes(rule)), `no rule proven live for ${rule}`);
  }
  // The repository scan found nothing — which now means clean rather than blind.
  const log = JSON.parse(read("reports/secretlint.sarif"));
  assert.equal(log.runs.reduce((n, r) => n + (r.results?.length ?? 0), 0), 0);
  // The control is BUILT at run time from fragments, because this script sits INSIDE the scanned
  // perimeter and a control that trips the scan it controls is not a control. The check is the tool's,
  // not a regex of ours: `scripts/**/*.mjs` is in the scanned targets, and the scan above is empty.
  //
  // A regex was tried here first and it was wrong in an instructive way — it matched
  // `AKIAIOSFODNN7EXAMPLE` inside the COMMENT that explains why that key cannot serve as a control.
  // The most public string in AWS's documentation is not a credential, and a guard that cannot tell a
  // credential from a sentence about credentials is the phantom-pointer defect wearing a security hat.
  const step = read("scripts/security-scans.mjs");
  assert.match(step, /"scripts\/\*\*\/\*\.mjs"/, "the step must scan itself, or the fragments prove nothing");
  assert.match(step, /const PLANTED = \[/);
  assert.equal((step.match(/secretlint-rule-(aws|github|npm)"/g) ?? []).length, 3, "three planted credentials: one firing rule proves one rule");
});
