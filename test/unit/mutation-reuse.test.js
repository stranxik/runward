// ADR-0106 (proposed): the release ratchet reuses a previous release's SURVIVORS, and nothing else.
//
// What is pinned here, against throwaway inputs (none of this reads the repository's dist/ or its
// register, so a module that grows never reddens it):
//   - a reused result can only be a survivor: the bundle keeps survivors only, the plan refuses a bundle
//     that carries anything else, and the leg's incremental file holds the survivors only, so Stryker
//     measures every killed mutant (positive control: a bundle with one kill in it is a full measure);
//   - a changed line is handed to Stryker with the OLD source beside it, so its differ sees the change
//     and measures the mutant (test/stryker-incremental-contract.js runs Stryker itself on that case);
//   - a survivor the register no longer files is measured, which is what follows a test written to kill
//     it (positive control: one filing retired, the other survivor still reused), and its key is the
//     ratchet's own (mutation-key.mjs, survivorKeys);
//   - every reason not to reuse is a FULL plan with its reason, never a pass: another version, commit,
//     event, environment, a fourth generation, an unreadable bundle;
//   - a leg planned for reuse that cannot apply it fails, rather than measuring for hours;
//   - the trim keeps a leg's report to its range, and the planner predicts only what will be measured
//     while its ranges still cover every line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  previousTag, environmentDiffers, configDigest, planReuse, buildBundle, legFile, trimReport, lineMap, reusedIn, sha256,
  fullPlan, main, MARK, FULL_EVERY, BUNDLE_SCHEMA, PLAN_SCHEMA, HARNESS, STRYKER_PACKAGES,
} from "../../scripts/mutation-reuse.mjs";
import { plan, assertCovers, DEFAULT_MODEL } from "../../scripts/mutation-plan.mjs";
import { survivorKeys } from "../../scripts/mutation-key.mjs";

const ENV = {
  node: "v24.22.1",
  stryker: Object.fromEntries(STRYKER_PACKAGES.map((p) => [p, "10.1.1"])),
  harness: Object.fromEntries(HARNESS.map((f) => [f, sha256(f)])),
};
const SOURCE = ["const a = 1;", "export function f(x) { return x > 0; }", "export function g(y) { return y + 1; }", ""].join("\n");
const FILE = "dist/lib/alpha.js";
const perimeter = [{ module: "alpha", file: FILE }, { module: "beta", file: "dist/lib/beta.js" }];
const loc = (line, sc, ec) => ({ start: { line, column: sc }, end: { line, column: ec } });
const survivor = { id: "3", mutatorName: "EqualityOperator", replacement: "x >= 0", location: loc(2, 31, 36), status: "Survived" };
const second = { id: "7", mutatorName: "ArithmeticOperator", replacement: "y - 1", location: loc(3, 31, 36), status: "Survived" };
const keyOf = (m) => survivorKeys(SOURCE, "alpha", [m])[0];
const filedOf = (...ms) => new Map([["alpha", new Set(ms.map(keyOf))]]);

function bundleWith(over = {}, modOver = {}) {
  return {
    schema: BUNDLE_SCHEMA, adr: "ADR-0106", version: "0.47.0", commit: "abc", run: "9", event: "release", generation: 0, env: ENV,
    modules: {
      alpha: { complete: true, sha256: sha256(SOURCE), source: SOURCE, survivors: [survivor], ...modOver },
      beta: { complete: false, reason: "1 of 2 chunks" },
    },
    ...over,
  };
}
const args = (bundle, over = {}) => ({
  bundle, bundleSha256: "b".repeat(64), tag: "v0.47.0", commit: "abc", run: "9", env: ENV, perimeter,
  sourceOf: () => SOURCE, filed: filedOf(survivor, second), ...over,
});

test("previousTag: the newest release below the current version, or at it with --inclusive", () => {
  const tags = ["v0.45.0", "v0.46.0", "v0.47.0", "v0.47.0-rc.1", "latest", "0.46.5"];
  assert.equal(previousTag(tags, "0.47.0"), "v0.46.0", "a release event never reuses itself");
  assert.equal(previousTag(tags, "0.47.0", true), "v0.47.0", "a dispatch between releases reuses the newest one");
  assert.equal(previousTag(tags, "0.48.1"), "v0.47.0");
  assert.equal(previousTag(["v0.46.0"], "0.46.0"), null);
  assert.throws(() => previousTag(tags, "main"), /not a version/);
});

