// The witness of a strict verdict (ADR-0089, increment 1, step 3): `check --strict --witness <file>`.
//
// What these tests hold: the witness is deterministic and canonical; it never changes `check`'s stdout
// or exit code; a path it cannot write is refused before the gate runs and nothing is written; every
// case of the attack corpus yields a witness whose verdict is the exit code; and the specification,
// `docs/spec/witness.md`, names every member a witness carries, because a checker is written from that
// document alone. What they do not hold: that a checker agrees with the witness. The checker is
// written by another session from the spec (ADR-0089 decision 2), and its tests live with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, chmodSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderWitness, buildWitness, WITNESS_SCHEMA, NOT_WITNESSED } from "../../dist/lib/witness.js";
import { outsideManifestLines } from "../../dist/lib/evidence.js";
import { junitTestCases, junitTestResult } from "../../dist/lib/tool-adapters.js";
import { computeVerdict } from "../../dist/lib/verdict.js";
import { cases } from "../audit-corpus.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const SPEC = join(ROOT, "docs", "spec", "witness.md");
const ENV = { ...process.env, NO_COLOR: "1" };
delete ENV.RUNWARD_DRY_RUN;
const run = (cwd, args, env = ENV) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env });

/** The shipped example mission, green, in a fresh git repository. */
function example(prefix = "rw-witness-") {
  const parent = mkdtempSync(join(tmpdir(), prefix));
  const dir = join(parent, "mission");
  mkdirSync(dir);
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  const r = run(dir, ["init", "-p", ".", "--yes", "--example"]);
  assert.equal(r.status, 0, r.stderr);
  return { parent, dir, out: join(parent, "witness.json") };
}

/** Rewrite one manifest row, the way the attack corpus does. */
function setRow(dir, rel, slug, cell) {
  const p = join(dir, "runward", rel);
  const s = readFileSync(p, "utf8").split("\n").map((l) => (new RegExp(`^\\|\\s*${slug}\\s*\\|`).test(l) ? `| ${slug} | ${cell} |` : l)).join("\n");
  writeFileSync(p, s);
}

const read = (p) => readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));

/** Every member name that occurs anywhere in a value (object keys only). */
function memberNames(v, out = new Set()) {
  if (Array.isArray(v)) for (const x of v) memberNames(x, out);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      // `files` is keyed by path, not by a member name.
      if (k === "files") { for (const f of Object.values(x)) memberNames(f, out); continue; }
      memberNames(x, out);
    }
  }
  return out;
}

test("the canonical encoding: keys sorted at every depth, lists in their order, no whitespace, one LF", () => {
  const text = renderWitness({ b: [3, { z: 1, a: "é\n" }, 1], a: { y: null, x: true } });
  assert.equal(text, '{"a":{"x":true,"y":null},"b":[3,{"a":"é\\n","z":1},1]}\n');
});

test("outsideManifestLines keeps what textOutsideManifest keeps: no section, no conformance-shaped row, fenced prose kept", () => {
  const raw = [
    "# Doc", "Usage registry here", "```", "| x | applied | file:a.ts |", "fenced text", "```",
    "## Rule conformance", "| Rule | Status | Evidence |", "| r | applied | file:a.ts |",
    "## After", "| r2 | n/a | a reason here |", "| name | where it lives |", "tail",
  ].join("\n");
  assert.deepEqual(outsideManifestLines(raw), [1, 2, 3, 5, 6, 10, 12, 13]);
});

test("junitTestResult reads its answer from junitTestCases and nothing else", () => {
  const xml = '<testsuite>\n<testcase name="a"/>\n<testcase classname="K" name="b"><failure/></testcase>\n<testcase name="a"></testcase>\n</testsuite>';
  assert.deepEqual(junitTestCases(xml, "a").map((c) => c.green), [true, true]);
  assert.equal(junitTestResult(xml, "a"), "pass");
  assert.deepEqual(junitTestCases(xml, "b").map((c) => c.green), [false]);
  assert.equal(junitTestResult(xml, "b"), "fail");
  assert.deepEqual(junitTestCases(xml, "K::b").length, 1);
  assert.deepEqual(junitTestCases(xml, "Other::b"), []);
  assert.equal(junitTestResult(xml, "c"), "absent");
});

