// The family killer (consolidated mutation pass, 2026-09-02).
//
// The STRUCTURE registry is hundreds of regexes, literals and closed lists, and the measured pass
// showed what that costs unpinned: 683 surviving mutants on mission.js, most of them one loosened
// shape or one emptied literal deep inside a spec. Instructing them one by one would be a
// catalogue; pinning them is ONE property, stated twice per spec element:
//   - the calibrated exemplar (the shipped example mission) yields ZERO violations — a mutant that
//     TIGHTENS any shape reddens here;
//   - a canonical degradation of that same exemplar yields the NAMED violation — a mutant that
//     LOOSENS or empties the shape lets the degradation pass and reddens here.
// Everything is driven off the live registry: a spec added tomorrow is pinned tomorrow, with no
// edit to this file. rowRules and conditions are opaque functions and stay owned by the dedicated
// structure-contract tests; this file covers sections, fields, domains and echoes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STRUCTURE, PHASES, structureViolations } from "../../dist/lib/mission.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sectionRe = (name) => new RegExp(`^(#{2,3} ${esc(name)})\\s*$`, "m");

// The fields whose shape genuinely accepts anything (checked by the assertion below, on the
// delivered build, at load time — so this list can never silently drift from the registry).
const FREE_FIELDS = new Set(["framing.md·Metric"]);

const REL = Object.fromEntries(
  PHASES.flatMap((p) => p.artifacts).filter((a) => a.templateKey).map((a) => [a.templateKey, a.relPath]));

// Both directions, or the allowlist rots: every listed field is genuinely free on the delivered
// build, and no unlisted field is. A mutant tightening a free field, or a spec edit freeing a new
// one, reddens here — by name.
for (const [k, spec] of Object.entries(STRUCTURE)) {
  for (const f of spec.fields ?? []) {
    const free = f.shape.test("@@invalid@@ x");
    const listed = FREE_FIELDS.has(`${k}·${f.name}`);
    assert.equal(free, listed,
      `${k}·${f.name}: shape ${free ? "accepts" : "refuses"} anything but the FREE_FIELDS allowlist says ${listed ? "free" : "constrained"}`);
  }
}

let dir, mission;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "rw-param-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  execFileSync("node", [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe", env: { ...process.env, RUNWARD_YES: "1" } });
  mission = join(dir, "runward");
});
after(() => rmSync(dir, { recursive: true, force: true }));

