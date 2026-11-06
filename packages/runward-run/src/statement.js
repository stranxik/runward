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

/** The test cases of a JUnit report, by outcome, in report order: a small reader, no dependency. */
export function junitCases(xml) {
  const text = xml.replace(/<!--[\s\S]*?-->/g, "");
  const passed = [], failed = [], warned = [];
  const tag = /<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
  const decode = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, n) =>
    n ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[n.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));
  for (let m = tag.exec(text); m; m = tag.exec(text)) {
    const name = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
    const n = name ? decode(name[1] ?? name[2]) : "";
    let outcome = "passed";
    if (m[2] !== "/") {
      const end = text.indexOf("</testcase>", tag.lastIndex);
      const body = text.slice(tag.lastIndex, end === -1 ? undefined : end);
      outcome = /<(?:error|failure)\b/i.test(body) ? "failed" : /<skipped\b/i.test(body) ? "warned" : "passed";
    }
    (outcome === "passed" ? passed : outcome === "failed" ? failed : warned).push(n);
  }
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
