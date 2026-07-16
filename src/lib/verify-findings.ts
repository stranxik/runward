import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { GATED_DELIVERABLES } from "./conformance.js";

/**
 * The verify workflow's findings artifact (ADR-0007, amended): presence and freshness
 * only — the gate never reads a verdict out of it and never blocks on it. Fresh means
 * newer than every gated manifest; a manifest edited after the pass makes it stale.
 */
export const VERIFY_FINDINGS = "governance/verify-findings.md";

export function verifyFindings(missionDir: string): { present: boolean; date?: string; fresh?: boolean } {
  const path = join(missionDir, VERIFY_FINDINGS);
  if (!existsSync(path)) return { present: false };
  const mtime = statSync(path).mtimeMs;
  let fresh = true;
  for (const { deliverable } of GATED_DELIVERABLES) {
    const d = join(missionDir, deliverable);
    if (existsSync(d) && statSync(d).mtimeMs > mtime) { fresh = false; break; }
  }
  return { present: true, date: new Date(statSync(path).mtime).toISOString().slice(0, 10), fresh };
}
