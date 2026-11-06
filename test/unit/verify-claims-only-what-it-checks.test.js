// `runward verify` says verified only for what it re-derives, names what it covers, and answers only for
// the build that produced an attestation (ADR-0113).
//
// Measured on 2026-11-05, on 0.46.0 and on main: `currentGate: "independently audited"`, `adrCount: 42`
// and `next.command: "git push --force"` on an untouched tree gave "✓ verified — the attestation binds
// to this tree, and its verdict re-derives on the repo alone", exit 0; `prosePointers` emptied, a key
// verify did not know, and strict fields added to a presence attestation passed the same way
// (RWD-2026-0192). "this attestation is about this exact tree" was printed while an uncited file could be
// added or changed under exit 0 (RWD-2026-0193). Each case below is one of those, or the opt-in subject
// that binds the rest of the tree, and fails on the build before ADR-0113.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1" };
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

const REFERENCE = mkdtempSync(join(tmpdir(), "rw-claims-ref-"));
assert.equal(run(REFERENCE, "init", "--yes", "--example").status, 0);

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-claims-"));
  cpSync(REFERENCE, dir, { recursive: true });
  return { dir, drop: () => rmSync(dir, { recursive: true, force: true }) };
}
const attest = (dir, ...flags) => { const r = run(dir, "check", ...flags, "--attest"); return JSON.parse(r.stdout); };
const save = (dir, name, statement) => { writeFileSync(join(dir, name), JSON.stringify(statement, null, 2)); return name; };
const verify = (dir, name) => { const r = run(dir, "verify", name, "--json"); return { code: r.status, ...JSON.parse(r.stdout) }; };
const human = (dir, name) => { const r = run(dir, "verify", name); return { code: r.status, out: r.stdout + r.stderr }; };
const forged = (statement, mutate) => { const s = structuredClone(statement); mutate(s.predicate, s); return s; };

test("ADR-0113: the fields 0.46.0 left un-re-derived are compared — currentGate, adrCount, next.command, mission", () => {
  const m = mission();
  try {
    const att = attest(m.dir, "--strict");
    assert.equal(verify(m.dir, save(m.dir, "honest.json", att)).result, "verified", "the control: the honest attestation verifies");
    const v = verify(m.dir, save(m.dir, "forged.json", forged(att, (p) => {
      p.currentGate = "independently audited"; p.adrCount = 42; p.next.command = "git push --force";
    })));
    assert.equal(v.code, 1);
    assert.equal(v.result, "differs");
    assert.deepEqual(v.predicate.differing, ["adrCount", "currentGate", "next.command"]);
    assert.equal(v.digest.matches, true, "the tree did not move; only the predicate did");
    const h = human(m.dir, "forged.json");
    assert.doesNotMatch(h.out, /✓ verified/, "no falsification reads ✓ verified");
    for (const [name, mutate] of [
      ["mission", (p) => { p.mission = "core-payments-ledger"; }],
      ["corpusPin", (p) => { p.corpusPin = { name: "forged", version: "9.9.9" }; }],
      ["gaps.hooks", (p) => { p.gaps.hooks = 3; }],
      ["subject.name", (p, s) => { s.subject[0].name = "another system"; }],
      ["statement.auditedBy", (p, s) => { s.auditedBy = "an external auditor"; }],
    ]) {
      const r = verify(m.dir, save(m.dir, "forged.json", forged(att, mutate)));
      assert.equal(r.code, 1, name);
      assert.ok(r.predicate.differing.includes(name), `${name}: ${JSON.stringify(r.predicate.differing)}`);
    }
  } finally { m.drop(); }
});

