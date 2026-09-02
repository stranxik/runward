// `wire --install` — the one writing gesture, and everything it decides (ADR-0065, H2).
// The command stays the shell (TTY, prompts, streams); every merge, marker and removal lives here
// where a test reaches it without a terminal (the ADR-0047 discipline).
//
// Two families install natively today: claude (a preserving merge into .claude/settings.json) and
// kiro (a whole file runward owns under .kiro/hooks/). Every other family gets an honest refusal
// pointing at its distribution packaging or the universal channels — never a pretended install.
// Each written artifact carries a `runward-wired: <version>` marker (the frozen-skills lesson:
// know which version wrote a file, or watch it rot unnoticed), and every install/uninstall appends
// one line to runward/adapters/installed.log — committed, so the gesture lives in a diff.
import { VERSION } from "./paths.js";

export interface InstallPlan {
  /** Repo-relative target the gesture writes. */
  target: string;
  /** merge = preserve the operator's file and add one entry; own = runward owns the whole file. */
  kind: "merge" | "own";
  harness: "claude" | "kiro";
}

/** What `--install` can write for a detected family, or null — null is an honest refusal, never
 *  a fallback write somewhere else. */
export function installPlan(family: string | null): InstallPlan | null {
  if (family === "claude") return { target: ".claude/settings.json", kind: "merge", harness: "claude" };
  if (family === "kiro") return { target: ".kiro/hooks/runward-gate.kiro.hook", kind: "own", harness: "kiro" };
  return null;
}

/** The armed Stop entry for Claude Code settings. The marker rides inside the entry runward adds,
 *  never at the top level of the operator's own settings file. */
function claudeStopEntry(version: string): Record<string, unknown> {
  return {
    "runward-wired": version,
    hooks: [{ type: "command", command: "npx --yes runward gate-hook --harness claude" }],
  };
}

/** The whole kiro hook file, runward-owned. Stop trigger: the armed tier blocks the end of turn,
 *  where the shipped consultative sample observes per-tool. */
export function kiroHookContent(version: string = VERSION): string {
  return JSON.stringify({
    "runward-wired": version,
    version: "v1",
    hooks: [{
      name: "runward-gate", trigger: "Stop",
      action: { type: "command", command: "npx --yes runward gate-hook --harness kiro" },
      timeout: 120, enabled: true,
    }],
  }, null, 2) + "\n";
}

/** The version that already wired this content, or null. Reads the marker first; a marker-less
 *  entry that still speaks gate-hook counts as wired by an unknown version ("pre-marker"). */
export function alreadyWired(content: string): string | null {
  try {
    const j = JSON.parse(content);
    const entries: Array<Record<string, unknown>> = [
      ...(Array.isArray(j?.hooks?.Stop) ? j.hooks.Stop : []),
      ...(Array.isArray(j?.hooks) ? j.hooks : []),
      j,
    ];
    for (const e of entries) {
      if (typeof e?.["runward-wired"] === "string") return e["runward-wired"] as string;
    }
  } catch { /* unparsable is not wired */ }
  return /runward gate-hook --harness/.test(content) ? "pre-marker" : null;
}

/** Preserving merge into .claude/settings.json: every existing key and hook survives; runward adds
 *  exactly one Stop entry. `existing` null means the file does not exist yet. Throws on a file that
 *  exists but does not parse — merging into a file we cannot read back would destroy it. */
export function mergeClaudeSettings(existing: string | null, version: string = VERSION): string {
  const base = existing === null ? {} : JSON.parse(existing);
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    throw new Error("settings.json is not a JSON object — refusing to merge into it");
  }
  base.hooks = base.hooks && typeof base.hooks === "object" ? base.hooks : {};
  const stop: unknown[] = Array.isArray(base.hooks.Stop) ? base.hooks.Stop : [];
  base.hooks.Stop = [...stop, claudeStopEntry(version)];
  return JSON.stringify(base, null, 2) + "\n";
}

/** The symmetric removal: drop exactly the entries runward marked or that speak gate-hook; every
 *  other byte of the operator's settings survives. Returns null when nothing was runward's. */
export function removeClaudeSettings(existing: string): string | null {
  const base = JSON.parse(existing);
  const stop: Array<Record<string, unknown>> = Array.isArray(base?.hooks?.Stop) ? base.hooks.Stop : [];
  const kept = stop.filter((e) =>
    typeof e?.["runward-wired"] !== "string" &&
    !JSON.stringify(e?.hooks ?? "").includes("runward gate-hook"));
  if (kept.length === stop.length) return null;
  base.hooks.Stop = kept;
  if (base.hooks.Stop.length === 0) delete base.hooks.Stop;
  if (Object.keys(base.hooks).length === 0) delete base.hooks;
  return JSON.stringify(base, null, 2) + "\n";
}

/** One committed line per gesture. The caller dates it — the verdict path takes no clock; this
 *  seam may, like the bypass log beside it. */
export function journalLine(dateIso: string, action: "installed" | "uninstalled" | "rolled-back", target: string, harness: string, version: string = VERSION): string {
  return `${dateIso}  ${action} ${target} (harness ${harness}, runward ${version})\n`;
}
