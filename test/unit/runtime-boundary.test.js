// The runtime boundary, consolidated (ADR-0054 ratification criteria 1-3).
//
// ADR-0054 names the crossings runward refuses: no socket, no spawned process, no base ref in the
// verdict path; same working tree, same verdict; advisory LLM output never enters the exit code.
// Each of those was previously guarded piecemeal (the CI `unshare -n` block for the network, the
// verify-findings tests for ADR-0007) or not at all. This file is the consolidated boundary test
// the ADR's own ratification section demanded — the ADR was `proposed` under two accepted
// dependents (ADR-0055, ADR-0057) until it existed (found by the 2026-08-14 audit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

// Modules whose import anywhere in the verdict path would be a runtime crossing: a socket
// (http/https/net/tls/dgram), a spawned process (child_process), or a parallel executor.
const CROSSINGS = /^(node:)?(https?|net|tls|dgram|child_process|worker_threads|cluster|repl)$/;

// TWO LIMITS OF THIS FILE, STATED SO NOBODY HAS TO REDISCOVER THEM.
//
// 1. `--hooks` puts the operator's commands in the EXIT-CODE PATH. This file used to describe
//    hooks.ts as running "outside computeVerdict", which is false at the call site: `hookFailed` is
//    an ARGUMENT to `computeVerdict`, and `verdictFrom` reads `hookFailed === 0`. Measured
//    2026-08-26: a hook of `curl https://this-host-does-not-exist.invalid/` leaves `check --strict`
//    at exit 0 (the opt-in guarantee holds) and takes `check --strict --hooks` to exit 1 with
//    `gaps.hooks: 1`. That IS a network call reaching the exit code — behind an explicit flag, on
//    the operator's own commands, documented by ADR-0008, carried in the threat model, and disclosed
//    in `--json` and the attestation. Opt-in and disclosed is the mitigation; "outside the verdict"
//    was never the accurate description, and `hooks-claim.test.js` now guards the public wording.
//
// 2. The closure stops at PACKAGE boundaries. It follows relative imports only, so a dependency's
//    own imports are never opened — `commander` already imports `child_process` for executable
//    subcommands. What this file proves is that RUNWARD'S OWN modules on the verdict path carry no
//    crossing; the dependency surface is the SBOM's and the network-cut CI run's job, not this one's.
/** Transitive import closure of a dist ESM module — every relative import followed, breadth-first. */
function importClosure(entry) {
  const seen = new Set();
  const queue = [resolve(entry)];
  const builtins = new Map(); // builtin specifier → first importer, for a nameable failure
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    // `\s+` after `import` required whitespace, so a DYNAMIC `import("node:https")` — no space
    // before the paren — was invisible to this walker. Measured 2026-08-26: `await
    // import("node:https")` planted in verdict.js left all four tests green. That is verbatim the
    // reevaluation trigger ADR-0054 wrote for itself ("the boundary test starts passing vacuously
    // ... e.g. a dynamic import"), and the condition was already met.
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      if (spec.startsWith(".")) queue.push(resolve(dirname(file), spec));
      else if (!builtins.has(spec)) builtins.set(spec, file);
    }
    // The blindness guards. `\brequire\s*\(` does not match `createRequire(`, so
    // `createRequire(import.meta.url)("net")` walked straight past it — also measured green.
    assert.ok(!/\brequire\s*\(/.test(src), `${file} uses require() — the closure scan would be blind to it`);
    assert.ok(!/createRequire/.test(src), `${file} uses createRequire — the closure scan would be blind to what it loads`);
  }
  return { files: seen, builtins };
}

