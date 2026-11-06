#!/usr/bin/env node
// The runward-fleet demonstration, reproducible: three real sources of this repository, built into
// one page.
//
//   npm run build && node scripts/fleet-demo.mjs --out <dir> [--lang fr] [--no-replay]
//
//   1. runward's own mission, at the checked-out commit: check --strict --json, the attestation,
//      verify --json, the witness and the Markdown summary (the HTML report is written inside the
//      project by design, and this script leaves the tree untouched, so it is not among them);
//   2. the example mission shipped with the package (examples/request-triage): check --strict --json;
//   3. the verdicts of 40 past revisions, replayed: a prototype of ADR-0093's `ledger replay` (D2,
//      not delivered), each past tree judged by THIS build, read from git in a temporary worktree
//      that is removed after, written as records labelled `origin: replayed`.
// It also declares the build provenance of the v0.46.0 tarball, a real Sigstore bundle kept in
// test/fixtures/fleet/sigstore/, next to the runward mission, under a trust policy that pins its real
// signer: runward-fleet verifies it offline and raises nothing, because that signature is on a tag
// and covers a tarball, not this verdict. That refusal is the point of showing it.
//
// This is a script of the repository, not of runward-fleet: it spawns git and the runward CLI to
// produce the exports, which runward-fleet itself never does (it reads no repository). It writes
// only under <dir> and in temporary worktrees it removes; it needs a full clone (tags and history),
// except with --no-replay, which leaves the third source out (CI's shallow clone runs it that way to
// exercise the fleet Action on this tree's own exports).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const FLEET = join(ROOT, "packages", "runward-fleet", "src", "cli.js");
const FIX = join(ROOT, "test", "fixtures", "fleet", "sigstore");

// Nineteen release tags and twenty-one commits of main, oldest first: the range the 2026-11-05
// prototype replayed, closed on main's head when this script was written. Fixed, so a second run
// judges the same trees.
const REVISIONS = [
  "v0.36.0", "v0.36.1", "v0.36.2", "v0.37.0", "v0.37.1", "v0.38.0", "v0.39.0", "v0.40.0", "v0.41.0", "v0.42.0",
  "v0.42.1", "v0.42.2", "v0.42.3", "v0.43.0", "v0.43.1", "v0.44.0", "v0.44.1", "v0.45.0", "v0.46.0",
  "b7d8c6263754", "63840bfbb24f", "4541a90c3b03", "f9777f509c8c", "53c4b5be88d4", "78074dfe98dc", "916b6f471bb4",
  "944f785ba280", "2d2cd84a2f30", "8c9db69b1a6c", "7bb42db35f44", "a3a614f487c8", "065afaebb4fb", "98b7dfbc29ed",
  "df9ae80e1861", "9149aa610539", "fcef954fea25", "7dbbdc472882", "8ffdf7c5162f", "61d5041fe000", "32d8425b1cb4",
];

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const OUT = opt("--out");
const LANG = opt("--lang") ?? "en";
const REPLAY = !args.includes("--no-replay");
if (!OUT) { console.error("usage: node scripts/fleet-demo.mjs --out <dir> [--lang en|fr] [--no-replay]"); process.exit(2); }
if (!existsSync(CLI)) { console.error("dist/cli.js is missing: run npm run build first"); process.exit(2); }
const out = resolve(OUT);
const ex = (...p) => join(out, "exports", ...p);
mkdirSync(ex("runward", "replay"), { recursive: true });
mkdirSync(ex("example"), { recursive: true });
mkdirSync(join(out, "trust"), { recursive: true });

