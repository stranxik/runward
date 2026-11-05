// `runward-fleet build`: a pure function of the files fleet.json declares (ADR-0093 decision 10).
//
// It reads the exports runward wrote (check --json, the attestation, verify --json, the witness, the
// Markdown summary, records), projects the fields the views show, computes every grouping the views
// must never compute (each with its denominator and the list it counts, ADR-0064 note of
// 2026-10-13), records the sha256 of every file it read, and verifies the signatures the operator
// declared against trust-policy.json. It reads no clock (the date is a label from fleet.json), no
// network and no repository, imports no runward module, and never raises a cell above what a
// verified signature under a pinned policy supports. A declared file that is absent is a finding,
// never a reason to stop: silence is shown, not filtered.
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { BuildError } from "./errors.js";
import { describePolicy, evaluateSignature, normRepo, readPolicy } from "./trust.js";

export const INDEX_FORMAT = "runward-fleet-index/0";
export const MANIFEST_FORMAT = "runward-fleet-manifest/0";
export const EXPORT_KINDS = ["check", "attestation", "verify", "witness", "summary", "report", "history"];
export const EXPECTABLE = [...EXPORT_KINDS, "signature"];
const VERDICT_PREDICATE = "https://runward.dev/verdict/v1";
// A private filesystem path: an absolute POSIX home or temporary path not inside a URL, a file URL,
// or a Windows user profile. A URL whose path merely contains "/home/" is not one.
export const PRIVATE_PATH = /(?<![A-Za-z0-9._~%-])\/(?:private|Users|home|tmp|root|var\/folders)\/|[A-Za-z]:\\(?:Users|Documents and Settings)\\/;

const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const isRel = (p) => typeof p === "string" && p.length > 0 && !p.includes("\0") && !p.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(p) && !p.startsWith("\\");

export { BuildError };
const fail = (msg) => { throw new BuildError(msg); };

/** A grouping: for each state, n of N and the list it counts. Views display it, never compute it. */
export function group(items, keyOf, idOf, order = []) {
  const N = items.length;
  const buckets = new Map(order.map((k) => [k, []]));
  for (const it of items) {
    const k = keyOf(it);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(idOf(it));
  }
  return [...buckets.entries()].map(([state, list]) => ({ state, n: list.length, N, list }));
}

