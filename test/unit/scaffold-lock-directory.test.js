// What counts as a rule in a rules directory, and what the corpus verdict owes a consumer.
//
// `corpusDivergence` compares the rules a mission holds against the rules the installed package
// ships, and publishes three lists — missing, edited, extra — that `check --json` exposes and that
// the strict conformance count reads. Instructing the module on 2026-08-29 found 26 holes, and the
// striking thing is which DIRECTION they point: most of them make the gate red on an honest tree.
//
//   · a `.DS_Store` in the package's rules directory — which macOS Finder creates in any checkout
//     it is browsed in — is demanded of the mission as a missing rule, and the strict gap count
//     goes 36 → 37. The operator is accused of deleting a rule that never existed.
//   · a subdirectory under `runward/rules/` is reported as an EXTRA rule, same +1.
//   · a house rule recorded in the lock that the package does not ship — the ADR-0057 vendored
//     corpus case — makes `check` die on ENOENT and emit no JSON at all.
//   · the `package` and `unrecorded` results drop `missing`/`edited`/`extra` entirely, so a
//     consumer reading `corpus.missing.length` on the documented contract throws.
//
// And one that is neither: the lists' order becomes filesystem-dependent. APFS here returns readdir
// already sorted, which is why nothing saw it; ext4 and XFS do not, so the same tree would publish
// a different document on a Linux runner. That is measured below with a reversed reader rather than
// asserted, because this machine cannot show it any other way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusDivergence, renderScaffoldLock, hashText } from "../../dist/lib/scaffold-lock.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGE_RULES = join(ROOT, "templates", "rules");

const RULE = (title, extra = "") =>
  `---\ntitle: ${title}\nimpact: HIGH\nphases: [floor]\n${extra}---\n\n${title} body.\n`;

const dirs = [];
/**
 * A mission rules directory and a package rules directory, both under our control.
 * @param {{mission?: Record<string,string>, pkg?: Record<string,string>, missionDirs?: string[], pkgDirs?: string[]}} spec
 */
function trees(spec = {}) {
  const root = mkdtempSync(join(tmpdir(), "rw-corpus-"));
  dirs.push(root);
  const mission = join(root, "mission");
  const missionRules = join(mission, "rules");
  const pkg = join(root, "package-rules");
  mkdirSync(missionRules, { recursive: true });
  mkdirSync(pkg, { recursive: true });
  for (const [name, body] of Object.entries(spec.pkg ?? {})) writeFileSync(join(pkg, name), body);
  for (const [name, body] of Object.entries(spec.mission ?? {})) writeFileSync(join(missionRules, name), body);
  for (const d of spec.missionDirs ?? []) mkdirSync(join(missionRules, d), { recursive: true });
  for (const d of spec.pkgDirs ?? []) mkdirSync(join(pkg, d), { recursive: true });
  return { mission, pkg, missionRules };
}
/** The lock runward itself would have written for these mission rules. */
function withLock({ mission, missionRules }, only) {
  const files = {};
  for (const f of readdirSync(missionRules).filter((x) => x.endsWith(".md"))) {
    if (only && !only.includes(f)) continue;
    files[`rules/${f}`] = hashText(RULE(f.replace(/\.md$/, "")));
  }
  writeFileSync(join(mission, "scaffold-lock.json"),
    JSON.stringify({ version: 1, writtenBy: "test", files }, null, 2) + "\n");
  return mission;
}
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

test("a file that is not a rule is not demanded of the mission, on either side", () => {
  // `.DS_Store` is the case that matters: nobody puts it there, macOS does, and it lands in a
  // package directory the operator never touches.
  const t = trees({
    pkg: { "a-rule.md": RULE("a-rule"), ".DS_Store": "\0\0", "corpus.json": '{"name":"acme"}' },
    mission: { "a-rule.md": RULE("a-rule") },
    pkgDirs: ["archive"],
  });
  withLock(t);
  const d = corpusDivergence(t.mission, t.pkg);
  assert.deepEqual(d.missing, [],
    "a non-rule in the package directory was demanded of the mission — the operator is accused of " +
    "deleting a rule that never existed, and the strict gap count goes up by one for a file " +
    "macOS created");
});

