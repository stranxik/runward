// ADR-0051 decision 2: the slice of rule signatures added 2026-08-13.
//
// A signature (ADR-0020) makes a signed rule's `applied` evidence match the rule's shape, not merely
// resolve. Until this slice, exactly one rule of 64 carried a signature, so "the gate verifies the
// shape of the evidence" was true once. This slice signs five more — conventional idioms the rule
// text prescribes (backoff, fallback, pinned/sha256, sandbox, re-approval) — each answered `n/a` by
// BOTH reference missions, so signing them reddens neither. Rules whose idiom is illustrative rather
// than a code-level token (hexa-*, topology-*, state-event-sourcing's append-only, eval-loop's
// abstention) are deliberately NOT signed: a signature there manufactures a false red on a
// legitimate implementation, which erodes the gate faster than a gap (ADR-0020 trigger).
//
// Each signature is pinned in BOTH directions: it must bite an `applied` row pointing at a real but
// unrelated file (the "cited, not applied" bypass), and it must stay silent on a file that carries
// the prescribed idiom. A one-directional test would pass a signature that refuses everything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { evidenceBreakdown } from "../../dist/lib/evidence.js";
import { ruleSignatures } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-sig-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe" });

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-sig-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, mission: join(dir, "runward"), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

const GATED = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "handover.md"];

// Rewrite a rule's manifest row to `applied` with the given evidence, in whichever gated deliverable
// holds it. Returns false if the row is absent — a guard against a silent no-op fixture.
function setRuleApplied(missionDir, rule, evidence) {
  for (const f of GATED) {
    const p = join(missionDir, f);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf8");
    const re = new RegExp(`^\\|\\s*${rule}\\s*\\|[^\\n]*$`, "m");
    if (re.test(content)) {
      writeFileSync(p, content.replace(re, `| ${rule} | applied | ${evidence} |`));
      return true;
    }
  }
  return false;
}

// A fixture under code/ (a base the example already resolves against) with the given content.
function fixture(m, name, body) {
  const dir = join(m.dir, "code");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), body + "\n");
  return `file:code/${name}`;
}

function sigViolation(v, rule) {
  return v.gated.flatMap((g) => g.violations).find((x) => x.rule === rule && /signature/i.test(x.problem));
}

const SIGNED = [
  { rule: "resilience-retry-backoff", idiom: "the client retries with exponential backoff, capped and jittered" },
  { rule: "resilience-multi-provider-fallback", idiom: "on primary failure it fails over to the fallback provider" },
  { rule: "security-mcp-server-pinning", idiom: "every consumed MCP server is pinned by sha256 digest" },
  { rule: "security-code-execution-sandbox", idiom: "generated code runs inside a sandbox, isolated from the host" },
  { rule: "security-tool-change-reapproval", idiom: "any change to a tool definition forces re-approval before a call" },
  // Wave A obj 3: three more, adjudicated on their prescribed idioms; both reference missions n/a.
  { rule: "config-secrets-boundary", idiom: "the API secret is read from the vault at the network boundary, never in the model" },
  { rule: "async-job-guardrails", idiom: "the worker is idempotent under concurrency, with a dead-letter queue and bounded concurrency" },
  { rule: "data-memory-provenance", idiom: "every memory item carries its provenance; an untrusted write is quarantined by trust tier" },
];

test("ADR-0051 decision 2: every rule in the signed slice declares a signature the gate reads", () => {
  const sigs = ruleSignatures(join(ROOT, "no-such-mission")); // no local rules → the package corpus
  for (const { rule } of SIGNED) assert.ok(sigs[rule], `${rule} must carry a signature in the package corpus`);
  // And the reference example, which answers n/a to all five, carries no signature violation for them.
  const m = mission();
  const v = computeVerdict(m.mission, { strict: true });
  assert.equal(v.exitCode, 0, "the reference example is green with the slice signed");
  for (const { rule } of SIGNED) assert.ok(!sigViolation(v, rule), `${rule}: n/a rows are never signature-checked`);
  m.drop();
});

for (const { rule, idiom } of SIGNED) {
  test(`ADR-0051 decision 2: ${rule} signature bites an unrelated file and passes a matching one`, () => {
    // RED: an applied row pointing at a real but unrelated file — the "cited, not applied" bypass.
    const m = mission();
    const unrelated = fixture(m, "sig-unrelated.txt", "This note documents an unrelated concern and carries none of the rule's shape.");
    assert.ok(setRuleApplied(m.mission, rule, `${unrelated} — unrelated`), `${rule}: its manifest row must exist`);
    const red = computeVerdict(m.mission, { strict: true });
    assert.ok(sigViolation(red, rule), `${rule}: an unrelated file must raise a signature violation`);
    assert.equal(red.exitCode, 1);
    m.drop();

    // GREEN: the same row pointing at a file that carries the prescribed idiom — no signature violation.
    const g = mission();
    const withIdiom = fixture(g, "sig-idiom.txt", idiom);
    assert.ok(setRuleApplied(g.mission, rule, `${withIdiom} — carries the idiom`));
    const green = computeVerdict(g.mission, { strict: true });
    assert.ok(!sigViolation(green, rule), `${rule}: a file carrying the idiom must NOT raise a signature violation`);
    g.drop();
  });
}

test("ADR-0051 decision 3: the run counts applied rows resting on a signed rule, both directions", () => {
  // Counted, never gated. The example applies the one long-signed rule (frontier), so the base count
  // is at least one, and most applied rows are unsigned by design. Flipping a newly-signed rule to
  // `applied` on a matching file raises the count by exactly one.
  const m = mission();
  const base = evidenceBreakdown(m.mission);
  assert.ok(base.signed >= 1, "the example applies frontier-deterministic-boundary, a signed rule");
  assert.ok(base.signed < base.applied, "and most applied rows rest on unsigned rules");
  const withIdiom = fixture(m, "sig-idiom.txt", "the client retries with exponential backoff, capped");
  assert.ok(setRuleApplied(m.mission, "resilience-retry-backoff", `${withIdiom} — idiom`));
  const after = evidenceBreakdown(m.mission);
  assert.equal(after.applied, base.applied + 1, "one more applied row");
  assert.equal(after.signed, base.signed + 1, "and it rests on a signed rule, so signed goes up by one");
  m.drop();
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));
