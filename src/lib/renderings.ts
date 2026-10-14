import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { RUNWARD_RENDERING_PROPERTY, isRunwardJUnit } from "./tool-adapters.js";
import type { VerdictFinding } from "./sarif.js";

/**
 * Two more renderings of the verdict, for the forges that read them without a token (ADR-0096):
 * a Code Quality report (the CodeClimate-shaped JSON GitLab's merge-request widget reads) and a
 * JUnit XML (the test panel every CI reads). Both are spelled from `verdictFindings`, the list the
 * SARIF log is spelled from, so a cause that reaches one reaches all three; neither computes a state.
 *
 * Neither is a security report: a runward gap is a missing deliverable, an unresolved pointer or an
 * unratified decision, never a vulnerability, and the text of every issue says so.
 *
 * Pure: no clock, no network, no spawn, no git (ADR-0054). Writing the file is the command's job,
 * after the verdict, and a failed write never changes it.
 */

/** Appended to every Code Quality description and carried by every JUnit suite: the non-scope
 *  travels with the finding (GATE_NON_SCOPE), so a reader who drops it does so on purpose. */
export const RENDERING_NON_SCOPE = "(runward gate: presence, pointers, integrity; not a code-quality or security judgement)";

/** The name of the document and of each suite: the panel's "tests" count must not read as tests
 *  runward executed (ADR-0096 decision 2). */
export const JUNIT_SUITES_NAME = "runward gate verdict";
const NO_TEST = "(no test executed)";

/** Canonical JSON (keys sorted at every level by UTF-16 code units, no insignificant whitespace):
 *  the encoding of `docs/spec/witness.md` section 3, without its trailing LF. */
export function canonicalJson(v: unknown): string {
  const canon = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(canon);
    if (x !== null && typeof x === "object") {
      const o = x as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
    }
    return x;
  };
  return JSON.stringify(canon(v));
}

const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/** The identity of each finding inside its document: `(ruleId, uri, rule)` plus, for the second and
 *  later finding sharing all three (two refused pointers on one row), its occurrence number. Never
 *  the index in the list and never the line: a moved row, or a cause added elsewhere, keeps it. */
function identities(findings: readonly VerdictFinding[]): Array<{ check_name: string; path: string; rule: string; occurrence?: number }> {
  const seen = new Map<string, number>();
  return findings.map((f) => {
    const key = canonicalJson([f.ruleId, f.uri, f.rule]);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { check_name: f.ruleId, path: f.uri, rule: f.rule, ...(n > 1 ? { occurrence: n } : {}) };
  });
}

export interface CodeQualityIssue {
  description: string;
  check_name: string;
  fingerprint: string;
  severity: "blocker" | "info";
  location: { path: string; lines: { begin: number } };
}

/**
 * The Code Quality report (ADR-0096 decision 1): one issue per cause, in the gate's order.
 * `severity` is fixed by what the cause does to the gate (`blocker` reddens it, `info` is a
 * deferred deliverable), never derived from a rule's impact. `fingerprint` is the SHA-256 of the
 * canonical encoding of `{check_name, path, rule}` (and `occurrence` from the second homonym on).
 */
export function buildCodeQuality(findings: readonly VerdictFinding[]): CodeQualityIssue[] {
  const ids = identities(findings);
  return findings.map((f, i) => ({
    description: `${f.text} ${RENDERING_NON_SCOPE}`,
    check_name: f.ruleId,
    fingerprint: sha256Hex(canonicalJson(ids[i])),
    severity: f.level === "error" ? "blocker" : "info",
    location: { path: f.uri, lines: { begin: f.line } },
  }));
}

export function renderCodeQuality(issues: readonly CodeQualityIssue[]): string {
  return JSON.stringify(issues, null, 2) + "\n";
}

/** XML 1.0 text and attribute escaping. Characters XML 1.0 cannot carry at all (C0 controls other
 *  than tab, LF and CR, lone surrogates, U+FFFE/U+FFFF) are replaced by U+FFFD rather than dropped,
 *  so the reader sees that something was there. */
