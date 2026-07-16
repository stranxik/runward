/** Total number of craft rules shipped under templates/rules/. */
export const EXPECTED_RULES = 64;

/** Gate adapters shipped under templates/adapters/ (ADR-0012): one per harness seam. Counts the real
 *  adapters only — the port-contract README.md is excluded, so swapping an adapter for a stray file
 *  cannot pass the count. pre-commit, github-actions, gitlab-ci, claude-code-settings, kiro-hooks. */
export const EXPECTED_ADAPTERS = 5;

/** Routed-count floor: minimum CRITICAL/HIGH rules mapped to each build phase (ADR-0002).
 *  Lowering a floor is a deliberate, tracked edit — the `phases:` mapping cannot be silently
 *  stripped to make `check --strict` pass vacuously. */
export const EXPECTED_MAPPED: Record<string, number> = { architect: 6, topology: 4, floor: 10, govern: 12, handover: 4 };
