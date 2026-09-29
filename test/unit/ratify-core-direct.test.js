// The ratification core, reached directly (ADR-0066, ADR-0080, ADR-0082).
//
// Found by the mutation measure of 2026-09-28 (release 0.42.3): the signature alarm, the listing of
// decided rows, the agent's `--accept` names, the bytes `applyDecisions` writes and the bloc's own
// decisions were pinned mostly through `runward ratify` in a child process, where no mutant is
// active. What is pinned here, each property on a hand-built mission: when the alarm is raised and
// what the listing says beside it; how a decided row is labelled and shown; which names an agent may
// write; what a ratification writes, byte for byte, and what it leaves alone; what an en-bloc run
// hands to the writer; where the displayed excerpt is centred.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listProposals, listDecidedUnbound, resolveAgentAccept, applyDecisions, blocOutcome, excerptAnchor,
} from "../../dist/lib/ratify.js";
import { parseManifest, readRatification, ratificationLedger, rowDigest } from "../../dist/lib/conformance.js";

const HEAD = ["# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|"];

/** root/ holds the project, root/runward/ the mission; `rules` maps slug → signature (or null). */
function project(rules, rows, { lock, extra = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "rw-ratify-core-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "rules"), { recursive: true });
  for (const [slug, sig] of Object.entries(rules)) {
    writeFileSync(join(mission, "rules", `${slug}.md`),
      `---\ntitle: ${slug}\nimpact: CRITICAL\nasi: [ASI01]\nphases: [floor]\n${sig ? `signature: ${sig}\n` : ""}---\n\nBody.\n`);
  }
  writeFileSync(join(mission, "floor.md"), [...HEAD, ...rows, "", ...extra].join("\n"));
  if (lock) writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify(lock));
  return { root, mission, floor: join(mission, "floor.md") };
}
const put = (root, rel, text) => { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), text); };
const only = (list, rule) => list.find((p) => p.rule === rule);

// ── the signature alarm ─────────────────────────────────────────────────────────────────────────