export function xmlEscape(s: string): string {
  let clean = "";
  for (let k = 0; k < s.length; k++) {
    const c = s.charCodeAt(k);
    const high = c >= 0xd800 && c <= 0xdbff, low = c >= 0xdc00 && c <= 0xdfff;
    if (high && k + 1 < s.length && s.charCodeAt(k + 1) >= 0xdc00 && s.charCodeAt(k + 1) <= 0xdfff) { clean += s[k] + s[k + 1]; k++; continue; }
    const illegal = (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || high || low || c === 0xfffe || c === 0xffff;
    clean += illegal ? "\uFFFD" : s[k];
  }
  return clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export interface JUnitContext {
  /** The runward version that rendered the verdict. */
  version: string;
  /** SHA-256 of the canonical encoding of the `check --json` payload of the same run, its mission
   *  path replaced by the mission's name (the `--attest` predicate). */
  payloadDigest: string;
  strict: boolean;
  /** The run's exit code: the `runward gate` case fails exactly when it is 1. */
  exitCode: 0 | 1;
  /** The declared horizon, or null. */
  through: string | null;
}

/** The value of the `runward.rendering` property: what wrote the file and from which payload. */
export function renderingStamp(ctx: Pick<JUnitContext, "version" | "payloadDigest">): string {
  return `runward/${ctx.version} payload-sha256:${ctx.payloadDigest}`;
}

/**
 * The JUnit rendering (ADR-0096 decision 2). One `runward gate` suite holding the one case that
 * passes or fails with the exit code; then one suite per scope (gated phase or non-manifest family)
 * in the order the gate first names it, one failing case per cause and one skipped case per deferred
 * deliverable. No passing case is invented per green row. Every suite carries the
 * `runward.rendering` property, which is how the evidence layer recognises this file and refuses it
 * as evidence (decision 4); properties sit on `<testsuite>`, where every JUnit schema allows them.
 * Deterministic: same findings and context, same bytes.
 */
export function buildJUnit(findings: readonly VerdictFinding[], ctx: JUnitContext): string {
  const ids = identities(findings);
  const props = [
    [RUNWARD_RENDERING_PROPERTY, renderingStamp(ctx)],
    ["runward.strict", String(ctx.strict)],
    ["runward.through", ctx.through ?? "(none)"],
    ["runward.exit-code", String(ctx.exitCode)],
    ["runward.non-scope", RENDERING_NON_SCOPE],
  ];
  const properties = ["    <properties>", ...props.map(([n, v]) => `      <property name="${xmlEscape(n)}" value="${xmlEscape(v)}"/>`), "    </properties>"];

  const scopes: string[] = [];
  const byScope = new Map<string, string[]>();
  const counts = new Map<string, { failures: number; skipped: number }>();
  findings.forEach((f, i) => {
    if (!byScope.has(f.scope)) { scopes.push(f.scope); byScope.set(f.scope, []); counts.set(f.scope, { failures: 0, skipped: 0 }); }
    const id = ids[i];
    const suffix = f.ruleId === `runward/${f.rule}` ? "" : ` ${f.rule}`;
    const name = `${f.ruleId}${suffix}${id.occurrence ? ` #${id.occurrence}` : ""}`;
    const head = `    <testcase name="${xmlEscape(name)}" classname="${xmlEscape(f.uri)}">`;
    const where = `${f.uri}:${f.line}`;
    const c = counts.get(f.scope)!;
    if (f.level === "note") {
      c.skipped++;
      byScope.get(f.scope)!.push(head, `      <skipped message="${xmlEscape(f.text)}"/>`, "    </testcase>");
    } else {
      c.failures++;
      byScope.get(f.scope)!.push(head,
        `      <failure message="${xmlEscape(f.text)}" type="${xmlEscape(f.ruleId)}">${xmlEscape(`${f.text}\n${where}\n${RENDERING_NON_SCOPE}`)}</failure>`,
        "    </testcase>");
    }
  });

  const suite = (name: string, tests: number, failures: number, skipped: number, body: string[]) => [
    `  <testsuite name="${xmlEscape(`${name} ${NO_TEST}`)}" tests="${tests}" failures="${failures}" errors="0" skipped="${skipped}">`,
    ...properties,
    ...body,
    "  </testsuite>",
  ];
  const gateFailed = ctx.exitCode === 1;
  const gateCase = gateFailed
    ? ["    <testcase name=\"runward gate\" classname=\"runward\">",
       `      <failure message="the gate is red (exit 1)" type="runward/gate">${xmlEscape(`runward check${ctx.strict ? " --strict" : ""} exited 1: ${findings.filter((f) => f.level === "error").length} cause(s) listed in the suites below.\n${RENDERING_NON_SCOPE}`)}</failure>`,
       "    </testcase>"]
    : ["    <testcase name=\"runward gate\" classname=\"runward\"/>"];

  const out: string[] = [];
  out.push(...suite("runward gate", 1, gateFailed ? 1 : 0, 0, gateCase));
  for (const s of scopes) {
    const c = counts.get(s)!;
    out.push(...suite(s, c.failures + c.skipped, c.failures, c.skipped, byScope.get(s)!));
  }
  const totalFailures = (gateFailed ? 1 : 0) + findings.filter((f) => f.level === "error").length;
  const totalSkipped = findings.filter((f) => f.level === "note").length;
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<testsuites name="${JUNIT_SUITES_NAME}" tests="${1 + findings.length}" failures="${totalFailures}" errors="0" skipped="${totalSkipped}">`,
    ...out,
    "</testsuites>",
    "",
  ].join("\n");
}

/** The digest the `runward.rendering` property names. */
export function payloadDigest(predicate: unknown): string {
  return sha256Hex(canonicalJson(predicate));
}

/** Is this file a Code Quality report runward wrote? A JSON array (possibly empty) whose every item
 *  has a `check_name` starting `runward/`: the only kind of existing file `--codequality` overwrites. */
export function isRunwardCodeQuality(abs: string): boolean {
  try {
    const j = JSON.parse(readFileSync(abs, "utf8")) as unknown;
    return Array.isArray(j) && j.every((x) => x !== null && typeof x === "object"
      && typeof (x as { check_name?: unknown }).check_name === "string"
      && (x as { check_name: string }).check_name.startsWith("runward/"));
  } catch { return false; }
}

/** Is this file a JUnit rendering runward wrote? The only kind of existing file `--junit` overwrites. */
export function isRunwardJUnitFile(abs: string): boolean {
  try { return isRunwardJUnit(readFileSync(abs, "utf8")); } catch { return false; }
}

function realpathOr(p: string): string {
  try { return realpathSync.native(p); } catch { return p; }
}

/**
 * Why `--codequality <file>` or `--junit <file>` cannot be written, asked BEFORE the verdict runs
 * so a refusal writes nothing and prints no partial gate (the `--witness` precedent, ADR-0089).
 * Null when the path is writable. `out` is absolute; `mission` is the `runward/` directory, inside
 * which a rendering would become part of the tree it describes.
 */
export function renderingPathFault(flag: "--codequality" | "--junit", out: string, mission: string): { error: "usage" | "refused"; message: string } | null {
  const missionReal = realpathOr(resolve(mission));
  const parent = dirname(out);
  const target = join(realpathOr(parent), basename(out));
  if (target === missionReal || target.startsWith(missionReal + sep)) {
    return { error: "usage", message: `${flag} ${out} lies inside runward/: the rendering describes that tree and would become part of it. Write it outside the mission directory.` };
  }
  let parentIsDir = false;
  try { parentIsDir = statSync(parent).isDirectory(); } catch { parentIsDir = false; }
  if (!parentIsDir) return { error: "usage", message: `${flag} ${out}: the directory ${parent} does not exist. Create it, or give a path in an existing directory.` };
  if (existsSync(out)) {
    let dir = false;
    try { dir = statSync(out).isDirectory(); } catch { dir = false; }
    if (dir) return { error: "usage", message: `${flag} ${out} is a directory: give a file path.` };
    const own = flag === "--junit" ? isRunwardJUnitFile(out) : isRunwardCodeQuality(out);
    if (!own) return { error: "refused", message: `${flag} ${out} exists and is not a report runward wrote: refusing to overwrite it. Choose another path, or remove the file yourself.` };
  }
  try { accessSync(parent, constants.W_OK); } catch {
    return { error: "usage", message: `${flag} ${out}: the directory ${parent} is not writable.` };
  }
  if (existsSync(out)) {
    try { accessSync(out, constants.W_OK); } catch {
      return { error: "usage", message: `${flag} ${out} is not writable.` };
    }
  }
  return null;
}