test("environmentDiffers: Node, Stryker and each harness file are named when they move", () => {
  assert.equal(environmentDiffers(ENV, ENV), null);
  assert.match(environmentDiffers({ ...ENV, node: "v24.22.2" }, ENV), /Node\.js v24\.22\.2 then, v24\.22\.1 now/);
  assert.match(environmentDiffers({ ...ENV, stryker: { ...ENV.stryker, "@stryker-mutator/core": "10.2.0" } }, ENV), /@stryker-mutator\/core 10\.2\.0 then/);
  for (const f of HARNESS) {
    assert.match(environmentDiffers({ ...ENV, harness: { ...ENV.harness, [f]: "x" } }, ENV), new RegExp(`${f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")} changed`));
  }
  assert.match(environmentDiffers(undefined, ENV), /no environment/);
});

test("configDigest: Stryker's settings count, its prose and its perimeter do not", () => {
  const base = { _comment: ["a"], testRunner: "command", concurrency: 2, mutate: ["dist/lib/a.js"], _perimeter: { rule: [] } };
  const d = configDigest(base);
  assert.equal(configDigest({ ...base, _comment: ["an amendment"], _perimeter: { rule: ["more"] } }), d);
  assert.equal(configDigest({ ...base, mutate: ["dist/lib/a.js", "dist/lib/b.js"] }), d, "a module entering the perimeter has no survivor to reuse");
  assert.equal(configDigest({ concurrency: 2, testRunner: "command" }), d, "key order is not a setting");
  assert.notEqual(configDigest({ ...base, concurrency: 4 }), d, "concurrency is a correctness setting here (stryker.config.json, lever 3)");
  assert.notEqual(configDigest({ ...base, timeoutMS: 1 }), d);
});

test("planReuse: an unchanged, unrefiled module offers its survivors, marked, and nothing else", () => {
  const p = planReuse(args(bundleWith()));
  assert.equal(p.schema, PLAN_SCHEMA);
  assert.equal(p.state, "reuse");
  assert.equal(p.generation, 1);
  assert.deepEqual(p.from, { tag: "v0.47.0", version: "0.47.0", commit: "abc", run: "9", bundleSha256: "b".repeat(64), generation: 0 });
  const a = p.modules.alpha;
  assert.equal(a.reuse, true);
  assert.equal(a.unchanged, true);
  assert.deepEqual(a.mutants.map((m) => m.status), ["Survived"]);
  assert.ok(a.mutants[0].statusReason.startsWith(MARK), "the marker is how the ratchet counts what was reused");
  assert.deepEqual(a.predictedLines, [2]);
  assert.equal(p.modules.beta.reuse, false, "an incomplete module at the bundle's release is measured whole");
  assert.match(p.modules.beta.reason, /incomplete at v0\.47\.0: 1 of 2 chunks/);
});

test("planReuse (positive control): a bundle that carries a killed mutant is refused whole", () => {
  const killed = { ...survivor, id: "4", status: "Killed" };
  const p = planReuse(args(bundleWith({}, { survivors: [survivor, killed] })));
  assert.equal(p.state, "full");
  assert.match(p.reason, /did not survive; a bundle holds survivors only/);
  for (const status of ["Timeout", "CompileError", "RuntimeError", "Ignored"]) {
    assert.equal(planReuse(args(bundleWith({}, { survivors: [{ ...survivor, status }] }))).state, "full", status);
  }
});

test("planReuse (positive control): a changed line is handed to Stryker with the source it was measured on", () => {
  const changed = SOURCE.replace("return x > 0;", "return (x > 0);");
  const p = planReuse(args(bundleWith(), { sourceOf: () => changed }));
  const a = p.modules.alpha;
  assert.equal(a.unchanged, false);
  assert.deepEqual(a.predictedLines, [null], "the planner predicts this survivor at full cost");
  const f = legFile(p, "alpha");
  assert.equal(f.files[FILE].source, SOURCE, "the OLD source, so Stryker's differ sees the change and measures it");
  assert.notEqual(f.files[FILE].source, changed);
  // Lines moved above, the survivor's own line intact: predicted on its new line.
  const moved = planReuse(args(bundleWith(), { sourceOf: () => `// one\n// two\n${SOURCE}` })).modules.alpha;
  assert.deepEqual(moved.predictedLines, [4]);
});

test("planReuse (positive control): a survivor the register no longer files is measured, its sibling still reused", () => {
  const both = bundleWith({}, { survivors: [survivor, second] });
  const all = planReuse(args(both));
  assert.deepEqual(all.modules.alpha.mutants.map((m) => m.id), ["3", "7"]);
  const p = planReuse(args(both, { filed: filedOf(second) }));
  assert.equal(p.state, "reuse");
  assert.deepEqual(p.modules.alpha.mutants.map((m) => m.id), ["7"], "the retired filing's survivor is not offered, so Stryker measures it");
  assert.equal(p.modules.alpha.retired, 1);
  assert.deepEqual(p.modules.alpha.predictedLines, [3]);
  const none = planReuse(args(both, { filed: new Map() }));
  assert.equal(none.state, "full", "nothing filed, nothing reused");
  assert.match(none.reason, /nothing to reuse/);
  // The key is the ratchet's: the same mutant on another top-level declaration is another key.
  assert.notEqual(keyOf(survivor), keyOf(second));
});

