// The release verification guide and the workflow that replays it must say the same commands
// (ADR-0090, M6, the parity half; the execution half is .github/workflows/documented-commands.yml).
//
// WHAT IT WOULD HAVE CAUGHT. The first sample period's seed (ADR-0090, Context) made Step 3 of
// docs/verifying-a-release.md say the trusted root is not needed offline. Its diff is not on the forge,
// so which shape it took is not known. If the seed dropped `--custom-trusted-root` from Step 3's
// command, the parity test below fails, naming Step 3 (and the execution job fails too: measured, an
// offline verification with no trusted root exits 1). If the seed rewrote the "Three files suffice"
// sentence to two files, the narrow prose check below fails. If the seed added or changed any other
// sentence and left the commands and that claim intact, NOTHING here fails: a test pins that blind
// spot, so it cannot be mistaken for coverage. Prose is not judged (ADR-0090 decision 5).
//
// No network: the guide and the workflow are read from the tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import {
  GUIDE, REPO, EXECUTED, NOT_EXECUTED, OFFLINE_STEPS,
  parseGuide, forVersion, canonical, classificationProblems, executablePlan, commandsOfBlock,
} from "../../scripts/documented-commands.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW = ".github/workflows/verify-release.yml";
const GUIDE_TEXT = readFileSync(join(ROOT, GUIDE), "utf8");
const WORKFLOW_TEXT = readFileSync(join(ROOT, WORKFLOW), "utf8");
const V = "<V>";

// What verify-release.yml claims to replay: each of its steps named "Step <x> — …", mapped to the
// guide's step. A workflow step named "Step …" that is not declared here fails.
const WORKFLOW_TO_GUIDE = { "Step 0": "0", "Step 2": "2", "Step 2b": "2", "Step 2c": "2c", "Step 3": "3", "Step 7": "7" };
// The guide's steps whose gh commands the workflow replays, command for command.
const REPLAYED = ["2", "2c", "3", "7"];
// Commands of a replayed step the workflow does not run, each with its reason. Matched in the
// canonical form, so a change to one of them is a drift too.
const GUIDE_ONLY = {
  "gh attestation verify runward-<V>.tgz | --repo stranxik/runward":
    "gh's default predicate; the workflow names the same predicate explicitly in Step 2b",
};
// Step 0 is replayed in substance, not command for command: the workflow downloads with
// `gh release download`, waits for npm, and compares with sha256sum. The guide's own block is executed,
// as written, by documented-commands.yml.
const SUBSTANCE_ONLY = { "0": "the workflow downloads with gh release download, waits for npm and compares with sha256sum" };

