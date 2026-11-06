// measure.js: one commit, read offline. The CLI runs this under a sandbox that denies the network
// (bin/runward-assess.js) and refuses when a probe still reaches it.
//
// Input: a repository's object store, a revision, the declared profile, optionally the snapshot
// directory (for the gate the snapshot acquired). Output: runward-assess-measure/1, canonical. No
// clock, no locale and no absolute path reaches it; the environment it ran in is a label, outside the
// facts, and the facts' digest is what two machines must agree on.
import { mkdtempSync, rmSync, readFileSync, existsSync, cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir, platform, arch } from "node:os";
import { canonJSON, sha256, cmp } from "./canon.js";
import { commitInfo, exportTree, windowCommits, git, run } from "./git.js";
import { Tree, governance, packages, workflows, decisions, register, mutation, links, plainText, factualCount, lexiconHits, versions, declaredFiles } from "./readers.js";
import { trace, missionFacts } from "./mission.js";
import { secrets, contributions, versionTags } from "./history.js";
import { runExampleCorpus, runMissionCorpus, gateAndRederive, summarise, ENV_RECORD, gateKey, againstFrozen } from "./saboteur.js";
import { TOOL } from "./grid-model.js";
import { toolDigest, dirDigest } from "./tooldigest.js";

const unobserved = (reason) => ({ $unobserved: reason });

/** Public facts: a truth computed in the tree, compared with what each surface's pattern extracts. */
function publicFacts(tree, prof, surfaces) {
  const list = Array.isArray(prof.public_facts) ? prof.public_facts : [];
  return list.map((pf) => {
    let truth = null;
    if (pf.truth?.kind === "package-version") truth = tree.json(pf.truth.path ?? "package.json")?.version ?? null;
    else if (pf.truth?.kind === "count-files") { const re = new RegExp(pf.truth.pattern); truth = String(tree.files.filter((f) => re.test(f)).length); }
    const re = new RegExp(pf.pattern, "gi");
    const values = [];
    for (const s of surfaces) for (const m of s.text.matchAll(re)) if (m[1] !== undefined) values.push(String(m[1]));
    return { fact: pf.id, truth, values: values.sort(cmp) };
  }).sort((a, b) => cmp(a.fact, b.fact));
}

/** Which gate the snapshot acquired for this commit, verified against its digest. */
function gateCli(snapshotDirGiven, commit) {
  if (!snapshotDirGiven) return { why: "no snapshot directory given: no gate CLI to run" };
  // Every case runs in its own copy, so the gate is reached by an absolute path, never the caller's cwd.
  const snapshotDir = resolve(snapshotDirGiven);
  const mf = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8"));
  if (mf.subject?.commit !== commit) return { why: `the snapshot was taken for ${mf.subject?.commit}` };
  const g = mf.gate;
  if (!g || !g.cli) return { why: g?.why ?? "the snapshot acquired no gate" };
  const dir = join(snapshotDir, g.dir);
  const got = dirDigest(dir);
  if (got !== g.digest) return { why: `the gate's files differ from the snapshot's manifest (${got.slice(0, 12)} != ${g.digest.slice(0, 12)})` };
  return { cli: join(snapshotDir, g.cli), version: g.version, source: g.source, digest: g.digest, pin: g.pin ?? null };
}

