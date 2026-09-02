// The workflow contract's reader (ADR-0067, W1) — parse, confine, join; absence is a state,
// malformation never is.
//
// Until W2 poses the eleven contracts, a workflow with no frontmatter is the measured truth and
// parses to null — the callers surface "not yet declared", never an invented error. A contract
// that EXISTS and lies about itself (wrong slug, unknown control kind, a path that escapes the
// judged tree) is malformed, named, and never silently skipped: the `malformed`-pointer precedent,
// applied to the second corpus the product grows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkflowContract, producesGateJoin, CONTROL_KINDS } from "../../dist/lib/workflow-contract.js";
import { GATED_DELIVERABLES } from "../../dist/lib/conformance.js";

const CONTRACT = (over = {}) => [
  "---",
  `workflow: ${over.workflow ?? "floor"}`,
  `phase: ${over.phase ?? "floor"}`,
  `gate: ${over.gate ?? "strict"}`,
  `produces: ${over.produces ?? "[runward/floor.md#gated]"}`,
  `requires: ${over.requires ?? "[runward/framing.md, runward/architecture.md]"}`,
  `controls: ${over.controls ?? "[junit:code/reports/junit.xml]"}`,
  `nonScope: ${over.nonScope ?? "This contract proves declarations, never that the floor is good."}`,
  "---",
  "",
  "# Floor workflow", "", "## When to use", "…",
].join("\n");

test("a complete contract parses clean, and a file with no frontmatter is a state, not an error", () => {
  const c = parseWorkflowContract("floor.md", CONTRACT());
  assert.ok(c, "the contract parses");
  assert.deepEqual(c.malformed, [], "nothing to blame");
  assert.deepEqual(c.produces, [{ path: "runward/floor.md", gated: true }]);
  assert.deepEqual(c.requires, ["runward/framing.md", "runward/architecture.md"]);
  assert.deepEqual(c.controls, [{ kind: "junit", report: "code/reports/junit.xml" }]);
  assert.equal(parseWorkflowContract("method.md", "# Method\n\n## When to use\n…\n"), null,
    "no frontmatter = no contract yet — the pre-W2 truth, surfaced, never invented into an error");
});

test("every lie a contract can tell about itself is named", () => {
  const slug = parseWorkflowContract("floor.md", CONTRACT({ workflow: "flor" }));
  assert.ok(slug.malformed.some((m) => m.includes("does not match the filename")),
    "the slug is the join key — a mismatch is named, never healed");
  const kind = parseWorkflowContract("floor.md", CONTRACT({ controls: "[banana:reports/x.json]" }));
  assert.ok(kind.malformed.some((m) => m.includes("not a kind the strict adapters read")),
    "an unknown control kind would be silently never-verified — refused instead");
  const gate = parseWorkflowContract("floor.md", CONTRACT({ gate: "advisory" }));
  assert.ok(gate.malformed.some((m) => m.includes("strict or none")));
  const noscope = parseWorkflowContract("floor.md", CONTRACT({ nonScope: "" }));
  assert.ok(noscope.malformed.some((m) => m.includes("nonScope")),
    "every contract says the one sentence it does not claim");
});

test("a path that escapes the judged tree makes the contract malformed and is never followed", () => {
  for (const bad of ["[../outside.md]", "[/etc/passwd]", "[runward/../../up.md]"]) {
    const c = parseWorkflowContract("floor.md", CONTRACT({ produces: bad }));
    assert.ok(c.malformed.some((m) => m.includes("escapes the judged tree")),
      `${bad}: confinement is the evidence.ts posture, restated where a second grammar begins`);
  }
});

test("the produces↔gate join breaks both ways, by descriptor — and stays silent before any contract exists", () => {
  assert.deepEqual(producesGateJoin([{ file: "method.md", contract: null }]), [],
    "the pre-W2 vacuum is absence, not breakage");
  const mk = (file, produces) => ({ file, contract: parseWorkflowContract(file, CONTRACT({ workflow: file.replace(/\.md$/, ""), produces })) });
  const phantom = producesGateJoin([mk("floor.md", "[runward/phantom.md#gated]")]);
  assert.ok(phantom.some((j) => j.includes("the gate seals no such deliverable")),
    "a gated claim on a deliverable the gate does not seal is a lie about the gate");
  assert.ok(phantom.some((j) => j.includes("no contract claims the gated deliverable")),
    "and every sealed deliverable someone must claim — an orphan is named");
  const doubled = producesGateJoin([
    mk("floor.md", "[runward/floor.md#gated]"),
    mk("iterate.md", "[runward/floor.md#gated]"),
  ]);
  assert.ok(doubled.some((j) => j.includes("exactly one producing procedure")),
    "a sealed deliverable has one producer — two claims are a fight, not a redundancy");
});

test("the control kinds are exactly the shipped strict adapters — the closed list the ADR names", () => {
  assert.deepEqual([...CONTROL_KINDS].sort(), ["cobertura", "cyclonedx", "eslint", "junit", "lcov", "sarif"],
    "a kind here without its adapter would be a demand nothing can verify");
  assert.ok(GATED_DELIVERABLES.length >= 5, "and the join's other side still exists");
});
