// ADR-0095: `check --strict --json` carries the ratification row by row (`ratification.byRow`), the
// causes by kind (`gaps.causesByKind`) and, with a charter, the assurance mode in force
// (`delegation.assurance`, computed as ADR-0090 decision 2 says). Each is a pure function of what the
// verdict already reads, none counts toward the verdict, and `verify` compares each on its own, only
// when present: an attestation sealed before the fields existed (0.43.x) keeps verifying, one sealed
// with them and edited is refused.
//
// What the ADR asserted and the measurement corrected: "the counts must equal the list's counts".
// They do only when every decided row carries exactly one entry. The counts count ratification
// ENTRIES (a row ratified twice adds two), the list counts ROWS; runward's own mission, measured on
// 2026-10-13, reads 48 in the counts and 46 in the list for that reason. Both relations are pinned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ratificationLedger, ratificationRows, rowDigest } from "../../dist/lib/conformance.js";
import { causesByKind } from "../../dist/lib/check-contract.js";
import { assuranceReading, parseCharter, ASSURANCE_MODES, MACHINE_FLOOR } from "../../dist/lib/delegation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-10-13" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const ROWS = [
  { rule: "r-one", status: "applied", evidence: "file:a.ts" },
  { rule: "r-two", status: "applied", evidence: "file:b.ts" },
  { rule: "r-three", status: "n/a", evidence: "not in scope" },
  { rule: "r-four", status: "deviated", evidence: "ADR-0001" },
];

function missionWith(table, block, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rw-byrow-"));
  mkdirSync(join(dir, "governance"), { recursive: true });
  writeFileSync(join(dir, "floor.md"), `# Floor

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
${table.map((r) => `| ${r.rule} | ${r.status} | ${r.evidence} |`).join("\n")}

### Ratification

${block}
`);
  for (const [f, text] of Object.entries(extra)) writeFileSync(join(dir, f), text);
  return dir;
}

const bound = (rows) => rows.map((r) => `${r.rule}@${rowDigest(r)}`).join(", ");

/** The relation the ADR asked for: the list's counts per mode equal the ledger's. */
function countsAgree(ledger, rows) {
  const n = (f) => rows.filter(f).length;
  const counted = rows.filter((r) => r.state === "ratified" || r.state === "blind");
  return ledger.rows === counted.length
    && ledger.lineByLine === n((r) => r.state === "ratified" && r.mode === "line-by-line")
    && ledger.enBloc === n((r) => r.state === "ratified" && r.mode === "en bloc")
    && ledger.blind === n((r) => r.state === "blind")
    && (ledger.agent ?? 0) === n((r) => r.state === "ratified" && (r.mode === "agent" || r.mode === "agent (single accountable)"))
    && ledger.untraced === n((r) => r.state === "untraced")
    && (ledger.changed ?? 0) === n((r) => r.state === "changed");
}

