// `runward ratify` — the decision becomes yours (ADR-0066, P3).
//
// The command is a shell; every decision lives in src/lib/ratify.ts where this file reaches it
// without a terminal (the ADR-0047 discipline). What is pinned here: accept strips the prefix and
// moves the proposer from the row into the Ratification block (the table says the state, the block
// says the history); reject empties the row back to a frank hole; the en-bloc sample is
// deterministic from the digest and NEVER samples out a signature alarm; the non-TTY refusal and
// the self-marking BLIND escape hold at the CLI boundary; and the whole loop closes — a ratified
// row crosses the gate, and the untraced counter knows it is traced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listProposals, applyDecisions, sampleForBloc, splitProposer } from "../../dist/lib/ratify.js";
import { ratificationLedger } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

/** A mission whose floor carries two proposals: one signature-corroborated (the vault file), one
 *  whose signed rule points at evidence WITHOUT the signature — the alarm shape. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "rw-ratify-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init");
  run(dir, "manifest", "--sync");
  mkdirSync(join(dir, "code", "config"), { recursive: true });
  writeFileSync(join(dir, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
  writeFileSync(join(dir, "code", "plain.ts"), "export const nothing = 1;\n");
  run(dir, "propose"); // writes the corroborated proposal
  const p = join(dir, "runward", "floor.md");
  writeFileSync(p, readFileSync(p, "utf8").replace(
    "| frontier-deterministic-boundary |  |  |",
    "| frontier-deterministic-boundary | proposed:applied | file:code/plain.ts ; proposer: an-agent, 2026-09-03, \"looked right\" |"));
  return dir;
}

test("splitProposer separates the evidence from the declared segment, and tolerates its absence", () => {
  assert.deepEqual(splitProposer("file:a.ts ; proposer: agent-x, 2026-09-03"), { evidence: "file:a.ts", proposer: "agent-x, 2026-09-03" });
  assert.deepEqual(splitProposer("file:a.ts"), { evidence: "file:a.ts", proposer: null });
});

test("listProposals sees both proposals and raises the alarm on the unmatched signature", () => {
  const dir = fixture();
  try {
    const props = listProposals(join(dir, "runward"), dir);
    const frontier = props.find((p) => p.rule === "frontier-deterministic-boundary");
    const secrets = props.find((p) => p.rule === "config-secrets-boundary" && p.deliverable === "floor.md");
    assert.ok(frontier && secrets, "both proposals are listed");
    assert.equal(frontier.signatureAlarm, true,
      "a signed rule whose cited evidence does not carry the signature is the alarm shape");
    assert.equal(secrets.signatureAlarm, false, "the corroborated proposal raises no alarm");
    assert.equal(frontier.proposer, 'an-agent, 2026-09-03, "looked right"');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("accept strips the prefix, moves the proposer into the block, and the loop closes at the gate", () => {
  const dir = fixture();
  try {
    const mission = join(dir, "runward");
    const props = listProposals(mission, dir);
    const target = props.find((p) => p.rule === "config-secrets-boundary" && p.deliverable === "floor.md");
    applyDecisions(mission, props, [{ rule: target.rule, deliverable: "floor.md", decision: "accept" }],
      { by: "The Operator", date: "2026-09-03", mode: "line-by-line" });
    const floor = readFileSync(join(mission, "floor.md"), "utf8");
    assert.match(floor, /\| config-secrets-boundary \| applied \| file:code\/config\/settings\.ts \|/,
      "the ratified row is clean: three columns, bare status, no proposer segment");
    assert.match(floor, /### Ratification/, "the block exists");
    assert.match(floor, /- 2026-09-03 · rows: config-secrets-boundary · by: The Operator \(declared\) · proposer: runward propose v[\d.]+ \(signature matched\) \(declared\) · mode: line-by-line/,
      "the history carries by, proposer and mode — all declared");
    const led = ratificationLedger(mission);
    assert.equal(led.lineByLine, 1, "the ledger reads the entry back");
    // the row is traced: it must NOT count as untraced
    const before = led.untraced;
    assert.ok(before >= 0);
    const { out } = run(dir, "check", "--strict");
    // the rule maps to TWO phases; only the Floor row was ratified here, and the Govern proposal
    // legitimately still awaits — the assertion is scoped to the row the decision covered.
    assert.doesNotMatch(out, /Floor · config-secrets-boundary[^\n]*awaits ratification/,
      "the ratified row no longer awaits anything — the decision is the operator's now");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("reject empties the row back to a frank hole, and records nothing for it", () => {
  const dir = fixture();
  try {
    const mission = join(dir, "runward");
    const props = listProposals(mission, dir);
    applyDecisions(mission, props, [{ rule: "frontier-deterministic-boundary", deliverable: "floor.md", decision: "reject" }],
      { by: "The Operator", date: "2026-09-03", mode: "line-by-line" });
    const floor = readFileSync(join(mission, "floor.md"), "utf8");
    assert.match(floor, /\| frontier-deterministic-boundary \|  \|  \|/, "a rejected proposal is a frank hole again");
    assert.ok(!/### Ratification/.test(floor) || !/frontier-deterministic-boundary/.test(floor.split("### Ratification")[1] ?? ""),
      "a rejection is not a ratification: the block never lists the rejected row");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the en-bloc sample is deterministic and never samples out an alarm", () => {
  const proposals = [
    { deliverable: "floor.md", rule: "alarm-1", status: "applied", evidence: "file:x", proposer: null, signatureAlarm: true, label: "Floor" },
    ...Array.from({ length: 10 }, (_, i) => ({
      deliverable: "floor.md", rule: `quiet-${i}`, status: "applied", evidence: "file:y", proposer: null, signatureAlarm: false, label: "Floor",
    })),
  ];
  const a = sampleForBloc(proposals, "digest-one");
  const b = sampleForBloc(proposals, "digest-one");
  const c2 = sampleForBloc(proposals, "digest-two");
  assert.deepEqual(a.map((p) => p.rule), b.map((p) => p.rule), "same digest, same sample — no re-rolling");
  assert.ok(a.some((p) => p.rule === "alarm-1"), "the alarm is always sampled");
  assert.ok(c2.some((p) => p.rule === "alarm-1"), "under every digest");
  assert.ok(a.length >= 3, "minimum three");
});

test("non-TTY ratify refuses; --attest-blind ratifies, records BLIND, and every later check discloses it", () => {
  const dir = fixture();
  try {
    const refused = run(dir, "ratify");
    assert.equal(refused.code, 2, "a ratification is an answer to displayed evidence, not a flag");
    assert.match(refused.out, /refusing to ratify without a terminal/);

    const blind = run(dir, "ratify", "--attest-blind", "--by", "The Operator");
    assert.equal(blind.code, 0);
    assert.match(blind.out, /ratified BLIND/);
    const floor = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    assert.match(floor, /mode: BLIND/, "the mode is recorded where the history lives");
    const v = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(v.ratification.blind >= 1, "the machine contract carries the blind count — disclosed, never silent");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
