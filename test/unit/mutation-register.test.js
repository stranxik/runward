// The survivor register keeps its shape, so the ratchet stays opposable.
//
// ADR-0046 decision 2 makes the survivor list a ratchet — "the absolute-survivor list does not
// grow" — and decision 4 says each survivor is FILED as hole, defence-in-depth, equivalent or
// display-only, with equivalence ARGUED and never assumed. Both need the register to be an artifact
// with a checkable shape, or "filed" quietly degrades into "listed" and the ratchet compares
// nothing. Between 2026-08-05 and 2026-08-21 the ratchet had no artifact at all: it could not be
// falsified, which is the shape ADR-0045 refuses from an operator.
//
// This guard is deliberately cheap. It reads a committed document and never runs Stryker: decision
// 3 keeps the pass off the pull-request path, but the register it produces is guarded on every
// commit like any other document.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTER = join(ROOT, "docs", "compliance", "mutation-register.md");
const VERDICTS = join(ROOT, "docs", "compliance", "mutation-survivors");

/** The four filings of ADR-0046 decision 4, and nothing else. */
const FILINGS = ["hole", "defence-in-depth", "equivalent", "display-only"];

/**
 * An argument short enough to fit in a cell without saying anything is the failure this guards
 * against. Decision 4 exists because three survivors were declared harmless on an earlier bench of
 * four, and two of them were live defects.
 */
const MIN_ARGUMENT = 40;

const register = readFileSync(REGISTER, "utf8");

function parse(md) {
  const modules = [];
  let mod = null;
  let fn = null;
  for (const line of md.split("\n")) {
    const m = /^##\s+Module:\s+(\S+)\s*$/.exec(line);
    if (m) { mod = { name: m[1], declared: null, functions: [] }; modules.push(mod); fn = null; continue; }
    if (!mod) continue;
    const d = /^Survivors:\s*(\d+)\b/.exec(line);
    if (d) { mod.declared = Number(d[1]); continue; }
        // `(\S+)` assumed a function name is one token. Module top-level code is filed as
    // `(top level)`, so its heading did not match, its rows were appended to the previous
    // function, and the mismatch surfaced as that function declaring one row too few.
const f = /^###\s+(.+?)\s+—\s+(\d+)\s+survivor/.exec(line);
    if (f) { fn = { name: f[1], declared: Number(f[2]), rows: [] }; mod.functions.push(fn); continue; }
    if (!fn || !line.startsWith("|")) continue;
    // Split on UNESCAPED pipes only. Mutated regexes are full of alternations, so `\|` inside a
    // cell is routine; a naive split shreds those rows into extra columns and every count after it
    // is wrong. Found by this guard on its first run against a generated register.
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim().replace(/\\\|/g, "|"));
    if (cells.length === 0) continue;
    if (cells[0] === "Line" || /^-+:?$/.test(cells[0].replace(/\s/g, ""))) continue;
    fn.rows.push(cells);
  }
  return modules;
}

const modules = parse(register);
const rows = modules.flatMap((m) => m.functions.flatMap((f) => f.rows));

test("the register declares at least one module", () => {
  assert.ok(modules.length > 0, "no `## Module: <name>` section found");
});

test("each module's declared survivor count matches its rows", () => {
  for (const m of modules) {
    assert.notEqual(m.declared, null,
      `${m.name}: no \`Survivors: N\` line. A count stated separately from the table is what` +
      " catches rows silently dropped by an edit.");
    const actual = m.functions.reduce((n, f) => n + f.rows.length, 0);
    assert.equal(actual, m.declared, `${m.name}: declares ${m.declared} survivors, tables hold ${actual}`);
  }
});

test("each function's declared count matches its own table", () => {
  for (const m of modules) {
    for (const f of m.functions) {
      assert.equal(f.rows.length, f.declared,
        `${m.name}/${f.name}: heading says ${f.declared}, table holds ${f.rows.length}`);
    }
  }
});

test("every survivor is filed as one of the four categories", () => {
  for (const m of modules) {
    for (const f of m.functions) {
      for (const row of f.rows) {
        assert.equal(row.length, 5,
          `${f.name} line ${row[0]}: expected 5 columns, got ${row.length}`);
        assert.ok(FILINGS.includes(row[3]),
          `${f.name} line ${row[0]}: "${row[3]}" is not one of ${FILINGS.join(", ")}`);
      }
    }
  }
});

