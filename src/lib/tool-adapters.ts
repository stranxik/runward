/**
 * Committed-tool evidence adapters (ADR-0056): resolve a rule row's pointer against an artifact the
 * factory already COMMITTED — a JUnit report today, a SARIF scan next — never by running the tool.
 * Reading a committed file is a gate output; spawning the scanner or the test runner would be the
 * ADR-0054 runtime crossing. Deterministic, offline, read-only.
 *
 * Still presence + integrity, never semantic satisfaction (GATE_NON_SCOPE, ADR-0045): a green test
 * case is proof the case is recorded green in the committed report, not that the case tests the
 * right thing. The adapter raises the cost of the lie — you must commit a report whose named case is
 * actually green — it does not abolish it.
 */

/** A JUnit XML report, by its structural markers rather than by extension — a `.xml` may be anything. */
export function isJUnitReport(content: string): boolean {
  return /<testsuite\b|<testcase\b/i.test(content);
}

/**
 * The recorded result of a named JUnit test case: present-and-green, present-and-not-green, or
 * absent. Regex-scoped to the `<testcase>` element like the manifest parser — no XML library, no
 * execution. A `<failure>`, `<error>` or `<skipped>` child is not-green: a red or skipped test is
 * not evidence. The name is matched exactly (attribute-escaped), so a substring collision on another
 * case cannot pass.
 *
 * EVERY occurrence of the name is scanned, and one red reddens the verdict. The first version
 * stopped at the first match: with two homonymous cases in two suites (routine in parameterized
 * runs and shared base classes), a red case behind a green one was invisible and the pointer read
 * "pass" — a false green inside the evidence layer itself, the exact defect class the gate exists
 * to refuse (found by the 2026-08-14 audit). When homonyms are LEGITIMATELY different tests, the
 * pointer pins one: `CLASS::NAME` matches only the cases whose `classname` attribute is CLASS.
 */
export function junitTestResult(content: string, testName: string): "pass" | "fail" | "absent" {
  // `CLASS::NAME` — an optional disambiguation carried inside the pointer's test name (the pointer
  // grammar takes everything after the first `::` as the name, so the extra `::` arrives here).
  const sep = testName.indexOf("::");
  const wantClass = sep === -1 ? null : testName.slice(0, sep);
  const wantName = sep === -1 ? testName : testName.slice(sep + 2);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match each OPENING <testcase … name="NAME" …> tag, capturing whether it self-closes. A lazy
  // `[^>]*?` before the optional `/` is deliberate: a greedy scan swallows the `/` of a
  // self-closing tag and reads the NEXT case's body, so a passing self-closed case would inherit a
  // later `<failure>`.
  const open = new RegExp(`<testcase\\b[^>]*\\bname\\s*=\\s*["']${esc(wantName)}["'][^>]*?(/?)>`, "ig");
  const classAttr = wantClass === null ? null : new RegExp(`\\bclassname\\s*=\\s*["']${esc(wantClass)}["']`, "i");
  let found = false;
  for (let m = open.exec(content); m !== null; m = open.exec(content)) {
    if (classAttr && !classAttr.test(m[0])) continue; // a homonym in another class — not the pinned case
    found = true;
    if (m[1] === "/") continue; // self-closing <testcase …/> — a recorded pass; keep scanning
    // Has a body: from the end of the opening tag to its matching close.
    const bodyStart = m.index + m[0].length;
    const end = content.indexOf("</testcase>", bodyStart);
    const body = end === -1 ? content.slice(bodyStart) : content.slice(bodyStart, end);
    if (/<(?:failure|error|skipped)\b/i.test(body)) return "fail";
  }
  return found ? "pass" : "absent";
}