/** The workflow's gh commands per step name, with the CI variables normalised to the guide's form. */
function workflowCommands(text) {
  const doc = loadYaml(text);
  const out = new Map();
  for (const job of Object.values(doc.jobs)) {
    for (const s of job.steps ?? []) {
      const m = s.name?.match(/^(Step \w+) — /);
      if (!m || !s.run) continue;
      const cmds = commandsOfBlock(s.run.split("\n"))
        .map((c) => c.text)
        .filter((t) => /^gh\s/.test(t))
        .map((t) => t
          .replace(/"\$GITHUB_REPOSITORY"|\$GITHUB_REPOSITORY/g, REPO)
          .replace(/"\$TAG"/g, `v${V}`)
          .replace(/\$VERSION/g, V)
          .replace(/"/g, ""));
      out.set(m[1], cmds.map((t) => canonical(forVersion(t, V))));
    }
  }
  return out;
}

const guideCommands = (step) => step.blocks.flat().map((c) => canonical(forVersion(c.text, V)));

/** Every drift between the guide and the workflow, each naming its step. Empty when they agree. */
function parityProblems(guideText, workflowText) {
  const steps = parseGuide(guideText);
  const wf = workflowCommands(workflowText);
  const problems = [];
  for (const name of wf.keys()) {
    if (!(name in WORKFLOW_TO_GUIDE)) problems.push(`${name} of ${WORKFLOW} is not declared as replaying a step of the guide`);
  }
  for (const [name, id] of Object.entries(WORKFLOW_TO_GUIDE)) {
    const step = steps.find((s) => s.id === id);
    if (!step) { problems.push(`${name} of ${WORKFLOW} replays Step ${id}, which the guide no longer has`); continue; }
    if (!wf.has(name)) { problems.push(`${WORKFLOW} no longer runs ${name}`); continue; }
    if (SUBSTANCE_ONLY[id]) continue;
    const documented = new Set(guideCommands(step));
    for (const c of wf.get(name)) {
      if (!documented.has(c)) problems.push(`${name} of ${WORKFLOW} runs a command Step ${id} of the guide does not document: ${c}`);
    }
  }
  for (const id of REPLAYED) {
    const step = steps.find((s) => s.id === id);
    if (!step) { problems.push(`Step ${id} is declared replayed and the guide has no such step`); continue; }
    const replayed = new Set(Object.entries(WORKFLOW_TO_GUIDE).filter(([, g]) => g === id).flatMap(([n]) => wf.get(n) ?? []));
    for (const c of guideCommands(step)) {
      if (!replayed.has(c) && !(c in GUIDE_ONLY)) problems.push(`Step ${id} of the guide documents a command ${WORKFLOW} does not run: ${c}`);
    }
  }
  const all = new Set(steps.flatMap(guideCommands));
  for (const c of Object.keys(GUIDE_ONLY)) if (!all.has(c)) problems.push(`the declared guide-only command is gone from the guide: ${c}`);
  return problems;
}

// ── the narrow prose check: "N files suffice: a, b and c." against the files the offline command names
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
function fileKind(item) {
  if (/trusted root/i.test(item)) return "trusted-root";
  if (/bundle/i.test(item)) return "bundle";
  if (/tarball|kit/i.test(item)) return "subject";
  return `unrecognised: ${item.trim()}`;
}
function commandFileKinds(text) {
  const kinds = new Set();
  if (/\s--bundle\s/.test(text)) kinds.add("bundle");
  if (/\s--custom-trusted-root\s/.test(text)) kinds.add("trusted-root");
  if (/^gh attestation verify \S+\.tgz\b/.test(text)) kinds.add("subject");
  return kinds;
}
/** The file claims of each step, and the problems where a claim and the step's offline command disagree. */
function fileClaimProblems(guideText) {
  const claims = [];
  const problems = [];
  for (const step of parseGuide(guideText)) {
    const prose = step.prose.join(" ").replace(/\s+/g, " ");
    for (const m of prose.matchAll(/\b(one|two|three|four|five|\d+) files? suffices?:?\s*([^.;]*)[.;]/gi)) {
      const n = NUMBERS[m[1].toLowerCase()] ?? Number(m[1]);
      const items = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).filter((s) => s.trim());
      const said = new Set(items.map(fileKind));
      claims.push({ step: step.id, n, said });
      const offline = step.blocks.flat().map((c) => forVersion(c.text, V)).filter((t) => /\s--bundle\s/.test(t));
      if (offline.length === 0) { problems.push(`Step ${step.id} says ${n} files suffice and has no offline command`); continue; }
      if (n !== items.length) problems.push(`Step ${step.id} says ${m[1]} files and lists ${items.length}`);
      for (const t of offline) {
        const named = commandFileKinds(t);
        const a = [...said].sort().join(", ");
        const b = [...named].sort().join(", ");
        if (a !== b || n !== named.size) problems.push(`Step ${step.id}: the prose says ${n} files suffice (${a}); the command names ${named.size} (${b})`);
      }
    }
  }
  return { claims, problems };
}

/** Rewrite one step of the guide only (the same flag appears in several steps). */
function editStep(text, id, fn) {
  const start = text.indexOf(`## Step ${id} — `);
  const end = text.indexOf("\n## ", start + 1);
  assert.ok(start >= 0, `the guide has a Step ${id}`);
  const section = text.slice(start, end);
  const edited = fn(section);
  assert.notEqual(edited, section, `the edit of Step ${id} changed something`);
  return text.slice(0, start) + edited + text.slice(end);
}

// ── the parity, on the tree ────────────────────────────────────────────────────────────────────
test("documented commands: the parse is not empty (extraction floor)", () => {
  const steps = parseGuide(GUIDE_TEXT);
  assert.deepEqual(steps.map((s) => s.id), ["0", "1", "2", "2c", "3", "4", "5", "6", "7", "8"]);
  assert.ok(steps.flatMap((s) => s.blocks.flat()).length >= 15, "the guide's blocks parsed into commands");
  const wf = workflowCommands(WORKFLOW_TEXT);
  assert.deepEqual([...wf.keys()].sort(), Object.keys(WORKFLOW_TO_GUIDE).sort());
  assert.ok([...wf.values()].flat().length >= 6, "the workflow's gh commands were extracted");
});

test("documented commands: the guide and verify-release.yml run the same commands, in both directions", () => {
  assert.deepEqual(parityProblems(GUIDE_TEXT, WORKFLOW_TEXT), []);
});

test("documented commands: every step of the guide is executed or declared not executed, with a reason", () => {
  const steps = parseGuide(GUIDE_TEXT);
  assert.deepEqual(classificationProblems(steps), []);
  for (const [id, why] of Object.entries(NOT_EXECUTED)) assert.ok(why.length > 20, `Step ${id} has a reason`);
  for (const id of EXECUTED) {
    const plan = executablePlan(steps.find((s) => s.id === id), "0.43.1");
    assert.ok(plan.length > 0, `Step ${id} yields commands`);
    if (OFFLINE_STEPS.includes(id)) assert.ok(plan.some((c) => c.offline), `Step ${id} has a command run with the network cut`);
  }
});

test("documented commands: the version substitution is declared, an undeclared example version is refused", () => {
  const steps = parseGuide(editStep(GUIDE_TEXT, "2c", (s) => s.replace("runward-0.33.5.tgz", "runward-0.33.9.tgz")));
  assert.throws(() => executablePlan(steps.find((s) => s.id === "2c"), "0.43.1"), /Step 2c: undeclared example version 0\.33\.9/);
});

// ── positive controls: each drift fails, naming its step ───────────────────────────────────────
test("documented commands, control: dropping --custom-trusted-root from Step 3 fails, naming Step 3", () => {
  const seeded = editStep(GUIDE_TEXT, "3", (s) => s.replace(" --custom-trusted-root trusted-root.jsonl", ""));
  const problems = parityProblems(seeded, WORKFLOW_TEXT);
  assert.ok(problems.some((p) => p.includes("Step 3") && p.includes("does not document")), problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("Step 3") && p.includes("does not run")), problems.join("\n"));
});