export function measure({ repo, rev, slug, profile, since = null, snapshotDir = null, altNode = null, grid, network }) {
  const info = commitInfo(repo, rev);
  const sinceCommit = since ? commitInfo(repo, since).commit : null;
  const win = windowCommits(repo, info.commit, sinceCommit);
  const fromDate = win.from ? commitInfo(repo, win.from).committedAt : null;
  const window = { basis: win.basis, commits: win.commits.length, from: win.from, fromDate, to: info.commit, toDate: info.committedAt };
  const prof = profile.facts ?? {};
  const work = mkdtempSync(join(tmpdir(), "runward-assess-"));
  const root = join(work, "tree");
  try {
    const { entries, submodules } = exportTree(repo, info.commit, root);
    const tree = new Tree(entries.map((e) => e.path), (p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return null; } });
    const facts = {};
    const details = {};
    const put = (name, r) => { Object.assign(facts, r.facts); if (r.details) details[name] = r.details; return r; };

    put("governance", governance(tree));
    const pk = put("packages", packages(tree, grid.data.sdks));
    const wf = put("workflows", workflows(tree));
    put("decisions", decisions(tree, info.committedAt));
    put("register", register(tree, prof.defect_register ?? null, info.committedAt, grid.grid.tables.register.unclassifiedDays));
    put("mutation", mutation(tree, prof.perimetre_mutation ?? null));
    put("links", links(tree));
    put("versions", versions(tree, versionTags(repo, info.commit)));
    Object.assign(facts, declaredFiles(tree, prof));
    const tr = put("trace", trace(tree, prof));
    put("secrets", secrets(repo, info.commit, grid.data.secrets, prof.exceptions ?? []));
    put("contributions", contributions(repo, info.commit, win.from, grid.data.bots, grid.data.domains, grid.grid.tables.chaoss.share));

    // the repository's public surfaces, as the commit holds them
    const files = Array.isArray(prof.surfaces_publiques?.files) ? prof.surfaces_publiques.files.slice().sort(cmp) : [];
    const surf = files.filter((f) => tree.has(f)).map((f) => ({ path: f, text: plainText(tree.text(f), f.endsWith(".html") ? "html" : "md") }));
    facts["m.pro01.repo_surfaces"] = { d: files.length, n: surf.length };
    facts["m.pro01.untagged_repo"] = surf.reduce((n, s) => n + factualCount(s.text), 0);
    const lexExceptions = (prof.exceptions ?? []).filter((e) => e.criterion === "PRO-03" && e.fingerprint && e.reason).map((e) => e.fingerprint);
    const lex = surf.map((s) => ({ path: s.path, ...lexiconHits(s.text, grid.data.lexicon, prof.lexicon ?? [], lexExceptions) }));
    facts["m.pro03.repo_hits"] = lex.reduce((n, l) => n + l.hits, 0);
    facts["m.pro03.repo_negated"] = lex.reduce((n, l) => n + l.negated, 0);
    details.surfaces = { declared: files, missing: files.filter((f) => !tree.has(f)), lexicon: lex.flatMap((l) => l.found.map((x) => ({ path: l.path, ...x }))).slice(0, 40) };
    facts["m.pro02.repo"] = publicFacts(tree, prof, surf);

    // the gate and the catalogue (PRV-03)
    const mf = missionFacts(tree);
    details.mission = { isMission: mf.isMission, isProduct: mf.isProduct, pinned: mf.pinned };
    const gateDeclared = typeof prof.gate_declare === "string" && prof.gate_declare.length > 0;
    if (!gateDeclared) {
      for (const k of ["m.prv03.gate_version", "m.prv03.gate_exit", "m.prv03.rederive_identical", "m.prv03.must_refuse", "m.prv03.false_red"]) facts[k] = unobserved("no gate declared");
    } else {
      const g = gateCli(snapshotDir, info.commit);
      if (!g.cli) {
        for (const k of ["m.prv03.gate_version", "m.prv03.gate_exit", "m.prv03.rederive_identical", "m.prv03.must_refuse", "m.prv03.false_red"]) facts[k] = unobserved(g.why);
        details.saboteur = { gate: null, why: g.why };
      } else {
        const sw = join(work, "sab"); mkdirSync(sw, { recursive: true });
        const gr = gateAndRederive(g.cli, root, sw, altNode);
        const ex = runExampleCorpus(g.cli, join(sw, "example"));
        const mi = mf.isMission ? runMissionCorpus(g.cli, root, join(sw, "mission")) : null;
        const s = summarise(ex, mi);
        facts["m.prv03.gate_version"] = g.version;
        facts["m.prv03.gate_exit"] = typeof gr.exit === "number" ? gr.exit : { $error: `the gate did not exit: ${gr.exit}` };
        facts["m.prv03.rederive_identical"] = gr.identical;
        facts["m.prv03.must_refuse"] = s.mustRefuse;
        facts["m.prv03.false_red"] = s.falseRed;
        const key = gateKey({ commit: g.source === "built-from-commit" ? info.commit : null, source: g.source, version: g.version });
        details.saboteur = { cliEnv: ENV_RECORD, gate: { digest: g.digest, key, pin: g.pin, source: g.source, version: g.version }, self: gr, example: ex, mission: mi, summary: s,
          frozen: againstFrozen(key, ex), altRuntime: altNode ? run(altNode, ["--version"]).out.trim() : null };
      }
    }

    // what the commit says of its own profile: the score decides the bases
    const scripts = pk.evidence.rootScriptText;
    const gateRe = /runward(?:@[\w.^~-]+)?\s+check\s+--strict|dist\/cli\.js\s+check\s+--strict/;
    const declaredPaths = [...new Set([...(prof.docs_conformite ?? []), prof.perimetre_mutation, prof.defect_register?.path, prof.slo_file, prof.tools_manifest, prof.claims_register, prof.evals?.set, ...files].filter(Boolean))].sort(cmp);
    const buildName = /^npm run ([\w:.-]+)$/.exec(prof.build_cmd ?? "")?.[1] ?? null;
    const profileEvidence = {
      buildScript: buildName && pk.evidence.rootScripts.includes(buildName) ? buildName : null,
      gateRuns: gateRe.test(scripts) ? "package.json scripts" : gateRe.test(wf.allText) ? "a workflow" : null,
      modelSdks: pk.evidence.modelSdks,
      paths: Object.fromEntries(declaredPaths.map((p) => [p, tree.has(p) || tree.dirs.has(p)])),
      publishable: pk.evidence.publishable,
      toolSdks: pk.evidence.toolSdks,
    };

    const gitVersion = run("git", ["--version"]).out.trim();
    const out = {
      schema: "runward-assess-measure/1",
      details,
      environment: { arch: arch(), git: gitVersion, network, node: process.version, os: platform() },
      facts,
      grid: { data: grid.digests.gridData, digest: grid.digests.grid, id: grid.grid.grid },
      inventory: { bytes: entries.reduce((n, e) => n + e.size, 0), files: entries.length, submodules },
      profileEvidence,
      subject: { commit: info.commit, committedAt: info.committedAt, repo: slug, tree: info.tree },
      tool: { ...TOOL, digest: toolDigest() },
      window,
    };
    return out;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export const measureText = (m) => canonJSON(m);
