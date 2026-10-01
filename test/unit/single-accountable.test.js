// ADR-0088 decision 4: independence fixed, and never claimed where it does not exist.
//
// What is pinned here: names resolve to canonical ids (folded, alias-resolved, ambiguity resolves to
// nobody); how the person accountable for a ratifying agent relates to the row's proposer, branch by
// branch; `propose --for` records the proposer's accountable person in the row and `ratify` carries it
// into the trace; a ratification whose accountable person also answers for the proposer is refused
// except as `agent (single accountable)`, which a default mission counts and discloses with the exact
// sentence, and the regulated tier refuses by default and, under the lock's `singleAccountable`
// exception, names as a strict gap until a signed sample exists; `update` keeps the declarations;
// `doctor` sets each entry's declared `by:` beside the identity git recorded as committing it.
//
// RWD-2026-0164 is reproduced first: the two traces the old free-string comparison counted as
// independent under the regulated tier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readRatification, ratificationLedger, unboundRatifications, rowDigest, accountableRelation, UNBOUND_CAUSE_TEXT,
} from "../../dist/lib/conformance.js";
import { splitProposer, resolveAgentAccept } from "../../dist/lib/ratify.js";
import {
  foldName, resolveIdentity, readIdentities, singleAccountableOptIn, forgeLoginFromEmail, byMatchesCommitter,
  SINGLE_ACCOUNTABLE_DISCLOSURE, SINGLE_ACCOUNTABLE_REGULATED_NOTE,
} from "../../dist/lib/identity.js";
import { renderScaffoldLock } from "../../dist/lib/scaffold-lock.js";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const S1 = "single accountable person; agent ratifications are disclosed throughput, not independent approval";
const S2 = "not a DORA change-approval control; ADR-0080 Part 2 unchanged";
const ME = { "github:stranxik": ["stranxik", "thibaultsouris"] };

// ── the direct readers ──────────────────────────────────────────────────────────────────────────

