// Smoke test: init --yes, check, status, doctor, update, dry-run, idempotence.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_RULES, EXPECTED_ADAPTERS } from "../dist/lib/constants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "runward-"));
let failures = 0;

function run(args, { expectFail = false, cwd = tmp, env2 = {} } = {}) {
  try {
    return execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...env2 } });
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
  const initOut = run(["--yes", "init", "--tools", "claude,cursor,copilot,gemini,windsurf,kiro"]);
  const expected = [
    "AGENTS.md",
    "runward/framing.md",
    "runward/architecture.md",
    "runward/floor.md",
    "runward/handover.md",
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
    "runward/adapters/gitlab-ci.yml",
    "runward/adapters/kiro-hooks.json",
    "runward/adapters/bmad-review-layer.toml",
    "runward/adapters/claude-code-settings.json",
    ".claude/commands/rw-frame.md",
    ".claude/commands/rw-govern.md",
    ".cursor/rules/runward.mdc",
    ".github/copilot-instructions.md",
    "GEMINI.md",
    ".windsurf/rules/runward.md",
    ".kiro/steering/runward-architect.md",
  ];
  assert(expected.every((p) => existsSync(join(tmp, p))), `init lays down ${expected.length} paths (6 tool profiles)`);

  // ── neutral default (ADR-0030): init --yes with NO --tools writes only the baseline ──
  const neutralTmp = mkdtempSync(join(tmpdir(), "runward-neutral-"));
  run(["--yes", "init"], { cwd: neutralTmp });
  assert(existsSync(join(neutralTmp, "AGENTS.md")), "neutral init writes the AGENTS.md charter");
  assert(existsSync(join(neutralTmp, ".agents/skills/runward-architect/SKILL.md")),
    "neutral init writes the vendor-neutral phase skills");
  assert(!existsSync(join(neutralTmp, ".claude")) && !existsSync(join(neutralTmp, ".cursor")) && !existsSync(join(neutralTmp, "GEMINI.md")),
    "neutral init privileges no harness — no .claude/.cursor/GEMINI.md without explicit --tools");
  rmSync(neutralTmp, { recursive: true, force: true });

  // ── check --json (ADR-0030): a stable machine contract, parseable, no human noise ──
  const jsonOut = run(["check", "--json"], { expectFail: true }); // exit 1 expected (blank mission has gaps)
  let parsed;
  try { parsed = JSON.parse(jsonOut); } catch { parsed = null; }
  assert(parsed && parsed.runward && typeof parsed.currentGate === "string" && Array.isArray(parsed.deliverables),
    "check --json emits a single parseable object with runward/currentGate/deliverables");
  assert(parsed && (parsed.verdict === "gaps" || parsed.verdict === "clean") && typeof parsed.exitCode === "number",
    "check --json carries a verdict and exit code");
  assert(parsed && !("conformance" in parsed),
    "check --json without --strict omits the conformance field (spread is conditional)");
  const jsonStrictOut = run(["check", "--json", "--strict"], { expectFail: true });
  let parsedStrict;
  try { parsedStrict = JSON.parse(jsonStrictOut); } catch { parsedStrict = null; }
  assert(parsedStrict && parsedStrict.strict === true && Array.isArray(parsedStrict.conformance),
    "check --json --strict exposes the conformance array");

  // ── wire (ADR-0030): read-only harness→channel recommendation, never writes ──
  const wireOut = run(["wire", "--json"]);
  let wired;
  try { wired = JSON.parse(wireOut); } catch { wired = null; }
  assert(wired && typeof wired.status === "string" && Array.isArray(wired.candidateChannels),
    "wire --json emits a detection status and candidate channels");
  assert(wired && wired.wires === false,
    "wire never wires — the wires:false invariant holds (ADR-0012)");
  // Kiro steering mirror (ADR-0018 amendment): relevance idiom is inclusion: auto + name + description
  const kiroSteering = readFileSync(join(tmp, ".kiro/steering/runward-architect.md"), "utf8");
  assert(kiroSteering.includes("inclusion: auto") && kiroSteering.includes("name: runward-architect") && /check --strict.*sole authority/i.test(kiroSteering),
    "the Kiro steering mirror is relevance-loaded (inclusion: auto) and subordinate to the gate");
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
  assert(readdirSync(join(tmp, "runward/adapters")).filter((f) => f !== "README.md").length === EXPECTED_ADAPTERS, `init lays down the ${EXPECTED_ADAPTERS} gate adapters (ADR-0012)`);
  // every OWASP ASI control (ASI01..ASI10) is covered by at least one shipped rule (full agentic-risk coverage)
  const asiSeen = new Set();
  for (const f of readdirSync(join(tmp, "runward/rules"))) {
    const m = readFileSync(join(tmp, "runward/rules", f), "utf8").match(/asi:\s*\[([^\]]+)\]/);
    if (m) for (const c of m[1].match(/ASI\d\d/g) ?? []) asiSeen.add(c);
  }
  assert(asiSeen.size === 10 && [...Array(10)].every((_, i) => asiSeen.has(`ASI${String(i + 1).padStart(2, "0")}`)),
    "the shipped rules cover all 10 OWASP ASI controls (ASI01..ASI10)");
  // phase skills (ADR-0018): the vendor-neutral .agents/skills seam is always written, subordinate to the gate
  const neutralSkill = join(tmp, ".agents/skills/runward-architect/SKILL.md");
  assert(existsSync(neutralSkill), "init always writes the vendor-neutral phase skills (.agents/skills/runward-<phase>/SKILL.md)");
  const skillTxt = readFileSync(neutralSkill, "utf8");
  assert(skillTxt.includes("name: runward-architect") && /check --strict.*sole authority/i.test(skillTxt),
    "the phase skill is a SKILL.md subordinated to the gate (check --strict is the sole authority)");
  assert(existsSync(join(tmp, ".claude/skills/runward-govern/SKILL.md")),
    "the claude profile mirrors the phase skills to .claude/skills (Claude Code's native path)");
  // the redundant per-harness phase files are gone: Cursor/Windsurf read the .agents/skills alias
  assert(!existsSync(join(tmp, ".cursor/rules/runward-govern.mdc")),
    "no per-phase Cursor/Windsurf files — the .agents/skills alias covers them (no duplication)");
  // v0.14.1: the emitted SKILL.md frontmatter is valid STRICT YAML. The description embeds the
  // relevance trigger, which carries a colon (and an apostrophe); unquoted, a spec-conformant
  // parser (PyYAML safe_load, js-yaml) rejected all four skills. Parse them for real.
  const { load: yamlLoad, JSON_SCHEMA } = await import("js-yaml");
  for (const phase of ["architect", "topology", "floor", "govern", "handover"]) {
    const fm = readFileSync(join(tmp, `.agents/skills/runward-${phase}/SKILL.md`), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    let parsed = null; try { parsed = yamlLoad(fm, { schema: JSON_SCHEMA }); } catch { /* invalid YAML → parsed stays null */ }
    assert(parsed && parsed.name === `runward-${phase}` && typeof parsed.description === "string",
      `the ${phase} SKILL.md frontmatter parses as strict YAML (name + description)`);
  }

  // ── check --strict: rule conformance across phases (ADR-0001) ───
  const strictFresh = run(["check", "--strict"], { expectFail: true });
  assert(strictFresh.includes("frontier-deterministic-boundary") && strictFresh.includes("not accounted for"),
    "check --strict flags an unaccounted floor CRITICAL rule (the incident)");
  // The hint must name the GESTURE and hand the decision back: `manifest --sync` scaffolds the row,
  // and the operator still chooses applied | deviated | n/a. Asserted on those two halves rather
  // than on a sentence, so improving the wording does not red the smoke while weakening it would.
  assert(strictFresh.includes("runward manifest --sync") && strictFresh.includes("the decision stays yours"),
    "check --strict violations name the gesture AND leave the decision to the operator");
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
    "check --strict flags a drifted applied pointer (blocking under --strict, ADR-0021)");

  // evidence hardening (ADR-0019/0020): typed pointers, pointed-content non-vacuity, signatures
  writeFileSync(join(tmp, "empty-evidence.ts"), "");
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | file:empty-evidence.ts |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("empty file"),
    "check --strict rejects a typed pointer at an empty file (non-vacuity of the pointed content)");
  writeFileSync(join(tmp, "plain-impl.ts"), "export const x = 1;\n");
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | file:plain-impl.ts |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes("signature"),
    "check --strict rejects a signed rule whose evidence lacks the rule's shape (ADR-0020)");
  writeFileSync(join(tmp, "guard-impl.ts"), "export function assertGrounded() { /* fail-closed */ }\n");
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | file:guard-impl.ts#assertGrounded |\n");
  const evOut = run(["check", "--strict"], { expectFail: true }); // other floor rules still unaccounted — red, but not on this row
  assert(!evOut.includes("signature") && !evOut.includes('symbol "'),
    "a typed pointer at real guard-shaped evidence satisfies the signed rule (ADR-0019/0020)");
  writeFileSync(join(tmp, "runward/floor.md"), "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| frontier-deterministic-boundary | applied | file:guard-impl.ts#missingSym |\n");
  assert(run(["check", "--strict"], { expectFail: true }).includes('symbol "missingSym" not found'),
    "a typed pointer whose symbol vanished fails check --strict (precise drift)");

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
  assert(exStrict.includes("Architect:") && exStrict.includes("Floor:") && exStrict.includes("Govern:") && exStrict.includes("Handover:") && exStrict.includes("All expected deliverables are filled"),
    "example mission passes check --strict across architect/floor/govern/handover (exit 0)");
  assert(exStrict.includes("Semantic check") && exStrict.includes("verify workflow"),
    "a green --strict surfaces the advisory verify workflow (ADR-0007 cite-vs-apply discoverability)");
  assert(exStrict.includes("no verify findings recorded yet") && exStrict.includes("verify-findings.md"),
    "a green --strict names the verify-findings artifact it would surface (ADR-0007 amendment: presence/freshness, never a verdict)");

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
  // ADR-0034 (whole-tree scan) + ADR-0035 (offline pin extraction): a nested sub-package and a
  // lockfile, so both render end-to-end through the real CLI, not only in the unit parsers.
  mkdirSync(join(ctmp, "packages", "api"), { recursive: true });
  writeFileSync(join(ctmp, "packages/api/package.json"), JSON.stringify({ name: "api" }));
  writeFileSync(join(ctmp, "package-lock.json"), JSON.stringify({
    name: "legacy-app", lockfileVersion: 3,
    packages: { "": { name: "legacy-app" }, "node_modules/express": { version: "4.18.2" }, "node_modules/jest": { version: "29.7.0" } },
  }));
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
  assert(charMd.includes("## Sub-packages / workspaces") && charMd.includes("packages/api"), "characterize sees the whole tree: a nested sub-package is surfaced (ADR-0034)");
  assert(/## Pinned versions/.test(charMd) && charMd.includes("express@4.18.2"), "characterize extracts pinned versions from the lockfile, offline (ADR-0035)");
  const stray = readdirSync(ctmp).filter((f) => !["package.json", "package-lock.json", "packages", "server.js", "app.test.js", "runward", ".git"].includes(f));
  assert(stray.length === 0, "characterize writes only into runward/ (read-only elsewhere)");
  assert(run(["characterize", "-p", join(ctmp, "nope")], { expectFail: true }).includes("No readable directory"), "characterize exits non-zero on a missing target");
  // --mine: deterministic candidate DRAFT ADRs (ADR-0014 piece 4, no model call).
  // ADR-0038: dependency DRAFTs are grouped one-per-family (DRAFT-deps-<family>), not one-per-dep.
  run(["characterize", "--mine", "-p", ctmp]);
  const familyDraft = join(ctmp, "runward/adr/DRAFT-deps-web-framework-ui.md");
  assert(existsSync(familyDraft) && existsSync(join(ctmp, "runward/adr/DRAFT-stack-node.md")),
    "characterize --mine proposes candidate DRAFT ADRs (deterministic git archaeology)");
  const draft = existsSync(familyDraft) ? readFileSync(familyDraft, "utf8") : "";
  assert(draft.includes("**Status**: hypothesis") && draft.includes("why: UNKNOWN") && draft.includes("express"),
    "mined DRAFTs are hypotheses with why: UNKNOWN, family members as evidence — not decisions (the lifecycle gate is proven above)");
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
  // --regime-version: the lens is versioned data (ADR-0022)
  assert(run(["compliance", "iso-42001", "--regime-version", "1999"], { cwd: tmp, expectFail: true }).includes("Shipped versions: 2023"),
    "an unknown --regime-version exits 2 listing the shipped versions");
  run(["compliance", "iso-42001", "--regime-version", "2023"], { cwd: tmp });
  const pinnedMd = readFileSync(compPath, "utf8");
  const pinnedOscal = JSON.parse(readFileSync(oscalPath, "utf8"));
  assert(pinnedMd.includes("Lens: ISO/IEC 42001 (mapping version 2023)")
    && (pinnedOscal["component-definition"].metadata.props ?? []).some((p) => p.name === "runward-regime-lens" && p.value === "iso-42001@2023"),
    "an explicit --regime-version stamps the lens into the draft header and the OSCAL metadata props");

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
  // the reference ships its FINALIZED charter (ADR-0026), not the scaffold text
  assert(readFileSync(join(exTmp, "AGENTS.md"), "utf8").includes("finalized leave-behind"),
    "init --example lays down the reference's finalized AGENTS.md, not the scaffolded charter");
  assert(exampleFraming.includes("Inbound Request Triage"),
    "init --example writes the FILLED reference framing, not a blank template");
  const exampleStrict = run(["check", "--strict"], { cwd: exTmp });
  assert(exampleStrict.includes("All expected deliverables are filled") && exampleStrict.includes("all gates passed"),
    "init --example passes check --strict green out of the box (filled reference)");
  // 4.2: the two proofs made legible — the gate names the behavioral proof it did not run (never a runtime)
  assert(exampleStrict.includes("Behavioral proof") && exampleStrict.includes("documentary proof") &&
    exampleStrict.includes("did not run your code") && /prove behavior with:\s*cd code && npm test/.test(exampleStrict),
    "green --strict surfaces the behavioral proof pointer (advisory, read-only, never executed)");
  // ADR-0033: on a steady-state mission (all gates filled), status names the real lifecycle
  // position — the iterate posture and the Reopening watch parsed from the accepted ADRs.
  const exStatus = run(["status"], { cwd: exTmp });
  assert(exStatus.includes("steady-state"), "status names the iterate steady-state, not a bare 'all gates passed'");
  assert(/Iterate — continuous improvement/.test(exStatus) && exStatus.includes("you are here"),
    "the real 'you are here' is the iterate posture on a steady-state mission");
  assert(exStatus.includes("Reopening watch"), "the Reopening watch renders on a mission with accepted ADRs");
  rmSync(exTmp, { recursive: true, force: true });

  // ── gate integrity (audit remediation, v0.14.0) ─────────────────
  // CLI misuse (a typo, an unknown flag) exits 2 — distinct from exit 1 "the gate has gaps" —
  // so CI can tell an operator error from a real failure. Help and version exit 0.
  const code = (args, cwd = tmp) => {
    try { execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }); return 0; }
    catch (e) { return e.status; }
  };
  assert(code(["frobnicate"]) === 2, "an unknown command exits 2 (CLI misuse, not a gate failure)");
  assert(code(["check", "--bogus-flag"]) === 2, "an unknown option on a subcommand exits 2 (exitOverride reaches subcommands)");
  assert(code(["init", "--tools"]) === 2, "a missing option-argument exits 2");
  assert(code(["--version"]) === 0 && code(["--help"]) === 0 && code(["check", "--help"]) === 0, "--version / --help / subcommand --help exit 0");

  // ── drift blocking + evidence sealing (ADR-0021) ────────────────
  const codeIn = (args, cwd) => { try { execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }); return 0; } catch (e) { return e.status; } };
  const driftEx = mkdtempSync(join(tmpdir(), "runward-driftex-"));
  cpSync(join(ROOT, "examples/request-triage"), driftEx, { recursive: true });
  const flPath = join(driftEx, "runward/floor.md");
  writeFileSync(flPath, readFileSync(flPath, "utf8").replace("code/src/core/domain/guard.ts", "code/src/core/domain/gone.ts"));
  assert(codeIn(["check", "--strict"], driftEx) === 1, "one stale applied pointer turns a green mission red (drift blocking, ADR-0021)");
  rmSync(driftEx, { recursive: true, force: true });

  const sealEx = mkdtempSync(join(tmpdir(), "runward-seal-"));
  cpSync(join(ROOT, "examples/request-triage"), sealEx, { recursive: true });
  assert(codeIn(["check", "--freeze"], sealEx) === 0 && existsSync(join(sealEx, "runward/evidence-lock.json")),
    "check --freeze seals a green gate into runward/evidence-lock.json");
  assert(run(["check", "--strict"], { cwd: sealEx }).includes("seal intact"), "check --strict verifies an intact seal");
  const sealedFile = join(sealEx, "code/src/core/domain/guard.ts");
  writeFileSync(sealedFile, readFileSync(sealedFile, "utf8") + "\n// tampered\n");
  assert(run(["check", "--strict"], { cwd: sealEx, expectFail: true }).includes("sealed evidence changed"),
    "a sealed evidence file that changed fails check --strict");
  assert(codeIn(["check", "--freeze"], sealEx) === 0, "re-sealing after re-verification succeeds (freeze replaces the seal)");
  rmSync(sealEx, { recursive: true, force: true });
  const redEx = mkdtempSync(join(tmpdir(), "runward-redgate-"));
  run(["--yes", "init"], { cwd: redEx });
  assert(run(["check", "--freeze"], { cwd: redEx, expectFail: true }).includes("refusing to seal"),
    "check --freeze refuses to seal a red gate");
  rmSync(redEx, { recursive: true, force: true });

  const gi = mkdtempSync(join(tmpdir(), "runward-gi-"));
  run(["--yes", "init"], { cwd: gi });
  // divergence guard: a one-byte edit to a low-placeholder template (decision-matrix) must not pass as filled
  const dm = join(gi, "runward/decision-matrix.md");
  writeFileSync(dm, readFileSync(dm, "utf8") + "x");
  // The guard is about the STATE, not the sentence: a one-byte edit must not read as filled. The
  // note beside it names which of the two in-progress causes fired — and for a low-placeholder
  // template like the decision matrix it is the divergence floor, not placeholders, which is why
  // this assertion accepts that wording rather than the one that used to be printed for both.
  assert(/Decision matrix[^\n]*(raw template|placeholders remain|too close to the template)/.test(run(["check"], { cwd: gi, expectFail: true })),
    "a one-byte edit does not pass a low-placeholder deliverable as filled (divergence guard)");
  // an ADR whose name merely contains 0000 (ADR-0021-…-10000-ms) is a real ADR, not dropped
  writeFileSync(join(gi, "runward/adr/ADR-0021-timeout-10000-ms.md"), "# ADR-0021: timeout\n\n**Status**: accepted\n\n## Decision\nx\n");
  assert(/ADRs\s+1\b/.test(run(["check"], { cwd: gi, expectFail: true })),
    "an ADR whose name contains 0000 (10000-ms) is counted, not dropped (mission/status/conformance agree)");
  // non-vacuity at zero: stripping a phase's rule mapping to empty still fails --strict (not silently skipped)
  for (const f of readdirSync(join(gi, "runward/rules"))) {
    const p = join(gi, "runward/rules", f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/^phases:.*$/m, "phases: []"));
  }
  const nv = run(["check", "--strict"], { cwd: gi, expectFail: true });
  assert(nv.includes("(mapping)") && nv.includes("stripped"),
    "stripping a phase's rule mapping to zero still fails --strict (non-vacuity floor, ADR-0002)");
  rmSync(gi, { recursive: true, force: true });
  // the frame/architect workflows now name every gated deliverable they must produce (no uncloseable gate)
  assert(readFileSync(join(ROOT, "templates/workflows/frame.md"), "utf8").includes("mission-contract.md"),
    "the frame workflow names the steering contract (mission-contract.md) it must produce");
  assert(readFileSync(join(ROOT, "templates/workflows/architect.md"), "utf8").includes("decision-matrix.md"),
    "the architect workflow names the decision-matrix it must produce");

  // ── evidence hardening v0.17 (audit remediation): traversal, ReDoS, RUNWARD_NOW validation ──
  const hz = mkdtempSync(join(tmpdir(), "runward-hz-"));
  cpSync(join(ROOT, "examples/request-triage"), hz, { recursive: true });
  // an absolute or ../-escaping evidence pointer no longer resolves (ADR-0019 containment)
  const hzFloor = join(hz, "runward/floor.md");
  writeFileSync(hzFloor, readFileSync(hzFloor, "utf8").replace("file:code/src/core/domain/guard.ts#guardFields", "file:/etc/hosts"));
  assert(run(["check", "--strict"], { cwd: hz, expectFail: true }).includes("does not resolve"),
    "an absolute evidence path is rejected, not resolved outside the project (traversal guard)");
  // a malformed RUNWARD_NOW falls back to today instead of emitting schema-invalid OSCAL
  const hz2 = mkdtempSync(join(tmpdir(), "runward-now-"));
  run(["--yes", "init"], { cwd: hz2 });
  run(["compliance", "eu-ai-act"], { cwd: hz2, env2: { RUNWARD_NOW: "not-a-date" } });
  const nowOscal = JSON.parse(readFileSync(join(hz2, "runward/compliance/oscal-component-definition.json"), "utf8"));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(nowOscal["component-definition"].metadata.version),
    "a malformed RUNWARD_NOW falls back to a valid date (never schema-invalid OSCAL)");
  rmSync(hz, { recursive: true, force: true });
  rmSync(hz2, { recursive: true, force: true });

  // ── manifest --sync + rules/explain (ADR-0023/0024) ─────────────
  const msTmp = mkdtempSync(join(tmpdir(), "runward-msync-"));
  run(["--yes", "init"], { cwd: msTmp });
  const msOverview = run(["manifest"], { cwd: msTmp });
  assert(msOverview.includes("not accounted for") && msOverview.includes("--sync scaffolds"),
    "manifest (read-only) reports the missing expected rows per gated deliverable");
  run(["manifest", "--sync"], { cwd: msTmp });
  const msFloor = readFileSync(join(msTmp, "runward/floor.md"), "utf8");
  assert(msFloor.includes("| frontier-deterministic-boundary |  |  |") && !msFloor.includes("[rule-slug]"),
    "manifest --sync scaffolds empty-status rows and retires the template placeholder");
  assert(run(["check", "--strict"], { cwd: msTmp, expectFail: true }).includes("status not set"),
    "a scaffolded row is refused by the gate until the operator decides (form, never content)");
  assert(run(["manifest", "--sync"], { cwd: msTmp }).includes("in sync"),
    "manifest --sync is idempotent (second run: tables in sync)");
  const rulesJson = JSON.parse(run(["rules", "--json"], { cwd: msTmp }));
  assert(rulesJson.count === EXPECTED_RULES && rulesJson.rules.every((r, i, a) => !i || a[i - 1].slug <= r.slug) && rulesJson.rules.every((r) => r.slug && r.impact),
    "rules --json is the sorted, versioned machine contract over the effective rule set");
  // A misspelled (or simply non-gated) phase is operator misuse, not an empty result: it used to
  // exit 0 with zero rules, indistinguishable in a CI step from "nothing applies here".
  const badPhase = run(["rules", "--phase", "iterate"], { cwd: msTmp, expectFail: true });
  assert(badPhase.includes('Unknown phase "iterate"') && badPhase.includes("handover"),
    "an unknown phase exits non-zero and names the gated phases (never a silent empty set)");
  assert(JSON.parse(run(["rules", "--json", "--phase", "govern"], { cwd: msTmp })).rules.every((r) => r.phases.includes("govern")),
    "a valid phase still filters the machine contract");
  // ADR-0041: `--for` is a reading, never a verdict — it always exits 0, renders the pattern that
  // matched, and reports the rules it could not evaluate rather than answering a bare "nothing".
  const forJson = JSON.parse(run(["rules", "--json", "--for", "src/cron/runner.ts"], { cwd: msTmp }));
  assert(forJson.rules.some((r) => r.slug === "async-job-guardrails" && r.matchedBy[0].pattern.includes("cron")),
    "rules --for surfaces the rule whose declared territory covers the path, with the pattern that matched");
  assert(forJson.selector.for[0] === "src/cron/runner.ts" && forJson.unscoped.count > 0 && forJson.unscoped.note.includes("never masking"),
    "the envelope echoes the selector and reports the unscoped rules with the standing caveat");
  const forNone = run(["rules", "--for", "docs/nothing-here.md"], { cwd: msTmp });
  assert(forNone.includes("no rule declares a territory") && forNone.includes("of 64"),
    "an empty match exits 0 and says how many rules were not evaluated (never a bare 'nothing')");
  // An empty answer must be readable: it renders the patterns that were evaluated, so the reader
  // can see the rule set looked for conventions their layout does not use — a fact about the rules,
  // never a claim about a tree runward has not read.
  assert(forNone.includes("What was looked for") && forNone.includes("**/cron/**"),
    "an empty match renders the declared territories verbatim, so the silence becomes a fact");
  assert(JSON.parse(run(["rules", "--json", "--for", "docs/nothing-here.md"], { cwd: msTmp })).territories.patterns.includes("**/config/**"),
    "the machine surface carries the same vocabulary (additive envelope field)");
  assert(run(["rules", "--for", "/etc/passwd"], { cwd: msTmp, expectFail: true }).includes("project-relative"),
    "an absolute path is 'the question could not be asked' (exit 2), never a silent empty answer");
  const explainOut = run(["explain", "frontier-deterministic-boundary"], { cwd: msTmp });
  assert(explainOut.includes("Why") && explainOut.includes("Signature") && explainOut.includes("The model writes prose"),
    "explain prints the rule's contract (why, signature) and its full body inline");
  assert(run(["explain", "hexa-llm-boundary-principle"], { cwd: msTmp, expectFail: true }).includes("renamed to 'hexa-move-deterministic-out'"),
    "explain answers a renamed slug with its migration (ADR-0006)");
  rmSync(msTmp, { recursive: true, force: true });

  // ── transmission surface (v0.14.2): every command names the next gesture ──
  const ts = mkdtempSync(join(tmpdir(), "runward-ts-"));
  run(["--yes", "init"], { cwd: ts });
  const tsCheck = run(["check"], { cwd: ts, expectFail: true });
  assert(tsCheck.includes("Next") && /Fill the deliverable/.test(tsCheck) && /runward check/.test(tsCheck),
    "check names the next gesture (fill the deliverables, re-run check)");
  const tsDoctor = run(["doctor"], { cwd: ts, expectFail: true });
  assert(tsDoctor.includes("Next") && /runward (check|init)/.test(tsDoctor), "doctor names the next gesture");
  const tsUpdate = run(["update"], { cwd: ts });
  assert(tsUpdate.includes("Next") && /re-verify the gate/.test(tsUpdate), "update names the next gesture (re-run check)");
  const tse = mkdtempSync(join(tmpdir(), "runward-ts-ex-"));
  run(["--yes", "init", "--example"], { cwd: tse });
  const tseCheck = run(["check", "--strict"], { cwd: tse });
  assert(tseCheck.includes("Next") && /runward compliance/.test(tseCheck),
    "a green check points to the evidence pack (runward compliance)");
  rmSync(ts, { recursive: true, force: true });
  rmSync(tse, { recursive: true, force: true });

  if (failures) { console.error(`\nsmoke test FAILED — ${failures} assertion(s)`); process.exit(1); }
  console.log("\nsmoke test OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
