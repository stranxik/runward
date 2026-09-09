// The delivery report (ADR-0064) — the assessor's document, held to the ADR's own two settling
// halves that a test can hold: byte-identical across two runs on one tree, and stating NOTHING
// `check --strict --json` does not carry (the counts in the HTML are the payload's counts).
// The third half — an external reader answering the five questions without the repository —
// belongs to the pilot, and the ADR says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-09" };
const run = (cwd, ...a) => execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] });

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-report-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "init", "--yes", "--example");
  return dir;
}

test("the report is written, self-contained, and answers the five questions in order", () => {
  const dir = example();
  try {
    run(dir, "report");
    const out = join(dir, "runward", "governance", "delivery-report.html");
    assert.ok(existsSync(out));
    const html = readFileSync(out, "utf8");
    // Self-contained: no external request of any kind can be needed to read it.
    assert.doesNotMatch(html, /<script/i, "no script — the document must say the same thing in five years");
    assert.doesNotMatch(html, /(src|href)\s*=\s*["']https?:/i, "no external asset or stylesheet");
    // The five questions, in the ADR's order.
    for (const q of ["Where this mission stands", "What is proven, and by what", "What is deferred, and why",
      "What the gate does not cover", "Re-derive this yourself"]) {
      assert.ok(html.includes(q), `the section "${q}" is present`);
    }
    // The non-scope is verbatim (its opening words, escaped as the document escapes).
    const nonScope = JSON.parse(run(dir, "check", "--strict", "--json")).gateNonScope;
    assert.ok(html.includes(String(nonScope).slice(0, 60).replace(/&/g, "&amp;").replace(/</g, "&lt;")),
      "GATE_NON_SCOPE opens verbatim in section 4");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("byte-identical across two runs on one tree — the ADR's cheap settling half", () => {
  const dir = example();
  try {
    run(dir, "report");
    const out = join(dir, "runward", "governance", "delivery-report.html");
    const first = readFileSync(out, "utf8");
    run(dir, "report");
    assert.equal(readFileSync(out, "utf8"), first);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the report states the payload's counts — a rendering that computed would be a second verdict", () => {
  const dir = example();
  try {
    const p = JSON.parse(run(dir, "check", "--strict", "--json"));
    run(dir, "report");
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.ok(html.includes(p.verdict === "clean" ? ">CLEAN<" : ">GAPS<"), "the verdict word is the payload's");
    assert.ok(html.includes(`${p.evidence.rows} manifest row(s): ${p.evidence.applied} applied`),
      "the evidence counts are the payload's, field for field");
    assert.ok(html.includes(`runward ${p.runward}`), "the version is the payload's");
    assert.ok(html.includes(`npx runward@${p.runward} check --strict --json`),
      "section 5 hands the reader the exact re-derivation command");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a red mission's report says GAPS and lists the violations — exit stays 0, the document IS the point", () => {
  const dir = example();
  try {
    const guard = join(dir, "code", "src", "core", "domain", "guard.ts");
    readFileSync(guard, "utf8"); // exists
    execFileSync("node", ["-e", `
      const fs = require("node:fs");
      const p = ${JSON.stringify(guard)};
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/guardFields/g, "renamedAway"));
    `], { encoding: "utf8" });
    run(dir, "report"); // must not throw: exit 0 on a red mission
    const html = readFileSync(join(dir, "runward", "governance", "delivery-report.html"), "utf8");
    assert.ok(html.includes(">GAPS<"), "red is said as red");
    assert.match(html, /typed pointer|not found in the file/, "the open violations are listed for the assessor");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
