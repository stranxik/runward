// ADR-0119 decisions 4 and 6, the pieces that remained: the required level read from the mission's lock,
// the language fallback under it, the level printed on every strict run, and the level carried by the
// SARIF properties, the witness, the VSA and the delivery report, each only when the run read the
// levels, so every payload that does not ask for one keeps its bytes.
//
//   - the lock's `"requiredLevel"` is read under --strict, named as the source, refused at exit 5 below
//     it; the flag beats it, a --through prefix never reads it, and a value that is not a level is a
//     misuse (exit 2) the gate refuses rather than guess;
//   - `update` carries the line through as written, and writes none on its own;
//   - a `re-derived` the lock asks for, on a territory holding a language the analyzers do not read,
//     requires `mechanical` and says so at the character; asked by name, it refuses;
//   - every strict run prints the level the tree meets and what the next one would refuse;
//   - SARIF, witness, VSA, report and summary carry the levels only when read; the session gate asks
//     for none; `verify` re-derives a payload whose level the lock asked for.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLI, countedEnvelope, env, makeLab, mutationPolicy, runLab } from "../support/run-lab.js";
import { renderScaffoldLock } from "../../dist/lib/scaffold-lock.js";
import { NEW_MISSION_REQUIRED_LEVEL, languageFallbackLine, levelMetOf } from "../../dist/lib/evidence-levels.js";
import { NOT_WITNESSED } from "../../dist/lib/witness.js";

const POSIX = process.platform !== "win32";
const run = (dir, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: "utf8", env });
const strictJson = (dir, ...a) => JSON.parse(run(dir, "check", "--strict", ...a, "--json").stdout);
const FALLBACK = "re-derived: not reachable, Python is not analysed; this run requires mechanical";
const PROSE_ROW = "topology-usage-registry-present";

