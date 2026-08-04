import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * What runward last wrote into a mission's scaffolded directories, so `update` can tell an
 * UPSTREAM change from a LOCAL edit.
 *
 * Without this record the two are indistinguishable: `update` compared the mission's copy to the
 * CURRENT package template, so any release that changed a shipped rule made every mission report
 * `drift (locally modified)` — a false statement about files the operator never touched — and the
 * refresh was then withheld behind `--force`. A mission following the instruction "do not edit
 * your rules copy" therefore never received the change at all.
 *
 * Shape and discipline follow `evidence-lock.json` (ADR-0021): a committed, sorted, deterministic
 * map of path → sha256, byte-idempotent when nothing moved.
 */

export const SCAFFOLD_LOCK = "scaffold-lock.json";

export interface ScaffoldLock {
  version: 1;
  /** The runward version that last wrote these files — informational, never a comparison key. */
  writtenBy: string;
  /** `<dir>/<file>` (POSIX, relative to runward/) → sha256 of what runward wrote. */
  files: Record<string, string>;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function lockPath(missionDir: string): string {
  return join(missionDir, SCAFFOLD_LOCK);
}

/** Read the lock, or null when absent or unreadable. A malformed lock is treated as absent: the
 *  honest degradation is "I cannot tell", never a guess about who changed what. */
export function readScaffoldLock(missionDir: string): ScaffoldLock | null {
  const p = lockPath(missionDir);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    if (!j || j.version !== 1 || typeof j.files !== "object" || j.files === null) return null;
    return { version: 1, writtenBy: String(j.writtenBy ?? ""), files: j.files };
  } catch { return null; }
}

/** Serialise deterministically: sorted keys, so re-writing an unchanged scaffold is byte-idempotent. */
export function renderScaffoldLock(writtenBy: string, files: Record<string, string>): string {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(files).sort()) sorted[k] = files[k];
  return JSON.stringify({ version: 1, writtenBy, files: sorted }, null, 2) + "\n";
}

/** What `update` should do with one scaffolded file. The three outcomes it could not previously
 *  tell apart are `upstream`, `local` and `unknown` — and only `local` is an operator edit. */
export type FileVerdict = "added" | "same" | "upstream" | "local" | "unknown";

export function classify(
  destExists: boolean,
  destText: string | null,
  srcText: string,
  recordedHash: string | undefined,
): FileVerdict {
  if (!destExists || destText === null) return "added";
  if (destText === srcText) return "same";
  // No record for this file — a mission scaffolded before the lock existed. runward genuinely
  // cannot attribute the difference, and says so rather than blaming the operator.
  if (recordedHash === undefined) return "unknown";
  // The copy is byte-identical to what runward last wrote, yet differs from the template:
  // the change came from upstream. Refreshing it is the whole point of `update`.
  return hashText(destText) === recordedHash ? "upstream" : "local";
}

/** Does the mission's rule corpus still match what runward wrote?
 *
 *  The gate reads the mission's OWN copy of the rules (`runward/rules/`), which the audited party
 *  writes. An adversarial audit on 2026-08-04 made `check --strict` exit 0 on a mission with a
 *  wholly fabricated corpus — 36 files containing the word "ok" — because the non-vacuity floor
 *  (ADR-0002) is an invariant of CARDINALITY over a set the adversary controls. Substituting one
 *  rule for another, or stripping a `signature:` line, passed just as silently.
 *
 *  The detector already existed and was not wired: `scaffold-lock.json` holds the SHA-256 of every
 *  rule runward laid down, and `update` reads it. `check` did not. The falsification was seen,
 *  named, and protected — never raised to the verdict. This is that import. */
export function corpusDivergence(missionDir: string, packageRulesDir: string): {
  status: "verifiable" | "unrecorded" | "package";
  edited: string[];
  missing: string[];
  extra: string[];
} {
  const none = { edited: [], missing: [], extra: [] };
  const missionRules = join(missionDir, "rules");
  // A mission with NO local copy judges against the installed package, under node_modules and
  // outside the audited repository. There is nothing here for the audited party to edit, so there
  // is nothing to verify — and warning about it would be a false alarm on the safest configuration
  // there is. Both runward's own mission and the shipped example are in this state.
  const hasLocalCopy = existsSync(missionRules)
    && readdirSync(missionRules).some((f) => f.endsWith(".md"));
  if (!hasLocalCopy) return { status: "package", ...none };

  const lock = readScaffoldLock(missionDir);
  const recorded = lock?.files ?? {};
  const ruleKeys = Object.keys(recorded).filter((k) => k.startsWith("rules/"));
  // A mission created before the lock existed cannot be checked this way. Say so; never pretend.
  if (ruleKeys.length === 0) return { status: "unrecorded", ...none };

  const onDisk = existsSync(missionRules)
    ? readdirSync(missionRules).filter((f) => f.endsWith(".md")).sort()
    : [];
  const edited: string[] = [], missing: string[] = [];
  for (const key of ruleKeys.sort()) {
    const file = key.slice("rules/".length);
    const abs = join(missionRules, file);
    if (!existsSync(abs)) { missing.push(file); continue; }
    if (hashText(readFileSync(abs, "utf8")) !== recorded[key]) edited.push(file);
  }
  // A rule runward never wrote. Legitimate as a house rule; it must still be visible, because a
  // fabricated corpus is exactly a pile of files runward never wrote.
  const known = new Set(ruleKeys.map((k) => k.slice("rules/".length)));
  const extra = onDisk.filter((f) => !known.has(f));
  return { status: "verifiable", edited, missing, extra };
}
