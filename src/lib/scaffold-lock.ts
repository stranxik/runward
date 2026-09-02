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
  /** ADR-0057: the org corpus pin recorded when `update --corpus <path>` last vendored it —
   *  the {name, version} of the corpus the mission is pinned to. Optional (absent for the package
   *  corpus and any mission that never vendored one). Compared against the in-tree
   *  `runward/rules/corpus.json` to surface an ADVISORY drift; never a comparison key for the gate. */
  corpus?: { name: string; version: string };
  /** `<dir>/<file>` (POSIX, relative to runward/) → sha256 of what runward wrote. */
  files: Record<string, string>;
}

export function hashText(text: string): string {
  // Line endings are NOT content. A Windows checkout (`core.autocrlf`, or `* text=auto` in
  // .gitattributes) rewrites every file, and the corpus check then reported all 64 rules as
  // "edited since runward wrote it" — on a repository nobody had touched. `update` could not
  // repair it either: it kept them as local edits. Git doing its documented job must not turn a
  // whole mission red.
  text = text.replace(/\r\n/g, "\n");
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
    // ADR-0057: a well-formed corpus pin, or nothing. A malformed pin is dropped, never guessed at.
    const corpus = j.corpus && typeof j.corpus === "object"
      && typeof j.corpus.name === "string" && typeof j.corpus.version === "string"
      ? { name: j.corpus.name, version: j.corpus.version } : undefined;
    // Keys are names, not paths (forward slashes on every OS) — but locks written by versions up
    // to 0.37.1 on Windows carry `\`-separated skill keys (RWD-2026-0102). Normalising at the
    // reader keeps every such committed lock verifiable everywhere, instead of telling its owner
    // the corpus went unrecorded on a tree that never moved.
    const files: Record<string, string> = {};
    for (const [k, v] of Object.entries(j.files as Record<string, string>)) files[k.split("\\").join("/")] = v;
    return { version: 1, writtenBy: String(j.writtenBy ?? ""), files, ...(corpus ? { corpus } : {}) };
  } catch { return null; }
}

/** Serialise deterministically: sorted keys, so re-writing an unchanged scaffold is byte-idempotent.
 *  `corpus` (ADR-0057) is emitted only when a pin is recorded, so a mission without a vendored org
 *  corpus keeps the exact bytes it had before the field existed. */
export function renderScaffoldLock(
  writtenBy: string,
  files: Record<string, string>,
  corpus?: { name: string; version: string } | null,
): string {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(files).sort()) sorted[k] = files[k];
  const obj: Record<string, unknown> = { version: 1, writtenBy };
  if (corpus && corpus.name && corpus.version) obj.corpus = { name: corpus.name, version: corpus.version };
  obj.files = sorted;
  return JSON.stringify(obj, null, 2) + "\n";
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
  // Only `.md` rows are RULES. A vendored org corpus (ADR-0057) records its corpus.json and
  // migrations.json under `rules/` too; those are corpus metadata, not rules, and must never be
  // hashed as a rule (that would report a hand-edited corpus.json as an "edited rule").
  const ruleKeys = Object.keys(recorded).filter((k) => k.startsWith("rules/") && k.endsWith(".md"));
  // A mission created before the lock existed cannot be checked this way. Say so; never pretend.
  if (ruleKeys.length === 0) return { status: "unrecorded", ...none };

  // THE LOCK IS NOT THE AUTHORITY. It lives in the audited repository, so re-signing it in the
  // same commit made a corpus of "ok" files pass — the whole check bought nothing against anyone
  // deliberate, while costing honest teams a red gate. The authority is the INSTALLED PACKAGE,
  // under node_modules, outside the repository. The lock keeps its own job: telling an upstream
  // change from a local edit, so a mission legitimately behind a release is not accused.
  //
  //   hash === lock            → what runward wrote; fine even if the package has since moved
  //   hash === package         → updated to the current package; fine
  //   neither                  → edited locally, and the verdict is about something else

  const onDisk = existsSync(missionRules)
    ? readdirSync(missionRules).filter((f) => f.endsWith(".md")).sort()
    : [];
  const edited: string[] = [], missing: string[] = [];
  // What MUST be there is the union of what runward recorded and what the installed package ships.
  // Taking it from the lock alone left the door wide open: re-signing the lock in the same commit
  // made a corpus of 36 "ok" files pass, because every fabricated name matched the forged record
  // and no shipped name was ever looked for. The package cannot be re-signed from the repository.
  // SORTED, like its mission-side twin twenty lines up. A directory reader walks UTF-8 bytes while
  // `Array#sort` compares UTF-16 code units, and the two disagree above the BMP — measured
  // 2026-08-29 on this very machine, where `missing` came back in reader order for a package
  // holding `\u{1F600}-rule.md` and `\uFFFD-rule.md`. Below the BMP the two orders coincide on
  // APFS and diverge on ext4, so the same tree published a different document depending on the
  // runner. Everything else runward emits is held to determinism; this list was not.
  const shippedNames = packageRulesDir && existsSync(packageRulesDir)
    ? readdirSync(packageRulesDir).filter((f) => f.endsWith(".md")).sort()
    : [];
  const onDiskSet = new Set(onDisk);
  for (const f of shippedNames) {
    if (!onDiskSet.has(f) && !(`rules/${f}` in recorded)) missing.push(f);
  }
  for (const key of ruleKeys.sort()) {
    const file = key.slice("rules/".length);
    const abs = join(missionRules, file);
    if (!existsSync(abs)) { if (!missing.includes(file)) missing.push(file); continue; }
    const h = hashText(readFileSync(abs, "utf8"));
    if (h === recorded[key]) continue;
    const shipped = join(packageRulesDir, file);
    if (packageRulesDir && existsSync(shipped) && h === hashText(readFileSync(shipped, "utf8"))) continue;
    edited.push(file);
  }
  // A rule runward never wrote. Adding house rules is a legitimate and desirable practice, so
  // refusing them outright was wrong — it made a normal team's mission red. What cannot be allowed
  // is an unwritten rule COUNTING toward the non-vacuity floor: that is exactly how a fabricated
  // corpus passed (36 files of "ok" satisfying architect:6 … handover:4). So the line is drawn on
  // effect, not on origin: extend freely, but an extension may not stand in for a shipped rule.
  const known = new Set(ruleKeys.map((k) => k.slice("rules/".length)));
  const GATED = new Set(["architect", "topology", "floor", "govern", "handover"]);
  const extra = onDisk.filter((f) => {
    if (known.has(f)) return false;
    let head = "";
    try { head = readFileSync(join(missionRules, f), "utf8").slice(0, 800); } catch { return true; }
    const impact = head.match(/^impact:\s*([A-Za-z]+)/m)?.[1]?.toUpperCase() ?? "";
    const phases = head.match(/^phases:\s*\[([^\]]*)\]/m)?.[1] ?? "";
    const counts = (impact === "CRITICAL" || impact === "HIGH")
      && phases.split(",").map((x) => x.trim().replace(/["']/g, "")).some((x) => GATED.has(x));
    return counts; // only an extension that would inflate a gated floor is reported
  });
  return { status: "verifiable", edited, missing, extra };
}
