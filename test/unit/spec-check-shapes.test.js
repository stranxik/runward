// `spec-check` said "every criterion is linked" on six ordinary spec shapes (2026-08-26 audit).
// The sting: the MANIFEST parser in this same codebase is documented as hardened against exactly
// these — `readManifest` carries "a second section above the real one hid it entirely" and
// "a `### Sub-heading` after the table did not end the section" as bugs an adversarial audit found.
// Its neighbour kept `findIndex` (first match), `break` on any heading, and a list-item-only test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { specConformance } from "../../dist/lib/spec-conformance.js";

// One file exists; the two the broken criteria cite do not.
const base = () => {
  const d = mkdtempSync(join(tmpdir(), "rw-spec-"));
  mkdirSync(join(d, "src"), { recursive: true });
  writeFileSync(join(d, "src", "auth.ts"), "export function login() {}\n");
  return d;
};
const OK = "- login works file:src/auth.ts#login";
const BROKEN = "- redaction works file:src/redact.ts#redact\n- approval works file:src/approve.ts#approve";

test("a spec whose criteria point at files that do not exist is refused, in every shape", () => {
  const d = base();
  try {
    const run = (c) => specConformance(c, d);
    // The positive control the whole test rests on: the instrument moves when the pointers are
    // where it already looked.
    assert.equal(run(`# S\n\n## Acceptance criteria\n\n${BROKEN}\n`).unlinked, 2, "control: broken pointers refused");

    for (const [what, content] of [
      ["two acceptance sections, the second unchecked", `# S\n\n## Acceptance criteria\n\n${OK}\n\n## Acceptance criteria (detail)\n\n${BROKEN}\n`],
      ["a ### sub-heading inside the section", `# S\n\n## Acceptance criteria\n\n${OK}\n\n### Edge cases\n\n${BROKEN}\n`],
      ["criteria written as a markdown table", `# S\n\n## Acceptance criteria\n\n| Criterion | Evidence |\n|---|---|\n| redaction | file:src/redact.ts#redact |\n| approval | file:src/approve.ts#approve |\n`],
      ["criteria written as prose", `# S\n\n## Acceptance criteria\n\nRedaction works, see file:src/redact.ts#redact.\nApproval works, see file:src/approve.ts#approve.\n`],
      ["a decoy heading above the real section", `# S\n\n## Notes on acceptance criteria\n\nNothing here.\n\n## Acceptance criteria\n\n${BROKEN}\n`],
    ]) assert.ok(run(content).unlinked >= 2, `${what}: both broken pointers must be found — got ${JSON.stringify(run(content))}`);

    // An acceptance section naming nothing read `linked` with total 0 — the vacuity RWD-2026-0003
    // already named: the emptiest input produced the most reassuring output.
    const empty = run(`# S\n\n## Acceptance criteria\n\n## Next\n\n${BROKEN}\n`);
    assert.equal(empty.unlinked, 1, "an empty acceptance section is not a pass");
    assert.match(empty.criteria[0].reason, /names no criterion/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("every honest shape still passes — the fix is not a stricter parser in disguise", () => {
  const d = base();
  try {
    for (const [what, content] of [
      ["list items", `# S\n\n## Acceptance criteria\n\n${OK}\n`],
      ["a table", `# S\n\n## Acceptance criteria\n\n| Criterion | Evidence |\n|---|---|\n| login | file:src/auth.ts#login |\n`],
      ["prose", `# S\n\n## Acceptance criteria\n\nLogin works, see file:src/auth.ts#login.\n`],
      ["a sub-heading with criteria under it", `# S\n\n## Acceptance criteria\n\n### Happy path\n\n${OK}\n`],
      ["two honest sections", `# S\n\n## Acceptance criteria\n\n${OK}\n\n## More acceptance criteria\n\n${OK}\n`],
      ["explanatory prose beside the criteria", `# S\n\n## Acceptance criteria\n\nThis section explains the shape.\n\n${OK}\n`],
    ]) {
      const r = specConformance(content, d);
      assert.equal(r.unlinked, 0, `${what} must still pass — got ${JSON.stringify(r)}`);
      assert.ok(r.criteria.length >= 1, `${what} must find its criterion`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a pointer written the way markdown is written is not refused", () => {
  // `- login works `file:src/auth.ts#login`` parsed its symbol as ``login` `` and the gate answered
  // *symbol "login`" not found* — an undue refusal on a pointer that is correct. It surfaced only
  // where the pointer ends the line: in a manifest cell something usually follows it.
  const d = base();
  try {
    const r = specConformance("# S\n\n## Acceptance criteria\n\n- login works `file:src/auth.ts#login`\n", d);
    assert.equal(r.unlinked, 0, `a backtick-wrapped pointer must link — got ${JSON.stringify(r)}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