/** Validate fleet.json. A manifest this version cannot read stops the build. */
export function readManifest(doc) {
  if (!doc || doc.format !== MANIFEST_FORMAT) fail(`fleet.json: format must be "${MANIFEST_FORMAT}" (found ${JSON.stringify(doc?.format)})`);
  if (!Array.isArray(doc.missions)) fail("fleet.json: missions must be a list");
  const lang = doc.lang ?? "en";
  if (!["en", "fr"].includes(lang)) fail(`fleet.json: lang must be "en" or "fr" (found ${JSON.stringify(lang)})`);
  if (doc.trustPolicy !== undefined && doc.trustPolicy !== null && !isRel(doc.trustPolicy)) fail("fleet.json: trustPolicy must be a path relative to fleet.json");
  const ids = new Set();
  const missions = doc.missions.map((m, i) => {
    const where = `fleet.json missions[${i}]`;
    if (!m || typeof m.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(m.id)) fail(`${where}: id must be a plain identifier (it is a stable join key)`);
    if (ids.has(m.id)) fail(`${where}: id ${m.id} is used twice`);
    ids.add(m.id);
    if (typeof m.name !== "string" || !m.name) fail(`${where}: name is required`);
    if (typeof m.repository !== "string" || !/^[a-z0-9.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(m.repository)) fail(`${where}: repository must read host/owner/repo (e.g. github.com/org/app)`);
    if (m.commit !== undefined && m.commit !== null && !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(String(m.commit))) fail(`${where}: commit must be a full git commit digest`);
    const expects = m.expects ?? [];
    if (!Array.isArray(expects) || !expects.every((k) => EXPECTABLE.includes(k))) fail(`${where}: expects lists kinds among ${EXPECTABLE.join(", ")}`);
    const exports = m.exports ?? {};
    for (const [k, e] of Object.entries(exports)) {
      if (!EXPORT_KINDS.includes(k)) fail(`${where}: exports.${k} is not a kind this version reads (${EXPORT_KINDS.join(", ")})`);
      if (!e || !isRel(e.file)) fail(`${where}: exports.${k}.file must be a path relative to fleet.json`);
    }
    const signatures = m.signatures ?? [];
    if (!Array.isArray(signatures)) fail(`${where}: signatures must be a list`);
    signatures.forEach((s, j) => {
      const w = `${where} signatures[${j}]`;
      if (!s || !EXPORT_KINDS.includes(s.covers)) fail(`${w}: covers names the export the signature covers (${EXPORT_KINDS.join(", ")})`);
      if (s.kind === "sigstore-bundle") { if (!isRel(s.file)) fail(`${w}: file must be a path relative to fleet.json`); }
      else if (s.kind === "ed25519-manifest") {
        for (const k of ["manifest", "signature"]) if (!isRel(s[k])) fail(`${w}: ${k} must be a path relative to fleet.json`);
        if (s.claimedKey !== undefined && !isRel(s.claimedKey)) fail(`${w}: claimedKey must be a path relative to fleet.json`);
        if (typeof s.format !== "string") fail(`${w}: format names the manifest schema`);
      } else fail(`${w}: kind must be "sigstore-bundle" or "ed25519-manifest"`);
    });
    return { ...m, expects, exports, signatures, role: typeof m.role === "string" ? m.role : null, commit: m.commit ?? null, path: typeof m.path === "string" ? m.path : null };
  });
  return {
    title: typeof doc.title === "string" && doc.title ? doc.title : "runward-fleet",
    asOf: typeof doc.asOf === "string" && doc.asOf ? doc.asOf : null,
    lang,
    trustPolicy: doc.trustPolicy ?? null,
    missions,
  };
}

// ------------------------------------------------------------------ projections (fields, never states)
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" ? v : null);

export function projectVerdict(d) {
  const r = d.ratification ?? {};
  const rows = Array.isArray(r.byRow) ? r.byRow : [];
  const a = d.delegation?.assurance;
  const unmet = Array.isArray(d.requiresUnmet) ? d.requiresUnmet : [];
  const deliverables = Array.isArray(d.deliverables) ? d.deliverables : [];
  return {
    runward: str(d.runward),
    verdict: str(d.verdict) ?? "not-observed",
    exitCode: num(d.exitCode),
    currentGate: str(d.currentGate),
    adrCount: num(d.adrCount),
    strict: d.strict === true,
    gaps: Object.fromEntries(Object.entries(d.gaps ?? {}).filter(([k, v]) => k !== "causesByKind" && typeof v === "number")),
    causesByKind: Object.entries(d.gaps?.causesByKind ?? {}).map(([kind, v]) => ({ kind, count: num(v?.count) })),
    deliverables: {
      list: deliverables.map((x) => ({ phase: str(x.phase), phaseId: str(x.phaseId), artifact: str(x.artifact), relPath: str(x.relPath), state: str(x.state), cause: str(x.cause) })),
      byState: group(deliverables, (x) => x.state, (x) => x.relPath, ["filled"]),
    },
    conformance: (Array.isArray(d.conformance) ? d.conformance : []).map((c) => ({ scope: str(c.scope), rule: str(c.rule), kind: str(c.kind), problem: str(c.problem), file: str(c.file) })),
    evidence: {
      rows: num(d.evidence?.rows), applied: num(d.evidence?.applied), deviated: num(d.evidence?.deviated), na: num(d.evidence?.na),
      typed: num(d.evidence?.typed), prose: num(d.evidence?.prose), signed: num(d.evidence?.signed),
      evidenceFiles: d.evidence?.evidenceFiles ? { total: num(d.evidence.evidenceFiles.total), external: num(d.evidence.evidenceFiles.external) } : null,
      proseRows: (d.evidence?.proseRows ?? []).map((x) => ({ deliverable: str(x.deliverable), rule: str(x.rule) })),
    },
    seal: d.seal ? { present: d.seal.present === true, count: num(d.seal.count), sealedAt: str(d.seal.sealedAt), violations: num(d.seal.violations) } : "not-observed",
    corpus: d.corpus ? { status: str(d.corpus.status), missing: d.corpus.missing?.length ?? 0, edited: d.corpus.edited?.length ?? 0, extra: d.corpus.extra?.length ?? 0 } : "not-observed",
    criticalScope: d.criticalScope ? { total: num(d.criticalScope.total), mapped: num(d.criticalScope.mapped), unmapped: (d.criticalScope.unmapped ?? []).map(String) } : "not-observed",
    ratification: {
      rows: num(r.rows), lineByLine: num(r.lineByLine), enBloc: num(r.enBloc), blind: num(r.blind), untraced: num(r.untraced), changed: num(r.changed) ?? 0,
      byState: group(rows, (x) => x.state, (x) => `${x.deliverable} · ${x.rule}`, ["ratified", "changed", "blind", "untraced"]),
      changedRows: (r.changedRows ?? []).map((x) => `${x.deliverable} · ${x.rule}`),
      ratifiers: [...new Set(rows.map((x) => x.by).filter((x) => typeof x === "string" && x))],
    },
    requiresUnmet: {
      list: unmet.map((x) => ({ deliverable: str(x.deliverable), rule: str(x.rule), requires: str(x.requires) })),
      byNature: group(unmet, (x) => x.requires, (x) => `${x.deliverable} · ${x.rule}`),
      size: unmet.length,
    },
    committedJUnit: d.committedJUnit ? { rows: num(d.committedJUnit.rows), reports: (d.committedJUnit.reports ?? []).map(String), freshness: str(d.committedJUnit.freshness) } : "not-observed",
    assurance: a ? { declared: str(a.declared), inForce: str(a.inForce), degraded: a.degraded === true, notInForce: (a.notInForce ?? []).map(String) } : "not-observed",
    delegationStage: num(d.delegation?.stage) ?? "not-observed",
    gateNonScope: str(d.gateNonScope),
    next: d.next ? { action: str(d.next.action), command: str(d.next.command), text: str(d.next.text) } : null,
  };
}

function projectAttestation(st) {
  return {
    type: str(st._type),
    predicateType: str(st.predicateType),
    subject: (st.subject ?? []).map((s) => ({ name: str(s.name), sha256: str(s.digest?.sha256) })),
    verdict: str(st.predicate?.verdict),
    strict: st.predicate?.strict === true,
  };
}

function projectVerify(v) {
  return {
    verified: v.verified === true,
    attestedVerdict: str(v.attestedVerdict),
    producedBy: str(v.producedBy),
    runward: str(v.runward),
    versionSkew: v.versionSkew === true,
    digestMatches: v.digest?.matches === true,
    verdictMatches: v.verdict?.matches === true,
    predicateMatches: v.predicate?.matches === true,
    differing: (v.predicate?.differing ?? []).map(String),
    notReDerived: (v.predicate?.notReDerived ?? []).map(String),
    signatureVerified: v.dsse?.signatureVerified === true,
    exitCode: num(v.exitCode),
  };
}

function projectWitness(w) {
  return {
    format: str(w.witness),
    result: str(w.verdict?.result),
    exitCode: num(w.verdict?.exitCode),
    files: w.files && typeof w.files === "object" ? Object.keys(w.files).length : null,
    notWitnessed: (w.notWitnessed ?? []).map((x) => ({ family: str(x.family), why: str(x.why) })),
  };
}

function projectRecords(text, src) {
  const recs = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { recs.push(JSON.parse(line)); } catch { return { error: "a line is not JSON" }; }
  }
  const byOrigin = new Map();
  for (const x of recs) {
    const o = typeof x.origin === "string" ? x.origin : "not-observed";
    if (!byOrigin.has(o)) byOrigin.set(o, []);
    byOrigin.get(o).push(x);
  }
  // `replayed` is never mixed with another origin (ADR-0093 decision 11): one series per origin.
  const series = [...byOrigin.entries()].map(([origin, list]) => {
    const judges = [...new Set(list.map((x) => String(x.judgedBy ?? "not-observed")))];
    const records = list.map((x) => {
      const v = x.verdict && typeof x.verdict === "object" ? x.verdict : null;
      const as = x.tree?.assurance && typeof x.tree.assurance === "object" ? x.tree.assurance : null;
      return {
        ref: str(x.ref),
        commit: typeof x.commit === "string" ? x.commit.slice(0, 12) : null,
        committedAt: typeof x.committedAt === "string" ? x.committedAt.slice(0, 10) : null,
        verdict: v ? str(v.verdict) ?? "not-observed" : "not-observed",
        exitCode: num(x.run?.exitCode),
        conformanceGaps: v ? num(v.gaps?.conformance) : null,
        deliverableGaps: v ? num(v.gaps?.deliverables) : null,
        assurance: as ? { inForce: str(as.inForce), degraded: as.degraded === true } : "not-observed",
        payloadSha256: str(x.subjects?.[0]?.digest?.sha256),
        judge: judges.indexOf(String(x.judgedBy ?? "not-observed")),
        signatureVerified: false,
      };
    });
    return {
      src,
      origin,
      judgedBy: judges,
      size: records.length,
      records,
      byVerdict: group(records, (x) => x.verdict, (x) => x.ref ?? x.commit, ["clean", "gaps", "not-observed"]),
      maxConformanceGaps: Math.max(0, ...records.map((x) => x.conformanceGaps ?? 0)),
    };
  });
  return { series };
}

