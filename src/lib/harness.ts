import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Best-effort harness detection for `runward wire` (ADR-0030).
 *
 * The question: which AI harness is running this command, so the agent can propose the matching
 * auto-trigger channel? Detection is a convenience, never a prerequisite — the baseline
 * `runward check` runs in any harness with nothing wired. Two signal strengths, in order:
 *
 *  1. Runtime signal — an environment marker the harness injects into the child process. Strong:
 *     it attests *this* run. Verified markers only; a guessed variable name is worse than none.
 *  2. Config file — a tool-profile marker already in the repo. Weaker: a `.cursor/` folder does not
 *     prove Cursor is running *this* command, so it is surfaced distinctly (`config-detected`).
 *
 * When neither resolves, the status is `undetermined` — not an error. The agent, already in
 * conversation with the operator, asks which harness it is (doctrine in AGENTS.md / the SKILL.md).
 * `wire` never writes: `wires` is always false, the ADR-0012 invariant made machine-checkable.
 */

export type ChannelKind = "turn-end-hook" | "per-tool-hook" | "advisory-hook" | "pre-commit" | "ci-required-check";

export interface Channel {
  channel: ChannelKind;
  /** Mission-relative path to an inert sample the operator wires, or null when the channel lives
   *  in a distribution packaging rather than a mission adapter. */
  sample: string | null;
  note?: string;
}

export interface HarnessDetection {
  schemaVersion: 1;
  status: "detected" | "config-detected" | "undetermined";
  harness: string | null;   // stable id, e.g. "claude-code"
  label: string | null;     // human label, e.g. "Claude Code / Cowork"
  family: string | null;    // tool-profile id, e.g. "claude"
  detectedVia: "runtime-signal" | "config-file" | null;
  signal: string | null;    // env var name when detectedVia === "runtime-signal"
  recommendedChannel: Channel | null;
  candidateChannels: Channel[]; // the universal hard channels — valid whatever the harness
  wires: false;             // invariant: wire never writes (ADR-0012)
  operatorAction: "offer-to-wire-sample" | "ask-operator-which-harness";
}

/**
 * Runtime signals — verified environment markers injected into the child process (survey 2026-07-16).
 * `CLAUDECODE=1` covers Claude Code CLI *and* Cowork: Cowork runs the same Claude Code family and
 * exposes no distinct marker, so it is named but never branched on a guessed value. `CURSOR_AGENT=1`
 * is the agent-mode marker (not `CURSOR_TRACE_ID`, which is broader than agent mode).
 */
const RUNTIME_SIGNALS: Array<{ env: string; value: string; harness: string; label: string; family: string }> = [
  { env: "CLAUDECODE", value: "1", harness: "claude-code", label: "Claude Code / Cowork", family: "claude" },
  { env: "GEMINI_CLI", value: "1", harness: "gemini-cli", label: "Gemini CLI", family: "gemini" },
  { env: "CURSOR_AGENT", value: "1", harness: "cursor", label: "Cursor (agent mode)", family: "cursor" },
];

/** Config-file markers a tool profile already laid down (mirrors doctor's detection). Weaker signal. */
const CONFIG_MARKERS: Array<{ marker: string; present: (root: string) => boolean; harness: string; label: string; family: string }> = [
  { marker: ".claude/commands/rw-*", family: "claude", harness: "claude-code", label: "Claude Code / Cowork",
    present: (r) => existsSync(join(r, ".claude", "commands")) && readdirSync(join(r, ".claude", "commands")).some((f) => f.startsWith("rw-")) },
  { marker: ".cursor/rules/runward.mdc", family: "cursor", harness: "cursor", label: "Cursor",
    present: (r) => existsSync(join(r, ".cursor", "rules", "runward.mdc")) },
  { marker: "GEMINI.md", family: "gemini", harness: "gemini-cli", label: "Gemini CLI",
    present: (r) => existsSync(join(r, "GEMINI.md")) },
  { marker: ".github/copilot-instructions.md", family: "copilot", harness: "copilot", label: "GitHub Copilot",
    present: (r) => existsSync(join(r, ".github", "copilot-instructions.md")) },
  { marker: ".windsurf/rules/runward.md", family: "windsurf", harness: "windsurf", label: "Windsurf",
    present: (r) => existsSync(join(r, ".windsurf", "rules", "runward.md")) },
  { marker: ".kiro/steering/", family: "kiro", harness: "kiro", label: "Kiro",
    present: (r) => existsSync(join(r, ".kiro", "steering")) },
];

/**
 * The harness-specific auto-trigger channel. `sample` points at an inert mission adapter where one
 * ships; where runward ships no mission adapter (gemini/cursor/copilot), the channel lives in the
 * distribution packaging and `sample` is null with a note. Never a promise that runward wires it.
 */
const FAMILY_CHANNEL: Record<string, Channel> = {
  claude: { channel: "turn-end-hook", sample: "runward/adapters/claude-code-settings.json" },
  kiro: { channel: "per-tool-hook", sample: "runward/adapters/kiro-hooks.json" },
  gemini: { channel: "turn-end-hook", sample: null, note: "the Gemini extension (packaging/gemini) carries the AfterAgent hook" },
  cursor: { channel: "advisory-hook", sample: null, note: "Cursor's hook is advisory; its blocking seam is per-tool, deliberately not shipped" },
  copilot: { channel: "turn-end-hook", sample: null, note: "copy packaging/copilot/hooks/runward-gate.json into .github/hooks/" },
};

/** Universal hard channels — present in every mission after init, valid whatever the harness. */
export const UNIVERSAL_CHANNELS: Channel[] = [
  { channel: "pre-commit", sample: "runward/adapters/pre-commit" },
  { channel: "ci-required-check", sample: "runward/adapters/github-actions.yml" },
];

/** Detect the harness from the environment (runtime signal) and, failing that, the repo (config file). */
export function detectHarness(env: NodeJS.ProcessEnv, root: string | null): HarnessDetection {
  const base = { schemaVersion: 1 as const, candidateChannels: UNIVERSAL_CHANNELS, wires: false as const };

  for (const s of RUNTIME_SIGNALS) {
    if (env[s.env] === s.value) {
      return {
        ...base, status: "detected", harness: s.harness, label: s.label, family: s.family,
        detectedVia: "runtime-signal", signal: s.env,
        recommendedChannel: FAMILY_CHANNEL[s.family] ?? null, operatorAction: "offer-to-wire-sample",
      };
    }
  }
  if (root) {
    for (const m of CONFIG_MARKERS) {
      if (m.present(root)) {
        return {
          ...base, status: "config-detected", harness: m.harness, label: m.label, family: m.family,
          detectedVia: "config-file", signal: null,
          recommendedChannel: FAMILY_CHANNEL[m.family] ?? null, operatorAction: "offer-to-wire-sample",
        };
      }
    }
  }
  return {
    ...base, status: "undetermined", harness: null, label: null, family: null,
    detectedVia: null, signal: null, recommendedChannel: null, operatorAction: "ask-operator-which-harness",
  };
}