test("ADR-0095: byRow lists every decided row with its state, mode, names and digests", () => {
  const changedTwo = { ...ROWS[1], evidence: "file:elsewhere.ts" };
  const block = [
    `- 2026-10-01 · rows: r-one, r-two · bound: ${bound(ROWS.slice(0, 2))} · by: Alice Martin (declared) · mode: line-by-line`,
    `- 2026-10-02 · rows: r-three · by: Bob (declared) · mode: blind`,
  ].join("\n");
  const dir = missionWith([ROWS[0], changedTwo, ROWS[2], ROWS[3], { rule: "r-five", status: "", evidence: "" }], block);
  try {
    assert.deepEqual(ratificationRows(dir), [
      { deliverable: "floor.md", rule: "r-one", phaseId: "floor", state: "ratified", mode: "line-by-line",
        by: "Alice Martin", for: null, date: "2026-10-01", bound: rowDigest(ROWS[0]), current: rowDigest(ROWS[0]), unboundCause: null },
      { deliverable: "floor.md", rule: "r-two", phaseId: "floor", state: "changed", mode: "line-by-line",
        by: "Alice Martin", for: null, date: "2026-10-01", bound: rowDigest(ROWS[1]), current: rowDigest(changedTwo), unboundCause: null },
      { deliverable: "floor.md", rule: "r-three", phaseId: "floor", state: "blind", mode: "blind",
        by: "Bob", for: null, date: "2026-10-02", bound: null, current: rowDigest(ROWS[2]), unboundCause: null },
      { deliverable: "floor.md", rule: "r-four", phaseId: "floor", state: "untraced", mode: null,
        by: null, for: null, date: null, bound: null, current: rowDigest(ROWS[3]), unboundCause: null },
    ], "one element per DECIDED row, in manifest order; the undecided r-five is not listed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0095: the list's counts equal the ledger's when every decided row carries one entry", () => {
  const block = [
    `- 2026-10-01 · rows: r-one · bound: ${bound([ROWS[0]])} · by: op (declared) · mode: line-by-line`,
    `- 2026-10-01 · rows: r-two, r-three (2) · bound: ${bound([ROWS[1], ROWS[2]])} · by: op (declared) · mode: en bloc`,
  ].join("\n");
  const dir = missionWith(ROWS, block);
  try {
    assert.equal(countsAgree(ratificationLedger(dir), ratificationRows(dir)), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0095, planted mismatch: a row ratified twice counts two entries and one row", () => {
  const block = [
    `- 2026-10-01 · rows: r-one · bound: ${bound([ROWS[0]])} · by: op (declared) · mode: line-by-line`,
    `- 2026-10-02 · rows: r-one · bound: ${bound([ROWS[0]])} · by: op (declared) · mode: en bloc`,
  ].join("\n");
  const dir = missionWith(ROWS, block);
  try {
    const ledger = ratificationLedger(dir), rows = ratificationRows(dir);
    assert.equal(countsAgree(ledger, rows), false, "the relation reddens on a re-ratified row");
    assert.equal(ledger.rows, 2, "the counts count entries (unchanged, ADR-0030)");
    assert.equal(rows.filter((r) => r.state === "ratified").length, 1, "the list counts rows");
    assert.equal(rows.find((r) => r.rule === "r-one").mode, "en bloc", "the latest entry speaks for the row");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ADR-0095: unboundCause is filled only under the regulated tier", () => {
  const block = `- 2026-10-01 · rows: r-one · by: op (declared) · mode: line-by-line`;
  const off = missionWith(ROWS, block);
  const on = missionWith(ROWS, block, { "scaffold-lock.json": JSON.stringify({ regulated: true }) });
  try {
    assert.ok(ratificationRows(off).every((r) => r.unboundCause === null), "outside the tier, no cause on any row");
    const causes = Object.fromEntries(ratificationRows(on).map((r) => [r.rule, r.unboundCause]));
    assert.deepEqual(causes, { "r-one": "no-digest", "r-two": "no-trace", "r-three": "no-trace", "r-four": "no-trace" });
  } finally { for (const d of [off, on]) rmSync(d, { recursive: true, force: true }); }
});

test("ADR-0095: causesByKind groups conformance rows by kind, with their indices, sorted by kind", () => {
  assert.deepEqual(causesByKind([]), {});
  assert.deepEqual(causesByKind([{ kind: "unbound-row" }, { kind: "proposed" }, { kind: "unbound-row" }, { scope: "x" }]), {
    proposed: { count: 1, indices: [1] },
    "unbound-row": { count: 2, indices: [0, 2] },
  }, "a row without a kind is grouped under none: nothing is guessed");
  assert.deepEqual(Object.keys(causesByKind([{ kind: "b" }, { kind: "a" }])), ["a", "b"]);
});

const LAST = { unsampledSince: null, lastStatus: null, coveredUntil: "2026-10-02" };
const SAMPLE = { size: 5, seeds: 1, periodDays: 7 };

test("ADR-0090 decision 6: mode is optional, read from the ladder, an unknown value is malformed", () => {
  assert.deepEqual([...ASSURANCE_MODES], ["machine", "machine+critical", "sampled", "per-act"]);
  const base = readFileSync(join(ROOT, "runward", "delegation.md"), "utf8");
  assert.equal(parseCharter(base).mode, null, "runward's own charter declares no mode");
  const withMode = (m) => parseCharter(base.replace("stage: 1\n", `stage: 1\nmode: ${m}\n`));
  for (const m of ASSURANCE_MODES) {
    const c = withMode(m);
    assert.equal(c.mode, m);
    assert.deepEqual(c.problems.filter((p) => p.problem.startsWith("mode:")), [], `${m} is a mode`);
  }
  const bad = withMode("trust-me");
  assert.ok(bad.problems.some((p) => p.kind === "charter-malformed" && p.problem.startsWith('mode: "trust-me"')));
});

test("ADR-0090 decision 2 via ADR-0095: an absent mode reads sampled, with its sentence at the character", () => {
  assert.deepEqual(assuranceReading({ mode: null, sample: SAMPLE }, { ...LAST, lastStatus: "control-missed" }), {
    declared: null, inForce: "sampled", degraded: false, notInForce: [],
    sentence: "assurance: sampled. A person reviewed 5 drawn acts and 1 seeded defect(s) per 7-day period; last period: control missed",
  });
  const last = (x) => assuranceReading({ mode: "sampled", sample: SAMPLE }, { ...LAST, ...x }).sentence.split("last period: ")[1];
  assert.equal(last({ lastStatus: "passed" }), "passed");
  assert.equal(last({ lastStatus: "rejected" }), "rejected");
  assert.equal(last({ lastStatus: "passed", unsampledSince: "2026-09-01" }), "unsampled since 2026-09-01", "a missed period speaks first");
  assert.equal(last({}), "unsampled since 2026-10-02");
});

test("ADR-0095: a machine mode is degraded, every floor control named, while no floor reader exists", () => {
  assert.equal(MACHINE_FLOOR.length, 8);
  for (const m of ["machine", "machine+critical"]) {
    const a = assuranceReading({ mode: m, sample: SAMPLE }, LAST);
    assert.equal(a.inForce, m);
    assert.equal(a.degraded, true, "never a guess of completeness");
    assert.deepEqual(a.notInForce, [...MACHINE_FLOOR]);
    assert.equal(a.sentence, `assurance: ${m}, degraded. Not in force: ${MACHINE_FLOOR.join(", ")}. Delegated acts rest on fewer controls than the mode names`);
  }
  assert.deepEqual(assuranceReading({ mode: "per-act", sample: SAMPLE }, LAST), {
    declared: "per-act", inForce: "per-act", degraded: false, notInForce: [],
    sentence: "assurance: per-act. Every delegated act carries an approval declared by a person before merge",
  });
  assert.deepEqual(assuranceReading({ mode: "trust-me", sample: SAMPLE }, LAST),
    { declared: "trust-me", inForce: null, degraded: true, notInForce: [], sentence: null }, "no mode is guessed for an unknown value");
});

/** An example mission with runward's own charter copied in, attested under --strict. */
function attestedMission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-byrow-cli-"));
  assert.equal(run(dir, "--yes", "init", "--example").code, 0);
  writeFileSync(join(dir, "runward", "delegation.md"), readFileSync(join(ROOT, "runward", "delegation.md"), "utf8"));
  const att = join(dir, "att.json");
  writeFileSync(att, run(dir, "check", "--strict", "--attest").out);
  return { dir, att };
}
const verify = (m) => JSON.parse(run(m.dir, "verify", m.att, "--json").out);
const edit = (m, f) => { const s = JSON.parse(readFileSync(m.att, "utf8")); f(s.predicate); writeFileSync(m.att, JSON.stringify(s)); };

test("ADR-0095: check --strict --json carries the three fields, and verify accepts an honest attestation", () => {
  const m = attestedMission();
  try {
    const j = JSON.parse(run(m.dir, "check", "--strict", "--json").out);
    assert.ok(Array.isArray(j.ratification.byRow) && j.ratification.byRow.length > 0);
    assert.equal(Object.keys(j.ratification).at(-1), "byRow", "last in the block, every count keeps its place");
    assert.equal(Object.keys(j.gaps).at(-1), "causesByKind");
    const total = Object.values(j.gaps.causesByKind).reduce((n, x) => n + x.count, 0);
    assert.equal(total, j.conformance.length, "every conformance row is counted once");
    for (const [k, x] of Object.entries(j.gaps.causesByKind)) for (const i of x.indices) assert.equal(j.conformance[i].kind, k);
    assert.equal(j.delegation.assurance.inForce, "sampled");
    assert.equal(run(m.dir, "check", "--json").out.includes("byRow"), false, "strict only, like the counts");
    const r = verify(m);
    assert.equal(r.verified, true, JSON.stringify(r.predicate));
  } finally { rmSync(m.dir, { recursive: true, force: true }); }
});

test("ADR-0095: an attestation without the three fields (0.43.x) still verifies", () => {
  const m = attestedMission();
  try {
    edit(m, (p) => { delete p.ratification.byRow; delete p.gaps.causesByKind; delete p.delegation.assurance; });
    const r = verify(m);
    assert.equal(r.verified, true, JSON.stringify(r.predicate));
  } finally { rmSync(m.dir, { recursive: true, force: true }); }
});

test("ADR-0095, positive control: an edited byRow, causesByKind or assurance is refused, each by its name", () => {
  const m = attestedMission();
  const honest = readFileSync(m.att, "utf8");
  try {
    const cases = [
      ["ratification.byRow", (p) => { p.ratification.byRow[0].state = "blind"; }],
      ["ratification.byRow", (p) => { p.ratification.byRow.pop(); }],
      ["gaps.causesByKind", (p) => { p.gaps.causesByKind = { "rule-violation": { count: 1, indices: [0] } }; }],
      ["delegation.assurance", (p) => { p.delegation.assurance.inForce = "per-act"; }],
    ];
    for (const [name, f] of cases) {
      writeFileSync(m.att, honest);
      edit(m, f);
      const r = verify(m);
      assert.equal(r.verified, false, `${name} edited, verified`);
      assert.ok(r.predicate.differing.includes(name), `${name}: ${JSON.stringify(r.predicate.differing)}`);
      assert.equal(r.exitCode, 1);
    }
    // The counts are still compared whole: the split did not open them.
    writeFileSync(m.att, honest);
    edit(m, (p) => { p.ratification.untraced += 1; });
    assert.ok(verify(m).predicate.differing.includes("ratification"));
  } finally { rmSync(m.dir, { recursive: true, force: true }); }
});
