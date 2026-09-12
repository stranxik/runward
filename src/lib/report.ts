// The delivery report an assessor reads alone (ADR-0064, accepted 2026-09-09).
//
// ONE self-contained HTML file: no external stylesheet, no script, no link that must resolve for
// the document to be readable — committed, attached to a release or emailed, it says the same
// thing in five years. It is generated FROM the ADR-0030 machine payload and states NOTHING the
// payload does not carry: a rendering that computes is a second verdict, and two verdicts that can
// disagree are worse than one that is hard to read (the ADR's own settling test).
//
// The five questions an assessment asks, in order: where is this mission; what is proven and by
// what; what is deferred and why; what the gate does not cover (verbatim); how to re-derive this
// alone. Byte-identical across two runs on one tree — the only clock is generationDate(), which
// honours RUNWARD_NOW and SOURCE_DATE_EPOCH like every clock runward writes.
import { GATED_DELIVERABLES } from "./conformance.js";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One assembled ADR-0030 payload in, one self-contained HTML document out. Pure. */
export function renderDeliveryReport(
  payload: Record<string, unknown>,
  meta: { generatedOn: string; subjectDigest: string },
): string {
  const p = payload as {
    runward: string; mission: string; currentGate: string; adrCount: number; verdict: string;
    strict: boolean; exitCode: number;
    gaps: { deliverables: number; conformance: number; hooks: number; deferred: number; proposed: number };
    deliverables: Array<{ phase: string; artifact: string; relPath: string; state: string; cause: string | null }>;
    through: string | null;
    horizon: { phase: string; deferred: Array<{ phase: string; artifact: string; relPath: string }> } | null;
    conformance?: Array<{ scope: string; rule: string; problem: string }>;
    evidence?: { rows: number; applied: number; deviated: number; na: number; typed: number; prose: number; signed: number;
      evidenceFiles: { total: number; external: number } };
    seal?: { present: boolean; count: number; sealedAt: string | null; violations: number };
    ratification?: { rows: number; lineByLine: number; enBloc: number; blind: number; untraced: number };
    requiresUnmet?: Array<{ deliverable: string; rule: string; requires: string }>;
    workflowContract?: { gating: boolean; malformed: string[]; joinBreaks: string[]; unmetRequires: string[] };
    gateNonScope?: unknown;
  };

  const clean = p.verdict === "clean";
  const phases = new Map<string, typeof p.deliverables>();
  for (const d of p.deliverables) {
    if (!phases.has(d.phase)) phases.set(d.phase, []);
    phases.get(d.phase)!.push(d);
  }
  const stateWord: Record<string, string> = {
    filled: "filled", "in-progress": "in progress", untouched: "untouched (raw template)", missing: "missing",
  };
  const gatedSet = new Set(GATED_DELIVERABLES.map((g) => g.deliverable));

  const rowsDeliverables = [...phases.entries()].map(([phase, arts]) => arts.map((a, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${arts.length}" class="phase">${esc(phase)}</td>` : ""}
        <td>${esc(a.artifact)}${gatedSet.has(a.relPath) ? ' <span class="gated" title="sealed by the strict gate">gated</span>' : ""}</td>
        <td><code>runward/${esc(a.relPath)}</code></td>
        <td class="${a.state === "filled" ? "ok" : "warn"}">${esc(stateWord[a.state] ?? a.state)}${a.cause ? ` <small>(${esc(a.cause)})</small>` : ""}</td>
      </tr>`).join("")).join("");

  const conf = p.conformance ?? [];
  const rowsConformance = conf.length === 0
    ? `<tr><td colspan="3" class="ok">No open rule-conformance violation: every CRITICAL/HIGH rule mapped to a crossed phase resolves to its cited evidence.</td></tr>`
    : conf.map((c) => `<tr><td>${esc(c.scope)}</td><td><code>${esc(c.rule)}</code></td><td>${esc(c.problem)}</td></tr>`).join("");

  const unmet = p.requiresUnmet ?? [];
  const wc = p.workflowContract;
  const rat = p.ratification;
  const ev = p.evidence;
  const deferredRows = (p.horizon?.deferred ?? []).map((d) =>
    `<tr><td>${esc(d.phase)}</td><td>${esc(d.artifact)}</td><td><code>runward/${esc(d.relPath)}</code></td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delivery report — subject ${esc(meta.subjectDigest.slice(0, 12))}</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.55 -apple-system, "Segoe UI", system-ui, sans-serif; color: #23201c; background: #faf8f4;
         max-width: 60rem; margin: 2rem auto; padding: 0 1.25rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.05rem; margin: 2.2rem 0 .6rem; border-bottom: 1px solid #d8d2c6; padding-bottom: .3rem; }
  table { border-collapse: collapse; width: 100%; font-size: .92em; }
  th, td { text-align: left; padding: .38rem .6rem; border-bottom: 1px solid #e6e1d6; vertical-align: top; }
  th { font-weight: 600; color: #5c554a; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em; background: #f0ece3; padding: .05rem .3rem; border-radius: 3px; }
  .verdict { display: inline-block; padding: .35rem .9rem; border-radius: 4px; font-weight: 700; letter-spacing: .02em; }
  .verdict.clean { background: #2c5f3f; color: #fff; }
  .verdict.gaps { background: #8a3a2e; color: #fff; }
  .ok { color: #2c5f3f; } .warn { color: #8a3a2e; }
  .phase { font-weight: 600; white-space: nowrap; }
  .gated { font-size: .72em; border: 1px solid #b6a878; color: #7a6a3d; border-radius: 3px; padding: 0 .3rem; vertical-align: middle; }
  .meta { color: #5c554a; font-size: .9em; }
  blockquote { margin: .6rem 0; padding: .7rem 1rem; background: #f3efe7; border-left: 3px solid #b6a878; }
  footer { margin: 3rem 0 1rem; color: #5c554a; font-size: .85em; border-top: 1px solid #d8d2c6; padding-top: .8rem; }
  pre { background: #f0ece3; padding: .7rem 1rem; border-radius: 4px; overflow-x: auto; }
</style>
</head>
<body>
<h1>Delivery report</h1>
<p class="meta">runward ${esc(p.runward)} · generated ${esc(meta.generatedOn)} · ${p.strict ? "strict verdict" : "presence verdict"}</p>
<!-- ADR-0071 option 2, ratified 2026-09-12: the subject is named by a digest, not by a path. The
     path this file used to carry named the GENERATING machine's layout (a temporary directory and a
     session id, twice, once inside <title>) and said nothing about the object judged. The digest is
     taken BEFORE this file is written, because this file lives inside the tree the digest hashes —
     printing the after-value would be wrong on every run, which is the measurement that killed the
     obvious fix. The reader re-derives it by removing this file and re-hashing; the sentence below
     says exactly that, so the pre-write value is a stated fact and never a silent one. -->
<p class="meta">Subject digest <code>${esc(meta.subjectDigest)}</code>
<br><small>Taken <strong>before this file was written</strong>: the report lives inside the mission tree, so writing it changes the tree's hash. To re-derive: delete <code>runward/governance/delivery-report.html</code> and run <code>runward check --attest</code> — the attestation's subject digest must equal the value above. An attestation produced with this file present covers this file too and will differ; produce the attestation first, or remove the report before attesting.</small></p>
<p><span class="verdict ${clean ? "clean" : "gaps"}">${clean ? "CLEAN" : "GAPS"}</span>
${clean
    ? " — every expected deliverable is filled and, under strict, every CRITICAL/HIGH rule mapped to a crossed phase is accounted for."
    : ` — ${esc(p.gaps.deliverables)} deliverable gap(s), ${esc(p.gaps.conformance)} rule-conformance gap(s)${p.gaps.proposed ? ` (of which ${esc(p.gaps.proposed)} proposal(s) awaiting ratification)` : ""}.`}
</p>

<h2>1 · Where this mission stands</h2>
<p>Current gate: <strong>${esc(p.currentGate)}</strong> · ${esc(p.adrCount)} architecture decision record(s).</p>
<table>
<tr><th>Phase</th><th>Deliverable</th><th>Path</th><th>State</th></tr>
${rowsDeliverables}
</table>

<h2>2 · What is proven, and by what</h2>
${ev ? `<p>${esc(ev.rows)} manifest row(s): ${esc(ev.applied)} applied, ${esc(ev.deviated)} deviated, ${esc(ev.na)} n/a — ${esc(ev.typed)} carrying typed, resolvable pointers and ${esc(ev.prose)} accepted as prose on the operator's judgment (never verified). ${esc(ev.signed)} row(s) are signature-checked. Evidence footprint: ${esc(ev.evidenceFiles.total)} file(s), of which ${esc(ev.evidenceFiles.external)} live outside <code>runward/</code>${ev.evidenceFiles.external === 0 && ev.rows > 0 ? " — every green line rests on the mission's own documents; legitimate for a documentation-only mission, and said here so it cannot read as more" : ""}.</p>` : `<p>This report was generated without the strict layer; the rule-conformance tables are absent, not empty.</p>`}
<table>
<tr><th>Scope</th><th>Rule</th><th>Open violation</th></tr>
${rowsConformance}
</table>
${unmet.length ? `<p class="warn">${unmet.length} applied row(s) do not yet carry the evidence NATURE their rule requires (disclosed, refused at the armed tier):</p><table><tr><th>Deliverable</th><th>Rule</th><th>Requires</th></tr>${unmet.map((u) => `<tr><td><code>${esc(u.deliverable)}</code></td><td><code>${esc(u.rule)}</code></td><td>${esc(u.requires)}</td></tr>`).join("")}</table>` : ""}
${rat ? `<p>Ratification: ${esc(rat.rows)} row(s) traced (${esc(rat.lineByLine)} line-by-line, ${esc(rat.enBloc)} en bloc, ${esc(rat.blind)} blind) · ${esc(rat.untraced)} decided row(s) with no trace${rat.blind > 0 ? ` — <strong class="warn">${esc(rat.blind)} row(s) were ratified without displayed evidence and are recorded as such</strong>` : ""}.</p>` : ""}
${p.seal?.present ? `<p>Evidence seal: ${esc(p.seal.count)} file(s) sealed on ${esc(p.seal.sealedAt)}, ${p.seal.violations === 0 ? '<span class="ok">intact</span>' : `<span class="warn">${esc(p.seal.violations)} violation(s)</span>`}.</p>` : `<p>No evidence seal — sealing is opt-in; nothing here is verified against a previous state.</p>`}
${wc && (wc.malformed.length + wc.joinBreaks.length + wc.unmetRequires.length) > 0 ? `<p class="warn">${wc.malformed.length + wc.joinBreaks.length + wc.unmetRequires.length} workflow-contract break(s) — ${wc.gating ? "counted against this verdict" : "disclosed, not counted (the mission has not opted into contract hardening)"}.</p>` : ""}

<h2>3 · What is deferred, and why</h2>
${p.through ? `<p>This verdict certifies a declared prefix through <strong>${esc(p.through)}</strong> — a construction checkpoint, not a completion. ${esc(p.gaps.deferred)} later deliverable(s) are deferred by that declaration:</p><table><tr><th>Phase</th><th>Deliverable</th><th>Path</th></tr>${deferredRows}</table>` : `<p>No declared horizon: this verdict judges the whole arc, and nothing is deferred by declaration.</p>`}

<h2>4 · What the gate does not cover</h2>
<blockquote>${esc(p.gateNonScope ?? "")}</blockquote>

<h2>5 · Re-derive this yourself</h2>
<p>This document computes nothing: it renders the machine payload of the gate. On a checkout of this repository, without any account:</p>
<pre>npx runward@${esc(p.runward)} check --strict --json</pre>
<p>The counts above must match that output field for field; if an attestation is committed, <code>npx runward@${esc(p.runward)} verify &lt;attestation&gt;</code> re-derives the whole predicate offline.</p>

<footer>Generated by <code>runward report</code> (ADR-0064) — deterministic, self-contained, no network. A rendering that computed anything would be a second verdict; this one states nothing <code>check --strict --json</code> does not carry.</footer>
</body>
</html>
`;
}
