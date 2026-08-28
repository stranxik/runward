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
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { verifyFindings, VERIFY_FINDINGS } from "../../dist/lib/verify-findings.js";
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
  assert.deepEqual(verifyFindings(d), { present: true, date: "2025-06-15", fresh: true });
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
  assert.deepEqual(verifyFindings(d), { present: true, date: "2020-09-13", fresh: false });
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
  assert.deepEqual(verifyFindings(d), { present: true, date: "2025-06-15", fresh: true },
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
