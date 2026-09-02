import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { findMissionRoot } from "../lib/mission.js";
import { detectHarness, agentRuntimeSignal } from "../lib/harness.js";
import type { Channel } from "../lib/harness.js";
import { installPlan, mergeClaudeSettings, removeClaudeSettings, kiroHookContent, alreadyWired, journalLine } from "../lib/wire-install.js";
import { c, createHeader, section, status, generationDate } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Recommend the auto-trigger channel for the AI harness running this command (ADR-0030).
 * Read-only: it detects and prints, it never wires anything — the operator installs (ADR-0012).
 * It never prompts, so an agent-driven run never hangs; `undetermined` is a normal outcome the
 * agent resolves by asking the operator (doctrine in AGENTS.md / the SKILL.md). Exit code: always 0.
 */
export async function wireCommand(opts: { path?: string; json?: boolean; install?: boolean; uninstall?: boolean }): Promise<void> {
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  const det = detectHarness(process.env, root);

  if (opts.install || opts.uninstall) {
    // --dry-run is the program's GLOBAL flag (cli.ts preAction → RUNWARD_DRY_RUN); declaring a
    // local twin made the two parsers fight over one token and the local one lost — read the env.
    await installGesture(root, det.family, { uninstall: !!opts.uninstall, dryRun: process.env.RUNWARD_DRY_RUN === "1" });
    return;
  }

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
  } else if (det.recommendedChannel) {
    console.log("  " + c.white(`Offer to wire the sample above from ${c.primary("runward/adapters/")}, on the operator's approval.`));
  } else {
    console.log("  " + c.white(`No turn-end sample ships for ${det.label} — use a universal channel above (pre-commit or CI), on the operator's approval.`));
  }
  console.log("  " + c.darkGray("runward wires nothing — you are the operator's hands (ADR-0012). The baseline `runward check` already runs here with nothing wired."));
  if (!root) console.log("  " + c.warning("no runward/ mission here — run `runward init` first; the adapter samples live in runward/adapters/."));
  console.log();
}

/**
 * The one writing gesture (ADR-0065, H2) — and its locks. TTY-only: an agent must never arm (or
 * disarm) the gate on its own session, so a runtime agent signal refuses even at a terminal, and
 * `--yes` does not exist here. `--dry-run` is the read-only rendering of the same gesture and is
 * exempt from both locks — it writes nothing. Everything decided lives in src/lib/wire-install.ts.
 */
