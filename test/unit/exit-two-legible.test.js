// ADR-0083, option A (accepted 2026-09-28): exit 2 keeps its value for every case, and says which
// case it was. Two halves:
//   - the shipped samples say what the port contract says (RWD-2026-0157): "2 no mission, a usage
//     error or a refused gesture: the question could not be asked, never a red gate";
//   - a `--json` run that exits 2 prints one document carrying a stable `error` class
//     (`no-mission` | `usage` | `refused` | `unreadable-input`), beside the `verdict`/`reason` a
//     document already carried, which keep their values (ADR-0030).
// Every JSON assertion parses the WHOLE of stdout: a stray human line fails it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-28" };
for (const k of ["CLAUDECODE", "GEMINI_CLI", "CURSOR_AGENT", "FORCE_COLOR"]) delete ENV[k];
const run = (cwd, a, env = ENV) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env });
const CLASSES = ["no-mission", "usage", "refused", "unreadable-input"];

/** exit 2, and stdout is exactly one JSON document naming `error`. */
function two(cwd, a, env) {
  const r = run(cwd, a, env);
  assert.equal(r.status, 2, `${a.join(" ")}: ${r.stderr}`);
  let doc;
  assert.doesNotThrow(() => { doc = JSON.parse(r.stdout); }, `${a.join(" ")}: stdout is one JSON document: ${JSON.stringify(r.stdout.slice(0, 200))}`);
  assert.ok(CLASSES.includes(doc.error), `${a.join(" ")}: error=${doc.error}`);
  assert.equal(doc.exitCode, 2);
  return doc;
}
const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const clean = (d) => rmSync(d, { recursive: true, force: true });
function mission() {
  const dir = tmp("rw-exit2-");
  const r = run(dir, ["--yes", "init"]);
  assert.ok(r.status === 0 || r.status === 1, r.stderr);
  return dir;
}

// ── RWD-2026-0157: the samples ────────────────────────────────────────────────────────────────
const SAMPLES = [
  "action.yml", "templates/adapters/github-actions.yml", "templates/adapters/gitlab-ci.yml",
  "templates/adapters/pre-commit", "templates/adapters/bmad-review-layer.toml",
  "templates/adapters/claude-code-settings.json", "packaging/README.md", "packaging/kiro/POWER.md",
  "docs/distribution.md",
];

test("RWD-2026-0157: every shipped sample that prints the exit codes says 2 is never a red gate, and not only 'no mission'", () => {
  for (const f of SAMPLES) {
    const text = readFileSync(join(ROOT, f), "utf8").replace(/\s+/g, " ");
    assert.match(text, /a usage error or a refused gesture/, `${f} names the usage error and the refused gesture`);
    assert.match(text, /never a red gate/, `${f} says exit 2 is never a red gate`);
    assert.doesNotMatch(text, /2 no mission found\.|2 no mission found —|`2` no mission\)|2 no mission\./, `${f} no longer reads 2 as "no mission" alone`);
  }
  // The one sample that ACTED on 2 as "no mission": skip the layer. It now skips only without a mission.
  const bmad = readFileSync(join(ROOT, "templates/adapters/bmad-review-layer.toml"), "utf8");
  assert.doesNotMatch(bmad, /exit 2 → no runward\/ mission here; skip this layer/);
  assert.match(bmad, /exit 2 → the question could not be asked, never a red gate/);
});

// ── ADR-0083 decision 2: the `error` class, one test per class ────────────────────────────────
test("exit 2 legible: no-mission, additive beside the verdict/reason each document already carried", () => {
  const empty = tmp("rw-exit2-none-");
  try {
    for (const a of [["check", "--json"], ["status", "--json"], ["manifest", "--json"], ["propose", "--json"],
      ["report", "--json"], ["compliance", "iso-42001", "--json"], ["ratify", "--list", "--json"]]) {
      const doc = two(empty, a);
      assert.equal(doc.error, "no-mission", a.join(" "));
      assert.equal(doc.verdict, "no-mission", `${a.join(" ")}: verdict keeps its value`);
      assert.equal(doc.mission, null);
    }
    // verify reaches the mission only after reading the attestation: give it one it can read.
    const dir = mission();
    try {
      const att = run(dir, ["check", "--attest"]).stdout;
      writeFileSync(join(empty, "att.json"), att);
    } finally { clean(dir); }
    const v = two(empty, ["verify", "att.json", "--json"]);
    assert.equal(v.error, "no-mission");
    assert.equal(v.reason, "no-mission", "reason keeps its value");
    assert.equal(v.verified, false);
  } finally { clean(empty); }
});