test("a directory under the mission's rules is not an extra rule", () => {
  const t = trees({
    pkg: { "a-rule.md": RULE("a-rule") },
    mission: { "a-rule.md": RULE("a-rule"), "NOTES.txt": "not a rule\n" },
    missionDirs: ["archive"],
  });
  withLock(t);
  const d = corpusDivergence(t.mission, t.pkg);
  assert.deepEqual(d.extra, [],
    "a subdirectory or a note under runward/rules/ was reported as a rule runward never wrote — " +
    "the gate refuses a mission nobody tampered with");
});

test("a mission whose rules directory holds no rule at all is judged against the package", () => {
  const t = trees({ pkg: { "a-rule.md": RULE("a-rule") }, mission: { "corpus.json": '{"name":"acme"}' } });
  const d = corpusDivergence(t.mission, t.pkg);
  assert.equal(d.status, "package",
    "a directory holding only a vendored corpus.json is not a local rule copy; judging it as one " +
    "reports every shipped rule as missing at once");
  assert.deepEqual([d.missing, d.edited, d.extra], [[], [], []]);
});

test("the machine contract carries its three lists in every status", () => {
  for (const [label, d] of [
    ["package", corpusDivergence(trees({ pkg: { "a.md": RULE("a") } }).mission, PACKAGE_RULES)],
    ["unrecorded", (() => {
      const t = trees({ pkg: { "a.md": RULE("a") }, mission: { "a.md": RULE("a") } });
      return corpusDivergence(t.mission, t.pkg);   // no lock written
    })()],
  ]) {
    for (const field of ["missing", "edited", "extra"]) {
      assert.ok(Array.isArray(d[field]),
        `${label}: corpus.${field} is absent from the published result — a consumer reading ` +
        `corpus.${field}.length on the documented contract throws, and the contract says "empty " +
        "rather than absent"`);
      assert.deepEqual(d[field], [],
        `${label}: corpus.${field} carries an entry on a status that compares nothing`);
    }
  }
});

test("a rule the lock records and the package does not ship is reported, not fatal", () => {
  // ADR-0057 lets an organisation vendor its own rules into the mission. Editing one of those must
  // not send runward looking for it inside the installed package.
  const t = trees({
    pkg: { "a-rule.md": RULE("a-rule") },
    mission: { "a-rule.md": RULE("a-rule"), "zz-house.md": RULE("zz-house") },
  });
  withLock(t);
  writeFileSync(join(t.missionRules, "zz-house.md"), RULE("zz-house") + "\nedited after the lock\n");
  let d;
  assert.doesNotThrow(() => { d = corpusDivergence(t.mission, t.pkg); },
    "reading a rule the package does not ship threw instead of answering — `check` then emits no " +
    "document at all, which is a broken gate rather than a reported divergence");
  assert.ok(d.edited.includes("zz-house.md"), "the edited house rule was not reported");
});

test("the three lists are ordered by name, not by the order the reader returns", () => {
  // This machine's filesystem returns readdir already sorted, so ordinary names cannot show the
  // defect — which is exactly why nothing saw it. What DOES separate the two orders here is that a
  // directory reader walks UTF-8 BYTES while `Array#sort` compares UTF-16 CODE UNITS, and the two
  // disagree above the BMP: U+FFFD encodes as EF BF BD and an astral character as F0 …, so bytes
  // put U+FFFD first, while code units put the astral one first (its lead surrogate is D83D).
  // A tree named this way tells the two apart on any filesystem.
  const ASTRAL = "\u{1F600}-rule.md";
  const BMP = "\uFFFD-rule.md";
  const t = trees({
    pkg: { [ASTRAL]: RULE("astral"), [BMP]: RULE("bmp"), "aa.md": RULE("aa") },
    mission: { "aa.md": RULE("aa") },
  });
  withLock(t);
  const d = corpusDivergence(t.mission, t.pkg);
  assert.deepEqual(d.missing, [...d.missing].sort(),
    "the missing list came back in the order the directory reader returned it. A machine surface " +
    "that reorders itself is not comparable across runs, and the difference only appears on a " +
    "filesystem whose byte order is not the code-unit order — that is, on the CI runner and not here");
  assert.deepEqual(d.missing, [ASTRAL, BMP].sort(),
    "the missing set itself changed, which is a different defect from the ordering one");
});