test("the alarm: case-insensitive, raised on a file that is missing or unreadable, and on a signature nobody can run", () => {
  const { root, mission } = project({ "r-case": "vault", "r-missing": "vault", "r-dir": "vault", "r-unsafe": "(a+)+$", "r-broken": "(" }, [
    "| r-case | proposed:applied | file:src/upper.ts |",
    "| r-missing | proposed:applied | file:src/gone.ts |",
    "| r-dir | proposed:applied | file:src/adir |",
    "| r-unsafe | proposed:applied | file:src/aaa.ts |",
    "| r-broken | proposed:applied | file:src/upper.ts |",
  ]);
  try {
    put(root, "src/upper.ts", "export const k = process.env.VAULT_TOKEN;\n");
    put(root, "src/aaa.ts", "aaaa");
    mkdirSync(join(root, "src", "adir"));
    const props = listProposals(mission, root);
    assert.equal(only(props, "r-case").signatureAlarm, false, "the gate matches case-insensitively, and so does the alarm");
    assert.equal(only(props, "r-missing").signatureAlarm, true, "a pointer nobody can open is not reassurance");
    assert.equal(only(props, "r-dir").signatureAlarm, true, "a directory cannot be read for the signature: alarming");
    assert.equal(only(props, "r-unsafe").signatureAlarm, true,
      "a signature the gate refuses to run is never run here either, even on a file it would match");
    assert.equal(only(props, "r-broken").signatureAlarm, true, "an uncompilable signature stays alarming");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the alarm and the unchecked flag belong to applied rows that cite a file, and to signed rules only", () => {
  const { root, mission } = project({ "r-na": "vault", "r-na2": "vault", "r-both": "vault", "r-unsigned": null, "r-applied": "vault" }, [
    "| r-na | proposed:n/a | single process, see file:src/plain.ts for the entry point |",
    "| r-na2 | proposed:n/a | single process, no queue anywhere |",
    "| r-both | proposed:applied | file:src/plain.ts adr:0001 |",
    "| r-unsigned | proposed:applied | reviewed by hand, nothing to point at |",
    "| r-applied | proposed:applied | file:src/vault.ts |",
  ]);
  try {
    put(root, "src/plain.ts", "export const nothing = 1;\n");
    put(root, "src/vault.ts", "export const k = process.env.vault;\n");
    const props = listProposals(mission, root);
    const na = only(props, "r-na");
    assert.equal(na.signatureAlarm, false, "an n/a reason is not evidence the signature can be looked for in (RWD-2026-0123)");
    assert.equal(na.signatureUnchecked, undefined, "and it is not an applied row left unchecked");
    assert.equal(na.signature, "vault");
    assert.deepEqual([only(props, "r-na2").signatureUnchecked, only(props, "r-na2").signatureAlarm], [undefined, false],
      "an n/a row citing nothing is not an applied row left unchecked either");
    const both = only(props, "r-both");
    assert.equal(both.signatureUnchecked, undefined, "a row that cites a file beside an ADR is checked, not unchecked");
    assert.equal(both.signatureAlarm, true, "and the file it cites lacks the signature");
    const unsigned = only(props, "r-unsigned");
    assert.ok(!("signature" in unsigned) && !("signatureUnchecked" in unsigned), "an unsigned rule carries no signature facts");
    assert.equal(unsigned.signatureAlarm, false);
    assert.deepEqual([only(props, "r-applied").signature, only(props, "r-applied").signatureAlarm], ["vault", false],
      "the signature a reader is shown beside a corroborated row");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── decided rows under the tier ─────────────────────────────────────────────────────────────────

test("a decided row is listed under its deliverable's label, with its own evidence, even when that is empty", () => {
  const { root, mission } = project({ "r-a": null, "r-b": null }, [
    "| r-a | applied |  |",
    "| r-b | n/a | single-process CLI, no queue here |",
  ], { lock: { regulated: true } });
  try {
    const rows = listDecidedUnbound(mission, root);
    assert.deepEqual(rows.map((r) => [r.rule, r.label, r.evidence, r.proposer, r.unbound]), [
      ["r-a", "Floor", "", null, "no-trace"],
      ["r-b", "Floor", "single-process CLI, no queue here", null, "no-trace"],
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── the names an agent writes ───────────────────────────────────────────────────────────────────

test("an agent's --accept names: runward/ prefix, commas and spaces tolerated, nothing invented", () => {
  const listed = [{ deliverable: "floor.md", rule: "r-a", proposer: null }, { deliverable: "floor.md", rule: "r-b", proposer: null },
    { deliverable: "governance/threat-model.md", rule: "r-g", proposer: null }];
  assert.deepEqual(resolveAgentAccept(listed, ["governance/runward/threat-model.md:r-g"], "bot", "Ada").unlisted,
    ["governance/runward/threat-model.md:r-g"], "runward/ is tolerated as a PREFIX, not wherever it appears");
  const r = resolveAgentAccept(listed, ["runward/floor.md:r-a, floor.md:r-b,", " "], "bot", "Ada");
  assert.deepEqual(r.rows.map((p) => p.rule), ["r-a", "r-b"]);
  assert.deepEqual(r.unlisted, [], "an empty name between commas names no row, and refuses nothing");
  assert.deepEqual(r.conflicts, []);
});

// ── what a ratification writes ──────────────────────────────────────────────────────────────────

test("a person's successive ratifications append to one block, line after line, and the table keeps its pipes", () => {
  const { root, mission, floor } = project({ "r-a": null, "r-b": null }, [
    "| r-a | proposed:applied | file:src/a.ts#pick \\| fallback ; proposer: Bob |",
    "| r-b | proposed:applied | file:src/b.ts ; proposer: Bob |",
  ]);
  try {
    let props = listProposals(mission, root);
    assert.equal(only(props, "r-a").evidence, "file:src/a.ts#pick | fallback", "the reader unescapes the pipe");
    const one = applyDecisions(mission, props, [{ rule: "r-a", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-28", mode: "line-by-line" });
    assert.deepEqual(one, { accepted: 1, rejected: 0, deliverables: ["floor.md"] });
    props = listProposals(mission, root);
    applyDecisions(mission, props, [{ rule: "r-b", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-29", mode: "line-by-line" });
    const text = readFileSync(floor, "utf8");
    const rows = parseManifest(text);
    assert.deepEqual(rows.map((r) => [r.rule, r.status, r.evidence]), [
      ["r-a", "applied", "file:src/a.ts#pick | fallback"],
      ["r-b", "applied", "file:src/b.ts"],
    ], "the pipe is written back escaped: still three columns");
    assert.match(text, /^\| r-a \| applied \| file:src\/a\.ts#pick \\\| fallback \|$/m,
      "escaped in the file itself, so a forge renders three columns too");
    const da = rowDigest(rows[0]), db = rowDigest(rows[1]);
    assert.ok(text.startsWith("# Floor\n"), "nothing is written before the deliverable");
    assert.ok(text.endsWith([
      "### Ratification",
      `- 2026-09-28 · rows: r-a · by: Ada (declared) · proposer: Bob (declared) · bound: r-a@${da} · mode: line-by-line`,
      `- 2026-09-29 · rows: r-b · by: Ada (declared) · proposer: Bob (declared) · bound: r-b@${db} · mode: line-by-line`,
      "",
    ].join("\n")), text);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("blank lines a hand edit left after the block are folded, never accumulated between entries", () => {
  const { root, mission, floor } = project({ "r-a": null }, ["| r-a | proposed:applied | file:src/a.ts ; proposer: Bob |"],
    { extra: ["### Ratification", "", "- 2026-09-01 · rows: r-old · by: Ada (declared) · mode: line-by-line", "", "", ""] });
  try {
    applyDecisions(mission, listProposals(mission, root), [{ rule: "r-a", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-28", mode: "line-by-line" });
    assert.match(readFileSync(floor, "utf8"), /mode: line-by-line\n- 2026-09-28 · rows: r-a · /, "the new entry follows the last one directly");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a rule whose slug holds a regex metacharacter is ratified like any other", () => {
  const { root, mission, floor } = project({ "r.v2": null }, ["| r.v2 | proposed:applied | file:src/a.ts ; proposer: Bob |"]);
  try {
    const res = applyDecisions(mission, listProposals(mission, root), [{ rule: "r.v2", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-28", mode: "line-by-line" });
    assert.equal(res.accepted, 1);
    assert.match(readFileSync(floor, "utf8"), /^\| r\.v2 \| applied \| file:src\/a\.ts \|$/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a row decided by hand after it was listed is not overwritten, and nothing is recorded or reported written", () => {
  const { root, mission, floor } = project({ "r-a": null }, ["| r-a | proposed:applied | file:src/a.ts ; proposer: Bob |"]);
  try {
    const props = listProposals(mission, root);
    writeFileSync(floor, readFileSync(floor, "utf8").replace("| r-a | proposed:applied | file:src/a.ts ; proposer: Bob |",
      "| r-a | n/a | decided by hand meanwhile, no queue here |"));
    const before = readFileSync(floor, "utf8");
    const res = applyDecisions(mission, props, [{ rule: "r-a", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-28", mode: "line-by-line" });
    assert.deepEqual(res, { accepted: 0, rejected: 0, deliverables: [] });
    assert.equal(readFileSync(floor, "utf8"), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("binding a hand-decided row keeps the row's own bytes", () => {
  const { root, mission, floor } = project({ "r-a": null }, ["|r-a|applied|`file:src/a.ts`  and a note|"], { lock: { regulated: true } });
  try {
    const decided = listDecidedUnbound(mission, root);
    applyDecisions(mission, decided, [{ rule: "r-a", deliverable: "floor.md", decision: "accept" }],
      { by: "Ada", date: "2026-09-28", mode: "line-by-line" });
    assert.match(readFileSync(floor, "utf8"), /^\|r-a\|applied\|`file:src\/a\.ts`  and a note\|$/m);
    assert.deepEqual(listDecidedUnbound(mission, root), [], "and the binding reads back");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an agent's entry per proposer: its own rows, its own digests, no proposer invented", () => {
  const { root, mission, floor } = project({ "r-a": null, "r-b": null, "r-c": null, "r-d": null }, [
    "| r-a | proposed:applied | file:src/a.ts ; proposer: Bob |",
    "| r-b | proposed:applied | file:src/b.ts ; proposer: Bob |",
    "| r-c | proposed:applied | file:src/c.ts ; proposer: Eve |",
    "| r-d | applied | file:src/d.ts |",
  ], { lock: { regulated: true, agentRatification: true } });
  try {
    const accept = (rule) => ({ rule, deliverable: "floor.md", decision: "accept" });
    applyDecisions(mission, listProposals(mission, root), ["r-a", "r-b", "r-c"].map(accept),
      { by: "bot", date: "2026-09-28", mode: "agent", agent: { for: "Ada" } });
    applyDecisions(mission, listDecidedUnbound(mission, root).filter((p) => p.rule === "r-d"), [accept("r-d")],
      { by: "bot", date: "2026-09-29", mode: "agent", agent: { for: "Ada" } });
    const text = readFileSync(floor, "utf8");
    const d = Object.fromEntries(parseManifest(text).map((r) => [r.rule, rowDigest(r)]));
    const block = text.slice(text.indexOf("### Ratification")).split("\n").filter((l) => l.startsWith("- "));
    assert.deepEqual(block, [
      `- 2026-09-28 · rows: r-a, r-b · by: bot (declared, agent) · for: Ada (declared, accountable) · proposer: Bob (declared) · bound: r-a@${d["r-a"]}, r-b@${d["r-b"]} · mode: agent`,
      `- 2026-09-28 · rows: r-c · by: bot (declared, agent) · for: Ada (declared, accountable) · proposer: Eve (declared) · bound: r-c@${d["r-c"]} · mode: agent`,
      `- 2026-09-29 · rows: r-d · by: bot (declared, agent) · for: Ada (declared, accountable) · bound: r-d@${d["r-d"]} · mode: agent`,
    ]);
    assert.equal(readRatification(text)[2].proposer, undefined, "a hand-decided row has no proposer, and none is written");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── the bloc ────────────────────────────────────────────────────────────────────────────────────

test("an accepted sample hands the writer an accept for every unseen row, and the mode the ledger counts", () => {
  const { root, mission } = project({ "r-a": null, "r-b": null, "r-c": null, "r-d": null },
    ["r-a", "r-b", "r-c", "r-d"].map((r) => `| ${r} | proposed:applied | file:src/${r}.ts ; proposer: Bob |`));
  try {
    const props = listProposals(mission, root);
    const sample = props.slice(0, 2);
    const o = blocOutcome(props, sample, sample.map((p) => ({ rule: p.rule, deliverable: p.deliverable, decision: "accept" })));
    assert.deepEqual(o.decisions.slice(2), [
      { rule: "r-c", deliverable: "floor.md", decision: "accept" },
      { rule: "r-d", deliverable: "floor.md", decision: "accept" },
    ]);
    assert.equal(o.mode, "en bloc (sample 2/4, sampled rows accepted 2/2)");
    applyDecisions(mission, props, o.decisions, { by: "Ada", date: "2026-09-28", mode: o.mode });
    const led = ratificationLedger(mission);
    assert.deepEqual([led.enBloc, led.lineByLine, led.untraced], [4, 0, 0]);
    assert.deepEqual(parseManifest(readFileSync(join(mission, "floor.md"), "utf8")).map((r) => r.status),
      ["applied", "applied", "applied", "applied"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── the excerpt ─────────────────────────────────────────────────────────────────────────────────

test("the excerpt: a cited first line, a symbol or a signature on the first line, and a signature that matches nothing", () => {
  const text = "const vault = open();\nexport function pick() {}\n";
  assert.deepEqual(excerptAnchor(text, { line: 1 }), { line: 1, note: null }, "line 1 is a cited line like any other");
  assert.deepEqual(excerptAnchor(text, { symbol: "vault" }), { line: 1, note: null }, "a symbol on the first line is found");
  assert.equal(excerptAnchor(text, {}, "VAULT").line, 1, "a signature matching the first line anchors there");
  assert.deepEqual(excerptAnchor(text, {}, "secret"), { line: 1, note: "no line or symbol cited: showing the top of the file" },
    "a signature that matches nothing shows the top, and says so");
  assert.deepEqual(excerptAnchor(text, {}, "("), { line: 1, note: "no line or symbol cited: showing the top of the file" },
    "a signature nobody can compile anchors nothing");
});

test("the alarm on a file the gate cannot read", { skip: process.platform === "win32" ? "chmod has no effect on Windows" : process.getuid?.() === 0 ? "root reads everything" : false }, () => {
  const { root, mission } = project({ "r-a": "vault" }, ["| r-a | proposed:applied | file:src/locked.ts |"]);
  try {
    put(root, "src/locked.ts", "export const vault = 1;\n");
    chmodSync(join(root, "src", "locked.ts"), 0o000);
    assert.equal(only(listProposals(mission, root), "r-a").signatureAlarm, true, "unreadable stays alarming");
  } finally { chmodSync(join(root, "src", "locked.ts"), 0o600); rmSync(root, { recursive: true, force: true }); }
});