test("ADR-0113: a removal is a difference — prosePointers emptied, a key deleted, an unknown key added", () => {
  const m = mission();
  try {
    // One evidence cell that spells a pointer in prose: the tree has one prosePointers entry.
    const floor = join(m.dir, "runward", "floor.md");
    // The example's row cites its JUnit case since ADR-0115: the prose goes after that pointer.
    writeFileSync(floor, readFileSync(floor, "utf8").replace("the model's proposal is discarded\" — ", "the model's proposal is discarded\" — produced by npm run test:junit — "));
    assert.equal(run(m.dir, "check", "--strict").status, 0, "the fixture stays green");
    const att = attest(m.dir, "--strict");
    assert.equal(att.predicate.prosePointers.length, 1, "the fixture carries the disclosure");
    for (const [name, mutate] of [
      ["prosePointers", (p) => { p.prosePointers = []; }],
      ["prosePointers", (p) => { p.prosePointers[0].spelling = "file:elsewhere"; }],
      ["ratification.byRow", (p) => { delete p.ratification.byRow; }],
      ["gaps.causesByKind", (p) => { delete p.gaps.causesByKind; }],
      ["independentAudit", (p) => { p.independentAudit = { by: "an external auditor", result: "passed" }; }],
    ]) {
      const r = verify(m.dir, save(m.dir, "forged.json", forged(att, mutate)));
      assert.equal(r.code, 1, name);
      assert.deepEqual(r.predicate.differing, [name]);
    }
  } finally { m.drop(); }
});

test("ADR-0113: strict fields added to a presence attestation are a difference, not a blessing", () => {
  const m = mission();
  try {
    const att = attest(m.dir);
    assert.equal(att.predicate.strict, false);
    assert.equal(verify(m.dir, save(m.dir, "presence.json", att)).result, "verified", "the control");
    const r = verify(m.dir, save(m.dir, "forged.json", forged(att, (p) => {
      p.seal = { present: true, count: 4242, sealedAt: "1999-12-31", violations: 0 };
      p.gateNonScope = "runward proves the code is correct.";
    })));
    assert.equal(r.code, 1);
    assert.deepEqual(r.predicate.differing, ["gateNonScope", "seal"]);
  } finally { m.drop(); }
});

test("ADR-0113: verify names what the digest covers, and an uncited file is said not covered", () => {
  const m = mission();
  try {
    const name = save(m.dir, "att.json", attest(m.dir, "--strict"));
    mkdirSync(join(m.dir, "code", "docs"), { recursive: true });
    writeFileSync(join(m.dir, "code", "docs", "added.txt"), "a note nothing cites and nothing reads\n");
    appendFileSync(join(m.dir, "code", "README.md"), "\nedited\n");
    const v = verify(m.dir, name);
    assert.equal(v.code, 0, "outside the perimeter, as the output now says");
    assert.ok(v.digest.covers.missionFiles > 0);
    assert.ok(v.digest.covers.citedOutside.includes("code/src/core/domain/guard.ts"), JSON.stringify(v.digest.covers));
    assert.ok(!v.digest.covers.citedOutside.includes("code/docs/added.txt"));
    // Beside the built-in analyzers (ADR-0118, pinned by the example): a source file they read is an
    // input of the verdict, so verify names the re-derived block, not the digest.
    mkdirSync(join(m.dir, "code", "src"), { recursive: true });
    writeFileSync(join(m.dir, "code", "src", "added.ts"), "export const run = (s: string) => s;\n");
    const a = verify(m.dir, name);
    assert.equal(a.code, 1, "the analyzers read it");
    assert.deepEqual(a.predicate.differing, ["analysis"]);
    assert.equal(a.digest.matches, true, "not bound by the digest: re-derived");
    rmSync(join(m.dir, "code", "src", "added.ts"));
    assert.match(v.digest.notCovered, /outside runward\/ that the manifests do not cite/);
    const h = human(m.dir, name);
    assert.doesNotMatch(h.out, /exact tree/, "the sentence that said more than the digest binds is gone");
    assert.match(h.out, /it binds runward\/ \(\d+ files\) and the \d+ evidence files the manifests cite outside it/);
    assert.match(h.out, /not covered: every other file of the project/);
    // The control: a cited file changed by one line is drift, exit 1.
    appendFileSync(join(m.dir, "code", "src", "core", "domain", "guard.ts"), "// one line\n");
    assert.equal(verify(m.dir, name).code, 1);
  } finally { m.drop(); }
});