const ROW = { rule: "r-a", status: "applied", evidence: "file:src/a.ts" };
const DIGEST = rowDigest(ROW);
const floorWith = (entries) => [
  "# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
  "| r-a | applied | file:src/a.ts |", "", "### Ratification", "", ...entries, "",
].join("\n");
const agentLine = (segments) => `- 2026-10-01 · rows: r-a · ${segments} · bound: r-a@${DIGEST} · mode: agent`;
function missionDir(lock) {
  const dir = mkdtempSync(join(tmpdir(), "rw-single-"));
  writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify(lock));
  return dir;
}
const causeOf = (lock, segments) => {
  const dir = missionDir(lock);
  try {
    writeFileSync(join(dir, "floor.md"), floorWith([agentLine(segments)]));
    return unboundRatifications(dir).map((u) => u.cause);
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test("the exact sentences of ADR-0088 decision 4", () => {
  assert.equal(SINGLE_ACCOUNTABLE_DISCLOSURE, S1);
  assert.equal(SINGLE_ACCOUNTABLE_REGULATED_NOTE, S2);
});

test("a name resolves to a canonical id: folded, alias-resolved, and an ambiguous alias resolves to nobody", () => {
  assert.equal(foldName("Thibault Souris"), "thibaultsouris");
  assert.equal(foldName("  Thibault-Souris "), "thibaultsouris");
  assert.deepEqual(resolveIdentity("Thibault Souris", ME), { id: "github:stranxik", declared: true });
  assert.deepEqual(resolveIdentity("thibaultsouris", ME), { id: "github:stranxik", declared: true });
  assert.deepEqual(resolveIdentity("STRANXIK", ME), { id: "github:stranxik", declared: true });
  assert.deepEqual(resolveIdentity("github:stranxik", ME), { id: "github:stranxik", declared: true }, "the id is its own spelling");
  assert.deepEqual(resolveIdentity("Alice", ME), { id: "alice", declared: false }, "undeclared: the folded name, said to be undeclared");
  assert.deepEqual(resolveIdentity("Sam", { "a": ["Sam"], "b": ["sam"] }), { id: "sam", declared: false }, "one alias, two ids: neither");
  assert.deepEqual(resolveIdentity("", ME), { id: "", declared: false });
});

test("the lock's identities are read as declared, malformed entries dropped, and singleAccountable only when a name", () => {
  const dir = missionDir({ identities: { "github:a": ["A", 3, ""], "": ["x"], "github:b": "B" }, singleAccountable: "github:a" });
  try {
    assert.deepEqual(readIdentities(dir), { "github:a": ["A"] });
    assert.equal(singleAccountableOptIn(dir), "github:a");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  for (const lock of [{}, { identities: ["x"] }, { singleAccountable: "" }, { singleAccountable: 7 }]) {
    const d = missionDir(lock);
    try { assert.equal(singleAccountableOptIn(d), null); assert.deepEqual(readIdentities(d), {}); }
    finally { rmSync(d, { recursive: true, force: true }); }
  }
  const none = mkdtempSync(join(tmpdir(), "rw-single-nolock-"));
  try { assert.deepEqual(readIdentities(none), {}); assert.equal(singleAccountableOptIn(none), null); }
  finally { rmSync(none, { recursive: true, force: true }); }
});

test("how the ratifier's accountable person relates to the proposer, branch by branch", () => {
  const rel = (x, ids = ME) => accountableRelation(x, ids);
  assert.deepEqual(rel({ agent: "claude", accountable: "Ada", proposer: "Claude (agent)" }), { relation: "agent-proposed", declared: false });
  assert.deepEqual(rel({ agent: "bot", accountable: "Ada", proposer: null }), { relation: "unreadable", declared: false });
  assert.deepEqual(rel({ agent: "bot", proposer: "Bob" }), { relation: "unreadable", declared: false }, "no accountable person on the trace");
  assert.deepEqual(rel({ agent: "codex", accountable: "thibaultsouris", proposer: "claude" }), { relation: "unreadable", declared: false },
    "a proposer that names an agent, with no `for:`: nothing says who answers for it");
  assert.deepEqual(rel({ agent: "codex", accountable: "thibaultsouris", proposer: "claude", proposerFor: "Thibault Souris" }),
    { relation: "same-accountable", declared: true });
  assert.deepEqual(rel({ agent: "codex", accountable: "Thibault Souris", proposer: "stranxik" }), { relation: "same-accountable", declared: true },
    "a proposer that is itself a declared identity");
  assert.deepEqual(rel({ agent: "codex", accountable: "stranxik", proposer: "claude, for thibaultsouris" }), { relation: "same-accountable", declared: true },
    "a pre-ADR-0088 proposer naming the person in its prose, under any declared spelling");
  assert.deepEqual(rel({ agent: "codex", accountable: "thibaultsouris", proposer: "Thibault Souris" }, {}), { relation: "same-accountable", declared: false },
    "undeclared, the fold still reads one person");
  assert.deepEqual(rel({ agent: "codex", accountable: "Ada", proposer: "claude", proposerFor: "stranxik" }, { ...ME, "github:ada": ["Ada"] }),
    { relation: "independent", declared: true });
  assert.deepEqual(rel({ agent: "codex", accountable: "Ada", proposer: "claude", proposerFor: "stranxik" }), { relation: "independent", declared: false },
    "independent, but one side undeclared");
});

test("propose's `; for:` segment is read out of the cell, additively", () => {
  assert.deepEqual(splitProposer("file:a.ts ; proposer: runward propose v1 (signature matched) ; for: Ada"),
    { evidence: "file:a.ts", proposer: "runward propose v1 (signature matched)", proposerFor: "Ada" });
  assert.deepEqual(splitProposer("file:a.ts ; proposer: claude"), { evidence: "file:a.ts", proposer: "claude" }, "no `for:`, the old shape");
  assert.deepEqual(splitProposer("file:a.ts ; proposer: claude ; for:  "), { evidence: "file:a.ts", proposer: "claude" }, "an empty `for:` records nobody");
});

test("the trace's proposer-for and independence segments are read back", () => {
  const [e] = readRatification(floorWith([agentLine("by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: Ada (declared, accountable) · independence: single accountable")]));
  assert.equal(e.proposerFor, "Ada");
  assert.equal(e.singleAccountable, true);
  assert.equal(e.mode, "agent");
  const [o] = readRatification(floorWith([agentLine("by: codex (declared, agent) · for: Ada (declared, accountable) · independence: something else")]));
  assert.equal(o.singleAccountable, undefined, "only the exact value marks the exception");
  assert.equal(o.proposerFor, undefined);
});

test("RWD-2026-0164 reproduced: two traces the free-string comparison counted as independent are now named gaps", () => {
  const base = { regulated: true, agentRatification: true };
  // (1) `--for thibaultsouris` against a proposer written `Thibault Souris`: one person, two spellings.
  assert.deepEqual(causeOf({ ...base, identities: ME }, "by: codex (declared, agent) · for: thibaultsouris (declared, accountable) · proposer: Thibault Souris (declared)"), ["agent-proposer"]);
  // (2) two agents answering to the same person, the proposer segment naming the agent.
  assert.deepEqual(causeOf({ ...base, identities: ME }, "by: codex (declared, agent) · for: thibaultsouris (declared, accountable) · proposer: claude (declared)"), ["agent-unattributed"]);
  assert.deepEqual(causeOf({ ...base, identities: ME }, "by: codex (declared, agent) · for: thibaultsouris (declared, accountable) · proposer: claude (declared) · proposer-for: stranxik (declared, accountable)"), ["agent-proposer"]);
  // Positive control: two declared people, the row counts.
  assert.deepEqual(causeOf({ ...base, identities: { ...ME, "github:ada": ["Ada"] } }, "by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: stranxik (declared, accountable)"), []);
});

test("under the regulated tier: undeclared identities, the refused exception, and the exception awaiting its signed sample", () => {
  const base = { regulated: true, agentRatification: true };
  const single = "by: codex (declared, agent) · for: thibaultsouris (declared, accountable) · proposer: claude (declared) · proposer-for: Thibault Souris (declared, accountable) · independence: single accountable";
  assert.deepEqual(causeOf(base, "by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: Bob (declared, accountable)"), ["agent-identity-undeclared"]);
  assert.deepEqual(causeOf({ ...base, identities: ME }, single), ["single-accountable-refused"], "the lock names no exception");
  assert.deepEqual(causeOf({ ...base, identities: { ...ME, "github:ada": ["Ada"] }, singleAccountable: "github:ada" }, single), ["single-accountable-refused"], "the exception names someone else");
  assert.deepEqual(causeOf({ ...base, identities: ME, singleAccountable: "nobody-declared" }, single), ["single-accountable-refused"], "an exception naming no declared id grants nothing");
  assert.deepEqual(causeOf({ ...base, identities: ME, singleAccountable: "Thibault Souris" }, single), ["single-accountable-unsampled"], "named by an alias: no signed sample yet");
  assert.deepEqual(causeOf({ ...base, identities: ME, singleAccountable: "github:stranxik" }, single.replace("by: codex", "by: claude")), ["agent-proposer"], "the exception never covers an agent ratifying its own proposal");
  assert.deepEqual(causeOf({ regulated: true, identities: ME, singleAccountable: "github:stranxik" }, single), ["agent-not-accepted"], "agentRatification still comes first");
  assert.match(UNBOUND_CAUSE_TEXT["single-accountable-unsampled"], /no signed sample yet \(not a DORA change-approval control; ADR-0080 Part 2 unchanged\)$/);
  assert.match(UNBOUND_CAUSE_TEXT["single-accountable-refused"], /not a DORA change-approval control; ADR-0080 Part 2 unchanged/);
});

test("the ledger counts single-accountable rows apart, with the sentence; absent when there are none", () => {
  const ledger = (lock, segments) => {
    const dir = missionDir(lock);
    try { writeFileSync(join(dir, "floor.md"), floorWith([agentLine(segments)])); return ratificationLedger(dir); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const marked = "by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: Ada (declared, accountable) · independence: single accountable";
  assert.deepEqual(ledger({}, marked).singleAccountable, { rows: 1, disclosure: [S1] });
  assert.deepEqual(ledger({ regulated: true }, marked).singleAccountable, { rows: 1, disclosure: [S1, S2] });
  // read from the names even when the entry does not declare it (a line typed by hand)
  assert.deepEqual(ledger({}, marked.replace(" · independence: single accountable", "")).singleAccountable, { rows: 1, disclosure: [S1] });
  const l = ledger({}, "by: codex (declared, agent) · for: Ada (declared, accountable) · proposer: claude (declared) · proposer-for: Bob (declared, accountable)");
  assert.equal("singleAccountable" in l, false, "an independent row adds no field: an attestation sealed before it still verifies");
});

test("resolveAgentAccept: the same accountable person is a conflict, or a single-accountable row with the flag; the agent's own row never", () => {
  const listed = [
    { deliverable: "floor.md", rule: "a", proposer: "claude", proposerFor: "Thibault Souris" },
    { deliverable: "floor.md", rule: "b", proposer: "codex" },
  ];
  const plain = resolveAgentAccept(listed, ["floor.md:a"], "codex2", "stranxik", { identities: ME });
  assert.deepEqual(plain.conflicts, [{ id: "floor.md:a", party: "accountable", proposer: "claude, for Thibault Souris" }]);
  const flagged = resolveAgentAccept(listed, ["floor.md:a"], "codex2", "stranxik", { identities: ME, singleAccountable: true });
  assert.deepEqual(flagged.single.map((p) => p.rule), ["a"]);
  assert.deepEqual(flagged.conflicts, []);
  const own = resolveAgentAccept(listed, ["floor.md:b"], "codex", "stranxik", { identities: ME, singleAccountable: true });
  assert.equal(own.conflicts[0].party, "agent");
});

test("the lock writer emits identities and singleAccountable only when given, as given", () => {
  assert.doesNotMatch(renderScaffoldLock("x", {}, null, true, true, true), /identities|singleAccountable/);
  const j = JSON.parse(renderScaffoldLock("x", {}, null, true, true, true, { identities: ME, singleAccountable: "github:stranxik" }));
  assert.deepEqual(j.identities, ME);
  assert.equal(j.singleAccountable, "github:stranxik");
});

// ── through the CLI ─────────────────────────────────────────────────────────────────────────────

/** A fresh mission with two signature-corroborated proposals written by `propose --for`. */
function proposed(forWhom, lockExtra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rw-single-cli-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "--yes", "init");
  run(dir, "manifest", "--sync");
  mkdirSync(join(dir, "code", "config"), { recursive: true });
  writeFileSync(join(dir, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
  const lock = join(dir, "runward", "scaffold-lock.json");
  writeFileSync(lock, JSON.stringify({ ...JSON.parse(readFileSync(lock, "utf8")), ...lockExtra }, null, 2) + "\n");
  const p = run(dir, "propose", ...(forWhom ? ["--for", forWhom] : []));
  assert.equal(p.code, 0, p.out);
  return dir;
}

test("propose --for records the proposer's accountable person in each row; an unusable name is refused before anything is written", () => {
  const dir = proposed("Thibault Souris");
  try {
    const floor = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    assert.match(floor, /\| config-secrets-boundary \| proposed:applied \| file:code\/config\/settings\.ts ; proposer: runward propose v[\d.]+ \(signature matched\) ; for: Thibault Souris \|/);
    const before = floor;
    for (const bad of ["", "  ", "a ; b", "a · b", "a | b"]) {
      const r = run(dir, "propose", "--for", bad);
      assert.equal(r.code, 2, `refused: ${JSON.stringify(bad)}`);
      assert.match(r.out, /nothing written/);
    }
    assert.equal(readFileSync(join(dir, "runward", "floor.md"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const j = mkdtempSync(join(tmpdir(), "rw-single-json-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: j });
    run(j, "--yes", "init"); run(j, "manifest", "--sync");
    mkdirSync(join(j, "code", "config"), { recursive: true });
    writeFileSync(join(j, "code", "config", "settings.ts"), "export const key = process.env.vault_secret;\n");
    const doc = JSON.parse(run(j, "propose", "--for", "Ada", "--json").out);
    assert.ok(doc.proposals.length > 0 && doc.proposals.every((x) => x.for === "Ada"));
  } finally { rmSync(j, { recursive: true, force: true }); }
});

test("a default mission: refused without --single-accountable, recorded and disclosed on every surface with it", () => {
  const dir = proposed("Thibault Souris", { identities: ME });
  try {
    const id = "floor.md:config-secrets-boundary";
    const no = run(dir, "ratify", "--agent", "codex", "--for", "thibaultsouris", "--accept", id);
    assert.equal(no.code, 2);
    assert.match(no.out, /also answers for its declared proposer \("runward propose v[\d.]+ \(signature matched\), for Thibault Souris"\), compared by canonical id/);
    assert.equal(run(dir, "ratify", "--single-accountable").code, 2, "the flag is the agent path's");
    const yes = run(dir, "ratify", "--agent", "codex", "--for", "thibaultsouris", "--single-accountable", "--accept", id);
    assert.equal(yes.code, 0, yes.out);
    assert.match(yes.out, new RegExp(`1 row\\(s\\) recorded as agent \\(single accountable\\): ${escapeRegExp(S1)}`));
    const floor = readFileSync(join(dir, "runward", "floor.md"), "utf8");
    assert.match(floor, /^- \d{4}-\d{2}-\d{2} · rows: config-secrets-boundary · by: codex \(declared, agent\) · for: thibaultsouris \(declared, accountable\) · proposer: runward propose v[\d.]+ \(signature matched\) \(declared\) · proposer-for: Thibault Souris \(declared, accountable\) · independence: single accountable · bound: config-secrets-boundary@[0-9a-f]{16} · mode: agent$/m);
    const c = run(dir, "check", "--strict");
    assert.match(c.out, new RegExp(`1 row\\(s\\) ratified as agent \\(single accountable\\) — ${escapeRegExp(S1)} \\(runward ADR-0088\\)`));
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.deepEqual(j.ratification.singleAccountable, { rows: 1, disclosure: [S1] });
    const sarif = JSON.parse(run(dir, "check", "--strict", "--sarif").out);
    assert.deepEqual(sarif.runs[0].properties.agentRatification.singleAccountable, { rows: 1, disclosure: [S1] });
    assert.equal(run(dir, "report").code, 0);
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.ok(html.includes(`1 row(s) ratified as agent (single accountable): ${S1}.`), "the report carries the sentence");
    // control: an independent accountable person needs no flag and adds no disclosure
    const other = run(dir, "ratify", "--agent", "codex", "--for", "Ada", "--accept", "governance/threat-model.md:config-secrets-boundary");
    assert.equal(other.code, 0, other.out);
    assert.equal(JSON.parse(run(dir, "check", "--strict", "--json").out).ratification.singleAccountable.rows, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the regulated tier: refused by default, a named gap 'no signed sample yet' under the lock's exception, never silently counted", () => {
  const lock = { regulated: true, agentRatification: true, identities: ME };
  const dir = proposed("Thibault Souris", lock);
  try {
    const id = "floor.md:config-secrets-boundary";
    const r = run(dir, "ratify", "--agent", "codex", "--for", "thibaultsouris", "--single-accountable", "--accept", id);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /refused by default: scaffold-lock\.json does not name "singleAccountable".*not a DORA change-approval control; ADR-0080 Part 2 unchanged\./);
    const before = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(before.regulated.unbound.some((u) => u.rule === "config-secrets-boundary" && u.deliverable === "floor.md" && u.cause === "single-accountable-refused"));
    assert.deepEqual(before.ratification.singleAccountable, { rows: 1, disclosure: [S1, S2] });
    const lp = join(dir, "runward", "scaffold-lock.json");
    writeFileSync(lp, JSON.stringify({ ...JSON.parse(readFileSync(lp, "utf8")), singleAccountable: "github:stranxik" }, null, 2) + "\n");
    const after = run(dir, "check", "--strict");
    assert.equal(after.code, 1);
    assert.match(after.out, /no signed sample yet \(not a DORA change-approval control; ADR-0080 Part 2 unchanged\)/);
    const j = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.ok(j.regulated.unbound.some((u) => u.rule === "config-secrets-boundary" && u.cause === "single-accountable-unsampled"));
    // `update` keeps both declarations
    run(dir, "update");
    const kept = JSON.parse(readFileSync(lp, "utf8"));
    assert.deepEqual(kept.identities, ME);
    assert.equal(kept.singleAccountable, "github:stranxik");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── `by:` beside the identity that committed it ─────────────────────────────────────────────────

test("a GitHub no-reply address names its account; byMatchesCommitter folds and resolves aliases", () => {
  assert.equal(forgeLoginFromEmail("5150097+runward-steward[bot]@users.noreply.github.com"), "runward-steward[bot]");
  assert.equal(forgeLoginFromEmail("stranxik@users.noreply.github.com"), "stranxik");
  assert.equal(forgeLoginFromEmail("someone@example.com"), null);
  assert.equal(byMatchesCommitter("thibaultsouris", { name: "Thibault Souris", email: "x@example.com" }, {}), true);
  assert.equal(byMatchesCommitter("stranxik", { name: "Thibault Souris", email: "x@example.com" }, ME), true, "an alias");
  assert.equal(byMatchesCommitter("runward-steward[bot]", { name: "runward-steward[bot]", email: "1+runward-steward[bot]@users.noreply.github.com" }, {}), true);
  assert.equal(byMatchesCommitter("codex", { name: "Thibault Souris", email: "stranxik@example.com" }, ME), false);
});

test("doctor sets each entry's declared by: beside the identity git committed it under, and warns only for an agent's", () => {
  const dir = proposed("Ada");
  const git = (...a) => execFileSync("git", ["-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "pipe" });
  try {
    run(dir, "ratify", "--agent", "codex", "--for", "Bob", "--accept", "floor.md:config-secrets-boundary");
    let d = JSON.parse(run(dir, "doctor", "--json").out);
    assert.deepEqual(d.ratifiers.map((b) => [b.deliverable, b.by, b.agent, b.committer, b.bound]), [["floor.md", "codex", true, null, null]], "not committed: as declared");
    git("add", "-A"); git("commit", "-q", "-m", "x");
    const r = run(dir, "doctor", "--json");
    d = JSON.parse(r.out);
    assert.equal(d.ratifiers[0].bound, false);
    assert.equal(d.ratifiers[0].committer.name, "Ada Lovelace");
    assert.ok(d.checks.some((x) => x.section === "ratifiers" && x.status === "warning" && /1 agent ratification entr\(ies\) committed under another identity than the declared `by:`/.test(x.message)));
    // control: an entry whose by: is the committer binds
    const fp = join(dir, "runward", "governance", "threat-model.md");
    const t = readFileSync(fp, "utf8");
    writeFileSync(fp, t.replace(/\s*$/, "\n") + "\n### Ratification\n- 2026-10-01 · rows: x · by: ada-lovelace (declared) · mode: line-by-line\n");
    git("add", "-A"); git("commit", "-q", "-m", "y");
    d = JSON.parse(run(dir, "doctor", "--json").out);
    const own = d.ratifiers.find((b) => b.deliverable === "governance/threat-model.md");
    assert.equal(own.bound, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