test("planReuse: every reason not to reuse is a full plan with its reason", () => {
  const cases = [
    [bundleWith({ version: "0.46.0" }), {}, /says version 0\.46\.0/],
    [bundleWith({ commit: "def" }), {}, /says commit def/],
    [bundleWith({ event: "workflow_dispatch" }), {}, /workflow_dispatch run, not a release/],
    [bundleWith({ generation: FULL_EVERY - 1 }), {}, new RegExp(`one in ${FULL_EVERY} measures everything`)],
    [bundleWith({ generation: undefined }), {}, /no generation/],
    [bundleWith({ env: { ...ENV, node: "v26.0.0" } }), {}, /environment changed: Node\.js v26\.0\.0/],
    [bundleWith({ schema: "other" }), {}, /not a reuse bundle/],
    [null, {}, /not a reuse bundle/],
  ];
  for (const [b, over, reason] of cases) {
    const p = planReuse(args(b, over));
    assert.equal(p.state, "full", String(reason));
    assert.match(p.reason, reason);
    assert.deepEqual(p.modules, {});
    assert.equal(p.generation, 0, "a full measure starts the count again");
  }
  assert.equal(planReuse(args(bundleWith({ generation: FULL_EVERY - 2 }))).state, "reuse", "the generation before the limit still reuses");
  const forged = planReuse(args(bundleWith({}, { sha256: "0".repeat(64) })));
  assert.equal(forged.state, "full");
  assert.match(fullPlan("x").reason, /^x$/);
});

test("buildBundle: survivors only, complete modules only, and none without this run's plan", () => {
  const report = { files: { [FILE]: { source: SOURCE, mutants: [survivor, { ...survivor, id: "4", status: "Killed" }, { ...survivor, id: "5", status: "NoCoverage", statusReason: `${MARK} from v0.46.0` }] } } };
  const reusePlan = { ...fullPlan("first", ENV) };
  const b = buildBundle({
    perimeter, merged: new Map([["alpha", report]]),
    answers: new Map([["alpha", { module: "alpha", exit: 1, chunksExpected: 2, chunksMeasured: 2 }], ["beta", { module: "beta", exit: 2, chunksExpected: 2, chunksMeasured: 1 }]]),
    reusePlan, version: "0.47.0", commit: "abc", run: "9", event: "release",
  });
  assert.equal(b.schema, BUNDLE_SCHEMA);
  assert.equal(b.generation, 0);
  assert.deepEqual(b.env, ENV);
  assert.deepEqual(b.modules.alpha.survivors.map((m) => [m.id, m.status]), [["3", "Survived"], ["5", "NoCoverage"]], "a mismatch measured the tree all the same; the kill is left out");
  assert.equal(b.modules.alpha.survivors[1].statusReason, undefined, "an earlier marker is not carried forward");
  assert.equal(b.modules.alpha.sha256, sha256(SOURCE));
  assert.equal(b.modules.beta.complete, false, "a module whose ratchet compared nothing is not reusable next time");
  assert.throws(() => buildBundle({ perimeter, merged: new Map(), answers: new Map(), reusePlan: null }), /reuse plan is missing/);
  const short = buildBundle({ perimeter, merged: new Map([["alpha", report]]), answers: new Map([["alpha", { exit: 0, chunksExpected: 3, chunksMeasured: 2 }]]), reusePlan });
  assert.match(short.modules.alpha.reason, /2 of 3 chunks/);
  // The round trip: what a bundle leaves, the next plan reads.
  const p = planReuse(args({ ...b, generation: 0 }, { filed: new Map([["alpha", new Set(survivorKeys(SOURCE, "alpha", b.modules.alpha.survivors))]]) }));
  assert.equal(p.state, "reuse");
  assert.equal(p.modules.alpha.mutants.length, 2);
});

