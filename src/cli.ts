#!/usr/bin/env node
/**
 * Runward CLI — after the spec: ship and run.
 * Zero-dependency scaffolder. `runward init` lays down the mission structure.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "..", "templates");
const VERSION: string = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8")).version;

const WORKFLOWS = [
  "method", "frame", "architect", "floor", "iterate",
  "govern", "handover", "brownfield", "review", "decision-loop",
] as const;

/** mission template file -> destination inside runward/ */
const MISSION_LAYOUT: Record<string, string> = {
  "framing.md": "framing.md",
  "architecture.md": "architecture.md",
  "floor.md": "floor.md",
  "adr/ADR-0000-template.md": "adr/ADR-0000-template.md",
  "threat-model.md": "governance/threat-model.md",
  "evaluation-rubric.md": "governance/evaluation-rubric.md",
  "observability-schema.md": "governance/observability-schema.md",
  "port-contract.md": "contracts/port-contract.md",
  "runbook.md": "runbook.md",
};

function parseArgs(argv: string[]) {
  const args = { cmd: argv[0] ?? "help", dir: ".", tools: [] as string[], force: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tools") args.tools = (argv[++i] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--force") args.force = true;
    else if (!a.startsWith("-")) args.dir = a;
    else fail(`Unknown option: ${a}`);
  }
  return args;
}

function fail(msg: string): never {
  console.error(`runward: ${msg}`);
  process.exit(1);
}

function write(path: string, content: string, force: boolean) {
  if (existsSync(path) && !force) {
    console.log(`  skip   ${path} (exists — use --force to overwrite)`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`  write  ${path}`);
}

function copy(src: string, dest: string, force: boolean) {
  write(dest, readFileSync(src, "utf8"), force);
}

function init(dir: string, tools: string[], force: boolean) {
  const root = join(process.cwd(), dir);
  const mission = join(root, "runward");
  console.log(`Runward v${VERSION} — scaffolding mission in ${root}\n`);

  for (const [src, dest] of Object.entries(MISSION_LAYOUT)) {
    copy(join(TEMPLATES, "mission", src), join(mission, dest), force);
  }
  for (const wf of readdirSync(join(TEMPLATES, "workflows"))) {
    copy(join(TEMPLATES, "workflows", wf), join(mission, "workflows", wf), force);
  }
  copy(join(TEMPLATES, "targets", "AGENTS.md"), join(root, "AGENTS.md"), force);

  for (const tool of tools) {
    if (tool === "claude") writeClaude(root, force);
    else if (tool === "cursor") writeCursor(root, force);
    else console.log(`  skip   unknown tool profile "${tool}" (v0.1 supports: claude, cursor)`);
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Fill runward/framing.md — do not architect before the framing gate passes.`);
  console.log(`  2. Point your agent at AGENTS.md and runward/workflows/method.md.`);
}

function writeClaude(root: string, force: boolean) {
  for (const wf of WORKFLOWS) {
    const cmd = [
      "---",
      `description: Runward — run the ${wf} workflow against the current mission state`,
      "---",
      "",
      `Read \`runward/workflows/${wf}.md\` and execute it against the current mission state in \`runward/\`.`,
      "Respect the charter in `AGENTS.md`. Do not mark the phase done unless its Definition of Done is demonstrably met.",
      "",
    ].join("\n");
    write(join(root, ".claude", "commands", `rw-${wf}.md`), cmd, force);
  }
}

function writeCursor(root: string, force: boolean) {
  const mdc = [
    "---",
    "description: Runward delivery method — floor first, evolution on evidence, governance from day zero",
    "alwaysApply: true",
    "---",
    "",
    "This project follows the Runward method. The agent charter is `AGENTS.md` (non-negotiable boundaries).",
    "The method is in `runward/workflows/` (start with `method.md`); the mission state is in `runward/`.",
    "Every structural decision goes through `runward/workflows/decision-loop.md` and is locked in an ADR under `runward/adr/`.",
    "",
  ].join("\n");
  write(join(root, ".cursor", "rules", "runward.mdc"), mdc, force);
}

const args = parseArgs(process.argv.slice(2));
switch (args.cmd) {
  case "init":
    init(args.dir, args.tools, args.force);
    break;
  case "version":
  case "--version":
  case "-v":
    console.log(VERSION);
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    console.log(`Runward v${VERSION} — after the spec: ship and run.

Usage:
  runward init [dir] [--tools claude,cursor] [--force]   scaffold the mission structure
  runward version                                        print version
  runward help                                           this message`);
}
