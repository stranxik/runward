// ADR-0082 (amended 2026-09-28): an agent may ratify, under its own name, never under a person's.
//
// What is pinned here, property by property: `--agent` and `--for` go together and are never empty;
// the agent path needs no terminal and asks nothing (`--list` shows, `--accept <deliverable>:<rule>`
// names each row); a row that is not listed is refused, whole; a row the agent or its accountable
// person proposed is refused, and the message says the names are declared; `--dry-run` writes nothing;
// the trace reads `by: <agent> (declared, agent) · for: <person> (declared, accountable) · … · mode:
// agent` and every surface counts it apart; an attestation produced before the field existed still
// verifies; under the regulated tier an agent ratification binds only with `"agentRatification": true`
// and an accountable person who is not the proposer; `update` keeps the flag; and without `--agent`
// the person's path is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listDecidedUnbound, applyDecisions } from "../../dist/lib/ratify.js";
import { readRatification, ratificationLedger, unboundRatifications, declaredNameIn, parseManifest } from "../../dist/lib/conformance.js";
import { renderScaffoldLock } from "../../dist/lib/scaffold-lock.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};
const json = (dir) => JSON.parse(run(dir, "check", "--strict", "--json").out);
const AGENT_LINE = /^- \d{4}-\d{2}-\d{2} · rows: [^·]+ · by: [^·]+ \(declared, agent\) · for: [^·]+ \(declared, accountable\)( · proposer: [^·]+ \(declared\))? · bound: [^·]+ · mode: agent$/m;