test("documented commands, control: changing the flags of Step 2c fails, naming Step 2c", () => {
  const signer = editStep(GUIDE_TEXT, "2c", (s) => s.replace("workflows/build-and-attest.yml", "workflows/release.yml"));
  assert.ok(parityProblems(signer, WORKFLOW_TEXT).some((p) => p.includes("Step 2c")));
  const dropped = editStep(GUIDE_TEXT, "2c", (s) => s.replace("--predicate-type https://slsa.dev/provenance/v1 \\\n  ", ""));
  assert.ok(parityProblems(dropped, WORKFLOW_TEXT).some((p) => p.includes("Step 2c")));
});

test("documented commands, control: a drift on the workflow side fails too, naming the workflow step", () => {
  const wf = WORKFLOW_TEXT.replace(
    /("Step 2b[^\n]*\n(?:[^\n]*\n)*?\s*)--predicate-type https:\/\/slsa\.dev\/provenance\/v1/,
    "$1--predicate-type https://cyclonedx.org/bom/v2");
  assert.notEqual(wf, WORKFLOW_TEXT);
  assert.ok(parityProblems(GUIDE_TEXT, wf).some((p) => p.startsWith("Step 2b of")));
  const added = WORKFLOW_TEXT.replace('      - name: "Negative control',
    '      - name: "Step 4 — cosign"\n        run: cosign version\n\n      - name: "Negative control');
  assert.ok(parityProblems(GUIDE_TEXT, added).some((p) => p.startsWith("Step 4 of") && p.includes("not declared")));
});

// ── the narrow prose check, and what it does not reach ──────────────────────────────────────────
test("documented commands: each 'N files suffice' claim matches the files the offline command names", () => {
  const { claims, problems } = fileClaimProblems(GUIDE_TEXT);
  assert.ok(claims.some((c) => c.step === "3" && c.n === 3), "the Step 3 claim was found (extraction floor)");
  assert.deepEqual(problems, []);
});

test("documented commands, control: Step 3's claim rewritten to two files, the trusted root dropped, fails", () => {
  const seeded = GUIDE_TEXT.replace(
    "Three files suffice: the tarball, the bundle attached to\nthe release, and a pre-fetched trusted root.",
    "Two files suffice: the tarball and the bundle attached to\nthe release; the trusted root is not needed offline.");
  assert.notEqual(seeded, GUIDE_TEXT);
  assert.ok(fileClaimProblems(seeded).problems.some((p) => p.startsWith("Step 3:")));
  assert.deepEqual(parityProblems(seeded, WORKFLOW_TEXT), [], "the parity alone does not see a prose change");
});

test("documented commands, blind spot: a sentence-only change that keeps the commands and the claim passes", () => {
  // Pinned on purpose: this is what M6 does not catch (ADR-0090 decision 5). If a later check starts
  // catching it, this test fails and the record of the blind spot must be updated with it.
  const seeded = editStep(GUIDE_TEXT, "3", (s) => s.replace(
    "Verified exit 0 with all traffic blocked.",
    "Verified exit 0 with all traffic blocked. Offline, the trusted root is not needed."));
  assert.deepEqual(parityProblems(seeded, WORKFLOW_TEXT), []);
  assert.deepEqual(fileClaimProblems(seeded).problems, []);
});
