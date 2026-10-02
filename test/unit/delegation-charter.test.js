// ADR-0088 decision 5: a charter the gate reads, which proves nothing by itself (runward/delegation.md);
// and decision 1's stage banner.
//
// What is pinned here: the charter's schema, every malformation named; class I refused in stage 1, R
// and H never delegated, stage 2 named as unread; an agent ratification by a non-delegate, or dated
// after the charter expired, named on its row; expiry read from the dates the tree declares, never
// from the clock (ADR-0054: the same tree gives the same verdict on any day); `doctor` setting
// `expires:` beside the clock; the banner, at the character, on `check` (text, JSON, SARIF), `report`
// and `doctor`; the charter's identities merged over the lock's, the charter first; `init` and `wire`
// never writing a charter; `verify` re-deriving the block; and no charter, no change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCharter, readCharter, isDelegate, missionIdentities, isoDay,
  DELEGATION_STAGE1_BANNER, CHARTER_BANNER, CHARTER_MAX_DAYS,
} from "../../dist/lib/delegation.js";
import { charterActGaps, rowDigest, unboundRatifications } from "../../dist/lib/conformance.js";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { buildSarif } from "../../dist/lib/sarif.js";
import { resolveIdentity } from "../../dist/lib/identity.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, args, env = {}) => {
  try { return { out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...ENV, ...env }, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const B1 = "delegation: declared, not proved — the maintainer's credential is within agent reach";
const B2 = "charter: declared, not proved";

/** A well-formed stage-1 charter; `over` replaces or removes (`null`) single lines by key. */
function charterText(over = {}) {
  const fields = {
    charter: "runward-delegation/1",
    stage: "1",
    accountable: "github:stranxik",
    aliases: "[stranxik, Thibault Souris, thibaultsouris]",
    delegates: "\n  - runward-steward[bot]\n  - claude",
    "class-R": "maintainer", "class-H": "maintainer", "class-I": "refused", "class-D": "delegated",
    "scope-D": "\n  - merges outside the pre-merge list, by an agent\n  - documentation syncs",
    "budget-consecutive-refusals": "3", "budget-refusals-per-period": "20",
    "sample-size": "5", "sample-seeds": "1", "sample-period-days": "7",
    effective: "2026-10-02", expires: "2026-12-31",
    "pre-merge-paths": "\n  - src/lib/conformance*\n  - .github/**\n  - runward/delegation.md",
    "pre-merge-events": "[disagreement between agents, a ratchet drop]",
    ...over,
  };
  const lines = Object.entries(fields).filter(([, v]) => v !== null)
    .map(([k, v]) => (v.startsWith("\n") ? `${k}:${v}` : `${k}: ${v}`));
  return ["---", ...lines, "---", "", "# Delegation charter", "", "Prose the gate does not read."].join("\n");
}

test("the exact banners of ADR-0088 decisions 1 and 5", () => {
  assert.equal(DELEGATION_STAGE1_BANNER, B1);
  assert.equal(CHARTER_BANNER, B2);
  assert.equal(CHARTER_MAX_DAYS, 90);
});

test("a well-formed stage-1 charter parses with no problem, inline and block lists alike", () => {
  const c = parseCharter(charterText());
  assert.deepEqual(c.problems, []);
  assert.equal(c.stage, 1);
  assert.equal(c.accountable, "github:stranxik");
  assert.deepEqual(c.aliases, ["stranxik", "Thibault Souris", "thibaultsouris"]);
  assert.deepEqual(c.delegates, ["runward-steward[bot]", "claude"], "the bracket of a bot login survives the list grammar");
  assert.deepEqual(c.classes, { R: "maintainer", H: "maintainer", I: "refused", D: "delegated" });
  assert.deepEqual(c.scopes.D, ["merges outside the pre-merge list, by an agent", "documentation syncs"], "a block list item may carry commas");
  assert.deepEqual(c.budgets, { consecutiveRefusals: 3, refusalsPerPeriod: 20 });
  assert.deepEqual(c.sample, { size: 5, seeds: 1, periodDays: 7 });
  assert.deepEqual(c.preMerge, { paths: ["src/lib/conformance*", ".github/**", "runward/delegation.md"], events: ["disagreement between agents", "a ratchet drop"] });
  assert.ok(isDelegate(c, "Claude") && isDelegate(c, "runward-steward[bot]"), "delegates compared folded");
  assert.ok(!isDelegate(c, "codex") && !isDelegate(c, undefined) && !isDelegate(c, " "));
  // The shipped template is not a charter until filled: every placeholder is a named problem.
  const tpl = parseCharter(readFileSync(join(ROOT, "templates", "delegation", "delegation.md"), "utf8"));
  assert.ok(tpl.problems.some((p) => /accountable: .*placeholder/.test(p.problem)), JSON.stringify(tpl.problems));
  assert.ok(tpl.problems.some((p) => /^effective: "YYYY-MM-DD"/.test(p.problem)));
  assert.ok(tpl.problems.every((p) => p.kind === "charter-malformed"));
});

test("every malformation of the charter is named, never repaired", () => {
  const problems = (over) => parseCharter(charterText(over)).problems.map((p) => p.problem);
  const has = (over, re) => {
    const ps = problems(over);
    assert.ok(ps.some((p) => re.test(p)), `${JSON.stringify(over)} → ${JSON.stringify(ps)}`);
  };
  assert.match(parseCharter("# no frontmatter\n").problems[0].problem, /^no frontmatter/);
  has({ charter: "runward-delegation/9" }, /^charter: "runward-delegation\/9"/);
  has({ stage: "3" }, /^stage: "3"/);
  has({ accountable: null }, /^accountable: missing/);
  has({ delegates: "[]" }, /^delegates: none listed/);
  has({ delegates: "[claude, Thibault Souris]" }, /"Thibault Souris" is the accountable person/);
  has({ "class-D": "sometimes" }, /^class-D: "sometimes"/);
  has({ "class-R": null }, /^class-R: missing/);
  has({ "sample-size": "0" }, /^sample-size: "0"/);
  has({ "sample-seeds": "x" }, /^sample-seeds: "x"/);
  has({ effective: "2026-02-30" }, /^effective: "2026-02-30"/);
  has({ expires: "2026-10-01" }, /is not after effective/);
  has({ expires: "2027-01-01" }, /91 days after effective: 2026-10-02; at most 90/);
  has({ "pre-merge-paths": "[src/a.ts]" }, /runward\/delegation.md is not listed/);
  has({ "pre-merge-paths": "[runward/delegation.md, ../outside]" }, /"\.\.\/outside" escapes the repository/);
  has({ expire: "2026-12-31" }, /^unknown field "expire"/);
  has({ aliases: "stranxik" }, /^field "aliases" is a list/);
  has({ accountable: "github:<account>" }, /template placeholder/);
  const dup = charterText().replace("stage: 1", "stage: 1\nstage: 1");
  assert.ok(parseCharter(dup).problems.some((p) => /declared twice/.test(p.problem)));
  assert.ok(parseCharter(charterText().replace("stage: 1", "stage: 1\n  - stray")).problems.some((p) => /outside a list/.test(p.problem)));
  // The window at its bound is legal: exactly 90 days.
  assert.deepEqual(problems({ expires: "2026-12-31" }), [], "2026-10-02 + 90 days");
  assert.equal(isoDay("2026-12-31") - isoDay("2026-10-02"), 90);
});

test("class I is refused in stage 1, R and H are never delegated, and stage 2 is a gap this version cannot read", () => {
  const kinds = (over) => parseCharter(charterText(over)).problems.map((p) => p.kind);
  assert.deepEqual(kinds({ "class-I": "delegated" }), ["charter-class-refused"]);
  assert.deepEqual(kinds({ "class-R": "delegated" }), ["charter-class-refused"]);
  assert.deepEqual(kinds({ "class-H": "refused" }), ["charter-class-refused"]);
  assert.deepEqual(kinds({ stage: "2" }), ["charter-stage-unread"], "stage 2 is what the gate checks, not what the charter says");
  assert.deepEqual(kinds({ stage: "2", "class-I": "delegated" }), ["charter-stage-unread"], "class I is not refused by stage 2's schema, and stage 2 itself is the gap");
  assert.deepEqual(kinds({ "class-D": "maintainer" }), [], "keeping class D is legal");
});

// ── the acts under the charter ──────────────────────────────────────────────────────────────────

const ROWS = [
  { rule: "r-a", status: "applied", evidence: "file:src/a.ts" },
  { rule: "r-b", status: "applied", evidence: "file:src/b.ts" },
  { rule: "r-c", status: "applied", evidence: "file:src/c.ts" },
  { rule: "r-d", status: "applied", evidence: "file:src/d.ts" },
  { rule: "r-e", status: "applied", evidence: "file:src/e.ts" },
];
const line = (date, rule, segs) => `- ${date} · rows: ${rule} · ${segs} · bound: ${rule}@${rowDigest(ROWS.find((r) => r.rule === rule))}`;
function actsMission(charter) {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-acts-"));
  writeFileSync(join(dir, "floor.md"), [
    "# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
    ...ROWS.map((r) => `| ${r.rule} | ${r.status} | ${r.evidence} |`), "", "### Ratification", "",
    `${line("2026-10-05", "r-a", "by: codex (declared, agent) · for: Ada (declared, accountable)")} · mode: agent`,
    `${line("2027-01-03", "r-b", "by: claude (declared, agent) · for: Ada (declared, accountable)")} · mode: agent`,
    `${line("2026-10-06", "r-c", "by: Claude (declared, agent) · for: Ada (declared, accountable)")} · mode: agent`,
    `${line("2026-09-01", "r-d", "by: codex (declared, agent) · for: Ada (declared, accountable)")} · mode: agent`,
    `${line("2026-10-07", "r-e", "by: codex (declared, agent) · for: Ada (declared, accountable)")} · mode: agent`,
    `${line("2026-10-08", "r-e", "by: Ada")} · mode: line-by-line`,
    "",
  ].join("\n"));
  if (charter !== undefined) writeFileSync(join(dir, "delegation.md"), charter);
  return dir;
}

test("an agent ratification by a non-delegate, or dated after the charter expired, is a named gap on its row", () => {
  const dir = actsMission(charterText());
  try {
    const gaps = charterActGaps(dir, readCharter(dir));
    assert.deepEqual(gaps.map((g) => [g.kind, g.rule, g.deliverable]), [
      ["agent-not-delegate", "r-a", "floor.md"],
      ["charter-expired", "r-b", "floor.md"],
    ], "r-c is a delegate inside the window; r-d predates the charter; r-e was re-ratified by a person since");
    assert.match(gaps[0].problem, /by the agent codex, which runward\/delegation.md does not list as a delegate/);
    assert.match(gaps[1].problem, /on 2027-01-03 by the agent claude, after runward\/delegation.md expired on 2026-12-31/);
    // A phase the horizon defers is not judged, like the regulated rows.
    assert.deepEqual(charterActGaps(dir, readCharter(dir), () => false), []);
    // In the verdict: strict gaps, counted apart, in the conformance table and the SARIF log.
    const v = computeVerdict(dir, { strict: true });
    // ADR-0088 decision 7 (delegation-sample.test.js): the tree declares 2027-01-03 and no sample, so
    // the periods since 2026-10-02 are missed and r-c, a delegate's act inside the window, is unsampled.
    assert.equal(v.strictBreakdown.charter, 3);
    assert.deepEqual(v.delegation.gaps.map((g) => [g.kind, g.rule]), [["agent-not-delegate", "r-a"], ["charter-expired", "r-b"], ["sample-missed", "r-c"]]);
    const sarif = buildSarif(dir, v, 0);
    const ids = sarif.runs[0].results.map((r) => r.ruleId);
    assert.ok(ids.includes("runward/agent-not-delegate") && ids.includes("runward/charter-expired"), ids.join(","));
    // Without --strict, the banner and no gap: the strict reading is absent, not zero.
    const lenient = computeVerdict(dir, {});
    assert.equal(lenient.delegation.gaps, undefined);
    assert.deepEqual(lenient.delegation.banner, [B1, B2]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("expiry is read from the dates the tree declares, never from the clock: the same tree gives the same verdict on any day", () => {
  // The module the verdict imports reads no clock at all.
  const src = readFileSync(join(ROOT, "dist", "lib", "delegation.js"), "utf8");
  assert.ok(!/Date\.now\(|new Date\(\)/.test(src), "delegation.js must not read the wall clock (ADR-0054)");
  const ref = mkdtempSync(join(tmpdir(), "rw-charter-clock-"));
  try {
    execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: ref, stdio: "pipe", env: ENV });
    writeFileSync(join(ref, "runward", "delegation.md"), charterText({ effective: "2020-01-01", expires: "2020-03-01" }));
    const at = (now) => run(ref, ["check", "--strict", "--json"], { RUNWARD_NOW: now, SOURCE_DATE_EPOCH: "" });
    const a = at("2020-02-01"), b = at("2031-06-30");
    assert.equal(a.code, 0, a.out);
    assert.equal(a.out, b.out, "a charter long expired by the clock, with no act after it, changes nothing in the verdict");
  } finally { rmSync(ref, { recursive: true, force: true }); }
});

// ── the surfaces ───────────────────────────────────────────────────────────────────────────────

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-charter-ref-"));
execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: REFERENCE, stdio: "pipe", env: ENV });
function copy(charter) {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-"));
  cpSync(REFERENCE, dir, { recursive: true });
  if (charter !== undefined) writeFileSync(join(dir, "runward", "delegation.md"), charter);
  return { dir, drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("no charter: the verdict, the JSON, the SARIF and the report carry nothing new", () => {
  const m = copy();
  try {
    const v = computeVerdict(join(m.dir, "runward"), { strict: true });
    assert.equal(v.delegation, null);
    assert.equal(v.strictBreakdown.charter, 0);
    const j = JSON.parse(run(m.dir, ["check", "--strict", "--json"]).out);
    assert.equal("delegation" in j, false);
    assert.equal("charter" in j.gaps, false);
    const s = JSON.parse(run(m.dir, ["check", "--strict", "--sarif"]).out);
    assert.equal(s.runs[0].properties, undefined, "no property bag on a run with nothing to disclose");
    const t = run(m.dir, ["check", "--strict"]);
    assert.equal(t.code, 0);
    assert.ok(!t.out.includes("Delegation charter"));
  } finally { m.drop(); }
});

test("with a charter, check (text, JSON, SARIF), report and doctor print the stage banner at the character", () => {
  const m = copy(charterText());
  try {
    const t = run(m.dir, ["check", "--strict"]);
    assert.equal(t.code, 0, t.out);
    assert.ok(t.out.includes(B1) && t.out.includes(B2), t.out);
    const lenient = run(m.dir, ["check"]);
    assert.ok(lenient.out.includes(B1), "the banner is printed without --strict too");
    const j = JSON.parse(run(m.dir, ["check", "--strict", "--json"]).out);
    assert.deepEqual(j.delegation.banner, [B1, B2]);
    assert.equal(j.delegation.stage, 1);
    assert.deepEqual(j.delegation.gaps, []);
    assert.equal(j.gaps.charter, 0);
    const jl = JSON.parse(run(m.dir, ["check", "--json"]).out);
    assert.deepEqual(jl.delegation.banner, [B1, B2]);
    assert.equal("gaps" in jl.delegation, false, "the strict reading is absent without --strict");
    const s = JSON.parse(run(m.dir, ["check", "--strict", "--sarif"]).out);
    assert.deepEqual(s.runs[0].properties.delegation, { file: "runward/delegation.md", stage: 1, banner: [B1, B2] });
    assert.equal(run(m.dir, ["report"]).code, 0);
    const html = readFileSync(join(m.dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.ok(html.includes("delegation: declared, not proved — the maintainer&#39;s credential is within agent reach") || html.includes(B1), "the report carries the banner");
    assert.ok(html.includes(B2));
    const d = run(m.dir, ["doctor"], { RUNWARD_NOW: "2026-10-10" });
    assert.ok(d.out.includes(`${B1}; ${B2}`), d.out);
  } finally { m.drop(); }
});

test("a malformed charter, or one delegating class I in stage 1, turns check --strict red with the cause named (exit 1)", () => {
  for (const [over, kind] of [[{ expires: "2027-03-01" }, "charter-malformed"], [{ "class-I": "delegated" }, "charter-class-refused"]]) {
    const m = copy(charterText(over));
    try {
      const r = run(m.dir, ["check", "--strict"]);
      assert.equal(r.code, 1, r.out);
      assert.ok(r.out.includes("1 delegation-charter gap(s)"), r.out);
      assert.ok(r.out.includes(kind), r.out);
      const j = JSON.parse(run(m.dir, ["check", "--strict", "--json"]).out);
      assert.equal(j.gaps.charter, 1);
      const row = j.conformance.find((c) => c.scope === "delegation");
      assert.deepEqual([row.kind, row.file, row.rule, row.line], [kind, "runward/delegation.md", "(charter)", null]);
      assert.equal(j.next.action, "fix-delegation-charter");
      assert.equal(run(m.dir, ["check"]).code, 0, "the presence gate does not judge the charter");
    } finally { m.drop(); }
  }
});

test("doctor sets expires beside the clock: in force, within 14 days, expired", () => {
  const m = copy(charterText());
  try {
    const at = (now) => run(m.dir, ["doctor"], { RUNWARD_NOW: now }).out;
    assert.match(at("2026-10-10"), /in force until 2026-12-31 \(82 day\(s\) left, by this run's clock, 2026-10-10\)/);
    assert.match(at("2026-12-20"), /expires on 2026-12-31, in 11 day\(s\)/);
    assert.match(at("2027-01-05"), /expired on 2026-12-31 \(5 day\(s\) ago/);
  } finally { m.drop(); }
});

test("the charter's accountable person merges over the lock's identities, the charter first", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-ids-"));
  try {
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ identities: {
      "github:stranxik": ["Thibault"], "github:other": ["stranxik", "Ada"],
    } }));
    assert.deepEqual(missionIdentities(dir), { "github:stranxik": ["Thibault"], "github:other": ["stranxik", "Ada"] }, "no charter: the lock as is");
    writeFileSync(join(dir, "delegation.md"), charterText());
    const ids = missionIdentities(dir);
    assert.deepEqual(ids["github:stranxik"], ["stranxik", "Thibault Souris", "Thibault"], "union, the charter's aliases first, one spelling per folded name");
    assert.deepEqual(ids["github:other"], ["Ada"], "an alias the charter gives its accountable person is taken off other ids");
    assert.equal(resolveIdentity("stranxik", ids).id, "github:stranxik");
    assert.equal(resolveIdentity("Thibault", ids).id, "github:stranxik", "a lock-only alias keeps resolving");
    // The regulated reading uses the merged identities: a ratifier the lock alone did not declare is declared by the charter.
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ regulated: true, agentRatification: true, identities: { "github:ada": ["Ada"] } }));
    writeFileSync(join(dir, "floor.md"), [
      "# Floor", "", "## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|",
      "| r-a | applied | file:src/a.ts |", "", "### Ratification", "",
      `${line("2026-10-05", "r-a", "by: claude (declared, agent) · for: thibaultsouris (declared, accountable) · proposer: codex (declared) · proposer-for: Ada (declared, accountable)")} · mode: agent`, "",
    ].join("\n"));
    assert.deepEqual(unboundRatifications(dir), [], "independent, both declared: one in the lock, one in the charter");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("init and wire never write a charter: it is the accountable person's act (class R)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-charter-init-"));
  try {
    run(dir, ["init", "--yes"]);
    assert.ok(existsSync(join(dir, "runward")), "init ran");
    run(dir, ["wire"]);
    run(dir, ["update"]);
    assert.equal(existsSync(join(dir, "runward", "delegation.md")), false);
    const ex = mkdtempSync(join(tmpdir(), "rw-charter-init-ex-"));
    try { run(ex, ["init", "--yes", "--example"]); assert.equal(existsSync(join(ex, "runward", "delegation.md")), false); }
    finally { rmSync(ex, { recursive: true, force: true }); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("verify re-derives the delegation block: a tampered banner or gap count is a difference", () => {
  const m = copy(charterText());
  try {
    const att = join(m.dir, "verdict.intoto.json");
    writeFileSync(att, run(m.dir, ["check", "--attest", "--strict"]).out);
    assert.equal(run(m.dir, ["verify", att]).code, 0, "an honest attestation verifies");
    const st = JSON.parse(readFileSync(att, "utf8"));
    st.predicate.delegation.banner = ["delegation: proved"];
    writeFileSync(att, JSON.stringify(st));
    const r = JSON.parse(run(m.dir, ["verify", att, "--json"]).out);
    assert.equal(r.verified, false);
    assert.ok(r.predicate.differing.includes("delegation"), JSON.stringify(r.predicate));
    st.predicate.delegation.banner = [B1, B2];
    st.predicate.gaps.charter = 3;
    writeFileSync(att, JSON.stringify(st));
    assert.ok(JSON.parse(run(m.dir, ["verify", att, "--json"]).out).predicate.differing.includes("gaps.charter"), "an invented gap count is a difference");
    st.predicate.gaps.charter = 0;
    delete st.predicate.delegation;
    writeFileSync(att, JSON.stringify(st));
    assert.ok(JSON.parse(run(m.dir, ["verify", att, "--json"]).out).predicate.differing.includes("delegation"), "dropping the banner while the tree holds a charter is a difference");
  } finally { m.drop(); }
});
