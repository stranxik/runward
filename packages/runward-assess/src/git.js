// git.js: reading one commit from a repository's object store, without a checkout.
//
// The tree is written from `ls-tree` and `cat-file --batch`: no index, no smudge filter, no
// export-ignore, no modification time ever read. What a measure sees of a commit is therefore the
// committed bytes, the same on every machine, whatever the working copy holds.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { cmp } from "./canon.js";

/** A fixed environment for every git call: nothing of the caller's configuration reaches the output. */
export function gitEnv() {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: "/nonexistent",
    LC_ALL: "C",
    LANG: "C",
    TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 30, ...opts });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "", error: r.error ? String(r.error.code || r.error) : null, signal: r.signal ?? null };
}

export function git(repo, args, opts = {}) {
  const r = run("git", ["-C", repo, ...args], { env: gitEnv(), ...opts });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${(r.err || r.error || "").trim()}`);
  return r.out;
}

export function tryGit(repo, args) {
  const r = run("git", ["-C", repo, ...args], { env: gitEnv() });
  return r.code === 0 ? r.out : null;
}

/** The commit a revision names, its tree and its committer date (an ISO label, never a clock). */
export function commitInfo(repo, rev) {
  const commit = git(repo, ["rev-parse", "--verify", `${rev}^{commit}`]).trim();
  const [tree, committedAt, parents] = git(repo, ["show", "-s", "--format=%T%n%cI%n%P", commit]).split("\n");
  return { commit, tree: tree.trim(), committedAt: committedAt.trim(), parents: (parents ?? "").trim().split(" ").filter(Boolean) };
}

/** Every entry of the committed tree, sorted by path; submodules are counted, never followed. */
export function listTree(repo, commit) {
  const ls = git(repo, ["ls-tree", "-r", "-z", "--full-tree", "-l", commit]);
  const entries = [];
  let submodules = 0;
  for (const rec of ls.split("\0")) {
    if (!rec) continue;
    const tab = rec.indexOf("\t");
    const [mode, type, sha, size] = rec.slice(0, tab).trim().split(/\s+/);
    const path = rec.slice(tab + 1);
    if (type === "commit") { submodules++; continue; }
    entries.push({ path, mode, sha, size: size === "-" ? 0 : Number(size) });
  }
  entries.sort((a, b) => cmp(a.path, b.path));
  return { entries, submodules };
}

/** Reads many blobs in one `cat-file --batch` call; binary-safe. Returns Map(sha -> Buffer). */
export function readBlobs(repo, shas) {
  const unique = [...new Set(shas)];
  const out = new Map();
  if (!unique.length) return out;
  const CHUNK = 4000;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK);
    const r = spawnSync("git", ["-C", repo, "cat-file", "--batch"], { input: part.join("\n") + "\n", maxBuffer: 2 ** 31 - 1, env: gitEnv() });
    if (r.status !== 0) throw new Error("git cat-file --batch failed");
    const buf = r.stdout;
    let off = 0;
    for (const sha of part) {
      const nl = buf.indexOf(10, off);
      const header = buf.subarray(off, nl).toString("utf8").split(" ");
      if (header[1] === "missing") { off = nl + 1; continue; }
      const len = Number(header[2]);
      out.set(sha, buf.subarray(nl + 1, nl + 1 + len));
      off = nl + 1 + len + 1;
    }
  }
  return out;
}

/** Writes the committed tree of `commit` into `dest`; returns its inventory. */
export function exportTree(repo, commit, dest) {
  const { entries, submodules } = listTree(repo, commit);
  const blobs = readBlobs(repo, entries.map((e) => e.sha));
  for (const e of entries) {
    const file = join(dest, e.path);
    mkdirSync(dirname(file), { recursive: true });
    const body = blobs.get(e.sha) ?? Buffer.alloc(0);
    if (e.mode === "120000") {
      try { symlinkSync(body.toString("utf8"), file); } catch { /* an unrepresentable link is skipped */ }
    } else writeFileSync(file, body, { mode: e.mode === "100755" ? 0o755 : 0o644 });
  }
  return { entries, submodules };
}

/** The window of a record: the commits in (from, to], first parents only, oldest last. */
export function windowCommits(repo, to, from) {
  const range = from ? [`${from}..${to}`] : [to];
  const args = ["rev-list", "--first-parent", ...range];
  if (!from) args.splice(2, 0, "-n", "101");
  const list = git(repo, args).split("\n").filter(Boolean);
  if (from) return { from, commits: list, basis: "previous-record" };
  // First record: the lower bound is the 100th first-parent commit before `to` (grille@1, rule D5).
  if (list.length <= 100) return { from: null, commits: list, basis: "whole-history" };
  return { from: list[100], commits: list.slice(0, 100), basis: "100-first-parent" };
}

/** Every commit (all parents) in the window, for the reachability of merge commits and authorship. */
export function allCommitsIn(repo, to, from) {
  const args = from ? ["rev-list", `${from}..${to}`] : ["rev-list", to];
  return git(repo, args).split("\n").filter(Boolean);
}
