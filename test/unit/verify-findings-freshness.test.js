// The freshness signal itself, which nothing measured until now.
//
// `verify-findings-out-of-verdict.test.js` next door guards the opposite property — that the
// findings file NEVER reaches the verdict — and it does that job. The consequence is that it cannot
// kill a single mutant of the freshness computation: it asserts the verdict is unchanged, and the
// verdict is unchanged whatever `fresh` says. Measured on 2026-08-28 during the mutation campaign:
// with the comparison inverted (`>` -> `<=`), so that a findings file from the year 2000 is called
// fresh against 2026 manifests, the whole unit suite ran 812 tests, 0 failures, exit 0.
//
// The signal is advisory but it is not decoration: `check --strict` prints it, and an operator reads
// it to decide whether to re-run the adversarial verify workflow. Told "fresh" about a pass that
// predates the manifests, they skip the re-run they owed. So the contract is pinned here, on real
// mtimes rather than on prose:
//
//   present  — the file is on disk, and the returned shape always carries the field
//   date     — the file's own mtime, day precision
//   fresh    — NO gated deliverable's mtime is strictly greater than the findings file's
//
// The boundary is pinned below in both directions. Equal mtimes are fresh: the pass and the manifest
// were written together, which is what `cp -p`, an archive extraction and a same-second write all
// produce, and calling those stale would cry on honest trees. One millisecond later is stale.
//
// The absent-deliverable case is here for a second reason: the short-circuit `existsSync(d) &&
// statSync(d).mtimeMs > mtime` is load-bearing. Turned into `||`, `statSync` is reached for a file
// that is not there and the function throws ENOENT on the ordinary state of a mission that has not
// yet been through that phase — an uncaught crash, invisible to the suite and to smoke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { manifestsDigest, recordedDigest, verifyFindings, VERIFY_FINDINGS } from "../../dist/lib/verify-findings.js";
import { GATED_DELIVERABLES } from "../../dist/lib/conformance.js";

/** Seconds since the epoch, so a fixture's times are stated rather than inherited from the clock. */
const T = { old: 946_684_800, mid: 1_600_000_000, recent: 1_750_000_000 };

/**
 * A throwaway mission whose every mtime is stated.
 * @param {{findings?: number, deliverables?: Record<string, number>, omit?: string[]}} spec
 */
function mission(spec) {
  const dir = mkdtempSync(join(tmpdir(), "rw-vf-"));
  const write = (rel, when) => {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `# ${rel}\n`);
    utimesSync(p, when, when);
  };
  const omit = new Set(spec.omit ?? []);
  for (const { deliverable } of GATED_DELIVERABLES) {
    if (omit.has(deliverable)) continue;
    write(deliverable, spec.deliverables?.[deliverable] ?? T.old);
  }
  if (spec.findings !== undefined) write(VERIFY_FINDINGS, spec.findings);
  return dir;
}

