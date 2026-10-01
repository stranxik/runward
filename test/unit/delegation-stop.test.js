// ADR-0088 decision 9 (stage 1) and implementation order step 4: the stop, CODEOWNERS on the charter
// and the pre-merge paths, and Dependabot's cooldown.
//
// What is pinned here: the stop reads unset and `off` as off and any other value as on (a typo stops);
// it refuses only when the stop is on and a delegate identity (the App, plus the default branch charter's
// delegates) opened, pushed or authored the pull request; the script reads `delegates:` exactly as the
// gate's parser does; the workflow runs on `pull_request_target`, never checks out or runs the pull
// request's code, holds read-only permissions, and names the check the runbook makes required; the
// stage-1 limits are printed; CODEOWNERS names the charter, the lock, `.github/**` and the pre-merge
// paths of decision 7; every Dependabot ecosystem carries a cooldown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isStopOn, charterDelegates, decide, BUILTIN_DELEGATES, STAGE1_NOTE, BUDGET_NOTE } from "../../scripts/delegation-stop.mjs";
import { parseCharter } from "../../dist/lib/delegation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const SCRIPT = join(ROOT, "scripts", "delegation-stop.mjs");

const CHARTER_BLOCK = ["---", "charter: runward-delegation/1", "delegates:", "  - runward-steward[bot]", "  - claude", "  - \"codex\"", "class-R: maintainer", "---", "prose"].join("\n");
const CHARTER_INLINE = ["---", "charter: runward-delegation/1", "delegates: [claude, other-bot[bot]]", "---"].join("\n");

test("stop: unset and off are off; on, and any other value, are a stop", () => {
  for (const v of [undefined, "", "  ", "off", "OFF", " Off "]) assert.equal(isStopOn(v), false, String(v));
  for (const v of ["on", "ON", "true", "1", "of", "stop"]) assert.equal(isStopOn(v), true, v);
});

test("stop: the script reads delegates exactly as the gate's charter parser does", () => {
  for (const text of [CHARTER_BLOCK, CHARTER_INLINE]) {
    assert.deepEqual(charterDelegates(text), parseCharter(text).delegates);
  }
  assert.deepEqual(charterDelegates(CHARTER_BLOCK), ["runward-steward[bot]", "claude", "codex"]);
  assert.deepEqual(charterDelegates(CHARTER_INLINE), ["claude", "other-bot[bot]"]);
  assert.deepEqual(charterDelegates("no frontmatter"), []);
});

test("stop: refuses only when on and a delegate identity opened, pushed or authored the pull request", () => {
  const app = BUILTIN_DELEGATES[0];
  assert.equal(app, "runward-steward[bot]");
  // Off: never refuses, a delegate's pull request included.
  assert.equal(decide({ stopValue: "off", charterText: null, identities: [app] }).refuse, false);
  assert.equal(decide({ stopValue: undefined, charterText: null, identities: [app] }).refuse, false);
  // On: the App is a delegate with no charter at all, compared case-insensitively.
  const r = decide({ stopValue: "on", charterText: null, identities: ["stranxik", "Runward-Steward[bot]"] });
  assert.equal(r.refuse, true);
  assert.deepEqual(r.matched, ["Runward-Steward[bot]"]);
  // On, with a charter: its delegates join the App, once each.
  const c = decide({ stopValue: "on", charterText: CHARTER_INLINE, identities: ["stranxik", "other-bot[bot]"] });
  assert.deepEqual(c.delegates, ["runward-steward[bot]", "claude", "other-bot[bot]"]);
  assert.equal(c.refuse, true);
  // On, no delegate: passes. The maintainer's account is not a delegate identity (the stage-1 limit).
  assert.equal(decide({ stopValue: "on", charterText: CHARTER_BLOCK, identities: ["stranxik", "web-flow", ""] }).refuse, false);
});

