// The corpus check, term by term — the only mechanism that tells the gate whether the rules it
// judges a mission against are the rules runward wrote.
//
// ADR-0045 class 1: `check --strict` exited 0 on a mission whose rule files had been reduced to the
// word "ok", because ADR-0002's floor is an invariant of CARDINALITY over a set the audited party
// owns. `corpusDivergence` is the import of that detector into the verdict, and each of its three
// lists is added to `strictGaps` (src/lib/verdict.ts) — so a term reduced to a constant is an exit
// code, never a cosmetic difference.
//
// Measured on 2026-08-08 against a mission built by the real CLI (`init --yes --example`: 64 local
// rules, `check --strict` exit 0), one mutation at a time in dist/:
//   · `!missing.includes(file)` → `false`  : a shipped rule DELETED from the mission → **exit 0**.
//     Nothing else caught it — not the floor, not the mapping. The corpus term stands alone there.
//   · `!existsSync(abs)`        → `false`  : the same deletion throws ENOENT out of `check`, and
//     `check --strict --json` emits ZERO bytes — no verdict payload at all for an agent driving
//     on the machine contract.
// The remaining cases pin the opposite direction: a term made permanently true reddens a mission
// nobody touched, which is the failure mode ADR-0045 spent 22 false positives on.
//
// Every guard below is exercised in BOTH directions. A corpus check that reports everything passes
// a one-sided fixture exactly as well as a correct one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify, corpusDivergence, hashText, readScaffoldLock } from "../../dist/lib/scaffold-lock.js";

const RULE = (impact = "MEDIUM", phases = "[]", body = "body") =>
  `---\nimpact: ${impact}\nphases: ${phases}\n---\n\n${body}\n`;

// The three things `corpusDivergence` arbitrates between: the mission's own copy of the rules, the
// record of what runward wrote, and the installed package that cannot be re-signed from the repo.
function bench() {
  const root = mkdtempSync(join(tmpdir(), "rw-corpus-term-"));
  const mission = join(root, "runward");
  const pkg = join(root, "pkg", "rules");
  mkdirSync(join(mission, "rules"), { recursive: true });
  mkdirSync(pkg, { recursive: true });
  return {
    root, mission, pkg,
    rule: (name, text) => writeFileSync(join(mission, "rules", name), text),
    shipped: (name, text) => writeFileSync(join(pkg, name), text),
    lock: (files) => writeFileSync(join(mission, "scaffold-lock.json"),
      JSON.stringify({ version: 1, writtenBy: "0.33.2", files })),
    drop: () => rmSync(root, { recursive: true, force: true }),
  };
}

// ── What is no longer there ─────────────────────────────────────────────────────────────────────

test("a recorded rule the operator removed is NAMED missing — not swallowed, and not thrown over", () => {
  // The measured hole: with the guard on line 123 reduced to a constant, deleting a rule from a
  // real mission exits 0. The deletion reaches no second mechanism, so this list is the verdict.
  // The package is deliberately out of the picture here: only the RECORD can report this file,
  // which is what keeps the assertion about the term under test and not about the shipped-name loop.
  const b = bench();
  try {
    b.rule("a.md", RULE());
    b.rule("b.md", RULE());
    b.lock({ "rules/a.md": hashText(RULE()), "rules/b.md": hashText(RULE()) });
    assert.deepEqual(corpusDivergence(b.mission, "").missing, [], "both recorded rules are on disk");

    rmSync(join(b.mission, "rules", "b.md"));
    const v = corpusDivergence(b.mission, "");
    assert.deepEqual(v.missing, ["b.md"], "the removed rule must be named, exactly once");
    assert.deepEqual(v.edited, [], "and removing one rule says nothing about the others");
  } finally { b.drop(); }
});

test("a shipped rule that IS on disk is not an absence, whatever the record forgot", () => {
  // The union rule: what must be there is what runward recorded PLUS what the package ships. Read
  // as "on disk OR recorded is enough", it holds. Read as "on disk AND recorded", every mission
  // whose lock predates a shipped rule is accused of having lost a file it is looking at.
  const b = bench();
  try {
    b.shipped("a.md", RULE());
    b.shipped("c.md", RULE());
    b.rule("a.md", RULE());
    b.rule("c.md", RULE());
    b.lock({ "rules/a.md": hashText(RULE()) }); // c.md predates the record
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).missing, [],
      "present on disk is present, and an unrecorded name is not an absence");

    rmSync(join(b.mission, "rules", "c.md"));
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).missing, ["c.md"],
      "and a shipped rule that is neither on disk nor in the record IS an absence");
  } finally { b.drop(); }
});

test("an installed package that is not where it was expected degrades, it does not throw", () => {
  // The authority lives under node_modules, outside the audited repository — and a truncated
  // install must cost a weaker check, not a stack trace where a verdict was due.
  const b = bench();
  try {
    b.rule("a.md", RULE());
    b.lock({ "rules/a.md": hashText(RULE()) });
    const v = corpusDivergence(b.mission, join(b.root, "no-such-package", "rules"));
    assert.equal(v.status, "verifiable");
    assert.deepEqual([v.missing, v.edited, v.extra], [[], [], []],
      "a package that is not there is not a corpus the operator moved");
  } finally { b.drop(); }
});

// ── What was changed, and by whom ───────────────────────────────────────────────────────────────

