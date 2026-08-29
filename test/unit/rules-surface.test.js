// The rule set as a machine surface: what `rules --json` publishes, byte for byte.
//
// `rules` is the one parser for the whole frontmatter shape (ADR-0024), read by `rules --json`, by
// `explain`, and — the part that makes it a gate concern — by `verdict.ts`, which builds the gated
// set from `impact === "CRITICAL" || impact === "HIGH"`. Instructing it on 2026-08-29 found 26 holes
// in that surface, and the ones worth naming are not crashes. They are SILENT DISAPPEARANCES and
// one silent flip:
//
//   · `tags` empties on all 64 rules and nothing reddens — a field a third party reads, gone;
//   · `territories.categories` empties, and the same emptied set then makes every operator row in
//     a `territory.md` be reported INERT ("no rule governs …"), so a wrong answer becomes an
//     accusation aimed at the operator;
//   · a vendored `corpus.json` — which ADR-0057 puts INSIDE `runward/rules/` — becomes a 65th rule
//     with an empty impact, because the `.md` filter is what keeps it out;
//   · `impact: CRITICAL ` with one trailing space stops being CRITICAL, which drops the rule out of
//     the gated set the verdict is built from. A whitespace character deciding whether a rule gates.
//
// A byte golden is the instrument for the first three: it needs no expected value written by hand,
// so it cannot be wrong about what the parser publishes, and it reds on any field that moves. The
// invariants after it state the decisions — the ones where being wrong changes a verdict or an
// exit code rather than a rendering.
//
// Regenerate deliberately, after reading the diff:
//   UPDATE_GOLDEN=1 node --test test/unit/rules-surface.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN = join(ROOT, "test", "fixtures", "golden", "rules-surface.json");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-01-01" };

const run = (args, cwd = ROOT) =>
  execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] });

/** The published version moves every release and says nothing about the parser. */
const stable = (json) => JSON.stringify({ ...JSON.parse(json), runward: "<version>" }, null, 1);

test("the published rule surface is byte-identical to the golden", () => {
  const got = [
    stable(run(["rules", "--json"])),
    stable(run(["rules", "--json", "--for", "src/lib/rules.ts"])),
    stable(run(["rules", "--json", "--for", "runward/floor.md"])),
  ].join("\n");
  if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(GOLDEN, got); return; }
  const want = readFileSync(GOLDEN, "utf8");
  if (got !== want) {
    const g = got.split("\n"), w = want.split("\n");
    const first = g.findIndex((l, i) => l !== w[i]);
    assert.fail("the rule surface changed.\n" +
      `  first difference at line ${first + 1}\n    golden: ${w[first]}\n    now:    ${g[first]}\n` +
      `  ${g.filter((l, i) => l !== w[i]).length} line(s) differ.\n` +
      "  Regenerate with UPDATE_GOLDEN=1 node --test test/unit/rules-surface.test.js after reading the diff.");
  }
});

test("every shipped rule publishes the fields a consumer reads", () => {
  const set = JSON.parse(run(["rules", "--json"]));
  assert.ok(set.count > 0 && set.rules.length === set.count, "count and rules disagree");
  const withTags = set.rules.filter((r) => Array.isArray(r.tags) && r.tags.length > 0);
  assert.ok(withTags.length > 0,
    "not one rule publishes a tag — the field can empty across the whole corpus without any other " +
    "layer noticing, and a consumer reading it sees a corpus that declares nothing");
  assert.ok(set.rules.every((r) => typeof r.slug === "string" && r.slug.length > 0), "a rule with no slug");
  assert.ok(set.rules.every((r) => typeof r.impact === "string" && r.impact.length > 0),
    "a rule with an empty impact is a rule the gated set cannot classify");
  // The vocabulary is published on the SELECTOR surface — `--for` — because that is where a row
  // is judged inert against it.
  const scoped = JSON.parse(run(["rules", "--json", "--for", "src/lib/rules.ts"]));
  const cats = scoped.territories?.categories ?? [];
  assert.ok(cats.length > 0,
    "the territory vocabulary is empty — every operator row in a territory.md is then reported " +
    "inert (\"no rule governs …\"), which turns a wrong answer into an accusation aimed at the operator");
  assert.deepEqual([...cats].sort(), cats,
    "the vocabulary is published out of order; the source calls that order part of a byte-stable contract");
});

test("an ASI identifier is published only if it is one", () => {
  const set = JSON.parse(run(["rules", "--json"]));
  const ids = [...new Set(set.rules.flatMap((r) => r.asi ?? []))];
  assert.ok(ids.length > 0, "no ASI control is published at all");
  for (const id of ids) assert.match(id, /^ASI\d{2}$/, `${id} is published as an OWASP ASI control`);
});

// ── the decisions, on a mission whose rules directory we control ──────────────────────────────────