test("an equivalent mutant carries its argument, never a bare word", () => {
  for (const m of modules) {
    for (const f of m.functions) {
      for (const row of f.rows) {
        if (row[3] !== "equivalent") continue;
        assert.ok(row[4].length >= MIN_ARGUMENT,
          `${f.name} line ${row[0]}: equivalence must be argued (ADR-0046 decision 4), got ` +
          `${row[4].length} characters: "${row[4]}"`);
      }
    }
  }
});

test("the register matches the verdicts it is derived from", () => {
  // The register is generated by scripts/mutation-register.mjs. If the two drift, the readable
  // artifact and the evidence behind it disagree, and only one of them is being reviewed.
  const files = readdirSync(VERDICTS).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "no verdict files beside the register");
  const tally = { hole: 0, equivalent: 0, "display-only": 0, "defence-in-depth": 0 };
  const seen = new Set();
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(VERDICTS, f), "utf8"));
    for (const v of j.verdicts) {
      // Uniqueness is judged per MODULE, not globally: workflow-contract.ts copies the rules
      // corpus's head grammar by design ("same head-grammar discipline"), so its FRONTMATTER
      // regex sits at the same line and columns as rules.ts's — two distinct mutants, one
      // positional key. The stableKey's module prefix is the real identity (measured collision,
      // consolidated pass 2026-09-04).
      const mod = (v.stableKey ?? "").split(String.fromCharCode(1))[0] || f;
      assert.ok(!seen.has(`${mod}|${v.key}`), `${mod}|${v.key} appears in more than one verdict file`);
      seen.add(`${mod}|${v.key}`);
      assert.ok(FILINGS.includes(v.filing), `${f}: "${v.filing}" is not a filing`);
      assert.ok(v.evidence, `${f} ${v.key}: a verdict with no evidence is an opinion`);
      if (v.filing === "equivalent") {
        assert.ok((v.argument ?? "").length >= MIN_ARGUMENT,
          `${f} ${v.key}: equivalence must carry its argument`);
      }
      tally[v.filing]++;
    }
  }
  assert.equal(seen.size, rows.length,
    `${seen.size} verdicts on file, ${rows.length} rows in the register — regenerate it with ` +
    "`node scripts/mutation-register.mjs`");
  for (const filing of FILINGS) {
    const inRegister = rows.filter((r) => r[3] === filing).length;
    assert.equal(inRegister, tally[filing],
      `${filing}: ${tally[filing]} on file, ${inRegister} in the register`);
  }
});