test("what runward wrote is not an edit, even when the package has moved on since", () => {
  // The field report the lock exists for: a mission legitimately behind a release was told it had
  // edited files it never opened. Matching the RECORD is the answer, and it must survive the
  // package having changed underneath.
  const b = bench();
  try {
    const written = RULE("HIGH", "[floor]", "as runward wrote it");
    const release = RULE("HIGH", "[floor]", "as the package ships it today");
    b.rule("a.md", written);
    b.shipped("a.md", release);
    b.lock({ "rules/a.md": hashText(written) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, [],
      "behind a release is not an edit");

    b.rule("a.md", RULE("HIGH", "[floor]", "ok"));
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, ["a.md"],
      "and the substituted rule of ADR-0045 must still be named");
  } finally { b.drop(); }
});

test("a copy that matches the installed package is not an edit, even when the record is stale", () => {
  // The inverse of the case above, and the reason the lock is not the authority: a mission that has
  // taken the current package is up to date, whatever a lock written two releases ago remembers.
  const b = bench();
  try {
    const old = RULE("HIGH", "[floor]", "the text the lock remembers");
    const current = RULE("HIGH", "[floor]", "the text the package ships");
    b.rule("a.md", current);
    b.shipped("a.md", current);
    b.lock({ "rules/a.md": hashText(old) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, [],
      "updated to the package is what `update` exists to produce, not an operator edit");

    b.shipped("a.md", RULE("HIGH", "[floor]", "a third text"));
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, ["a.md"],
      "matching neither the record nor the package is exactly what an edit means");
  } finally { b.drop(); }
});

// ── What runward never wrote ────────────────────────────────────────────────────────────────────

test("an extension the gate cannot read is reported, never assumed harmless", () => {
  // The `catch` answers `true` on purpose: a file whose front matter cannot be read may be the one
  // standing in for a shipped rule, and the corpus check does not get to assume otherwise.
  const b = bench();
  try {
    b.rule("a.md", RULE());
    b.lock({ "rules/a.md": hashText(RULE()) });
    mkdirSync(join(b.mission, "rules", "unreadable.md")); // a directory: readFileSync throws EISDIR
    assert.deepEqual(corpusDivergence(b.mission, "").extra, ["unreadable.md"],
      "unreadable is not the same as innocuous");

    rmSync(join(b.mission, "rules", "unreadable.md"), { recursive: true });
    b.rule("house.md", RULE("MEDIUM", "[floor]"));
    assert.deepEqual(corpusDivergence(b.mission, "").extra, [],
      "while a readable house rule that cannot satisfy a floor stays welcome");
  } finally { b.drop(); }
});

test("an extension with no front matter is judged, not crashed over", () => {
  // Free-form notes live in `runward/rules/` in the field. The front-matter reads are optional
  // chains for that reason: made mandatory, a team's README turns the whole gate into a TypeError.
  const b = bench();
  try {
    b.rule("a.md", RULE());
    b.lock({ "rules/a.md": hashText(RULE()) });
    b.rule("free-form.md", "# a note the team keeps here\n\nno front matter at all\n");
    b.rule("impact-only.md", "---\nimpact: CRITICAL\n---\n\nno phases line\n");
    assert.deepEqual(corpusDivergence(b.mission, "").extra, [],
      "neither can stand in for a shipped rule, so neither is reported");

    b.rule("impact-only.md", RULE("CRITICAL", "[floor]"));
    assert.deepEqual(corpusDivergence(b.mission, "").extra, ["impact-only.md"],
      "and an extension that WOULD satisfy a gated floor is still named");
  } finally { b.drop(); }
});

// ── The two inputs `update` decides on ──────────────────────────────────────────────────────────

test("classify: either signal alone means there is nothing on disk to compare", () => {
  // Both callers in `update` derive `destText` from `destExists`, so today the two always agree.
  // This guard is about the caller that does not: read the destination, get null back from a failed
  // read, and a mission is told it EDITED a file it does not have — or worse, `hashText(null)`
  // throws in the middle of a refresh.
  assert.equal(classify(true, null, "template\n", undefined), "added",
    "no text to compare is nothing to compare, whatever the existence check said");
  assert.equal(classify(false, "stale\n", "template\n", hashText("stale\n")), "added",
    "and a destination that is not there is added, whatever text was handed in");
  assert.equal(classify(true, "stale\n", "template\n", hashText("stale\n")), "upstream",
    "while both signals saying the file IS there is what lets the comparison happen at all");
});

test("a lock whose `files` is not a map of files is not a lock", () => {
  // `readScaffoldLock` is typed `ScaffoldLock | null` and every caller reads `.files` as a record.
  // Handing back `files: null` or `files: "…"` moves the failure to whoever trusts that type, which
  // is the opposite of "a malformed lock is treated as absent, never as a guess".
  const dir = mkdtempSync(join(tmpdir(), "rw-lock-shape-"));
  const write = (o) => writeFileSync(join(dir, "scaffold-lock.json"), JSON.stringify(o));
  try {
    write({ version: 1, writtenBy: "0.33.2", files: null });
    assert.equal(readScaffoldLock(dir), null, "null is not a record of files");
    write({ version: 1, writtenBy: "0.33.2", files: "rules/a.md" });
    assert.equal(readScaffoldLock(dir), null, "a string is not a record of files");

    write({ version: 1, writtenBy: "0.33.2", files: { "rules/a.md": "h" } });
    const ok = readScaffoldLock(dir);
    assert.deepEqual(ok.files, { "rules/a.md": "h" }, "and a well-formed one round-trips");
    assert.equal(ok.writtenBy, "0.33.2", "the version that wrote the lock is read back, not blanked");
    write({ version: 1, files: { "rules/a.md": "h" } });
    assert.equal(readScaffoldLock(dir).writtenBy, "",
      "and an absent one reads as empty, never as the string 'undefined'");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
