/**
 * Committed-tool evidence adapters (ADR-0056): resolve a rule row's pointer against an artifact the
 * factory already COMMITTED — a JUnit report, a SARIF scan — never by running the tool.
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

/** A SARIF log, by its structural markers rather than by extension — a `.json`/`.sarif` may be
 *  anything. Both markers are required: the schema-or-version stamp AND the `runs` array. */
export function isSarifReport(content: string): boolean {
  return (/"\$schema"\s*:\s*"[^"]*sarif/i.test(content) || /"version"\s*:\s*"2\.[01]/.test(content))
    && /"runs"\s*:/.test(content);
}

/**
 * The recorded outcome of a named SARIF rule in a committed scan: `clean` (the scan knows the rule
 * and records no open finding for it), `findings` (results exist — a red scan is not evidence),
 * `absent` (no run mentions the rule: the scan cannot vouch for what it never checked), or
 * `unparseable`. Reading a committed log, never running the scanner (the ADR-0054 crossing).
 *
 * The false green this shape refuses: a `#ruleId` routed through the generic substring/identifier
 * check would match the log whenever the rule fired — its id is IN the JSON precisely because there
 * ARE findings — the same first-match class the JUnit homonym fix killed. So a SARIF-shaped file
 * never falls through to `symbolPresent`.
 *
 * A result's effective level follows the spec: `result.level`, else the rule's
 * `defaultConfiguration.level`, else `"warning"`. `note`/`none` are informational and do not
 * redden; anything else is an open finding. Suppressions are deliberately NOT honoured: a
 * suppressed finding is still a finding the committed log records, and honouring an in-file
 * suppression would let the audited party silence its own evidence (the re-signable floor,
 * ADR-0002).
 */
export function sarifRuleResult(content: string, ruleId: string): "clean" | "findings" | "absent" | "unparseable" {
  let log: unknown;
  try { log = JSON.parse(content); } catch { return "unparseable"; }
  const runs = Array.isArray((log as { runs?: unknown[] })?.runs) ? (log as { runs: unknown[] }).runs : [];
  let known = false;
  let findings = 0;
  for (const runRaw of runs) {
    const run = runRaw as { tool?: { driver?: { rules?: unknown[] } }; results?: unknown[] };
    const rules = Array.isArray(run?.tool?.driver?.rules) ? run.tool!.driver!.rules! : [];
    const meta = rules.find((r) => (r as { id?: unknown })?.id === ruleId) as { defaultConfiguration?: { level?: string } } | undefined;
    if (meta) known = true;
    const results = Array.isArray(run?.results) ? run.results! : [];
    for (const resRaw of results) {
      const res = resRaw as { ruleId?: string; rule?: { index?: number }; level?: string };
      const id = res?.ruleId ?? (res?.rule?.index !== undefined ? (rules[res.rule.index] as { id?: string })?.id : undefined);
      if (id !== ruleId) continue;
      known = true;
      const level = res?.level ?? meta?.defaultConfiguration?.level ?? "warning";
      if (level !== "note" && level !== "none") findings++;
    }
  }
  if (!known) return "absent";
  return findings > 0 ? "findings" : "clean";
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

/** An lcov coverage report, by its structural markers rather than by extension. `SF:` (source file)
 *  plus a record terminator is the shape no other committed artifact has. */
export function isLcovReport(content: string): boolean {
  return /^SF:/m.test(content) && /^end_of_record\s*$/m.test(content);
}

/**
 * What a committed lcov report records about one source file: `covered` (the file is measured and
 * at least one of its lines was executed), `uncovered` (measured, and NOTHING executed it), or
 * `absent` (no record for it — the report cannot vouch for what it never measured).
 *
 * The semantic is deliberately presence + non-vacuity, never a THRESHOLD. A percentage floor is a
 * policy, and policy belongs to the operator's CI (runward's own coverage ratchet is a CI job, not
 * a gate rule): the instant a pointer could say `>= 80`, runward would be inventing a policy
 * language and judging quality — the GATE_NON_SCOPE slide. What the gate can honestly say is the
 * coverage analogue of "an empty file is not evidence": a file nothing exercised is not evidence
 * that the rule was applied in it.
 *
 * Path matching is suffix-at-a-segment-boundary, because `SF:` records carry whatever path the
 * runner had (usually absolute, from a machine nobody else has). `src/lib/x.ts` therefore matches
 * `/home/runner/work/repo/src/lib/x.ts` and never `src/lib/xx.ts`. Several matching records are
 * aggregated: the same file measured by two suites is one file, and one suite exercising it is
 * enough for it to have been exercised.
 */
export function lcovFileResult(content: string, sourcePath: string): "covered" | "uncovered" | "absent" {
  const want = sourcePath.split("\\").join("/").replace(/^\.\//, "");
  let found = false;
  let hits = 0;
  let current: boolean = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      const sf = line.slice(3).trim().split("\\").join("/");
      current = sf === want || sf.endsWith("/" + want);
      if (current) found = true;
      continue;
    }
    if (!current) continue;
    // LH: is the summary lcov writes per record; DA: lines are the per-line detail. Reading both
    // means a report written without the summary counters (some tools omit LF/LH) still resolves.
    if (line.startsWith("LH:")) { hits += Number(line.slice(3).trim()) || 0; continue; }
    if (line.startsWith("DA:")) {
      const count = Number(line.slice(3).split(",")[1]);
      if (Number.isFinite(count) && count > 0) hits++;
      continue;
    }
    if (line === "end_of_record") current = false;
  }
  if (!found) return "absent";
  return hits > 0 ? "covered" : "uncovered";
}