test("a malformed corpus pin is suppressed, never published as a drift", () => {
  const t = trees({ pkg: { "a.md": RULE("a") }, mission: { "a.md": RULE("a") } });
  writeFileSync(join(t.missionRules, "corpus.json"), JSON.stringify({ name: "acme", version: "1.0.0" }));
  for (const pin of [{ name: 7, version: "1.0.0" }, { name: "acme", version: 7 }, "acme", 7, null, {}]) {
    writeFileSync(join(t.mission, "scaffold-lock.json"),
      JSON.stringify({ version: 1, writtenBy: "test", files: {}, corpus: pin }, null, 2) + "\n");
    let d;
    assert.doesNotThrow(() => { d = corpusDivergence(t.mission, t.pkg); },
      `a lock pinned ${JSON.stringify(pin)} threw — a hand-edited lock must be refused, not fatal`);
    assert.equal(d.drift ?? null, null,
      `a lock pinned ${JSON.stringify(pin)} produced a corpus drift; a pin that is not a {name, ` +
      "version} pair of strings names nothing, and reporting a drift against it accuses the " +
      "operator of a divergence that cannot be computed");
  }
});

test("the lock runward writes ends with a newline", () => {
  const rendered = renderScaffoldLock({ "rules/a.md": hashText(RULE("a")) }, "test");
  assert.equal(rendered.endsWith("\n"), true,
    "the lock lost its trailing newline: every tool that appends, diffs or concatenates it now " +
    "sees a different file, and its own sha256 moves");
  assert.equal(rendered.trimEnd().endsWith("}"), true, "the lock is not valid JSON any more");
});

// ── RWD-2026-0102: a recorded key is a name, never an OS path ────────────────────────────────────
test("skill keys are spelled with forward slashes whatever the OS separator did", async () => {
  // The lock is committed and travels between operating systems. A lock written on Windows carried
  // `.agents\\skills\\…` keys a Linux reader could never look up: update saw every skill as
  // never-recorded on a tree that had not moved. Caught by the init golden's Windows leg on
  // 2026-09-02 — one file of 121 hashed differently, and the one file was the lock itself.
  const { skillsForDir } = await import("../../dist/lib/tools.js");
  for (const f of skillsForDir("/tmp/x", ".agents\\skills")) {
    assert.ok(!f.key.includes("\\"),
      `a recorded key carries a backslash: ${f.key} — it would be unreadable on any other OS`);
    assert.match(f.key, /^\.agents\/skills\/runward-[a-z]+\/SKILL\.md$/,
      "the key must be the forward-slash name of the skill file");
  }
});

test("a lock written with backslash keys is still read, normalised", async () => {
  const { readScaffoldLock } = await import("../../dist/lib/scaffold-lock.js");
  const dir = mkdtempSync(join(tmpdir(), "rw-lock-bs-"));
  try {
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({
      version: 1, writtenBy: "runward 0.37.1",
      files: { "rules\\a-rule.md": "abc", ".agents\\skills\\runward-floor\\SKILL.md": "def" },
    }));
    const lock = readScaffoldLock(dir);
    assert.ok(lock, "a well-formed lock must read");
    assert.deepEqual(Object.keys(lock.files).sort(), [".agents/skills/runward-floor/SKILL.md", "rules/a-rule.md"],
      "keys recorded by a pre-fix Windows binary must come back as portable names — the committed " +
      "lock of an existing mission is not something a fix may orphan");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a lock whose files field is null is refused, not walked (consolidated pass)", async () => {
  const { readScaffoldLock } = await import("../../dist/lib/scaffold-lock.js");
  // `typeof null === "object"`: without the explicit null guard, every reader downstream walks
  // Object.entries(null) and throws. The guard's mutant (null → never) survived the first pass.
  const dir = mkdtempSync(join(tmpdir(), "rw-lock-null-"));
  try {
    writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify({ version: 1, files: null }));
    assert.equal(readScaffoldLock(dir), null, "files: null is a malformed lock — absence, not a crash");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