/** Set (or remove, with `undefined`) the lock's `requiredLevel`, the way an operator edits the line. */
function lockLevel(dir, value) {
  const p = join(dir, "runward", "scaffold-lock.json");
  const j = JSON.parse(readFileSync(p, "utf8"));
  if (value === undefined) delete j.requiredLevel; else j.requiredLevel = value;
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
/** A Python file in the delivered tree: a language the analyzers do not read. */
function addPython(dir) {
  mkdirSync(join(dir, "code", "tools"), { recursive: true });
  writeFileSync(join(dir, "code", "tools", "convert.py"), "def convert(x):\n    return x\n");
}

let base, pristine, example, locked;
const fresh = (from) => { const d = mkdtempSync(join(base, "case-")); cpSync(from, d, { recursive: true }); return d; };

before(() => {
  base = mkdtempSync(join(tmpdir(), "rw-level-lock-"));
  pristine = join(base, "pristine");
  execFileSync("git", ["init", "-q", pristine]);
  execFileSync(process.execPath, [CLI, "--yes", "init", "--example"], { cwd: pristine, env, stdio: "pipe" });
  // The fixture these cases measure a level against: the example with its usage registry row answered in
  // prose again (the state it shipped in before `re-derived` became the default of new missions, ADR-0119
  // decision 4) and no level in its lock, so one applied row rests on a declaration.
  example = fresh(pristine);
  const topo = join(example, "runward", "execution-topology.md");
  writeFileSync(topo, readFileSync(topo, "utf8").replace("file:runward/governance/usage-registry.md#triage-bot", "file:runward/execution-topology.md#Usage"));
  lockLevel(example, undefined);
  locked = fresh(example);
  lockLevel(locked, "re-derived");
});
after(() => rmSync(base, { recursive: true, force: true }));

test("ADR-0119 decision 4: the level the lock asks for is read under --strict, named as its source, and refused below it (exit 5)", () => {
  const j = strictJson(locked);
  assert.equal(j.exitCode, 5);
  assert.equal(j.verdict, "level-not-met");
  assert.deepEqual(j.require, { level: "re-derived", met: false });
  assert.deepEqual([j.levels.required, j.levels.source, j.levels.met], ["re-derived", "lock", false]);
  assert.deepEqual(j.levels.below.map((b) => b.rule), [PROSE_ROW], "the example's one prose row holds it, named");
  const text = run(locked, "check", "--strict");
  assert.equal(text.status, 5);
  assert.match(text.stdout, /required: re-derived \(asked by runward\/scaffold-lock\.json, `requiredLevel`\) · .*not met/);
  // The flag beats the lock; a prefix never reads it (a declared horizon speaks for progress).
  const flag = strictJson(locked, "--require", "mechanical");
  assert.deepEqual([flag.exitCode, flag.require, "levels" in flag], [0, { level: "mechanical", met: true }, false]);
  const prefix = JSON.parse(run(locked, "check", "--through", "floor", "--json").stdout);
  assert.equal("levels" in prefix, false, "the lock never applies to a prefix");
  assert.equal(prefix.require?.level ?? "traced", "traced");
  // A presence verdict asks for no level at all.
  const presence = JSON.parse(run(locked, "check", "--json").stdout);
  assert.equal("levels" in presence, false);
});

test("ADR-0119 decision 4: a lock value that is not a level is a misuse (exit 2), refused before the gate runs, never read as a weaker level", () => {
  const dir = fresh(example);
  lockLevel(dir, "gold");
  const r = run(dir, "check", "--strict");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /"requiredLevel": "gold"`, which is not a level of proof \(traced, mechanical, re-derived, attested\)/);
  assert.equal(r.stdout.includes("Summary"), false, "no partial audit is printed");
  const j = run(dir, "check", "--strict", "--json");
  assert.equal(j.status, 2);
  assert.deepEqual([JSON.parse(j.stdout).error, JSON.parse(j.stdout).exitCode], ["usage", 2]);
  assert.equal(run(dir, "check", "--strict", "--require", "mechanical").status, 2, "the flag does not launder an invalid lock");
});

test("ADR-0119 decision 4: update carries the lock's level through as written, even one check refuses, and never writes one on its own", () => {
  const files = { "a.md": "0".repeat(64) };
  const without = renderScaffoldLock("0.46.0", files, undefined, true, undefined, undefined, undefined, "runward-analysis/1");
  assert.equal(renderScaffoldLock("0.46.0", files, undefined, true, undefined, undefined, undefined, "runward-analysis/1", undefined), without, "no level: the lock keeps its bytes");
  assert.equal(JSON.parse(renderScaffoldLock("0.46.0", files, undefined, true, undefined, undefined, undefined, "runward-analysis/1", "re-derived")).requiredLevel, "re-derived");
  for (const value of ["re-derived", "gold"]) {
    const dir = fresh(example);
    lockLevel(dir, value);
    const u = run(dir, "update");
    assert.equal(u.status, 0, u.stderr);
    assert.equal(JSON.parse(readFileSync(join(dir, "runward", "scaffold-lock.json"), "utf8")).requiredLevel, value, `update preserves ${value}`);
  }
  const plain = fresh(example);
  assert.equal(run(plain, "update").status, 0);
  assert.equal("requiredLevel" in JSON.parse(readFileSync(join(plain, "runward", "scaffold-lock.json"), "utf8")), false, "update writes no level on its own");
  // `init` writes the level this release names for new missions: `re-derived` since ADR-0117's criterion 2
  // is published (docs/compliance/analyzers-on-real-repositories.md).
  const lock = JSON.parse(readFileSync(join(pristine, "runward", "scaffold-lock.json"), "utf8"));
  assert.equal(NEW_MISSION_REQUIRED_LEVEL, "re-derived");
  assert.equal(lock.requiredLevel, NEW_MISSION_REQUIRED_LEVEL);
});

test("ADR-0119 decision 4: a new mission that follows the blank template meets re-derived on its usage registry row; a pointer at the manifest itself is declared", () => {
  // The blank template keeps the usage registry in a file of its own, as `topology-usage-registry-present`
  // says, so the row of a new mission that follows it cites a file the gate opens; the same fact cited in
  // the manifest that carries the row is read as a declaration, below the level the lock asks for.
  const blank = mkdtempSync(join(base, "blank-"));
  execFileSync("git", ["init", "-q", blank]);
  execFileSync(process.execPath, [CLI, "--yes", "init"], { cwd: blank, env, stdio: "pipe" });
  assert.equal(JSON.parse(readFileSync(join(blank, "runward", "scaffold-lock.json"), "utf8")).requiredLevel, "re-derived");
  const registry = join(blank, "runward", "governance", "usage-registry.md");
  const placeholder = "| [deployment / environment] | [risk class] | [data classes] | [action scopes, approval points] | [named owner] | [date] |";
  assert.ok(readFileSync(registry, "utf8").includes(placeholder), "init scaffolds the registry's own file, its row still the template's");
  writeFileSync(registry, readFileSync(registry, "utf8").replace(placeholder,
    "| intake-bot / prod | medium | request text (personal possible) | read intake; write a ticket (approval-gated) | intake product owner | 2026-11-06 |"));
  const topo = join(blank, "runward", "execution-topology.md");
  const template = readFileSync(topo, "utf8");
  const slot = "| [rule-slug] | applied \\| deviated \\| n/a | [pointer, ADR-id, or reason] |";
  assert.ok(template.includes(slot), "the template's conformance row is where a mission writes its own");
  const row = (evidence) => writeFileSync(topo, template.replace(slot, `| ${PROSE_ROW} | applied | ${evidence} |`));
  const levelOf = (j) => Object.entries(j.levels.rows).filter(([, rows]) => rows.some((r) => r.deliverable === "execution-topology.md" && r.rule === PROSE_ROW)).map(([level]) => level);

  row("file:runward/governance/usage-registry.md#intake-bot — one deployment, its risk class, data classes, action scopes and owner");
  const own = strictJson(blank);
  assert.equal(own.levels.required, "re-derived");
  assert.deepEqual(levelOf(own), ["re-derived"], "the registry in its own file is opened and checked");
  assert.ok(!own.levels.below.some((b) => b.rule === PROSE_ROW), "nothing holds the row below the level");

  row('file:runward/execution-topology.md#"Usage registry" — the section above');
  const self = strictJson(blank);
  assert.deepEqual(levelOf(self), ["declared"], "a pointer at the manifest itself is a declaration");
  const held = self.levels.below.find((b) => b.rule === PROSE_ROW);
  assert.match(held?.holds?.[0] ?? "", /the gate does not open it as evidence/);
});

test("ADR-0119 decision 4: the lock's re-derived on a territory holding Python requires mechanical and says so at the character; asked by name, it refuses", () => {
  const dir = fresh(locked);
  addPython(dir);
  const j = strictJson(dir);
  assert.equal(j.exitCode, 0);
  assert.equal(j.levels.fallback, FALLBACK);
  assert.deepEqual(j.require, { level: "mechanical", met: true }, "the level met is never overstated: mechanical, not re-derived");
  assert.deepEqual(j.levels.below, [], "under the fallback a declared row holds nothing");
  assert.equal(j.levels.rows.declared.length, 1, "and is still listed at its level");
  const text = run(dir, "check", "--strict").stdout;
  assert.ok(text.includes(FALLBACK));
  assert.match(text, /required: mechanical \(re-derived asked by runward\/scaffold-lock\.json, `requiredLevel`\)/);
  const named = strictJson(dir, "--require", "re-derived");
  assert.equal(named.exitCode, 5);
  assert.equal("fallback" in named.levels, false, "only --require re-derived, asked by name, refuses the territory");
  assert.equal(named.levels.territory.why, "re-derived: not reachable, Python is not analysed");
  const vsa = JSON.parse(run(dir, "check", "--strict", "--vsa", "--resource-uri", "pkg:npm/demo@1").stdout);
  assert.deepEqual(vsa.predicate.verifiedLevels, ["RUNWARD_GATE_STRICT", "RUNWARD_PROOF_MECHANICAL"]);
  assert.equal(languageFallbackLine(["Go", "Python"]), "re-derived: not reachable, Go, Python are not analysed; this run requires mechanical");
  assert.equal(levelMetOf({ met: true, required: "re-derived", fallback: FALLBACK }), "mechanical");
  assert.equal(levelMetOf({ met: false, required: "attested" }), null);
});

test("ADR-0119 decision 4: every strict run prints the level the tree meets and what the next level would refuse, and its payload carries no levels", () => {
  const text = run(example, "check", "--strict");
  assert.equal(text.status, 0);
  assert.match(text.stdout, /◌ level of proof this tree meets: mechanical; the next level, re-derived, would refuse 1 row\(s\) that rest on a declaration \(`runward check --strict --require re-derived` names each; runward ADR-0119\)/);
  assert.equal("levels" in strictJson(example), false);
});

test("ADR-0119 decision 6: SARIF, witness, VSA, report and summary carry the levels only when the run read them", () => {
  // SARIF: the run's property bag.
  const sarifWith = JSON.parse(run(example, "check", "--strict", "--require", "re-derived", "--sarif").stdout).runs[0];
  assert.deepEqual([sarifWith.properties.levels.required, sarifWith.properties.levels.source, sarifWith.properties.levels.met, sarifWith.properties.levels.signatureVerified], ["re-derived", "flag", false, false]);
  assert.deepEqual(sarifWith.properties.levels.rows.declared, [{ deliverable: "execution-topology.md", rule: PROSE_ROW }]);
  assert.equal(sarifWith.properties.levels.rows["re-derived"].length, 23);
  const sarifWithout = JSON.parse(run(example, "check", "--strict", "--sarif").stdout).runs[0];
  assert.equal(sarifWithout.properties?.levels, undefined);
  // Witness: a member and a not-witnessed family, for that witness alone.
  const wWith = join(base, "with.witness.json");
  const wWithout = join(base, "without.witness.json");
  assert.equal(run(example, "check", "--strict", "--require", "re-derived", "--witness", wWith).status, 5);
  assert.equal(run(example, "check", "--strict", "--witness", wWithout).status, 0);
  const a = JSON.parse(readFileSync(wWith, "utf8"));
  const b = JSON.parse(readFileSync(wWithout, "utf8"));
  assert.deepEqual([a.levels.required, a.levels.source, a.levels.met, a.levels.signatureVerified], ["re-derived", "flag", false, false]);
  assert.equal(a.levels.rows.length, 24);
  assert.deepEqual(a.levels.rows.find((r) => r.rule === PROSE_ROW).level, "declared");
  assert.deepEqual(a.notWitnessed.at(-1), { family: "levels", why: a.notWitnessed.at(-1).why, causes: 0 });
  assert.equal("levels" in b, false);
  assert.deepEqual(b.notWitnessed.map((x) => x.family), Object.keys(NOT_WITNESSED));
  // VSA: one more custom value, only when the level is read and met on exit 0.
  const vsa = (dir, ...x) => JSON.parse(run(dir, "check", "--strict", ...x, "--vsa", "--resource-uri", "pkg:npm/demo@1").stdout).predicate;
  assert.deepEqual(vsa(example).verifiedLevels, ["RUNWARD_GATE_STRICT"]);
  assert.deepEqual(vsa(example, "--require", "re-derived").verifiedLevels, ["FAILED"], "a level not met is not a pass");
  assert.equal(vsa(example, "--require", "re-derived").verificationResult, "FAILED");
  // The delivery report and the summary, under the lock.
  assert.equal(run(locked, "report", "--out", "r.html").status, 0);
  assert.match(readFileSync(join(locked, "r.html"), "utf8"), /Level of proof required: <strong>re-derived<\/strong> \(asked by the mission's lock\), not met/);
  assert.equal(run(locked, "report", "--format", "md", "--out", "r.md").status, 0);
  const md = readFileSync(join(locked, "r.md"), "utf8");
  assert.match(md, /\| Level of proof \| `re-derived` required \(asked by the mission's lock\), not met \|/);
  assert.match(md, new RegExp(`\\| \`execution-topology\\.md\` \\| \`${PROSE_ROW}\` \\| \`declared\` \\| rests on`));
  assert.equal(run(example, "report", "--out", "r.html").status, 0);
  assert.equal(readFileSync(join(example, "r.html"), "utf8").includes("Level of proof"), false);
  rmSync(join(example, "r.html"));
  rmSync(join(locked, "r.html"));
  rmSync(join(locked, "r.md"));
});

