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
 */
export function junitTestResult(content: string, testName: string): "pass" | "fail" | "absent" {
  const esc = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the OPENING <testcase … name="NAME" …> tag, capturing whether it self-closes. A lazy
  // `[^>]*?` before the optional `/` is deliberate: a greedy scan swallows the `/` of a
  // self-closing tag and reads the NEXT case's body, so a passing self-closed case would inherit a
  // later `<failure>`.
  const open = new RegExp(`<testcase\\b[^>]*\\bname\\s*=\\s*["']${esc}["'][^>]*?(/?)>`, "i");
  const m = open.exec(content);
  if (!m) return "absent";
  if (m[1] === "/") return "pass"; // self-closing <testcase …/> — a recorded pass
  // Has a body: from the end of the opening tag to its matching close.
  const bodyStart = m.index + m[0].length;
  const end = content.indexOf("</testcase>", bodyStart);
  const body = end === -1 ? content.slice(bodyStart) : content.slice(bodyStart, end);
  return /<(?:failure|error|skipped)\b/i.test(body) ? "fail" : "pass";
}
