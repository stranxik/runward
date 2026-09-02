// `runward propose` — the deterministic proposer (ADR-0066, P2). Proposals are not decisions.
//
// The measured entry cost of a mission is not deciding, it is CONVEYING: hunting the evidence a
// row should point at. This command carries what can be carried without judging anything: for an
// EMPTY row whose rule declares a `signature:` (the shape the gate already knows how to confront),
// it searches the rule's declared territory for a file whose content matches, and writes
// `proposed:applied` with the found pointer — a status the gate REFUSES until a human ratifies.
//
// The boundary, and why it holds by construction rather than by promise:
//   - No model call, no network, bytes at rest only — the `characterize --mine` posture (ADR-0014).
//   - Signature × territory ONLY. A rule with a territory but no signature gets its governed files
//     LISTED, never a status: proposing on resemblance would fabricate the judge (ADR-0001).
//   - Idempotent: a decided or already-proposed row is never touched — the ADR-0038
//     non-resurrection precedent, one grammar over.
//   - The proposer is DECLARED text, like `sealedAt` and an ADR's Deciders: runward holds no key
//     (ADR-0021), and pretending to authenticate would be a stronger claim than the tool owns.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { GATED_DELIVERABLES, parseManifest } from "../lib/conformance.js";
import { readRuleSet, ruleSetDir, globToRegExp, type RuleInfo } from "../lib/rules.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/** Directories the walk never enters: not project sources, or the mission judging itself. */
const WALK_SKIP = new Set(["node_modules", ".git", "runward", "dist", ".DS_Store"]);

/** Every project file, root-relative POSIX, sorted — deterministic on every OS (the RWD-2026-0101
 *  lesson: a directory reader follows the filesystem's own order unless told otherwise). */
function projectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of [...readdirSync(dir, { withFileTypes: true })].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (WALK_SKIP.has(e.name)) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else if (e.isFile()) out.push(rel);
    }
  };
  walk(root, "");
  return out;
}

/** The first territory file whose content matches the rule's signature, or null. First in sorted
 *  order — same tree, same proposal; there is no better-match heuristic to argue with. */
function signatureMatch(root: string, files: string[], rule: RuleInfo): string | null {
  if (!rule.signature || rule.appliesTo.length === 0) return null;
  const globs = rule.appliesTo.map(globToRegExp);
  let re: RegExp;
  try { re = new RegExp(rule.signature); } catch { return null; }
  for (const f of files) {
    if (!globs.some((g) => g.test(f))) continue;
    try { if (re.test(readFileSync(join(root, f), "utf8"))) return f; } catch { /* unreadable: not evidence */ }
  }
  return null;
}

export async function proposeCommand(opts: { path?: string }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }
  const mission = join(root, "runward");
  const dryRun = process.env.RUNWARD_DRY_RUN === "1";
  console.log(createHeader(`Runward v${VERSION} — propose (proposals are not decisions)`, root));

  const rules = new Map(readRuleSet(ruleSetDir(mission).dir).map((r) => [r.slug, r]));
  const files = projectFiles(root);
  let proposed = 0, leftEmpty = 0;

  for (const g of GATED_DELIVERABLES) {
    const path = join(mission, g.deliverable);
    if (!existsSync(path)) continue;
    let content = readFileSync(path, "utf8");
    const lines: string[] = [];
    for (const row of parseManifest(content)) {
      if (row.status !== "") continue; // decided or proposed: never touched (ADR-0038 precedent)
      const rule = rules.get(row.rule);
      if (!rule) continue;
      const hit = rule.signature ? signatureMatch(root, files, rule) : null;
      if (hit) {
        // The scaffolded shape is exactly `| slug |  |  |` (manifest-sync writes it); replacing the
        // whole line keeps every other byte of the deliverable untouched.
        const before = content;
        content = content.replace(
          `| ${row.rule} |  |  |`,
          `| ${row.rule} | proposed:applied | file:${hit} ; proposer: runward propose v${VERSION} (signature matched) |`,
        );
        if (content !== before) {
          proposed++;
          lines.push(`  ${c.warning("◑")} ${c.white(row.rule)} — proposed:applied · ${c.primary(`file:${hit}`)} ${c.darkGray(`(signature /${rule.signature}/ matched)`)}`);
          continue;
        }
      }
      leftEmpty++;
      // Say exactly which half is missing — a rule signed without a territory is a different fact
      // from an unsigned one, and the first cut of this message conflated them.
      if (rule.appliesTo.length > 0) {
        const governed = files.filter((f) => rule.appliesTo.map(globToRegExp).some((g2) => g2.test(f)));
        lines.push(`  ${c.darkGray("·")} ${c.white(row.rule)} ${c.darkGray(`— territory matches ${governed.length} file(s)${rule.signature ? `, signature /${rule.signature}/ not found in any` : "; no signature, nothing proposed"} (decide it, or let your agent propose it)`)}`);
      } else if (rule.signature) {
        lines.push(`  ${c.darkGray("·")} ${c.white(row.rule)} ${c.darkGray("— signed, but the rule declares no territory to search (noTerritory); left empty (decide it, or let your agent propose it)")}`);
      } else {
        lines.push(`  ${c.darkGray("·")} ${c.white(row.rule)} ${c.darkGray("— no signature; left empty (decide it, or let your agent propose it)")}`);
      }
    }
    if (lines.length) {
      console.log(section(`${g.label} (runward/${g.deliverable})`));
      for (const l of lines) console.log(l);
      if (!dryRun) writeFileSync(path, content);
    }
  }

  console.log(section("Summary"));
  console.log(`  ${c.white(String(proposed))} row(s) proposed ${c.darkGray("(signature-corroborated, deterministic — no model call)")} · ${c.white(String(leftEmpty))} row(s) left empty`);
  console.log("  " + c.darkGray("A proposed row is not a decision: `runward check --strict` refuses every one of them."));
  console.log(section("Next"));
  console.log(`  ${c.primary("runward ratify")} ${c.darkGray("— view each proposal's evidence and make the decision yours.")}`);
  console.log();
}
