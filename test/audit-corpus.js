// Adversarial audit corpus — the attacks that once passed, replayable by anyone.
//
// On 2026-08-04, five adversarial audits made `check --strict` exit 0 on missions containing no
// evidence at all, and separately made it refuse missions that were telling the truth. All were
// closed in v0.32.0 (ADR-0045). But the scripts that found them lived in a session scratchpad, so
// the sentence "the audit is reproducible" was not something a third party could act on — and a
// reliability review flagged exactly that: an event nobody else can replay is an assertion, not
// evidence.
//
// This file is that corpus. It runs the REAL CLI against missions built on the fly, and it holds
// BOTH directions, because the pass that only checks attacks is the pass that ships a gate nobody
// can use:
//
//   REFUSE — a mission that proves nothing must not go green.
//   ACCEPT — a mission that is honest must not go red. Four of the nine hardening classes written
//            that morning were refusing honest missions by the afternoon; the inverse cases below
//            are the ones that caught them.
//
// Run: `node test/audit-corpus.js` (needs a build). Add cases when a new vector is found; a vector
// that is only described in an ADR is a vector nobody re-tests.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const GATED = ["architecture.md", "execution-topology.md", "floor.md", "governance/threat-model.md", "handover.md"];

let pass = 0;
const failures = [];

