// snapshot.js: the only stage that reads the network. It writes a directory: facts.json (the x.*
// facts of the catalogue), profile-evidence.json, raw/ (normalised captures, no login and no address),
// tools/ (the gate it acquired) and manifest.json, which names every file with its sha256. The
// snapshot's digest is the sha256 of manifest.json; the score refuses a file whose bytes differ.
//
// Every fact carries its scope (facts-1.json): repo-now (a setting read today, valid only for the
// commit the default branch pointed at), commit (about this commit, as known today), window (the
// record's window, as the forge reports it today), registry (the published versions, immutable).
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonJSON, sha256, cmp, ratio } from "./canon.js";
import { commitInfo, windowCommits, allCommitsIn, git, tryGit, exportTree } from "./git.js";
import { plainText, factualCount, lexiconHits } from "./readers.js";
import { dirDigest } from "./tooldigest.js";
import { TOOL } from "./grid-model.js";

const unobserved = (reason) => ({ $unobserved: reason });
const hash = (s) => sha256(`login\0${String(s).toLowerCase()}`).slice(0, 16);
const DAY = 86400000;

function semverParts(v) { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v)); return m ? m.slice(1, 4).map(Number) : null; }
function cmpSemver(a, b) { const x = semverParts(a), y = semverParts(b); if (!x || !y) return cmp(String(a), String(b)); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
/** ">= 0.35.0, < 0.42.3" style ranges, as GitHub advisories write them. */
export function inRange(version, range) {
  return String(range ?? "").split(",").map((s) => s.trim()).filter(Boolean).every((c) => {
    const m = /^(>=|<=|>|<|=)?\s*v?(\d+\.\d+\.\d+)/.exec(c);
    if (!m) return false;
    const d = cmpSemver(version, m[2]);
    switch (m[1] ?? "=") { case ">=": return d >= 0; case "<=": return d <= 0; case ">": return d > 0; case "<": return d < 0; default: return d === 0; }
  });
}

function lockPackages(repo, commit) {
  const files = git(repo, ["ls-tree", "-r", "--name-only", commit]).split("\n")
    .filter((f) => /(^|\/)package-lock\.json$/.test(f) && !/(^|\/)(node_modules|examples?|templates?|fixtures?|test-[^/]+|demo)\//.test(f));
  const pkgs = new Map();
  for (const f of files) {
    let j; try { j = JSON.parse(git(repo, ["show", `${commit}:${f}`])); } catch { continue; }
    for (const [k, v] of Object.entries(j.packages ?? {})) {
      if (!k || v.link || !v.version) continue;
      const name = v.name ?? k.split("node_modules/").pop();
      pkgs.set(`${name}@${v.version}`, { name, version: v.version });
    }
  }
  return { files, pkgs: [...pkgs.values()].sort((a, b) => cmp(`${a.name}@${a.version}`, `${b.name}@${b.version}`)) };
}

async function osv(t, repo, commit, control, exceptions, asOfMs, vt) {
  const { files, pkgs } = lockPackages(repo, commit);
  if (!files.length) {
    const why = "no package-lock.json at the commit (the only lockfile runward-assess 0.1.0 reads)";
    return { facts: Object.fromEntries(["x.sec03.control_detected", "x.sec03.vulnerable_packages", "x.sec03.high_unexcepted", "x.sec03.open_over_30d"].map((k) => [k, unobserved(why)])), raw: { lockfiles: [] } };
  }
  const queries = [{ package: { ecosystem: "npm", name: control.name }, version: control.version }, ...pkgs.map((p) => ({ package: { ecosystem: "npm", name: p.name }, version: p.version }))];
  const results = [];
  for (let i = 0; i < queries.length; i += 900) {
    const r = await t.get("https://api.osv.dev/v1/querybatch", { method: "POST", body: { queries: queries.slice(i, i + 900) } });
    if (r.status !== "ok") {
      const why = `OSV querybatch answered ${r.status}`;
      return { facts: Object.fromEntries(["x.sec03.control_detected", "x.sec03.vulnerable_packages", "x.sec03.high_unexcepted", "x.sec03.open_over_30d"].map((k) => [k, unobserved(why)])), raw: { lockfiles: files } };
    }
    results.push(...(r.value.results ?? []));
  }
  const controlVulns = results[0]?.vulns ?? [];
  if (!controlVulns.length) {
    const why = `the OSV control ${control.name}@${control.version} came back clean: the base is blind`;
    return { facts: { "x.sec03.control_detected": false, "x.sec03.vulnerable_packages": unobserved(why), "x.sec03.high_unexcepted": unobserved(why), "x.sec03.open_over_30d": unobserved(why) }, raw: { lockfiles: files } };
  }
  const affected = [];
  const ids = new Set();
  results.slice(1).forEach((r, i) => { const v = (r.vulns ?? []).map((x) => x.id).sort(cmp); if (v.length) { affected.push({ ...pkgs[i], vulns: v }); v.forEach((x) => ids.add(x)); } });
  const detail = new Map();
  for (const id of [...ids].sort(cmp)) {
    const r = await t.get(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`);
    if (r.status === "ok") detail.set(id, { aliases: (r.value.aliases ?? []).slice().sort(cmp), published: r.value.published ?? null, severity: String(r.value.database_specific?.severity ?? "UNKNOWN").toUpperCase() });
    else detail.set(id, { aliases: [], published: null, severity: "UNREAD" });
  }
  const excepted = new Set((exceptions ?? []).filter((e) => e.criterion === "SEC-03" && e.id && e.reason).map((e) => e.id));
  const unread = [...detail.values()].filter((d) => d.severity === "UNREAD").length;
  const isExcepted = (id) => excepted.has(id) || (detail.get(id)?.aliases ?? []).some((a) => excepted.has(a));
  const high = [...ids].filter((id) => vt.highSeverities.includes(detail.get(id)?.severity) && !isExcepted(id));
  const old = [...ids].filter((id) => { const p = detail.get(id)?.published; return p && Date.parse(p) + vt.openDays * DAY < asOfMs && !isExcepted(id); });
  return {
    facts: {
      "x.sec03.control_detected": true,
      "x.sec03.vulnerable_packages": affected.length,
      "x.sec03.high_unexcepted": unread ? unobserved(`${unread} vulnerability record(s) could not be read`) : high.length,
      "x.sec03.open_over_30d": unread ? unobserved(`${unread} vulnerability record(s) could not be read`) : old.length,
    },
    raw: { lockfiles: files, packages: pkgs.length, affected: affected.map((a) => ({ package: `${a.name}@${a.version}`, vulns: a.vulns })), vulns: Object.fromEntries([...detail].sort((a, b) => cmp(a[0], b[0]))), control: { package: `${control.name}@${control.version}`, vulns: controlVulns.length } },
  };
}

async function acquireGate({ t, repo, commit, out, registryDoc }) {
  const root = (() => { try { return JSON.parse(git(repo, ["show", `${commit}:package.json`])); } catch { return null; } })();
  const lock = (() => { try { return JSON.parse(git(repo, ["show", `${commit}:package-lock.json`])); } catch { return null; } })();
  const pin = lock?.packages?.["node_modules/runward"] ?? null;
  const tmp = mkdtempSync(join(tmpdir(), "runward-assess-gate-"));
  try {
    let version, source, dirName, tgzSpec, packed = null;
    if (root?.name === "runward") {
      const src = join(tmp, "src");
      exportTree(repo, commit, src);
      if (t.npm(["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], src).code !== 0) return { why: "npm ci failed on the commit's own lockfile" };
      if (t.npm(["run", "build", "--silent"], src).code !== 0) return { why: "npm run build failed at the commit" };
      const p = t.npm(["pack", "--json", "--ignore-scripts", "--pack-destination", tmp], src);
      if (p.code !== 0) return { why: "npm pack failed" };
      const info = JSON.parse(p.out)[0];
      version = root.version; source = "built-from-commit"; dirName = `runward-${commit.slice(0, 12)}`; tgzSpec = join(tmp, info.filename);
      packed = { integrity: info.integrity, registryIntegrity: registryDoc?.versions?.[version]?.dist?.integrity ?? null };
    } else if (pin?.version) {
      version = pin.version; source = "registry, pinned by the lockfile"; dirName = `runward-${version}`; tgzSpec = `runward@${version}`;
    } else return { why: "a gate is declared, but the commit's lockfile pins no runward" };
    const dir = join(out, "tools", dirName);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "runward-assess-gate", private: true }) + "\n");
    const ins = t.npm(["install", tgzSpec, "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error"], dir);
    if (ins.code !== 0) return { why: `npm install ${source === "built-from-commit" ? "of the packed commit" : tgzSpec} failed` };
    const installed = JSON.parse(readFileSync(join(dir, "node_modules", "runward", "package.json"), "utf8"));
    const registryIntegrity = registryDoc?.versions?.[version]?.dist?.integrity ?? null;
    const pinInfo = pin ? { integrity: pin.integrity ?? null, matchesRegistry: !!(pin.integrity && registryIntegrity && pin.integrity === registryIntegrity), version: pin.version } : null;
    return { cli: `tools/${dirName}/node_modules/runward/dist/cli.js`, digest: dirDigest(dir), dir: `tools/${dirName}`, pack: packed, pin: pinInfo, source, version: installed.version };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/**
 * snapshot({ repo, rev, slug, profile, since, out, transport, lexicon, osvControl, bots, acquire })
 * Writes the directory `out` and returns its manifest.
 */
export async function snapshot({ repo, rev, slug, profile, since = null, out, transport: t, lexicon, osvControl, bots, tables, acquire = true, gridId = "grille@1", gridDigest = null, gridData = null, profileDigest = null }) {
  const info = commitInfo(repo, rev);
  const sinceCommit = since ? commitInfo(repo, since).commit : null;
  const win = windowCommits(repo, info.commit, sinceCommit);
  const fromDate = win.from ? commitInfo(repo, win.from).committedAt : null;
  const window = { basis: win.basis, commits: win.commits.length, from: win.from, fromDate, to: info.commit, toDate: info.committedAt };
  const asOf = t.now();
  const asOfMs = Date.parse(asOf);
  const prof = profile.facts ?? {};
  const facts = {};
  const raw = {};
  const ev = { registry: {}, registryVersions: {}, urls: {}, visibility: null };
  const [owner] = slug.split("/");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "raw"), { recursive: true });

  // ---- the repository, today ------------------------------------------------------------------
  const repoR = t.gh(`repos/${slug}`);
  const branch = repoR.status === "ok" ? repoR.value.default_branch : null;
  const head = branch ? t.gh(`repos/${slug}/commits/${encodeURIComponent(branch)}`) : { status: "error" };
  const headAtCapture = head.status === "ok" ? head.value.sha : null;
  if (repoR.status === "ok") {
    ev.visibility = repoR.value.visibility ?? (repoR.value.private ? "private" : "public");
    facts["x.gou03.owner_is_org"] = repoR.value.owner?.type === "Organization";
    facts["x.mar02.stars"] = repoR.value.stargazers_count ?? 0;
    facts["x.mar02.forks"] = repoR.value.forks_count ?? 0;
    raw.repository = { defaultBranch: branch, ownerType: repoR.value.owner?.type ?? null, visibility: ev.visibility };
  } else for (const k of ["x.gou03.owner_is_org", "x.mar02.stars", "x.mar02.forks"]) facts[k] = unobserved(`repos/${slug} answered ${repoR.status}`);
  const isPublic = ev.visibility === "public";

  const pvr = t.gh(`repos/${slug}/private-vulnerability-reporting`);
  facts["x.sec01.pvr_enabled"] = pvr.status === "ok" ? !!pvr.value.enabled : unobserved(`private-vulnerability-reporting answered ${pvr.status}`);

  // ---- branch rules: rulesets and classic protection -------------------------------------------
  if (branch) {
    const rules = t.gh(`repos/${slug}/rules/branches/${encodeURIComponent(branch)}`, { paginate: true });
    const prot = t.gh(`repos/${slug}/branches/${encodeURIComponent(branch)}/protection`);
    const list = rules.status === "ok" ? rules.value : null;
    const classic = prot.status === "ok" ? prot.value : null;
    const classicAbsent = prot.status === "http-404" || (prot.status === "http-403");
    if (list === null && !classic && !classicAbsent) {
      for (const k of ["x.gou02.force_push_blocked", "x.gou02.deletion_blocked", "x.gou02.required_checks", "x.gou02.review_enforced_admins"]) facts[k] = unobserved(`branch rules answered ${rules.status}, protection ${prot.status}`);
    } else {
      const types = new Set((list ?? []).map((r) => r.type));
      const contexts = new Set();
      for (const r of list ?? []) if (r.type === "required_status_checks") for (const c of r.parameters?.required_status_checks ?? []) contexts.add(c.context);
      for (const c of classic?.required_status_checks?.contexts ?? []) contexts.add(c);
      let enforced = false;
      const prRules = (list ?? []).filter((r) => r.type === "pull_request" && (r.parameters?.required_approving_review_count ?? 0) >= 1);
      for (const r of prRules) {
        if (!r.ruleset_id) continue;
        const rs = t.gh(`repos/${slug}/rulesets/${r.ruleset_id}`);
        if (rs.status === "ok" && (rs.value.bypass_actors ?? []).length === 0 && rs.value.enforcement === "active") enforced = true;
      }
      if (classic && (classic.required_pull_request_reviews?.required_approving_review_count ?? 0) >= 1 && classic.enforce_admins?.enabled === true) enforced = true;
      facts["x.gou02.force_push_blocked"] = types.has("non_fast_forward") || classic?.allow_force_pushes?.enabled === false;
      facts["x.gou02.deletion_blocked"] = types.has("deletion") || classic?.allow_deletions?.enabled === false;
      facts["x.gou02.required_checks"] = contexts.size;
      facts["x.gou02.review_enforced_admins"] = enforced;
      raw.rules = { classic: prot.status, rulesTypes: [...types].sort(cmp), requiredChecks: contexts.size, rulesets: rules.status };
    }
  }

  // ---- people -----------------------------------------------------------------------------------
  const isBot = (u) => !u || u.type === "Bot" || /\[bot\]$/.test(u.login ?? "") || (bots.logins ?? []).includes(u.login);
  const admins = t.gh(`repos/${slug}/collaborators?permission=admin&per_page=100`, { paginate: true });
  facts["x.gou03.admin_humans"] = admins.status === "ok" ? admins.value.filter((u) => u.type === "User" && !isBot(u)).length : unobserved(`collaborators answered ${admins.status}`);
  const collaborators = t.gh(`repos/${slug}/collaborators?per_page=100`, { paginate: true });
  const insiders = new Set(collaborators.status === "ok" ? collaborators.value.map((u) => u.login) : []);
  insiders.add(owner);

  // ---- the registry (published versions are immutable) ------------------------------------------
  const pkg = prof.publie_paquet ?? null;
  let registryDoc = null;
  if (pkg) {
    const doc = await t.get(`https://registry.npmjs.org/${pkg.replace("/", "%2F")}`);
    ev.registry[pkg] = doc.status === "ok";
    if (doc.status === "ok") {
      registryDoc = doc.value;
      const times = doc.value.time ?? {};
      const versions = Object.keys(doc.value.versions ?? {}).sort(cmpSemver);
      ev.registryVersions[pkg] = versions.length;
      facts["x.gou06.published"] = versions.filter((v) => times[v]).map((v) => ({ time: times[v], version: v }));
      facts["x.gou03.registry_owners"] = (doc.value.maintainers ?? []).length;
      raw.registry = { deprecated: versions.filter((v) => doc.value.versions[v].deprecated).length, latest: doc.value["dist-tags"]?.latest ?? null, versions: versions.length };
      // downloads of the last closed calendar month before the as-of date
      const d = new Date(asOfMs);
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)), last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      const span = `${first.toISOString().slice(0, 10)}:${last.toISOString().slice(0, 10)}`;
      const dl = await t.get(`https://api.npmjs.org/downloads/point/${span}/${pkg}`);
      facts["x.mar02.downloads_last_month"] = dl.status === "ok" ? dl.value.downloads ?? 0 : unobserved(`downloads answered ${dl.status}`);
      raw.downloads = { span };
    } else if (doc.status === "http-404") {
      // An observed absence: nothing is published under that name.
      ev.registryStatus = { [pkg]: "http-404" };
      facts["x.gou06.published"] = [];
      facts["x.gou03.registry_owners"] = 0;
      facts["x.mar02.downloads_last_month"] = unobserved(`the registry answers 404 for ${pkg}`);
    } else {
      const why = `the registry answered ${doc.status} for ${pkg}`;
      for (const k of ["x.gou06.published", "x.gou03.registry_owners", "x.mar02.downloads_last_month"]) facts[k] = unobserved(why);
    }
  } else {
    facts["x.gou03.registry_owners"] = 0;
    facts["x.gou06.published"] = [];
    facts["x.mar02.downloads_last_month"] = unobserved("no published package declared");
  }

  // ---- known vulnerabilities of the commit's lockfiles, as OSV knows them today -----------------
  const o = await osv(t, repo, info.commit, osvControl.package, prof.exceptions, asOfMs, tables.vulnerabilities);
  Object.assign(facts, o.facts); raw.osv = o.raw;

  // ---- the project's own advisories ------------------------------------------------------------
  const adv = t.gh(`repos/${slug}/security-advisories?state=published&per_page=100`, { paginate: true });
  if (adv.status === "ok") {
    const list = adv.value;
    let notVisible = 0;
    const undeprecatedVersions = new Set();
    const rows = [];
    for (const a of list) {
      const global = t.gh(`advisories/${a.ghsa_id}`).status === "ok";
      const inOsv = (await t.get(`https://api.osv.dev/v1/vulns/${a.ghsa_id}`)).status === "ok";
      if (!global && !inOsv) notVisible++;
      let undeprecated = 0;
      if (registryDoc) for (const v of a.vulnerabilities ?? []) {
        if (v.package?.name !== pkg) continue;
        for (const ver of Object.keys(registryDoc.versions ?? {})) if (inRange(ver, v.vulnerable_version_range) && !registryDoc.versions[ver].deprecated) { undeprecated++; undeprecatedVersions.add(ver); }
      }
      rows.push({ ghsa: a.ghsa_id, inGithubDatabase: global, inOsv, severity: a.severity ?? null, undeprecatedVersions: undeprecated });
    }
    facts["x.sec03.advisories_published"] = list.length;
    facts["x.sec03.advisories_not_visible"] = notVisible;
    facts["x.sec03.affected_not_deprecated"] = registryDoc || !list.length ? undeprecatedVersions.size : unobserved("no registry document to read deprecations in");
    raw.advisories = rows.sort((a, b) => cmp(a.ghsa, b.ghsa));
  } else {
    const why = `security-advisories answered ${adv.status}`;
    for (const k of ["x.sec03.advisories_published", "x.sec03.advisories_not_visible", "x.sec03.affected_not_deprecated"]) facts[k] = unobserved(why);
  }

  // ---- OpenSSF Scorecard, only when its result is of this commit -------------------------------
  const sc = await t.get(`https://api.securityscorecards.dev/projects/github.com/${slug}`);
  if (sc.status === "ok") {
    const v = sc.value;
    const sr = tables.scorecardRisk;
    const risk = { critical: new Set(sr.critical), high: new Set(sr.high) };
    const excepted = new Set(sr.excepted);
    const checks = (v.checks ?? []).map((c) => ({ name: c.name, score: c.score })).sort((a, b) => cmp(a.name, b.name));
    raw.scorecard = { checks, commit: v.repo?.commit ?? null, date: v.date ?? null, version: v.scorecard?.version ?? null };
    if ((v.repo?.commit ?? null) === info.commit) {
      facts["x.sec05.scorecard_version"] = String(v.scorecard?.version ?? "unknown");
      facts["x.sec05.scorecard_score"] = ratio(Math.round(Number(v.score) * 10), 100);
      facts["x.sec05.scorecard_zero_crit_high"] = checks.filter((c) => (risk.critical.has(c.name) || risk.high.has(c.name)) && !excepted.has(c.name) && c.score === 0).length;
      facts["x.sec05.scorecard_below_8"] = checks.filter((c) => !excepted.has(c.name) && c.score >= 0 && c.score < sr.minimumAtP3).length;
    } else {
      const why = `Scorecard's latest result is of commit ${String(v.repo?.commit).slice(0, 12)}, not of this one`;
      for (const k of ["x.sec05.scorecard_version", "x.sec05.scorecard_score", "x.sec05.scorecard_zero_crit_high", "x.sec05.scorecard_below_8"]) facts[k] = unobserved(why);
    }
  } else for (const k of ["x.sec05.scorecard_version", "x.sec05.scorecard_score", "x.sec05.scorecard_zero_crit_high", "x.sec05.scorecard_below_8"]) facts[k] = unobserved(`the Scorecard API answered ${sc.status}${isPublic ? "" : " (it rates public repositories only)"}`);

  // ---- the window: merged pull requests, their reviews, third parties ----------------------------
  const windowSet = new Set(allCommitsIn(repo, info.commit, win.from));
  const pulls = t.gh(`repos/${slug}/pulls?state=closed&per_page=100`, { paginate: true });
  if (pulls.status === "ok") {
    const merged = pulls.value.filter((p) => p.merged_at && windowSet.has(p.merge_commit_sha));
    let approved = 0, thirdMerged = 0;
    const rows = [];
    for (const p of merged.sort((a, b) => a.number - b.number)) {
      const rv = t.gh(`repos/${slug}/pulls/${p.number}/reviews?per_page=100`, { paginate: true });
      const ok = rv.status === "ok" && rv.value.some((r) => r.state === "APPROVED" && r.user && r.user.type === "User" && !isBot(r.user) && r.user.login !== p.user?.login);
      if (ok) approved++;
      const third = p.user && !isBot(p.user) && !insiders.has(p.user.login);
      if (third) thirdMerged++;
      rows.push({ approvedByAnotherHuman: ok, author: hash(p.user?.login ?? ""), number: p.number, thirdParty: !!third });
    }
    facts["x.gou02.reviewed"] = ratio(approved, merged.length);
    facts["x.mar01.third_party_merged_prs"] = thirdMerged;
    raw.window = { merged: rows };
  } else {
    facts["x.gou02.reviewed"] = unobserved(`pulls answered ${pulls.status}`);
    facts["x.mar01.third_party_merged_prs"] = unobserved(`pulls answered ${pulls.status}`);
  }
  if (isPublic) {
    const since = fromDate ? new Date(Date.parse(fromDate)).toISOString() : null;
    const issues = t.gh(`repos/${slug}/issues?state=all&per_page=100${since ? `&since=${since}` : ""}`, { paginate: true });
    if (issues.status === "ok") {
      const lo = fromDate ? Date.parse(fromDate) : -Infinity, hi = Date.parse(info.committedAt);
      const people = new Set(issues.value.filter((i) => { const c = Date.parse(i.created_at); return c > lo && c <= hi; })
        .map((i) => i.user).filter((u) => u && u.type === "User" && !isBot(u) && !insiders.has(u.login)).map((u) => hash(u.login)));
      facts["x.mar01.third_party_humans"] = people.size;
    } else facts["x.mar01.third_party_humans"] = unobserved(`issues answered ${issues.status}`);
  } else facts["x.mar01.third_party_humans"] = unobserved("a private repository: third parties are not read");

  // ---- public pages ------------------------------------------------------------------------------
  const urls = Array.isArray(prof.surfaces_publiques?.urls) ? prof.surfaces_publiques.urls.slice().sort(cmp) : [];
  let fetched = 0, untagged = 0, siteHits = 0, siteNeg = 0;
  const pages = [];
  const siteTexts = [];
  const pageTexts = [];
  for (const u of urls) {
    const r = await t.get(u, { json: false });
    if (r.status === "ok") {
      fetched++;
      const text = plainText(r.value, "html");
      siteTexts.push(text);
      untagged += factualCount(text);
      const l = lexiconHits(text, lexicon, prof.lexicon ?? [], (prof.exceptions ?? []).filter((e) => e.criterion === "PRO-03").map((e) => e.fingerprint));
      siteHits += l.hits; siteNeg += l.negated;
      pages.push({ found: l.found.slice(0, 10), sha256: sha256(r.value), status: r.status, text: `raw/pages/${String(pages.length + 1).padStart(2, "0")}.txt`, url: u });
      pageTexts.push([pages[pages.length - 1].text, text]);
    } else pages.push({ status: r.status, url: u });
  }
  facts["x.pro01.site_surfaces"] = ratio(fetched, urls.length);
  facts["x.pro01.untagged_site"] = untagged;
  facts["x.pro03.site_hits"] = siteHits;
  facts["x.pro03.site_negated"] = siteNeg;
  facts["x.pro02.site"] = (prof.public_facts ?? []).map((pf) => {
    const re = new RegExp(pf.pattern, "gi");
    const values = [];
    for (const s of siteTexts) for (const m of s.matchAll(re)) if (m[1] !== undefined) values.push(String(m[1]));
    return { fact: pf.id, values: values.sort(cmp) };
  }).sort((a, b) => cmp(a.fact, b.fact));
  raw.pages = pages;

  // ---- production URLs: TLS and headers (SEC-08) --------------------------------------------------
  const prod = Array.isArray(prof.deploie_service) ? prof.deploie_service.slice().sort(cmp) : [];
  let high = 0;
  const prodRows = [];
  for (const u of prod) {
    const r = await t.get(u, { json: false });
    ev.urls[u] = r.status === "ok";
    let host = null; try { host = new URL(u).hostname; } catch { /* not a URL */ }
    const tl = host ? await t.tls(host) : { status: "error", reason: "not a URL" };
    const hsts = !!r.headers?.["strict-transport-security"];
    const findings = [];
    if (tl.status !== "ok") findings.push("tls-unreachable");
    else {
      if (!tables.web.protocols.includes(tl.protocol)) findings.push("tls-below-1.2");
      if (!tl.authorized || (tl.validTo && Date.parse(tl.validTo) < asOfMs)) findings.push("certificate-invalid");
    }
    if (r.status === "ok" && !hsts) findings.push("hsts-missing");
    high += findings.filter((x) => tables.web.highFindings.includes(x)).length;
    prodRows.push({ findings, headers: Object.fromEntries(["content-security-policy", "referrer-policy", "strict-transport-security", "x-content-type-options", "x-frame-options"].map((h) => [h, !!r.headers?.[h]])), status: r.status, tls: tl.protocol ?? tl.status, url: u });
  }
  facts["x.sec08.urls"] = prod.length;
  facts["x.sec08.high_findings"] = prod.length ? high : unobserved("no production URL declared");
  raw.production = prodRows;

  // ---- the gate, acquired for the measure --------------------------------------------------------
  let gate = null;
  if (typeof prof.gate_declare === "string" && prof.gate_declare && acquire) gate = await acquireGate({ t, repo, commit: info.commit, out, registryDoc: registryDoc ?? (await (async () => { const d = await t.get("https://registry.npmjs.org/runward"); return d.status === "ok" ? d.value : null; })()) });
  else if (typeof prof.gate_declare === "string" && prof.gate_declare) gate = { why: "acquisition skipped (--no-gate)" };

  // ---- the files and their manifest ---------------------------------------------------------------
  raw.requests = t.log.map((l) => ({ kind: l.kind, request: l.request.replace(/^https:\/\/[^/]+\.github\.com\//, "").slice(0, 200), status: l.status }));
  const entries = [];
  const put = (rel, value) => { const text = canonJSON(value); writeFileSync(join(out, rel), text); entries.push({ bytes: Buffer.byteLength(text), path: rel, sha256: sha256(text) }); };
  put("facts.json", Object.fromEntries(Object.keys(facts).sort(cmp).map((k) => [k, facts[k]])));
  put("profile-evidence.json", ev);
  for (const k of Object.keys(raw).sort(cmp)) put(`raw/${k}.json`, raw[k]);
  if (pageTexts.length) mkdirSync(join(out, "raw", "pages"), { recursive: true });
  for (const [rel, text] of pageTexts) { writeFileSync(join(out, rel), text); entries.push({ bytes: Buffer.byteLength(text), path: rel, sha256: sha256(text) }); }
  const unavailable = Object.entries(facts).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v) && "$unobserved" in v).map(([k]) => k).sort(cmp);
  const manifest = {
    schema: "runward-assess-snapshot/1",
    asOf, asOfDate: asOf.slice(0, 10),
    entries: entries.sort((a, b) => cmp(a.path, b.path)),
    gate,
    grid: { data: gridData, digest: gridDigest, id: gridId },
    profileDigest,
    subject: { commit: info.commit, defaultBranch: branch, headAtCapture, repo: slug },
    tool: TOOL,
    unavailable,
    window,
  };
  const text = canonJSON(manifest);
  writeFileSync(join(out, "manifest.json"), text);
  return { digest: sha256(text), manifest };
}

/** Reads a snapshot directory back, refusing any file whose bytes are not the manifest's. */
export function readSnapshot(dir) {
  const text = readFileSync(join(dir, "manifest.json"), "utf8");
  const manifest = JSON.parse(text);
  const byPath = new Map(manifest.entries.map((e) => [e.path, e]));
  const load = (rel) => {
    const e = byPath.get(rel);
    if (!e) throw new Error(`the snapshot's manifest does not name ${rel}`);
    const body = readFileSync(join(dir, rel), "utf8");
    if (sha256(body) !== e.sha256) throw new Error(`${rel} differs from the snapshot's manifest: refused`);
    return JSON.parse(body);
  };
  return { digest: sha256(text), manifest, facts: load("facts.json"), profileEvidence: load("profile-evidence.json") };
}
