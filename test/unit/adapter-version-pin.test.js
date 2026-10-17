// Every gate adapter runward writes runs the runward version that wrote it (TOR-249).
//
// Measured on main dbcbc7a: the same tree exits 0 under runward 0.31.0 and 1 under 0.44.0. The
// pre-commit adapter `init` wrote ran a global `runward` when there was one, else an unpinned
// `npx --yes runward`; the GitHub Actions, BMAD, Claude Code and Kiro samples were unpinned too,
// and so were the packaged client hooks and the entries `wire --install` writes. So a hook's
// verdict depended on which binary the machine happened to have.
//
// What is held here, with a positive control for each net:
//   1. no adapter template runs runward unpinned; each runs it through the placeholder `init`
//      stamps (the template-version-pin net keeps templates free of literal versions);
//   2. `init` writes every adapter stamped with package.json's version, no placeholder left, and
//      the scaffold lock records the stamped bytes (what was written, not the template);
//   3. `update` on a mission whose adapters an older release wrote unpinned: an untouched copy is
//      refreshed ("changed upstream"), an edited one is kept and named;
//   4. the stamped pre-commit runs the project's node_modules/.bin/runward only when it IS that
//      version, and otherwise the pinned npx, never a global;
//   5. the packaged client hooks and the wire entries are pinned to package.json's version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unpinnedInvocations, stampAdapterVersion, ADAPTER_VERSION_PLACEHOLDER } from "../../dist/lib/adapter-version.js";
import { mergeClaudeSettings, kiroHookContent } from "../../dist/lib/wire-install.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const ADAPTERS = join(ROOT, "templates", "adapters");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
delete ENV.RUNWARD_DRY_RUN;
const sha = (t) => createHash("sha256").update(t.replace(/\r\n/g, "\n"), "utf8").digest("hex");
const samples = () => readdirSync(ADAPTERS).filter((f) => f !== "README.md").sort();

// The texts the adapters carried on main dbcbc7a, verbatim where the net reads them.
const OLD_PRE_COMMIT = "#!/bin/sh\nset -e\nif command -v runward >/dev/null 2>&1; then\n  runward check --strict\nelse\n  npx --yes runward check --strict\nfi\n";
const OLD_GHA = "      - name: runward check\n        run: npx --yes runward check --strict\n";
const OLD_CLAUDE = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "runward check --strict 2>&1 || true" }] }] } });
const OLD_GITLAB = 'variables:\n  RUNWARD_VERSION: "latest" # pin it\nscript:\n  - npx --yes "runward@$RUNWARD_VERSION" check --strict\n';

test("positive control: the net reddens on each unpinned shape the adapters shipped", () => {
  assert.deepEqual(unpinnedInvocations(OLD_PRE_COMMIT), ["command -v runward", "runward check", "npx --yes runward"]);
  assert.deepEqual(unpinnedInvocations(OLD_GHA), ["npx --yes runward"]);
  assert.deepEqual(unpinnedInvocations(OLD_CLAUDE), ["runward check"], "a bare global in a JSON command string");
  assert.deepEqual(unpinnedInvocations(OLD_GITLAB), ['npx --yes "runward@$RUNWARD_VERSION'], "a variable whose value is `latest` is not a pin");
  assert.deepEqual(unpinnedInvocations("npx --yes runward@latest check"), ["npx --yes runward@latest"]);
  // And it stays green on pins and on prose.
  assert.deepEqual(unpinnedInvocations("npx --yes runward@1.2.3 check --strict"), []);
  assert.deepEqual(unpinnedInvocations(`# run runward check --strict by hand\nnpx --yes runward@${ADAPTER_VERSION_PLACEHOLDER} check`), []);
  assert.deepEqual(unpinnedInvocations(JSON.stringify({ "//": "Use 'runward check --strict'", hooks: [{ command: "npx --yes runward@1.2.3 check" }] })), []);
});

test("no adapter template runs runward unpinned, and every one that runs it carries the placeholder", () => {
  const names = samples();
  assert.equal(names.length, 10, "the ten shipped adapters — the sweep went blind if this moved");
  const offenders = [];
  for (const f of names) {
    const text = readFileSync(join(ADAPTERS, f), "utf8");
    for (const o of unpinnedInvocations(text)) offenders.push(`templates/adapters/${f}: ${o}`);
    if (/\brunward\b/.test(text) && /npx/.test(text) && !text.includes(ADAPTER_VERSION_PLACEHOLDER)) offenders.push(`templates/adapters/${f}: runs npx runward without the ${ADAPTER_VERSION_PLACEHOLDER} placeholder`);
  }
  assert.deepEqual(offenders, [], "an adapter runs whatever runward the machine has:\n  " + offenders.join("\n  "));
});

