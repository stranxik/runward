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
import { proposeCommand } from "./commands/propose.js";
import { ratifyCommand } from "./commands/ratify.js";
import { sampleCommand } from "./commands/sample.js";
import { gateHookCommand, gateHookMisconfigured } from "./commands/gate-hook.js";
import { reportCommand } from "./commands/report.js";
import { GATE_HOOK_HARNESSES } from "./lib/gate-hook.js";
import { rulesCommand, explainCommand } from "./commands/rules.js";
import { TOOL_IDS } from "./lib/tools.js";
import { GATED_DELIVERABLES } from "./lib/conformance.js";
import { emitJson, errorPayload } from "./lib/machine-output.js";

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
  .option("--json", "machine output: verdict, current gate, deliverable states, conformance gaps, next step (stable contract, for agent-driven runs; gaps.proposed and gaps.unboundRows are already inside gaps.conformance, never added to it)")
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
  // ADR-0089: opt-in, beside the unchanged stdout document. The checker that re-checks it lives
  // outside the package and outside the verdict path; its answer never changes this exit code.
  .option("--witness <file>", "with --strict: also write the witness of the verdict to <file> (runward-witness/1, specified at https://github.com/stranxik/runward/blob/main/docs/spec/witness.md): the facts it relied on, for a separate checker to re-check; stdout and the exit code are unchanged")
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
  .option("--json", "machine output: current gate and phase, deliverable states, the strict verdict, ADRs with their dates, reopening triggers, workflows (stable contract, additive)")
  .action(statusCommand);

program
  .command("doctor")
  .description("environment and installation checks")
  .option("-p, --path <path>", "project directory (default: .)")
  .option("--json", "machine output: every check with its status (ok | warning | critical), counts, exit code (stable contract, additive)")
  .action(doctorCommand);

program
  .command("wire")
  .description("recommend the auto-trigger channel for the AI harness running this command (read-only without --install; --install, run by the operator in a terminal, arms the gate — ADR-0065)")
  .option("-p, --path <path>", "project directory")
  .option("--json", "machine output: detection status, harness, gate-hook id, recommended + candidate channels, the armed tier (stable contract)")
  .option("--install", "the operator's writing gesture (ADR-0065): shows the exact file, asks y/N, writes atomically with a probe and a committed journal — TTY-only, refused under an agent runtime signal, and --yes does not exist here")
  .option("--uninstall", "the symmetric removal of what --install wrote, under the same locks (the global --dry-run renders either gesture without writing, exempt from the locks)")
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
  .description("inventory of an existing codebase (brownfield/retro-doc): never modifies your code; writes runward/characterization.md, and runward/adr/DRAFT-*.md with --mine")
  .option("-p, --path <path>", "project directory (default: .)")
  .option("--mine", "also write candidate retroactive ADRs as runward/adr/DRAFT-*.md hypotheses (deterministic git archaeology, no model call); check --strict refuses each DRAFT until accepted or rejected")
  .option("--force", "with --mine on an already-governed mission: write the DRAFTs anyway (refused without it)")
  .action(characterizeCommand);

program
  .command("manifest")
  .description("rule-conformance manifest overview; --sync scaffolds missing rows and migrates renamed slugs (form only, never content)")
  .option("-p, --path <path>", "project directory")
  .option("--sync", "write: append missing rows with an empty status, rewrite renamed slugs, create missing sections")
  .option("--json", "machine output: every row of every gated manifest with its status and evidence, what is missing, and with --sync what was appended (stable contract, additive)")
  .action(manifestCommand);

program
  .command("propose")
  .description("deterministic proposer: fill empty manifest rows as proposed:applied where a rule's signature matches inside its declared territory — no model call; the gate refuses every proposal until it is ratified (runward ADR-0066)")
  .option("-p, --path <path>", "project directory")
  .option("--for <person>", "the person accountable for whoever runs this proposer, recorded in each proposed row as declared (`; for: <person>`): what lets an agent ratification be compared by accountable person (runward ADR-0088)")
  .option("--json", "machine output: the proposals made (row, pointer, signature) and the rows left empty with their cause (stable contract, additive)")
  .action(proposeCommand);

program
  .command("ratify")
  .description("turn proposals into your decisions, against displayed evidence; interactive for a person, --attest-blind is the recorded, disclosed escape; an agent ratifies under its own name with --agent <name> --for <person>, --list then --accept (runward ADR-0066, ADR-0082)")
  .option("-p, --path <path>", "project directory")
  .option("--all", "en-bloc ratification with a mandatory sample drawn deterministically from the mission digest")
  .option("--by <name>", "the declared ratifier (defaults to the OS user name; always recorded as declared)")
  .option("--attest-blind", "ratify without displayed evidence and RECORD the mode as BLIND — disclosed by every later check and carried by the attestation")
  .option("--decided", "ratify rows already DECIDED whose ratification is missing, BLIND, or older than the row's current content, instead of proposals")
  .option("--agent <name>", "an agent ratifies under its OWN name, never a person's; needs --for, runs without a terminal, and only through --list then --accept")
  .option("--for <person>", "the person accountable for the agent, recorded beside it as declared; mandatory with --agent")
  .option("--list", "write nothing: show every pending row with its resolved evidence, exactly what a person is shown, and its <deliverable>:<rule> id")
  .option("--accept <ids...>", "with --agent: ratify ONLY these listed rows, named <deliverable>:<rule> (repeatable or comma-separated); refused whole if one is not listed or was proposed by the agent or its accountable person")
  .option("--single-accountable", "with --agent and --accept: also accept a row whose proposer answers to the same accountable person as the agent, recorded as agent (single accountable) and disclosed as such on every surface; refused by default under the regulated tier (runward ADR-0088)")
  .option("--json", "with --list: the same rows and evidence as machine output")
  .action(ratifyCommand);

