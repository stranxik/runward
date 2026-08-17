#!/usr/bin/env node
/**
 * Runward CLI — after the spec: ship and run.
 * Commands: init (wizard), check (gate audit), status, doctor, wire (harness→channel),
 * update, characterize, compliance (evidence pack), manifest (table plumbing),
 * rules / explain (rule-set surface).
 */
import { Command, Option } from "commander";
import { VERSION } from "./lib/paths.js";
import { THROUGH_PHASE_IDS } from "./lib/mission.js";
import { c } from "./lib/styles.js";
import { initCommand } from "./commands/init.js";
import { checkCommand } from "./commands/check.js";
import { verifyCommand } from "./commands/verify.js";
import { bundleCommand } from "./commands/bundle.js";
import { specCheckCommand } from "./commands/spec-check.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommand } from "./commands/doctor.js";
import { wireCommand } from "./commands/wire.js";
import { updateCommand } from "./commands/update.js";
import { characterizeCommand } from "./commands/characterize.js";
import { complianceCommand } from "./commands/compliance.js";
import { manifestCommand } from "./commands/manifest.js";
import { rulesCommand, explainCommand } from "./commands/rules.js";
import { TOOL_IDS } from "./lib/tools.js";
import { GATED_DELIVERABLES } from "./lib/conformance.js";

// Exit codes: 0 = success · 1 = gaps/warnings · 2 = missing prerequisite or CLI misuse (typo, unknown flag)

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
  .option("-t, --tools <list>", `comma-separated tool profiles: ${TOOL_IDS.join(",")}`)
  .option("--force", "overwrite existing files")
  .option("--example", "scaffold a filled reference mission (request-triage) — the whole chain is green out of the box")
  .action(initCommand);

program
  .command("check")
  .description("can I cross the gate — gate audit, exit 1 on gaps (CI-friendly)")
  .option("-p, --path <path>", "project directory")
  .option("--strict", "also verify the rule-conformance manifests: rows, typed pointers, signatures, drift, seal (deterministic)")
  .option("--freeze", "seal a green strict gate: hash the evidence into runward/evidence-lock.json (implies --strict)")
  .option("--hooks", "run operator hooks from runward/hooks.json around the audit (opt-in)")
  .option("--coverage", "advisory: report deliverable + decision-ratification coverage (does not gate)")
  // ADR-0053: a declared construction horizon. `choices()` rejects an unknown id as
  // `commander.invalidArgument` → exit 2 (misuse). The `--through`+`--freeze` conflict is guarded
  // in checkCommand (a seal certifies a full crossing, never a prefix).
  .addOption(new Option("--through <phase-id>", `construction gate: certify only phases up to and including <phase-id> (${THROUGH_PHASE_IDS.join(" | ")}) — a progress signal, never the sole release gate (ADR-0053)`).choices([...THROUGH_PHASE_IDS]))
  .option("--json", "machine output: verdict, current gate, deliverable states, conformance gaps (stable contract, for agent-driven runs)")
  // ADR-0055: emit the verdict as an UNSIGNED in-toto Statement (a Statement wrapping --json, whose
  // subject binds it to this mission tree). The operator signs it under their own key (never runward's).
  .option("--attest", "emit the verdict as an unsigned in-toto attestation (in-toto Statement wrapping --json; sign it yourself under your own key)")
  // ADR-0056 widening, emission half: the verdict in the format every forge already renders, so a
  // gap becomes an annotation on the manifest row that carries it. Emission only — runward writes
  // the file; uploading it is the operator's CI step (ADR-0054).
  .option("--sarif", "emit the verdict as a SARIF 2.1.0 log (annotations on the manifest rows; upload it yourself)")
  // ADR-0011/ADR-0055: a NEUTRAL port. An ecosystem verifier reads a VSA already and needs to learn
  // nothing about runward. `--resource-uri` is required and has no default: runward reads a working
  // tree and knows nothing about where it is published, so guessing the name would put an
  // unverifiable claim into an attestation a policy engine acts on.
  .option("--vsa", "emit the verdict as a SLSA Verification Summary Attestation (needs --resource-uri; set SOURCE_DATE_EPOCH to keep it byte-idempotent)")
  .option("--resource-uri <uri>", "the artifact the VSA is about (a package, image or release URI) — required with --vsa, never guessed")
  .action(checkCommand);

program
  .command("verify")
  .description("re-check a `check --attest` attestation offline — the tree has not drifted and the verdict re-derives, on the repo alone (ADR-0055)")
  .argument("<attestation>", "path to the in-toto Statement emitted by `runward check --attest`")
  .option("-p, --path <path>", "project directory")
  .option("--json", "machine output: verified, and the digest/verdict match (stable contract)")
  .action(verifyCommand);

program
  .command("bundle")
  .description("bind delivery artifacts (the verdict attestation, seal, OSCAL, SBOM) into one in-toto-attested manifest — a single provenance for an assessor (ADR-0055)")
  .argument("<artifacts...>", "the artifact files to bind, referenced by raw SHA-256 (verifiable by runward verify or any cosign/in-toto tool)")
  .option("-p, --path <path>", "project directory")
  .action(bundleCommand);

