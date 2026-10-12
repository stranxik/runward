// RWD-2026-0166. Outside the regulated tier, a decided row rewritten after its ratification was still
// counted as ratified on every surface: the ledger kept it in its mode (`lineByLine: 1`), the
// terminal and the delivery report said "1 row(s) traced", and nothing said the ratified content had
// changed. The digest that says so (`bound:`, ADR-0080) was already in the trace; only the regulated
// tier read it. The ledger now reads it on every mission: a row whose latest ratification binds a
// digest its current content no longer matches is counted apart (`changed`, `changedRows`), in no
// mode, and disclosed. It is never gated outside the tier: the exit code does not move.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ratificationLedger, rowDigest } from "../../dist/lib/conformance.js";
import { listDecidedUnbound, applyDecisions } from "../../dist/lib/ratify.js";
import { renderDeliveryReport } from "../../dist/lib/report.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const run = (cwd, ...a) => {
  try { return { out: execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status }; }
};

const ROWS = [
  { rule: "r-one", status: "applied", evidence: "file:a.ts" },
  { rule: "r-two", status: "applied", evidence: "file:b.ts" },
  { rule: "r-three", status: "applied", evidence: "file:c.ts" },
];

/** A floor.md whose table holds `table` and whose block holds `block`. */
function missionWith(table, block) {
  const dir = mkdtempSync(join(tmpdir(), "rw-changed-"));
  mkdirSync(join(dir, "governance"), { recursive: true });
  writeFileSync(join(dir, "floor.md"), `# Floor

## Rule conformance

| Rule | Status | Evidence |
|---|---|---|
${table.map((r) => `| ${r.rule} | ${r.status} | ${r.evidence} |`).join("\n")}

### Ratification

${block}
`);
  return dir;
}

const bound = (rows) => rows.map((r) => `${r.rule}@${rowDigest(r)}`).join(", ");

