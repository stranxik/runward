// Smoke test: init --yes, check, status, doctor, update, dry-run, idempotence.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "runward-"));
let failures = 0;

function run(args, { expectFail = false, cwd = tmp } = {}) {
  try {
    return execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  } catch (e) {
    if (expectFail) return (e.stdout ?? "") + (e.stderr ?? "");
    failures++;
    console.error(`FAIL — runward ${args.join(" ")} exited ${e.status}\n${e.stdout}\n${e.stderr}`);
    return "";
  }
}
function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { failures++; console.error(`  FAIL  ${label}`); }
}

try {
  // ── init --yes ──────────────────────────────────────────────────
  const initOut = run(["--yes", "init", "--tools", "claude,cursor,copilot,gemini,windsurf"]);
  const expected = [
    "AGENTS.md",
    "runward/framing.md",
    "runward/architecture.md",
    "runward/floor.md",
    "runward/adr/ADR-0000-template.md",
    "runward/governance/threat-model.md",
    "runward/governance/evaluation-rubric.md",
    "runward/governance/observability-schema.md",
    "runward/contracts/port-contract.md",
    "runward/runbook.md",
    "runward/workflows/method.md",
    "runward/workflows/decision-loop.md",
    "runward/decision-matrix.md",
    "runward/mission-contract.md",
    "runward/reference-stack.md",
    "runward/rules/hexa-llm-boundary-principle.md",
    "runward/rules/patterns-memory-router-tiered.md",
    "runward/rules/state-event-sourcing.md",
    ".claude/commands/rw-frame.md",
    ".claude/commands/rw-govern.md",
    ".cursor/rules/runward.mdc",
    ".github/copilot-instructions.md",
    "GEMINI.md",
    ".windsurf/rules/runward.md",
  ];
  assert(expected.every((p) => existsSync(join(tmp, p))), `init lays down ${expected.length} paths (5 tool profiles)`);
  assert(initOut.includes("Next steps"), "init prints next steps");
  assert(readFileSync(join(tmp, "runward/framing.md"), "utf8").includes("greenfield"), "init prefills entry mode in framing.md");

  // ── idempotence ─────────────────────────────────────────────────
  const second = run(["--yes", "init"]);
  assert(second.includes("skip"), "re-init skips existing files without --force");

  // ── check: fresh mission → gaps, exit 1 ────────────────────────
  const checkOut = run(["check"], { expectFail: true });
  assert(checkOut.includes("raw template"), "check flags untouched templates");
  assert(checkOut.includes("Current gate"), "check reports current gate");

  // ── check detects progress ──────────────────────────────────────
  writeFileSync(join(tmp, "runward/framing.md"), "# Framing: demo\n\nProblem: real. Criterion: measured on live traffic.\n");
  const check2 = run(["check"], { expectFail: true });
  assert(/1 · Frame[\s\S]*?✓|Frame[\s\S]*?Framing note/.test(check2) && !check2.split("2 · Architect")[0].includes("raw template"),
    "check marks a filled framing note");

  // ── status ──────────────────────────────────────────────────────
  const statusOut = run(["status"]);
  assert(statusOut.includes("mission status") && statusOut.includes("all 10 workflows present"), "status snapshot with workflows check");

  // ── doctor ──────────────────────────────────────────────────────
  const doctorOut = run(["doctor"], { expectFail: true }); // warnings possible (no git repo in tmp)
  assert(doctorOut.includes("mission templates") && doctorOut.includes("10 workflows"), "doctor verifies package integrity");

  // ── rules completeness ──────────────────────────────────────────
  const { readdirSync } = await import("node:fs");
  assert(readdirSync(join(tmp, "runward/rules")).length >= 46, "init lays down the 46 craft rules");

  // ── update: drift detection (workflows and rules) ───────────────
  writeFileSync(join(tmp, "runward/workflows/method.md"), "locally modified\n");
  writeFileSync(join(tmp, "runward/rules/eval-loop.md"), "locally modified\n");
  const updateOut = run(["update"]);
  assert(updateOut.includes("workflows/method.md") && updateOut.includes("rules/eval-loop.md"),
    "update detects drift in workflows and rules without overwriting");
  const updateForce = run(["update", "--force"]);
  assert(readFileSync(join(tmp, "runward/workflows/method.md"), "utf8").includes("Orchestrate"), "update --force restores the workflow");

  // ── dry-run writes nothing ──────────────────────────────────────
  const tmp2 = mkdtempSync(join(tmpdir(), "runward-dry-"));
  run(["--yes", "--dry-run", "init"], { cwd: tmp2 });
  assert(!existsSync(join(tmp2, "runward")), "init --dry-run writes nothing");
  rmSync(tmp2, { recursive: true, force: true });

  if (failures) { console.error(`\nsmoke test FAILED — ${failures} assertion(s)`); process.exit(1); }
  console.log("\nsmoke test OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
