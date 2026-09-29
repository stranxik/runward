// Every refusal the conformance layer raises carries its `kind`, and the kind is the one
// docs/interop.md publishes (RWD-2026-0149): `check --json` hands it to a CI or an agent as a
// stable identifier to branch on, so a blanked or swapped kind is a broken machine contract even
// when the English `problem` still reads right.
//
// Found by the mutation measure of 2026-09-28 (release 0.42.3): every kind literal set in
// conformance() and driftReport() survived the unit suite — the existing tests read the problem
// text, and the CLI tests that read `kind` run in a child process the mutant never reaches. These
// call the functions directly and compare {rule, kind} exactly, one refusal per documented kind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { conformance, driftReport } from "../../dist/lib/conformance.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PHASE = "custom"; // absent from EXPECTED_MAPPED: the non-vacuity floor stays out unless asked for

function ruleFile(dir, slug, phases = PHASE) {
  writeFileSync(join(dir, "rules", `${slug}.md`),
    `---\ntitle: ${slug}\nimpact: CRITICAL\nasi: [ASI01]\nphases: [${phases}]\n---\n\nBody.\n`);
}

function mission(slugs, phases = PHASE) {
  const dir = mkdtempSync(join(tmpdir(), "rw-kinds-"));
  mkdirSync(join(dir, "rules"), { recursive: true });
  for (const s of slugs) ruleFile(dir, s, phases);
  return dir;
}

const table = (rows) => ["## Rule conformance", "", "| Rule | Status | Evidence |", "|---|---|---|", ...rows, ""];
const deliverable = (rows) => ["# Floor", "", ...table(rows)].join("\n");
const kinds = (violations) => violations.map((v) => ({ rule: v.rule, kind: v.kind }));

/** The documented list, read from the document itself — a kind the code emits and the page does
 *  not publish is a contract nobody was told about. */
const DOCUMENTED = (() => {
  const doc = readFileSync(join(ROOT, "docs", "interop.md"), "utf8");
  const para = doc.slice(doc.indexOf("every row carries `kind`"), doc.indexOf("values are only ever added"));
  return new Set([...para.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]));
})();

test("each row-level refusal carries its documented kind, and only that kind", () => {
  const dir = mission(["r-applied", "r-deviated", "r-dup", "r-empty", "r-invalid", "r-missing", "r-na", "r-ok"]);
  try {
    writeFileSync(join(dir, "floor.md"), deliverable([
      "| r-applied | applied |  |",
      "| r-deviated | deviated | ADR-9999 |",
      "| r-dup | n/a | single-process CLI, no queue here |",
      "| r-dup | n/a | single-process CLI, no queue here |",
      "| r-empty |  |  |",
      "| r-invalid | maybe | src/x.ts:1 |",
      "| r-na | n/a | short |",
      "| r-ok | n/a | single-process CLI, no queue here |",
      "| r-stranger | n/a | single-process CLI, no queue here |",
    ]));
    const { violations } = conformance(dir, PHASE, "floor.md");
    assert.deepEqual(kinds(violations), [
      { rule: "r-dup", kind: "duplicate-row" },
      { rule: "r-stranger", kind: "unknown-rule" },
      { rule: "r-applied", kind: "applied-without-evidence" },
      { rule: "r-deviated", kind: "deviated-without-adr" },
      { rule: "r-empty", kind: "empty-status" },
      { rule: "r-invalid", kind: "invalid-status" },
      { rule: "r-missing", kind: "missing-row" },
      { rule: "r-na", kind: "na-without-reason" },
    ]);
    for (const v of violations) assert.ok(DOCUMENTED.has(v.kind), `${v.kind} is published in docs/interop.md`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an empty status and an invalid one are two kinds, and each problem says which it is", () => {
  const dir = mission(["r-a"]);
  try {
    writeFileSync(join(dir, "floor.md"), deliverable(["| r-a |  |  |"]));
    const [empty] = conformance(dir, PHASE, "floor.md").violations;
    assert.equal(empty.kind, "empty-status");
    assert.match(empty.problem, /^status not set/);
    writeFileSync(join(dir, "floor.md"), deliverable(["| r-a | done | src/x.ts:1 |"]));
    const [invalid] = conformance(dir, PHASE, "floor.md").violations;
    assert.equal(invalid.kind, "invalid-status");
    assert.match(invalid.problem, /^invalid status "done"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("whole-deliverable refusals carry their kinds: mapping floor, missing deliverable, unreadable manifest", () => {
  const floor = mission(["only-one"], "architect");
  try {
    writeFileSync(join(floor, "floor.md"), deliverable(["| only-one | n/a | single-process CLI, no queue here |"]));
    assert.deepEqual(kinds(conformance(floor, "architect", "floor.md").violations),
      [{ rule: "(mapping)", kind: "mapping-floor" }]);
  } finally { rmSync(floor, { recursive: true, force: true }); }

  const dir = mission(["r-a", "r-b"]);
  try {
    assert.deepEqual(kinds(conformance(dir, PHASE, "absent.md").violations), [
      { rule: "r-a", kind: "deliverable-missing" },
      { rule: "r-b", kind: "deliverable-missing" },
    ]);
    // Two `Rule conformance` sections: the gate will not choose between them, and says so as a
    // whole-file refusal under the `(manifest)` pseudo-rule.
    writeFileSync(join(dir, "floor.md"), ["# Floor", "", ...table(["| r-a | n/a | single-process CLI, no queue here |"]),
      ...table(["| r-b | n/a | single-process CLI, no queue here |"])].join("\n"));
    const unreadable = conformance(dir, PHASE, "floor.md").violations.filter((v) => v.kind === "manifest-unreadable");
    assert.equal(unreadable.length, 1);
    assert.equal(unreadable[0].rule, "(manifest)");
    for (const k of ["mapping-floor", "deliverable-missing", "manifest-unreadable"]) assert.ok(DOCUMENTED.has(k), k);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("drift carries the unresolved-pointer kind", () => {
  const dir = mission(["r-a"]);
  try {
    writeFileSync(join(dir, "floor.md"), deliverable(["| r-a | applied | src/gone.ts:12 |"]));
    assert.deepEqual(kinds(driftReport(dir, "floor.md")), [{ rule: "r-a", kind: "unresolved-pointer" }]);
    assert.ok(DOCUMENTED.has("unresolved-pointer"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
