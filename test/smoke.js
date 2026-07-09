// Smoke test: init --yes, check, status, doctor, update, dry-run, idempotence.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_RULES, EXPECTED_ADAPTERS } from "../dist/lib/constants.js";

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
    "runward/shared-bricks.md",
    "runward/rules/async-post-turn-pipeline.md",
    "runward/rules/hexa-move-deterministic-out.md",
    "runward/rules/patterns-memory-router-tiered.md",
    "runward/rules/state-event-sourcing.md",
    "runward/adapters/README.md",
    "runward/adapters/pre-commit",
    "runward/adapters/github-actions.yml",
    "runward/adapters/claude-code-settings.json",
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
  writeFileSync(join(tmp, "runward/mission-contract.md"), "# Mission Contract: demo\n\nSponsor validated the criterion. DoD: measured on live traffic.\n");
  const check2 = run(["check"], { expectFail: true });
  assert(/1 · Frame[\s\S]*?✓|Frame[\s\S]*?Framing note/.test(check2) && !check2.split("2 · Architect")[0].includes("raw template"),
    "check marks a filled framing note");

  // ── status ──────────────────────────────────────────────────────
  const statusOut = run(["status"]);
  assert(statusOut.includes("mission status") && statusOut.includes("all 11 workflows present"), "status snapshot with workflows check");

  // ── doctor ──────────────────────────────────────────────────────
  const doctorOut = run(["doctor"], { expectFail: true }); // warnings possible (no git repo in tmp)
  assert(doctorOut.includes("mission templates") && doctorOut.includes("11 workflows"), "doctor verifies package integrity");

  // ── rules completeness ──────────────────────────────────────────
  const { readdirSync } = await import("node:fs");
  assert(readdirSync(join(tmp, "runward/rules")).length === EXPECTED_RULES, `init lays down the ${EXPECTED_RULES} craft rules`);
  assert(readdirSync(join(tmp, "runward/adapters")).length === EXPECTED_ADAPTERS, `init lays down the ${EXPECTED_ADAPTERS} gate adapters (ADR-0012)`);

  // ── check --strict: rule conformance across phases (ADR-0001) ───
  const strictFresh = run(["check", "--strict"], { expectFail: true });
  assert(strictFresh.includes("frontier-deterministic-boundary") && strictFresh.includes("not accounted for"),
    "check --strict flags an unaccounted floor CRITICAL rule (the incident)");
  assert(strictFresh.includes("add a row"), "check --strict violations carry an actionable fix hint");

  const badManifest = "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied |  |\n";
  writeFileSync(join(tmp, "runward/floor.md"), badManifest);
  assert(run(["check", "--strict"], { expectFail: true }).includes("applied without an evidence pointer"),
    "check --strict rejects an 'applied' row with no evidence pointer");

  // non-vacuity (ADR-0002): a placeholder n/a reason is rejected
  const trivialNa = "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | n/a | [reason] |\n";
  writeFileSync(join(tmp, "runward/floor.md"), trivialNa);
  assert(run(["check", "--strict"], { expectFail: true }).includes("placeholder reason"),
    "check --strict rejects an n/a with a placeholder reason (non-vacuity)");

  // form-lint (ADR-0003): unknown slug and duplicate rows
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-determistic-boundary | applied | src/x.ts:1 |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("unknown rule"),
    "check --strict flags an unknown rule slug (typo)");
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | src/x.ts:1 |\n| frontier-deterministic-boundary | n/a | duplicate row here |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("listed 2 times"),
    "check --strict flags a rule listed twice in the manifest");

  // drift (ADR-0004): an applied pointer that no longer resolves is flagged (advisory)
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | src/does-not-exist.ts:9 |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("does not resolve"),
    "check --strict flags a drifted applied pointer (advisory)");

  // migration record (ADR-0006): a renamed old slug is guided, not just "unknown"
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| hexa-llm-boundary-principle | applied | src/x.ts:1 |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("renamed to 'hexa-move-deterministic-out'"),
    "check --strict guides a renamed rule slug to its migration");

  // hook seam (ADR-0008): opt-in — no execution without --hooks, execution with it
  writeFileSync(join(tmp, "runward/hooks.json"), JSON.stringify({ before: ["touch HOOK_RAN"] }));
  run(["check"], { expectFail: true });
  assert(!existsSync(join(tmp, "HOOK_RAN")), "check does not run hooks without --hooks (safe by default)");
  run(["check", "--hooks"], { expectFail: true });
  assert(existsSync(join(tmp, "HOOK_RAN")), "check --hooks runs operator before-hooks");

  // the migrated example passes --strict across all mapped phases (the green end-to-end proof)
  const exStrict = run(["check", "--strict", "-p", "examples/request-triage"], { cwd: ROOT });
  assert(exStrict.includes("Architect:") && exStrict.includes("Floor:") && exStrict.includes("Govern:") && exStrict.includes("All expected deliverables are filled"),
    "example mission passes check --strict across architect/floor/govern (exit 0)");

  // ── example mission passes the gate audit ───────────────────────
  const exampleOut = run(["check", "-p", "examples/request-triage"], { cwd: ROOT });
  assert(exampleOut.includes("All expected deliverables are filled"), "example mission (request-triage) passes check with exit 0");

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

  // ── characterize: read-only inventory of an existing codebase (ADR-0014) ──
  const { execFileSync: exec } = await import("node:child_process");
  const ctmp = mkdtempSync(join(tmpdir(), "runward-char-"));
  writeFileSync(join(ctmp, "package.json"), JSON.stringify({ name: "legacy-app", dependencies: { express: "^4" }, devDependencies: { jest: "^29" }, bin: "server.js" }));
  writeFileSync(join(ctmp, "server.js"), "// entry\n");
  writeFileSync(join(ctmp, "app.test.js"), "// test\n");
  try {
    exec("git", ["-C", ctmp, "init", "-q"]);
    exec("git", ["-C", ctmp, "add", "-A"]);
    exec("git", ["-C", ctmp, "-c", "user.email=t@t.co", "-c", "user.name=t", "commit", "-qm", "init"]);
  } catch { /* git optional */ }
  const charOut = run(["characterize", "-p", ctmp]);
  const charPath = join(ctmp, "runward/characterization.md");
  assert(existsSync(charPath), "characterize writes runward/characterization.md");
  const charMd = existsSync(charPath) ? readFileSync(charPath, "utf8") : "";
  assert(charMd.includes("confidence: high") && charMd.includes("no LLM"), "characterization.md is labelled deterministic / high-confidence");
  assert(charMd.includes("express"), "characterize lists runtime dependencies");
  assert(charMd.includes("server.js"), "characterize detects the declared entrypoint");
  assert(charMd.includes("Test files (by naming convention): **1**"), "characterize counts test files");
  assert(charMd.includes("not a git repository") === false && /Commits: \*\*1\*\*/.test(charMd), "characterize reads git-log shape");
  assert(charOut.toLowerCase().includes("hypothesis") && charOut.includes("Next steps"), "characterize prints operator next-steps (transmission surface)");
  const stray = readdirSync(ctmp).filter((f) => !["package.json", "server.js", "app.test.js", "runward", ".git"].includes(f));
  assert(stray.length === 0, "characterize writes only into runward/ (read-only elsewhere)");
  assert(run(["characterize", "-p", join(ctmp, "nope")], { expectFail: true }).includes("No readable directory"), "characterize exits non-zero on a missing target");
  rmSync(ctmp, { recursive: true, force: true });

  if (failures) { console.error(`\nsmoke test FAILED — ${failures} assertion(s)`); process.exit(1); }
  console.log("\nsmoke test OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