test("ADR-0113: --whole-tree binds every delivered file as a second subject; a README edit is named, the verdict still re-derives", () => {
  const m = mission();
  try {
    writeFileSync(join(m.dir, ".gitignore"), "node_modules/\n*.log\n");
    writeFileSync(join(m.dir, "README.md"), "# a delivery\n");
    writeFileSync(join(m.dir, "debug.log"), "ignored\n");
    // No incidence on the gate: the same exit and the same --json with and without the flag.
    const plain = run(m.dir, "check", "--strict", "--json");
    const att = attest(m.dir, "--strict", "--whole-tree");
    assert.equal(att.subject.length, 2);
    assert.match(att.subject[1].name, / \(delivered tree\)$/);
    assert.ok("README.md" in att.predicate.deliveredTree.entries && !("debug.log" in att.predicate.deliveredTree.entries));
    assert.equal(run(m.dir, "check", "--strict", "--attest", "--whole-tree").status, plain.status);
    assert.equal(run(m.dir, "check", "--strict", "--json").stdout, plain.stdout);
    // The attestation written into its own tree is not part of what it binds.
    writeFileSync(join(m.dir, "verdict.intoto.json"), JSON.stringify(att, null, 2));
    const ok = verify(m.dir, "verdict.intoto.json");
    assert.equal(ok.code, 0, JSON.stringify(ok.tree));
    assert.equal(ok.tree.matches, true);
    assert.match(human(m.dir, "verdict.intoto.json").out, /the whole delivered tree matches \(\d+ files\)/);
    // An ignored file changes nothing; a delivered one is named, and the verdict's own reading stands.
    writeFileSync(join(m.dir, "debug.log"), "still ignored\n");
    assert.equal(verify(m.dir, "verdict.intoto.json").code, 0);
    appendFileSync(join(m.dir, "README.md"), "one more line\n");
    const v = verify(m.dir, "verdict.intoto.json");
    assert.equal(v.code, 1);
    assert.equal(v.result, "differs");
    assert.deepEqual(v.tree.changed, ["README.md"]);
    assert.equal(v.verdict.matches, true, "the verdict re-derives, said apart");
    assert.equal(v.predicate.matches, true);
    assert.match(human(m.dir, "verdict.intoto.json").out, /the whole delivered tree differs \(\d+ files attested, \d+ now\): 1 changed \(README\.md\)/);
    // A tree record edited to match the new file without its subject digest is incoherent, and refused.
    const recorded = forged(att, (p) => { p.deliveredTree.entries["README.md"] = "0".repeat(64); });
    assert.ok(verify(m.dir, save(m.dir, "incoherent.json", recorded)).predicate.differing.includes("deliveredTree"));
  } finally { m.drop(); }
});

test("ADR-0113: --whole-tree needs --attest, exit 2", () => {
  const m = mission();
  try {
    const r = run(m.dir, "check", "--strict", "--whole-tree");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--whole-tree.*add `--attest`/);
  } finally { m.drop(); }
});

test("ADR-0113: a red attestation is the same bytes however -p was typed, and its next step re-derives whole", () => {
  const m = mission();
  try {
    const f = join(m.dir, "runward", "handover.md");
    writeFileSync(f, readFileSync(f, "utf8").replace(/^(\| handover-agents-charter-final \| )applied( \|)/m, "$1$2"));
    const bare = run(m.dir, "check", "--strict", "--attest");
    const withP = run(m.dir, "check", "--strict", "--attest", "-p", ".");
    assert.equal(bare.status, 1);
    assert.equal(withP.stdout, bare.stdout, "measured 2026-11-05: `-p .` reached next.command, next.rerun and next.text");
    const att = JSON.parse(bare.stdout);
    assert.equal(att.predicate.next.rerun, "runward check --strict");
    assert.equal(verify(m.dir, save(m.dir, "red.json", att)).result, "verified", "an honest red attestation verifies (TOR-067)");
    const r = verify(m.dir, save(m.dir, "forged.json", forged(att, (p) => { p.next.rerun = "runward check"; })));
    assert.deepEqual(r.predicate.differing, ["next.rerun"]);
    // `check --json` keeps the echo: the reader is at the terminal that typed it.
    assert.match(JSON.parse(run(m.dir, "check", "--strict", "--json", "-p", ".").stdout).next.rerun, /-p \./);
  } finally { m.drop(); }
});