test("RWD-2026-0166: a row changed since its ratification is counted apart, in no mode", () => {
  // r-one and r-two ratified line by line on their content; r-two's evidence rewritten since.
  const block = `- 2026-10-01 · rows: r-one, r-two · bound: ${bound(ROWS.slice(0, 2))} · by: op (declared) · mode: line-by-line`;
  const table = [ROWS[0], { ...ROWS[1], evidence: "file:elsewhere.ts" }, ROWS[2]];
  const dir = missionWith(table, block);
  try {
    assert.deepEqual(ratificationLedger(dir), {
      rows: 1, lineByLine: 1, enBloc: 0, blind: 0, untraced: 1,
      changed: 1, changedRows: [{ deliverable: "floor.md", rule: "r-two" }],
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0166, positive control: an unchanged ratified row keeps its mode and the ledger keeps its shape", () => {
  const block = `- 2026-10-01 · rows: r-one, r-two · bound: ${bound(ROWS.slice(0, 2))} · by: op (declared) · mode: line-by-line`;
  const dir = missionWith(ROWS, block);
  try {
    // No `changed` key at all: an attestation sealed before the field existed keeps verifying.
    assert.deepEqual(ratificationLedger(dir), { rows: 2, lineByLine: 2, enBloc: 0, blind: 0, untraced: 1 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0166: re-aligning whitespace is not a change, and the LATEST entry speaks for the row", () => {
  // r-one ratified, rewritten, then re-ratified on its new content: not changed. r-two's table cell
  // re-aligned: the digest folds whitespace, so not changed either.
  const rewritten = { ...ROWS[0], status: "n/a", evidence: "not in scope" };
  const block = [
    `- 2026-10-01 · rows: r-one, r-two · bound: ${bound(ROWS.slice(0, 2))} · by: op (declared) · mode: line-by-line`,
    `- 2026-10-02 · rows: r-one · bound: ${bound([rewritten])} · by: op (declared) · mode: line-by-line`,
  ].join("\n");
  const dir = missionWith([rewritten, { ...ROWS[1], evidence: "  file:b.ts   " }, ROWS[2]], block);
  try {
    const l = ratificationLedger(dir);
    assert.equal(l.changed, undefined);
    assert.equal(l.lineByLine, 3, "r-one's two entries and r-two's one are counted, as before");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0166: an entry without a digest is counted as before — nothing can be read from it", () => {
  // Written before `bound:` existed (0.38.0 to 0.42.2) or typed by hand: whether the row changed since
  // cannot be read, so the ledger counts it in its mode, as it always did. Under the regulated tier
  // it is a gap of its own (`no-digest`, TOR-103).
  const dir = missionWith([{ ...ROWS[0], evidence: "file:elsewhere.ts" }, ROWS[1], ROWS[2]],
    "- 2026-10-01 · rows: r-one · by: op (declared) · mode: line-by-line");
  try {
    assert.deepEqual(ratificationLedger(dir), { rows: 1, lineByLine: 1, enBloc: 0, blind: 0, untraced: 2 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0166: an agent's or a BLIND ratification of other content leaves its count too", () => {
  const changedOne = { ...ROWS[0], evidence: "file:elsewhere.ts" };
  const changedTwo = { ...ROWS[1], evidence: "file:elsewhere.ts" };
  const block = [
    `- 2026-10-01 · rows: r-one · bound: ${bound([ROWS[0]])} · by: bot (declared) · for: op (declared) · mode: agent`,
    `- 2026-10-01 · rows: r-two · bound: ${bound([ROWS[1]])} · by: op (declared) · mode: BLIND`,
  ].join("\n");
  const dir = missionWith([changedOne, changedTwo, ROWS[2]], block);
  try {
    assert.deepEqual(ratificationLedger(dir), {
      rows: 0, lineByLine: 0, enBloc: 0, blind: 0, untraced: 1,
      changed: 2, changedRows: [{ deliverable: "floor.md", rule: "r-one" }, { deliverable: "floor.md", rule: "r-two" }],
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RWD-2026-0166: on the example, outside the tier, every surface stops counting an edited ratified row and says so; the exit code stays 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-changed-example-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    run(dir, "--yes", "init", "--example");
    const mission = join(dir, "runward");
    const [one] = listDecidedUnbound(mission, dir);
    applyDecisions(mission, [one], [{ rule: one.rule, deliverable: one.deliverable, decision: "accept" }],
      { by: "The Operator", date: "2026-10-12", mode: "line-by-line" });

    // Positive control: ratified and unchanged, the row counts, and nothing is disclosed.
    const before = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.equal(before.ratification.lineByLine, 1);
    assert.equal(before.ratification.changed, undefined);
    assert.doesNotMatch(run(dir, "check", "--strict").out, /changed since their ratification/);

    // The row's evidence rewritten after its ratification, verdict untouched by the edit itself.
    const path = join(mission, one.deliverable);
    const text = readFileSync(path, "utf8").split("\n");
    const i = text.findIndex((l) => l.startsWith(`| ${one.rule} |`));
    assert.ok(i > 0, "the ratified row is in the table");
    text[i] = text[i].replace(/ \|\s*$/, " rewritten after ratification |");
    writeFileSync(path, text.join("\n"));

    const r = run(dir, "check", "--strict");
    assert.equal(r.code, 0, "outside the tier this is a disclosure, never a gap");
    assert.match(r.out, /1 row\(s\) changed since their ratification; re-ratify with `runward ratify --decided`/);
    const p = JSON.parse(run(dir, "check", "--strict", "--json").out);
    assert.equal(p.exitCode, 0);
    assert.equal(p.ratification.lineByLine, 0, "the edited row is no longer counted as ratified");
    assert.equal(p.ratification.rows, 0);
    assert.equal(p.ratification.changed, 1);
    assert.deepEqual(p.ratification.changedRows, [{ deliverable: one.deliverable, rule: one.rule }]);
    const sarif = JSON.parse(run(dir, "check", "--strict", "--sarif").out);
    assert.deepEqual(sarif.runs[0].properties?.ratificationChanged, { rows: 1, changedRows: [{ deliverable: one.deliverable, rule: one.rule }] });
    const html = renderDeliveryReport(p, { generatedOn: "2026-10-12", subjectDigest: "x" });
    assert.match(html, /Ratification: 0 row\(s\) traced \(0 line-by-line/);
    assert.match(html, /1 row\(s\) changed since their ratification; re-ratify with <code>runward ratify --decided<\/code>/);
    // The command the disclosure names lists the row again.
    assert.ok(listDecidedUnbound(mission, dir).some((x) => x.rule === one.rule && x.unbound === "changed"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