test("determinism: the same tree twice, and two checkouts in two directories, give byte-identical witnesses", () => {
  const a = example(), b = example();
  try {
    assert.equal(run(a.dir, ["check", "--strict", "--witness", a.out]).status, 0);
    const first = read(a.out);
    assert.equal(run(a.dir, ["check", "--strict", "--witness", a.out]).status, 0);
    assert.equal(read(a.out), first, "two runs on one tree");
    assert.equal(run(b.dir, ["check", "--strict", "--witness", b.out]).status, 0);
    assert.equal(read(b.out), first, "two checkouts of one tree in two directories");
    assert.ok(!first.includes(a.parent) && !first.includes(tmpdir()), "no absolute path in a witness");
    assert.equal(renderWitness(JSON.parse(first)), first, "the file is in its canonical encoding");
    // The witness is assembled from the verdict, never a second one: building it from a verdict
    // computed in process gives the same bytes as the command's file.
    const v = computeVerdict(join(a.dir, "runward"), { strict: true });
    const w = buildWitness(join(a.dir, "runward"), v, { version: JSON.parse(first).runward, through: null, hooks: false, hookFailures: [], exitCode: v.exitCode });
    assert.equal(renderWitness(w), first);
  } finally {
    rmSync(a.parent, { recursive: true, force: true });
    rmSync(b.parent, { recursive: true, force: true });
  }
});

test("size, measured: the example mission and runward's own mission (ADR-0089 estimated 20-30 KB on a mock)", (t) => {
  const ex = example();
  const own = join(mkdtempSync(join(tmpdir(), "rw-witness-own-")), "witness.json");
  try {
    assert.equal(run(ex.dir, ["check", "--strict", "--witness", ex.out]).status, 0);
    const r = run(ROOT, ["check", "--strict", "--witness", own]);
    const w = json(own);
    assert.equal(w.verdict.exitCode, r.status, "runward's own witness says the exit code it exited with");
    const sizes = { example: Buffer.byteLength(read(ex.out)), runward: Buffer.byteLength(read(own)) };
    t.diagnostic(`witness bytes: example ${sizes.example}, runward ${sizes.runward}`);
    // Bounds, not a golden size: the example is ~37 KB and runward's own mission ~59 KB on 0.43.0.
    // A witness that shrank below a third of that is carrying less than it says; one that grew
    // past twice that is carrying something the spec does not size.
    assert.ok(sizes.example > 12_000 && sizes.example < 80_000, `example witness ${sizes.example} bytes`);
    assert.ok(sizes.runward > 20_000 && sizes.runward < 128_000, `runward witness ${sizes.runward} bytes`);
    const ew = json(ex.out);
    assert.equal(ew.gated.flatMap((g) => g.rows).length, 46, "the example's 46 rows are all witnessed");
    assert.equal(ew.corpus.rules.length, 64, "the example's 64 rules are all witnessed");
  } finally {
    rmSync(ex.parent, { recursive: true, force: true });
    rmSync(dirname(own), { recursive: true, force: true });
  }
});

test("stdout and the exit code are the same with and without --witness, green and red, text and --json", () => {
  const ex = example();
  try {
    const compare = (label) => {
      for (const extra of [[], ["--json"], ["--sarif"]]) {
        const without = run(ex.dir, ["check", "--strict", ...extra]);
        const withW = run(ex.dir, ["check", "--strict", ...extra, "--witness", ex.out]);
        assert.equal(withW.status, without.status, `${label} ${extra.join(" ")}: exit code`);
        assert.equal(withW.stdout, without.stdout, `${label} ${extra.join(" ")}: stdout`);
        assert.match(withW.stderr, /witness written: .*runward-witness\/1/);
        assert.equal(json(ex.out).verdict.exitCode, without.status, `${label}: the witness says the exit code`);
      }
    };
    compare("green");
    mkdirSync(join(ex.dir, "src"), { recursive: true });
    writeFileSync(join(ex.dir, "src", "a.ts"), "export const x = 1;\n");
    setRow(ex.dir, "architecture.md", "hexa-architecture", "applied | file:src/a.ts#");
    compare("red");
    const w = json(ex.out);
    assert.equal(w.verdict.result, "gaps");
    assert.deepEqual(w.causes.map((c) => [c.family, c.path, c.rule]), [["conformance", "runward/architecture.md", "hexa-architecture"]]);
    const row = w.gated[0].rows.find((r) => r.rule === "hexa-architecture");
    assert.deepEqual([row.pointers[0].symbolDeclared, row.pointers[0].symbol, row.pointers[0].target], [true, null, { base: "project", real: "src/a.ts" }]);
  } finally { rmSync(ex.parent, { recursive: true, force: true }); }
});

