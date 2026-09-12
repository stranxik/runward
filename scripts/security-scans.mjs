// Two committed security scans, each whose subject IS the rule that cites it (ADR-0075 part 2).
//
//   reports/eslint-security.sarif — a static scan of `src/` under eslint-plugin-security, cited by
//     `checklist-pre-production-security`. The rule ids come from ESLint's OWN resolved configuration
//     (`calculateConfigForFile`), not from a list written here, because a `tool.driver.rules` array an
//     author types is an assertion about what ran; one the tool reports is a fact.
//
//   reports/secretlint.sarif — a secrets scan of the repository, cited by `config-secrets-boundary`.
//
// THE CONTROL, AND WHY THE SECRETS REPORT WOULD BE WORTHLESS WITHOUT IT. secretlint's SARIF carries
// `"rules": []` when nothing fires (measured 2026-09-12), so a clean report is indistinguishable from a
// scan that checked nothing — "a zero without a positive control does not distinguish nothing from
// blind" is this project's own rule, and it applies to the product's own evidence first. So this script
// scans a generated fixture holding a PLANTED, fake credential and REFUSES to write the clean report
// unless the scanner sees it. The fixture is generated into a temporary directory and never committed:
// a repository with a rule against secrets in files does not get a file that looks like one.
//
// Determinism, because these are committed: absolute paths are relativised, rules and results are
// sorted, and nothing carries a clock. Both are re-derived and compared by `scripts/reports-fresh.mjs`.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { ESLint } from "eslint";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, "..");
const posix = (p) => p.split("\\").join("/");
const SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";

function write(rel, value) {
  const out = join(ROOT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(value, null, 2) + "\n");
  return rel;
}

// ── the static security scan ─────────────────────────────────────────────────────────────────────
async function eslintSecuritySarif() {
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: join(ROOT, "eslint.security.config.js") });
  const results = await eslint.lintFiles(["src"]);
  // Which rules RAN, as ESLint resolved them — the tool's answer, not ours.
  const resolved = await eslint.calculateConfigForFile(join(ROOT, "src", "lib", "evidence.ts"));
  const active = Object.entries(resolved.rules ?? {})
    .filter(([, cfg]) => (Array.isArray(cfg) ? cfg[0] : cfg) !== "off" && (Array.isArray(cfg) ? cfg[0] : cfg) !== 0)
    .map(([id, cfg]) => {
      const sev = Array.isArray(cfg) ? cfg[0] : cfg;
      const level = sev === "error" || sev === 2 ? "error" : "warning";
      return { id, defaultConfiguration: { level } };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en"));

  const out = [];
  for (const file of results) {
    const uri = posix(relative(ROOT, file.filePath));
    for (const m of file.messages) {
      if (!m.ruleId) continue; // a parse or configuration message is not a finding about the code
      out.push({
        ruleId: m.ruleId,
        level: m.severity === 2 ? "error" : "warning",
        message: { text: m.message },
        locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: m.line ?? 1, startColumn: m.column ?? 1 } } }],
      });
    }
  }
  out.sort((a, b) => {
    const ua = a.locations[0].physicalLocation.artifactLocation.uri, ub = b.locations[0].physicalLocation.artifactLocation.uri;
    return ua.localeCompare(ub, "en") || a.locations[0].physicalLocation.region.startLine - b.locations[0].physicalLocation.region.startLine
      || a.ruleId.localeCompare(b.ruleId, "en") || a.message.text.localeCompare(b.message.text, "en");
  });

  const pkg = require_("eslint-plugin-security/package.json");
  const written = write("reports/eslint-security.sarif", {
    $schema: SCHEMA,
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "eslint-plugin-security", version: pkg.version, informationUri: "https://github.com/eslint-community/eslint-plugin-security", rules: active } },
      results: out,
    }],
  });
  const errors = out.filter((r) => r.level === "error").length;
  console.log(`${written} — ${active.length} rule(s) active, ${out.length} finding(s) (${errors} at error level)`);
  return errors;
}

// ── the secrets scan, with its sensitivity proved in the same run ────────────────────────────────
function secretlint(targets, cwd) {
  const run = spawnSync(process.execPath, [
    join(ROOT, "node_modules", "secretlint", "bin", "secretlint.js"),
    "--format", "@secretlint/secretlint-formatter-sarif",
    "--secretlintrc", join(ROOT, ".secretlintrc.json"),
    ...targets,
  ], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.error) { console.error(run.error.message); process.exit(2); }
  try { return JSON.parse(run.stdout); }
  catch { console.error("secretlint did not emit SARIF:\n" + (run.stdout || run.stderr).slice(0, 2000)); process.exit(2); }
}