test("init stamps every adapter with its own version, and the lock records the stamped bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-adapter-pin-"));
  try {
    execFileSync("node", [CLI, "init", "--yes"], { cwd: dir, env: ENV, stdio: "pipe" });
    const lock = JSON.parse(readFileSync(join(dir, "runward", "scaffold-lock.json"), "utf8"));
    for (const f of samples()) {
      const text = readFileSync(join(dir, "runward", "adapters", f), "utf8");
      assert.ok(!text.includes(ADAPTER_VERSION_PLACEHOLDER), `${f}: placeholder left in the written copy`);
      assert.deepEqual(unpinnedInvocations(text), [], `${f}: the written copy runs runward unpinned`);
      assert.equal(lock.files[`adapters/${f}`], sha(text), `${f}: the lock must record what was written`);
      if (f !== "README.md" && readFileSync(join(ADAPTERS, f), "utf8").includes(ADAPTER_VERSION_PLACEHOLDER)) {
        assert.ok(text.includes(VERSION), `${f}: does not cite ${VERSION}`);
      }
    }
    // The update right after init is a no-op on adapters: same stamp, same bytes.
    const out = execFileSync("node", [CLI, "update"], { cwd: dir, env: ENV, encoding: "utf8" });
    assert.doesNotMatch(out, /runward\/adapters\/\S+ .*(changed upstream|kept)/, "a fresh mission's adapters are up to date");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("update: an untouched adapter an older release wrote unpinned is refreshed; an edited one is kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-adapter-upd-"));
  try {
    execFileSync("node", [CLI, "init", "--yes"], { cwd: dir, env: ENV, stdio: "pipe" });
    const lockPath = join(dir, "runward", "scaffold-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    // pre-commit: as 0.44.0 wrote it and recorded it (untouched since). kiro-hooks.json: the same,
    // then edited by the operator after the record.
    writeFileSync(join(dir, "runward", "adapters", "pre-commit"), OLD_PRE_COMMIT);
    lock.files["adapters/pre-commit"] = sha(OLD_PRE_COMMIT);
    const oldKiro = '{"hooks":[{"action":{"command":"npx --yes runward check --strict"}}]}\n';
    lock.files["adapters/kiro-hooks.json"] = sha(oldKiro);
    writeFileSync(join(dir, "runward", "adapters", "kiro-hooks.json"), oldKiro.replace("--strict", "--strict # mine"));
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

    const out = execFileSync("node", [CLI, "update"], { cwd: dir, env: ENV, encoding: "utf8" });
    assert.match(out, /updated runward\/adapters\/pre-commit \(changed upstream\)/);
    assert.match(out, /kept runward\/adapters\/kiro-hooks\.json \(you edited it/);
    const pc = readFileSync(join(dir, "runward", "adapters", "pre-commit"), "utf8");
    assert.ok(pc.includes(`RUNWARD_VERSION="${VERSION}"`), "the refreshed hook runs this release");
    assert.deepEqual(unpinnedInvocations(pc), []);
    const after = JSON.parse(readFileSync(lockPath, "utf8"));
    assert.equal(after.files["adapters/pre-commit"], sha(pc), "the lock now records the stamped copy");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the stamped pre-commit: the local install only when it is that version, else the pinned npx", { skip: process.platform === "win32" ? "POSIX sh harness" : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-adapter-hook-"));
  try {
    const hook = join(dir, "pre-commit");
    writeFileSync(hook, stampAdapterVersion(readFileSync(join(ADAPTERS, "pre-commit"), "utf8"), "9.9.9"));
    chmodSync(hook, 0o755);
    // Stubs: a PATH holding only a fake `npx` and a fake global `runward`, each printing who ran.
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npx"), '#!/bin/sh\necho "npx $*"\n'); chmodSync(join(bin, "npx"), 0o755);
    writeFileSync(join(bin, "runward"), '#!/bin/sh\necho "GLOBAL $*"\n'); chmodSync(join(bin, "runward"), 0o755);
    const run = () => spawnSync("/bin/sh", [hook], { cwd: dir, encoding: "utf8", env: { PATH: `${bin}:/usr/bin:/bin` } });

    let r = run();
    assert.equal(r.stdout.trim(), "npx --yes runward@9.9.9 check --strict", "no local install: the pinned npx, never the global");

    mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
    const local = join(dir, "node_modules", ".bin", "runward");
    writeFileSync(local, '#!/bin/sh\nif [ "$1" = --version ]; then echo 9.9.8; else echo "LOCAL $*"; fi\n'); chmodSync(local, 0o755);
    r = run();
    assert.equal(r.stdout.trim(), "npx --yes runward@9.9.9 check --strict", "a local install of ANOTHER version is not used");

    writeFileSync(local, '#!/bin/sh\nif [ "$1" = --version ]; then echo 9.9.9; else echo "LOCAL $*"; fi\n');
    r = run();
    assert.equal(r.stdout.trim(), "LOCAL check --strict", "a local install of that version runs");

    // An unstamped template (copied by hand from the repository) refuses loudly instead of
    // running npx with a placeholder: exit 2, the question could not be asked.
    writeFileSync(hook, readFileSync(join(ADAPTERS, "pre-commit"), "utf8"));
    r = run();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /invalid runward version/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the packaged client hooks and the wire entries run package.json's version", () => {
  const hooks = [
    "plugins/runward-gate/hooks/hooks.json", "packaging/codex/hooks/hooks.json", "packaging/gemini/hooks/hooks.json",
    "packaging/cursor/hooks.json", "packaging/copilot/hooks/runward-gate.json", "packaging/kiro/hooks/runward-gate.kiro.hook",
  ];
  const offenders = [];
  for (const rel of hooks) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    for (const o of unpinnedInvocations(text)) offenders.push(`${rel}: ${o}`);
    const pins = [...text.matchAll(/runward@(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
    if (pins.length === 0) offenders.push(`${rel}: no pinned invocation found (the sweep went blind)`);
    for (const v of pins) if (v !== VERSION) offenders.push(`${rel}: runs runward@${v}, package.json is ${VERSION}`);
  }
  for (const [name, text] of [["wire claude entry", mergeClaudeSettings(null)], ["wire kiro hook", kiroHookContent()]]) {
    if (unpinnedInvocations(text).length || !text.includes(`runward@${VERSION} gate-hook`)) offenders.push(`${name}: not pinned to ${VERSION}`);
  }
  assert.deepEqual(offenders, [], "a shipped hook runs whatever runward the machine has, or a stale one:\n  " + offenders.join("\n  "));
});
