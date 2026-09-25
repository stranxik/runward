// RWD-2026-0117: the lock may bless only a text runward actually published.
//
// `corpusDivergence` accepts a mission's copy of a rule when its hash equals the lock's record, so a
// mission behind a release is not accused of editing. The lock lives in the audited repository, so on
// 0.42.1 a shipped rule downgraded from CRITICAL to LOW, with its lock line re-signed in the same
// commit, passed `check --strict` with one CRITICAL rule fewer and no line said so. The package now
// carries every hash it ever published (templates/rule-history.json), and a lock line naming a text
// that is not among them is a forgery. Pinned in both directions: the forgery is refused, and the
// honest mission one release behind is not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusDivergence, hashText, readPublishedRuleHashes } from "../../dist/lib/scaffold-lock.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RULE = (impact, body = "body") => `---\nimpact: ${impact}\nphases: [floor]\n---\n\n${body}\n`;

function bench(history) {
  const root = mkdtempSync(join(tmpdir(), "rw-lock-history-"));
  const mission = join(root, "runward");
  const pkg = join(root, "pkg", "rules");
  mkdirSync(join(mission, "rules"), { recursive: true });
  mkdirSync(pkg, { recursive: true });
  if (history !== undefined) writeFileSync(join(root, "pkg", "rule-history.json"), JSON.stringify(history));
  return {
    mission, pkg,
    rule: (name, text) => writeFileSync(join(mission, "rules", name), text),
    shipped: (name, text) => writeFileSync(join(pkg, name), text),
    lock: (files) => writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify({ version: 1, writtenBy: "0.41.0", files })),
    drop: () => rmSync(root, { recursive: true, force: true }),
  };
}

const V1 = RULE("CRITICAL", "first published wording");
const V2 = RULE("CRITICAL", "second published wording");
const FORGED = RULE("LOW", "first published wording");

test("RWD-2026-0117: a shipped rule downgraded and its lock re-signed is refused as edited", () => {
  const b = bench({ version: 1, rules: { "r.md": [hashText(V1), hashText(V2)].sort() } });
  try {
    b.shipped("r.md", V2);
    b.rule("r.md", FORGED);
    b.lock({ "rules/r.md": hashText(FORGED) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, ["r.md"]);
  } finally { b.drop(); }
});

test("RWD-2026-0117, the other direction: a mission one release behind is not accused", () => {
  const b = bench({ version: 1, rules: { "r.md": [hashText(V1), hashText(V2)].sort() } });
  try {
    b.shipped("r.md", V2);
    b.rule("r.md", V1);
    b.lock({ "rules/r.md": hashText(V1) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, [], "an older published text is still what runward wrote");
    b.rule("r.md", V2);
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, [], "updated to the current package");
  } finally { b.drop(); }
});

test("RWD-2026-0117: a rule runward never shipped keeps the lock's word (ADR-0057's declared limit)", () => {
  const b = bench({ version: 1, rules: { "r.md": [hashText(V1)] } });
  try {
    b.shipped("r.md", V1);
    b.rule("r.md", V1);
    const house = RULE("HIGH", "an org rule");
    b.rule("org-rule.md", house);
    b.lock({ "rules/r.md": hashText(V1), "rules/org-rule.md": hashText(house) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, []);
  } finally { b.drop(); }
});

test("RWD-2026-0117: a package without a history keeps the previous behaviour, never accuses", () => {
  const b = bench(undefined);
  try {
    b.shipped("r.md", V2);
    b.rule("r.md", V1);
    b.lock({ "rules/r.md": hashText(V1) });
    assert.deepEqual(corpusDivergence(b.mission, b.pkg).edited, []);
    assert.equal(readPublishedRuleHashes(b.pkg), null);
  } finally { b.drop(); }
});

test("the shipped history covers every shipped rule at its current text — regenerate it when a rule changes", () => {
  const history = readPublishedRuleHashes(join(ROOT, "templates", "rules"));
  assert.ok(history, "templates/rule-history.json ships with the package (templates/ is in package.json files)");
  const missing = [];
  for (const f of readdirSync(join(ROOT, "templates", "rules")).filter((x) => x.endsWith(".md"))) {
    const h = hashText(readFileSync(join(ROOT, "templates", "rules", f), "utf8"));
    if (!history[f]?.includes(h)) missing.push(f);
  }
  assert.deepEqual(missing, [], "run: node scripts/rule-history.mjs, then commit templates/rule-history.json");
});
