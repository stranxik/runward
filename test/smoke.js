// Smoke test: run `runward init` in a temp dir and assert the layout.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "runward-"));

try {
  const out = execFileSync("node", [join(ROOT, "dist", "cli.js"), "init", ".", "--tools", "claude,cursor"], {
    cwd: tmp, encoding: "utf8",
  });
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
    ".claude/commands/rw-frame.md",
    ".claude/commands/rw-govern.md",
    ".cursor/rules/runward.mdc",
  ];
  const missing = expected.filter(p => !existsSync(join(tmp, p)));
  if (missing.length) {
    console.error("FAIL — missing after init:\n  " + missing.join("\n  "));
    process.exit(1);
  }
  // idempotence: second run without --force must not throw
  execFileSync("node", [join(ROOT, "dist", "cli.js"), "init"], { cwd: tmp, encoding: "utf8" });
  console.log("smoke test OK —", expected.length, "paths verified, re-init idempotent");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