// ------------------------------------------------------------------ the build
const SOURCE_KIND = {
  check: "check --strict --json", attestation: "in-toto statement (check --strict --attest)", verify: "verify --json",
  witness: "witness (check --strict --witness)", summary: "report --format md", report: "report (HTML)", history: "records (JSON lines)",
};

/**
 * Build the index. `read(path)` returns the bytes of a file named relative to fleet.json, or null.
 * `version` is runward-fleet's own. Throws BuildError on a manifest or a policy it cannot read, or
 * on a private path that would reach the page; everything else becomes a finding in the index.
 */
export function buildIndex({ manifest: given, read, version }) {
  const name = typeof given?.name === "string" && given.name ? posix.basename(given.name) : "fleet.json";
  if (!Buffer.isBuffer(given?.bytes)) fail("the manifest is given as { name, bytes }");
  let doc;
  try { doc = JSON.parse(given.bytes.toString("utf8")); } catch { fail(`${name} is not JSON`); }
  const manifest = readManifest(doc);
  const sources = [];
  const byId = new Map();
  const addSource = (id, path, buf, meta) => {
    if (byId.has(id)) return id;
    const s = { id, path, sha256: sha256hex(buf), bytes: buf.length, kind: meta.kind, producedBy: meta.producedBy ?? null, at: meta.at ?? null, origin: meta.origin, declaredIn: meta.declaredIn ?? "fleet.json" };
    sources.push(s);
    byId.set(id, s);
    return id;
  };

  // The manifest itself is the first source: the inventory the fleet counts against.
  addSource("fleet.json", name, given.bytes, { kind: "fleet manifest", producedBy: "written by the operator", origin: "declared", declaredIn: "operator" });

  // ---- trust policy
  let policy = null;
  let policyView = null;
  if (manifest.trustPolicy) {
    const buf = read(manifest.trustPolicy);
    if (!buf) fail(`fleet.json names ${manifest.trustPolicy} as its trust policy, and the file is absent`);
    let parsed;
    try { parsed = JSON.parse(buf.toString("utf8")); } catch { fail(`${manifest.trustPolicy} is not JSON`); }
    const base = posix.dirname(manifest.trustPolicy);
    const rel = (p) => posix.normalize(posix.join(base, p));
    policy = readPolicy(parsed, (p) => read(rel(p)));
    addSource("trust-policy.json", manifest.trustPolicy, buf, { kind: "trust policy", producedBy: "written by the operator", origin: "declared", declaredIn: "operator" });
    policy.roots.forEach((r, i) => addSource(`policy:root:${i + 1}`, rel(r.path), read(rel(r.path)), { kind: "trusted root", producedBy: "provided by the operator as a file", origin: "declared", declaredIn: "trust-policy.json" }));
    for (const s of policy.signers) if (s.kind === "ed25519" && s.publicKey !== "jwk") addSource(`policy:key:${s.id}`, rel(s.publicKey), read(rel(s.publicKey)), { kind: "public key", producedBy: "pinned by the operator", origin: "declared", declaredIn: "trust-policy.json" });
    policyView = { src: "trust-policy.json", ...describePolicy(policy) };
    policyView.trustedRoots = policyView.trustedRoots.map((r, i) => ({ src: `policy:root:${i + 1}`, ...r }));
  }

  // ---- missions
  const missions = manifest.missions.map((m) => {
    const out = {
      id: m.id, name: m.name, role: m.role, repository: normRepo(m.repository), path: m.path,
      commit: m.commit ? { value: m.commit, source: "fleet.json (declared)" } : null,
      expects: m.expects,
      latest: "not-observed",
      findings: [],
      signatures: [],
    };
    const finding = (what, state, why, extra = {}) => out.findings.push({ what, state, why, ...extra });
    const exports = {};
    for (const kind of EXPORT_KINDS) {
      const e = m.exports[kind];
      if (!e) continue;
      const buf = read(e.file);
      if (!buf) { finding(kind, "not-observed", "declared-file-absent", { file: e.file }); continue; }
      const src = addSource(`${m.id}:${kind}`, e.file, buf, { kind: SOURCE_KIND[kind], producedBy: str(e.producedBy), at: str(e.at), origin: "undetermined" });
      const item = { src, bytes: buf, sha256: sha256hex(buf), origin: "undetermined" };
      if (["check", "attestation", "verify", "witness"].includes(kind)) {
        try { item.json = JSON.parse(buf.toString("utf8")); } catch { finding(kind, "not-observed", "unreadable", { src }); continue; }
      }
      exports[kind] = item;
    }
    for (const kind of m.expects) {
      if (kind === "signature") { if (m.signatures.length === 0) finding("signature", "not-observed", "expected-none-declared"); continue; }
      if (!m.exports[kind]) finding(kind, "not-observed", "expected-none-declared");
    }

    // The verdict is read from check --json, else from the attestation's predicate (same fields).
    if (exports.check) {
      out.latest = { from: "check", src: exports.check.src, origin: "undetermined", implemented: "ci-declared", ...projectVerdict(exports.check.json) };
    } else if (exports.attestation && exports.attestation.json?.predicateType === VERDICT_PREDICATE && exports.attestation.json.predicate) {
      out.latest = { from: "attestation", src: exports.attestation.src, origin: "undetermined", implemented: "ci-declared", ...projectVerdict(exports.attestation.json.predicate) };
    }
    if (exports.attestation) out.attestation = { src: exports.attestation.src, implemented: "ci-declared", ...projectAttestation(exports.attestation.json) };
    if (exports.verify) out.verify = { src: exports.verify.src, ...projectVerify(exports.verify.json) };
    if (exports.witness) out.witness = { src: exports.witness.src, ...projectWitness(exports.witness.json) };
    if (exports.summary) out.summary = { src: exports.summary.src, markdown: exports.summary.bytes.toString("utf8") };
    if (exports.report) out.report = { src: exports.report.src };
    if (exports.history) {
      const h = projectRecords(exports.history.bytes.toString("utf8"), exports.history.src);
      if (h.error) finding("history", "not-observed", "unreadable", { src: exports.history.src });
      else {
        out.history = h;
        // A file that holds any replayed record is never raised, whatever else it holds.
        if (h.series.some((x) => x.origin === "replayed")) exports.history.origin = "replayed";
        byId.get(exports.history.src).origin = h.series.every((x) => x.origin === "replayed") ? "replayed" : "undetermined";
      }
    }

    // ---- signatures
    m.signatures.forEach((decl, j) => {
      const sid = `${m.id}:signature:${j + 1}`;
      const files = decl.kind === "sigstore-bundle" ? [[sid, decl.file, "sigstore bundle"]]
        : [[`${sid}:manifest`, decl.manifest, "signed manifest"], [`${sid}:sig`, decl.signature, "detached Ed25519 signature"], ...(decl.claimedKey ? [[`${sid}:claimed-key`, decl.claimedKey, "public key shipped with the export (never trusted)"]] : [])];
      const srcs = [];
      for (const [id, p, kind] of files) {
        const b = read(p);
        if (b) srcs.push(addSource(id, p, b, { kind, producedBy: str(decl.producedBy), at: str(decl.at), origin: "undetermined" }));
      }
      const res = evaluateSignature(decl, { mission: { id: m.id, repository: m.repository, commit: m.commit }, exports, policy, read });
      out.signatures.push({ id: sid, src: srcs, ...res });
      if (res.state === "absent") finding("signature", "not-observed", "declared-file-absent", { file: decl.file ?? decl.manifest });
      if (res.state === "refused") finding("signature", "refused", "signature-refused", { signature: sid });
      if (res.raised) {
        if (out.latest !== "not-observed" && out.latest.from === decl.covers) { out.latest.implemented = "machine-established"; out.latest.raisedBy = sid; }
        if (decl.covers === "attestation" && out.attestation) { out.attestation.implemented = "machine-established"; out.attestation.raisedBy = sid; }
      }
    });
    out.signaturesByState = group(out.signatures, (s) => s.state, (s) => s.id, ["verified", "outside-policy", "refused", "absent", "not-verifiable"]);
    return out;
  });

  const observed = missions.filter((m) => m.latest !== "not-observed");
  const allSignatures = missions.flatMap((m) => m.signatures);
  const fleet = {
    declared: missions.length,
    byVerdict: group(missions, (m) => (m.latest === "not-observed" ? "not-observed" : m.latest.verdict), (m) => m.id, ["clean", "gaps", "not-observed"]),
    byImplemented: group(missions, (m) => (m.latest === "not-observed" ? "not-observed" : m.latest.implemented), (m) => m.id, ["machine-established", "ci-declared", "not-observed"]),
    sealed: group(observed, (m) => (m.latest.seal !== "not-observed" && m.latest.seal.present ? "sealed" : "unsealed"), (m) => m.id, ["sealed", "unsealed"]),
    signatures: {
      declared: allSignatures.length,
      byState: group(allSignatures, (s) => s.state, (s) => s.id, ["verified", "outside-policy", "refused", "absent", "not-verifiable"]),
      raised: group(allSignatures, (s) => (s.raised ? "raised" : "not-raised"), (s) => s.id, ["raised", "not-raised"]),
    },
    findings: group(missions.flatMap((m) => m.findings.map((f) => ({ ...f, mission: m.id }))), (f) => f.state, (f) => `${f.mission} · ${f.what}`, ["not-observed", "refused"]),
  };

  const index = {
    format: INDEX_FORMAT,
    builtBy: { name: "runward-fleet", version: version ?? null },
    title: manifest.title,
    lang: manifest.lang,
    asOf: { label: manifest.asOf, source: "declared in fleet.json; neither the build nor the page reads a clock" },
    manifest: { src: "fleet.json" },
    policy: policyView,
    fleet,
    missions,
    absent: [
      { what: "period-report", state: "not-available", contract: "runward-period/1", delivery: "D3" },
      { what: "landing-population", state: "not-available", contract: "runward-landing-population/1", delivery: "D2" },
      { what: "event-stream", state: "not-available", contract: "runward-event/1", delivery: "D3" },
      { what: "rfc3161-timestamps", state: "not-available", contract: "Sigstore bundle", delivery: "runward-fleet" },
    ],
    sources,
  };
  guardPrivatePaths(index);
  return index;
}

/** Refuse a page that would carry a private filesystem path, naming where it would come from. */
export function guardPrivatePaths(value, path = "index") {
  if (typeof value === "string") {
    if (PRIVATE_PATH.test(value)) fail(`a private filesystem path would reach the page at ${path}: fix the export or its declaration; the build never rewrites a value`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => guardPrivatePaths(v, `${path}[${i}]`)); return; }
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) guardPrivatePaths(v, `${path}.${k}`);
}