// THE CELLS, AS GITHUB SHOWS THEM. Measured 2026-11-06 by rendering the 2,370 rows of this register with
// GitHub's own renderer (`POST /markdown`, mode `gfm`): every code cell read exactly and 41 notes did
// not, because GFM reads markup in prose: a backslash before punctuation vanished, a quoted `**Status**`
// turned bold, `<string>` was removed as an HTML tag. A first fix doubled every backslash and rendered
// 33 notes and 5 code cells wrong the other way. Each case below is an excerpt of a verdict from that
// measurement, run through the real generator, and each expected row was rendered by GitHub and read back
// exactly. The first six fail on the generator before the fix; the last two pin cells that were right.
const CELL_CASES = [
  {
    why: "a backslash before punctuation, in prose",
    line: 575, mutator: "StringLiteral", filing: "equivalent",
    key: "575|87|575|91|StringLiteral|\"\"",
    argument: "Empties the search value, so on POSIX the regex source becomes ^\\\\/ (backslash-slash) instead of ^/ and the leading separator survives the strip.",
    row: "| 575 | StringLiteral | `\"\"` | equivalent | Empties the search value, so on POSIX the regex source becomes ^\\\\\\\\/ (backslash-slash) instead of ^/ and the leading separator survives the strip. |",
  },
  {
    why: "bold markers quoted in prose, and a backslash before a letter left single",
    line: 524, mutator: "Regex", filing: "hole",
    key: "524|29|524|79|Regex|/^\\s*(?:\\*\\*status\\*\\*|status)\\s:\\s*rejected\\b/im",
    evidence: "\\s: requires exactly one whitespace between status and the colon: the corpus's CANONICAL form '**Status**: rejected' (zero whitespace before :) no longer",
    row: "| 524 | Regex | `/^\\s*(?:\\*\\*status\\*\\*\\|status)\\s:\\s*rejecte…` | hole | \\s: requires exactly one whitespace between status and the colon: the corpus's CANONICAL form '\\*\\*Status\\*\\*: rejected' (zero whitespace before :) no longer |",
  },
  {
    why: "an angle bracket GitHub would take for an HTML tag",
    line: 1075, mutator: "ConditionalExpression", filing: "equivalent",
    key: "1075|17|1075|20|ConditionalExpression|true",
    argument: "adjudicated is a Set<string> written only here (adjudicated.add(abs))",
    row: "| 1075 | ConditionalExpression | `true` | equivalent | adjudicated is a Set\\<string> written only here (adjudicated.add(abs)) |",
  },
  {
    why: "escaped asterisks of a regex in prose",
    line: 498, mutator: "BlockStatement", filing: "equivalent",
    key: "498|15|500|10|BlockStatement|{}",
    argument: "\"\" can match neither /^\\s*(?:\\*\\*status\\*\\*|status)\\s*:\\s*hypothesis\\b/im",
    row: "| 498 | BlockStatement | `{}` | equivalent | \"\" can match neither /^\\s\\*(?:\\\\\\*\\\\\\*status\\\\\\*\\\\\\*\\|status)\\s\\*:\\s\\*hypothesis\\b/im |",
  },
  {
    why: "an underscore next to punctuation",
    line: 452, mutator: "Regex", filing: "equivalent",
    key: "452|32|452|94|Regex|/\\((?:\\?[:=!]|\\?<[^>]>)?([^()]*)\\)([+*?]|\\{\\d+(?:,\\d*)?\\})?/g",
    argument: "A group name is [A-Za-z0-9_$]",
    row: "| 452 | Regex | `/\\((?:\\?[:=!]\\|\\?<[^>]>)?([^()]*)\\)([+*?]\\|\\{…` | equivalent | A group name is [A-Za-z0-9\\_$] |",
  },
  {
    why: "bold written in a note shows as written",
    line: 87, mutator: "Regex", filing: "hole",
    key: "87|24|87|51|Regex|/\\b(file|test|adr):(\\S.*)/",
    evidence: "`check --strict --json` went from **exit 0 to exit 1**",
    row: "| 87 | Regex | `/\\b(file\\|test\\|adr):(\\S.*)/` | hole | `check --strict --json` went from \\*\\*exit 0 to exit 1\\*\\* |",
  },
  {
    why: "backslashes inside a code span stay as they are",
    line: 269, mutator: "StringLiteral", filing: "hole",
    key: "269|65|269|68|StringLiteral|\"\"",
    evidence: "Changing `.split(\"\\\\\").join(\"/\")` to `.join(\"\")` changed the derived path",
    row: "| 269 | StringLiteral | `\"\"` | hole | Changing `.split(\"\\\\\").join(\"/\")` to `.join(\"\")` changed the derived path |",
  },
  {
    why: "a backslash before a pipe in the code column stays as it is",
    line: 574, mutator: "Regex", filing: "hole",
    key: "574|32|574|37|Regex|/\\|/",
    evidence: "COULD NOT CLEAR — filed as a hole because no measurement decided it",
    row: "| 574 | Regex | `/\\\\|/` | hole | COULD NOT CLEAR — filed as a hole because no measurement decided it |",
  },
];

test("the register's cells read on GitHub exactly as the verdicts are written", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-register-cells-"));
  try {
    const survivors = join(dir, "docs", "compliance", "mutation-survivors");
    mkdirSync(survivors, { recursive: true });
    writeFileSync(join(dir, "docs", "compliance", "mutation-register.md"), "# Fixture register\n");
    writeFileSync(join(survivors, "fixture.json"), JSON.stringify({ function: "fixture",
      verdicts: CELL_CASES.map(({ why, row, ...v }) => ({ ...v, stableKey: ["fixture", "fixture", v.key].join(String.fromCharCode(1)) })) }));
    execFileSync(process.execPath, [join(ROOT, "scripts", "mutation-register.mjs")], { cwd: dir, stdio: "pipe" });
    const written = readFileSync(join(dir, "docs", "compliance", "mutation-register.md"), "utf8").split("\n");
    const wrong = CELL_CASES
      .map((c) => ({ why: c.why, want: c.row, got: written.find((l) => l.startsWith(`| ${c.line} | ${c.mutator} |`)) ?? "(no row)" }))
      .filter((c) => c.got !== c.want);
    assert.deepEqual(wrong, [], "rows GitHub would not show as the verdicts are written");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Meta-guard, the same reflex as no-overclaim.test.js: a parser that quietly reads nothing turns
// every assertion above into a pass. Say so here rather than in a release where the ratchet is
// believed to be holding.
test("the parser is actually reading the register", () => {
  assert.ok(rows.length > 0, "no rows parsed: the register's table shape changed");
  assert.ok(register.includes("ADR-0046"),
    "the register no longer cites the ADR it implements — wrong file, or it was replaced");
});