/** Three FAKE credentials, each assembled at run time so no committed line holds a matching pattern —
 *  this script is itself inside the scanned perimeter, and a control that trips the scan it controls is
 *  not a control. They are written into a temporary directory and deleted in the same call; none of
 *  them is a real credential and none is ever written into the repository, which has a rule about
 *  exactly that.
 *
 *  Three rather than one, because one firing rule proves one rule. And NOT the credentials AWS prints
 *  in its own documentation: measured 2026-09-12, `AKIAIOSFODNN7EXAMPLE` and its partner secret are
 *  deliberately exempted by the scanner (they appear in every tutorial on earth), so a control built
 *  from them reports zero and would have certified a blind scan as a clean one. The control caught
 *  that on its first run, which is what a control is for. */
const PLANTED = [
  ["@secretlint/secretlint-rule-aws", "planted-aws.txt", "AKIA" + "3QK7ZR2VLXN8TMJD" + "\nAWS_SECRET_ACCESS_KEY=" + "kP7mXq2LbN4vZs9TrW1cYh6JdF8gA3eU5oI0nQxB"],
  ["@secretlint/secretlint-rule-github", "planted-gh.txt", "gh" + "p_" + "AbCdEf0123456789AbCdEf0123456789AbCd"],
  ["@secretlint/secretlint-rule-npm", "planted-npm.txt", "npm" + "_" + "AbCdEf0123456789AbCdEf0123456789AbCd"],
];

function secretlintSarif() {
  // The control first: if the scanner cannot see a planted credential, its silence on the repository
  // means nothing and this script refuses to write a report that would read as clean.
  const probe = mkdtempSync(join(tmpdir(), "runward-secret-control-"));
  try {
    for (const [, name, body] of PLANTED) writeFileSync(join(probe, name), body + "\n");
    const control = secretlint(PLANTED.map(([, name]) => name), probe);
    const fired = new Set();
    for (const run of control.runs ?? []) for (const r of run.results ?? []) if (r.ruleId) fired.add(r.ruleId);
    const blind = PLANTED.filter(([id]) => ![...fired].some((f) => f.includes(id)));
    if (blind.length > 0) {
      console.error(`✗ the secrets scanner did not see ${blind.length} of ${PLANTED.length} planted credentials (${blind.map(([id]) => id).join(", ")}). Its silence on this repository would prove nothing, so no report was written — check .secretlintrc.json and the installed preset.`);
      process.exit(2);
    }
    // The control's outcome becomes an ARTIFACT, not a log line that scrolls past. A sensitivity proof
    // nobody can re-open is a claim, and this repository's whole argument is that a claim is not
    // evidence. The file holds the rule ids the scanner demonstrably fired on — derived from the tool's
    // own output, with the temporary paths dropped because they are the control's location and not its
    // finding — so `reports/secretlint.sarif` being empty reads as clean rather than as blind, and the
    // freshness gate re-derives both together.
    write("reports/secretlint-control.json", {
      what: "Rules the secrets scanner demonstrably fires on. Regenerated beside reports/secretlint.sarif: an empty scan means clean only if the scanner can still see a planted credential.",
      rulesProvenLive: [...fired].sort((a, b) => a.localeCompare(b, "en")),
    });
    console.log(`secretlint control: ${PLANTED.length}/${PLANTED.length} planted credentials seen (${PLANTED.map(([id]) => id.split("-").pop()).join(", ")}) — the scanner is live`);
  } finally { rmSync(probe, { recursive: true, force: true }); }

  const log = secretlint(["src/**/*.ts", "scripts/**/*.mjs", "runward/**/*.md", "docs/**/*.md", "templates/**/*", ".github/**/*.yml", "*.json", "*.md"], ROOT);
  for (const run of log.runs ?? []) {
    for (const r of run.results ?? []) {
      for (const loc of r.locations ?? []) {
        const a = loc.physicalLocation?.artifactLocation;
        if (a?.uri) a.uri = posix(relative(ROOT, a.uri.replace(/^file:\/\//, "")));
      }
    }
    (run.results ?? []).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
    delete run.artifacts; // artifact indices carry absolute URIs and nothing the adapter reads
  }
  log.$schema = SCHEMA;
  const findings = (log.runs ?? []).reduce((n, r) => n + (r.results?.length ?? 0), 0);
  const written = write("reports/secretlint.sarif", log);
  console.log(`${written} — ${findings} secret(s) found in the repository`);
  return findings;
}

const secretFindings = secretlintSarif();
const lintErrors = await eslintSecuritySarif();
// A report is evidence of a clean scan only when the scan was clean. Exit with the tools' verdict.
process.exit(secretFindings > 0 || lintErrors > 0 ? 1 : 0);
