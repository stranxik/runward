#!/usr/bin/env node
// Reference script of the recipe docs/recipes/repository-rules-as-junit.md.
//
// It runs in the ADOPTER's repository and CI, never inside runward's gate: runward reads the JUnit
// file this script writes, as it reads any committed JUnit report, and never runs it (ADR-0054).
//
// The rule it checks has one shape: "every change to <guarded files> bumps <version>". Without git
// history (the gate reads no history, ADR-0067 crossing 4), "a change" is made visible by content:
//   - the FINGERPRINT is the SHA-256 of the guarded files (paths sorted, CRLF read as LF), the version
//     file excluded;
//   - a committed LOCK records, for each version, the fingerprint it was released with;
//   - the case is green when the lock's fingerprint for the current version is the current one.
// Change a guarded file without bumping the version: the fingerprint no longer matches the lock, red.
// Bump the version: it has no fingerprint yet, red until `--record` writes it. `--record` never
// overwrites a version already in the lock: that would be the bypass this check exists to close.
//
// The case NAME carries the version and the fingerprint, so a manifest row citing it stops linking
// as soon as the report is regenerated after the guarded files changed. The gate reads the committed
// report and never runs this script: a change committed WITHOUT regenerating the report is caught by
// the CI job that re-runs it and compares the result with the committed file, not by the gate.
//
// Node only, no dependency. The output is deterministic (no time, no duration, no host), so CI can
// re-run it and compare with the committed file byte for byte.
//
// Usage (paths relative to the current directory):
//   node repo-rule-junit.mjs --rule <id> --version-file <file> --key <NAME> --guard <path> [--guard <path>…]
//        --lock <file> --out <junit.xml> [--record]
//
// Exit code: 0 when the case is green (or a version was recorded), 1 when it is red, 2 on bad inputs.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const one = (name) => all(name)[0];

/** Every file under the guarded paths, as sorted POSIX paths relative to the current directory. */
export function guardedFiles(paths, exclude) {
  const out = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const e of readdirSync(p)) if (e !== "node_modules" && !e.startsWith(".")) walk(join(p, e));
    } else out.push(relative(process.cwd(), p).split("\\").join("/"));
  };
  for (const p of paths) walk(resolve(p));
  const ex = resolve(exclude);
  return [...new Set(out)].filter((f) => resolve(f) !== ex).sort();
}

/** The fingerprint: each path, then the SHA-256 of its bytes with CRLF read as LF. */
export function fingerprint(files) {
  const h = createHash("sha256");
  for (const f of files) {
    const body = createHash("sha256").update(readFileSync(f, "utf8").replace(/\r\n/g, "\n")).digest("hex");
    h.update(`${f}\n${body}\n`);
  }
  return h.digest("hex");
}

/** `KEY = "x"`, `KEY: x`, `export const KEY = 3` or a bare `KEY=x` line: the first one wins. */
export function readVersion(text, key) {
  // The key comes from the command line: escaped, so it is matched as a name and never as a pattern.
  const name = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`^\\s*(?:export\\s+)?(?:const\\s+)?${name}\\s*[:=]\\s*["'\`]?([\\w.+-]+)`, "m"));
  return m?.[1];
}

/** The case name the recipe documents, and the one a manifest row cites. */
export function caseName(rule, key, version, sha) {
  return `repo-rule ${rule} ${key}=${version} sha256=${sha}`;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function junit(rule, name, failure) {
  const body = failure ? `>\n      <failure message="${esc(failure)}">${esc(failure)}</failure>\n    </testcase>` : "/>";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n  <testsuite name="repo-rules" tests="1" failures="${failure ? 1 : 0}">\n` +
    `    <testcase classname="repo-rules.${esc(rule)}" name="${esc(name)}"${body}\n  </testsuite>\n</testsuites>\n`;
}

function main() {
  const rule = one("rule"), versionFile = one("version-file"), key = one("key"), lockPath = one("lock"), out = one("out");
  const guards = all("guard");
  if (!rule || !versionFile || !key || !lockPath || !out || guards.length === 0) {
    console.error("usage: repo-rule-junit.mjs --rule <id> --version-file <file> --key <NAME> --guard <path>… --lock <file> --out <junit.xml> [--record]");
    return 2;
  }
  for (const p of [versionFile, ...guards]) if (!existsSync(p)) { console.error(`repo-rule-junit: ${p} does not exist`); return 2; }
  const version = readVersion(readFileSync(versionFile, "utf8"), key);
  if (!version) { console.error(`repo-rule-junit: no ${key} in ${versionFile}`); return 2; }
  const files = guardedFiles(guards, versionFile);
  if (files.length === 0) { console.error("repo-rule-junit: the guarded paths hold no file"); return 2; }
  const sha = fingerprint(files);
  const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {};
  const recorded = (lock[key] ??= {});

  if (args.includes("--record")) {
    if (recorded[version] !== undefined && recorded[version] !== sha) {
      console.error(`repo-rule-junit: ${key}=${version} is already recorded with another fingerprint — bump ${key} instead`);
      return 1;
    }
    recorded[version] = sha;
    mkdirSync(dirname(resolve(lockPath)), { recursive: true });
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    console.log(`recorded ${key}=${version} sha256=${sha} (${files.length} files)`);
  }

  const name = caseName(rule, key, version, sha);
  const failure = recorded[version] === undefined
    ? `${key}=${version} has no recorded fingerprint: record it with --record once the change is reviewed`
    : recorded[version] !== sha
      ? `the guarded files changed since ${key}=${version} was recorded (${recorded[version].slice(0, 12)}…): bump ${key}`
      : undefined;
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, junit(rule, name, failure));
  console.log(`${failure ? "FAIL" : "ok"}  ${name}${failure ? `\n      ${failure}` : ""}`);
  return failure ? 1 : 0;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) process.exitCode = main();