test("--dry-run writes no witness and changes neither stdout nor the exit code", () => {
  const ex = example();
  try {
    const plain = run(ex.dir, ["check", "--strict"]);
    const dry = run(ex.dir, ["--dry-run", "check", "--strict", "--witness", ex.out]);
    assert.equal(dry.status, plain.status);
    assert.equal(dry.stdout, plain.stdout);
    assert.match(dry.stderr, /--dry-run: the witness was not written/);
    assert.ok(!existsSync(ex.out), "nothing written");
  } finally { rmSync(ex.parent, { recursive: true, force: true }); }
});

test("refusals exit 2, before the gate runs, and write nothing", () => {
  const ex = example();
  try {
    const listing = () => readdirSync(ex.parent).sort().join(",");
    const before = listing();
    const refused = (args, pattern, cls = "usage") => {
      const r = run(ex.dir, ["check", ...args]);
      assert.equal(r.status, 2, `${args.join(" ")}: ${r.stderr}`);
      assert.match(r.stderr, pattern);
      assert.ok(!/gate audit/.test(r.stdout), "no partial audit printed");
      assert.equal(listing(), before, "nothing written beside the target");
      const j = run(ex.dir, ["check", ...args, "--json"]);
      assert.equal(j.status, 2);
      assert.equal(JSON.parse(j.stdout).error, cls, "the ADR-0083 error document names the class");
    };
    refused(["--witness", ex.out], /add `--strict`/);
    refused(["--freeze", "--witness", ex.out], /cannot be combined with `--freeze`/);
    refused(["--strict", "--witness", ex.parent], /is a directory/);
    refused(["--strict", "--witness", join(ex.parent, "nope", "w.json")], /does not exist/);
    refused(["--strict", "--witness", "runward/witness.json"], /lies inside runward\//);
    assert.ok(!existsSync(join(ex.dir, "runward", "witness.json")));
    // An existing file that is not a witness is never overwritten.
    const other = join(ex.parent, "notes.json");
    writeFileSync(other, '{"mine":true}\n');
    const listed = listing();
    const r = run(ex.dir, ["check", "--strict", "--witness", other]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /is not a runward witness: refusing to overwrite it/);
    assert.equal(read(other), '{"mine":true}\n');
    assert.equal(listing(), listed);
    const j = run(ex.dir, ["check", "--strict", "--json", "--witness", other]);
    assert.equal(JSON.parse(j.stdout).error, "refused");
    // A witness IS overwritten: that is how a CI job re-runs.
    assert.equal(run(ex.dir, ["check", "--strict", "--witness", ex.out]).status, 0);
    assert.equal(run(ex.dir, ["check", "--strict", "--witness", ex.out]).status, 0);
    assert.equal(json(ex.out).witness, WITNESS_SCHEMA);
    // An unwritable directory (not meaningful as root, who writes anywhere, nor on Windows, where
    // chmod 0o555 leaves a directory writable).
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      const locked = join(ex.parent, "locked");
      mkdirSync(locked);
      chmodSync(locked, 0o555);
      try {
        const u = run(ex.dir, ["check", "--strict", "--witness", join(locked, "w.json")]);
        assert.equal(u.status, 2);
        assert.match(u.stderr, /is not writable/);
        assert.deepEqual(readdirSync(locked), []);
      } finally { chmodSync(locked, 0o755); }
    }
  } finally { rmSync(ex.parent, { recursive: true, force: true }); }
});