for (const [key, spec] of Object.entries(STRUCTURE)) {
  test(`${key}: the exemplar is clean, and every declared shape catches its canonical degradation`, () => {
    const content = readFileSync(join(mission, REL[key]), "utf8");
    assert.deepEqual(structureViolations(mission, content, spec), [],
      "the shipped example passes its own spec — a tightened shape reddens this line");

    for (const sec of spec.sections ?? []) {
      assert.match(content, sectionRe(sec), `the exemplar carries section "${sec}" — otherwise the degradation below degrades nothing`);
      const v = structureViolations(mission, content.replace(sectionRe(sec), "$1 tampered"), spec);
      assert.ok(v.some((x) => x.cause === "missing-section" && x.detail.includes(sec)),
        `renaming section "${sec}" must be caught, and the violation must name it`);
    }

    for (const f of spec.fields ?? []) {
      // STATIC allowlist, never `f.shape.test(...)`: deciding whether to test the shape by asking
      // the shape is the self-reference this file's own positive control caught blind — a mutant
      // that loosens the shape to accept-everything would also flip the decision to "skip".
      if (FREE_FIELDS.has(`${key}·${f.name}`)) continue;
      const re = new RegExp(`(\\*\\*${esc(f.name)}\\*\\*\\s*:\\s*)([^·\\n]+)`);
      const m = content.match(re);
      if (!m || /^\[[^\]]*\]/.test(m[2].trim())) continue; // absent or still placeholder in the exemplar: nothing to degrade
      const v = structureViolations(mission, content.replace(re, "$1@@invalid@@ "), spec);
      assert.ok(v.some((x) => x.cause === "invalid-field" && x.detail.includes(f.name)),
        `corrupting field "${f.name}" must be caught, and the violation must name the field`);
      // Second degradation, brackets INSIDE the value: the placeholder skip is anchored (^\[),
      // and a mutant that drops the anchor turns "any brackets anywhere" into a skip — measured
      // blind on the first version of this file.
      const v2 = structureViolations(mission, content.replace(re, "$1@@invalid@@ [tampered] "), spec);
      assert.ok(v2.some((x) => x.cause === "invalid-field" && x.detail.includes(f.name)),
        `brackets inside an invalid value for "${f.name}" are not a placeholder — the skip is prefix-anchored`);
    }

    for (const d of spec.domains ?? []) {
      // Degrade the FIRST data row whose judged cell is real (non-empty, non-placeholder) — the
      // same row the checker itself would judge. Walked with the checker's own state machine.
      const lines = content.split("\n");
      const start = lines.findIndex((l) => sectionRe(d.section).test(l));
      if (start === -1) continue;
      let headerSeen = false, degraded = null;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^#{1,6}\s/.test(lines[i])) break;
        const t = lines[i].trim();
        if (!t.startsWith("|")) continue;
        const cells = t.replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((x) => x.trim());
        if (cells.every((x) => /^:?-+:?$/.test(x))) continue;
        if (!headerSeen) { headerSeen = true; continue; }
        const judged = cells[d.column + 1]?.replace(/^\*+|\*+$/g, "");
        if (judged === undefined || judged === "" || /^\[[^\]]*\]$/.test(judged)) continue;
        cells[d.column + 1] = "@@out-of-domain@@";
        degraded = [...lines.slice(0, i), "| " + cells.join(" | ") + " |", ...lines.slice(i + 1)].join("\n");
        break;
      }
      if (degraded === null) continue; // no real row in the exemplar: the dedicated tests own this state
      const v = structureViolations(mission, degraded, spec);
      assert.ok(v.some((x) => x.cause === "row-out-of-domain" && x.detail.includes("@@out-of-domain@@")),
        `an out-of-domain value in "${d.section}" col ${d.column} must be caught and quoted`);
    }

    for (const e of spec.echoes ?? []) {
      const idx = content.search(sectionRe(e.fromSection));
      if (idx === -1) continue;
      const lines = content.split("\n");
      const start = lines.findIndex((l) => sectionRe(e.fromSection).test(l));
      let degraded = null;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^#{1,6}\s/.test(lines[i])) break;
        const t = lines[i].trim();
        if (!t) continue;
        if (e.linePrefix && !e.linePrefix.test(t)) continue;
        if (/:\s*\[[^\]]*\]?\s*$/.test(t)) continue; // placeholder value: the checker skips it too
        degraded = [...lines.slice(0, i), lines[i] + " tampered", ...lines.slice(i + 1)].join("\n");
        break;
      }
      if (degraded === null) continue;
      const v = structureViolations(mission, degraded, spec);
      assert.ok(v.some((x) => x.cause === "broken-echo"),
        `a typed line of "${e.fromSection}" edited away from its echo in ${e.inFile} must be caught`);
    }
  });
}

test("the named detail reaches the screen — an invalid field is never 'placeholders remain' (RWD-2026-0105)", async () => {
  // M1 built inProgressDetail and nothing consumed it: check rendered the false generic note for
  // every structure cause while the true, named message was computed and dropped. Measured on the
  // probe missions of the consolidated pass; repaired in check.ts; pinned here end to end.
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, readFileSync } = await import("node:fs");
  const framing = join(mission, "framing.md");
  const pristine = readFileSync(framing, "utf8");
  try {
    const lock = JSON.parse(readFileSync(join(mission, "scaffold-lock.json"), "utf8"));
    lock.structureContract = true;
    writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify(lock, null, 2) + "\n");
    writeFileSync(framing, pristine.replace(/\*\*Date\*\*\s*:\s*([^·\n]+)/, "**Date**: not-a-date "));
    let out = "";
    try { out = execFileSync("node", [CLI, "check", "--strict", "-p", dir], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (e) { out = (e.stdout ?? "") + (e.stderr ?? ""); }
    assert.match(out, /field "Date" reads "not-a-date" and must be an ISO date \(YYYY-MM-DD\)/,
      "the detail the machinery computes is the detail the operator reads");
    assert.doesNotMatch(out, /Framing note[^\n]*placeholders remain/,
      "the false generic note is gone from the row that has a named cause");
  } finally {
    writeFileSync(framing, pristine);
    const lock = JSON.parse(readFileSync(join(mission, "scaffold-lock.json"), "utf8"));
    delete lock.structureContract;
    writeFileSync(join(mission, "scaffold-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  }
});