/** A fresh mission whose floor carries two proposals: the signature-corroborated one `propose`
 *  writes (proposer: runward propose …), and one an agent named `claude-x` proposed. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "rw-agent-ratify-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init");
  run(dir, "manifest", "--sync");
  mkdirSync(join(dir, "code", "config"), { recursive: true });
  writeFileSync(join(dir, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
  writeFileSync(join(dir, "code", "plain.ts"), "export const nothing = 1;\n");
  run(dir, "propose");
  const p = join(dir, "runward", "floor.md");
  writeFileSync(p, readFileSync(p, "utf8").replace(
    "| frontier-deterministic-boundary |  |  |",
    "| frontier-deterministic-boundary | proposed:applied | file:code/plain.ts ; proposer: Claude-X, 2026-09-28, for Alice Martin |"));
  return dir;
}

/** The example mission, optionally under the regulated tier and the agent-ratification opt-in. */
function example({ regulated = false, agentRatification = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rw-agent-regulated-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init", "--example");
  setLock(dir, { regulated, agentRatification });
  return dir;
}
function setLock(dir, flags) {
  const lock = join(dir, "runward", "scaffold-lock.json");
  const j = JSON.parse(readFileSync(lock, "utf8"));
  for (const [k, v] of Object.entries(flags)) { if (v) j[k] = true; else delete j[k]; }
  writeFileSync(lock, JSON.stringify(j, null, 2) + "\n");
}
/** A person ratifies every decided row, line by line, as `ratify --decided` records it. */
function personRatifiesAll(dir) {
  const mission = join(dir, "runward");
  const rows = listDecidedUnbound(mission, dir);
  applyDecisions(mission, rows, rows.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" })),
    { by: "The Operator", date: "2026-09-28", mode: "line-by-line" });
}
/** Turn one decided floor row back into a proposal made by `proposer`, and return its rule. */
function reproposeFloorRow(dir, proposer) {
  const p = join(dir, "runward", "floor.md");
  const content = readFileSync(p, "utf8");
  const row = parseManifest(content).find((r) => r.status === "n/a");
  const line = content.split("\n").find((l) => l.startsWith(`| ${row.rule} |`));
  writeFileSync(p, content.replace(line, () => `| ${row.rule} | proposed:n/a | ${row.evidence} ; proposer: ${proposer} |`));
  return row.rule;
}

test("ADR-0082: --agent and --for go together, never empty, never a name the trace cannot hold", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    for (const args of [["--agent", "bot"], ["--for", "Alice"], ["--agent", "bot", "--for", "  "], ["--agent", "", "--for", "Alice"],
      ["--agent", "bot · x", "--for", "Alice"], ["--agent", "bot", "--for", "Alice", "--by", "Alice"],
      ["--agent", "bot", "--for", "Alice", "--attest-blind"], ["--agent", "bot", "--for", "Alice", "--all"]]) {
      const r = run(dir, "ratify", ...args, "--accept", "floor.md:config-secrets-boundary");
      assert.equal(r.code, 2, `refused: ${args.join(" ")}`);
      assert.match(r.out, /nothing written/);
    }
    const half = run(dir, "ratify", "--agent", "bot", "--accept", "floor.md:config-secrets-boundary");
    assert.match(half.out, /--agent and --for go together/);
    const noAccept = run(dir, "ratify", "--agent", "bot", "--for", "Alice");
    assert.equal(noAccept.code, 2, "an agent does not answer prompts: without --list or --accept it is told the two steps");
    assert.match(noAccept.out, /--list.*--accept/);
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before, "no refusal wrote a byte");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: --list writes nothing and shows what a person is shown; --json carries the same rows with their ids", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    const human = run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--list");
    assert.equal(human.code, 0, "no terminal needed");
    assert.match(human.out, /config-secrets-boundary — proposed:applied/);
    assert.match(human.out, /│ +1 {2}export const key = process\.env\.vault_secret;/, "the resolved excerpt a person sees");
    assert.match(human.out, /id +floor\.md:config-secrets-boundary/);
    const j = JSON.parse(run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--list", "--json").out);
    const row = j.rows.find((r) => r.id === "floor.md:config-secrets-boundary");
    assert.equal(row.status, "proposed:applied");
    assert.deepEqual(row.excerpt.lines[0], { n: 1, text: "export const key = process.env.vault_secret;" });
    const frontier = j.rows.find((r) => r.id === "floor.md:frontier-deterministic-boundary");
    assert.equal(frontier.signatureAlarm, true, "the alarm travels to the machine listing too");
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: an agent ratifies a named row without a terminal, and the trace names it and its accountable person", () => {
  const dir = fixture();
  try {
    const r = run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", "floor.md:config-secrets-boundary");
    assert.equal(r.code, 0, r.out);
    const floor = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    assert.match(floor, /\| config-secrets-boundary \| applied \| file:code\/config\/settings\.ts \|/);
    assert.match(floor, /^- \d{4}-\d{2}-\d{2} · rows: config-secrets-boundary · by: bot \(declared, agent\) · for: Alice \(declared, accountable\) · proposer: runward propose v[\d.]+ \(signature matched\) \(declared\) · bound: config-secrets-boundary@[0-9a-f]{16} · mode: agent$/m);
    assert.match(floor, /\| frontier-deterministic-boundary \| proposed:applied \|/, "a row not named stays proposed");
    const gov = readFileSync(join(dir, "runward", "governance", "threat-model.md"), "utf8");
    assert.match(gov, /\| config-secrets-boundary \| proposed:applied \|/, "the same rule in another deliverable is another row, not named");
    // The parser reads the line back, additively: rows, bound and mode as before, plus the names.
    const [e] = readRatification(floor);
    assert.deepEqual(e.rows, ["config-secrets-boundary"]);
    assert.equal(e.mode, "agent");
    assert.equal(Object.keys(e.bound).length, 1);
    assert.equal(e.by, "bot");
    assert.equal(e.for, "Alice");
    assert.equal(e.agent, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: a row that is not listed now is refused, and the whole call writes nothing", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    // one good id beside a bad one: all or nothing
    const r = run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", "floor.md:config-secrets-boundary,floor.md:no-such-rule");
    assert.equal(r.code, 2);
    assert.match(r.out, /floor\.md:no-such-rule is not a row `ratify --list` lists now/);
    // a DECIDED row is not a proposal: without --decided it is not listed
    const decided = parseManifest(before).find((x) => ["applied", "n/a", "deviated"].includes(x.status));
    if (decided) assert.equal(run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", `floor.md:${decided.rule}`).code, 2);
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: an agent never ratifies a row it, or its accountable person, proposed (declared names, case-insensitive)", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    const self = run(dir, "ratify", "--agent", "claude-x", "--for", "Bob", "--accept", "floor.md:frontier-deterministic-boundary");
    assert.equal(self.code, 2);
    assert.match(self.out, /the agent "claude-x" is its declared proposer/);
    assert.match(self.out, /compares declared names, it is not proof/);
    const owner = run(dir, "ratify", "--agent", "other-bot", "--for", "alice martin", "--accept", "floor.md:frontier-deterministic-boundary");
    assert.equal(owner.code, 2);
    assert.match(owner.out, /the accountable person "alice martin" is its declared proposer/);
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before, "refused whole, nothing written");
    // --list says it before the agent tries
    const listed = JSON.parse(run(dir, "ratify", "--agent", "claude-x", "--for", "Bob", "--list", "--json").out);
    assert.match(listed.rows.find((x) => x.rule === "frontier-deterministic-boundary").refused, /the agent is this row's declared proposer/);
    // control: an unrelated agent and person may ratify it
    assert.equal(run(dir, "ratify", "--agent", "other-bot", "--for", "Bob", "--accept", "floor.md:frontier-deterministic-boundary").code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(declaredNameIn("claude", "Claude (agent), 2026-09-28"), true);
  assert.equal(declaredNameIn("claude", "claude-code, 2026-09-28"), false, "a whole token, not a prefix of another name");
});

test("ADR-0082: --dry-run with --agent says what it would write and writes nothing", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    const r = run(dir, "--dry-run", "ratify", "--agent", "bot", "--for", "Alice", "--accept", "floor.md:config-secrets-boundary");
    assert.equal(r.code, 0);
    assert.match(r.out, /dry-run — would ratify 1 row\(s\) as agent bot for Alice in runward\/floor\.md; nothing written/);
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: agent ratifications are counted apart in the ledger, the terminal, the JSON and the SARIF", () => {
  const dir = fixture();
  try {
    const r = run(dir, "ratify", "--agent", "bot", "--for", "Dana", "--accept", "floor.md:config-secrets-boundary", "--accept", "floor.md:frontier-deterministic-boundary");
    assert.equal(r.code, 0, r.out);
    const led = ratificationLedger(join(dir, "runward"));
    assert.equal(led.agent, 2);
    assert.equal(led.lineByLine, 0, "an agent ratification is never counted as a person's line-by-line answer");
    assert.equal(led.rows, 2);
    // two proposers → two entries, each naming the proposer of every row it lists
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8").match(new RegExp(AGENT_LINE.source, "gm")).length, 2);
    const c = run(dir, "check", "--strict");
    assert.match(c.out, /2 row\(s\) ratified by an agent — bot for Dana \(2\); declared names, not proof/);
    const p = json(dir);
    assert.equal(p.ratification.agent, 2);
    assert.deepEqual(p.ratification.agents, [{ agent: "bot", for: "Dana", rows: 2 }]);
    const sarif = JSON.parse(run(dir, "check", "--strict", "--sarif").out);
    assert.deepEqual(sarif.runs[0].properties.agentRatification, { rows: 2, agents: [{ agent: "bot", for: "Dana", rows: 2 }] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: an attestation shaped before the agent field still verifies; with agent rows, dropping the count is caught", () => {
  const plain = example();
  const agentic = fixture();
  try {
    // The pre-0082 predicate carried exactly these five keys. A mission no agent ratified must
    // produce them and nothing else, or every attestation sealed before this change would stop
    // verifying (`verify` compares the whole object).
    const stmt = JSON.parse(run(plain, "check", "--strict", "--attest").out);
    const r = stmt.predicate.ratification;
    stmt.predicate.ratification = { rows: r.rows, lineByLine: r.lineByLine, enBloc: r.enBloc, blind: r.blind, untraced: r.untraced };
    const file = join(plain, "old.intoto.json");
    writeFileSync(file, JSON.stringify(stmt));
    assert.equal(run(plain, "verify", file).code, 0, "a pre-0082 ratification object verifies on a mission with no agent ratification");
    run(agentic, "ratify", "--agent", "bot", "--for", "Alice", "--accept", "floor.md:config-secrets-boundary");
    const a = JSON.parse(run(agentic, "check", "--strict", "--attest").out);
    const af = join(agentic, "a.intoto.json");
    writeFileSync(af, JSON.stringify(a));
    assert.equal(run(agentic, "verify", af).code, 0, "control: the honest one verifies");
    delete a.predicate.ratification.agent;
    delete a.predicate.ratification.agents;
    writeFileSync(af, JSON.stringify(a));
    assert.notEqual(run(agentic, "verify", af).code, 0, "an attestation that hides the agent rows is a difference");
  } finally { rmSync(plain, { recursive: true, force: true }); rmSync(agentic, { recursive: true, force: true }); }
});

test("ADR-0082: under the regulated tier without the opt-in, an agent-ratified row is a named strict gap", () => {
  const dir = example({ regulated: true });
  try {
    personRatifiesAll(dir);
    const rule = reproposeFloorRow(dir, "Bob");
    const r = run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", `floor.md:${rule}`);
    assert.equal(r.code, 0);
    assert.match(r.out, /does not declare "agentRatification": true/, "the agent is told the row still counts");
    assert.deepEqual(unboundRatifications(join(dir, "runward")), [{ deliverable: "floor.md", rule, cause: "agent-not-accepted" }]);
    const c = run(dir, "check", "--strict");
    assert.equal(c.code, 1);
    assert.match(c.out, /ratified by an agent; this mission does not accept agent ratification/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: under the regulated tier with the opt-in, an agent ratification binds when its accountable person did not propose", () => {
  const dir = example({ regulated: true, agentRatification: true });
  try {
    personRatifiesAll(dir);
    const rule = reproposeFloorRow(dir, "Bob");
    assert.equal(run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", `floor.md:${rule}`).code, 0);
    assert.deepEqual(unboundRatifications(join(dir, "runward")), []);
    assert.equal(run(dir, "check", "--strict").code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: with the opt-in, a trace whose accountable person proposed the row, or names no proposer, stays a gap", () => {
  const dir = example({ regulated: true, agentRatification: true });
  try {
    personRatifiesAll(dir);
    const mission = join(dir, "runward");
    const p = join(mission, "floor.md");
    const rule = reproposeFloorRow(dir, "Bob");
    run(dir, "ratify", "--agent", "bot", "--for", "Alice", "--accept", `floor.md:${rule}`);
    assert.deepEqual(unboundRatifications(mission), [], "bound first");
    // `ratify` refuses to write this; a script can (RWD-2026-0119), and the tier still reads it.
    const bound = readFileSync(p, "utf8").match(/· bound: (\S+@[0-9a-f]{16}) · mode: agent/)[1];
    writeFileSync(p, readFileSync(p, "utf8") + `- 2026-09-29 · rows: ${rule} · by: bot (declared, agent) · for: bob (declared, accountable) · proposer: Bob (declared) · bound: ${bound} · mode: agent\n`);
    assert.deepEqual(unboundRatifications(mission), [{ deliverable: "floor.md", rule, cause: "agent-proposer" }]);
    const c = run(dir, "check", "--strict");
    assert.equal(c.code, 1);
    assert.match(c.out, /whose accountable person, or the agent itself, proposed the row/);
    // a hand-decided row carries no proposer: the independence cannot be read
    const d = run(dir, "ratify", "--decided", "--agent", "bot", "--for", "Alice", "--list", "--json");
    assert.ok(JSON.parse(d.out).rows.some((x) => x.rule === rule), "the unbound row is listed for --decided");
    writeFileSync(p, readFileSync(p, "utf8") + `- 2026-09-30 · rows: ${rule} · by: bot (declared, agent) · for: Alice (declared, accountable) · bound: ${bound} · mode: agent\n`);
    assert.equal(unboundRatifications(mission)[0].cause, "agent-unattributed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: `update` preserves agentRatification, and the lock writer emits it only when set", () => {
  assert.doesNotMatch(renderScaffoldLock("x", {}, null, true, true, false), /agentRatification/);
  assert.match(renderScaffoldLock("x", {}, null, true, true, true), /"agentRatification": true/);
  const dir = example({ regulated: true, agentRatification: true });
  try {
    run(dir, "update");
    const j = JSON.parse(readFileSync(join(dir, "runward", "scaffold-lock.json"), "utf8"));
    assert.equal(j.agentRatification, true, "a refresh must not undo the organisation's choice (the RWD-2026-0106 shape)");
    assert.equal(j.regulated, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0082: without --agent, the person's path is unchanged — refused without a terminal, --accept refused", () => {
  const dir = fixture();
  try {
    const before = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    const r = run(dir, "ratify");
    assert.equal(r.code, 2);
    assert.match(r.out, /refusing to ratify without a terminal — a ratification is an answer to displayed evidence, not a flag/);
    const acc = run(dir, "ratify", "--accept", "floor.md:config-secrets-boundary");
    assert.equal(acc.code, 2);
    assert.match(acc.out, /--accept is the agent path/);
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