const dirs = [];
const build = (spec) => { const d = mission(spec); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

test("a findings file newer than every gated manifest is present, dated and fresh", () => {
  const d = build({ findings: T.recent });
  assert.deepEqual(verifyFindings(d), { present: true, date: "2025-06-15", fresh: true, basis: "mtime" });
});

test("no findings file: present is false, and the field is there to be read", () => {
  const d = build({});
  const got = verifyFindings(d);
  assert.deepEqual(got, { present: false });
  assert.equal("present" in got, true, "the declared field must be present even when the file is not");
});

test("a manifest edited after the pass makes it stale — first deliverable", () => {
  const first = GATED_DELIVERABLES[0].deliverable;
  const d = build({ findings: T.mid, deliverables: { [first]: T.recent } });
  assert.deepEqual(verifyFindings(d), { present: true, date: "2020-09-13", fresh: false, basis: "mtime" });
});

test("a manifest edited after the pass makes it stale — last deliverable, so the loop runs whole", () => {
  const last = GATED_DELIVERABLES[GATED_DELIVERABLES.length - 1].deliverable;
  const d = build({ findings: T.mid, deliverables: { [last]: T.recent } });
  assert.equal(verifyFindings(d).fresh, false,
    "staleness declared by the LAST gated deliverable must be seen — a loop that stops early misses it");
});

test("equal mtimes are fresh: only a strictly later edit makes the pass stale", () => {
  const first = GATED_DELIVERABLES[0].deliverable;
  const d = build({ findings: T.mid, deliverables: { [first]: T.mid } });
  assert.equal(verifyFindings(d).fresh, true,
    "a manifest written at the same instant as the pass was covered by it — the boundary is `>`, " +
    "and widening it to `>=` calls a valid pass stale on every tree copied with `cp -p`");
});

test("a mission missing a gated deliverable resolves rather than throwing", () => {
  const d = build({ findings: T.recent, omit: GATED_DELIVERABLES.map((g) => g.deliverable) });
  assert.deepEqual(verifyFindings(d), { present: true, date: "2025-06-15", fresh: true, basis: "mtime" },
    "a mission that has not reached a phase yet is the ordinary case, not an error");
});

test("the date is the file's own mtime at day precision, not the moment of the call", () => {
  const d = build({ findings: T.old, omit: GATED_DELIVERABLES.map((g) => g.deliverable) });
  assert.equal(verifyFindings(d).date, "2000-01-01");
});

test("the artifact is looked up at its declared path, not at the mission root", () => {
  assert.equal(VERIFY_FINDINGS, "governance/verify-findings.md");
  const d = build({ omit: GATED_DELIVERABLES.map((g) => g.deliverable) });
  writeFileSync(join(d, "verify-findings.md"), "# decoy\n");
  assert.deepEqual(verifyFindings(d), { present: false },
    "a file of the right name in the wrong place is not the artifact");
});

// ── RWD-2026-0176: a bare `touch` turned "stale" into "fresh", and the date read a day early ──────
// The mtime reading above is kept (ADR-0067 crossing 2 names it; ADR-0007 surfaces it). What is
// added is the content reading ADR-0033 asks of a lifecycle signal: when the findings header records
// the manifests digest the pass reviewed, freshness compares that digest with the manifests on disk,
// and no modification time enters it.

/** A mission whose findings file records `digest` in its header, then is stamped at `when`. */
function withDigest(digest, when, deliverableWhen = T.old) {
  const d = build({ findings: when, deliverables: Object.fromEntries(GATED_DELIVERABLES.map((g) => [g.deliverable, deliverableWhen])) });
  const p = join(d, VERIFY_FINDINGS);
  writeFileSync(p, `# Verify findings\n\n**Date**: 2026-10-20 · **Manifests digest**: \`${digest}\`\n`);
  utimesSync(p, when, when);
  return d;
}

test("RWD-2026-0176 positive control: by modification time, a touch after a manifest edit reads fresh", () => {
  // The defect, reproduced: the pass predates the manifest edit, a touch moves it after, and the
  // mtime reading calls it fresh. This is the reading a findings file WITHOUT a digest still gets.
  const first = GATED_DELIVERABLES[0].deliverable;
  const d = build({ findings: T.mid, deliverables: { [first]: T.recent } });
  assert.equal(verifyFindings(d).fresh, false);
  utimesSync(join(d, VERIFY_FINDINGS), T.recent + 10, T.recent + 10);
  assert.deepEqual(verifyFindings(d), { present: true, date: "2025-06-15", fresh: true, basis: "mtime" },
    "without a recorded digest the mtime reading stays, and a touch defeats it: the line says so");
});

test("RWD-2026-0176: a recorded digest that matches is fresh, whatever the modification times", () => {
  const d = build({});
  const digest = manifestsDigest(d);
  const m = withDigest(digest, T.old, T.recent); // findings OLDER than every manifest: stale by mtime
  assert.equal(manifestsDigest(m), digest, "the fixture's manifests are the ones the digest was taken of");
  assert.deepEqual(verifyFindings(m), { present: true, date: "2000-01-01", fresh: true, basis: "digest" });
});

test("RWD-2026-0176: a manifest edited after the pass is stale by digest, and a touch does not move it", () => {
  const d = withDigest("sha256:" + "0".repeat(64), T.mid);
  const before = verifyFindings(d);
  assert.equal(before.basis, "digest");
  assert.equal(before.fresh, false);
  utimesSync(join(d, VERIFY_FINDINGS), T.recent + 10, T.recent + 10);
  assert.equal(verifyFindings(d).fresh, false, "a touch is not a pass: the content still differs");
});

test("RWD-2026-0176: the digest moves with each manifest's bytes, not with CRLF or time", () => {
  const d = build({});
  const a = manifestsDigest(d);
  const first = join(d, GATED_DELIVERABLES[0].deliverable);
  utimesSync(first, T.recent, T.recent);
  assert.equal(manifestsDigest(d), a, "a touched manifest is the same manifest");
  writeFileSync(first, readFileSync(first, "utf8").replace(/\n/g, "\r\n"));
  assert.equal(manifestsDigest(d), a, "a CRLF checkout of the same manifest gives the same digest");
  writeFileSync(first, readFileSync(first, "utf8") + "| a-rule | applied | file:x |\n");
  assert.notEqual(manifestsDigest(d), a, "an edited manifest moves the digest");
  const last = join(d, GATED_DELIVERABLES[GATED_DELIVERABLES.length - 1].deliverable);
  const b = manifestsDigest(d);
  writeFileSync(last, readFileSync(last, "utf8") + "x\n");
  assert.notEqual(manifestsDigest(d), b, "the LAST gated manifest is inside the digest too");
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test("RWD-2026-0176: the header line is read in the spellings an agent writes, and nothing looser", () => {
  const h = "sha256:" + "a".repeat(64);
  for (const line of [`Manifests digest: ${h}`, `**Manifests digest**: \`${h}\``, `- manifests digest: ${h}`.slice(2)]) {
    assert.equal(recordedDigest(`# x\n${line}\n`), h, line);
  }
  assert.equal(recordedDigest(`Manifests digest: sha256:${"a".repeat(63)}`), undefined, "a truncated digest is not one");
  assert.equal(recordedDigest("the manifests digest was sha256:..."), undefined, "prose mentioning a digest is not a header line");
});
