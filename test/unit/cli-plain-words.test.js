// What the CLI prints for the person or the agent who acts on it: plain words, one instruction per
// cause, no green tick beside a lack.
//
// Found 2026-09-27 by an adversarial audit of what the CLI prints (lot 3: jargon, repetition,
// labels; RWD-2026-0158 to 0162). None of these moves an exit code or a JSON field, except the one
// sentence RWD-2026-0162 changes inside `conformance[].problem`. Each case pins the new wording
// where a reader acts on it, not the whole output; each was measured red with its fix removed
// from dist/.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, input, ...a) => {
  const r = spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, input });
  return { out: (r.stdout ?? "") + (r.stderr ?? ""), stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status };
};
const count = (hay, needle) => hay.split(needle).length - 1;

let blank, example;
before(() => {
  blank = mkdtempSync(join(tmpdir(), "rw-plain-blank-"));
  execFileSync("git", ["init", "-q", "."], { cwd: blank });
  execFileSync("node", [CLI, "--yes", "init"], { cwd: blank, env: ENV, stdio: "ignore" });
  example = mkdtempSync(join(tmpdir(), "rw-plain-example-"));
  execFileSync("git", ["init", "-q", "."], { cwd: example });
  execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: example, env: ENV, stdio: "ignore" });
});
after(() => {
  rmSync(blank, { recursive: true, force: true });
  rmSync(example, { recursive: true, force: true });
});
const copy = (from) => {
  const dir = mkdtempSync(join(tmpdir(), "rw-plain-"));
  cpSync(from, dir, { recursive: true });
  return dir;
};

// ── RWD-2026-0158: the armed refusal says each instruction once ──────────────────────────────────

test("gate-hook on a fresh mission: one line per cause naming every rule, the instruction once", () => {
  const r = run(blank, '{"stop_hook_active":false}', "gate-hook", "--harness", "claude");
  assert.equal(r.code, 2, "still a block: only the wording changed");
  assert.equal(count(r.stderr, "scaffolds the missing row(s)"), 1, "the instruction is said once, not per row");
  assert.match(r.stderr, /^✗ 46 row\(s\): not accounted for in the Rule conformance manifest$/m);
  assert.match(r.stderr, /^ {4}Handover \(runward\/handover\.md\): handover-agents-charter-final, handover-redone-task-proof, /m,
    "every rule is still named, grouped by deliverable, with its file");
  assert.match(r.stderr, /^ {2}Fix for the 46 row\(s\) above that share it: `runward manifest --sync`/m);
  assert.ok(r.stderr.length < 3500, `the refusal the model reads back stays short (${r.stderr.length} bytes; 5919 before)`);
});

test("gate-hook for Cursor: one prefix, the advisory label in plain words", () => {
  const r = run(blank, "{}", "gate-hook", "--harness", "cursor");
  const msg = JSON.parse(r.stdout).followup_message;
  assert.match(msg, /^runward gate red \(advisory: Cursor cannot block this turn\): check --strict refuses this tree/);
  assert.equal(count(msg, "runward gate"), 1, "no doubled prefix");
});

