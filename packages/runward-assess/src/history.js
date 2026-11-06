// history.js: what a repository's history says, read offline from its object store.
//
// Three readers: the secret patterns over every blob reachable from the commit (SEC-04), the
// dependence on few people over the window (GOU-04, CHAOSS), and the version tags merged into the
// commit (GOU-06). No identity is ever written out: authors are hashed, matches are fingerprinted.
import { spawnSync } from "node:child_process";
import { git, gitEnv } from "./git.js";
import { cmp, sha256 } from "./canon.js";

const unobserved = (reason) => ({ $unobserved: reason });

/** Fake credentials of the shapes the patterns read, assembled here so no file holds one. */
export function plantedCredentials() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ234567";
  const a = "abcdefghijkmnopqrstuvwxyz0123456789";
  const pick = (alphabet, n, seed) => Array.from({ length: n }, (_, i) => alphabet[(i * 7 + seed) % alphabet.length]).join("");
  return [
    { pattern: "aws-access-key-id", text: "key = " + "AK" + "IA" + pick(A, 16, 3) },
    { pattern: "github-token", text: "token: " + "gh" + "p_" + pick(a + A, 36, 5) },
    { pattern: "npm-token", text: "//registry.npmjs.org/:_authToken=" + "np" + "m_" + pick(a + A, 36, 11) },
    { pattern: "private-key-block", text: "-----BEGIN " + "RSA PRIVATE" + " KEY-----\n" + pick(a + A, 64, 2) },
  ];
}

function compilePatterns(spec) { return spec.patterns.map((p) => ({ id: p.id, re: new RegExp(p.re, "g") })); }

export function scanText(text, patterns) {
  const found = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) found.push({ pattern: p.id, fingerprint: sha256(`${p.id}\0${m[0]}`).slice(0, 16) });
  }
  return found;
}

/** Blobs reachable from `commit`, with their size and the first path that names them. */
function reachableBlobs(repo, commit) {
  const objects = git(repo, ["rev-list", "--objects", commit]).split("\n").filter(Boolean);
  const paths = new Map();
  const shas = [];
  for (const line of objects) {
    const sp = line.indexOf(" ");
    const sha = sp < 0 ? line : line.slice(0, sp);
    const path = sp < 0 ? "" : line.slice(sp + 1);
    if (!paths.has(sha)) { paths.set(sha, path); shas.push(sha); }
  }
  const r = spawnSync("git", ["-C", repo, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], { input: shas.join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 30, env: gitEnv() });
  if (r.status !== 0) throw new Error("git cat-file --batch-check failed");
  const blobs = [];
  for (const l of r.stdout.split("\n")) {
    const [sha, type, size] = l.split(" ");
    if (type === "blob") blobs.push({ sha, size: Number(size), path: paths.get(sha) ?? "" });
  }
  return blobs;
}

/** Reads blobs in chunks bounded by bytes, so a large history never sits in memory whole. */
function* blobChunks(repo, blobs, maxBytes = 48 * 1024 * 1024) {
  let chunk = [], bytes = 0;
  const flush = function* () {
    if (!chunk.length) return;
    const r = spawnSync("git", ["-C", repo, "cat-file", "--batch"], { input: chunk.map((b) => b.sha).join("\n") + "\n", maxBuffer: 2 ** 31 - 1, env: gitEnv() });
    if (r.status !== 0) throw new Error("git cat-file --batch failed");
    const buf = r.stdout;
    let off = 0;
    for (const b of chunk) {
      const nl = buf.indexOf(10, off);
      const len = Number(buf.subarray(off, nl).toString("utf8").split(" ")[2]);
      yield { ...b, body: buf.subarray(nl + 1, nl + 1 + len) };
      off = nl + 1 + len + 1;
    }
    chunk = []; bytes = 0;
  };
  for (const b of blobs) {
    if (bytes + b.size > maxBytes && chunk.length) yield* flush();
    chunk.push(b); bytes += b.size;
  }
  yield* flush();
}

