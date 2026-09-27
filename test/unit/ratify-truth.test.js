// `runward ratify` must record what the operator did and show what the row cites
// (RWD-2026-0124 to 0128, found by an audit of what the CLI prints, 2026-09-27).
//
// Each test names the defect it pins. What is pinned: a sampled row the operator SKIPPED cancels the
// bloc and is never ratified (ADR-0066 decision 5: the bloc rests on the sample alone); the excerpt
// is centred on the cited passage, not the file's header; the signature alarm reads the same files
// the gate reads and stays quiet where there is no file to look in; `--dry-run` writes nothing; an
// empty `--by` is refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listProposals, applyDecisions, blocOutcome, excerptAnchor } from "../../dist/lib/ratify.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

/** A fresh mission whose floor carries ONE proposal on the signed rule config-secrets-boundary
 *  (signature `secret|vault`), with the evidence cell given. */
function mission(evidence) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ratify-truth-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init");
  run(dir, "manifest", "--sync");
  mkdirSync(join(dir, "code", "config"), { recursive: true });
  mkdirSync(join(dir, "test"), { recursive: true });
  writeFileSync(join(dir, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
  writeFileSync(join(dir, "code", "plain.ts"), "export const nothing = 1;\n");
  writeFileSync(join(dir, "test", "settings.test.ts"), "test(\"reads the vault secret\", () => {});\n");
  writeFileSync(join(dir, "test", "plain.test.ts"), "test(\"adds\", () => {});\n");
  const p = join(dir, "runward", "floor.md");
  writeFileSync(p, readFileSync(p, "utf8").replace(
    "| config-secrets-boundary |  |  |", `| config-secrets-boundary | proposed:applied | ${evidence} |`));
  return dir;
}

const prop = (rule, deliverable = "floor.md") => ({ rule, deliverable, label: deliverable, status: "applied", evidence: "", proposer: null, signatureAlarm: false });

test("RWD-2026-0124: a sampled row the operator skipped cancels the bloc and is never ratified", () => {
  const all = ["a", "b", "c", "d", "e", "f"].map((r) => prop(r));
  const sample = all.slice(0, 3);
  const accept = (p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" });
  const o = blocOutcome(all, sample, ["skip", accept(sample[1]), accept(sample[2])]);
  assert.equal(o.cancelledBy, "skip", "a skip on the sample cancels the bloc, as a reject does");
  assert.deepEqual(o.decisions.map((d) => d.rule), ["b", "c"], "only the rows accepted on sight are ratified; the skipped row and the unseen rows are not");
  assert.equal(o.enBloc, 0);
  assert.equal(o.unseen, 3);
  assert.match(o.mode, /bloc cancelled by a sampled skip/);
  // positive control: the same sample fully accepted still carries the bloc
  const full = blocOutcome(all, sample, sample.map(accept));
  assert.equal(full.cancelledBy, null);
  assert.deepEqual(full.decisions.map((d) => d.rule).sort(), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(full.enBloc, 3);
  // a reject still wins the label when both happen
  const both = blocOutcome(all, sample, ["skip", { ...accept(sample[1]), decision: "reject" }, accept(sample[2])]);
  assert.equal(both.cancelledBy, "reject");
});

test("RWD-2026-0125: the excerpt is centred on the cited passage, and says when it shows the top of the file", () => {
  const text = "// header one\n// header two\n\nexport interface Other {}\nexport interface RoutingApproval {\n  approvedBy: string;\n}\nconst x = process.env.VAULT;\n";
  assert.deepEqual(excerptAnchor(text, { symbol: "RoutingApproval" }), { line: 5, note: null }, "#SYMBOL anchors on its first occurrence");
  assert.deepEqual(excerptAnchor(text, { line: 2, symbol: "RoutingApproval" }), { line: 2, note: null }, ":LINE wins when cited");
  assert.equal(excerptAnchor(text, {}, "secret|vault").line, 8, "a signed rule anchors on the signature's first match, case-insensitive as the gate reads it");
  assert.deepEqual(excerptAnchor(text, {}), { line: 1, note: "no line or symbol cited: showing the top of the file" });
  assert.match(excerptAnchor(text, { symbol: "Absent" }).note, /#Absent not found/);
  assert.equal(excerptAnchor(text, { symbol: "Routing" }).line, 1, "the gate's identifier boundary: a fragment of a longer name is not the symbol");
});

test("RWD-2026-0126: the signature alarm reads every cited file and test the gate reads, and stays quiet where there is none", () => {
  const cases = [
    ["test:test/settings.test.ts", false, undefined, "a test: pointer whose file carries the signature does not alarm"],
    ["adr:ADR-0001", false, true, "a row citing only an ADR has no file to look in: flagged unchecked, never the alarm"],
    ["file:code/plain.ts file:code/config/settings.ts", false, undefined, "any cited file carrying the signature is enough, as at the gate"],
    ["test:test/plain.test.ts", true, undefined, "positive control: a cited test file without the signature alarms"],
    ["file:code/plain.ts", true, undefined, "positive control: a cited file without the signature alarms"],
  ];
  for (const [evidence, alarm, unchecked, why] of cases) {
    const dir = mission(evidence);
    try {
      const p = listProposals(join(dir, "runward"), dir).find((x) => x.rule === "config-secrets-boundary" && x.deliverable === "floor.md");
      assert.ok(p, `the proposal is listed (${evidence})`);
      assert.equal(p.signatureAlarm, alarm, why);
      assert.equal(p.signatureUnchecked, unchecked, why);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("RWD-2026-0127: ratify honours the global --dry-run and writes nothing", () => {
  const dir = mission("file:code/config/settings.ts");
  try {
    const floor = join(dir, "runward", "floor.md");
    const before = readFileSync(floor, "utf8");
    const r = run(dir, "--dry-run", "ratify", "--attest-blind");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /dry-run — would ratify 1 row\(s\) BLIND in runward\/floor\.md; nothing written/);
    assert.equal(readFileSync(floor, "utf8"), before, "the deliverable is byte-identical: no row changed, no BLIND block");
    const props = listProposals(join(dir, "runward"), dir);
    const counted = applyDecisions(join(dir, "runward"), props,
      [{ rule: "config-secrets-boundary", deliverable: "floor.md", decision: "accept" }],
      { by: "x", date: "2026-09-27", mode: "line-by-line" }, { dryRun: true });
    assert.deepEqual(counted, { accepted: 1, rejected: 0, deliverables: ["floor.md"] }, "the dry run counts what a real run would do");
    assert.equal(readFileSync(floor, "utf8"), before, "and still writes nothing");
    // positive control: without --dry-run the same gesture writes
    assert.equal(run(dir, "ratify", "--attest-blind").code, 0);
    assert.notEqual(readFileSync(floor, "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0128: an empty --by is refused before anything is written", () => {
  const dir = mission("file:code/config/settings.ts");
  try {
    const floor = join(dir, "runward", "floor.md");
    const before = readFileSync(floor, "utf8");
    for (const by of ["", "   "]) {
      const r = run(dir, "ratify", "--attest-blind", "--by", by);
      assert.equal(r.code, 2, `--by "${by}" exits 2`);
      assert.match(r.out, /--by needs a name/);
      assert.equal(readFileSync(floor, "utf8"), before, "nothing written");
    }
    // positive control: a real name is recorded as declared
    assert.equal(run(dir, "ratify", "--attest-blind", "--by", "The Operator").code, 0);
    assert.match(readFileSync(floor, "utf8"), /by: The Operator \(declared\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
