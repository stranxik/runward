// The same snapshot and measure, scored under two time zones, two locales and two runtimes, give the
// same bytes: the record, the Markdown and the HTML. Each varied axis is proved live first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { canonJSON, sha256 } from "../src/canon.js";
import { digestOf } from "../src/grid-model.js";
import { inputs, BIN, PKG } from "./helpers.js";

/** Writes a measure, a profile and a snapshot directory (with its hashed manifest) to disk. */
function materialise(dir, { measure, snapshot, profile }) {
  mkdirSync(join(dir, "snap"), { recursive: true });
  const entries = [];
  for (const [rel, v] of [["facts.json", snapshot.facts], ["profile-evidence.json", snapshot.profileEvidence]]) {
    const t = canonJSON(v); writeFileSync(join(dir, "snap", rel), t); entries.push({ bytes: Buffer.byteLength(t), path: rel, sha256: sha256(t) });
  }
  writeFileSync(join(dir, "snap", "manifest.json"), canonJSON({ ...snapshot.manifest, entries, profileDigest: digestOf(profile) }));
  writeFileSync(join(dir, "measure.json"), canonJSON({ ...measure, profileDigest: digestOf(profile) }));
  writeFileSync(join(dir, "profile.json"), JSON.stringify(profile));
  return { measure: join(dir, "measure.json"), profile: join(dir, "profile.json"), snapshot: join(dir, "snap") };
}

const ALT = process.env.RUNWARD_ASSESS_ALT_NODE ?? null;
const FX = JSON.parse(readFileSync(join(PKG, "test", "fixtures", "criteria.json"), "utf8")).criteria;

test("the environment axes the self-test varies are live: they do change locale- and zone-dependent output", () => {
  const probe = (env, node = process.execPath) => spawnSync(node, ["-e", "process.stdout.write([new Date(0).toLocaleString(), Intl.DateTimeFormat().resolvedOptions().timeZone, process.version].join('|'))"], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } }).stdout;
  const a = probe({ TZ: "UTC", LC_ALL: "C", LANG: "C" });
  const b = probe({ TZ: "Pacific/Kiritimati", LC_ALL: "fr_FR.UTF-8", LANG: "fr_FR.UTF-8" });
  assert.notEqual(a.split("|")[0], b.split("|")[0], "a naive renderer would differ between the two");
  assert.notEqual(a.split("|")[1], b.split("|")[1]);
  if (ALT) assert.notEqual(probe({ TZ: "UTC" }, ALT).split("|")[2], a.split("|")[2], "the second runtime is another Node.js release");
});

test(`selftest: two zones, two locales${ALT ? ", two runtimes" : ""}, byte-identical record, Markdown and HTML`, () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-assess-det-"));
  try {
    const facts = Object.fromEntries(Object.values(FX).flatMap((f) => Object.entries(f.held)));
    const files = materialise(dir, inputs({ facts }));
    const args = [BIN, "selftest", "--measure", files.measure, "--profile", files.profile, "--snapshot", files.snapshot];
    if (ALT) args.push("--alt-node", ALT);
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /byte-identical record, Markdown and HTML/);
    const digests = [...r.stdout.matchAll(/record ([0-9a-f]{64})/g)].map((m) => m[1]);
    assert.ok(digests.length >= 2 && new Set(digests).size === 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the comparison is not vacuous: one differing digest, or a single run, is not the same", async () => {
  const { sameOutputs } = await import("../src/selftest.js");
  const row = { html: "c", md: "b", record: "a" };
  assert.equal(sameOutputs([row, { ...row }]), true);
  assert.equal(sameOutputs([row, { ...row, html: "d" }]), false, "one differing HTML byte fails the self-test");
  assert.equal(sameOutputs([row]), false, "one run proves nothing");
});

test("the self-test fails when a run fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "runward-assess-det-"));
  try {
    const files = materialise(dir, inputs({ facts: { "m.gou04.absence_factor": 1 } }));
    // a profile that does not match the measure makes every run fail: the self-test must not pass
    writeFileSync(files.profile, JSON.stringify({ schema: "runward-assess-profile/1", profiles: ["W"], facts: {} }));
    const r = spawnSync(process.execPath, [BIN, "selftest", "--measure", files.measure, "--profile", files.profile, "--snapshot", files.snapshot], { encoding: "utf8" });
    assert.notEqual(r.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const TRIAL = join(PKG, "trials", "runward", "main");
test("selftest on the committed runward trial inputs reproduces the committed record", { skip: existsSync(join(TRIAL, "measure.json")) ? false : "no committed trial inputs" }, () => {
  const rec = JSON.parse(readFileSync(join(TRIAL, "record.json"), "utf8"));
  const args = [BIN, "selftest", "--measure", join(TRIAL, "measure.json"), "--profile", join(PKG, "trials", "runward", "profile.json"), "--snapshot", join(TRIAL, "snapshot"),
    "--label", rec.subject.label, "--trigger", rec.trigger, "--previous", join(PKG, "trials", "runward", "v0.46.0", "record.json")];
  if (ALT) args.push("--alt-node", ALT);
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const committed = sha256(readFileSync(join(TRIAL, "record.json")));
  assert.ok(r.stdout.includes(`record ${committed}`), "the scores reproduce the committed record, byte for byte");
});