function runScript(env, charter) {
  const dir = mkdtempSync(join(tmpdir(), "rw-stop-"));
  try {
    const charterPath = join(dir, "delegation.md");
    if (charter) writeFileSync(charterPath, charter);
    const commits = join(dir, "commit-logins");
    writeFileSync(commits, (env.commits ?? []).join("\n"));
    const summary = join(dir, "summary.md");
    const e = { PATH: process.env.PATH, PR_AUTHOR: env.author ?? "", SENDER: env.sender ?? "", COMMIT_LOGINS_FILE: commits, GITHUB_STEP_SUMMARY: summary };
    if (env.stop !== undefined) e.RUNWARD_DELEGATION_STOP = env.stop;
    let out, code = 0;
    try { out = execFileSync(process.execPath, [SCRIPT, charterPath], { env: e, encoding: "utf8" }); }
    catch (x) { out = x.stdout ?? ""; code = x.status; }
    return { out, code, summary: readFileSync(summary, "utf8") };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("stop: the script exits 1 on a refusal, 0 otherwise, and always prints the stage-1 limits", () => {
  const off = runScript({ author: "runward-steward[bot]" });
  assert.equal(off.code, 0, off.out);
  assert.match(off.out, /RUNWARD_DELEGATION_STOP: off/);
  const refused = runScript({ stop: "on", author: "stranxik", sender: "stranxik", commits: ["claude"] }, CHARTER_BLOCK);
  assert.equal(refused.code, 1, refused.out);
  assert.match(refused.out, /REFUSED: the stop is on and claude is a delegate identity/);
  assert.match(refused.out, /::error::delegation stop/);
  const human = runScript({ stop: "on", author: "stranxik", sender: "stranxik", commits: ["stranxik", "web-flow"] }, CHARTER_BLOCK);
  assert.equal(human.code, 0, human.out);
  const typo = runScript({ stop: "yes", sender: "runward-steward[bot]" });
  assert.equal(typo.code, 1, "a value other than off is a stop");
  assert.match(typo.out, /read "yes", any value other than off is a stop/);
  for (const r of [off, refused, human]) {
    assert.ok(r.out.includes(STAGE1_NOTE), "the stage-1 limit is printed");
    assert.ok(r.out.includes(BUDGET_NOTE), "the budget is said to be published, not enforced");
    assert.match(r.summary, /### delegation stop/);
  }
  assert.match(STAGE1_NOTE, /an agent holding the maintainer's credential can clear this variable/);
});

test("stop: the workflow runs the default branch's stop, never the pull request's code, read-only", () => {
  const wf = read(".github/workflows/delegation-stop.yml");
  assert.match(wf, /^on:\n {2}pull_request_target:\n {4}types: \[opened, synchronize, reopened, ready_for_review\]$/m);
  assert.match(wf, /^permissions: \{\}$/m, "no default permission");
  assert.match(wf, /permissions:\n {6}contents: read\n {6}pull-requests: read\n/, "the job reads, never writes");
  assert.ok(!/:\s*write\b/.test(wf), "no write permission anywhere");
  assert.ok(!/\bref:/.test(wf), "the checkout takes the event's default ref (the default branch): the pull request's code is never checked out");
  assert.ok(!/head\.(sha|ref)/.test(wf), "nothing reads the pull request's head");
  assert.match(wf, /persist-credentials: false/);
  assert.match(wf, /^ {4}name: delegation stop$/m, "the check name the runbook makes required");
  assert.match(wf, /RUNWARD_DELEGATION_STOP: \$\{\{ vars\.RUNWARD_DELEGATION_STOP \}\}/, "the stop is a repository variable");
  assert.match(wf, /run: node scripts\/delegation-stop\.mjs runward\/delegation\.md/);
  // Event text reaches the shell only through env, never interpolated into a script.
  const scripts = [...wf.matchAll(/^ {8}run: \|\n((?: {10}.*\n?)+)/gm)].map((m) => m[1])
    .concat([...wf.matchAll(/^ {8}run: (?!\|)(.*)$/gm)].map((m) => m[1]));
  assert.equal(scripts.length, 2, "two run steps");
  for (const sc of scripts) assert.ok(!sc.includes("${{"), `no expression inside a run script: ${sc}`);
  const runbook = read("runward/runbook.md");
  assert.match(runbook, /gh variable set RUNWARD_DELEGATION_STOP --body on --repo stranxik\/runward/);
  assert.match(runbook, /an agent holding the maintainer's credential can clear it/);
});

test("CODEOWNERS: the charter, the lock, .github/** and the pre-merge paths of ADR-0088 decision 7 name the maintainer", () => {
  const co = read(".github/CODEOWNERS");
  const owned = new Map(co.split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => { const [p, ...o] = l.trim().split(/\s+/); return [p, o]; }));
  assert.deepEqual(owned.get("*"), ["@stranxik"], "the default owner stays");
  for (const p of [
    "/runward/delegation.md", "/runward/scaffold-lock.json", "/.github/",
    "/src/lib/conformance*", "/src/lib/evidence*", "/src/lib/verdict*",
    "/src/commands/wire.ts", "/src/commands/ratify.ts", "/src/commands/propose.ts", "/src/lib/harness.ts",
    "/plugins/runward-gate/hooks/", "/package.json", "/AGENTS.md", "/SECURITY.md", "/README.md",
  ]) assert.deepEqual(owned.get(p), ["@stranxik"], `${p} is owned by the maintainer`);
});

test("Dependabot: every ecosystem carries a cooldown (ADR-0088 class D), the TypeScript major stays ignored", () => {
  const db = read(".github/dependabot.yml");
  const ecosystems = db.match(/^ {2}- package-ecosystem:/gm) ?? [];
  const cooldowns = db.match(/^ {4}cooldown:\n {6}default-days: 7$/gm) ?? [];
  assert.equal(ecosystems.length, 3);
  assert.equal(cooldowns.length, ecosystems.length, "one cooldown per ecosystem");
  assert.match(db, /dependency-name: typescript\n {8}update-types: \["version-update:semver-major"\]/);
});
