import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { GATED_DELIVERABLES } from "./conformance.js";
import { readWorkflowContracts } from "./workflow-contract.js";

/**
 * The verify workflow's findings artifact (ADR-0007, amended): presence and freshness
 * only — the gate never reads a verdict out of it and never blocks on it. Fresh means
 * newer than every gated manifest; a manifest edited after the pass makes it stale.
 *
 * The constant is the FALLBACK, not the truth (ADR-0067, W3): the verify contract's
 * `produces` names the artifact, and `verifyFindingsPath` reads it there — mission copy
 * over package copy, like every contract. Two sources of the same path had already
 * diverged once in this product (RWD-2026-0103: advice naming a file no mission held).
 */
export const VERIFY_FINDINGS = "governance/verify-findings.md";

/** The findings path the verify CONTRACT declares, mission-relative (its produces are
 *  `runward/…`-prefixed). Falls back to the constant when no contract or no produces —
 *  absence stays a state, never a crash. */
export function verifyFindingsPath(missionDir: string): string {
  const verify = readWorkflowContracts(missionDir).find((w) => w.contract?.workflow === "verify");
  const declared = verify?.contract?.produces[0]?.path;
  return declared?.startsWith("runward/") ? declared.slice("runward/".length) : VERIFY_FINDINGS;
}

export function verifyFindings(missionDir: string): { present: boolean; date?: string; fresh?: boolean } {
  const path = join(missionDir, verifyFindingsPath(missionDir));
  if (!existsSync(path)) return { present: false };
  const mtime = statSync(path).mtimeMs;
  let fresh = true;
  for (const { deliverable } of GATED_DELIVERABLES) {
    const d = join(missionDir, deliverable);
    if (existsSync(d) && statSync(d).mtimeMs > mtime) { fresh = false; break; }
  }
  return { present: true, date: new Date(statSync(path).mtime).toISOString().slice(0, 10), fresh };
}