test("gate-hook release: the log is named as something to commit, never as already in the diff", () => {
  const dir = copy(blank);
  try {
    const r = run(dir, '{"stop_hook_active":true}', "gate-hook", "--harness", "claude");
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.stderr, /it is in the diff/);
    assert.match(r.stderr, /Commit that file; a bypass shows in a diff only once it is committed\./);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── RWD-2026-0159: check --strict in the reader's words ─────────────────────────────────────────

test("check --strict on the example: disclosures in plain words, runward's ADRs named as runward's", () => {
  const r = run(example, undefined, "check", "--strict");
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.out, /evidence nature|arming this check|an agent-built mission should show zero/);
  assert.match(r.out, /applied row\(s\) cite a different kind of evidence than their rule requires/);
  assert.match(r.out, /decided row\(s\) carry no ratification trace — reported, not counted: .*`runward ratify --decided` records a ratification/);
  assert.match(r.out, /never verified \(runward ADR-0004\)/, "an ADR number says whose it is");
  assert.doesNotMatch(r.out, /\((?:disclosed, not judged — )?ADR-00\d\d\)/, "no bare ADR number a reader would look for in the mission");
});

test("check --strict on a blank mission: the shared cause counts rows and says how many rules", () => {
  const r = run(blank, undefined, "check", "--strict");
  assert.match(r.out, /↳ 46 row\(s\) above share one cause \(41 distinct rules: 5 of them are gated in two phases\)/);
});

test("check --strict, regulated tier: the cause is said once, each line names the row", () => {
  const dir = copy(example);
  try {
    const lock = join(dir, "runward", "scaffold-lock.json");
    writeFileSync(lock, JSON.stringify({ ...JSON.parse(readFileSync(lock, "utf8")), regulated: true }, null, 2));
    const r = run(dir, undefined, "check", "--strict");
    assert.equal(r.code, 1);
    assert.match(r.out, /✗ 46 decided row\(s\) not ratified — counted against the verdict \(regulated tier\):\n {6}contracts-governance \(architecture\.md\)\n/);
    assert.doesNotMatch(r.out, /— decided, never ratified \(/, "the per-line repetition of the heading is gone");
    assert.match(r.out, /forge approval \(the pull-request review on GitHub or GitLab\): not verified by this command; your CI checks it/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("check --strict, drifted seal: the line reads as what happened, not as a rule named (seal)", () => {
  const dir = copy(example);
  try {
    execFileSync("node", [CLI, "check", "--strict", "--freeze"], { cwd: dir, env: ENV, stdio: "ignore" });
    const lock = JSON.parse(readFileSync(join(dir, "runward", "evidence-lock.json"), "utf8"));
    const sealed = Object.keys(lock.files)[0];
    writeFileSync(join(dir, sealed), readFileSync(join(dir, sealed), "utf8") + "\n// drift\n");
    const r = run(dir, undefined, "check", "--strict");
    assert.equal(r.code, 1);
    assert.match(r.out, new RegExp(`^ {2}✗ sealed evidence changed: ${sealed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — `, "m"));
    assert.doesNotMatch(r.out, /✗ \(seal\)/);
    const j = JSON.parse(run(dir, undefined, "check", "--strict", "--json").stdout);
    assert.ok(j.conformance.some((c) => c.rule === "(seal)"), "the payload keeps its rule id (ADR-0030)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── RWD-2026-0160: manifest and propose ──────────────────────────────────────────────────────────

test("manifest: no green tick beside a lack, and the undecided rows are counted", () => {
  const dir = copy(blank);
  try {
    const ro = run(dir, undefined, "manifest");
    assert.match(ro.out, /✗ 6 rule\(s\) have no row — runward manifest --sync adds them:/);
    const sync = run(dir, undefined, "manifest", "--sync");
    assert.doesNotMatch(sync.out, /✓[^\n]*not accounted for/, "a tick beside a lack is gone");
    assert.match(sync.out, /◑ 6 row\(s\) added with an empty status — the gate refuses them until each is decided:/);
    assert.match(sync.out, /or run runward propose to pre-fill the rows a signature can back/);
    const again = run(dir, undefined, "manifest");
    assert.match(again.out, /✓ rows match the mapped rule set\n {2}6 row\(s\): 0 applied · 0 deviated · 0 n\/a · 6 empty · 0 proposed/);
    assert.match(again.out, /46 row\(s\) are empty or proposed, not decided/);
    assert.doesNotMatch(again.out, /Nothing to scaffold/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("propose: the instruction once, no internal field name", () => {
  const dir = copy(blank);
  try {
    run(dir, undefined, "manifest", "--sync");
    mkdirSync(join(dir, "code"), { recursive: true });
    const r = run(dir, undefined, "propose");
    assert.equal(count(r.out, "let your agent propose it"), 0);
    assert.doesNotMatch(r.out, /noTerritory/);
    assert.match(r.out, /signed, but the rule names no files to search; left empty/);
    assert.equal(count(r.out, "Left empty: "), 1);
    assert.match(r.out, /Left empty: \d+ without a signature, .*Decide them yourself or with your agent; runward explain <rule> says what each one asks for\./);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── RWD-2026-0161: explain, rules, ratify, status, doctor, wire, report, help ────────────────────

test("explain: the gate-wide limits in one line, pointing at the full text", () => {
  const r = run(example, undefined, "explain", "eval-loop");
  const line = r.out.split("\n").find((l) => l.includes("Gate-wide"));
  assert.ok(line && line.length < 300, `one short line (${line?.length})`);
  assert.match(line, /Full statement: the gateNonScope field of runward rules --json\./);
  assert.doesNotMatch(r.out, /arming waits on/);
});

test("rules: ·signed has a legend", () => {
  const r = run(example, undefined, "rules");
  assert.match(r.out, /·signed the rule has a signature: an applied row's evidence must contain the pattern it names/);
});

test("ratify --list: the proposer line has one parenthesis, and says it is declared", () => {
  const dir = copy(blank);
  try {
    run(dir, undefined, "manifest", "--sync");
    mkdirSync(join(dir, "code", "config"), { recursive: true });
    writeFileSync(join(dir, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
    run(dir, undefined, "propose");
    const r = run(dir, undefined, "ratify", "--list");
    assert.match(r.out, /proposer {2}runward propose v[\d.]+ \(signature matched\) · declared in the row, not verified/);
    assert.doesNotMatch(r.out, /\) \(declared\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("status, doctor, wire, gate-hook help: no internal labels", () => {
  const none = mkdtempSync(join(tmpdir(), "rw-plain-none-"));
  try {
    assert.doesNotMatch(run(none, undefined, "status").out, /M1\/M2/);
  } finally { rmSync(none, { recursive: true, force: true }); }
  const status = run(example, undefined, "status").out;
  assert.match(status, /of \d+ scanned file\(s\) are assigned a category that rules can govern/);
  assert.doesNotMatch(status, /walked file/);
  assert.match(run(example, undefined, "doctor").out, /every gated phase maps at least its minimum number of rules/);
  const help = run(example, undefined, "gate-hook", "--help").out;
  assert.doesNotMatch(help, /harness seam|ADR-0065/);
  assert.match(help, /blocks the\s+end of the turn once/);
  assert.doesNotMatch(run(example, undefined, "ratify", "--help").out, /does not bind/);
});

// ── RWD-2026-0162: a dead pointer's instruction no longer leads to a second refusal ─────────────

test("a dead typed pointer names the two ways out, never 'remove the row'", () => {
  const dir = copy(example);
  try {
    const p = join(dir, "runward", "architecture.md");
    writeFileSync(p, readFileSync(p, "utf8").replace(
      /\| hexa-adapter-pattern \| applied \| file:code\/src\/adapters\/[^\s#|]+/, "| hexa-adapter-pattern | applied | file:code/src/adapters/missing.ts"));
    const j = JSON.parse(run(dir, undefined, "check", "--strict", "--json").stdout);
    const row = j.conformance.find((c) => c.rule === "hexa-adapter-pattern" && c.kind === "unresolved-pointer");
    assert.ok(row, "the dead pointer is refused");
    assert.match(row.problem, /^typed pointer does not resolve: file:code\/src\/adapters\/missing\.ts\S* — point it at a file that exists, or change the row's status \(deviated with an ADR, n\/a with a reason\)/,
      "the prefix readers match on is kept; the instruction changed");
    assert.doesNotMatch(row.problem, /update it or remove the row/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
