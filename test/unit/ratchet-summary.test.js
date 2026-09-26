// ADR-0079: a release keeps a signed summary of its mutation ratchet. The workflow signs; this pins
// what it signs. A red run is summarised exactly like a green one, a module that never answered is
// named rather than dropped, and each merged report is identified by its SHA-256.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "ratchet-summary.mjs");
const perimeter = JSON.parse(readFileSync(join(ROOT, "stryker.config.json"), "utf8")).mutate
  .map((e) => e.replace(/:.*$/, "").replace(/^.*\//, "").replace(/\.js$/, ""));

function run(answers, merged) {
  const dir = mkdtempSync(join(tmpdir(), "rw-ratchet-summary-"));
  const a = join(dir, "answers"), m = join(dir, "merged");
  for (const [mod, exit] of Object.entries(answers)) {
    mkdirSync(join(a, `answer-${mod}`), { recursive: true });
    writeFileSync(join(a, `answer-${mod}`, `${mod}-answer.json`), JSON.stringify({ module: mod, exit, chunksExpected: 2, chunksMeasured: 2 }));
  }
  const bytes = {};
  for (const [mod, statuses] of Object.entries(merged)) {
    mkdirSync(join(m, `merged-${mod}`), { recursive: true });
    const text = JSON.stringify({ files: { [`dist/lib/${mod}.js`]: { mutants: statuses.map((status) => ({ status })) } } });
    writeFileSync(join(m, `merged-${mod}`, `${mod}-merged.json`), text);
    bytes[mod] = text;
  }
  const out = join(dir, "summary.json");
  execFileSync(process.execPath, [SCRIPT, "--merged", m, "--answers", a, "--out", out], {
    cwd: ROOT, stdio: "pipe", env: { ...process.env, GITHUB_SHA: "c0ffee", GITHUB_RUN_ID: "42", GITHUB_EVENT_NAME: "release" },
  });
  const summary = JSON.parse(readFileSync(out, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return { summary, bytes };
}

test("ADR-0079: every module answering 'describes' is the only green verdict", () => {
  const answers = Object.fromEntries(perimeter.map((m) => [m, 0]));
  const { summary } = run(answers, {});
  assert.equal(summary.verdict, "the register describes this tree");
  assert.equal(summary.modules.length, perimeter.length);
  assert.equal(summary.commit, "c0ffee");
  assert.deepEqual(summary.run, { id: "42", attempt: summary.run.attempt });
});

test("ADR-0079: a mismatch, a refusal or a silent module makes the run refused, and each is named", () => {
  const [first, second, third] = perimeter;
  const answers = Object.fromEntries(perimeter.map((m) => [m, 0]));
  answers[first] = 1;
  answers[second] = 2;
  delete answers[third];
  const { summary } = run(answers, {});
  assert.equal(summary.verdict, "refused");
  const by = Object.fromEntries(summary.modules.map((m) => [m.module, m.answer]));
  assert.equal(by[first], "mismatch");
  assert.equal(by[second], "refused");
  assert.equal(by[third], "no answer", "a module that never answered is named, never dropped");
});

test("ADR-0079: a merged report is identified by its SHA-256 and its survivors counted", () => {
  const mod = perimeter[0];
  const { summary, bytes } = run({ [mod]: 0 }, { [mod]: ["Killed", "Survived", "NoCoverage", "Timeout"] });
  const m = summary.modules.find((x) => x.module === mod);
  assert.equal(m.mergedReportSha256, createHash("sha256").update(bytes[mod]).digest("hex"));
  assert.equal(m.survivorsMeasured, 2, "Survived and NoCoverage are survivors; Killed and Timeout are not");
  assert.ok(Number.isInteger(m.survivorsFiled));
});
