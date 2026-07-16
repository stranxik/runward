import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifest, expectedRules, allRules } from "./conformance.js";
import { RULE_MIGRATIONS } from "./rule-migrations.js";

/**
 * Manifest sync (ADR-0023): deterministic scaffolding of the rule-conformance table's FORM.
 * It appends missing expected rows with an EMPTY status (the gate refuses them until the
 * operator decides), rewrites renamed slugs per the migration record, and reports what only
 * the operator may edit. It never sets a status, never writes evidence, never deletes a row.
 */

export interface SyncReport {
  deliverable: string;
  label: string;
  /** The deliverable file itself is absent — init scaffolds deliverables, sync does not. */
  fileMissing: boolean;
  sectionCreated: boolean;
  added: string[];
  migrated: Array<{ from: string; to: string }>;
  removed: Array<{ slug: string; since: string; reason: string }>;
  unknown: string[];
  duplicates: string[];
  /** New file content when --sync has something to write; null when nothing changes. */
  content: string | null;
}

const SECTION_HEADER = /^##\s+Rule conformance/i;

const SECTION_TEMPLATE = (phase: string) => `
## Rule conformance

> Account for every CRITICAL/HIGH craft rule mapped to the ${phase} phase (\`runward/rules/\`, frontmatter \`phases: [${phase}]\`). \`applied\` needs a pointer; \`deviated\` needs an ADR; \`n/a\` needs a reason. \`runward check --strict\` verifies this table.

| Rule | Status | Evidence |
|---|---|---|
`;

/** The slug a manifest table line carries, or null when the line is not a rule row. */
function rowSlug(line: string): string | null {
  if (!line.trim().startsWith("|")) return null;
  const cols = line.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim());
  if (cols.length < 1) return null;
  const rule = cols[0];
  if (/^rule$/i.test(rule) || /^:?-+:?$/.test(rule) || /^\[.*\]$/.test(rule)) return null;
  return rule;
}

export function syncManifest(missionDir: string, phase: string, deliverable: string, label: string): SyncReport {
  const report: SyncReport = {
    deliverable, label, fileMissing: false, sectionCreated: false,
    added: [], migrated: [], removed: [], unknown: [], duplicates: [], content: null,
  };
  const path = join(missionDir, deliverable);
  if (!existsSync(path)) { report.fileMissing = true; return report; }
  let content = readFileSync(path, "utf8");
  const expected = expectedRules(missionDir, phase);
  const known = new Set(allRules(missionDir));

  // 1. Migrations (ADR-0006): rewrite a renamed slug in place, status and evidence untouched.
  //    Skipped when the new slug already has its own row — that duplicate is the operator's edit.
  const present = () => new Set(parseManifest(content).map((r) => r.rule));
  for (const [from, m] of Object.entries(RULE_MIGRATIONS)) {
    const rows = present();
    if (!rows.has(from)) continue;
    if (!m.to) { report.removed.push({ slug: from, since: m.since, reason: m.reason }); continue; }
    if (rows.has(m.to)) { report.duplicates.push(`${from} → ${m.to} (a ${m.to} row already exists — merge by hand)`); continue; }
    content = content.split("\n").map((line) => {
      const slug = rowSlug(line);
      if (slug !== from) return line;
      const cols = line.split("|");
      cols[1] = ` ${m.to} `;
      return cols.join("|");
    }).join("\n");
    report.migrated.push({ from, to: m.to });
  }

  // 2. Section + missing rows, inside the manifest section only.
  const lines = content.split("\n");
  let start = lines.findIndex((l) => SECTION_HEADER.test(l));
  if (start === -1 && expected.length > 0) {
    if (!content.endsWith("\n")) content += "\n";
    content += SECTION_TEMPLATE(phase);
    report.sectionCreated = true;
  }
  const rows = parseManifest(content).filter((r) => !/^\[.*\]$/.test(r.rule)); // template placeholders are form, not rows
  const have = new Set(rows.map((r) => r.rule));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.rule, (counts.get(r.rule) ?? 0) + 1);
  for (const [slug, n] of counts) {
    if (n > 1) report.duplicates.push(`${slug} (listed ${n} times — keep a single row)`);
    if (!known.has(slug) && !RULE_MIGRATIONS[slug]) report.unknown.push(slug);
  }
  const missing = expected.filter((r) => !have.has(r));
  if (missing.length > 0) {
    const out = content.split("\n");
    start = out.findIndex((l) => SECTION_HEADER.test(l));
    // last table line of the section — append right below it, never reorder anything
    let insertAt = -1;
    for (let i = start + 1; i < out.length; i++) {
      if (/^##\s/.test(out[i])) break;
      if (out[i].trim().startsWith("|")) insertAt = i;
    }
    if (insertAt !== -1) {
      out.splice(insertAt + 1, 0, ...missing.map((slug) => `| ${slug} |  |  |`));
      report.added = missing;
      // scaffolding real rows retires the template's placeholder row — form cleanup, no content touched
      content = out.filter((l) => {
        if (!l.trim().startsWith("|")) return true;
        const first = l.split("|").slice(1, -1)[0]?.replace(/`/g, "").trim() ?? "";
        return !/^\[.*\]$/.test(first);
      }).join("\n");
    }
  }

  const original = readFileSync(path, "utf8");
  report.content = content !== original ? content : null;
  return report;
}
