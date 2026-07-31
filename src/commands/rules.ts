import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { GATED_DELIVERABLES } from "../lib/conformance.js";
import {
  readRuleSet, ruleSetDir, parseRule, ruleBody, GATE_NON_SCOPE,
  matchRulesForPaths, normalizeForPath, FOR_NON_EXHAUSTIVE, GLOB_DIALECT, territoryVocabulary,
} from "../lib/rules.js";
import { deriveAll } from "../lib/territory.js";
import { readTerritoryMap, applyTerritoryMap, structurallyInertRows } from "../lib/territory-map.js";
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

/** Fixed-width rows for the pattern list — deterministic, no terminal-width guessing. */
function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

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
    // Derivation reads what the project already declared in its deployment manifests — never its
    // code. No mission, or no manifest, derives nothing and says so (ADR-0043).
    const missionRoot = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
    const derivation = deriveAll(missionRoot);
    // The mission completes derivation where a manifest cannot reach — a manifest declares an
    // execution topology, never the nature of the code behind it (ADR-0043 tier 3).
    const map = missionRoot ? readTerritoryMap(join(missionRoot, "runward")) : null;
    const applied = map ? applyTerritoryMap(derivation.bindings, map, paths) : { bindings: derivation.bindings, usedRows: new Set<number>() };
    const report = matchRulesForPaths(rules, paths, applied.bindings);
    const vocab = territoryVocabulary(rules);
    const inert = map ? structurallyInertRows(map, new Set(vocab.categories), new Set(derivation.bindings.map((b) => b.category))) : [];

    if (opts.json) {
      console.log(JSON.stringify({
        runward: VERSION, source, count: report.matched.length, gateNonScope: GATE_NON_SCOPE,
        selector: { for: paths, globDialect: GLOB_DIALECT },
        // What was looked for, as declared — so an empty answer is readable as a fact rather
        // than as a silence. Additive (ADR-0024); no existing field changes meaning.
        territories: { declaring: vocab.declaring, patterns: vocab.patterns, categories: vocab.categories },
        // ADR-0043, additive: what bound files to categories here, and what each adapter could
        // not do. `unscoped.count` keeps its v0.24.0 meaning (no territory in ANY carrier);
        // `territoryStates` is the full partition beside it, never a redefinition.
        derivation: {
          bindings: derivation.bindings.length,
          categoriesResolved: [...new Set(applied.bindings.map((b) => b.category))].sort(),
          notes: derivation.notes,
        },
        map: map ? {
          present: map.present, path: map.path, rows: map.rows.length,
          structural: map.structural, problems: map.problems,
          inert: inert.map((r) => ({ line: r.line, pattern: r.pattern, category: r.category, reason: r.reason })),
          precedence: "last-matching-row-wins-per-path-and-category; derivation < map < a rule's own appliesTo, which the map never narrows",
        } : null,
        territoryStates: {
          matched: report.matched.length, evaluated: report.evaluated, unresolved: report.unresolved,
          declaredNoTerritory: report.declaredNoTerritory, unreviewed: report.unreviewed, total: report.total,
        },
        // `count` keeps its v0.24.0 meaning (rules --for could not evaluate); the breakdown is
        // additive (ADR-0024) and splits a decision from an omission.
        unscoped: {
          count: report.unscoped, declaredNoTerritory: report.declaredNoTerritory,
          unreviewed: report.unreviewed, total: report.total, note: FOR_NON_EXHAUSTIVE,
        },
        rules: report.matched.map((m) => ({ ...m.rule, matchedBy: m.matchedBy })),
      }, null, 2));
      return;
    }

    console.log(createHeader(`Runward v${VERSION} — rules --for`, `${report.matched.length} rule(s) matched · ${paths.length} path(s) · source: ${source}`));
    // A map runward could not read changes how EVERYTHING below must be read, so it comes first.
    // Reported at the foot of a long answer, it was findable but not seen: the reader scans the
    // matches, gets a plausible list, and never learns their declarations were ignored. That is
    // the weak verifier this whole mechanism exists to avoid, reintroduced by output order.
    if (map?.structural) {
      console.log(section("This map was not read"));
      console.log(`  ${c.warning("✗")} ${c.white(map.path)}: ${map.structural}`);
      console.log(`  ${c.darkGray("Everything below is derivation only — your declarations had no effect.")}`);
    }
    if (report.matched.length) {
      console.log(section("Matched"));
      // The `git check-ignore -v` model: which pattern, from which field, retained which path.
      for (const { rule, matchedBy } of report.matched) {
        for (const m of matchedBy) {
          // Two levels for a category match: the rule governs X, and this file is X because of
          // that declaration, in that file, at that line — the `<source>` half of check-ignore -v.
          const reason = m.kind === "appliesTo"
            ? `appliesTo=${m.pattern}`
            : `governs=${m.category} ← ${m.via.file}${m.via.line ? `:${m.via.line}` : ""} ${m.via.source === "derived" ? m.via.declaration : m.via.pattern}`;
          console.log(`  ${c.white(rule.slug.padEnd(42))} ${c.darkGray(rule.impact.padEnd(9))}${c.primary(reason)}  ${c.darkGray(m.path)}`);
        }
      }
    } else {
      console.log(section("Matched"));
      console.log("  " + status.skip("no rule declares a territory covering these paths."));
      // The declared territories, rendered. An empty answer must be readable: without this, a repo
      // whose layout uses none of these conventions cannot tell "nothing governs my file" from
      // "the rule set was never taught what my files are". runward states what it looked for; it
      // never states anything about the layout it has not read.
      console.log(section("What was looked for"));
      console.log(`  ${c.white(String(vocab.declaring))} ${c.darkGray(`of ${report.total} rule(s) declare a territory. The patterns, verbatim:`)}`);
      const SHOWN = 18;
      for (const line of chunk(vocab.patterns.slice(0, SHOWN), 3)) console.log("    " + c.primary(line.join("  ")));
      if (vocab.patterns.length > SHOWN) console.log(`    ${c.darkGray(`+${vocab.patterns.length - SHOWN} more — see \`runward rules --json --for …\` for the full set.`)}`);
      console.log(`  ${c.darkGray("A path matches only a pattern it is literally under. If none of these describe your layout,")}`);
      console.log(`  ${c.darkGray("that is a fact about the rule set, not a verdict on your tree: the rules were written against")}`);
      console.log(`  ${c.darkGray("conventions they name, and yours are not among them.")}`);
    }
    // ADR-0043: a declared category that nothing binds here is a MISSING BINDING — not a scope,
    // not a backlog. Reporting it is the "rules that govern nothing" half of the bidirectional
    // report; leaving it silent would be the weak verifier ADR-0040 refuses.
    if (report.unresolved > 0) {
      console.log(section("Could not be asked"));
      console.log(`  ${c.white(String(report.unresolved))} ${c.darkGray("rule(s) govern a category that nothing in this mission binds to a file.")}`);
      for (const n of derivation.notes) console.log(`    ${c.darkGray(`${n.adapter} · ${n.file ?? "—"} · ${n.outcome}: ${n.detail}`)}`);
      if (!missionRoot) console.log(`    ${c.darkGray("no runward/ mission here, so no derivation source was consulted at all.")}`);
      // A category a manifest cannot know is exactly what the mission map is for — say so where
      // the gap is felt, rather than leaving the operator to find the mechanism.
      if (map && !map.present) console.log(`    ${c.darkGray(`no ${map.path} — a manifest declares an execution topology, never the nature of the code; declare the rest there.`)}`);
    }
    // Map problems are named per line, never dropped: a row runward refused to use is a row the
    // operator believes is working.
    if (map) {
      for (const p of map.problems) console.log(`  ${c.warning("!")} ${c.darkGray(`${map.path}:${p.line} — ${p.problem}`)}`);
      for (const r of inert) console.log(`  ${c.warning("!")} ${c.darkGray(`${map.path}:${r.line} inert — ${r.reason}`)}`);
    }
    console.log(section("Not evaluated"));
    // A decision and an omission must never read the same. Declaring "this rule has no file
    // territory" is a considered scope; saying nothing is a gap — only the second is a backlog.
    console.log(`  ${c.white(String(report.declaredNoTerritory).padStart(3))} ${c.darkGray("rule(s) DECLARE they have no file territory (reason in `runward explain <rule>`) — decided.")}`);
    console.log(`  ${c.white(String(report.unreviewed).padStart(3))} ${c.darkGray("rule(s) have not been ruled on yet — the editorial backlog, not a scope.")}`);
    console.log(`  ${c.darkGray(`(${report.unscoped} of ${report.total} carry no territory in total.)`)}`);
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
  // ADR-0041: territory is declared in both directions — the globs, or the reason there are none.
  // Four carriers now, and the fall-through must never call a decided rule undecided: before
  // ADR-0043 a `governs:`-only rule would have landed in the last branch and been announced as
  // "not ruled on yet" — the best-decided rule in the corpus, described as an omission.
  if (rule.appliesTo.length || rule.governs.length) {
    const parts: string[] = [];
    if (rule.appliesTo.length) parts.push(`paths ${rule.appliesTo.join(", ")}`);
    if (rule.governs.length) parts.push(`category ${rule.governs.join(", ")}`);
    console.log(`  ${c.primaryBold("Territory")}  ${c.white(parts.join(" · "))}`);
    if (rule.governs.length) console.log(`  ${c.primaryBold("")}             ${c.darkGray("a category is bound to files by derivation or by the mission, never by this rule")}`);
  } else if (rule.noTerritory) {
    console.log(`  ${c.primaryBold("Territory")}  ${c.darkGray("none, declared: ")}${c.white(rule.noTerritory)}`);
  } else {
    console.log(`  ${c.primaryBold("Territory")}  ${c.darkGray("not ruled on yet — this rule is never matched by `--for` (an omission, not a scope)")}`);
  }
  console.log(`  ${c.primaryBold("Gate-wide")}  ${c.darkGray(GATE_NON_SCOPE)}`);
  console.log(section("Rule"));
  console.log(ruleBody(content));
}
