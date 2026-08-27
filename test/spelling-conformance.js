// The conformance corpus for the pointer-resolution brick, run against this implementation on this
// filesystem (ADR-0061). The CASES are data — `test/fixtures/spelling-corpus.json` — because they are
// the artifact that would be ported if this brick were ever reimplemented in another language. This
// file is only the harness that drives them.
//
// TWO THINGS IT DOES THAT AN ORDINARY TEST FILE DOES NOT:
//
// 1. **It states its filesystem.** Half of these cases are answers about a case-insensitive,
//    Unicode-folding filesystem and are meaningless on a case-sensitive one. ADR-0046's amendment was
//    paid for by exactly this: a survivor list that was a property of code AND filesystem while
//    claiming to be a property of code. So the harness probes the host, runs what applies, and
//    NAMES what it skipped and why. A skip that is counted is a known limit; a skip that is silent
//    is a false green.
// 2. **Each case cites the defect it was learned from.** This corpus is the empirical record of what
//    this module has actually got wrong — fourteen filed defects in one brick — not a list of what
//    someone imagined it might.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "spelling-corpus.json"), "utf8"));
// `pathToFileURL`, not the bare path. A dynamic `import("C:\\...")` is read as the URL scheme `c:`
// and Node refuses it (ERR_UNSUPPORTED_ESM_URL_SCHEME) — invisible on POSIX, fatal on Windows, and
// found by the windows-latest leg on this file's first CI run.
const { evidenceReport } = await import(pathToFileURL(join(ROOT, "dist", "lib", "evidence.js")).href);

/** What this filesystem actually does — probed, never assumed. */
function probe() {
  const d = mkdtempSync(join(tmpdir(), "rw-fsprobe-"));
  const caps = { caseInsensitive: false, caseSensitive: false, unicodeFold: false, symlinks: false, posixPermissions: sep === "/" };
  try {
    writeFileSync(join(d, "probe.txt"), "x");
    caps.caseInsensitive = existsSync(join(d, "PROBE.TXT"));
    caps.caseSensitive = !caps.caseInsensitive;   // named as its own capability: a case REQUIRES one or the other, never "not the other"''s absence
    writeFileSync(join(d, "ssharp.txt"), "y");
    caps.unicodeFold = existsSync(join(d, "ßharp.txt"));
    try { symlinkSync("probe.txt", join(d, "alias.txt")); caps.symlinks = true; } catch { /* not available */ }
  } finally { rmSync(d, { recursive: true, force: true }); }
  return caps;
}

function build(c) {
  const outer = mkdtempSync(join(tmpdir(), "rw-spell-"));
  const root = join(outer, "project");
  const mission = join(root, "runward");
  mkdirSync(mission, { recursive: true });
  for (const [rel, body] of Object.entries(c.outside ?? {})) {
    mkdirSync(dirname(join(outer, rel)), { recursive: true });
    writeFileSync(join(outer, rel), body);
  }
  for (const [rel, body] of Object.entries(c.layout ?? {})) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  for (const [rel, target] of Object.entries(c.symlinks ?? {})) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    symlinkSync(target, join(root, rel));
  }
  writeFileSync(join(mission, "floor.md"),
    `# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| rule-a | applied | ${c.pointer} |\n`);
  return { outer, root, mission };
}

const caps = probe();
console.log(`  filesystem: case-insensitive=${caps.caseInsensitive} unicode-fold=${caps.unicodeFold} symlinks=${caps.symlinks} posix-perms=${caps.posixPermissions}`);

let ran = 0, failures = 0;
const skipped = [];
for (const c of CORPUS.cases) {
  const unmet = Object.entries(c.requires ?? {}).filter(([k, v]) => caps[k] !== v).map(([k]) => k);
  if (unmet.length) { skipped.push(`${c.id} (needs ${unmet.join(", ")})`); continue; }
  const fx = build(c);
  let problems;
  try {
    if (c.parentMode) chmodSync(fx.outer, parseInt(c.parentMode, 8));
    problems = evidenceReport(fx.mission, "floor.md", {}).map((v) => v.problem);
  } finally {
    if (c.parentMode) { try { chmodSync(fx.outer, 0o755); } catch { /* best effort */ } }
    rmSync(fx.outer, { recursive: true, force: true });
  }
  ran++;
  const accepted = problems.length === 0;
  const want = c.expect === "accepted";
  if (accepted !== want) {
    failures++;
    console.error(`  FAIL  ${c.id} [${c.from}] — expected ${c.expect}, got ${accepted ? "accepted" : JSON.stringify(problems)}`);
    console.error(`        ${c.because}`);
  } else if (c.messageMatches && !problems.some((p) => new RegExp(c.messageMatches).test(p))) {
    failures++;
    console.error(`  FAIL  ${c.id} [${c.from}] — refused correctly, but no message matched /${c.messageMatches}/: ${JSON.stringify(problems)}`);
  } else {
    console.log(`  ok    ${c.id} [${c.from}] — ${c.expect}`);
  }
}

// The skip list is OUTPUT, not a silence. A corpus that quietly runs half of itself on one machine
// and a different half on another is the defect ADR-0046's amendment was written about.
if (skipped.length) {
  console.log(`\n  ${skipped.length} case(s) not applicable on this filesystem, named rather than hidden:`);
  for (const s of skipped) console.log(`    skip  ${s}`);
}
console.log(`\n${ran} of ${CORPUS.cases.length} case(s) run, ${skipped.length} skipped, ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