test("the arithmetic a checker re-checks holds on a mission red in several families at once", () => {
  const ex = example();
  try {
    // A missing row (conformance), an unratified reconstruction (unratified-decision), an edited
    // rule (corpus), and a deliverable reset to its template (deliverable-state).
    const p = join(ex.dir, "runward", "floor.md");
    writeFileSync(p, read(p).split("\n").filter((l) => !/^\|\s*config-secrets-boundary\s*\|/.test(l)).join("\n"));
    writeFileSync(join(ex.dir, "runward", "adr", "DRAFT-0099-guess.md"), "# a guess\n\n**Status**: hypothesis\n");
    const rule = join(ex.dir, "runward", "rules", "hexa-architecture.md");
    writeFileSync(rule, read(rule) + "\nedited\n");
    cpSync(join(ROOT, "templates", "mission", "runbook.md"), join(ex.dir, "runward", "runbook.md"));
    const r = run(ex.dir, ["check", "--strict", "--witness", ex.out]);
    assert.equal(r.status, 1);
    const w = json(ex.out);
    const v = w.verdict, b = v.strictBreakdown;
    const fam = (f) => w.causes.filter((c) => c.family === f).length;
    assert.equal(w.causes.length, v.gaps + v.strictGaps + v.hookFailed);
    assert.equal(v.strictGaps, Object.values(b).reduce((x, y) => x + y, 0) + fam("workflow-contract"));
    assert.equal(fam("deliverable-state"), v.gaps);
    assert.equal(fam("conformance"), b.conformance + b.proposed);
    assert.equal(fam("corpus"), b.corpus);
    assert.equal(fam("unratified-decision"), b.unratified);
    for (const f of ["deliverable-state", "conformance", "corpus", "unratified-decision"]) assert.ok(fam(f) > 0, `${f} is exercised`);
    assert.deepEqual(w.unratified, [{ file: "runward/adr/DRAFT-0099-guess.md", reason: "DRAFT — reconstructed decision not yet ratified" }]);
    assert.equal(w.corpus.rules.find((x) => x.slug === "hexa-architecture").lock, "other");
    assert.deepEqual(w.notWitnessed.map((x) => x.family), Object.keys(NOT_WITNESSED));
    assert.equal(w.notWitnessed.find((x) => x.family === "deliverable-state").causes, v.gaps);
  } finally { rmSync(ex.parent, { recursive: true, force: true }); }
});

test("every attack corpus case yields a witness whose verdict is the exit code (AC-001 to AC-016)", () => {
  assert.equal(cases.length, 16, "the corpus this test covers");
  for (const c of cases) {
    const ex = example("rw-witness-ac-");
    try {
      c.build(ex.dir);
      const r = run(ex.dir, ["check", "--strict", "--witness", ex.out]);
      assert.ok(r.status === 0 || r.status === 1, `${c.id}: exit ${r.status} ${r.stderr}`);
      assert.equal(r.status === 0, c.want === "ACCEPT", `${c.id} (${c.name}) judged as the corpus expects`);
      const w = json(ex.out);
      assert.equal(w.verdict.exitCode, r.status, `${c.id}: the witness's verdict is the exit code`);
      assert.equal(w.verdict.result, r.status === 0 ? "clean" : "gaps", c.id);
      assert.equal(w.causes.length, w.verdict.gaps + w.verdict.strictGaps + w.verdict.hookFailed, `${c.id}: one cause per counted gap`);
      if (c.want === "REFUSE") assert.ok(w.causes.length > 0, `${c.id}: a refusal's witness carries its failing facts`);
    } finally { rmSync(ex.parent, { recursive: true, force: true }); }
  }
});

test("the specification names every member a witness carries, and the facts it was written from", () => {
  const spec = read(SPEC);
  const ex = example();
  try {
    // A green witness, a refusal with a pointer naming nothing, a deviation on an ADR, and a horizon:
    // between them every member this version writes appears at least once.
    assert.equal(run(ex.dir, ["check", "--strict", "--witness", ex.out]).status, 0);
    const names = memberNames(json(ex.out));
    writeFileSync(join(ex.dir, "runward", "adr", "ADR-0061-x.md"), "# ADR-0061: a real decision\n\n**Status**: accepted\n\n## Context\n\nSomething was decided and this records it.\n");
    setRow(ex.dir, "architecture.md", "hexa-architecture", "deviated | ADR-0061");
    setRow(ex.dir, "floor.md", "config-secrets-boundary", "applied | file:src/missing.ts#X; adr:ADR-7");
    run(ex.dir, ["check", "--strict", "--through", "architect", "--witness", ex.out]);
    for (const n of memberNames(json(ex.out))) names.add(n);
    run(ex.dir, ["check", "--strict", "--witness", ex.out]);
    for (const n of memberNames(json(ex.out))) names.add(n);
    const undocumented = [...names].filter((n) => !spec.includes(`\`${n}\``) && !spec.includes(`"${n}"`)).sort();
    assert.deepEqual(undocumented, [], "every member is named in docs/spec/witness.md");
    for (const family of Object.keys(NOT_WITNESSED)) assert.ok(spec.includes(`\`${family}\``), `notWitnessed family ${family} is in the spec`);
    assert.ok(spec.includes("`runward-witness/1`") && spec.includes("never changes `check`'s exit code"), "the spec states the schema and decision 3");
  } finally { rmSync(ex.parent, { recursive: true, force: true }); }
});
