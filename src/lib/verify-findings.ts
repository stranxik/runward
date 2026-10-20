import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GATED_DELIVERABLES } from "./conformance.js";
import { readWorkflowContracts } from "./workflow-contract.js";

/**
 * The verify workflow's findings artifact (ADR-0007, amended): presence and freshness
 * only — the gate never reads a verdict out of it and never blocks on it. Fresh means
 * newer than every gated manifest; a manifest edited after the pass makes it stale. When the
 * findings header records the manifests digest the pass reviewed, fresh means that digest is
 * the manifests' current one, and no modification time enters (RWD-2026-0181, ADR-0033's
 * content-over-mtime line): a bare `touch` no longer turns a stale pass fresh.
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

/** What the advisory line reads, and on which basis it called the pass fresh or stale. */
export interface VerifyFindings {
  present: boolean;
  date?: string; // the findings file's mtime, YYYY-MM-DD in UTC — surfaced, never in the verdict (ADR-0067)
  fresh?: boolean;
  /** `digest` when the findings header records the manifests digest the pass reviewed (content:
   *  a bare `touch` moves nothing); `mtime` otherwise, the reading ADR-0007 and ADR-0067 keep. */
  basis?: "digest" | "mtime";
}

/**
 * The gated manifests' digest, as a pass records it (RWD-2026-0181): `sha256:` over each gated
 * deliverable in GATED_DELIVERABLES order, its path, then the sha256 of its bytes with CRLF read as
 * LF (a clone with autocrlf is the same manifest), or `absent`. Content, not time: the same
 * manifests give the same digest on every clone, which is the determinism ADR-0033 asks of a
 * lifecycle reading.
 */
export function manifestsDigest(missionDir: string): string {
  const h = createHash("sha256");
  for (const { deliverable } of GATED_DELIVERABLES) {
    const d = join(missionDir, deliverable);
    const body = existsSync(d)
      ? createHash("sha256").update(readFileSync(d, "utf8").replace(/\r\n/g, "\n")).digest("hex")
      : "absent";
    h.update(`${deliverable}\n${body}\n`);
  }
  return `sha256:${h.digest("hex")}`;
}

/** The digest a findings file records in its header, `Manifests digest: sha256:<64 hex>` (a line of
 *  its own, or one field of the dated header line). A truncated digest or prose without the label's
 *  colon is not one. */
export function recordedDigest(text: string): string | undefined {
  return text.match(/(?:^|[\s*_|·])Manifests digest[*_]*\s*:\s*[*_]*`?(sha256:[0-9a-f]{64})(?![0-9a-f])/mi)?.[1];
}

export function verifyFindings(missionDir: string): VerifyFindings {
  const path = join(missionDir, verifyFindingsPath(missionDir));
  if (!existsSync(path)) return { present: false };
  const st = statSync(path);
  const date = st.mtime.toISOString().slice(0, 10);
  const recorded = recordedDigest(readFileSync(path, "utf8"));
  if (recorded) return { present: true, date, fresh: recorded === manifestsDigest(missionDir), basis: "digest" };
  const mtime = st.mtimeMs;
  let fresh = true;
  for (const { deliverable } of GATED_DELIVERABLES) {
    const d = join(missionDir, deliverable);
    if (existsSync(d) && statSync(d).mtimeMs > mtime) { fresh = false; break; }
  }
  return { present: true, date, fresh, basis: "mtime" };
}