test("ADR-0119 decision 4: status names the level the lock asks for, and the session gate asks for none", () => {
  const s = run(locked, "status");
  assert.match(s.stdout, /no gap, the level of proof required is not met: re-derived \(exit 5, ADR-0119\)/);
  const hook = spawnSync(process.execPath, [CLI, "gate-hook", "--harness", "claude"], { cwd: locked, env, encoding: "utf8", input: "{}" });
  assert.equal(hook.status, 0, "the session gate asks for gaps; a level the lock asks for is the CI's question");
  assert.equal(hook.stdout, "");
});

test("ADR-0119 decision 6: verify re-derives a payload whose level the lock asked for, and refuses it once the lock no longer asks", () => {
  const dir = fresh(locked);
  const file = join(base, "locked.intoto.json");
  writeFileSync(file, run(dir, "check", "--strict", "--attest").stdout);
  const ok = run(dir, "verify", file);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  lockLevel(dir, undefined);
  assert.notEqual(run(dir, "verify", file).status, 0, "the same payload, the lock line gone: a difference");
});

test("ADR-0119 decision 6: an attested the lock asks for keeps its name under the fallback, and the VSA says the level met", { skip: POSIX ? false : "runward-run drives a Linux container runtime; its fake runtime is a POSIX executable" }, () => {
  const lab = makeLab(join(base, "lab"));
  mkdirSync(join(base, "lab-run"));
  const r = runLab(join(base, "lab-run"), lab, { policy: mutationPolicy() });
  assert.equal(r.status, 0, r.stderr);
  cpSync(r.out, lab, { recursive: true });
  const st = readFileSync(join(lab, "code", "reports", "runward-run.intoto.json"));
  writeFileSync(join(lab, "code", "reports", "runward-run.dsse.json"), countedEnvelope(st));
  const vsa = (dir, ...x) => JSON.parse(run(dir, "check", "--strict", ...x, "--vsa", "--resource-uri", "pkg:npm/demo@1").stdout).predicate.verifiedLevels;
  assert.deepEqual(vsa(lab, "--require", "attested"), ["RUNWARD_GATE_STRICT", "RUNWARD_PROOF_ATTESTED"]);
  assert.deepEqual(vsa(lab, "--require", "re-derived"), ["RUNWARD_GATE_STRICT", "RUNWARD_PROOF_RE_DERIVED"]);
  lockLevel(lab, "attested");
  const j = strictJson(lab);
  assert.deepEqual([j.exitCode, j.require, j.levels.source], [0, { level: "attested", met: true }, "lock"]);
  // A Python file in the territory: no analyzer reads it, so it is outside the expected set and the
  // binding holds; the static half falls to mechanical, said for that half only, and the level met is
  // never overstated (each level includes the one below it).
  const py = fresh(lab);
  addPython(py);
  const k = strictJson(py);
  assert.equal(k.levels.fallback, `${FALLBACK} for its static half, and attested for its execution`);
  assert.deepEqual([k.exitCode, k.require], [0, { level: "attested", met: true }], "only the static half falls; the name is kept");
  assert.deepEqual(vsa(py), ["RUNWARD_GATE_STRICT", "RUNWARD_PROOF_MECHANICAL"]);
});