program
  .command("spec-check")
  .description("deterministic spec conformance: every acceptance criterion is LINKED to a present delivered artifact, and every criterion identifier the bundle references is declared — never a claim it is semantically met (ADR-0056)")
  .argument("<spec...>", "spec/constitution markdown file(s), or a bundle DIRECTORY (spec-kit `specs/<feature>/`, an OpenSpec change dir) — its *.md are read, sorted")
  .option("-p, --path <path>", "project root the criteria's file:/test: pointers resolve against (default: .)")
  .option("--json", "machine output: verdict, per-criterion linkage, non-scope (stable contract)")
  .action(specCheckCommand);

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
  .command("wire")
  .description("recommend the auto-trigger channel for the AI harness running this command (read-only; never wires — the operator does, ADR-0012)")
  .option("-p, --path <path>", "project directory")
  .option("--json", "machine output: detection status, harness, recommended + candidate channels (stable contract)")
  .action(wireCommand);

program
  .command("update")
  .description("refresh runward/workflows/ and runward/rules/ from this package version (mission state untouched)")
  .option("-p, --path <path>", "project directory")
  .option("--force", "overwrite locally modified workflows")
  // ADR-0057: vendor the rule corpus from an already-vendored local DIRECTORY (an org's policy
  // corpus), not the package rules. Takes a filesystem path, NEVER a registry coordinate like
  // @org/rules — runward resolves no package specifiers.
  .option("--corpus <path>", "vendor runward/rules/ from this local corpus directory (a path, never a registry coordinate)")
  .action(updateCommand);

program
  .command("characterize")
  .description("read-only inventory of an existing codebase → runward/characterization.md (brownfield/retro-doc)")
  .option("-p, --path <path>", "project directory (default: .)")
  .option("--mine", "also propose candidate retroactive ADRs as DRAFT hypotheses (deterministic git archaeology, no model call)")
  .action(characterizeCommand);

program
  .command("manifest")
  .description("rule-conformance manifest overview; --sync scaffolds missing rows and migrates renamed slugs (form only, never content)")
  .option("-p, --path <path>", "project directory")
  .option("--sync", "write: append missing rows with an empty status, rewrite renamed slugs, create missing sections")
  .action(manifestCommand);

program
  .command("rules")
  .description("the effective rule set (mission copy, else package); --json is a stable machine contract")
  .option("-p, --path <path>", "project directory")
  .option("--json", "machine output: { runward, source, count, rules } sorted by slug (versioned, additive)")
  // Derived from the single source, never a hardcoded list — a new gated phase (e.g. handover,
  // ADR-0026) must never be missing from this help the way it was before.
  .option("--phase <id>", `only the rules mapped to this phase (${GATED_DELIVERABLES.map((d) => d.phase).join(" | ")})`)
  // ADR-0041: paths come from the caller — runward never computes the change set itself.
  // Composes with the harness: `git diff --name-only "$BASE...HEAD" | xargs runward rules --for`.
  .option("--for <paths...>", "only the rules whose declared territory (appliesTo:) covers these project-relative paths; prints the pattern that matched")
  .action(rulesCommand);

program
  .command("explain")
  .description("print a rule's contract (impact, phases, why, signature) and its full text — the rationale inline")
  .argument("<rule>", "rule slug (see `runward rules`)")
  .option("-p, --path <path>", "project directory")
  .option("--json", "machine output: the rule plus its body")
  .action(explainCommand);

program
  .command("compliance")
  .description("assemble a regime-framed evidence pack from the mission (deterministic, read-only; a readiness draft, never a compliance claim)")
  .argument("[regime]", "iso-42001 | nist-ai-rmf | eu-ai-act")
  .option("-p, --path <path>", "project directory")
  .option("--regime-version <version>", "regime mapping version (default: highest shipped, see regimes/)")
  .action(complianceCommand);

// exitOverride lets us map Commander's own errors onto runward's exit-code contract:
// a parse error (unknown command/option, missing/excess argument) is operator misuse → 2,
// so CI can tell a typo from a legitimate gate failure (exit 1). Help/version exit 0.
// Applied to the root AND every subcommand — it does not propagate on its own.
const MISUSE = new Set([
  "commander.unknownCommand", "commander.unknownOption", "commander.invalidArgument",
  "commander.missingArgument", "commander.excessArguments",
  "commander.missingMandatoryOptionValue", "commander.optionMissingArgument",
]);
const onCommanderExit = (err: { code?: string; exitCode?: number }): never => {
  const code = err?.code ?? "";
  if (code === "commander.helpDisplayed" || code === "commander.version" || code === "commander.help") process.exit(0);
  process.exit(MISUSE.has(code) ? 2 : (err?.exitCode ?? 1)); // Commander already wrote the message
};
program.exitOverride(onCommanderExit);
program.commands.forEach((cmd) => cmd.exitOverride(onCommanderExit));

program.parseAsync().catch((err: { message?: string; stack?: string }) => {
  // An error escaping an async action — Commander's own exits are handled above.
  console.error("\n  " + c.error("✗") + " " + (err?.message ?? String(err)));
  if (process.env.VERBOSE && err?.stack) console.error(err.stack);
  process.exit(1);
});
