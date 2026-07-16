import { resolve } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { detectHarness } from "../lib/harness.js";
import type { Channel } from "../lib/harness.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Recommend the auto-trigger channel for the AI harness running this command (ADR-0030).
 * Read-only: it detects and prints, it never wires anything — the operator installs (ADR-0012).
 * It never prompts, so an agent-driven run never hangs; `undetermined` is a normal outcome the
 * agent resolves by asking the operator (doctrine in AGENTS.md / the SKILL.md). Exit code: always 0.
 */
export async function wireCommand(opts: { path?: string; json?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  const det = detectHarness(process.env, root);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ runward: VERSION, mission: root, ...det }, null, 2) + "\n");
    return;
  }

  const renderChannel = (ch: Channel): string => {
    const target = ch.sample ? c.white(ch.sample) : c.darkGray(ch.note ?? "via distribution packaging");
    return `  ${c.primary(ch.channel.padEnd(18))} ${target}`;
  };

  console.log(createHeader(`Runward v${VERSION} — wire`, root ?? "no mission here"));

  console.log(section("Harness"));
  if (det.status === "detected") {
    console.log("  " + status.success(`${det.label}`) + c.darkGray(`  (runtime signal ${det.signal})`));
  } else if (det.status === "config-detected") {
    console.log("  " + status.info(`${det.label}`) + c.darkGray("  (config file present — weaker than a runtime signal; confirm with the operator)"));
  } else {
    console.log("  " + status.warning("undetermined — no runtime signal, no known config file"));
    console.log("  " + c.darkGray("expected for Copilot CLI, Windsurf, Kiro, Continue, Aider, Trae"));
  }

  if (det.recommendedChannel) {
    console.log(section("Recommended channel"));
    console.log(renderChannel(det.recommendedChannel));
    if (det.recommendedChannel.note) console.log("  " + c.darkGray(det.recommendedChannel.note));
  }

  console.log(section("Always available (any harness)"));
  for (const ch of det.candidateChannels) console.log(renderChannel(ch));

  console.log(section("Next"));
  if (det.status === "undetermined") {
    console.log("  " + c.white("Ask the operator which AI tool this is, then wire the matching sample on their approval."));
  } else {
    console.log("  " + c.white(`Offer to wire the sample above from ${c.primary("runward/adapters/")}, on the operator's approval.`));
  }
  console.log("  " + c.darkGray("runward wires nothing — you are the operator's hands (ADR-0012). The baseline `runward check` already runs here with nothing wired."));
  if (!root) console.log("  " + c.warning("no runward/ mission here — run `runward init` first; the adapter samples live in runward/adapters/."));
  console.log();
}
