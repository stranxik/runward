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
    reason: "the name is reserved for the founding inversion",
    since: "v0.7.0",
  },
};
