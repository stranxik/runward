// `runward report --format md`: the pull request / merge request summary (ADR-0093 D1, ADR-0094
// decision 1, ADR-0095's settling test). Held here:
//   - byte fixtures on the example mission, green and red, and on runward's own mission (its payload
//     frozen in a fixture, since the live mission moves with every delivery; a live case checks that
//     the command renders exactly the payload `check --strict --json` publishes on the tree as it is);
//   - every number of the status table is a value of the payload: the summary counts nothing;
//   - the assurance mode is never printed stronger than the one the gate reads, `degraded` in words;
//   - hostile values from the tree cannot inject a link, a mention, a reference, HTML or a table cell,
//     with a positive control showing the checker reddens on a naive rendering;
//   - the size stays under both forges' limits, whatever the tree holds.
//
// Regenerate the fixtures deliberately with UPDATE_GOLDEN=1 node --test test/unit/report-summary-md.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import * as yaml from "js-yaml";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSummaryMarkdown, mdCode, mdProse, SUMMARY_MAX_BYTES, SUMMARY_MARK } from "../../dist/lib/summary-md.js";
import { SUMMARY_MAX_BYTES as GITHUB_MAX } from "../../packages/runward-forge/src/github.js";
import { NOTE_MAX_CHARS as GITLAB_MAX } from "../../packages/runward-forge/src/gitlab.js";
import { SUMMARY_MARKER } from "../../packages/runward-forge/src/port.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const GOLDEN = join(ROOT, "test", "fixtures", "golden");
const ENV = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1", RUNWARD_NOW: "2026-09-09" };
const run = (cwd, ...a) => execFileSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV, stdio: ["pipe", "pipe", "pipe"] });
const runRaw = (cwd, ...a) => spawnSync("node", [CLI, ...a], { cwd, encoding: "utf8", env: ENV });

function example() {
  const dir = mkdtempSync(join(tmpdir(), "rw-summary-"));
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  run(dir, "init", "--yes", "--example");
  return dir;
}

/** The example mission made red twice over: a deliverable removed, a cited symbol renamed away. */
function redden(dir) {
  rmSync(join(dir, "runward", "handover.md"));
  const guard = join(dir, "code", "src", "core", "domain", "guard.ts");
  writeFileSync(guard, readFileSync(guard, "utf8").replace(/guardFields/g, "renamedAway"));
}

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** The example mission's summary with the two values a release moves: the version, and the digest
 *  (the mission's scaffold-lock records the version). The digest's correctness is the live cases'. */
const releaseNeutral = (md) => md.replaceAll(VERSION, "<version>").replace(/\b[0-9a-f]{64}\b/g, "<digest>").replace(/subject [0-9a-f]{12}\b/g, "subject <digest12>");

function golden(name, got) {
  const file = join(GOLDEN, name);
  if (process.env.UPDATE_GOLDEN === "1") writeFileSync(file, got);
  assert.equal(got, readFileSync(file, "utf8"), `${name}: the summary drifted from its fixture; inspect the diff, then regenerate with UPDATE_GOLDEN=1`);
}

/** Every numeric leaf of a JSON value, as strings. */
function numbers(v, out = new Set()) {
  if (typeof v === "number") out.add(String(v));
  else if (Array.isArray(v)) v.forEach((x) => numbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbers(x, out));
  return out;
}

/** The status table's rows (the first table of the summary). */
function statusTable(md) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.startsWith("| What |"));
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith("|"); i++) rows.push(lines[i]);
  return rows;
}

// ── Byte fixtures ─────────────────────────────────────────────────────────────────────────────

