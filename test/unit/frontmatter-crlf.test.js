// One format, three parsers. RWD-2026-0016 fixed the frontmatter delimiter in rules.ts and
// conformance.ts so a Windows checkout could not turn the corpus into a fabrication; compliance.ts
// was written with the pre-fix pattern and kept it. The constant is named FRONTMATTER in all three,
// so the divergence is invisible to a reader comparing them by name.
//
// Nothing could see it. runward's own .gitattributes pins `* text=auto eol=lf` (added 2026-08-17,
// for the first windows-latest leg), so this tree checks out LF on every OS and its CI can never
// produce the input. A user's mission lives in the USER's repo under the USER's git config, where
// core.autocrlf=true is what the Windows installer recommends. And the smoke assertion that looks
// like it guards ASI coverage (test/smoke.js, "the shipped rules cover all 10 OWASP ASI controls")
// reads the rule files with its own unanchored /asi:\s*\[([^\]]+)\]/ and never parses frontmatter
// at all, so it cannot see this parser disagree with the other two.
//
// POSITIVE CONTROL: both tests below fail on the unfixed compliance.ts — the first because its
// regex returns no match on CRLF, the second because asiCoverage comes back empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gatherComplianceInputs } from "../../dist/lib/compliance.js";

const LIB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib");
const CRLF_DOC = "---\r\ntitle: Probe rule\r\nimpact: HIGH\r\nasi: [ASI03]\r\n---\r\n\r\nBody of a rule.\r\n";
const LF_DOC = CRLF_DOC.replace(/\r/g, "");

// Property, not spelling: each delimiter is compiled and run, so a future rewrite that accepts CRLF
// some other way passes, and a copy of the old pattern under a new name still fails.
test("every frontmatter delimiter in src/lib accepts CRLF as well as LF", () => {
  const found = [];
  for (const f of readdirSync(LIB).filter((x) => x.endsWith(".ts"))) {
    const src = readFileSync(join(LIB, f), "utf8");
    for (const m of src.matchAll(/^const\s+(\w*FRONTMATTER\w*)\s*=\s*\/(.+?)\/([gimsuy]*);/gm)) {
      found.push({ file: f, name: m[1], re: new RegExp(m[2], m[3]) });
    }
  }
  assert.ok(found.length >= 3,
    `expected the frontmatter parsers to be found in src/lib, saw ${found.length}`);
  for (const { file, name, re } of found) {
    assert.ok(re.test(LF_DOC), `${file}: ${name} does not match an LF document`);
    assert.ok(re.test(CRLF_DOC),
      `${file}: ${name} rejects CRLF — a Windows checkout makes this parser read an empty ` +
      `frontmatter while the others read the real one (RWD-2026-0016)`);
  }
});

// The invariant that actually matters: two layers, one file, one answer. The gate reads the rule
// through rules.ts/conformance.ts; the pack reads it through compliance.ts. They must not disagree.
test("a CRLF rule reaches the compliance pack's ASI coverage", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-crlf-"));
  try {
    mkdirSync(join(dir, "rules"), { recursive: true });
    writeFileSync(join(dir, "rules", "probe-rule.md"), CRLF_DOC);
    const inputs = gatherComplianceInputs(dir);
    assert.deepEqual(inputs.rules.map((r) => [r.slug, r.impact, r.asi]),
      [["probe-rule", "HIGH", ["ASI03"]]],
      "compliance.ts read a CRLF rule's frontmatter differently from rules.ts");
    assert.deepEqual(inputs.asiCoverage.get("ASI03"), ["probe-rule"],
      "the pack reports no rule mapped to ASI03 for a mission that maps one");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
