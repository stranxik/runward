import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { readRuleSet, ruleSetDir, parseRule, ruleBody } from "../lib/rules.js";
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

export async function rulesCommand(opts: { path?: string; json?: boolean; phase?: string }): Promise<void> {
  const { dir, source } = effectiveDir(opts.path);
  let rules = readRuleSet(dir);
  if (opts.phase) rules = rules.filter((r) => r.phases.includes(opts.phase!));

  if (opts.json) {
    // Versioned, additive contract (ADR-0024) — fields are added, never renamed or repurposed.
    console.log(JSON.stringify({ runward: VERSION, source, count: rules.length, rules }, null, 2));
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — rules`, `${rules.length} rule(s) · source: ${source}${opts.phase ? ` · phase: ${opts.phase}` : ""}`));
  const phases = ["architect", "topology", "floor", "govern"];
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
    console.log(JSON.stringify({ runward: VERSION, source, rule: { ...rule, body: ruleBody(content) } }, null, 2));
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — explain`, rule.title));
  console.log(section("Contract"));
  console.log(`  ${c.primaryBold("Slug")}       ${c.white(rule.slug)}`);
  console.log(`  ${c.primaryBold("Impact")}     ${c.white(rule.impact)}${rule.phases.length ? c.darkGray(`  · phases: ${rule.phases.join(", ")}`) : c.darkGray("  · advisory (no gated phase)")}`);
  if (rule.asi.length) console.log(`  ${c.primaryBold("OWASP ASI")}  ${c.white(rule.asi.join(", "))}`);
  if (rule.signature) console.log(`  ${c.primaryBold("Signature")}  ${c.white(`/${rule.signature}/i`)} ${c.darkGray("— applied evidence must point at content matching this (ADR-0020)")}`);
  if (rule.why) console.log(`  ${c.primaryBold("Why")}        ${c.white(rule.why)}`);
  console.log(section("Rule"));
  console.log(ruleBody(content));
}