async function installGesture(root: string | null, family: string | null, mode: { uninstall: boolean; dryRun: boolean }): Promise<void> {
  const verb = mode.uninstall ? "uninstall" : "install";
  if (!mode.dryRun) {
    const signal = agentRuntimeSignal(process.env);
    if (signal) {
      console.error(status.error(`refusing to ${verb}: this process runs under an agent harness (${signal}). Arming the gate is the operator's gesture — run \`runward wire --${verb}\` yourself in a terminal. \`--dry-run\` shows what it would do.`));
      process.exit(2);
    }
    if (!process.stdin.isTTY) {
      console.error(status.error(`refusing to ${verb} without a terminal — the gesture shows you the file before writing and asks. There is no flag that skips this (ADR-0065). \`--dry-run\` shows what it would do.`));
      process.exit(2);
    }
  }
  if (!root) {
    console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    process.exit(2);
  }

  console.log(createHeader(`Runward v${VERSION} — wire --${verb}`, root));
  const plan = installPlan(family);
  if (!plan) {
    // The honest refusal: no native install target for this family. Never a fallback write.
    console.log(section("No native install target"));
    console.log("  " + c.white(`runward ships no ${verb} target for ${family ?? "an undetermined harness"}.`));
    console.log("  " + c.darkGray("gemini/copilot: the channel lives in the distribution packaging (see `runward wire`). windsurf/trae/continue: use a universal channel — pre-commit or the CI required check (runward/adapters/)."));
    process.exit(2);
  }

  const targetAbs = join(root, plan.target);
  const existing = existsSync(targetAbs) ? readFileSync(targetAbs, "utf8") : null;

  if (!mode.uninstall) {
    const wired = existing === null ? null : alreadyWired(existing);
    if (wired) {
      console.log("  " + status.success(`already wired — ${plan.target} carries the runward gate (${wired === "pre-marker" ? "written before markers existed" : `runward ${wired}`}). Nothing to do.`));
      return;
    }
    let next: string;
    try {
      next = plan.kind === "merge" ? mergeClaudeSettings(existing) : kiroHookContent();
    } catch (e) {
      console.error(status.error(`${plan.target} exists but cannot be read back as JSON — refusing to merge into a file that would be destroyed. ${(e as Error).message}`));
      process.exit(2);
    }
    console.log(section(`The file, before it is written (${plan.target})`));
    console.log(next.split("\n").map((l) => "  " + c.darkGray("│ ") + l).join("\n"));
    if (existing !== null) console.log("  " + c.darkGray("preserving merge: every existing key and hook above survives; runward adds exactly one Stop entry, marked `runward-wired`."));
    console.log("  " + c.darkGray(`tier: ARMED — a red \`check --strict\` becomes the harness's own refusal (gate-hook --harness ${plan.harness}); it blocks once, and every release is traced to runward/gate-bypass.log.`));
    if (mode.dryRun) { console.log("\n  " + c.darkGray("--dry-run: nothing written.")); return; }
    if (!(await confirm())) { console.log("  " + c.darkGray("not confirmed — nothing written.")); return; }
    writeShown(root, targetAbs, plan.target, next, existing, plan.harness);
  } else {
    if (existing === null || !alreadyWired(existing)) {
      console.log("  " + status.success(`nothing to uninstall — ${plan.target} carries no runward gate.`));
      return;
    }
    const next = plan.kind === "own" ? null : removeClaudeSettings(existing);
    console.log(section(`The gesture (${plan.target})`));
    if (next === null) console.log("  " + c.white(`${plan.target} is runward-owned and will be deleted.`));
    else console.log(next.split("\n").map((l) => "  " + c.darkGray("│ ") + l).join("\n"));
    if (mode.dryRun) { console.log("\n  " + c.darkGray("--dry-run: nothing written.")); return; }
    if (!(await confirm())) { console.log("  " + c.darkGray("not confirmed — nothing written.")); return; }
    if (next === null) unlinkSync(targetAbs);
    else writeFileSync(targetAbs, next);
    appendFileSync(join(root, "runward", "adapters", "installed.log"), journalLine(generationDate(), "uninstalled", plan.target, plan.harness));
    console.log("  " + status.success(`uninstalled — recorded in runward/adapters/installed.log (committed: the gesture lives in a diff).`));
  }
}

async function confirm(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`  ${c.primary("write this file? [y/N]")} > `)).trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally { rl.close(); }
}

/** Atomic write, then the probe: re-read and re-parse what landed. A probe failure restores the
 *  previous bytes (or removes the new file) and SAYS so — never a half-written adapter. */
function writeShown(root: string, targetAbs: string, target: string, next: string, previous: string | null, harness: string): void {
  mkdirSync(dirname(targetAbs), { recursive: true });
  const tmp = targetAbs + ".runward-tmp";
  writeFileSync(tmp, next);
  renameSync(tmp, targetAbs);
  let probed = false;
  try { probed = alreadyWired(readFileSync(targetAbs, "utf8")) !== null; } catch { probed = false; }
  const logPath = join(root, "runward", "adapters", "installed.log");
  if (!probed) {
    if (previous === null) unlinkSync(targetAbs);
    else writeFileSync(targetAbs, previous);
    appendFileSync(logPath, journalLine(generationDate(), "rolled-back", target, harness));
    console.error(status.error("probe failed: the written file did not read back wired. Rolled back to the previous content — announced here and in runward/adapters/installed.log."));
    process.exit(2);
  }
  appendFileSync(logPath, journalLine(generationDate(), "installed", target, harness));
  console.log("  " + status.success(`installed — probe passed (re-read and parsed). Recorded in runward/adapters/installed.log (committed: the gesture lives in a diff).`));
  console.log("  " + c.darkGray(`undo with \`runward wire --uninstall\`; bypass one turn stays possible and traced (runward/gate-bypass.log).`));
}
