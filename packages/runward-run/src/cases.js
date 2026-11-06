// What a JUnit report says of the cases a row cites, for the mutation leg (ADR-0120 decision 2): passed,
// failed on an assertion, failed on another error, failed with no error class the runner tells, skipped,
// or absent. A small reader, no dependency, nothing executed.
//
// The distinction between a failed assertion and an error is the runner's to give: JUnit XML's `<error>`
// against `<failure>`, or the error class the runner writes (Node.js's reporter writes
// `cause: AssertionError [ERR_ASSERTION]` for an assertion, `cause: TypeError` for an error). Where it
// gives none, the case reads `failure`, and runward holds the row to « at least one mutant killed ».
//
// The report is written by the project's own test runner, from the code under review: it is read in one
// pass, with the reader of statement.js (its comments dropped, its `<testcase …>` tags found, in linear
// time), and a case's body runs to its `</testcase>` or to where the next case begins, whichever comes
// first (the rule both readers of this package share).

import { bodyEnd, forward, testcaseTags, withoutComments } from "./statement.js";

const decode = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(lt|gt|amp|quot|apos));/gi, (_, d, h, name) =>
  name ? { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" }[name.toLowerCase()] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16)));
// Node.js up to 24.21.x escapes a `"` twice in an attribute value (runward's RWD-2026-0187).
const value = (s) => decode(decode(s));

const RANK = { passed: 0, skipped: 1, failure: 2, error: 3, assertion: 4 };

/** The outcome of one `<testcase>` body. */
export function classify(body) {
  if (!/<(?:failure|error|skipped)\b/i.test(body)) return "passed";
  if (!/<(?:failure|error)\b/i.test(body)) return "skipped";
  if (/AssertionError|ERR_ASSERTION|AssertionFailedError/.test(body)) return "assertion";
  if (/<error\b/i.test(body)) return "error";
  // Node.js wraps every failure in `Error [ERR_TEST_FAILURE]`: the error class is the cause's.
  const rest = body.replace(/\[?Error \[ERR_TEST_FAILURE\][^\n]*/g, "").replace(/ERR_TEST_FAILURE/g, "");
  if (/\bcause:\s/.test(rest) || /\b[A-Z][A-Za-z]*Error\b/.test(rest) || /\bError:/.test(rest)) return "error";
  return "failure";
}

/**
 * The outcome of each name in `names` in a JUnit report: matched against the decoded `name` attribute,
 * case-insensitively, as runward matches a cited case (`CLASS::NAME` pins the `classname`). A name
 * several cases carry reads its worst outcome; a name no case carries reads `absent`.
 */
export function caseOutcomes(xml, names) {
  const text = withoutComments(String(xml ?? ""));
  const tags = [...testcaseTags(text)];
  const caseEnd = forward(text, "</testcase>");
  const found = [];
  tags.forEach(({ attrs, self, end }, i) => {
    const attr = (k) => { const a = new RegExp(`\\b${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs); return a ? value(a[1] ?? a[2]) : null; };
    const outcome = self ? "passed" : classify(text.slice(end, bodyEnd(caseEnd(end), tags[i + 1], text.length)));
    found.push({ name: (attr("name") ?? "").toLowerCase(), classname: (attr("classname") ?? "").toLowerCase(), outcome });
  });
  const out = {};
  for (const wanted of names) {
    const sep = wanted.indexOf("::");
    const cls = sep === -1 ? null : decode(wanted.slice(0, sep)).toLowerCase();
    const nm = decode(sep === -1 ? wanted : wanted.slice(sep + 2)).toLowerCase();
    const hits = found.filter((c) => c.name === nm && (cls === null || c.classname === cls));
    out[wanted] = hits.length === 0 ? "absent" : hits.map((c) => c.outcome).sort((a, b) => RANK[b] - RANK[a])[0];
  }
  return out;
}
