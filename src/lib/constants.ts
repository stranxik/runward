/** Total number of craft rules shipped under templates/rules/. */
export const EXPECTED_RULES = 64;
/** ADR-0067: the eleven procedures each carry a contract once W2 lands; doctor verifies the
 *  package copies parse, status reads promises kept/absent/malformed instead of counting files. */
export const EXPECTED_WORKFLOW_CONTRACTS = 11;

/** Below this many non-blank characters, an ADR file is not a decision anyone took. One number,
 *  read by BOTH layers: the evidence layer (`adrDecision`) refused a 0-byte ADR from the start,
 *  while the presence layer counted it and printed `✓ Decision journal (≥1 ADR)` four lines above
 *  that refusal — the same defect as RWD-2026-0004, asked of one layer and never of the other. */
export const ADR_MIN_CHARS = 40;

/** Gate adapters shipped under templates/adapters/ (ADR-0012): one per harness seam. Counts the real
 *  adapters only — the port-contract README.md is excluded, so swapping an adapter for a stray file
 *  cannot pass the count. pre-commit, github-actions, gitlab-ci, claude-code-settings, kiro-hooks,
 *  bmad-review-layer. */
export const EXPECTED_ADAPTERS = 6;

/** Routed-count floor: minimum CRITICAL/HIGH rules mapped to each build phase (ADR-0002).
 *  Lowering a floor is a deliberate, tracked edit — the `phases:` mapping cannot be silently
 *  stripped to make `check --strict` pass vacuously. */
export const EXPECTED_MAPPED: Record<string, number> = { architect: 6, topology: 4, floor: 10, govern: 12, handover: 4 };
