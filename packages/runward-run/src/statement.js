// The run Statement (ADR-0120 decision 4; docs/spec/runward-run.md §2): one unsigned in-toto Statement
// per run, whose subjects are the reports the legs wrote and whose predicate says how they were
// produced. runward-run never signs it: the operator's CI signs it in another job (decision 5).
// Deterministic: the same inputs give the same bytes, so two signers sign the same payload.
import { mapDigest } from "./digest.js";

export const IN_TOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
/** Versioned and expand-only, like runward's verdict predicate (ADR-0055). */
export const RUN_PREDICATE_TYPE = "https://runward.dev/run/v1";
/** The in-toto test-result predicate, the neutral port of the tests leg (ADR-0011). */
export const TEST_RESULT_PREDICATE_TYPE = "https://in-toto.io/attestation/test-result/v0.1";

/** What a run Statement never claims; carried with every one, like runward's GATE_NON_SCOPE. */
export const RUN_NON_SCOPE =
  "runward-run executed the commands of the run policy on a copy of this tree, in the image named, with the " +
  "network cut, and recorded what they wrote. The project's code ran as written: a report records what that code " +
  "printed, not that it behaved. This Statement is unsigned; who signed it, and from where, is checked against the " +
  "operator's trust policy outside runward.";

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function buildRunStatement(run) {
  const subject = run.reports.map((r) => ({ name: r.path, digest: { sha256: r.sha256 } })).sort(byName);
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject,
    predicateType: RUN_PREDICATE_TYPE,
    predicate: {
      executor: { name: "runward-run", version: run.version },
      mission: run.mission,
      policy: { sha256: run.policySha256, legs: run.legs.map((l) => l.leg) },
      runtime: { name: run.runtime.name, version: run.runtime.version },
      image: { ref: run.image, digest: run.image.slice(run.image.indexOf("@") + 1) },
      network: "none",
      install: run.install,
      lockfile: run.lockfile,
      legs: run.legs,
      manifests: { files: run.manifests.files, digest: run.manifests.digest },
      sources: { rule: run.expected.rule, count: Object.keys(run.sources).length, files: run.sources },
      expected: { from: run.expected.from, runward: run.expected.runward },
      // R2, expand-only: present only when the run had a coverage or a mutation leg, so the Statement of
      // every other run keeps its bytes (docs/spec/runward-run.md §7).
      ...(run.coverage ? { coverage: run.coverage } : {}),
      ...(run.mutation ? { mutation: run.mutation } : {}),
      // R3, expand-only: the reports of evals that need a remote model, named, never bound.
      ...(run.declared && run.declared.length ? { declared: run.declared } : {}),
      nonScope: RUN_NON_SCOPE,
    },
  };
}

// The JUnit reader reads a report in one pass, whatever it holds. The report is written by the project's
// own test runner, from code under review, and a regular expression that restarts from every `<!--` or
// every `<testcase` that does not close reads the rest of the file again each time: the reading this
// replaces (`xml.replace(/<!--[\s\S]*?-->/g, "")`, then a quote-aware `<testcase …>` pattern and a search
// for each case's body) took seconds of CPU on 100,000 characters of such shapes. It gives the same
// answers (test/unit/run-junit-reader.test.js keeps it as the reference), with one rule the two readers
// of this package share (`junitCases` here, `caseOutcomes` in cases.js): a case's body runs to its
// `</testcase>`, or to where the next `<testcase …>` begins, whichever comes first. A well-formed report
// never opens a case inside another, so its answers do not move; a case left open no longer reads the
// cases after it as its own, and the bodies, disjoint, are read once each.

/** `s` without its comments, each `<!--` to the first `-->` after it, as an XML reader drops them. */
export function withoutComments(s) {
  let out = "";
  let at = 0;
  for (;;) {
    const i = s.indexOf("<!--", at);
    if (i === -1) break;
    const j = s.indexOf("-->", i + 4);
    if (j === -1) break;
    out += s.slice(at, i);
    at = j + 3;
  }
  return out + s.slice(at);
}

/** The first `what` at or after a position, for positions asked in increasing order: one scan for all. */
export function forward(s, what) {
  let from = Infinity, at = -1;
  return (i) => {
    if (i >= from && (at === -1 || at >= i)) return at;
    from = i;
    at = s.indexOf(what, i);
    return at;
  };
}

const isWord = (c) => c !== undefined && /\w/.test(c);
const lower = (s) => s.replace(/[A-Z]+/g, (w) => w.toLowerCase());

/**
 * Each `<testcase …>` of `text`, in order, with its attributes and whether it closes itself: a tag ends
 * at its first `>` outside a quoted value, and a quote that never closes ends no tag. Where a tag's
 * attributes end depends only on where they start, so each position is read once, for every tag that
 * reaches it.
 */