program
  .command("sample")
  .description("the weekly signed sample of a delegation charter (runward ADR-0088 decision 6), outside the verdict path: plant (the planter commits a seed as H(seed, nonce)), draw (the population from git, a drand round's signature you fetch), review (the maintainer's verdicts, the one act to sign), reveal (the planter opens the seeds); with no action, where the period stands, what git says of the signatures, and what comes next")
  .argument("[action]", "status (default) | plant | draw | review | reveal")
  .argument("[verdicts...]", "with review: <item>=accept or <item>=reject, one per drawn item")
  .option("-p, --path <path>", "project directory")
  .option("--branch <name>", "the branch the population is read from (default main)")
  .option("--ref <ref>", "with plant: the planted item's reference, as the reviewer will see it")
  .option("--summary <text>", "with plant: the planted item's summary")
  .option("--defect <text>", "with plant: the defect a careful review finds (revealed after the review)")
  .option("--stratum <name>", "with plant: merge (default), ratification or tag")
  .option("--actor <name>", "with plant: the actor shown (default: the charter's first delegate)")
  .option("--date <YYYY-MM-DD>", "with plant: the date shown (default: today)")
  .option("--signature <hex>", "with draw: the drand quicknet round's signature (runward opens no socket: fetch it with the URL `runward sample` prints)")
  .option("--reviewer <name>", "with review: the declared reviewer (default: the charter's accountable person)")
  .action(sampleCommand);

program
  .command("gate-hook")
  .description("run by your AI tool's end-of-turn hook: when check --strict is red, blocks the end of the turn once, in the shape that tool understands (Cursor cannot block: there it is advisory); every release after that is logged to runward/gate-bypass.log; with no mission found or a misconfigured hook it lets the turn through and says so on stderr")
  .requiredOption("--harness <id>", `one of: ${GATE_HOOK_HARNESSES.join(", ")}`)
  .option("-p, --path <path>", "project directory")
  .action(gateHookCommand);

program
  .command("report")
  .description("write the delivery report an assessor reads alone (ADR-0064): one self-contained HTML, rendered from the same machine payload check --json publishes — computes nothing, works without a terminal, an account or runward installed")
  .option("-p, --path <path>", "project directory")
  .option("-o, --out <path>", "output file inside the project, relative to its root or absolute (default runward/governance/delivery-report.html)")
  .option("--force", "replace an existing --out file that is not a previous delivery report")
  .option("--json", "machine output: the file written, the verdict and next step it carries, dry-run (stable contract, additive)")
  .action(reportCommand);

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
  .option("--json", "machine output: regime and mapping version, files written, the strict verdict the pack carries (stable contract, additive)")
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
const onCommanderExit = (err: { code?: string; exitCode?: number; message?: string }, cmd?: Command): never => {
  const code = err?.code ?? "";
  if (code === "commander.helpDisplayed" || code === "commander.version" || code === "commander.help") process.exit(0);
  // ADR-0083: a machine run of a command that has a `--json` form gets its usage error as the
  // document it asked for (`error: "usage"`); Commander has already written the sentence to stderr.
  // Only `--json` owns a JSON document: beside --sarif/--vsa/--attest, stdout stays empty.
  if (MISUSE.has(code) && cmd && machineRun(cmd)) emitJson(errorPayload(VERSION, "usage", (err?.message ?? code).replace(/^error:\s*/, "")));
  process.exit(MISUSE.has(code) ? 2 : (err?.exitCode ?? 1)); // Commander already wrote the message
};
/** The run asked for `--json` from a command whose machine form it is (`ratify`: only with `--list`). */
const machineRun = (cmd: Command): boolean => {
  const argv = process.argv.slice(2);
  if (!argv.includes("--json") || !cmd.options.some((o) => o.long === "--json")) return false;
  if (["--sarif", "--vsa", "--attest"].some((f) => argv.includes(f))) return false;
  return cmd.name() !== "ratify" || argv.includes("--list");
};
program.exitOverride((err) => onCommanderExit(err));
program.commands.forEach((cmd) => cmd.exitOverride((err) => onCommanderExit(err, cmd)));
// gate-hook runs INSIDE a harness, where exit 2 means "block the agent": a parse error there is
// the hook's configuration, not operator misuse at a terminal, and it fails open like every other
// infrastructure fault of that seam (ADR-0065; RWD-2026-0137). Commander already wrote the cause.
program.commands.find((cmd) => cmd.name() === "gate-hook")?.exitOverride((err: { code?: string; exitCode?: number; message?: string }) => {
  const code = err?.code ?? "";
  if (!MISUSE.has(code)) return onCommanderExit(err);
  const argv = process.argv;
  const i = argv.findIndex((a) => a === "-p" || a === "--path");
  gateHookMisconfigured((err?.message ?? code).replace(/^error:\s*/, ""), i >= 0 ? argv[i + 1] : undefined);
});

program.parseAsync().catch((err: { message?: string; stack?: string }) => {
  // An error escaping an async action — Commander's own exits are handled above.
  console.error("\n  " + c.error("✗") + " " + (err?.message ?? String(err)));
  if (process.env.VERBOSE && err?.stack) console.error(err.stack);
  process.exit(1);
});