test("ADR-0054 crossing 1: the verdict path imports no socket and no process spawner, transitively", () => {
  const { files, builtins } = importClosure(join(ROOT, "dist", "lib", "verdict.js"));
  assert.ok(files.size >= 5, `the closure walked the real graph (${files.size} modules)`);
  for (const [spec, importer] of builtins) {
    assert.ok(!CROSSINGS.test(spec), `${importer} imports "${spec}" inside the verdict path — an ADR-0054 crossing`);
  }
  // The boundary is meaningful only if the crossing modules exist elsewhere in the CLI: hooks.ts
  // (the operator's OWN checks, executed at the operator's request) and
  // characterize.ts (local git archaeology) legitimately spawn. The line is drawn AROUND the
  // verdict, not around the binary — assert both sides so the test cannot pass vacuously.
  assert.match(readFileSync(join(ROOT, "src", "lib", "hooks.ts"), "utf8"), /node:child_process/, "the negative control: spawning exists in the CLI, outside the verdict path");
});

test("ADR-0054 crossing 1, the wider ring: the module that OWNS the exit code carries only enumerated crossings", () => {
  // The closure above starts at verdict.js. `check.js` imports verdict.js, never the reverse, so the
  // module that decides the exit code was never walked: a spawner imported directly into
  // dist/commands/check.js left all four tests green (measured 2026-08-26). Walking from check.js
  // reaches 18 modules instead of 10 — and legitimately includes `node:child_process` through
  // hooks.js, which ADR-0054 enumerates as an operator-triggered crossing. So this ring allows
  // exactly that one, from exactly that importer, and refuses everything else BY NAME.
  const { files, builtins } = importClosure(join(ROOT, "dist", "commands", "check.js"));
  assert.ok(files.size > 10, `the wider closure is genuinely wider (${files.size} modules)`);
  const ALLOWED = new Map([["node:child_process", "hooks.js"]]);
  for (const [spec, importer] of builtins) {
    if (!CROSSINGS.test(spec)) continue;
    const from = ALLOWED.get(spec);
    assert.ok(from && importer.endsWith(from),
      `${importer} imports "${spec}" on the command that owns the exit code — an ADR-0054 crossing that is not the enumerated hook seam`);
  }
  // Both directions: the allowance must still be USED, or this ring silently becomes the narrow one.
  assert.ok([...builtins.keys()].includes("node:child_process"), "the hook seam is still in this closure — otherwise the allowance is dead and the ring untested");
});

test("ADR-0054 crossing 4: same working tree, same verdict — byte-identical across two runs", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-boundary-"));
  execFileSync(process.execPath, [CLI, "init", "--yes", "--example"], { cwd: dir, stdio: "pipe" });
  const run = () => execFileSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", "."], { cwd: dir, encoding: "utf8" });
  assert.equal(run(), run(), "two runs on an unchanged tree emit byte-identical machine output — no clock, no randomness, no external state in the verdict");
  rmSync(dir, { recursive: true, force: true });
});

test("ADR-0054 crossing 4: no command speaks a change-set — `--changed` / base-ref stays refused, grep-level", () => {
  // Mirrors ADR-0041's own guard: the moment the verdict takes a base ref, "same working tree ⇒
  // same verdict" dies (two operators with different local base refs read different verdicts).
  // `src/lib` was never scanned, so the same regression planted in verdict.ts passed. The verdict
  // lives in lib; scanning only the commands checked the half that does not compute it.
  const sources = [join(ROOT, "src", "cli.ts"),
    ...readdirSync(join(ROOT, "src", "commands")).map((f) => join(ROOT, "src", "commands", f)),
    ...readdirSync(join(ROOT, "src", "lib")).filter((f) => f.endsWith(".ts")).map((f) => join(ROOT, "src", "lib", f))];
  for (const f of sources) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/--changed|baseRef|base-ref|baseSha/.test(src), `${f} speaks a change-set/base-ref — the ADR-0041/ADR-0054 refusal regressed`);
  }
});

test("ADR-0054 crossing 5: the advisory-LLM-purity proof exists and is cited, not restated", () => {
  // Criterion 3 is already proven by the verify-findings suite (verdict byte-identical whether the
  // advisory file is present, absent, empty, or adversarial). This assertion pins the citation so
  // the proof cannot be silently deleted while this ADR stays accepted.
  assert.ok(existsSync(join(ROOT, "test", "unit", "verify-findings-out-of-verdict.test.js")), "the ADR-0007/ADR-0054 verdict-purity test is present");
});

