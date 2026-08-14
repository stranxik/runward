import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Rule-set deltas (ADR-0006): renames and removals of craft rules across versions.
 * A manifest that still cites an old slug is guided to its migration, not left to guess.
 * Grows by addition on every rename/removal — never a silent rewrite.
 */
export interface RuleMigration {
  /** The new slug for a rename; omitted for a removal. */
  to?: string;
  /** Why the change was made (a mini-ADR integrated into the record). */
  reason: string;
  /** The version the change shipped in. */
  since: string;
}

export const RULE_MIGRATIONS: Record<string, RuleMigration> = {
  "hexa-llm-boundary-principle": {
    to: "hexa-move-deterministic-out",
    reason: "renamed to name the pattern directly (move the deterministic out of the model)",
    since: "v0.7.0",
  },
};

/**
 * A shared org corpus (ADR-0057) renames its OWN rules on its OWN version line, so its migration
 * records travel WITH the corpus: a committed `migrations.json` beside the vendored rules, of the
 * exact shape above. Read-only, in-tree, no fetch — pure `readFileSync` of a file the operator
 * vendored. Absent or malformed → `{}` (a bad org file must never corrupt runward's own guidance).
 */
export function loadOrgMigrations(rulesDir: string): Record<string, RuleMigration> {
  const path = join(rulesDir, "migrations.json");
  if (!existsSync(path)) return {};
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, RuleMigration> = {};
  for (const [slug, v] of Object.entries(raw as Record<string, unknown>)) {
    const m = v as { to?: unknown; reason?: unknown; since?: unknown };
    // Only well-formed records: a `reason` and a `since`, with `to` a string when present.
    if (m && typeof m.reason === "string" && typeof m.since === "string" && (m.to === undefined || typeof m.to === "string")) {
      out[slug] = { reason: m.reason, since: m.since, ...(typeof m.to === "string" ? { to: m.to } : {}) };
    }
  }
  return out;
}

/**
 * The effective migration records at a corpus: runward's built-in rule renames PLUS the org corpus's
 * own (ADR-0057). A slug collision resolves to the org's record — it is about the mission's own
 * corpus. `rulesDir` is the effective corpus dir (the mission's vendored `runward/rules/`, else the
 * package's, where no org migrations exist).
 */
export function ruleMigrations(rulesDir: string): Record<string, RuleMigration> {
  return { ...RULE_MIGRATIONS, ...loadOrgMigrations(rulesDir) };
}
