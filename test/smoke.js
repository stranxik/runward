// Smoke test: init --yes, check, status, doctor, update, dry-run, idempotence.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
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
    "runward/gap-analysis.md",
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
  assert(statusOut.includes("Phase progress") && statusOut.includes("← you are here") && /Next\b/.test(statusOut) && /runward (check|compliance)/.test(statusOut),
    "status shows phase progress, the current gate, and names the next gesture (transmission surface)");
  // regression: status -p <absolute> from a different cwd must resolve the mission (join→resolve)
  assert(run(["status", "-p", tmp], { cwd: ROOT }).includes("mission status"), "status -p <absolute-path> resolves the mission");

  // ── doctor ──────────────────────────────────────────────────────
  const doctorOut = run(["doctor"], { expectFail: true }); // warnings possible (no git repo in tmp)
  assert(doctorOut.includes("mission templates") && doctorOut.includes("11 workflows"), "doctor verifies package integrity");

  // ── rules completeness ──────────────────────────────────────────
  const { readdirSync } = await import("node:fs");
  assert(readdirSync(join(tmp, "runward/rules")).length === EXPECTED_RULES, `init lays down the ${EXPECTED_RULES} craft rules`);
  assert(readdirSync(join(tmp, "runward/adapters")).length === EXPECTED_ADAPTERS, `init lays down the ${EXPECTED_ADAPTERS} gate adapters (ADR-0012)`);
  // every OWASP ASI control (ASI01..ASI10) is covered by at least one shipped rule (full agentic-risk coverage)
  const asiSeen = new Set();
  for (const f of readdirSync(join(tmp, "runward/rules"))) {
    const m = readFileSync(join(tmp, "runward/rules", f), "utf8").match(/asi:\s*\[([^\]]+)\]/);
    if (m) for (const c of m[1].match(/ASI\d\d/g) ?? []) asiSeen.add(c);
  }
  assert(asiSeen.size === 10 && [...Array(10)].every((_, i) => asiSeen.has(`ASI${String(i + 1).padStart(2, "0")}`)),
    "the shipped rules cover all 10 OWASP ASI controls (ASI01..ASI10)");
  // phase skills (ADR-0018): opt-in relevance-loaded application adapters, subordinated to the gate
  const archSkill = join(tmp, ".claude/skills/runward-architect/SKILL.md");
  assert(existsSync(archSkill), "init emits Claude Code phase skills (.claude/skills/runward-<phase>/SKILL.md)");
  const skillTxt = readFileSync(archSkill, "utf8");
  assert(skillTxt.includes("name: runward-architect") && /check --strict.*sole authority/i.test(skillTxt),
    "the phase skill is a SKILL.md subordinated to the gate (check --strict is the sole authority)");
  assert(existsSync(join(tmp, ".cursor/rules/runward-govern.mdc")) && existsSync(join(tmp, ".windsurf/rules/runward-govern.md")),
    "phase skills ship in each relevance-capable harness's native idiom (Cursor Agent-Requested, Windsurf Model-Decision)");
  assert(!existsSync(join(tmp, ".github/skills")) && !existsSync(join(tmp, ".gemini/skills")),
    "no phase skill for Copilot/Gemini (no relevance mechanism — AGENTS.md + globs is their ceiling)");

  // ── check --strict: rule conformance across phases (ADR-0001) ───
  const strictFresh = run(["check", "--strict"], { expectFail: true });
  assert(strictFresh.includes("frontier-deterministic-boundary") && strictFresh.includes("not accounted for"),
    "check --strict flags an unaccounted floor CRITICAL rule (the incident)");
  assert(strictFresh.includes("add a row"), "check --strict violations carry an actionable fix hint");
  assert(strictFresh.includes("topology-port-placement-mapped") && strictFresh.includes("Topology"),
    "check --strict gates the execution-topology deliverable (ADR-0017 app/infra double vision)");

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

  // reconstruction lifecycle (ADR-0013/0014): an unratified DRAFT/hypothesis ADR fails --strict
  writeFileSync(join(tmp, "runward/adr/DRAFT-legacy-boundary.md"), "# DRAFT: legacy boundary\n\n**Status**: hypothesis\n\nwhy: UNKNOWN\n");
  const lifeOut = run(["check", "--strict"], { expectFail: true });
  assert(lifeOut.includes("Reconstruction lifecycle") && lifeOut.includes("DRAFT-legacy-boundary.md"),
    "check --strict flags an unratified DRAFT/hypothesis ADR (a hypothesis is not a decision)");
  rmSync(join(tmp, "runward/adr/DRAFT-legacy-boundary.md"));
  writeFileSync(join(tmp, "runward/adr/ADR-0007-legacy-boundary.md"),
    "# ADR-0007: legacy boundary\n\n**Status**: accepted\n\n## Decision\nThe why, ratified by the operator.\n\n## Reevaluation trigger\nWhen the anticorruption adapter is removed.\n");
  assert(!run(["check", "--strict"], { expectFail: true }).includes("Reconstruction lifecycle"),
    "ratifying the ADR (accepted, no hypothesis/DRAFT markers) clears the lifecycle gap");

  // coverage report (ADR-0013): advisory ratios of deliverables + ratified decisions
  const covOut = run(["check", "--coverage"], { expectFail: true });
  assert(covOut.includes("Documentation coverage") && /Deliverables\s+\d+\/\d+ filled/.test(covOut) && /Decisions\s+1\/1 ratified/.test(covOut),
    "check --coverage reports deliverable and decision-ratification ratios (advisory)");

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
  assert(exStrict.includes("Semantic check") && exStrict.includes("verify workflow"),
    "a green --strict surfaces the advisory verify workflow (ADR-0007 cite-vs-apply discoverability)");

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
  // --mine: deterministic candidate DRAFT ADRs (ADR-0014 piece 4, no model call)
  run(["characterize", "--mine", "-p", ctmp]);
  assert(existsSync(join(ctmp, "runward/adr/DRAFT-dep-express.md")) && existsSync(join(ctmp, "runward/adr/DRAFT-stack-node.md")),
    "characterize --mine proposes candidate DRAFT ADRs (deterministic git archaeology)");
  const draft = existsSync(join(ctmp, "runward/adr/DRAFT-dep-express.md")) ? readFileSync(join(ctmp, "runward/adr/DRAFT-dep-express.md"), "utf8") : "";
  assert(draft.includes("**Status**: hypothesis") && draft.includes("why: UNKNOWN"),
    "mined DRAFTs are hypotheses with why: UNKNOWN — not decisions (the lifecycle gate is proven above)");
  rmSync(ctmp, { recursive: true, force: true });

  // ── compliance: deterministic ISO 42001 readiness draft (ADR-0016) ──
  run(["compliance", "iso-42001"], { cwd: tmp });
  const compPath = join(tmp, "runward/compliance/iso-42001-readiness.md");
  assert(existsSync(compPath), "compliance iso-42001 writes the readiness draft");
  const compMd = existsSync(compPath) ? readFileSync(compPath, "utf8") : "";
  assert(compMd.includes("assessment-readiness draft") && compMd.includes("not a compliance claim"),
    "the draft is labelled a readiness draft, never a compliance claim");
  assert(compMd.includes("Agentic-risk coverage (OWASP ASI") && /ASI0[1-9] \|/.test(compMd) && compMd.includes("Required from the operator"),
    "the draft assembles ASI coverage from rules and lists the operator-required sections");
  assert(!compMd.includes("ISO 42001 certified") && !/you are (compliant|certified)/i.test(compMd),
    "the draft never claims compliant/certified");
  // OSCAL export (ADR-0016 piece 2): machine-readable component-definition
  const oscalPath = join(tmp, "runward/compliance/oscal-component-definition.json");
  assert(existsSync(oscalPath), "compliance emits an OSCAL component-definition");
  const oscal = existsSync(oscalPath) ? JSON.parse(readFileSync(oscalPath, "utf8")) : {};
  const cd = oscal["component-definition"];
  assert(cd && cd.metadata["oscal-version"] && cd.metadata.remarks.includes("NOT a compliance claim"),
    "the OSCAL is a component-definition labelled a draft, never a compliance claim");
  const irs = cd ? cd.components[0]["control-implementations"][0]["implemented-requirements"] : [];
  assert(irs.length === 10 && irs.every((r) => /^asi-\d\d$/.test(r["control-id"]) && r.props[0].name === "implementation-status"),
    "the OSCAL carries the 10 ASI controls with implementation-status (deterministic interop layer)");
  assert(run(["compliance"], { cwd: tmp, expectFail: true }).includes("Usage: runward compliance"),
    "compliance with no regime exits with usage (exit 2)");
  assert(run(["compliance", "soc2"], { cwd: tmp, expectFail: true }).includes("Usage: runward compliance"),
    "an unknown regime exits 2 with usage");
  for (const [reg, file, marker] of [["nist-ai-rmf", "nist-ai-rmf-readiness.md", "NIST AI RMF"], ["eu-ai-act", "eu-ai-act-readiness.md", "Annex IV"]]) {
    run(["compliance", reg], { cwd: tmp });
    const p = join(tmp, "runward/compliance", file);
    const md = existsSync(p) ? readFileSync(p, "utf8") : "";
    assert(existsSync(p) && md.includes("assessment-readiness draft") && md.includes(marker) && !/you are (compliant|certified)/i.test(md),
      `compliance ${reg} writes a readiness draft (${marker}), never a compliance claim`);
  }

  // the topology conformance (ADR-0017) now feeds the compliance pack — run on the filled example (copied, so the repo stays clean)
  const compEx = mkdtempSync(join(tmpdir(), "runward-comp-"));
  cpSync(join(ROOT, "examples/request-triage"), compEx, { recursive: true });
  run(["compliance", "iso-42001", "-p", compEx], { cwd: ROOT });
  const compExMd = readFileSync(join(compEx, "runward/compliance/iso-42001-readiness.md"), "utf8");
  assert(/topology-(port-placement-mapped|sovereignty-by-data-class|trace-export-decision|usage-registry-present)/.test(compExMd),
    "the compliance pack reads the execution-topology manifest (ADR-0017 topology phase feeds ADR-0016 evidence)");
  rmSync(compEx, { recursive: true, force: true });

  // init --example lays down the filled reference mission: the whole chain is green out of the box
  const exTmp = mkdtempSync(join(tmpdir(), "runward-example-"));
  run(["--yes", "init", "--example", "--tools", "claude"], { cwd: exTmp });
  const exampleFraming = readFileSync(join(exTmp, "runward/framing.md"), "utf8");
  assert(exampleFraming.includes("Inbound Request Triage"),
    "init --example writes the FILLED reference framing, not a blank template");
  const exampleStrict = run(["check", "--strict"], { cwd: exTmp });
  assert(exampleStrict.includes("All expected deliverables are filled") && exampleStrict.includes("all gates passed"),
    "init --example passes check --strict green out of the box (filled reference)");
  rmSync(exTmp, { recursive: true, force: true });

  if (failures) { console.error(`\nsmoke test FAILED — ${failures} assertion(s)`); process.exit(1); }
  console.log("\nsmoke test OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