test("ADR-0113: hook outcomes are the attesting run's record — exit 2 when a command ran, compared when none could", () => {
  const m = mission();
  try {
    const name = (n) => save(m.dir, n, attest(m.dir, "--strict", "--hooks"));
    // No hooks.json: nothing ran, so nothing is taken on trust. The example ships one since ADR-0115
    // (its reports' regeneration, which runs npm): this case removes it.
    rmSync(join(m.dir, "runward", "hooks.json"), { force: true });
    assert.equal(verify(m.dir, name("absent.json")).result, "verified");
    writeFileSync(join(m.dir, "runward", "hooks.json"), JSON.stringify({ before: ["node -e \"process.exit(0)\""] }));
    const v = verify(m.dir, name("ran.json"));
    assert.equal(v.code, 2);
    assert.equal(v.result, "not-re-derivable");
    assert.equal(v.error, "not-re-derivable");
    assert.deepEqual(v.predicate.notReDerived, ["hooks.failed"]);
    assert.match(human(m.dir, "ran.json").out, /Re-run them: runward check --strict --hooks/);
    // A failure naming a command hooks.json does not hold is not the run's record: it differs.
    const att = JSON.parse(readFileSync(join(m.dir, "ran.json"), "utf8"));
    const r = verify(m.dir, save(m.dir, "forged.json", forged(att, (p) => { p.hooks.failed = [{ phase: "before", command: "rm -rf /" }]; p.gaps.hooks = 1; })));
    assert.equal(r.code, 1);
    assert.ok(r.predicate.differing.includes("hooks"), JSON.stringify(r.predicate.differing));
  } finally { m.drop(); }
});

test("ADR-0113: a bundle's result names what it covers", () => {
  const m = mission();
  try {
    const name = save(m.dir, "att.json", attest(m.dir, "--strict"));
    const b = run(m.dir, "bundle", name);
    writeFileSync(join(m.dir, "bundle.json"), b.stdout);
    assert.match(human(m.dir, "bundle.json").out, /verified — the 1 bundled artifact\(s\) are present and unchanged, by their raw bytes\. A file the bundle does not list is not covered\./);
  } finally { m.drop(); }
});

test("ADR-0113: verify reads hooks.json and runs nothing — no hook runner and no spawner in the command", () => {
  const src = readFileSync(join(ROOT, "dist", "commands", "verify.js"), "utf8");
  const RUNS = /\brunHooks\b|node:child_process|\bexecSync\b|\bspawnSync\b/;
  assert.ok(!RUNS.test(src), "verify re-derives; it never executes the operator's commands");
  assert.match(src, /import \{ readHooksConfig \} from "\.\.\/lib\/hooks\.js"/, "it reads the configuration, nothing else of the hook seam");
  // The positive control: the same pattern finds the runner where it legitimately lives.
  assert.ok(RUNS.test(readFileSync(join(ROOT, "dist", "commands", "check.js"), "utf8")), "check runs hooks under --hooks");
});

process.on("exit", () => rmSync(REFERENCE, { recursive: true, force: true }));

test("ADR-0113 beside ADR-0118: the analyzers read only the tree the project delivers; an ignored output emptied by a redirection changes nothing, a delivered file changed does", () => {
  const m = mission();
  try {
    // `runward verify att.json --json > out.json`: the shell empties out.json before verify reads the tree.
    appendFileSync(join(m.dir, ".gitignore"), "out.json\n");
    writeFileSync(join(m.dir, "out.json"), "{\"a\":1}\n");
    const name = save(m.dir, "att.json", attest(m.dir, "--strict"));
    writeFileSync(join(m.dir, "out.json"), "");
    const v = verify(m.dir, name);
    assert.equal(v.code, 0, `a file the project does not deliver is never read: ${JSON.stringify(v.predicate?.differing)}`);
    // The control: a file the project delivers, uncited and read by the analyzers, changed between the
    // two runs, still makes the verdict differ.
    appendFileSync(join(m.dir, "code", "src", "demo.ts"), "\nexport const run = (s: string) => eval(s);\n");
    const w = verify(m.dir, name);
    assert.equal(w.code, 1);
    assert.ok(w.predicate.differing.includes("analysis"), JSON.stringify(w.predicate.differing));
    assert.equal(w.verdict.matches, false, "the new capability finding is a gap: the re-derived verdict is red");
    assert.equal(w.digest.matches, true, "uncited: not bound by the digest, re-derived");
  } finally { m.drop(); }
});