test("ADR-0054 crossing 2: no long-lived process between gate invocations", () => {
  // Enumerated as a crossing and never tested: a daemon, a file-watcher, an auto-installer. It held
  // structurally, and nothing would have reddened if it stopped. Grep-level, like the base-ref guard
  // beside it, and over src/lib too — the half the base-ref guard used to miss.
  const files = [join(ROOT, "src", "cli.ts"),
    ...readdirSync(join(ROOT, "src", "commands")).map((f) => join(ROOT, "src", "commands", f)),
    ...readdirSync(join(ROOT, "src", "lib")).filter((f) => f.endsWith(".ts")).map((f) => join(ROOT, "src", "lib", f))];
  // EXECUTION, not mention. A first version matched a bare `npm install` and reddened init.ts, which
  // PRINTS that string as an instruction for the operator to run — a guard crying on honest code is
  // the class that gets a gate switched off, and this file exists partly because of RWD-2026-0074.
  // A CALL, not a word. Two earlier spellings reddened honest code: a bare `npm install` matched an
  // instruction init.ts PRINTS for the operator, and `\bwatch\s*\(` matched the prose "Reopening
  // watch (ADR-0033" in a comment. A guard that cries on correct work gets the gate switched off —
  // the class RWD-2026-0074 is filed under — so every alternative below names a call site.
  const LIVE = /\bfs\.watch\b|\bwatchFile\s*\(|\bchokidar\b|setInterval\s*\(|new\s+Daemon\b|(?:execSync|spawnSync|spawn|exec)\s*\(\s*["'`](?:npm|pnpm|yarn)\b/;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!LIVE.test(src), `${f} watches, loops on a timer, or installs — an ADR-0054 crossing 2 (a long-lived process between invocations)`);
  }
  // The opposite direction: the pattern is real and would fire. Otherwise this passes on a typo.
  assert.ok(LIVE.test('setInterval(() => {}, 1000)'), "the guard's own pattern detects a timer loop");
  assert.ok(LIVE.test('watchFile("x", () => {})'), "and a watcher");
  assert.ok(LIVE.test('execSync("npm install")'), "and an install runward performs itself");
  assert.ok(!LIVE.test('log("run npm install yourself")'), "but not an instruction runward merely prints");
  assert.ok(!LIVE.test('// Reopening watch (ADR-0033) — the backlog'), "nor the word watch in prose");
  assert.ok(LIVE.test('fs.watch(dir, cb)'), "a real watcher is still caught");
});

test("ADR-0054 crossing 3: runward holds no key, no identity and no state of the operator's", () => {
  // Also enumerated and never tested. The attestation is UNSIGNED by design — ADR-0055 says so and
  // `verify` says so — and this is what keeps it that way: the day a signing key enters, this reddens.
  const files = [join(ROOT, "src", "cli.ts"),
    ...readdirSync(join(ROOT, "src", "commands")).map((f) => join(ROOT, "src", "commands", f)),
    ...readdirSync(join(ROOT, "src", "lib")).filter((f) => f.endsWith(".ts")).map((f) => join(ROOT, "src", "lib", f))];
  const HELD = /node:crypto["'`][^\n]*\b(sign|createSign|generateKeyPair|privateDecrypt)\b|createSign\s*\(|generateKeyPair|privateKey|homedir\s*\(|\.netrc|keytar|process\.env\.[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD)/;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!HELD.test(src), `${f} signs, generates a key, reads a home directory or a credential — an ADR-0054 crossing 3`);
  }
  assert.ok(HELD.test('const k = generateKeyPair("rsa")'), "the guard's own pattern detects key generation");
  assert.ok(HELD.test('homedir()'), "and a reach into the operator's home");
});