function mission(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "rw-rules-"));
  run(["--yes", "init", "--path", dir, "--tools", "claude"], dir);
  if (mutate) mutate(join(dir, "runward", "rules"), dir);
  return dir;
}
const dirs = [];
const build = (m) => { const d = mission(m); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

test("only a .md file in the rules directory is a rule", () => {
  const dir = build((rules) => {
    // ADR-0057 vendors an org corpus INTO this directory. It is not a rule, and the extension is
    // the only thing that says so.
    writeFileSync(join(rules, "corpus.json"), JSON.stringify({ name: "acme", version: "1.0.0" }));
    writeFileSync(join(rules, "NOTES.txt"), "not a rule\n");
  });
  const set = JSON.parse(run(["rules", "--json"], dir));
  const phantom = set.rules.filter((r) => !r.slug.endsWith("-rule") && /corpus|NOTES/.test(r.slug));
  assert.deepEqual(phantom, [],
    "a non-markdown file in runward/rules/ was published as a rule — it arrives with an empty " +
    "impact, which is a rule the gated set cannot classify and a row nobody wrote");
  assert.ok(set.rules.every((r) => !/\.(json|txt)$/.test(r.slug)), "a file extension leaked into a slug");
});

test("a trailing space does not decide whether a rule gates", () => {
  const dir = build((rules) => {
    writeFileSync(join(rules, "zz-spaced-impact.md"),
      "---\ntitle: Spaced impact\nimpact: CRITICAL \nphases: [frame]\n---\n\nA rule whose impact carries a trailing space.\n");
  });
  const set = JSON.parse(run(["rules", "--json"], dir));
  const r = set.rules.find((x) => x.slug === "zz-spaced-impact");
  assert.ok(r, "the crafted rule was not read at all");
  assert.equal(r.impact, "CRITICAL",
    "the impact kept its trailing space, so `impact === \"CRITICAL\"` is false and verdict.ts drops " +
    "the rule from the gated set — a whitespace character deciding whether a rule gates");
});

test("a project-relative path with a colon in it is answerable, not refused", () => {
  // `src/a:b.ts` is a legal path. An unanchored drive-letter test reads the `a:` as a Windows drive
  // and the CLI exits 2 with "paths must be project-relative" — an undue refusal on correct input.
  const out = run(["rules", "--json", "--for", "src/a:b.ts"]);
  const answer = JSON.parse(out);
  assert.deepEqual(answer.selector?.for, ["src/a:b.ts"],
    "the path was rewritten or rejected; runward answered about something the caller did not ask");
});

test("a path is normalised the same way however many slashes it ends with", () => {
  for (const [given, expected] of [["src/lib/", "src/lib"], ["src/lib//", "src/lib"],
    ["src/lib///", "src/lib"], ["./src/lib", "src/lib"]]) {
    const answer = JSON.parse(run(["rules", "--json", "--for", given]));
    assert.deepEqual(answer.selector?.for, [expected],
      `${JSON.stringify(given)} normalised to ${JSON.stringify(answer.selector?.for)} — a leftover ` +
      "separator reaches the glob match, so the rules that answer for a directory depend on how " +
      "the caller happened to type it");
  }
});

test("a near-miss ASI identifier is dropped, not published as a control", () => {
  // The shipped corpus declares only well-formed ids, so asserting over IT proves nothing: the
  // validator can lose either anchor and the published set does not move. The near-misses have to
  // be written down for the assertion to have anything to refuse.
  const dir = build((rules) => {
    writeFileSync(join(rules, "zz-asi-near-miss.md"),
      "---\ntitle: Near-miss ASI ids\nimpact: HIGH\nphases: [frame]\nasi: [XASI04, ASI04X, ASI044, ASI04]\n---\n\nA rule declaring three malformed ids and one real one.\n");
  });
  const set = JSON.parse(run(["rules", "--json"], dir));
  const r = set.rules.find((x) => x.slug === "zz-asi-near-miss");
  assert.ok(r, "the crafted rule was not read at all");
  assert.deepEqual(r.asi, ["ASI04"],
    "a malformed id reached the machine surface as an OWASP control — an unanchored validator " +
    "accepts `XASI04` as a suffix and `ASI044` as a prefix, and both then travel into the " +
    "compliance draft's distinct-control count as if a real control were covered");
});

test("a file that is not markdown never becomes a rule, whatever its name", () => {
  const dir = build((rules) => {
    writeFileSync(join(rules, "openapi.mdx"), "---\ntitle: Not a rule\nimpact: HIGH\n---\n\nbody\n");
    // This one IS markdown, and its name carries `.md` twice. The slug is the key `explain` and
    // every machine consumer address the rule by, so stripping the first `.md` instead of the
    // EXTENSION renames the rule to something nobody can look up.
    writeFileSync(join(rules, "openapi.mdx.md"), "---\ntitle: A real rule\nimpact: HIGH\nphases: [frame]\n---\n\nbody\n");
  });
  const set = JSON.parse(run(["rules", "--json"], dir));
  assert.equal(set.rules.some((x) => x.slug === "openapi.mdx"), true,
    "the .md rule was dropped or renamed");
  assert.equal(set.rules.some((x) => x.slug === "openapix.md"), false,
    "the slug was built by stripping the FIRST `.md` rather than the extension — the rule is now " +
    "addressed by a name nobody wrote, and `explain` on the real one finds nothing");
  assert.equal(set.rules.some((x) => x.slug === "openapi.mdx" && x.title === "A real rule"), true,
    "a `.mdx` file was read as a rule, or the real one lost its identity — the extension filter is " +
    "what keeps a vendored corpus, a note and a neighbouring format out of the gated set");
});
