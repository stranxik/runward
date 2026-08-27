// The decisions `check` makes around the verdict, asserted directly.
//
// ADR-0047 moved the verdict where a test could reach it and left these behind: which flag
// combinations are misuse, whether a run is for a machine, and the exact shape of the ADR-0030
// payload. Until 2026-08-24 they lived inside a 442-line function and could only be exercised by
// spawning the CLI and reading stdout — which is why a mutation sample of that region scored 26 %.
//
// What is pinned here is behaviour a consumer depends on, never wording. The one exception is the
// two misuse messages, and only that they NAME the flag they are about: a message that says nothing
// about which combination is wrong sends the operator to read the source.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  optionFault, impliesStrict, isMachineRun, machinePayload,
} from "../../dist/lib/check-contract.js";

/** A verdict with every field the payload reads, and nothing else. */
const verdict = () => ({
  deferredGaps: 0,
  through: null,
  horizon: null,
  breakdown: { rows: 9, applied: 5, deviated: 1, na: 3, typed: 4, prose: 5, signed: 2, duplicated: [], evidenceFiles: { total: 7, external: 6 } },
  corpus: { status: "package", missing: [], edited: [], extra: [] },
  seal: { present: false, count: 0, sealedAt: undefined, violations: [] },
  criticalScope: { total: 7, accounted: 7 },
});

const ctx = (over = {}) => ({
  version: "0.36.1",
  missionRoot: "/tmp/m",
  currentGate: "floor",
  adrCount: 12,
  clean: true,
  strict: true,
  gaps: 0,
  strictGaps: 0,
  hookFailed: 0,
  deliverables: [],
  conformance: [],
  corpusPin: null,
  corpusDrift: null,
  gateNonScope: ["presence", "pointers"],
  ...over,
});

// --- misuse -------------------------------------------------------------------------------------

test("--through with --freeze is refused: a seal certifies a full crossing, a horizon a prefix", () => {
  const fault = optionFault({ through: "floor", freeze: true });
  assert.ok(fault, "sealing a declared prefix would read like completion — the false green ADR-0053 refuses");
  assert.match(fault.message, /--through/);
  assert.match(fault.message, /--freeze/);
});

test("--vsa without --resource-uri is refused rather than given a guessed name", () => {
  const fault = optionFault({ vsa: true });
  assert.ok(fault, "a policy engine acts on that URI; runward reads a working tree and cannot know it");
  assert.match(fault.message, /--resource-uri/);
});

test("--vsa with a resource URI is accepted", () => {
  assert.equal(optionFault({ vsa: true, resourceUri: "pkg:npm/runward@0.36.1" }), null);
});

test("the combinations that mean something are not refused", () => {
  // The mirror direction, and the file needs it: a function that refuses everything satisfies the
  // three cases above, and a gate that cries on honest input is the one that gets switched off.
  for (const opts of [
    {}, { strict: true }, { freeze: true }, { through: "floor" }, { strict: true, json: true },
    { sarif: true }, { attest: true, strict: true }, { through: "floor", strict: true },
  ]) {
    assert.equal(optionFault(opts), null, `refused a legitimate combination: ${JSON.stringify(opts)}`);
  }
});

// --- implied modes ------------------------------------------------------------------------------

test("--freeze implies --strict: a seal certifies a strict crossing, never a lenient one", () => {
  assert.equal(impliesStrict({ freeze: true }), true);
  assert.equal(impliesStrict({ strict: true }), true);
  assert.equal(impliesStrict({}), false, "nothing else may turn strict on by accident");
});

test("every machine mode suppresses the human run, and no other flag does", () => {
  for (const flag of ["json", "attest", "sarif", "vsa"]) {
    assert.equal(isMachineRun({ [flag]: true }), true, `--${flag} writes a document something parses`);
  }
  for (const flag of ["strict", "freeze", "hooks", "coverage"]) {
    assert.equal(isMachineRun({ [flag]: true }), false,
      `--${flag} must not silence the printed run: prose interleaved into a parsed stream moves no exit code`);
  }
});

