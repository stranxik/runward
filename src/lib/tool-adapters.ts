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

/** The property every JUnit rendering of the verdict carries (ADR-0096 decision 2), and what the
 *  evidence layer reads to refuse one (decision 4). One constant, written and read from here. */
export const RUNWARD_RENDERING_PROPERTY = "runward.rendering";

/**
 * Is this JUnit report one runward itself wrote, `check --junit`? A JUnit report carrying a
 * `<property name="runward.rendering" …>` element. Read by marker, never by file name or path: a
 * rendering copied anywhere in the tree and committed is still the previous verdict, and a verdict
 * resting on a previous verdict is the loop ADR-0096 closes. Deterministic, a regex on the bytes.
 */
export function isRunwardJUnit(content: string): boolean {
  return isJUnitReport(content)
    && /<property\b[^>]*\bname\s*=\s*["']runward\.rendering["']/i.test(content);
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
 * not evidence. The name is matched whole, against the DECODED attribute value (RWD-2026-0169), so a
 * substring collision on another case cannot pass.
 *
 * EVERY occurrence of the name is scanned, and one red reddens the verdict. The first version
 * stopped at the first match: with two homonymous cases in two suites (routine in parameterized
 * runs and shared base classes), a red case behind a green one was invisible and the pointer read
 * "pass" — a false green inside the evidence layer itself, the exact defect class the gate exists
 * to refuse (found by the 2026-08-14 audit). When homonyms are LEGITIMATELY different tests, the
 * pointer pins one: `CLASS::NAME` matches only the cases whose `classname` attribute is CLASS.
 */
export function junitTestResult(content: string, testName: string): "pass" | "fail" | "absent" {
  const cases = junitTestCases(content, testName);
  if (cases.length === 0) return "absent";
  return cases.some((x) => !x.green) ? "fail" : "pass";
}

/** Every `<testcase>` the pointer's name selects, in document order: the offset of its opening tag
 *  and whether it is green (self-closing, or a body with no failure, error or skipped child). Split
 *  out of `junitTestResult`, which reads its answer from this list and nothing else, so the witness
 *  (ADR-0089) can name where each case is. */
export function junitTestCases(content: string, testName: string): Array<{ index: number; green: boolean }> {
  // `CLASS::NAME` — an optional disambiguation carried inside the pointer's test name (the pointer
  // grammar takes everything after the first `::` as the name, so the extra `::` arrives here).
  const sep = testName.indexOf("::");
  const wantClass = sep === -1 ? null : testName.slice(0, sep);
  const wantName = sep === -1 ? testName : testName.slice(sep + 2);
  // The report's attribute values are compared DECODED (RWD-2026-0169). The comparison ran against
  // the raw attribute text, so a case vitest names `suite > cas` — written `name="suite &gt; cas"`,
  // as XML requires — never linked from a pointer naming it as the test runner prints it; nor did
  // `l'invariant` (`&apos;`). The only spelling that linked was the escaped one, quoted. The pointer
  // is accepted in both spellings: as the runner prints the name, and, for the missions written
  // against the old behaviour, with the entity spelled out (`"suite &gt; cas"`). A case selected by
  // either spelling counts, and one red among them still reddens the verdict.
  const wanted = (w: string | null) => w === null ? null : [...new Set([w, decodeXmlEntities(w)])];
  const names = wanted(wantName)!;
  const classes = wanted(wantClass);
  // Case-insensitive, as the name has always been matched here; literal otherwise.
  const same = (value: string, alts: string[]) => alts.some((a) => value.toLowerCase() === a.toLowerCase());
  // Each OPENING <testcase …> tag, read attribute by attribute. The tag ends at the first `>`
  // outside a quoted value (XML allows a raw `>` inside one), found by a scan rather than a nested
  // quantifier, and self-closes when a `/` immediately precedes that `>`.
  const open = /<testcase\b/gi;
  const cases: Array<{ index: number; green: boolean }> = [];
  for (let m = open.exec(content); m !== null; m = open.exec(content)) {
    const tagEnd = startTagEnd(content, m.index + m[0].length);
    if (tagEnd === -1) break; // an unterminated tag: nothing after it is a case
    open.lastIndex = tagEnd + 1;
    const selfClosing = content[tagEnd - 1] === "/";
    const attrs = xmlAttributes(content.slice(m.index + m[0].length, selfClosing ? tagEnd - 1 : tagEnd));
    const name = attrs.get("name");
    if (name === undefined || !same(name, names)) continue;
    if (classes) { const c = attrs.get("classname"); if (c === undefined || !same(c, classes)) continue; } // a homonym in another class — not the pinned case
    if (selfClosing) { cases.push({ index: m.index, green: true }); continue; } // self-closing <testcase …/> — a recorded pass; keep scanning
    // Has a body: from the end of the opening tag to its matching close.
    const bodyStart = tagEnd + 1;
    const end = content.indexOf("</testcase>", bodyStart);
    const body = end === -1 ? content.slice(bodyStart) : content.slice(bodyStart, end);
    cases.push({ index: m.index, green: !/<(?:failure|error|skipped)\b/i.test(body) });
  }
  return cases;
}

/**
 * How many failures and errors a JUnit report records at its ROOT, whatever case a pointer cites
 * (ADR-0102 D and E). The gate judges a report by the cases it cites (ADR-0056), so a report holding
 * a `<failure>` on a case no pointer names reads green and was sealed as such; this is the reading
 * the seal makes of the whole report instead.
 *
 * Two sources, the larger one wins: the `<failure>` and `<error>` elements the report carries
 * (comments and CDATA sections removed first, so a console capture quoting `<failure` is not one),
 * and the counts the report declares — the `<testsuites>` root's `failures` + `errors`, and their
 * sum over every `<testsuite>` (nested suites may count a case twice: the number is reported, the
 * rule is only "more than zero"). A runner that writes the counts and no
 * element, or the elements and wrong counts, is still read as not green. `<skipped>` is not a
 * failure here: a skipped case is not green evidence for the case itself (`junitTestResult`), but
 * it says no test failed.
 */
export function junitRootFailures(content: string): number {
  // Comments and CDATA removed by a linear scan (indexOf, no regular-expression replace), repeated
  // until nothing changes: one regex pass left `<!--` behind on crafted input such as `<!<!---->--`
  // (CodeQL, incomplete multi-character sanitization). Only a count is drawn from the result, never
  // markup, and over-counting can only refuse a seal; the scan keeps the reading exact.
  let text = content;
  for (let prev = ""; prev !== text;) { prev = text; text = stripXmlCommentsAndCdata(text); }
  const elements = (text.match(/<(?:failure|error)\b/gi) ?? []).length;
  const declared = (tag: "testsuites" | "testsuite"): number | null => {
    const open = new RegExp(`<${tag}\\b`, "gi");
    let sum: number | null = null;
    for (let m = open.exec(text); m !== null; m = open.exec(text)) {
      const end = startTagEnd(text, m.index + m[0].length);
      if (end === -1) break;
      open.lastIndex = end + 1;
      const attrs = xmlAttributes(text.slice(m.index + m[0].length, text[end - 1] === "/" ? end - 1 : end));
      for (const key of ["failures", "errors"]) {
        const raw = attrs.get(key);
        if (raw === undefined) continue;
        const n = Number.parseInt(raw.trim(), 10);
        if (Number.isFinite(n) && n > 0) sum = (sum ?? 0) + n;
        else sum ??= 0;
      }
    }
    return sum;
  };
  return Math.max(elements, declared("testsuites") ?? 0, declared("testsuite") ?? 0);
}

/** The hash kind the evidence seal records for a JUnit report it hashed by its projection (ADR-0102
 *  B). Versioned: a later projection gets a new name, and a lock entry carrying this one is always
 *  verified by this definition. */
export const JUNIT_PROJECTION_KIND = "junit-projection-v1";

/** A case's verdict in the projection: an `<error>` child wins over a `<failure>`, a `<failure>` over
 *  a `<skipped>`; a case with none of the three passed. */
export type JUnitProjectionVerdict = "passed" | "skipped" | "failure" | "error";

/**
 * The canonical projection of a JUnit report: what the gate reads of it, and nothing else (ADR-0102
 * option B, decided 2026-10-28). Specified once, here; the seal and its verification both call it
 * (`sealHash` and `verifyEvidenceLock` in evidence.ts), and docs/spec/runward-oscal-mapping.md §6
 * states it for a reader who re-derives a hash without runward.
 *
 * The lines, in this order:
 *  1. a header, `{"projection":"junit-projection-v1","rootFailuresAndErrors":N}`, N being
 *     `junitRootFailures` (the root reading `--freeze` refuses above zero, ADR-0102 D);
 *  2. one line per `<testsuite>`, `["suite",[<names from the outermost suite to this one>]]`;
 *  3. one line per `<testcase>`, `["case",[<suite names>],<classname>,<name>,<verdict>]`;
 * lines 2 and 3 sorted together by UTF-16 code units of their text (so by kind, then suite path, then
 * classname, then name, then verdict), each a JSON array as `JSON.stringify` writes it, attribute
 * values decoded (`decodeXmlEntities`), a missing attribute written `null`. The hash is the SHA-256
 * of the lines joined by LF with a final LF.
 *
 * Everything else is out: `time`, `timestamp`, `hostname`, `file`, `line`, `tests` and every other
 * attribute, `<properties>`, `<system-out>`, `<system-err>`, a failure's message and text, comments,
 * CDATA, processing instructions, attribute order, white space, and the order of suites and cases.
 * Duplicates are kept: two cases with the same suite, classname and name are two lines, and the sort
 * orders them stably (two identical lines are interchangeable; two that differ by verdict are ordered
 * by it), so removing a homonym or changing one homonym's verdict still moves the hash.
 *
 * Null when the text is not a JUnit document this reader can parse whole: not well formed (an
 * unclosed or mismatched element, a duplicated attribute, text outside the root, two roots), a root
 * that is neither `<testsuites>` nor `<testsuite>`, a `<testcase>` inside a `<testcase>`, or a
 * DOCTYPE with an internal subset. The caller then hashes the bytes and says so; a file is never
 * sealed by a reading that did not understand it. No XML library, no entity expansion, linear.
 */
export function junitProjection(content: string): string[] | null {
  const text = content.replace(/^﻿/, "");
  const stack: string[] = [];
  const suitePath: Array<string | null> = [];
  const body: string[] = [];
  let current: { suite: Array<string | null>; classname: string | null; name: string | null; error: boolean; failure: boolean; skipped: boolean } | null = null;
  let seenRoot = false, rootClosed = false;
  const closeCase = (): void => {
    const c = current!;
    const verdict: JUnitProjectionVerdict = c.error ? "error" : c.failure ? "failure" : c.skipped ? "skipped" : "passed";
    body.push(JSON.stringify(["case", c.suite, c.classname, c.name, verdict]));
    current = null;
  };
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    const chunk = lt === -1 ? text.slice(i) : text.slice(i, lt);
    if (stack.length === 0 && /\S/.test(chunk)) return null; // text outside the root element
    if (lt === -1) break;
    if (text.startsWith("<!--", lt)) {
      const end = text.indexOf("-->", lt + 4);
      if (end === -1) return null;
      i = end + 3;
    } else if (text.startsWith("<![CDATA[", lt)) {
      if (stack.length === 0) return null;
      const end = text.indexOf("]]>", lt + 9);
      if (end === -1) return null;
      i = end + 3;
    } else if (text.startsWith("<?", lt)) {
      const end = text.indexOf("?>", lt + 2);
      if (end === -1) return null;
      i = end + 2;
    } else if (/^<!DOCTYPE\b/i.test(text.slice(lt, lt + 10))) {
      const end = text.indexOf(">", lt);
      if (seenRoot || end === -1 || text.slice(lt, end).includes("[")) return null;
      i = end + 1;
    } else if (text.startsWith("</", lt)) {
      const m = /^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(text.slice(lt, lt + 300));
      if (!m || stack.length === 0 || stack[stack.length - 1] !== m[1]) return null;
      stack.pop();
      const n = m[1].toLowerCase();
      if (n === "testcase" && current) closeCase();
      else if (n === "testsuite") suitePath.pop();
      if (stack.length === 0) rootClosed = true;
      i = lt + m[0].length;
    } else {
      const m = /^<([A-Za-z_][\w.:-]*)/.exec(text.slice(lt, lt + 300));
      if (!m || rootClosed) return null;
      const end = startTagEnd(text, lt + m[0].length);
      if (end === -1) return null;
      const selfClosing = text[end - 1] === "/";
      const attrs = strictXmlAttributes(text.slice(lt + m[0].length, selfClosing ? end - 1 : end));
      if (attrs === null) return null;
      const n = m[1].toLowerCase();
      if (stack.length === 0) {
        if (n !== "testsuites" && n !== "testsuite") return null;
        seenRoot = true;
      }
      if (n === "testsuite") {
        suitePath.push(attrs.get("name") ?? null);
        body.push(JSON.stringify(["suite", [...suitePath]]));
        if (selfClosing) suitePath.pop();
      } else if (n === "testcase") {
        if (current) return null;
        current = { suite: [...suitePath], classname: attrs.get("classname") ?? null, name: attrs.get("name") ?? null, error: false, failure: false, skipped: false };
        if (selfClosing) closeCase();
      } else if (current && stack[stack.length - 1].toLowerCase() === "testcase") {
        if (n === "error") current.error = true;
        else if (n === "failure") current.failure = true;
        else if (n === "skipped") current.skipped = true;
      }
      if (!selfClosing) stack.push(m[1]);
      if (stack.length === 0) rootClosed = true;
      i = end + 1;
    }
  }
  if (!seenRoot || stack.length !== 0) return null;
  body.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [JSON.stringify({ projection: JUNIT_PROJECTION_KIND, rootFailuresAndErrors: junitRootFailures(text) }), ...body];
}

/** The attributes of a start tag, read strictly: white space, then `name="value"` or `name='value'`,
 *  repeated, nothing else; a duplicated name or a `<` inside a value is not well formed. Names
 *  lowercased, values decoded, as `xmlAttributes` reads them. Null when the tag is not well formed. */
function strictXmlAttributes(tagBody: string): Map<string, string> | null {
  const out = new Map<string, string>();
  const attr = /\s+([^\s=/"'<>]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
  let at = 0;
  for (let m = attr.exec(tagBody); m !== null; m = attr.exec(tagBody)) {
    const key = m[1].toLowerCase();
    if (out.has(key)) return null;
    out.set(key, decodeXmlEntities(m[2] ?? m[3]));
    at = attr.lastIndex;
  }
  return /^\s*$/.test(tagBody.slice(at)) ? out : null;
}

/** `content` without its `<!-- … -->` comments and `<![CDATA[ … ]]>` sections, by a linear scan. An
 *  unterminated one runs to the end of the input and is dropped, as an XML reader would refuse it. */
function stripXmlCommentsAndCdata(content: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < content.length) {
    const c = content.indexOf("<!--", i), d = content.indexOf("<![CDATA[", i);
    const next = c === -1 ? d : d === -1 ? c : Math.min(c, d);
    if (next === -1) { out.push(content.slice(i)); break; }
    out.push(content.slice(i, next));
    const close = next === c ? content.indexOf("-->", next + 4) : content.indexOf("]]>", next + 9);
    if (close === -1) break;
    i = close + 3;
  }
  return out.join("");
}

/** The offset of the `>` that ends a start tag whose attributes begin at `from`, skipping quoted
 *  values; -1 when the tag never ends. */
function startTagEnd(content: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < content.length; i++) {
    const ch = content[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ">") return i;
  }
  return -1;
}

/** The attributes of one XML start tag (the text between the element name and `>`), names
 *  lowercased, values decoded. The first occurrence of a name wins, as a parser that does not
 *  refuse a duplicate would read it. */
function xmlAttributes(tagBody: string): Map<string, string> {
  const out = new Map<string, string>();
  const attr = /([^\s=/"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let m = attr.exec(tagBody); m !== null; m = attr.exec(tagBody)) {
    const key = m[1].toLowerCase();
    if (!out.has(key)) out.set(key, decodeXmlEntities(m[2] ?? m[3]));
  }
  return out;
}

/** Decode the five predefined XML entities and numeric character references, in ONE pass, so
 *  `&amp;gt;` reads `&gt;` and never `>`. A reference that names no character (out of range, a
 *  surrogate, an unknown name) is left as written. */
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(lt|gt|amp|quot|apos));/g, (whole, dec: string | undefined, hex: string | undefined, named: string | undefined) => {
    if (named) return ({ lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" } as Record<string, string>)[named];
    const cp = dec !== undefined ? Number(dec) : parseInt(hex!, 16);
    if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return whole;
    return String.fromCodePoint(cp);
  });
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

/** A Cobertura coverage report, by its structural markers. The `line-rate` attribute on a
 *  `<coverage>` root is what no other XML has; `<class filename=` is the record we read. */
export function isCoberturaReport(content: string): boolean {
  return /<coverage\b[^>]*\bline-rate\s*=/i.test(content) && /<class\b[^>]*\bfilename\s*=/i.test(content);
}

/**
 * What a committed Cobertura report records about one source file — the same three states as lcov,
 * because it is the same question asked of a different format: `covered` (measured and something
 * executed it), `uncovered` (measured, nothing did), `absent` (no record).
 *
 * Java, Python and .NET toolchains emit Cobertura where JS emits lcov; a factory should not have to
 * change formats to be able to cite its own coverage. Same semantic, same refusal of a threshold: a
 * percentage floor is policy, and policy is the operator's CI.
 */
export function coberturaFileResult(content: string, sourcePath: string): "covered" | "uncovered" | "absent" {
  const want = sourcePath.split("\\").join("/").replace(/^\.\//, "");
  // Each <class filename="…"> opens a record; its <line … hits="N"/> children carry the counts.
  const open = /<class\b[^>]*\bfilename\s*=\s*["']([^"']+)["'][^>]*?(\/?)>/ig;
  let found = false, hits = 0;
  for (let m = open.exec(content); m !== null; m = open.exec(content)) {
    const file = m[1].split("\\").join("/");
    if (!(file === want || file.endsWith("/" + want))) continue;
    found = true;
    if (m[2] === "/") continue; // self-closing record: declared, no line detail
    const end = content.indexOf("</class>", m.index + m[0].length);
    const body = end === -1 ? content.slice(m.index + m[0].length) : content.slice(m.index + m[0].length, end);
    // `line-rate` on the record is the summary; the <line hits> are the detail. Read both, so a
    // report written with only one of them still resolves.
    const rate = Number(m[0].match(/\bline-rate\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (Number.isFinite(rate) && rate > 0) hits++;
    for (const l of body.matchAll(/<line\b[^>]*\bhits\s*=\s*["'](\d+)["']/ig)) if (Number(l[1]) > 0) hits++;
  }
  if (!found) return "absent";
  return hits > 0 ? "covered" : "uncovered";
}

/** An ESLint JSON report: an array of per-file results, each carrying `filePath` and `messages`. */
export function isEslintReport(content: string): boolean {
  const t = content.trimStart();
  if (!t.startsWith("[")) return false;
  return /"filePath"\s*:/.test(content) && /"messages"\s*:/.test(content);
}

/**
 * What a committed ESLint report records about one source file: `clean` (linted, no ERROR-severity
 * message), `findings` (error-severity messages recorded — a file the linter refuses is not
 * evidence), `absent` (not in the report: it cannot vouch for a file it never linted), or
 * `unparseable`.
 *
 * Severity 2 (error) reddens; severity 1 (warning) does not — the same line the SARIF adapter draws
 * between an open finding and an informational one. A project that treats warnings as errors
 * configures its linter to emit them as errors, which is where that policy belongs.
 */
export function eslintFileResult(content: string, sourcePath: string): "clean" | "findings" | "absent" | "unparseable" {
  let report: unknown;
  try { report = JSON.parse(content); } catch { return "unparseable"; }
  if (!Array.isArray(report)) return "unparseable";
  const want = sourcePath.split("\\").join("/").replace(/^\.\//, "");
  let found = false, errors = 0;
  for (const rawEntry of report) {
    const entry = rawEntry as { filePath?: unknown; messages?: unknown[]; errorCount?: unknown };
    if (typeof entry?.filePath !== "string") continue;
    const file = entry.filePath.split("\\").join("/");
    if (!(file === want || file.endsWith("/" + want))) continue;
    found = true;
    if (typeof entry.errorCount === "number") { errors += entry.errorCount; continue; }
    for (const rawMsg of Array.isArray(entry.messages) ? entry.messages : []) {
      if ((rawMsg as { severity?: unknown })?.severity === 2) errors++;
    }
  }
  if (!found) return "absent";
  return errors > 0 ? "findings" : "clean";
}

/** A CycloneDX SBOM, by its own format marker. */
export function isCycloneDxSbom(content: string): boolean {
  return /"bomFormat"\s*:\s*"CycloneDX"/i.test(content) && /"components"\s*:/.test(content);
}

/**
 * Is a component DECLARED in a committed CycloneDX SBOM? `present` or `absent` — presence and
 * nothing else. The SBOM says what the delivery contains; it says nothing about whether those
 * versions are safe, and reading a vulnerability verdict out of an inventory would be the
 * GATE_NON_SCOPE slide (vulnerability findings are the SARIF adapter's job, and every SCA tool
 * worth citing emits SARIF).
 *
 * The pointer names an EXACT identity: a purl (`pkg:npm/lodash@4.17.21`) or `name@version`. A bare
 * name is refused rather than resolved — `lodash` would green whatever version the SBOM happens to
 * carry, and "the dependency is pinned" is exactly the claim such a pointer is usually written to
 * support. Refuse rather than guess.
 */
export function sbomComponentPresent(content: string, identity: string): "present" | "absent" | "ambiguous" | "unparseable" {
  if (!/[@:]/.test(identity)) return "ambiguous"; // a bare name names no version
  let bom: unknown;
  try { bom = JSON.parse(content); } catch { return "unparseable"; }
  const components = (bom as { components?: unknown[] })?.components;
  if (!Array.isArray(components)) return "unparseable";
  const want = identity.trim();
  for (const rawComponent of components) {
    const c = rawComponent as { purl?: unknown; name?: unknown; version?: unknown };
    if (typeof c?.purl === "string" && c.purl === want) return "present";
    if (typeof c?.name === "string" && typeof c?.version === "string" && `${c.name}@${c.version}` === want) return "present";
  }
  return "absent";
}

// ── Load-test reports (the `loadtest` nature — the one creation the requires: investigation
//    justified, 2026-09-09) ─────────────────────────────────────────────────────────────────────

/** A load-test report, by structural markers: a k6 `--summary-export` JSON (a `metrics` object
 *  carrying `http_req_duration`) or a JMeter JTL XML (`<testResults>` with samples). Content, never
 *  extension — the house rule for every adapter above. */
export function isLoadTestReport(content: string): boolean {
  return isK6Summary(content) || isJmeterJtl(content);
}

export function isK6Summary(content: string): boolean {
  return /"metrics"\s*:/.test(content) && /"http_req_duration"/.test(content);
}

export function isJmeterJtl(content: string): boolean {
  return /<testResults\b/i.test(content) && /<(httpSample|sample)\b/i.test(content);
}

/**
 * The verdict of a committed k6 summary's thresholds, `metric` optionally narrowing to one
 * metric's thresholds. Reading a committed report, never running k6 (the ADR-0054 crossing).
 *
 * TWO threshold spellings exist in the wild, and one of them is a documented trap: the historical
 * `--summary-export` writes a BARE BOOLEAN per threshold whose meaning is REVERSED — `true` means
 * the threshold FAILED (grafana/k6#1498, reported 2020-06-09 and long-lived). Later summaries
 * spell `{ "ok": boolean }` where `ok: true` means it held. This adapter reads both and refuses
 * anything else: a shape whose meaning cannot be established is `unparseable`, never a guess —
 * exactly the case the strict posture exists for.
 *
 * A summary with NO thresholds anywhere answers `absent`: a report that measured nothing against
 * a target cannot vouch that targets were met.
 */
export function k6ThresholdsResult(content: string, metric?: string): "clean" | "findings" | "absent" | "unparseable" {
  let summary: unknown;
  try { summary = JSON.parse(content); } catch { return "unparseable"; }
  const metrics = (summary as { metrics?: Record<string, unknown> })?.metrics;
  if (!metrics || typeof metrics !== "object") return "unparseable";
  const names = metric ? [metric] : Object.keys(metrics);
  if (metric && !(metric in metrics)) return "absent";
  let seen = 0;
  for (const name of names) {
    const th = (metrics[name] as { thresholds?: Record<string, unknown> })?.thresholds;
    if (!th || typeof th !== "object") continue;
    for (const v of Object.values(th)) {
      seen++;
      if (typeof v === "boolean") { if (v) return "findings"; continue; }           // bare boolean: true = FAILED (k6#1498)
      const ok = (v as { ok?: unknown })?.ok;
      if (typeof ok === "boolean") { if (!ok) return "findings"; continue; }        // {ok}: false = failed
      return "unparseable";                                                          // a shape with no established meaning
    }
  }
  return seen === 0 ? "absent" : "clean";
}

/** The verdict of a committed JMeter JTL's samples, `label` optionally narrowing to one request
 *  label (`lb="…"`). Every matched sample must record success (`s="true"`); a red sample is not
 *  evidence, and a label the run never exercised cannot be vouched for. */
export function jtlSamplesResult(content: string, label?: string): "clean" | "findings" | "absent" | "unparseable" {
  if (!/<testResults\b/i.test(content)) return "unparseable";
  const samples = [...content.matchAll(/<(?:httpSample|sample)\b[^>]*>/gi)].map((m) => m[0]);
  const matched = label
    ? samples.filter((s) => { const m = s.match(/\blb="([^"]*)"/i); return m ? m[1] === label : false; })
    : samples;
  if (matched.length === 0) return "absent";
  for (const s of matched) {
    const m = s.match(/\bs="(true|false)"/i);
    if (!m) return "unparseable";
    if (m[1].toLowerCase() === "false") return "findings";
  }
  return "clean";
}
