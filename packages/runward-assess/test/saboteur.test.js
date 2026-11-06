// saboteur@1: the corpus is pinned, its code and its data agree, and it measures (a gate that says
// yes to everything is caught missing every sabotage).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CASES, CORPUS_DIR, IMPLEMENTED, payload, render, runExampleCorpus, summarise } from "../src/saboteur.js";
import { sha256 } from "../src/canon.js";
import { PKG } from "./helpers.js";

test("every payload renders to the digest saboteur@1 pins, and a changed template is refused", () => {
  for (const name of Object.keys(CASES.payloads)) assert.equal(sha256(payload(name)), CASES.payloads[name], name);
  const t = readFileSync(join(CORPUS_DIR, "payloads", "guard.pg.ts.tmpl"), "utf8");
  assert.notEqual(sha256(render(t.replace("guardFields", "guardField"))), CASES.payloads["guard.pg.ts"], "positive control: one changed character changes the digest");
  for (const f of readdirSync(join(CORPUS_DIR, "payloads"))) assert.ok(!/sk-live-[A-Z]/.test(readFileSync(join(CORPUS_DIR, "payloads", f), "utf8")), `${f} spells no credential: it is assembled at run time`);
});

test("the catalogue's data and its code name the same cases, each with an expectation", () => {
  const ids = (corpus) => CASES.cases.filter((c) => c.corpus === corpus).map((c) => c.id).sort();
  assert.deepEqual(ids("example"), IMPLEMENTED.example);
  assert.deepEqual(ids("mission"), IMPLEMENTED.mission);
  for (const c of CASES.cases) assert.ok(["refuse", "pass", "invariant"].includes(c.expect), `${c.id} expects ${c.expect}`);
  assert.equal(new Set(CASES.cases.map((c) => c.id)).size, CASES.cases.length, "no identifier twice");
  assert.ok(CASES.cases.some((c) => c.id === "T14" && c.command === "verify"), "T14: the fields verify accepts forged");
  assert.ok(CASES.cases.some((c) => c.id === "T15" && c.expect === "invariant"), "T15: the verdict that depends on the Node.js release");
});

test("the frozen observations cover every case for every gate version they name", () => {
  const exp = JSON.parse(readFileSync(join(CORPUS_DIR, "expected.json"), "utf8"));
  const versions = Object.keys(exp.observed);
  assert.ok(versions.length >= 3, `at least three gate versions frozen (${versions.join(", ")})`);
  for (const v of versions) for (const c of CASES.cases) for (const mode of c.corpus === "example" ? ["N", "S"] : ["N"]) {
    if (c.corpus === "mission") continue; // a mission case depends on the repository, frozen per trial
    assert.ok(exp.observed[v][`${c.id}/${mode}`], `${v}: ${c.id}/${mode} has a frozen observation`);
  }
});

const ROOT_CLI = process.env.RUNWARD_ASSESS_GATE_CLI ?? resolve(PKG, "..", "..", "dist", "cli.js");
test("against a real gate: the healthy mission and the legitimate rename stay green, an emptied ADR is caught; a gate that always says yes misses every sabotage", { skip: existsSync(ROOT_CLI) ? false : `no runward CLI at ${ROOT_CLI}: build the repository (npm run build) or set RUNWARD_ASSESS_GATE_CLI` }, () => {
  const work = mkdtempSync(join(tmpdir(), "runward-assess-sab-"));
  try {
    const real = runExampleCorpus(ROOT_CLI, join(work, "real"));
    const st = (id, mode) => real.cases.find((c) => c.id === id && c.mode === mode).status;
    assert.equal(st("T00", "N"), "green");
    assert.equal(st("T11", "N"), "green", "a legitimate rename is no false red");
    assert.equal(st("T09", "N"), "caught", "an emptied cited ADR is refused");
    for (const c of real.cases) assert.ok(["green", "false-red", "caught", "missed", "invariant", "divergent", "error", "not-applicable"].includes(c.status), `${c.id}/${c.mode}: ${c.status}`);
    // positive control: the same corpus, a gate that delegates init and answers yes to every check
    const fake = join(work, "yes-gate.mjs");
    writeFileSync(fake, `import { spawnSync } from "node:child_process";\nconst a = process.argv.slice(2);\nif (a[0] === "init") { const r = spawnSync(process.execPath, [${JSON.stringify(ROOT_CLI)}, ...a], { stdio: "inherit" }); process.exit(r.status ?? 1); }\nif (a[0] === "check" && a.includes("--attest")) { process.stdout.write(JSON.stringify({ predicate: { verdict: "clean" } })); }\nprocess.exit(0);\n`);
    const yes = runExampleCorpus(fake, join(work, "yes"));
    const s = summarise(yes, null);
    assert.equal(s.caught, 0, "a gate that always says yes catches nothing");
    assert.ok(s.run >= 10, `and the corpus ran its sabotages against it (${s.run})`);
    assert.equal(yes.cases.find((c) => c.id === "T14").status, "error", "T14 cannot conclude when even its control passes");
  } finally { rmSync(work, { recursive: true, force: true }); }
});