// --- the ADR-0030 payload -----------------------------------------------------------------------

test("the payload carries the verdict and the exit code a consumer branches on", () => {
  const clean = machinePayload(verdict(), ctx());
  assert.equal(clean.verdict, "clean");
  assert.equal(clean.exitCode, 0);

  const gaps = machinePayload(verdict(), ctx({ clean: false, gaps: 2 }));
  assert.equal(gaps.verdict, "gaps");
  assert.equal(gaps.exitCode, 1);
  assert.equal(gaps.gaps.deliverables, 2);
});

test("the strict block is ABSENT without --strict, never empty", () => {
  // Zero and absence are not the same claim. An empty `conformance: []` under a lenient run reads as
  // "checked and clean" to a consumer that cannot cross-check it; nothing was checked at all.
  const lenient = machinePayload(verdict(), ctx({ strict: false }));
  for (const field of ["conformance", "evidence", "corpus", "seal", "criticalScope", "gateNonScope"]) {
    assert.ok(!(field in lenient), `${field} must not appear without --strict`);
  }
  const strict = machinePayload(verdict(), ctx({ strict: true }));
  for (const field of ["conformance", "evidence", "corpus", "seal", "criticalScope", "gateNonScope"]) {
    assert.ok(field in strict, `${field} must appear under --strict`);
  }
});

test("the evidence counters are reported as measured, not recomputed", () => {
  // RWD-2026-0003: the coverage counter only printed when applied > 0, so answering `n/a` to every
  // rule removed the only vacuity signal the product had — the emptiest missions produced the most
  // reassuring output. These counters are that signal, and they travel in the machine contract.
  //
  // `evidenceFiles` joined them on 2026-08-27, for the same phenomenon one level up: a mission that
  // cites only its own deliverables reads `100%` while the honest shipped example reads 87%. The
  // gate stays GREEN on it — ADR-0054 makes this a documentary gate and a documentation-only mission
  // is legitimate — so the fact is disclosed rather than refused, and a consumer branching on this
  // contract can tell a substantive crossing from a vacuous one without reading prose.
  const v = verdict();
  const p = machinePayload(v, ctx());
  assert.deepEqual(p.evidence, {
    rows: 9, applied: 5, deviated: 1, na: 3, typed: 4, prose: 5, signed: 2, duplicated: [],
    evidenceFiles: { total: 7, external: 6 },
  });
});

test("a seal that is absent says so, and its date is null rather than undefined", () => {
  // `undefined` disappears through JSON.stringify; a consumer reading the parsed document would see
  // no key at all and could not tell "unsealed" from "field removed in a later version".
  const p = machinePayload(verdict(), ctx());
  assert.equal(p.seal.present, false);
  assert.equal(p.seal.sealedAt, null);
  assert.ok(JSON.stringify(p).includes('"sealedAt":null'));
});

test("seal violations travel as a COUNT, not as the objects", () => {
  const v = verdict();
  v.seal = { present: true, count: 3, sealedAt: "2026-08-24", violations: [{ rule: "(seal)" }, { rule: "(seal)" }] };
  assert.equal(machinePayload(v, ctx()).seal.violations, 2);
});

test("the horizon travels explicitly so a prefix green cannot be read as complete", () => {
  // ADR-0053: `through` is the declared horizon and `horizon` the deferred deliverables. Dropping
  // either lets a consumer read a certified prefix as a certified mission.
  const v = verdict();
  v.through = "floor";
  v.horizon = { deferred: 4 };
  v.deferredGaps = 4;
  const p = machinePayload(v, ctx());
  assert.equal(p.through, "floor");
  assert.deepEqual(p.horizon, { deferred: 4 });
  assert.equal(p.gaps.deferred, 4);
});
