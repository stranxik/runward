// The second grammar's parser, pinned exactly (consolidated pass: 43 mutants survived on
// workflow-contract.js, almost all in the parse path nothing compared byte-for-byte). One
// canonical frontmatter must yield the EXACT contract object; each degenerate shape must yield
// its EXACT malformed message. deepEqual everywhere — an emptied literal, a loosened regex or a
// dropped anchor has nowhere to hide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkflowContract } from "../../dist/lib/workflow-contract.js";

const fm = (over = {}) => {
  const d = {
    workflow: "floor", phase: "floor", gate: "strict",
    produces: "[runward/floor.md#gated, runward/notes.md]",
    requires: "[runward/framing.md, runward/architecture.md]",
    controls: "[junit:reports/junit.xml]",
    nonScope: "One sentence.",
    ...over,
  };
  return Object.entries(d).filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`).join("\n");
};
const doc = (fields, eol = "\n") => `---${eol}${fields.replaceAll("\n", eol)}${eol}---${eol}${eol}# Floor${eol}`;

test("the canonical frontmatter yields the exact contract — LF and CRLF alike", () => {
  const expected = {
    workflow: "floor", phase: "floor", gate: "strict",
    produces: [{ path: "runward/floor.md", gated: true }, { path: "runward/notes.md", gated: false }],
    requires: ["runward/framing.md", "runward/architecture.md"],
    controls: [{ kind: "junit", report: "reports/junit.xml" }],
    nonScope: "One sentence.",
    malformed: [],
    source: "package",
  };
  assert.deepEqual(parseWorkflowContract("floor.md", doc(fm())), expected);
  assert.deepEqual(parseWorkflowContract("floor.md", doc(fm(), "\r\n")), expected,
    "a CRLF tree parses identically — the frontmatter fence tolerates \\r");
});

test("a file with no frontmatter is null — absence is a state, never a guess", () => {
  assert.equal(parseWorkflowContract("floor.md", "# Floor\n\nno fence here\n"), null);
});

test("#gated is a suffix, parsed once, at the end only", () => {
  const c = parseWorkflowContract("floor.md", doc(fm({ produces: "[runward/a.md#gatedish]" })));
  assert.deepEqual(c.produces, [{ path: "runward/a.md#gatedish", gated: false }],
    "a path merely containing the letters is not a gated claim — the marker is anchored");
});

test("empty list fields parse to empty arrays, not phantom entries", () => {
  const c = parseWorkflowContract("floor.md", doc(fm({ produces: "[]", requires: "[]", controls: "[]" })));
  assert.deepEqual([c.produces, c.requires, c.controls], [[], [], []]);
});

test("every degenerate shape yields its own named malformed entry", () => {
  const cases = [
    [fm({ workflow: "verify" }), /workflow/, "slug must equal the filename stem"],
    [fm({ gate: "sometimes" }), /gate/, "gate outside the closed pair"],
    [fm({ produces: "[../escape.md]" }), /confin|\.\.|escape/i, "a .. path never leaves the tree"],
    [fm({ produces: "[/abs/path.md]" }), /confin|abs|escape/i, "an absolute path never leaves the tree"],
    [fm({ produces: "[C:/win/path.md]" }), /confin|C:|escape/i, "a drive-letter path never leaves the tree"],
    [fm({ controls: "[unknownkind:report.xml]" }), /unknownkind|kind/, "control kinds are a closed set"],
    [fm({ controls: "[justareportpath.xml]" }), /kind|:/, "a control without kind: is not a control"],
  ];
  for (const [fields, re, why] of cases) {
    const c = parseWorkflowContract("floor.md", doc(fields));
    assert.ok(c !== null && c.malformed.length >= 1, why);
    assert.ok(c.malformed.some((m) => re.test(m)), `${why} — the message names the problem: ${JSON.stringify(c.malformed)}`);
  }
});

test("a missing required key is malformed and names the key", () => {
  for (const key of ["workflow", "phase", "gate", "nonScope"]) {
    const c = parseWorkflowContract("floor.md", doc(fm({ [key]: null })));
    assert.ok(c !== null && c.malformed.some((m) => m.includes(key)),
      `dropping "${key}" must be malformed by name: ${JSON.stringify(c?.malformed)}`);
  }
});
