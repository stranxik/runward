#!/usr/bin/env node
/**
 * Runward CLI — after the spec: ship and run.
 * Commands: init (wizard), check (gate audit), status, doctor, update, characterize.
 */
import { Command } from "commander";
import { VERSION } from "./lib/paths.js";
import { c } from "./lib/styles.js";
import { initCommand } from "./commands/init.js";
import { checkCommand } from "./commands/check.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommand } from "./commands/doctor.js";
import { updateCommand } from "./commands/update.js";
import { characterizeCommand } from "./commands/characterize.js";

// Exit codes: 0 = success · 1 = gaps/warnings · 2 = missing prerequisite

process.on("uncaughtException", (err: Error & { name?: string }) => {
  if (err.name === "ExitPromptError") process.exit(130); // Ctrl+C in a prompt
  console.error("\n  " + c.error("✗") + " Unexpected error: " + err.message);
  if (process.env.VERBOSE) console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason: any) => {
  console.error("\n  " + c.error("✗") + " Async error: " + (reason?.message || reason));
  if (process.env.VERBOSE) console.error(reason?.stack);
  process.exit(1);
});

const program = new Command();

program
  .name("runward")
  .description("After the spec: ship and run. Delivery framework for agentic systems.")
  .version(VERSION)
  .option("--no-color", "disable colored output")
  .option("--verbose", "detailed logs")
  .option("--yes", "non-interactive: accept all defaults (CI)")
  .option("--dry-run", "print planned actions without writing")
  .hook("preAction", (cmd) => {
    const opts = cmd.opts();
    if (opts.color === false) process.env.NO_COLOR = "1";
    if (opts.verbose) process.env.VERBOSE = "1";
    if (opts.yes) process.env.RUNWARD_YES = "1";
    if (opts.dryRun) process.env.RUNWARD_DRY_RUN = "1";
  });

program
  .command("init")
  .description("scaffold the mission structure (interactive wizard, or --yes)")
  .option("-p, --path <path>", "project directory (default: prompt, or . with --yes)")
  .option("-t, --tools <list>", "comma-separated tool profiles: claude,cursor,copilot,gemini,windsurf")
  .option("--force", "overwrite existing files")
  .action(initCommand);

program
  .command("check")
  .description("can I cross the gate — gate audit, exit 1 on gaps (CI-friendly)")
  .option("-p, --path <path>", "project directory")
  .option("--strict", "also verify the floor rule-conformance manifest (deterministic)")
  .option("--hooks", "run operator hooks from runward/hooks.json around the audit (opt-in)")
  .action(checkCommand);

program
  .command("status")
  .description("where am I — mission snapshot: current gate, decision journal, workflows")
  .option("-p, --path <path>", "project directory")
  .action(statusCommand);

program
  .command("doctor")
  .description("environment and installation checks")
  .action(doctorCommand);

program
  .command("update")
  .description("refresh runward/workflows/ and runward/rules/ from this package version (mission state untouched)")
  .option("-p, --path <path>", "project directory")
  .option("--force", "overwrite locally modified workflows")
  .action(updateCommand);

program
  .command("characterize")
  .description("read-only inventory of an existing codebase → runward/characterization.md (brownfield/retro-doc)")
  .option("-p, --path <path>", "project directory (default: .)")
  .option("--mine", "also propose retroactive ADR hypotheses (advisory — not yet implemented)")
  .action(characterizeCommand);

program.parseAsync();