/** Run the CLI, never throw: the exit code IS the result. */
function cli(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** The shipped reference mission: filled, with its own 64-rule corpus, and GREEN out of the box.
 *  Every case below starts from it, so an ACCEPT case that fails is the gate refusing something
 *  honest — never a fixture that forgot to fill a deliverable. */
function mission() {
  const dir = mkdtempSync(join(tmpdir(), "rw-audit-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir, stdio: "ignore" });
  cli(["init", "-p", ".", "--yes", "--example"], dir);
  return dir;
}

/** Rewrite every manifest row through `fn(slug)`; null keeps the row untouched. */
function rewriteRows(dir, fn) {
  for (const rel of GATED) {
    const p = join(dir, "runward", rel);
    if (!existsSync(p)) continue;
    const out = readFileSync(p, "utf8").split("\n").map((line) => {
      const m = line.match(/^\|\s*`?([a-z][a-z0-9-]+)`?\s*\|[^|]*\|[^|]*\|\s*$/);
      if (!m) return line;
      const r = fn(m[1], rel);
      return r === null ? line : `| ${m[1]} | ${r.status} | ${r.evidence} |`;
    }).join("\n");
    writeFileSync(p, out);
  }
}

function check(name, dir, want, why) {
  const { code, out } = cli(["check", "--strict", "-p", "."], dir);
  const ok = want === "REFUSE" ? code !== 0 : code === 0;
  if (ok) { pass++; console.log(`  ok    ${want.padEnd(6)} ${name}`); }
  else {
    failures.push({ name, want, code, why, out: out.split("\n").filter((l) => l.includes("✗")).slice(0, 3).join("\n") });
    console.log(`  FAIL  ${want.padEnd(6)} ${name} (exit ${code})`);
  }
}

const cases = [];
const attack = (name, why, build) => cases.push({ name, why, build, want: "REFUSE" });
const honest = (name, why, build) => cases.push({ name, why, build, want: "ACCEPT" });

// ── Attacks: a green here would be a green over nothing ───────────────────────────────────────

attack("self-citation: the manifest is its own evidence",
  "the rule slug is column 1 of every row, so `file:<manifest>#<slug>` always resolved and always matched: a universal green key. It reached '36 of 36 typed pointers the gate opened and checked (100%)' on an empty project.",
  (dir) => rewriteRows(dir, (slug, rel) => ({ status: "applied", evidence: `file:runward/${rel}#${slug}` })));

attack("self-citation: a rule's own file proves the rule",
  "one step removed, and worse: the rule file contains the very tokens its `signature:` looks for, so the only content check the gate has satisfies itself.",
  (dir) => rewriteRows(dir, (slug) => ({ status: "applied", evidence: `file:runward/rules/${slug}.md` })));

attack("self-citation: the same target, five characters shorter",
  "circularity was tested on the POINTER, not on the TARGET: `circularEvidence` ran only in the typed-pointer loop, so dropping `file:` moved the rule's own file into the bare-path loop, which banked it unexamined. Measured 2026-08-26: prose exit 1, unrelated file exit 1, `file:` self-pointer exit 1, bare self-path exit 0 — ADR-0019's inverted incentive a second time, the vague spelling being the one that passed. The `file:` form above was in this corpus from the start, which is why it read 14/14 while this was live.",
  (dir) => rewriteRows(dir, (slug) => ({ status: "applied", evidence: `runward/rules/${slug}.md` })));

// NOT AN ATTACK HERE — "the row that declares a signed rule satisfies that rule's signature".
// The vector is real and was live until 2026-08-26 (the only line of floor.md matching
// /secret|vault/ was the declaring row itself; verdict `clean`, exit 0, 0 violations). Two versions
// of it written against this corpus were refused by the UNFIXED build for an unrelated reason, so
// adding either would have printed `ok` without testing what it names — which is precisely how this
// file read 14/14 while the bare-path hole above was live. The proven detector is
// `test/unit/gate-false-greens.test.js`, measured red on the unfixed build and green on the fixed
// one, with a sensitivity control that stays green on both. Re-home it here the day this corpus can
// mutate one row without disturbing the rest of the mission.

attack("fabricated corpus: 36 files containing the word ok",
  "the non-vacuity floor counts CARDINALITY over a set the audited party writes. Twelve files saying 'ok' satisfy govern:12.",
  (dir) => {
    const rules = join(dir, "runward", "rules");
    for (const f of readdirSyncSafe(rules)) rmSync(join(rules, f));
    for (const [phase, n] of [["architect", 6], ["topology", 4], ["floor", 10], ["govern", 12], ["handover", 4]])
      for (let i = 1; i <= n; i++)
        writeFileSync(join(rules, `p-${phase}-${i}.md`), `---\nimpact: CRITICAL\nphases: [${phase}]\n---\n\nok\n`);
  });

attack("deleted lock: the corpus is fabricated AND the lock removed",
  "found 2026-08-06 against the published 0.33.0, and it is the previous case turned inside out. Rather than re-sign the lock, delete it: `corpusDivergence` falls back to `unrecorded`, which was a warning in the printed text and nothing in the verdict. Measured then: the same 64 fabricated rules exit 1 with the lock present and EXIT 0 with the lock gone. A compatibility state for missions predating the lock is indistinguishable from someone removing a file they own.",
  (dir) => {
    // The rule FILENAMES are kept, and only the body is gutted. Renaming them instead would make
    // every manifest row cite a slug that no longer exists, so the mission would red on conformance
    // and this case would pass without the corpus check doing anything. The first draft did exactly
    // that and was decorative: it stayed green under `strictGaps += 0`.
    const rules = join(dir, "runward", "rules");
    for (const f of readdirSyncSafe(rules)) {
      if (!f.endsWith(".md")) continue;
      const p = join(rules, f);
      const front = readFileSync(p, "utf8").split(/^---$/m).slice(0, 2).join("---") + "---";
      writeFileSync(p, `${front}\n\nok\n`);
    }
    rmSync(join(dir, "runward", "scaffold-lock.json"), { force: true });
  });

attack("forged lock: the corpus is fabricated AND the lock re-signed",
  "the lock lives in the audited repository. Re-signing it in the same commit made the fabricated corpus pass, so the check bought nothing against anyone deliberate. The authority has to be the installed package.",
  (dir) => {
    const rules = join(dir, "runward", "rules");
    for (const f of readdirSyncSafe(rules)) rmSync(join(rules, f));
    const files = {};
    for (const [phase, n] of [["architect", 6], ["topology", 4], ["floor", 10], ["govern", 12], ["handover", 4]])
      for (let i = 1; i <= n; i++) {
        const body = `---\nimpact: CRITICAL\nphases: [${phase}]\n---\n\nok\n`;
        writeFileSync(join(rules, `p-${phase}-${i}.md`), body);
        files[`rules/p-${phase}-${i}.md`] = sha(body);
      }
    writeFileSync(join(dir, "runward", "scaffold-lock.json"), JSON.stringify({ version: 1, writtenBy: "forged", files }, null, 2));
  });

attack("deviation resting on the scaffolded template",
  "`ADR-0000-template.md` is written by runward itself and nobody ever took that decision.",
  (dir) => rewriteRows(dir, () => ({ status: "deviated", evidence: "ADR-0000" })));

attack("deviation resting on a zero-byte ADR",
  "the evidence layer has always refused an empty file; the ADR layer accepted one as a ratified decision.",
  (dir) => {
    writeFileSync(join(dir, "runward", "adr", "ADR-0055-empty.md"), "");
    rewriteRows(dir, () => ({ status: "deviated", evidence: "ADR-0055" }));
  });

attack("symlink escape: evidence outside the repository",
  "containment was purely lexical, so a link to a system file passed the check and was then read — turning the seal into an arbitrary-file read oracle, the exact thing the code's own comment promised it prevented.",
  (dir) => {
    const outside = mkdtempSync(join(tmpdir(), "rw-outside-"));
    writeFileSync(join(outside, "foreign.ts"), "export const SECRET_OUTSIDE = 1;\n");
    mkdirSync(join(dir, "src"), { recursive: true });
    symlinkSync(join(outside, "foreign.ts"), join(dir, "src", "linked.ts"));
    rewriteRows(dir, (slug) => (slug === "hexa-architecture" ? { status: "applied", evidence: "file:src/linked.ts#SECRET_OUTSIDE" } : null));
  });

attack("a pointer that names nothing",
  "`#` with nothing behind it executed no check at all, on a pointer that looks precise. The operator believes a claim was verified.",
  (dir) => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const x = 1;\n");
    rewriteRows(dir, (slug) => (slug === "hexa-architecture" ? { status: "applied", evidence: "file:src/a.ts#" } : null));
  });

attack("two Rule conformance sections",
  "only the first was read, so an 'example of the format' pasted above the real table made a whole phase invisible while the gate reported it accounted for.",
  (dir) => {
    const p = join(dir, "runward", "architecture.md");
    const s = readFileSync(p, "utf8");
    writeFileSync(p, s.replace("## Rule conformance",
      "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| example | applied | file:x |\n\n## Rule conformance", 1));
  });

// ── Honest missions: a red here is a gate people switch off ───────────────────────────────────

honest("a CRLF checkout is not a gutted corpus",
  "core.autocrlf rewrites every file and the frontmatter reader did not match \\r\\n, so all 64 rules read as empty and the gate announced 'the mapping may have been stripped'. Git doing its documented job accused the operator.",
  (dir) => {
    const rules = join(dir, "runward", "rules");
    for (const f of readdirSyncSafe(rules)) {
      const p = join(rules, f);
      writeFileSync(p, readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
    }
  });

honest("a house rule that cannot satisfy the floor is welcome",
  "refusing every rule runward did not write made a normal team's mission red. The line is drawn on effect: an extension may not stand in for a shipped rule, but extending is legitimate.",
  (dir) => {
    writeFileSync(join(dir, "runward", "rules", "house-no-pii-in-logs.md"),
      "---\nimpact: MEDIUM\nphases: []\ntags: [house]\n---\n\nNo personal data in logs.\n");
  });

honest("a documentary rule may cite the section that states the fact",
  "the usage registry and the named successor have no evidence but the section stating them. Refusing every self-pointer made the gate contradict its own advice.",
  (dir) => {
    const p = join(dir, "runward", "execution-topology.md");
    let s = readFileSync(p, "utf8");
    if (!s.includes("## Usage registry")) s = s.replace("## Rule conformance", "## Usage registry\n\nOne deployment, owner named.\n\n## Rule conformance", 1);
    writeFileSync(p, s);
    rewriteRows(dir, (slug, rel) => (rel === "execution-topology.md" && slug === "topology-usage-registry-present"
      ? { status: "applied", evidence: 'file:runward/execution-topology.md#"Usage registry"' } : null));
  });

honest("an accepted ADR whose line merely names another one",
  "the status was searched anywhere in the line, so `accepted, replacing the proposed ADR-0012` read as unratified. The status is the first word.",
  (dir) => {
    writeFileSync(join(dir, "runward", "adr", "ADR-0061-x.md"),
      "# ADR-0061: a real decision\n\n**Status**: accepted (superseded by ADR-0099)\n\n## Context\n\nSomething was decided and this records it.\n");
    rewriteRows(dir, (slug) => (slug === "hexa-architecture" ? { status: "deviated", evidence: "ADR-0061" } : null));
  });

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

function readdirSyncSafe(d) {
  try { return readdirSync(d).filter((f) => f.endsWith(".md")); } catch { return []; }
}
function sha(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

// ── Run ───────────────────────────────────────────────────────────────────────────────────────

// Sanity: the base must be green before a single case runs. If it is not, every ACCEPT below
// would fail for a reason that has nothing to do with what it tests, and the corpus would report
// four regressions that do not exist — which is exactly what happened on the first run.
{
  const dir = mission();
  try {
    const { code, out } = cli(["check", "--strict", "-p", "."], dir);
    if (code !== 0) {
      console.error("the reference mission is not green; the corpus cannot distinguish a real refusal from a broken fixture");
      console.error(out.split("\n").filter((l) => l.includes("\u2717")).slice(0, 5).join("\n"));
      process.exit(2);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log(`Adversarial audit corpus — ${cases.length} cases (ADR-0045)\n`);
for (const c of cases) {
  const dir = mission();
  try { c.build(dir); check(c.name, dir, c.want, c.why); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log(`\n${pass}/${cases.length} as expected`);
if (failures.length) {
  console.log(`\n${failures.length} regression(s):`);
  for (const f of failures) {
    console.log(`\n  ${f.name}\n    expected ${f.want}, got exit ${f.code}\n    why it matters: ${f.why}`);
    if (f.out) console.log(`    gate said:\n${f.out.split("\n").map((l) => "      " + l.trim()).join("\n")}`);
  }
  process.exit(1);
}
console.log("Every attack is refused, and every honest mission passes.");