export function secrets(repo, commit, spec, exceptions = []) {
  const patterns = compilePatterns(spec);
  // The control first: a scan that cannot see a planted credential proves nothing by its silence.
  const planted = plantedCredentials();
  const blind = planted.filter((c) => !scanText(c.text, patterns).some((f) => f.pattern === c.pattern));
  if (blind.length) {
    const why = `the secret patterns did not see ${blind.length} planted credential(s) (${blind.map((b) => b.pattern).join(", ")}): the scan would be blind`;
    return { facts: { "m.sec04.control_detected": false, "m.sec04.blobs_scanned": 0, "m.sec04.secrets_unexcepted": unobserved(why) }, details: { findings: [] } };
  }
  const blobs = reachableBlobs(repo, commit);
  const skipped = { binary: 0, large: 0 };
  const findings = new Map();
  let scanned = 0;
  const eligible = blobs.filter((b) => { if (b.size > spec.skip.maxBlobBytes) { skipped.large++; return false; } return true; });
  for (const b of blobChunks(repo, eligible)) {
    if (b.body.subarray(0, spec.skip.binaryProbeBytes).includes(0)) { skipped.binary++; continue; }
    scanned++;
    for (const f of scanText(b.body.toString("utf8"), patterns)) {
      const k = `${f.pattern}|${f.fingerprint}`;
      if (!findings.has(k)) findings.set(k, { ...f, path: b.path });
    }
  }
  const excepted = new Set(exceptions.filter((e) => e.criterion === "SEC-04" && e.fingerprint && e.reason).map((e) => e.fingerprint));
  const documented = new Set((spec.documentedExamples ?? []).map((e) => e.fingerprint));
  const list = [...findings.values()].filter((f) => !documented.has(f.fingerprint)).sort((a, b) => cmp(`${a.pattern}|${a.fingerprint}`, `${b.pattern}|${b.fingerprint}`));
  const open = list.filter((f) => !excepted.has(f.fingerprint));
  return {
    facts: { "m.sec04.control_detected": true, "m.sec04.blobs_scanned": scanned, "m.sec04.secrets_unexcepted": open.length },
    details: { blobs: blobs.length, skipped, findings: open.map((f) => ({ fingerprint: f.fingerprint, path: f.path, pattern: f.pattern })), excepted: list.length - open.length },
  };
}

// ------------------------------------------------------------------------------------ CHAOSS
export function contributions(repo, commit, from, bots, domains, share = [1, 2]) {
  const range = from ? [`${from}..${commit}`] : [commit];
  const log = git(repo, ["log", "--use-mailmap", "--no-merges", "--format=%aN%x09%aE", ...range]).split("\n").filter(Boolean);
  const botLogin = new Set(bots.logins.map((l) => l.toLowerCase()));
  const emailRes = bots.emailPatterns.map((p) => new RegExp(p, "i"));
  const nameRe = new RegExp(bots.namePattern, "i");
  const personal = new Set(domains.personal);
  const counts = new Map();
  const orgs = new Map();
  let botCommits = 0;
  for (const line of log) {
    const [name = "", email = ""] = line.split("\t");
    const e = email.trim().toLowerCase();
    if (botLogin.has(name.trim().toLowerCase()) || nameRe.test(name) || emailRes.some((re) => re.test(e))) { botCommits++; continue; }
    const id = sha256(`author\0${e || name.trim().toLowerCase()}`).slice(0, 16);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const domain = e.includes("@") ? e.split("@").pop() : "";
    const org = !domain || personal.has(domain) || domain.endsWith(".noreply.github.com") ? `person:${id}` : `org:${sha256(`org\0${domain}`).slice(0, 16)}`;
    orgs.set(org, (orgs.get(org) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const factor = (m) => {
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
    let acc = 0, n = 0;
    for (const [, c] of sorted) { acc += c; n++; if (acc * share[1] >= total * share[0]) break; }
    return total ? n : 0;
  };
  if (!total) {
    const why = "no non-bot commit in the window";
    return { facts: { "m.gou04.window_commits": 0, "m.gou04.authors": 0, "m.gou04.absence_factor": unobserved(why), "m.gou04.elephant_factor": unobserved(why) }, details: { botCommits } };
  }
  return {
    facts: { "m.gou04.window_commits": total, "m.gou04.authors": counts.size, "m.gou04.absence_factor": factor(counts), "m.gou04.elephant_factor": factor(orgs) },
    details: { botCommits, organisations: orgs.size, shares: [...counts.values()].sort((a, b) => b - a).slice(0, 10) },
  };
}

export function versionTags(repo, commit) {
  const names = git(repo, ["tag", "--merged", commit]).split("\n").map((s) => s.trim()).filter(Boolean);
  return names.map((n) => (/^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(n) ?? [])[1]).filter(Boolean).sort(cmp);
}
