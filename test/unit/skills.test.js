// Harness phase skills: generated artifacts that `update` must keep current.
//
// A field report found a mission whose skills had been laid down by `runward init 0.14.1` while
// the installed package was 0.31.0 — seventeen releases behind, with nothing signalling it.
// `update` refreshed workflows, rules and adapters, and skipped the skills; the scaffold lock did
// not even record them. The stale skill described evidence in prose, so an entire mission wrote
// rows the gate could not verify. These tests pin the three properties that failure needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, sep } from "node:path";
import { baselineSkills, existingSkillDirs, skillsForDir, TOOL_PROFILES } from "../../dist/lib/tools.js";
import { corpusDivergence, hashText } from "../../dist/lib/scaffold-lock.js";

const scratch = () => mkdtempSync(join(tmpdir(), "rw-skills-"));
const plant = (root, rel) => {
  for (const f of skillsForDir(root, rel)) {
    mkdirSync(dirname(f.path), { recursive: true });
    writeFileSync(f.path, "stale");
  }
};

test("the skill names the gesture that LISTS the rules, not only the one that reads one", () => {
  // The stale skill said "confront the rules" and named only `explain <rule>`, which needs a name
  // you do not have yet. Same defect AGENTS.md carried until 0.30.0: an obligation with no
  // instrument cannot be executed, and the agent lists names instead of reading bodies.
  for (const s of baselineSkills("/tmp/x")) {
    assert.match(s.content, /runward rules --phase/, `${s.path}: names the listing gesture`);
    assert.match(s.content, /runward explain <rule>/, `${s.path}: names the reading gesture`);
    assert.match(s.content, /typed pointer the gate verifies/, `${s.path}: names the typed grammar`);
    assert.match(s.content, /file:PATH\[:LINE\]\[#SYMBOL\]/, `${s.path}: spells the grammar out`);
  }
});

test("skill homes are derived from what init writes, never from a hand-kept list", () => {
  // The candidate list was restated by hand in the first version of this fix. A profile shipping
  // skills under a new directory would then be silently uncovered — the same species of defect as
  // the release stamp guard that checked a hand-kept manifest list.
  const root = scratch();
  try {
    const homes = new Set([join(".agents", "skills")]);
    for (const p of TOOL_PROFILES) {
      for (const f of p.files("/probe")) {
        const m = f.path.slice("/probe".length + 1).match(/^(.*skills)[/\\]/);
        if (m) homes.add(m[1]);
      }
    }
    for (const rel of homes) plant(root, rel);
    const found = existingSkillDirs(root);
    assert.deepEqual([...found].sort(), [...homes].sort(),
      "every home a profile writes to must be a home update looks at");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("existingSkillDirs reports only homes that EXIST, so update never invents one", () => {
  // `update` reads the mission repo; it does not decide the harness layout. A mission that never
  // took the claude profile must not suddenly grow `.claude/skills/`.
  const root = scratch();
  try {
    assert.deepEqual(existingSkillDirs(root), [], "nothing planted, nothing reported");
    plant(root, join(".agents", "skills"));
    assert.deepEqual(existingSkillDirs(root), [join(".agents", "skills")],
      "only the home that exists");
    assert.ok(!existsSync(join(root, ".claude", "skills")), "and no other is created");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("skillsForDir keys are root-relative and cannot collide with mission-relative lock keys", () => {
  // The lock stores `rules/x.md` relative to `runward/`. Skill keys live outside it, so they are
  // stored root-relative and start with a dot — a collision would silently pair a rule's hash with
  // a skill's, which is the kind of mix-up that ends in a wrong "you edited it".
  const files = skillsForDir("/r", join(".agents", "skills"));
  assert.ok(files.length >= 5, `${files.length} skills`);
  for (const f of files) {
    assert.ok(f.key.startsWith("."), `${f.key} is root-relative and dot-prefixed`);
    assert.ok(!f.key.startsWith("rules/") && !f.key.startsWith("workflows/") && !f.key.startsWith("adapters/"),
      `${f.key} cannot collide with a mission-relative key`);
    assert.equal(f.path, join("/r", f.key), "path is key resolved against root");
  }
});

test("a mission with no local rule copy has no corpus to verify, and is not warned about", () => {
  // `corpusDivergence` warned "this mission predates scaffold-lock.json" on the SAFEST possible
  // configuration: no local copy at all, so the gate judges against the installed package under
  // node_modules — outside the audited repository, with nothing for the audited party to edit.
  // Both runward's own mission and the shipped example are in that state, so every user would have
  // met a false alarm on their first `check`. Found by looking at the demo output, not by a test.
  const root = mkdtempSync(join(tmpdir(), "rw-corpus-"));
  try {
    mkdirSync(join(root, "runward"), { recursive: true });
    assert.equal(corpusDivergence(join(root, "runward"), "").status, "package",
      "no local copy: nothing to verify, and nothing to warn about");
    // With a local copy but no lock, the warning IS legitimate: that corpus is editable.
    mkdirSync(join(root, "runward", "rules"), { recursive: true });
    writeFileSync(join(root, "runward", "rules", "a-rule.md"), "---\nimpact: HIGH\n---\n\nbody\n");
    assert.equal(corpusDivergence(join(root, "runward"), "").status, "unrecorded");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("house rules are welcome; only an extension that would satisfy the gate is refused", () => {
  // Refusing every rule runward did not write made a normal team's mission red: adding house rules
  // is legitimate and desirable. What cannot be allowed is an unwritten rule COUNTING toward the
  // non-vacuity floor — that is how a fabricated corpus (36 files of "ok") passed. The line is
  // drawn on effect, not on origin.
  const root = mkdtempSync(join(tmpdir(), "rw-house-"));
  const mission = join(root, "runward");
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    writeFileSync(join(mission, "rules", "shipped.md"), "---\nimpact: HIGH\nphases: [floor]\n---\n\nbody\n");
    writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({
      version: 1, writtenBy: "0.31.0",
      files: { "rules/shipped.md": hashText(readFileSync(join(mission, "rules", "shipped.md"), "utf8")) },
    }));
    const extras = (impact, phases) => {
      writeFileSync(join(mission, "rules", "house.md"), `---\nimpact: ${impact}\nphases: ${phases}\n---\n\nours\n`);
      return corpusDivergence(mission, "").extra;
    };
    assert.deepEqual(extras("MEDIUM", "[]"), [], "a house rule that cannot satisfy a floor is fine");
    assert.deepEqual(extras("LOW", "[floor]"), [], "impact below the gate's bar is fine");
    assert.deepEqual(extras("CRITICAL", "[]"), [], "no gated phase, no inflation");
    assert.deepEqual(extras("CRITICAL", "[floor]"), ["house.md"], "this one WOULD stand in for a shipped rule");
    assert.deepEqual(extras("HIGH", "[govern, floor]"), ["house.md"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("line endings are not content, and the lock is not the authority", () => {
  // Two inverse-pass findings, one test. A Windows checkout (`core.autocrlf`, `* text=auto`)
  // rewrites every file, and the corpus check reported all 64 rules as edited — on a repository
  // nobody had touched, with `update` unable to repair it. And the lock lives INSIDE the audited
  // repository: re-signing it in the same commit made a corpus of "ok" files pass, so the check
  // bought nothing against anyone deliberate while costing honest teams a red gate.
  const root = mkdtempSync(join(tmpdir(), "rw-auth-"));
  const mission = join(root, "runward");
  const pkg = join(root, "pkg-rules");
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    mkdirSync(pkg, { recursive: true });
    const shipped = "---\nimpact: HIGH\nphases: [floor]\n---\n\nbody\n";
    writeFileSync(join(pkg, "shipped.md"), shipped);
    writeFileSync(join(mission, "rules", "shipped.md"), shipped);
    writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({
      version: 1, writtenBy: "0.31.0", files: { "rules/shipped.md": hashText(shipped) },
    }));
    assert.deepEqual(corpusDivergence(mission, pkg).edited, [], "baseline is clean");

    // CRLF: git doing its documented job must not turn a mission red.
    writeFileSync(join(mission, "rules", "shipped.md"), shipped.replace(/\n/g, "\r\n"));
    assert.deepEqual(corpusDivergence(mission, pkg).edited, [], "CRLF is not an edit");

    // A forged lock cannot vouch for a fabricated corpus: what the PACKAGE ships must be there.
    writeFileSync(join(mission, "rules", "shipped.md"), shipped);
    rmSync(join(mission, "rules", "shipped.md"));
    writeFileSync(join(mission, "rules", "made-up.md"), "---\nimpact: CRITICAL\nphases: [floor]\n---\n\nok\n");
    writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({
      version: 1, writtenBy: "0.31.0",
      files: { "rules/made-up.md": hashText("---\nimpact: CRITICAL\nphases: [floor]\n---\n\nok\n") },
    }));
    assert.deepEqual(corpusDivergence(mission, pkg).missing, ["shipped.md"],
      "the shipped rule is gone, and re-signing the lock does not hide it");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
