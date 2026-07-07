/** Total number of craft rules shipped under templates/rules/. */
export const EXPECTED_RULES = 51;

/** Routed-count floor: minimum CRITICAL/HIGH rules mapped to each build phase (ADR-0002).
 *  Lowering a floor is a deliberate, tracked edit — the `phases:` mapping cannot be silently
 *  stripped to make `check --strict` pass vacuously. */
export const EXPECTED_MAPPED: Record<string, number> = { architect: 5, floor: 10, govern: 7 };
