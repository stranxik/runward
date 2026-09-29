// The register that records this product's defects had two of its own, and nothing checked it.
// Found by the 2026-08-26 audit: RWD-2026-0022 and RWD-2026-0023 were each DEFINED TWICE — once on
// 2026-08-08 for a declared limitation, once on 2026-08-17 for a wrong verdict — because two
// numbering series had been continued from the same point. Both meanings were cited elsewhere by
// number (TOR-028 and regulated-adoption §5.4 mean the seal date; ADR-0056 meant the JUnit adapter),
// so the collision made a citation ambiguous rather than merely untidy. Its header also still read
// `Describes: runward 0.34.0` while carrying entries for 0.36.0, 0.36.1 and 0.36.2.
//
// The TOR register has carried a uniqueness-and-contiguity guard from the start
// (`tor-traceability.test.js`). This file is the same guard for the defect register — the same
// lesson, asked of the neighbour that never received it, which is the shape of RWD-2026-0048 and
// RWD-2026-0054 both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PATH = join(ROOT, "docs/compliance/known-defects.md");
const TEXT = readFileSync(PATH, "utf8");
const ROWS = [...TEXT.matchAll(/^\| (RWD-\d{4}-\d{4}) \|/gm)].map((m) => m[1]);

test("every identifier is defined exactly once", () => {
  const seen = new Map();
  for (const id of ROWS) seen.set(id, (seen.get(id) ?? 0) + 1);
  const dup = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n}×)`);
  assert.deepEqual(dup, [], "an identifier defined twice makes every citation of it ambiguous");
});

test("numbering is contiguous from 0001, so a dropped entry leaves a visible hole", () => {
  const nums = [...new Set(ROWS)].map((i) => Number(i.slice(-4))).sort((a, b) => a - b);
  assert.equal(nums[0], 1, "numbering starts at RWD-2026-0001");
  const gaps = [];
  for (let n = 1; n <= nums[nums.length - 1]; n++) if (!nums.includes(n)) gaps.push(n);
  assert.deepEqual(gaps, [], `missing: ${gaps.map((n) => `RWD-2026-${String(n).padStart(4, "0")}`).join(", ")}`);
});

test("every RWD identifier cited anywhere in the repository is defined in the register", () => {
  // The direction that produces the silent failure: a document citing a number nobody assigned.
  const defined = new Set(ROWS);
  const cited = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      const f = join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".md") && f !== PATH)
        for (const m of readFileSync(f, "utf8").matchAll(/RWD-\d{4}-\d{4}/g)) cited.add(m[0]);
    }
  };
  walk(join(ROOT, "docs"));
  const dangling = [...cited].filter((id) => !defined.has(id)).sort();
  assert.deepEqual(dangling, [], "these identifiers are cited but defined nowhere");
});

test("the header names the version this register actually describes", () => {
  // It read `Describes: runward 0.34.0` while carrying entries for 0.36.0, 0.36.1 and 0.36.2 —
  // twelve days and three releases stale, on the document a regulated reader opens first.
  const m = TEXT.match(/\*\*Describes\*\*: runward (\S+)/);
  assert.ok(m, "the header must name a version");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  assert.equal(m[1], pkg, `header says ${m[1]}, package says ${pkg} — re-read the register and update the stamp`);
});

test("every entry says WHAT FOUND IT, from a closed vocabulary", () => {
  // The register recorded what the defect was and what now guards it, and never what found it.
  // Measured 2026-08-27: 58 of 82 entries said nothing about discovery in their own prose, and the
  // information that existed lived in SECTION HEADINGS — which flattened the moment a day's worth
  // of appends landed under one of them (41 of 82 sat under a single heading). A per-entry field is
  // what makes the question answerable by a machine instead of by memory.
  //
  // It matters beyond tidiness. Derived across the whole register, the discovery mix is dominated
  // by adversarial audits (the current figures are recounted by the test below, never typed here).
  // A story told from one day's catches — CI legs and golden fixtures — is true and
  // UNREPRESENTATIVE, and this field is what makes that checkable rather than arguable.
  const VOCAB = new Set(["adversarial-audit", "mutation-instruction", "ci-os-leg", "conformance-corpus",
                         "existing-guard", "while-reproducing", "self-gate", "operator-report",
                         "declared", "measurement", "not-recorded"]);
  const rows = [...TEXT.matchAll(/^\| (RWD-\d{4}-\d{4}) \|([^\n]*)$/gm)];
  assert.ok(rows.length >= 82, `found ${rows.length} rows`);
  const missing = [], unknown = [];
  for (const [, id, body] of rows) {
    const m = body.match(/`found-by` = `([a-z-]+)`/);
    if (!m) { missing.push(id); continue; }
    if (!VOCAB.has(m[1])) unknown.push(`${id}: ${m[1]}`);
  }
  assert.deepEqual(missing, [], "these entries do not say what found them");
  assert.deepEqual(unknown, [], "these entries use a value outside the closed vocabulary");

  // `not-recorded` is honest and must stay RARE — it is the value that means "nobody wrote it down".
  // A register where it grows is one that has stopped recording discovery, which is the defect this
  // test was added for. Both directions: the vocabulary must also actually be USED beyond it.
  const used = new Set(rows.map(([, , b]) => b.match(/`found-by` = `([a-z-]+)`/)?.[1]).filter(Boolean));
  assert.ok(used.size >= 4, `the field must carry real distinctions, saw ${[...used].join(", ")}`);
  const nr = rows.filter(([, , b]) => /`found-by` = `not-recorded`/.test(b)).length;
  assert.ok(nr <= 5, `${nr} entries record no discovery — recover them or say why in the header`);
});

// The published discovery mix, recounted from the rows. Found 2026-09-29: the register header gave a
// mix summing to 97 and what-found-them.md "all 87 entries" over a table summing to 133, while the
// register held 162 rows. Both were typed by hand once and never recounted, so every append made
// them staler. The figures a reader quotes are now derived from the rows and compared, not trusted.
const PAGE_PATH = join(ROOT, "docs/compliance/what-found-them.md");

function foundByCounts(register) {
  const counts = new Map();
  for (const [, body] of register.matchAll(/^\| RWD-\d{4}-\d{4} \|([^\n]*)$/gm)) {
    const v = body.match(/`found-by` = `([a-z-]+)`/)?.[1];
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

// Every mismatch between the rows and the figures the two documents publish, as sentences.
function mixMismatches(register, page) {
  const counts = foundByCounts(register);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const get = (k) => counts.get(k) ?? 0;
  const out = [];
  const same = (where, published) => {
    for (const [k, n] of counts) if (published.get(k) !== n) out.push(`${where}: \`${k}\` reads ${published.get(k) ?? "nothing"}, the rows hold ${n}`);
    for (const k of published.keys()) if (!counts.has(k)) out.push(`${where}: \`${k}\` is published and no row carries it`);
  };

  // The register header: "Read across the whole register, N entries, the mix is **n `key`, …**".
  const head = register.match(/Read across the whole register, (\d+) entries, the mix is \*\*([^*]+)\*\*/);
  if (!head) out.push("known-defects.md: the header mix sentence is missing");
  else {
    if (Number(head[1]) !== total) out.push(`known-defects.md: header says ${head[1]} entries, the rows hold ${total}`);
    same("known-defects.md header", new Map([...head[2].matchAll(/(\d+) `([a-z-]+)`/g)].map((m) => [m[2], Number(m[1])])));
  }

  // what-found-them.md: the table, the total, and the figures its prose interprets.
  same("what-found-them.md table", new Map([...page.matchAll(/^\|[^|\n]*\| `([a-z-]+)` \| (\d+) \|$/gm)].map((m) => [m[1], Number(m[2])])));
  const checks = [
    [/Across all (\d+) entries/, total, "the total"],
    [/the (\d+) audit entries/, get("adversarial-audit"), "the audit count"],
    [/(\d+) of \d+ came from two instruments/, get("adversarial-audit") + get("mutation-instruction"), "the two-instrument count"],
    [/\d+ of (\d+) came from two instruments/, total, "the two-instrument denominator"],
    [/(\d+) measurements someone decided/, get("measurement"), "the measurement count"],
    [/(\d+) defects surfaced while reproducing/, get("while-reproducing"), "the while-reproducing count"],
    [/(\d+)\s+limitations declared/, get("declared"), "the declared count"],
    [/the (\w+) `existing-guard` entries/, get("existing-guard"), "the existing-guard count"],
  ];
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  for (const [re, want, what] of checks) {
    const m = page.match(re);
    if (!m) { out.push(`what-found-them.md: ${what} is missing (${re})`); continue; }
    const got = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS.indexOf(m[1]);
    if (got !== want) out.push(`what-found-them.md: ${what} reads ${m[1]}, the rows give ${want}`);
  }
  return out;
}

test("the discovery mix both documents publish is the one the rows carry", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  assert.deepEqual(mixMismatches(TEXT, page), [], "recount the rows (the grep in what-found-them.md) and update the figures");
});

test("positive control: a wrong figure, a missing value or an extra row each redden the mix check", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const n = foundByCounts(TEXT).get("adversarial-audit");
  // A stale total on the page.
  assert.ok(mixMismatches(TEXT, page.replace(/Across all \d+ entries/, "Across all 87 entries")).length > 0);
  // A stale figure in the table.
  assert.ok(mixMismatches(TEXT, page.replace(`| \`adversarial-audit\` | ${n} |`, `| \`adversarial-audit\` | ${n - 1} |`)).length > 0);
  // A stale figure in the register header.
  assert.ok(mixMismatches(TEXT.replace(`**${n} \`adversarial-audit\``, `**${n + 1} \`adversarial-audit\``), page).length > 0);
  // A row appended without recounting: every published figure is now one short.
  const appended = TEXT + "\n| RWD-2026-9999 | planted. `found-by` = `measurement`. | x | x |\n";
  const after = mixMismatches(appended, page);
  assert.ok(after.some((s) => /measurement/.test(s)) && after.some((s) => /entries/.test(s)), after.join("\n"));
});
