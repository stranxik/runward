// The register of decisions nobody has taken yet, guarded like the one of defects nobody has fixed.
//
// It exists because a question raised in a conversation dies with that conversation. Giving it a
// file only helps if the file keeps its own discipline: ids that do not collide, entries that say
// what would settle them, and closures that name the ADR that closed them. A register that can rot
// quietly is a place to put things down, not a place that holds anyone to anything.
//
// The load-bearing field is "What would settle it". An entry that cannot name the evidence that
// would decide it is not waiting on judgement — it is a question nobody has thought about yet, and
// it will sit there forever looking like work in progress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADR_DIR = join(ROOT, "docs", "adr");
const REGISTER = join(ADR_DIR, "open-questions.md");
const text = readFileSync(REGISTER, "utf8");

/** `### OD-0001 — the question` */
const openEntries = [...text.matchAll(/^### (OD-\d{4}) — (.+)$/gm)].map((m) => ({ id: m[1], title: m[2] }));
const sections = text.split(/^### /m).slice(1);

test("the register carries at least the shape it promises", () => {
  assert.ok(openEntries.length > 0 || /_None yet/.test(text),
    "no open entry and no statement that there is none — a reader cannot tell an empty register " +
    "from a broken one");
  assert.match(text, /^## Open$/m);
  assert.match(text, /^## Closed$/m);
});

test("ids are unique and contiguous from 0001", () => {
  const closed = [...text.matchAll(/^\| (OD-\d{4}) \|/gm)].map((m) => m[1]);
  const all = [...openEntries.map((e) => e.id), ...closed];
  assert.equal(new Set(all).size, all.length, `an id is defined twice: ${all.join(", ")}`);
  const numbers = all.map((id) => Number(id.slice(3))).sort((a, b) => a - b);
  numbers.forEach((n, i) => assert.equal(n, i + 1,
    `the ids skip a number at ${n} — a gap reads as a deleted entry, and an entry that was decided ` +
    "belongs in the closed table, not in a hole"));
});

test("every open entry says what would settle it", () => {
  for (const s of sections) {
    const id = /^(OD-\d{4})/.exec(s)?.[1];
    if (!id) continue;
    assert.match(s, /\*\*What would settle it\.?\*\*/,
      `${id}: no "What would settle it" — an entry that cannot name the evidence that would decide ` +
      "it is not a decision awaiting judgement, and it will sit here looking like work in progress");
    assert.match(s, /\*\*Raised\*\*\s+\d{4}-\d{2}-\d{2}/,
      `${id}: no raised date — a question with no age cannot be triaged`);
    assert.match(s, /\*\*The options\.?\*\*/,
      `${id}: no options — a decision with one path is not a decision, it is a task`);
    assert.match(s, /\*\*Currently in the tree\.?\*\*/,
      `${id}: does not say what the code does TODAY, so a reader cannot tell whether the question ` +
      "is about changing something or about choosing something that was never built");
  }
});

test("a closed entry names an ADR that exists", () => {
  for (const row of text.split("\n").filter((l) => /^\| OD-\d{4} \|/.test(l))) {
    const cells = row.split("|").map((c) => c.trim());
    const adr = /ADR-\d{4}/.exec(cells[3] ?? "")?.[0];
    assert.ok(adr, `${cells[1]}: closed without naming an ADR — a decision that closed by going ` +
      "quiet is exactly what this register exists to prevent");
    const file = require("node:fs").readdirSync(ADR_DIR).find((f) => f.startsWith(adr));
    assert.ok(file, `${cells[1]}: names ${adr}, which is not in docs/adr/`);
  }
});

test("the ADR journal points at the register, so neither can be found without the other", () => {
  const readme = readFileSync(join(ADR_DIR, "README.md"), "utf8");
  assert.match(readme, /open-questions\.md/,
    "the journal does not link the open register — a reader arriving at the decisions finds only " +
    "the ones already taken, which is the state this register was created to end");
  assert.ok(existsSync(REGISTER));
});
