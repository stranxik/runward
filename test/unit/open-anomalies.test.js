// `scripts/open-anomalies.mjs` lists, for one version, the register entries affected at or before it
// and not fixed at or before it (ADR-0087, decision 6). The boundaries are the whole of the logic, so
// they are pinned on both sides: fixed AT the version is closed, fixed one release later is open,
// affected FROM the version is open, affected from the next one is not. An entry the register cannot
// place for that version is reported apart, never folded into either answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readRegister, openAnomalies, compareVersions, REGISTER } from "../../scripts/open-anomalies.mjs";

const table = (rows) => "| id | Defect | Workaround |\n|---|---|---|\n" +
  rows.map(([id, a, f]) => `| RWD-2026-${id} | \`affected-from=${a}\` \`fixed-in=${f}\` · Entry ${id}. More. | do ${id} |`).join("\n") + "\n";
const ids = (list) => list.map((e) => e.id.slice(-4));

test("versions compare numerically, not as text", () => {
  assert.ok(compareVersions("0.10.0", "0.9.1") > 0);
  assert.ok(compareVersions("0.42.2", "0.42.3") < 0);
  assert.equal(compareVersions("0.33.1", "0.33.1"), 0);
});

test("the boundaries: fixed at the version is closed, affected from it is open", () => {
  const entries = readRegister(table([
    ["0001", "0.32.0", "0.37.0"], // affected before, fixed after: open
    ["0002", "0.32.0", "0.36.2"], // fixed AT the version: closed
    ["0003", "0.36.2", "0.42.3"], // affected FROM the version: open
    ["0004", "0.37.0", "0.42.3"], // affected only from the next release: not listed
    ["0005", "0.30.0", "not-fixed"], // never fixed: open
    ["0006", "0.30.0", "unreleased"], // fixed in the tree only: open
    ["0007", "none", "not-applicable"], // no release carried it: never listed
    ["0008", "unknown", "0.37.0"], // cannot be placed: undetermined
    ["0009", "unknown", "0.32.0"], // fixed before the version even if its start is unknown: closed
    ["0010", "0.33.0", "unknown"], // started before, end unknown: undetermined
    ["0011", "none", "0.33.0"], // unguarded, never a defect of a release: never listed
  ]));
  const r = openAnomalies(entries, "0.36.2");
  assert.deepEqual(ids(r.open), ["0001", "0003", "0005", "0006"]);
  assert.deepEqual(ids(r.undetermined), ["0008", "0010"]);
  assert.equal(r.open[0].workaround, "do 0001");
  assert.equal(r.open[0].summary, "Entry 0001.");
});

test("a version that is not X.Y.Z is refused rather than compared", () => {
  assert.throws(() => openAnomalies([], "0.42"), /not a version/);
  assert.throws(() => openAnomalies([], "latest"), /not a version/);
});

test("on the real register: nothing listed for a version is fixed at or before it, or affected only after it", () => {
  const text = readFileSync(REGISTER, "utf8");
  const entries = readRegister(text);
  const describes = text.match(/\*\*Describes\*\*: runward (\S+)/)[1];
  for (const v of ["0.32.0", "0.36.2", "0.40.0", "0.42.2", describes]) {
    const { open, undetermined } = openAnomalies(entries, v);
    for (const e of [...open, ...undetermined]) {
      assert.notEqual(e.affectedFrom, "none", `${e.id} is listed for ${v} while no release carried it`);
      if (/^\d/.test(e.fixedIn)) assert.ok(compareVersions(e.fixedIn, v) > 0, `${e.id} is listed for ${v} but fixed in ${e.fixedIn}`);
      if (/^\d/.test(e.affectedFrom)) assert.ok(compareVersions(e.affectedFrom, v) <= 0, `${e.id} is listed for ${v} but affected only from ${e.affectedFrom}`);
    }
  }
  // Sensitivity: the version before a release that fixed many entries lists them all.
  const before = openAnomalies(entries, "0.42.2").open.length;
  const fixedIn0423 = entries.filter((e) => e.fixedIn === "0.42.3" && /^\d/.test(e.affectedFrom) && compareVersions(e.affectedFrom, "0.42.2") <= 0).length;
  assert.ok(fixedIn0423 > 0 && before >= fixedIn0423, `0.42.2 lists ${before} open, ${fixedIn0423} were fixed in 0.42.3`);
  assert.equal(openAnomalies(entries, describes).open.filter((e) => e.fixedIn === describes).length, 0);
});

test("the script answers on the command line, in text and JSON, and refuses a malformed version with exit 2", () => {
  const script = fileURLToPath(new URL("../../scripts/open-anomalies.mjs", import.meta.url));
  const json = JSON.parse(execFileSync(process.execPath, [script, "0.42.2", "--json"], { encoding: "utf8" }));
  assert.equal(json.version, "0.42.2");
  assert.ok(Array.isArray(json.open) && json.open.length > 0 && Array.isArray(json.undetermined));
  assert.ok(json.open.every((e) => /^RWD-\d{4}-\d{4}$/.test(e.id) && "workaround" in e));
  const text = execFileSync(process.execPath, [script, "0.42.2"], { encoding: "utf8" });
  assert.match(text, /^runward 0\.42\.2: \d+ open, \d+ undetermined/);
  let code = 0;
  try { execFileSync(process.execPath, [script, "next"], { stdio: "pipe" }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});