export function* testcaseTags(text) {
  const low = lower(text);
  const ends = new Int32Array(text.length + 1); // 0 not read yet, -1 no end, else the end of the attributes + 1
  const attrsEnd = (from) => {
    const seen = [];
    let y = from;
    let r;
    for (;;) {
      if (ends[y] !== 0) { r = ends[y]; break; }
      seen.push(y);
      const c = text[y];
      if (c === undefined) { r = -1; break; }
      if (c === ">" || (c === "/" && text[y + 1] === ">")) { r = y + 1; break; }
      if (c === '"' || c === "'") {
        const q = text.indexOf(c, y + 1);
        if (q === -1) { r = -1; break; }
        y = q + 1;
        continue;
      }
      y++;
    }
    for (const p of seen) ends[p] = r;
    return r === -1 ? -1 : r - 1;
  };
  for (let x = low.indexOf("<testcase"); x !== -1; x = low.indexOf("<testcase", x + 1)) {
    if (isWord(text[x + 9])) continue;
    const e = attrsEnd(x + 9);
    if (e === -1) continue;
    const self = text[e] === "/";
    const end = e + (self ? 2 : 1);
    yield { start: x, attrs: text.slice(x + 9, e), self, end };
    x = end - 1;
  }
}

/** The positions of `<name` (any case, then no word character) in `text`, in order. */
function marks(low, text, name) {
  const at = [];
  for (let i = low.indexOf(`<${name}`); i !== -1; i = low.indexOf(`<${name}`, i + 1)) if (!isWord(text[i + name.length + 1])) at.push(i);
  return at;
}
/** Whether one of the sorted `at` lies in [from, to - len]. */
function within(at, from, to, len) {
  let lo = 0, hi = at.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (at[mid] < from) lo = mid + 1; else hi = mid; }
  return lo < at.length && at[lo] <= to - len;
}

/** Where a case's body ends: at its `</testcase>` (`stop`, -1 when none follows), or where the next case
 *  begins, whichever comes first; at the end of the report when neither follows. */
export function bodyEnd(stop, next, length) {
  const cut = next ? next.start : length;
  return stop === -1 ? cut : Math.min(stop, cut);
}

/** The test cases of a JUnit report, by outcome, in report order: a small reader, no dependency. */
export function junitCases(xml) {
  const text = withoutComments(xml);
  const low = lower(text);
  const passed = [], failed = [], warned = [];
  const decode = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, n) =>
    n ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[n.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));
  const caseEnd = forward(text, "</testcase>");
  const found = { error: marks(low, text, "error"), failure: marks(low, text, "failure"), skipped: marks(low, text, "skipped") };
  const tags = [...testcaseTags(text)];
  tags.forEach(({ attrs, self, end }, i) => {
    const name = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const n = name ? decode(name[1] ?? name[2]) : "";
    let outcome = "passed";
    if (!self) {
      const to = bodyEnd(caseEnd(end), tags[i + 1], text.length);
      const has = (k) => within(found[k], end, to, k.length + 1);
      outcome = has("error") || has("failure") ? "failed" : has("skipped") ? "warned" : "passed";
    }
    (outcome === "passed" ? passed : outcome === "failed" ? failed : warned).push(n);
  });
  return { passed, failed, warned };
}

/** The in-toto test-result Statement the tests leg emits beside the run Statement. Its subject is the
 *  source set the run hashed before any leg ran, the artifact the tests were run against. */
export function buildTestResultStatement(run, junitReports) {
  const all = { passed: [], failed: [], warned: [] };
  for (const xml of junitReports) {
    const c = junitCases(xml);
    all.passed.push(...c.passed); all.failed.push(...c.failed); all.warned.push(...c.warned);
  }
  const testsLegFailed = run.legs.some((l) => l.leg === "tests" && l.exitCode !== 0);
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [{ name: "sources", digest: { sha256: mapDigest(run.sources) } }],
    predicateType: TEST_RESULT_PREDICATE_TYPE,
    predicate: {
      result: all.failed.length > 0 || testsLegFailed ? "FAILED" : all.warned.length > 0 ? "WARNED" : "PASSED",
      // The image by its digest, never as an `oci://` URI: `name:tag@sha256:…` in a URI reads as a user
      // and a password to any secret scanner, runward's own included.
      configuration: [{ name: "run-policy", digest: { sha256: run.policySha256 } }, { name: "image", digest: { sha256: run.image.slice(run.image.indexOf("@sha256:") + 8) } }],
      passedTests: all.passed, warnedTests: all.warned, failedTests: all.failed,
    },
  };
}
