#!/usr/bin/env node
// Writes templates/rule-history.json: every SHA-256 runward has ever PUBLISHED for each shipped rule.
//
// Why it exists (RWD-2026-0117). `corpusDivergence` accepts a mission's rule copy when its hash equals
// what `scaffold-lock.json` recorded, so a mission legitimately behind a release is not accused of
// editing its rules. But the lock lives in the audited repository: downgrade a shipped rule (CRITICAL
// to LOW) and re-sign its line in the same commit, and the gate passed with one CRITICAL rule fewer.
// The authority ADR-0045 and ADR-0057 name is the INSTALLED PACKAGE; this file is how the package
// carries, outside the repository, the one thing the lock was trusted for: which texts runward wrote.
//
// Source of truth: the rule files at every release tag (`v*`), plus the working tree, so a rule
// changed in the current change set is in the history of the release that will ship it. The hash is
// the lock's own (`hashText`: CRLF normalised to LF, SHA-256 of the UTF-8 text). Deterministic:
// names and hashes sorted by code unit.
//
//   node scripts/rule-history.mjs           # write templates/rule-history.json
//   node scripts/rule-history.mjs --check   # exit 1 if the committed file is not what this writes

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = "templates/rule-history.json";
const RULES = "templates/rules";
const hashText = (t) => createHash("sha256").update(t.replace(/\r\n/g, "\n"), "utf8").digest("hex");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const history = new Map();
const add = (file, text) => {
  if (!history.has(file)) history.set(file, new Set());
  history.get(file).add(hashText(text));
};

const tags = git("tag", "--list", "v*").split("\n").filter(Boolean);
if (tags.length === 0) {
  console.error("no v* tag found: a shallow or tagless clone cannot rebuild the history (fetch tags first).");
  process.exit(2);
}
for (const tag of tags) {
  let listing = "";
  try { listing = git("ls-tree", "--name-only", `${tag}:${RULES}`); } catch { continue; }
  for (const file of listing.split("\n").filter((f) => f.endsWith(".md"))) {
    add(file, git("show", `${tag}:${RULES}/${file}`));
  }
}
for (const file of readdirSync(RULES).filter((f) => f.endsWith(".md"))) {
  add(file, readFileSync(join(RULES, file), "utf8"));
}

const rules = {};
for (const file of [...history.keys()].sort(byCodeUnit)) rules[file] = [...history.get(file)].sort(byCodeUnit);
const text = JSON.stringify({ version: 1, rules }, null, 1) + "\n";

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error(`${OUT} is stale: run node scripts/rule-history.mjs and commit it.`);
    process.exit(1);
  }
  console.log(`${OUT} is current (${Object.keys(rules).length} rules).`);
} else {
  writeFileSync(OUT, text);
  const n = Object.values(rules).reduce((s, h) => s + h.length, 0);
  console.log(`wrote ${OUT}: ${Object.keys(rules).length} rules, ${n} published texts, from ${tags.length} tags.`);
}