test("summary golden: the example mission, green, byte for byte", () => {
  const dir = example();
  try { golden("summary-example-green.md", releaseNeutral(run(dir, "report", "--format", "md"))); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("summary golden: the example mission, red (a deliverable missing, a cited symbol renamed), byte for byte", () => {
  const dir = example();
  try {
    redden(dir);
    const r = runRaw(dir, "report", "--format", "md");
    assert.equal(r.status, 0, "a red mission's summary is written, exit 0: the summary is the point");
    golden("summary-example-red.md", releaseNeutral(r.stdout));
    assert.match(r.stdout, /^## runward gate: GAPS$/m);
    assert.match(r.stdout, /exit code 1 \(gaps/);
    assert.match(r.stdout, /`deliverable-missing` \| 4 \|/, "the causes are grouped by kind, with the payload's counts");
    assert.match(r.stdout, /`evidence-refused` \| 2 \|/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("summary golden: runward's own mission, rendered from its frozen attestation", () => {
  // The fixture is `check --strict --attest` on runward's own mission (charter, sample ledger,
  // assurance block, a ratification ledger row by row). Regenerated with UPDATE_GOLDEN=1 from the tree.
  const fixture = join(GOLDEN, "summary-self-attestation.json");
  if (process.env.UPDATE_GOLDEN === "1") {
    // The checkout's directory name is the generating machine's, not the subject's: named `runward`.
    const fresh = JSON.parse(run(ROOT, "check", "--strict", "--attest"));
    fresh.subject[0].name = "runward";
    fresh.predicate.mission = "runward";
    writeFileSync(fixture, JSON.stringify(fresh, null, 2) + "\n");
  }
  const att = JSON.parse(readFileSync(fixture, "utf8"));
  const md = renderSummaryMarkdown(att.predicate, { subjectDigest: att.subject[0].digest.sha256 });
  golden("summary-self.md", md);
  assert.match(md, /Delegation charter \| stage 1 \| declared: /, "the charter's stage is declared, never proved");
  assert.match(md, /Assurance mode in force \| `sampled` \|/, "the mode the gate reads in force");
});

test("summary, live on runward's own mission: exactly the payload check --strict --json publishes, twice the same bytes", () => {
  const first = run(ROOT, "report", "--format", "md");
  assert.equal(run(ROOT, "report", "--format", "md"), first, "deterministic: no clock, no environment in the bytes");
  const payload = JSON.parse(run(ROOT, "check", "--strict", "--json"));
  const att = JSON.parse(run(ROOT, "check", "--strict", "--attest"));
  assert.equal(first, renderSummaryMarkdown(payload, { subjectDigest: att.subject[0].digest.sha256 }),
    "the command renders the gate's own payload and the attestation's digest, nothing else");
  assert.doesNotMatch(first, /\/(private\/)?(tmp|var\/folders|Users|home)\//, "no absolute path of the generating machine");
});

test("summary: every number of the status table is a value of the payload (ADR-0095's settling test)", () => {
  const dir = example();
  try {
    redden(dir);
    const payload = JSON.parse(runRaw(dir, "check", "--strict", "--json").stdout);
    const md = run(dir, "report", "--format", "md");
    const known = numbers(payload);
    // The digest is the attestation's; ADR numbers and "SHA-256" are names, not counts.
    const rows = statusTable(md).filter((r) => !r.startsWith("| Attestation subject"));
    assert.ok(rows.length >= 6, "the status table was found");
    for (const row of rows) {
      for (const n of row.replace(/ADR-\d+/g, "").match(/\d+/g) ?? []) assert.ok(known.has(n), `${n} in "${row}" is a value of the payload`);
    }
    // Positive control: a summary that printed a computed number would be caught.
    const planted = rows[1].replace(/\| \d+ \|/, "| 987654 |");
    assert.ok((planted.match(/\d+/g) ?? []).some((n) => !known.has(n)), "the check sees a number the payload does not carry");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Assurance: never stronger than what the gate reads ────────────────────────────────────────

function minimalPayload(extra = {}) {
  return {
    runward: "0.43.1", currentGate: "all gates passed", adrCount: 1, strict: true, verdict: "clean", exitCode: 0,
    gaps: { deliverables: 0, conformance: 0, hooks: 0, deferred: 0, proposed: 0, causesByKind: {} },
    deliverables: [], through: null, conformance: [], gateNonScope: "non-scope", next: { text: "next", command: "x" },
    ...extra,
  };
}
const DIGEST = "a".repeat(64);
const charter = (assurance) => ({ file: "runward/delegation.md", banner: ["charter: declared, not proved"], stage: 1, accountable: "github:x",
  delegates: ["bot"], ...(assurance === undefined ? {} : { assurance }) });

test("summary, assurance: a degraded machine mode says degraded and names what is not in force", () => {
  const md = renderSummaryMarkdown(minimalPayload({ delegation: charter({ declared: "machine", inForce: "machine", degraded: true,
    notInForce: ["M1 strict self-gate as a required check", "M8 required checks enforced for administrators, forge posture attested"], sentence: "s" }) }), { subjectDigest: DIGEST });
  assert.match(md, /Assurance mode in force \| `machine` \| declared, \*\*degraded\*\*: not in force: M1 strict self-gate as a required check; M8 /);
});

test("summary, assurance: an unreadable mode is none in force, the declared value is only quoted", () => {
  const md = renderSummaryMarkdown(minimalPayload({ delegation: charter({ declared: "per-act-ish", inForce: null, degraded: true, notInForce: [], sentence: null }) }), { subjectDigest: DIGEST });
  assert.match(md, /Assurance mode in force \| none in force \| \*\*degraded\*\*: the charter declares `per-act-ish`, which this version of the gate does not read \|/);
});

test("summary, assurance: a payload without the block reads not-observed, never a default mode", () => {
  const md = renderSummaryMarkdown(minimalPayload({ delegation: charter(undefined) }), { subjectDigest: DIGEST });
  assert.match(md, /Assurance mode in force \| not-observed \|/);
  assert.doesNotMatch(md, /`sampled`|`per-act`|`machine`/, "no mode is guessed");
  const none = renderSummaryMarkdown(minimalPayload(), { subjectDigest: DIGEST });
  assert.match(none, /Assurance mode in force \| none \| no delegation charter: not-observed \|/);
});

test("summary: every declared reading says declared; the CLI never raises a cell above ci-declared", () => {
  const att = JSON.parse(readFileSync(join(GOLDEN, "summary-self-attestation.json"), "utf8"));
  const md = renderSummaryMarkdown(att.predicate, { subjectDigest: att.subject[0].digest.sha256 });
  const rows = statusTable(md);
  for (const what of ["Ratification", "Delegation charter", "Assurance mode in force", "Sample ledger"]) {
    const row = rows.find((r) => r.startsWith(`| ${what} |`));
    assert.ok(row, `${what} is in the status table`);
    assert.match(row.split(" | ").at(-1), /declared/, `${what}'s standing says declared`);
  }
  assert.doesNotMatch(md, /machine-established|verified by a signature|\bsigned by\b/i, "no standing above ci-declared");
  assert.match(md, /unsigned: runward never signs and never verifies a signature/);
});

// ── Safe to post: hostile values from the tree ────────────────────────────────────────────────

const HOSTILE = [
  "a|b|c", "`x`` y", "@octocat", "@group/team", "<img src=x onerror=alert(1)>", "[click](https://evil.example)",
  "![i](https://evil.example/i.png)", "--> <script>x</script>", "line1\n| injected | row |\n\n# heading", "#1 !2 ~label %m $5 &3 ^4",
  "https://evil.example/path", "www.evil.example", "mailto:a@b.example", "$x^2$", "**bold** _em_ ~~del~~", "\u202Eevil\u202C",
  "\\|", "\u0000\u0007\r\u2028", "a@b.example", "javascript:alert(1)",
];

/** The code spans of a line, removed, with their contents returned (CommonMark: a run of N backticks
 *  closes the span opened by a run of exactly N). */
function splitCode(line) {
  const spans = [];
  let text = "", i = 0;
  while (i < line.length) {
    if (line[i] === "`" && line[i - 1] !== "\\") {
      let n = 0; while (line[i + n] === "`") n++;
      const fence = "`".repeat(n);
      let j = i + n, close = -1;
      while (j < line.length) {
        const k = line.indexOf(fence, j);
        if (k < 0) break;
        if (line[k + n] !== "`" && line[k - 1] !== "`") { close = k; break; }
        j = k + 1;
      }
      if (close >= 0) { spans.push(line.slice(i + n, close)); text += " CODE "; i = close + n; continue; }
      text += fence; i += n; continue;
    }
    text += line[i]; i++;
  }
  return { text, spans };
}

/** What a forge could turn into something live, found in the text outside code spans and fences.
 *  The summary's own markup (its bold, its italics, its mark) is found too: a hostile rendering is
 *  compared with the benign one, so only what a value added counts. */
function features(md) {
  const found = [];
  const lines = md.split("\n");
  found.push(`lines ${lines.length}`);
  let cols = null, fenced = false;
  lines.forEach((line, n) => {
    if (line.startsWith("```")) { fenced = !fenced; return; }
    if (fenced) return;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000B-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/.test(line)) found.push(`control or bidi character on line ${n + 1}`);
    const { text } = splitCode(line);
    if (line.startsWith("|")) {
      const pipes = (text.match(/(?<!\\)\|/g) ?? []).length;
      if (/^\|[-|]+\|$/.test(line)) cols = pipes;
      else if (cols !== null && pipes !== cols) found.push(`table row ${n + 1} has ${pipes} cell separators, not ${cols}`);
    } else cols = null;
    if (/</.test(text)) found.push(`raw < on line ${n + 1}`);
    if (/(?<!\\)\[/.test(text)) found.push(`unescaped [ on line ${n + 1}`);
    if (/@[A-Za-z0-9]/.test(text)) found.push(`a mention on line ${n + 1}`);
    if (/(?<![\\\w])[#!~%$&^][A-Za-z0-9]/.test(text.replace(/&(amp|lt|gt);/g, ""))) found.push(`a reference on line ${n + 1}: ${text}`);
    if (/[a-z]+:\/\//i.test(text) || /www\./i.test(text) || /mailto:[^\u200B]/i.test(text)) found.push(`an autolink on line ${n + 1}`);
    if (/(?<!\\)(\*\*|~~|(?<![\w\\])_\S)/.test(text)) found.push(`emphasis on line ${n + 1}`);
    if (/(?<!\\)\$/.test(text)) found.push(`inline math on line ${n + 1}`);
  });
  return found;
}

/** What a hostile value added to the page, as the list of features the benign rendering lacks. */
function injections(md, benign) {
  const base = features(benign);
  const got = features(md);
  const extra = got.filter((f) => { const i = base.indexOf(f); if (i < 0) return true; base.splice(i, 1); return false; });
  return extra.concat(base.map((f) => `missing ${f}`));
}

function hostilePayload(name) {
  return minimalPayload({
    verdict: "gaps", exitCode: 1, currentGate: name,
    gaps: { deliverables: 1, conformance: 1, hooks: 0, deferred: 0, proposed: 0, causesByKind: { [name]: { count: 1, indices: [0] } } },
    deliverables: [{ phase: name, artifact: name, relPath: name, state: "missing", cause: name }],
    conformance: [{ scope: name, rule: name, problem: `problem quoting ${name}`, kind: name, file: name, line: 3 }],
    ratification: { rows: 1, lineByLine: 0, enBloc: 1, blind: 1, untraced: 0,
      byRow: [{ deliverable: name, rule: name, state: "blind", mode: name, by: name, for: name, date: name }] },
    delegation: { file: name, banner: [name], stage: 1, accountable: name, delegates: [name],
      assurance: { declared: name, inForce: null, degraded: true, notInForce: [name], sentence: null }, sample: { present: true, banner: [name] } },
    next: { text: name, command: name }, gateNonScope: name,
  });
}

test("summary, hostile tree values: no link, mention, reference, HTML, emphasis, math or extra table cell reaches the page", () => {
  const benign = renderSummaryMarkdown(hostilePayload("plain"), { subjectDigest: DIGEST });
  assert.ok(features(benign).some((f) => f.startsWith("emphasis")), "the checker sees the summary's own bold (it is not blind)");
  for (const name of HOSTILE) {
    const md = renderSummaryMarkdown(hostilePayload(name), { subjectDigest: DIGEST });
    assert.deepEqual(injections(md, benign), [], `hostile value ${JSON.stringify(name)}`);
  }
});

test("summary, hostile tree values, positive control: the checker reddens on a naive rendering", () => {
  // The same document with every value interpolated raw: if the checker found nothing here, its
  // silence above would mean nothing.
  const benign = renderSummaryMarkdown(hostilePayload("plain"), { subjectDigest: DIGEST });
  const naive = (name) => benign.replace(/`plain`|plain/g, name);
  assert.deepEqual(injections(naive("plain"), benign), [], "the naive rendering of a benign value is the benign one");
  for (const name of ["a|b|c", "@octocat", "<img src=x>", "[click](https://evil.example)", "line1\n| x |", "#1", "www.evil.example", "**bold**", "$x$"]) {
    assert.notDeepEqual(injections(naive(name), benign), [], `the checker sees ${JSON.stringify(name)} rendered raw`);
  }
});

test("summary, hostile tree values: a code span keeps the value, a prose cell keeps its words", () => {
  for (const name of ["a|b", "`x`` y", "@octocat", "<b>", "x`"]) {
    const span = mdCode(name, false);
    const { spans } = splitCode(span);
    assert.equal(spans.length, 1, `${JSON.stringify(name)} is one code span`);
    const inner = spans[0].startsWith(" ") && spans[0].endsWith(" ") && spans[0].trim() !== "" ? spans[0].slice(1, -1) : spans[0];
    assert.equal(inner, name, "the value reads as the tree wrote it");
  }
  assert.equal(mdCode("a|b"), "`a\\|b`", "in a table, a pipe inside a code span is written \\|");
  assert.equal(mdCode(""), "(empty)");
  const words = mdProse("see @octocat at https://x.example").replace(/\u200B/g, "");
  assert.equal(words, "see @octocat at https://x.example", "only zero-width spaces were added to the words");
});

// ── Size ──────────────────────────────────────────────────────────────────────────────────────

test("summary size: the cap sits under GitHub's job summary and GitLab's note limits, marker included", () => {
  assert.ok(SUMMARY_MAX_BYTES <= GITHUB_MAX, "under GitHub's 1 MiB step summary");
  assert.ok(SUMMARY_MAX_BYTES + Buffer.byteLength(SUMMARY_MARKER + "\n") <= GITLAB_MAX, "under GitLab's note limit with runward-forge's marker");
});

test("summary size: a tree with thousands of long rows stays under the cap and says the list stops", () => {
  const long = "x".repeat(20_000);
  const conformance = Array.from({ length: 5000 }, (_, i) => ({ scope: long, rule: `${long}${i}`, problem: long, kind: "rule-violation", file: long, line: i }));
  const byRow = Array.from({ length: 5000 }, () => ({ deliverable: long, rule: long, state: "changed", mode: long, by: long, for: null, date: long }));
  const md = renderSummaryMarkdown(minimalPayload({ verdict: "gaps", exitCode: 1, conformance,
    gaps: { deliverables: 0, conformance: 5000, hooks: 0, deferred: 0, proposed: 0, causesByKind: { "rule-violation": { count: 5000, indices: conformance.map((_, i) => i) } } },
    ratification: { rows: 5000, lineByLine: 0, enBloc: 0, blind: 0, untraced: 0, changed: 5000, byRow } }), { subjectDigest: DIGEST });
  assert.ok(Buffer.byteLength(md) <= SUMMARY_MAX_BYTES, `${Buffer.byteLength(md)} bytes`);
  assert.match(md, /The list stops here\. `runward check --strict --json` carries every row\./);
  assert.match(md, /`rule-violation` \| 5000 \|/, "the count is the payload's, not the listed rows'");
});

// ── The command ───────────────────────────────────────────────────────────────────────────────

test("report --format md: refusals are usage errors (exit 2), and --out writes, replaces its own file, refuses another", () => {
  const dir = example();
  try {
    assert.equal(runRaw(dir, "report", "--format", "pdf").status, 2, "an unknown format is refused");
    const both = runRaw(dir, "report", "--format", "md", "--json");
    assert.equal(both.status, 2, "--json and a summary on stdout would be two documents on one stream");
    assert.equal(JSON.parse(both.stdout).error, "usage");
    run(dir, "report", "--format", "md", "--out", "summary.md");
    const first = readFileSync(join(dir, "summary.md"), "utf8");
    assert.ok(first.startsWith(SUMMARY_MARK));
    run(dir, "report", "--format", "md", "--out", "summary.md");
    assert.equal(readFileSync(join(dir, "summary.md"), "utf8"), first, "its own summary is replaced, byte-identical");
    assert.equal(first, run(dir, "report", "--format", "md"), "the file and standard output carry the same bytes");
    writeFileSync(join(dir, "notes.md"), "# my notes\n");
    assert.equal(runRaw(dir, "report", "--format", "md", "--out", "notes.md").status, 2, "a file that is not a summary is not overwritten");
    assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), "# my notes\n");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("report --format md --out inside runward/: the digest is taken before the write, said, and re-derivable", () => {
  const dir = example();
  try {
    run(dir, "report", "--format", "md", "--out", "runward/governance/summary.md");
    const file = join(dir, "runward", "governance", "summary.md");
    const md = readFileSync(file, "utf8");
    assert.match(md, /taken before `runward\/governance\/summary\.md` was written/);
    const printed = md.match(/subject digest is `([a-f0-9]{64})`/)[1];
    rmSync(file);
    assert.equal(JSON.parse(run(dir, "check", "--strict", "--attest")).subject[0].digest.sha256, printed,
      "remove the summary, attest: the subject digest is the one printed");
    assert.ok(!existsSync(file));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Where the summary goes: the gate Action and the GitLab template ───────────────────────────

/** A PATH directory whose `npx --yes runward@<v> ...` runs this tree's CLI (no network). */
function npxShim() {
  const bin = mkdtempSync(join(tmpdir(), "rw-summary-bin-"));
  writeFileSync(join(bin, "npx"), `#!/bin/sh\nshift; shift\nexec "${process.execPath}" "${CLI}" "$@"\n`);
  chmodSync(join(bin, "npx"), 0o755);
  return bin;
}

test("gate Action: under strict the job summary receives the summary's bytes; the step's exit code is the gate's", { skip: process.platform === "win32" }, () => {
  const ACTION = readFileSync(join(ROOT, "action.yml"), "utf8");
  const body = ACTION.slice(ACTION.indexOf("      run: |\n") + "      run: |\n".length).split("\n").map((l) => l.slice(8)).join("\n");
  const bin = npxShim();
  const dir = example();
  try {
    const script = join(bin, "run.sh");
    writeFileSync(script, body);
    const summaryFile = join(bin, "step-summary.md");
    const go = (env) => spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", script], { cwd: dir, encoding: "utf8",
      env: { ...process.env, ...ENV, PATH: `${bin}:${process.env.PATH}`, RUNWARD_VERSION: "0.0.0", RUNWARD_PATH: ".", RUNWARD_STRICT: "true", RUNWARD_SPEC: "", RUNWARD_CHECK: "true", GITHUB_STEP_SUMMARY: summaryFile, ...env } });
    assert.equal(go({}).status, 0, "clean");
    assert.equal(readFileSync(summaryFile, "utf8"), run(dir, "report", "--format", "md"), "the job summary carries the summary's bytes");
    rmSync(summaryFile);
    assert.equal(go({ RUNWARD_STRICT: "false" }).status, 0);
    assert.ok(!existsSync(summaryFile), "no summary without strict: it states the strict verdict");
    rmSync(join(dir, "runward", "handover.md"));
    assert.equal(go({}).status, 1, "a red gate keeps its exit code 1");
    assert.match(readFileSync(summaryFile, "utf8"), /^## runward gate: GAPS$/m, "and its summary says GAPS");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(bin, { recursive: true, force: true }); }
});

test("GitLab template: under strict the reports carry summary.md, the bytes report --format md renders", { skip: process.platform === "win32" }, () => {
  const [SPEC, JOBS] = yaml.loadAll(readFileSync(join(ROOT, "templates", "ci", "gitlab", "runward-gate.yml"), "utf8"));
  const job = JSON.parse(JSON.stringify(JOBS["runward-gate"]).replace(/\$\[\[ inputs\.([a-z-]+) \]\]/g, (_m, k) => String(SPEC.spec.inputs[k].default)));
  const bin = npxShim();
  const dir = example();
  try {
    const r = spawnSync("bash", ["-eo", "pipefail", "-c", job.script.join("\n")], { cwd: dir, encoding: "utf8",
      env: { ...process.env, ...ENV, ...job.variables, PATH: `${bin}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const md = readFileSync(join(dir, "runward-reports", "summary.md"), "utf8");
    assert.equal(md, run(dir, "report", "--format", "md"), "the deposited summary is the neutral rendering");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(bin, { recursive: true, force: true }); }
});