test("exit 2 legible: usage, from Commander and from each command's own refusals", () => {
  const empty = tmp("rw-exit2-usage-");
  try {
    for (const a of [
      ["check", "--json", "--bogus"], ["status", "--json", "--bogus"], ["doctor", "--json", "--bogus"],
      ["wire", "--json", "--bogus"], ["spec-check", "--json"], ["check", "--json", "--through", "topology"],
      ["check", "--json", "--through", "floor", "--freeze"], ["rules", "--json", "--phase", "Govern"],
      ["rules", "--json", "--for", "/abs"], ["explain", "no-such-rule", "--json"], ["compliance", "--json"],
      ["compliance", "bogus", "--json"],
    ]) {
      const doc = two(empty, a);
      assert.equal(doc.error, "usage", a.join(" "));
      assert.equal(typeof doc.message, "string");
      assert.ok(doc.message.length > 0 && !/\u001b\[/.test(doc.message), `${a.join(" ")}: a plain sentence`);
    }
  } finally { clean(empty); }
  const dir = mission();
  try {
    assert.equal(two(dir, ["report", "--json", "--out", "../outside.html"]).error, "usage");
    assert.equal(two(dir, ["ratify", "--list", "--json", "--by", " "]).error, "usage");
  } finally { clean(dir); }
});

test("exit 2 legible: refused, for the gestures runward will not perform here", () => {
  const dir = mission();
  try {
    const agent = two(dir, ["ratify", "--list", "--json", "--agent", "bot"]);
    assert.equal(agent.error, "refused");
    assert.match(agent.message, /--agent and --for go together/);
    writeFileSync(join(dir, "notes.html"), "<p>mine</p>");
    assert.equal(two(dir, ["report", "--json", "--out", "notes.html"]).error, "refused");
    assert.equal(readFileSync(join(dir, "notes.html"), "utf8"), "<p>mine</p>", "nothing overwritten");
    const w = two(dir, ["wire", "--install", "--json"], { ...ENV, CLAUDECODE: "1" });
    assert.equal(w.error, "refused");
    assert.match(w.message, /agent harness/);
  } finally { clean(dir); }
});

test("exit 2 legible: unreadable-input, beside the reason/verdict verify and spec-check already name", () => {
  const empty = tmp("rw-exit2-input-");
  try {
    const v = two(empty, ["verify", "absent.json", "--json"]);
    assert.equal(v.error, "unreadable-input");
    assert.equal(v.reason, "attestation-not-found");
    writeFileSync(join(empty, "bad.json"), "not json");
    assert.equal(two(empty, ["verify", "bad.json", "--json"]).reason, "attestation-not-json");
    const s = two(empty, ["spec-check", "absent.md", "--json"]);
    assert.equal(s.error, "unreadable-input");
    assert.equal(s.verdict, "no-spec");
    writeFileSync(join(empty, "spec.md"), "# A spec\n\nNo criteria here.\n");
    const n = two(empty, ["spec-check", "spec.md", "--json"]);
    assert.deepEqual([n.error, n.verdict], ["unreadable-input", "no-criteria"]);
  } finally { clean(empty); }
});

test("exit 2 legible: no document where only --json owns one, and none without --json", () => {
  const empty = tmp("rw-exit2-quiet-");
  try {
    for (const a of [["check", "--json", "--sarif"], ["check", "--sarif"], ["check", "--bogus"], ["status"], ["bundle", "--json"]]) {
      const r = run(empty, a);
      assert.equal(r.status, 2, a.join(" "));
      assert.equal(r.stdout, "", `${a.join(" ")}: stdout stays empty`);
    }
  } finally { clean(empty); }
});