const git = (...a) => execFileSync("git", ["-C", ROOT, "-c", "core.quotepath=false", ...a], { encoding: "utf8" }).trim();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
function runward(argv, file) {
  const r = spawnSync(process.execPath, [CLI, ...argv], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (file) writeFileSync(file, r.stdout);
  return r;
}

const head = git("rev-parse", "HEAD");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const judge = `runward@${version} built from ${head.slice(0, 12)}`;

// 1. runward's own mission, and 2. the example mission.
runward(["check", "--strict", "--json"], ex("runward", "check.json"));
runward(["check", "--strict", "--attest"], ex("runward", "verdict.intoto.json"));
runward(["verify", ex("runward", "verdict.intoto.json"), "--json"], ex("runward", "verify.json"));
runward(["check", "--strict", "--json", "--witness", ex("runward", "witness.json")]);
runward(["report", "--format", "md"], ex("runward", "summary.md"));
runward(["check", "--strict", "--json", "-p", "examples/request-triage"], ex("example", "check.json"));

// 3. The replay: each revision's tree, judged by this build, read-only from git.
const records = [];
for (const rev of REPLAY ? REVISIONS : []) {
  const commit = git("rev-parse", `${rev}^{commit}`);
  const wt = join(out, `.wt-${commit.slice(0, 12)}`);
  if (existsSync(wt)) git("worktree", "remove", "--force", wt);
  git("worktree", "add", "--detach", "--quiet", wt, commit);
  try {
    const r = spawnSync(process.execPath, [CLI, "check", "--strict", "--json", "-p", wt], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    let payload = null;
    try { payload = JSON.parse(r.stdout ?? ""); } catch { payload = null; }
    const file = ex("runward", "replay", `${commit.slice(0, 12)}.check.json`);
    if (payload) {
      // The payload's `mission` is the absolute path of the temporary worktree: replaced, the rest kept as emitted.
      payload.mission = `(replay worktree of ${commit.slice(0, 12)})`;
      writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
    }
    const read = (p) => (existsSync(join(wt, p)) ? readFileSync(join(wt, p)) : null);
    const bypass = read("runward/gate-bypass.log");
    const a = payload?.delegation?.assurance;
    records.push({
      _type: "runward.dev/record/v1 (draft shape, ADR-0093 decision 6; not a published contract)",
      origin: "replayed",
      judgedBy: judge,
      repository: "github.com/stranxik/runward",
      ref: rev,
      commit,
      commitSource: "git (replay worktree)",
      committedAt: git("show", "-s", "--format=%cI", commit),
      run: { exitCode: r.status },
      subjects: payload ? [{ name: "check --strict --json payload", digest: { sha256: sha256(readFileSync(file)) }, file: `replay/${commit.slice(0, 12)}.check.json` }] : [],
      tree: {
        gateBypassLog: bypass ? { lines: bypass.toString("utf8").split("\n").filter((l) => l.trim()).length, sha256: sha256(bypass) } : "not-observed",
        delegationStage: payload?.delegation?.stage ?? "not-observed",
        assurance: a ? { declared: a.declared, inForce: a.inForce, degraded: a.degraded } : "not-observed",
      },
      verdict: payload ? { verdict: payload.verdict, exitCode: payload.exitCode, currentGate: payload.currentGate, gaps: payload.gaps } : "not-observed",
      implemented: "ci-declared is the ceiling for a CLI record; a replay fills no verb",
      signatureVerified: false,
    });
    console.log(`${rev.padEnd(13)} ${commit.slice(0, 12)} exit=${r.status} verdict=${payload?.verdict ?? "-"}`);
  } finally {
    git("worktree", "remove", "--force", wt);
  }
}
if (REPLAY) {
  git("worktree", "prune");
  writeFileSync(ex("runward", "records.jsonl"), `${records.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

// The real release provenance, and a trust policy that pins its real signer.
copyFileSync(join(FIX, "trusted_root.json"), join(out, "trust", "sigstore-public-good.trusted_root.json"));
copyFileSync(join(FIX, "runward-0.46.0.provenance.intoto.jsonl"), ex("runward", "runward-0.46.0.provenance.intoto.jsonl"));
writeFileSync(join(out, "trust-policy.json"), `${JSON.stringify({
  format: "runward-fleet-trust-policy/0",
  trustedRoots: ["trust/sigstore-public-good.trusted_root.json"],
  signers: [{
    id: "runward-release-builder",
    kind: "sigstore",
    repositories: ["github.com/stranxik/runward"],
    issuer: "https://token.actions.githubusercontent.com",
    workflow: "https://github.com/stranxik/runward/.github/workflows/build-and-attest.yml@refs/tags/v0.46.0",
    workflowDigests: ["192ca3d63c456a4235aac8062aff21f16733c520"],
    ref: "refs/tags/v0.46.0",
    runnerEnvironment: "github-hosted",
  }],
}, null, 2)}\n`);

const exp = (file, producedBy, at) => ({ file, producedBy, at });
const fleet = {
  format: "runward-fleet-manifest/0",
  title: "runward-fleet demonstration",
  asOf: git("show", "-s", "--format=%cs", head),
  lang: LANG,
  trustPolicy: "trust-policy.json",
  missions: [
    {
      id: "runward",
      name: "stranxik/runward",
      repository: "github.com/stranxik/runward",
      path: ".",
      role: LANG === "fr" ? "la mission de runward lui-même, sur sa branche principale" : "runward's own mission, on its main branch",
      commit: head,
      expects: ["check", "attestation", "verify", "witness", "summary", ...(REPLAY ? ["history"] : []), "signature"],
      exports: {
        check: exp("exports/runward/check.json", "runward check --strict --json", judge),
        attestation: exp("exports/runward/verdict.intoto.json", "runward check --strict --attest", judge),
        verify: exp("exports/runward/verify.json", "runward verify verdict.intoto.json --json", judge),
        witness: exp("exports/runward/witness.json", "runward check --strict --witness", judge),
        summary: exp("exports/runward/summary.md", "runward report --format md", judge),
        ...(REPLAY ? { history: exp("exports/runward/records.jsonl", "node scripts/fleet-demo.mjs (a prototype of ledger replay, ADR-0093 D2)", `${REVISIONS.length} revisions judged by ${judge}`) } : {}),
      },
      signatures: [{
        covers: "attestation",
        kind: "sigstore-bundle",
        file: "exports/runward/runward-0.46.0.provenance.intoto.jsonl",
        producedBy: "actions/attest-build-provenance in build-and-attest.yml, release v0.46.0: it covers the tarball, not this verdict",
      }],
    },
    {
      id: "example",
      name: "stranxik/runward · examples/request-triage",
      repository: "github.com/stranxik/runward",
      path: "examples/request-triage",
      role: LANG === "fr" ? "la mission d'exemple livrée avec le paquet" : "the example mission shipped with the package",
      commit: head,
      expects: ["check"],
      exports: { check: exp("exports/example/check.json", "runward check --strict --json -p examples/request-triage", judge) },
    },
  ],
};
writeFileSync(join(out, "fleet.json"), `${JSON.stringify(fleet, null, 2)}\n`);

const r = spawnSync(process.execPath, [FLEET, "build", join(out, "fleet.json"), "--out", join(out, "site")], { encoding: "utf8" });
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exitCode = r.status ?? 1;