test("legFile and trimReport: the leg carries survivors only, and keeps its report to its range", () => {
  const p = planReuse(args(bundleWith()));
  const f = legFile(p, "alpha");
  assert.deepEqual(Object.keys(f.files), [FILE]);
  assert.ok(f.files[FILE].mutants.every((m) => m.status === "Survived"));
  assert.equal(legFile(p, "beta"), null);
  assert.equal(legFile(fullPlan("no"), "alpha"), null);
  const report = { files: { [FILE]: { mutants: [
    { location: loc(2, 1, 5), statusReason: `${MARK} from v0.47.0` },
    { location: loc(3, 1, 5), status: "Killed" },
    { location: { start: { line: 3, column: 1 }, end: { line: 5, column: 1 } } },
    { location: loc(9, 1, 5), statusReason: `${MARK} from v0.47.0` },
  ] } } };
  assert.equal(reusedIn(report), 2);
  assert.deepEqual(trimReport(report, 1, 4), { kept: 2, dropped: 2, reused: 1 }, "a mutant straddling the range end is no more this leg's than a full measure's");
  assert.equal(report.files[FILE].mutants.length, 2);
});

test("lineMap: equal lines keep their place across an insertion, a changed line maps nowhere", () => {
  const m = lineMap("a\nb\nc\nd", "a\nX\nb\nc2\nd");
  assert.equal(m.get(1), 1);
  assert.equal(m.get(2), 3);
  assert.equal(m.get(3), undefined);
  assert.equal(m.get(4), 5);
});

test("plan --reuse: offered survivors cost nothing to predict, and every line is still measured", () => {
  const n = 120;
  const src = "x\n".repeat(n - 1) + "x";
  const config = { mutate: ["dist/lib/alpha.js"] };
  const mutants = [];
  for (let l = 1; l <= n; l += 4) mutants.push([l, 2, 3]);
  const record = { model: DEFAULT_MODEL, modules: { alpha: { lines: n, mutants } } };
  const predictedLines = mutants.flatMap(([l, , s]) => new Array(s).fill(l));
  const reuse = { state: "reuse", from: { tag: "v0.47.0" }, modules: { alpha: { reuse: true, predictedLines } } };
  const before = plan({ config, sourceOf: () => src, record, targetMinutes: 90 });
  const after = plan({ config, sourceOf: () => src, record, targetMinutes: 90, reuse });
  assert.ok(after.totalSeconds < before.totalSeconds, `${after.totalSeconds} < ${before.totalSeconds}`);
  assert.ok(after.chunks.length < before.chunks.length, "fewer, longer ranges");
  assert.doesNotThrow(() => assertCovers(after.chunks, [{ module: "alpha", lines: n }]), "a reuse changes what a leg pays, never which lines it is handed");
  assert.equal(after.chunks.reduce((s, c) => s + c.reuse, 0), predictedLines.length);
  assert.equal(after.reused, predictedLines.length);
  assert.ok(before.chunks.every((c) => !("reuse" in c)), "no reuse plan, no field: the ADR-0104 output is unchanged");
  const full = plan({ config, sourceOf: () => src, record, targetMinutes: 90, reuse: fullPlan("off") });
  assert.equal(full.totalSeconds, before.totalSeconds);
});

test("leg (command line): a leg planned for reuse that cannot apply it fails; one not planned measures", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-reuse-leg-"));
  const quiet = { log: console.log, error: console.error };
  console.log = () => {}; console.error = () => {};
  try {
    const out = join(dir, "incremental.json");
    const missing = join(dir, "absent.json");
    assert.equal(main(["leg", "--plan", missing, "--module", "alpha", "--expect", "2", "--out", out]), 1);
    assert.equal(main(["leg", "--plan", missing, "--module", "alpha", "--expect", "0", "--out", out]), 0);
    assert.equal(existsSync(out), false);
    const planPath = join(dir, "plan.json");
    const p = planReuse(args(bundleWith(), { env: { ...ENV, node: process.version } }));
    writeFileSync(planPath, JSON.stringify(p));
    assert.equal(main(["leg", "--plan", planPath, "--module", "alpha", "--expect", "1", "--out", out]), 0);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), legFile(p, "alpha"));
    rmSync(out);
    writeFileSync(planPath, JSON.stringify({ ...p, env: { ...p.env, node: "v0.0.0" } }));
    assert.equal(main(["leg", "--plan", planPath, "--module", "alpha", "--expect", "1", "--out", out]), 1, "another Node.js than the plan's refuses the chunk");
    writeFileSync(planPath, JSON.stringify(fullPlan("off", ENV)));
    assert.equal(main(["leg", "--plan", planPath, "--module", "alpha", "--expect", "1", "--out", out]), 1, "the plan offers nothing where the chunk was cut for reuse");
    assert.equal(main(["leg", "--plan", planPath, "--module", "alpha", "--expect", "0", "--out", out]), 0);
    assert.equal(existsSync(out), false);
  } finally {
    console.log = quiet.log; console.error = quiet.error;
    rmSync(dir, { recursive: true, force: true });
  }
});
