import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { GATED_DELIVERABLES } from "../lib/conformance.js";
import {
  readRuleSet, ruleSetDir, parseRule, ruleBody, GATE_NON_SCOPE,
  matchRulesForPaths, normalizeForPath, FOR_NON_EXHAUSTIVE, GLOB_DIALECT,
} from "../lib/rules.js";
import { RULE_MIGRATIONS } from "../lib/rule-migrations.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * The machine surface of the rule set (ADR-0024). `rules` lists the effective set
 * (mission copy when present, else the package); `--json` is a versioned, additive
 * contract: { runward, source, count, rules } sorted by slug. `explain <rule>` prints
 * the rule's contract surface and its full body — the why, inline. Read-only, zero-LLM.
 * Exit codes: 0 = ok, 2 = unknown rule slug.
 */

function effectiveDir(path?: string): { dir: string; source: "mission" | "package" } {
  const root = findMissionRoot(resolve(process.cwd(), path ?? "."));
  return ruleSetDir(root ? join(root, "runward") : null);
}

export async function rulesCommand(opts: { path?: string; json?: boolean; phase?: string; for?: string[] }): Promise<void> {
  const { dir, source } = effectiveDir(opts.path);
  let rules = readRuleSet(dir);
  // A misspelled phase used to return an empty set and exit 0 — indistinguishable, in a CI step,
  // from "nothing to do here". An unknown phase is operator misuse (exit 2), like an unknown rule
  // slug in `explain`. Validated against the single source (GATED_DELIVERABLES), never a fixed list.
  if (opts.phase) {
    const gated = GATED_DELIVERABLES.map((d) => d.phase);
    if (!gated.includes(opts.phase)) {
      console.error(status.error(`Unknown phase "${opts.phase}" — the gated phases are: ${gated.join(", ")}.`));
      process.exit(2);
    }
    rules = rules.filter((r) => r.phases.includes(opts.phase!));
  }

  // ADR-0041: --for answers "which rules govern these files", matching only on the territory a
  // rule declares (`appliesTo:`). It renders the pattern that retained each path, always exits 0
  // (an empty match is never red), and reports the unscoped rules it could not evaluate.
  if (opts.for) {
    const raw = opts.for.flatMap((a) => a.split(",")).map((s) => s.trim()).filter(Boolean);
    const paths: string[] = [];
    for (const r of raw) {
      const p = normalizeForPath(r);
      if (!p) {
        // Exit 2 is "the question could not be asked" — never a verdict on the rules.
        console.error(status.error(`Cannot ask about "${r}" — paths must be project-relative (no absolute path, no \`..\`).`));
        process.exit(2);
      }
      if (!paths.includes(p)) paths.push(p);
    }
    const report = matchRulesForPaths(rules, paths);

    if (opts.json) {
      console.log(JSON.stringify({
        runward: VERSION, source, count: report.matched.length, gateNonScope: GATE_NON_SCOPE,
        selector: { for: paths, globDialect: GLOB_DIALECT },
        unscoped: { count: report.unscoped, total: report.total, note: FOR_NON_EXHAUSTIVE },
        rules: report.matched.map((m) => ({ ...m.rule, matchedBy: m.matchedBy })),
      }, null, 2));
      return;
    }

    console.log(createHeader(`Runward v${VERSION} — rules --for`, `${report.matched.length} rule(s) matched · ${paths.length} path(s) · source: ${source}`));
    if (report.matched.length) {
      console.log(section("Matched"));
      // The `git check-ignore -v` model: which pattern, from which field, retained which path.
      for (const { rule, matchedBy } of report.matched) {
        for (const m of matchedBy) {
          console.log(`  ${c.white(rule.slug.padEnd(42))} ${c.darkGray(rule.impact.padEnd(9))}${c.primary(`${m.kind}=${m.pattern}`)}  ${c.darkGray(m.path)}`);
        }
      }
    } else {
      console.log(section("Matched"));
      console.log("  " + status.skip("no rule declares a territory covering these paths."));
    }
    console.log(section("Not evaluated"));
    console.log(`  ${c.white(`${report.unscoped} of ${report.total}`)} ${c.darkGray("rule(s) declare no territory (no `appliesTo:`), so they were not matched.")}`);
    console.log(`  ${c.darkGray(FOR_NON_EXHAUSTIVE)}`);
    console.log(section("Next"));
    console.log(`  ${c.primary("runward explain <rule>")} ${c.darkGray("reads the rule in full — confront it, do not work from its name.")}`);
    console.log();
    return;
  }

  if (opts.json) {
    // Versioned, additive contract (ADR-0024) — fields are added, never renamed or repurposed.
    console.log(JSON.stringify({ runward: VERSION, source, count: rules.length, gateNonScope: GATE_NON_SCOPE, rules }, null, 2));
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — rules`, `${rules.length} rule(s) · source: ${source}${opts.phase ? ` · phase: ${opts.phase}` : ""}`));
  // The gated phases, from the single source (GATED_DELIVERABLES) — so a new gated phase (e.g.
  // handover, ADR-0026) is never mislabelled "Unmapped/advisory" here by a stale hardcoded list.
  const phases = GATED_DELIVERABLES.map((d) => d.phase);
  for (const ph of opts.phase ? [opts.phase] : [...phases, ""]) {
    const subset = ph === "" ? rules.filter((r) => r.phases.length === 0 || r.phases.every((p) => !phases.includes(p))) : rules.filter((r) => r.phases.includes(ph));
    if (subset.length === 0) continue;
    console.log(section(ph === "" ? "Unmapped (advisory)" : `Phase · ${ph}`));
    for (const r of subset) {
      const sig = r.signature ? c.primary(" ·signed") : "";
      console.log(`  ${c.white(r.slug.padEnd(42))} ${c.darkGray(r.impact.padEnd(9))}${c.darkGray(r.asi.join(","))}${sig}`);
    }
  }
  console.log(section("Next"));
  console.log(`  ${c.primary("runward explain <rule>")} ${c.darkGray("prints a rule's why and full text ·")} ${c.primary("runward rules --json")} ${c.darkGray("is the machine contract.")}`);
  console.log();
}

export async function explainCommand(slug: string, opts: { path?: string; json?: boolean }): Promise<void> {
  const { dir, source } = effectiveDir(opts.path);
  const file = join(dir, `${slug}.md`);
  if (!existsSync(file)) {
    const m = RULE_MIGRATIONS[slug];
    if (m?.to) console.error(status.error(`Unknown rule "${slug}" — renamed to '${m.to}' in ${m.since} (${m.reason}). Try: runward explain ${m.to}`));
    else if (m) console.error(status.error(`Unknown rule "${slug}" — removed in ${m.since} (${m.reason}).`));
    else console.error(status.error(`Unknown rule "${slug}" — not in ${source === "mission" ? "runward/rules/" : "the package rule set"}. \`runward rules\` lists the slugs.`));
    process.exit(2);
  }
  const content = readFileSync(file, "utf8");
  const rule = parseRule(slug, content);

  if (opts.json) {
    console.log(JSON.stringify({ runward: VERSION, source, gateNonScope: GATE_NON_SCOPE, rule: { ...rule, body: ruleBody(content) } }, null, 2));
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — explain`, rule.title));
  console.log(section("Contract"));
  console.log(`  ${c.primaryBold("Slug")}       ${c.white(rule.slug)}`);
  console.log(`  ${c.primaryBold("Impact")}     ${c.white(rule.impact)}${rule.phases.length ? c.darkGray(`  · phases: ${rule.phases.join(", ")}`) : c.darkGray("  · advisory (no gated phase)")}`);
  if (rule.asi.length) console.log(`  ${c.primaryBold("OWASP ASI")}  ${c.white(rule.asi.join(", "))}`);
  if (rule.signature) console.log(`  ${c.primaryBold("Signature")}  ${c.white(`/${rule.signature}/i`)} ${c.darkGray("— applied evidence must point at content matching this (ADR-0020)")}`);
  if (rule.why) console.log(`  ${c.primaryBold("Why")}        ${c.white(rule.why)}`);
  // ADR-0040: every gate names what it cannot verify — the rule's own blind zone if declared,
  // and always the gate-wide default (a specific nonScope narrows it, never replaces it).
  if (rule.nonScope) console.log(`  ${c.primaryBold("Non-scope")}  ${c.white(rule.nonScope)}`);
  console.log(`  ${c.primaryBold("Gate-wide")}  ${c.darkGray(GATE_NON_SCOPE)}`);
  console.log(section("Rule"));
  console.log(ruleBody(content));
}
