// The measure's readers on throw-away repositories: each with a case that must be seen and one that
// must not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { measure } from "../src/measure.js";
import { Tree, governance, workflows, decisions, register, links, lexiconHits, plainText, triggers } from "../src/readers.js";
import { trace } from "../src/mission.js";
import { secrets, contributions, plantedCredentials } from "../src/history.js";
import { G, repo, PKG } from "./helpers.js";

const tree = (files) => new Tree(Object.keys(files), (p) => files[p] ?? null);
const MIT = readFileSync(join(PKG, "LICENSE"), "utf8");

test("governance files: a recognised licence, a channel and a delay in SECURITY, the three GOVERNANCE sections", () => {
  const good = governance(tree({ LICENSE: MIT, "README.md": "# x", "CONTRIBUTING.md": "x", "SECURITY.md": "Report a vulnerability via security/advisories/new; we answer within 5 business days.",
    "GOVERNANCE.md": "The maintainer decides. Decisions are ADRs. Succession: if the maintainer is gone, ownership passes on." })).facts;
  assert.equal(good["m.gou01.license_id"], "MIT");
  for (const k of ["m.gou01.license_spdx", "m.gou01.readme", "m.gou01.contributing", "m.gou01.security", "m.gou01.gov_roles", "m.gou01.gov_decisions", "m.gou01.gov_succession", "m.sec01.channel", "m.sec01.delay_days"]) assert.equal(good[k], true, k);
  const bad = governance(tree({ LICENSE: "All rights reserved.", "README.md": "# x", "SECURITY.md": "Be nice." })).facts;
  assert.equal(bad["m.gou01.license_id"], "unrecognised");
  for (const k of ["m.gou01.license_spdx", "m.gou01.contributing", "m.sec01.channel", "m.sec01.delay_days", "m.gou01.gov_roles"]) assert.equal(bad[k], false, k);
});

test("workflows: a pull_request_target that checks out the head, an unpinned action, no permissions; a signing job that installs", () => {
  const dangerous = `name: x\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: \${{ github.event.pull_request.head.sha }}\n  publish:\n    permissions:\n      id-token: write\n    steps:\n      - run: npm ci\n      - run: npm publish --provenance\n`;
  const clean = `name: y\non: [push]\npermissions: {}\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567\n  sign:\n    permissions:\n      id-token: write\n    steps:\n      - uses: actions/attest-build-provenance@0123456789abcdef0123456789abcdef01234567\n`;
  const bad = workflows(tree({ ".github/workflows/a.yml": dangerous }));
  assert.deepEqual(bad.details.findings.map((f) => f.rule).sort(), ["W1", "W2", "W3"]);
  assert.equal(bad.facts["m.sec06.signing_job_clean"], false);
  const good = workflows(tree({ ".github/workflows/b.yml": clean }));
  assert.equal(good.facts["m.sec05.workflow_high"], 0);
  assert.equal(good.facts["m.sec06.signing_job_clean"], true);
  assert.deepEqual([...triggers("on:\n  push:\n  pull_request_target:\n")], ["push", "pull_request_target"]);
  // a long workflow without the trigger is read in linear time (a backtracking pattern hung on this)
  const long = "name: z\non:\n" + "  push:\n".repeat(1) + "jobs:\n" + "  j:\n    steps:\n" + "      - run: echo x\n".repeat(20000);
  const t0 = process.hrtime.bigint();
  workflows(tree({ ".github/workflows/long.yml": long }));
  assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 < 2000, "a 20 000-line workflow reads in under two seconds");
});

test("decisions: a trigger date later than the ADR's own date and past the commit, with no later note, is overdue", () => {
  const adr = (date, trigger, extra = "") => `# ADR-0001 — x\n\n**Date**: ${date}\n**Status**: accepted\n\n## Context\n\nx\n\n## Reevaluation trigger (mandatory, dated)\n\n${trigger}\n${extra}`;
  const at = "2026-11-05T12:00:00Z";
  const overdue = decisions(tree({ "docs/adr/ADR-0001-x.md": adr("2026-01-01", "Reopen on 2026-06-01.") }), at).facts;
  assert.equal(overdue["m.gou05.overdue_unnoted"], 1);
  const future = decisions(tree({ "docs/adr/ADR-0001-x.md": adr("2026-01-01", "Reopen on 2027-06-01.") }), at).facts;
  assert.equal(future["m.gou05.overdue_unnoted"], 0, "a deadline still ahead is not overdue");
  const setOn = decisions(tree({ "docs/adr/ADR-0001-x.md": adr("2026-01-01", "Reopen if the format changes.\n\n**Trigger set on**: 2026-01-01") }), at).facts;
  assert.equal(setOn["m.gou05.overdue_unnoted"], 0, "the date a trigger was set on is not a deadline");
  assert.deepEqual(setOn["m.gou05.trigger_dated"], { d: 1, n: 1 });
  const noted = decisions(tree({ "docs/adr/ADR-0001-x.md": adr("2026-01-01", "Reopen on 2026-06-01.", "\n## Amendment 2026-07-02\n\nRe-read; still holds.\n") }), at).facts;
  assert.equal(noted["m.gou05.overdue_unnoted"], 0, "a dated note after the deadline answers it");
  const none = decisions(tree({ "docs/adr/ADR-0001-x.md": "# ADR-0001\n\n**Status**: maybe later\n" }), at).facts;
  assert.deepEqual(none["m.gou05.status_readable"], { d: 1, n: 0 });
});

test("the defect register: closed fields parsed, unclassified for more than 30 days, fixed without a test", () => {
  const reg = [
    "## Wrong verdicts, found 2026-08-04, closed in 0.32.0",
    "| RWD-2026-0001 | `affected-from=0.7.0` `fixed-in=0.32.0` `advisory=none:not-S1-S4` · x `class` = `wrong-verdict`, `effect` = `exit-code`, `found-by` = `adversarial-audit`. | Pinned by `test/unit/a.test.js`. | x |",
    "| RWD-2026-0002 | `affected-from=0.7.0` `fixed-in=0.32.0` `advisory=unclassified` · y `class` = `wrong-verdict`, `effect` = `exit-code`, `found-by` = `measurement`. | Fixed, no test named. | x |",
    "| RWD-2026-0003 | `affected-from=0.7.0` `fixed-in=not-fixed` · z, no class | Not fixed. | x |",
  ].join("\n");
  const r = register(tree({ "docs/known-defects.md": reg, "test/unit/a.test.js": "x" }), { path: "docs/known-defects.md", format: "runward-known-defects/1" }, "2026-11-05T00:00:00Z");
  assert.equal(r.facts["m.prv04.entries"], 3);
  assert.deepEqual(r.facts["m.prv04.parsed"], { d: 3, n: 2 }, "the entry without class and advisory is not parsed");
  assert.equal(r.facts["m.prv04.unclassified_over_30d"], 1);
  assert.equal(r.facts["m.prv04.fixed_without_test"], 1);
  const absent = register(tree({}), { path: "docs/known-defects.md", format: "runward-known-defects/1" }, "2026-11-05T00:00:00Z");
  assert.equal(absent.facts["m.prv04.register"], false);
});

test("links: a relative link to a file the tree lacks is broken; code spans and URLs are not links", () => {
  const r = links(tree({ "README.md": "[a](docs/a.md) [b](docs/missing.md) [c](https://example.org) `[d](nope.md)`", "docs/a.md": "x" }));
  assert.equal(r.facts["m.ado02.internal_links"], 2);
  assert.equal(r.facts["m.ado02.internal_broken"], 1);
});

test("the trace: a pointer to a renamed symbol does not resolve, a JUnit case is read in either quote spelling", () => {
  const files = {
    "runward/floor.md": "## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n| r1 | applied | file:src/a.ts#guardFields; test:reports/junit.xml::a \"quoted\" name |\n| r2 | applied | file:src/a.ts#oldName |\n| r3 | n/a | nothing |\n",
    "src/a.ts": "export function guardFields() {}\n",
    "reports/junit.xml": '<testsuites><testcase name="a &amp;quot;quoted&amp;quot; name" classname="t"/></testsuites>',
  };
  const t = trace(tree(files), {});
  assert.equal(t.facts["m.prv01.trace"], true);
  assert.equal(t.facts["m.prv01.ids_unique"], true);
  assert.deepEqual(t.facts["m.prv01.pointers"], { d: 3, n: 2 }, "the renamed symbol is the one that does not resolve");
  assert.match(t.details.unresolved[0], /#oldName/);
});

test("the overpromise lexicon: an assertion is a hit, a negated one is counted apart", () => {
  const C = "certi" + "fied";
  const text = plainText(`<p>runward is ${C}.</p><p>runward is not ${C}, and never says so.</p><p>No hallucination, guaranteed.</p>`, "html");
  const r = lexiconHits(text, G.data.lexicon);
  assert.equal(r.negated, 1);
  assert.ok(r.hits >= 3, `three assertions, one negation (${r.hits})`);
  assert.equal(lexiconHits("A plain sentence about rules.", G.data.lexicon).hits, 0);
});

test("secrets: a credential committed and removed later is found in the history; the control proves the scan sees", () => {
  const key = plantedCredentials().find((c) => c.pattern === "github-token").text;
  const r = repo([{ files: { "config.txt": key + "\n" } }, { files: { "config.txt": "token: <redacted>\n" } }]);
  try {
    const head = r.dir;
    const found = secrets(head, "HEAD", G.data.secrets);
    assert.equal(found.facts["m.sec04.control_detected"], true);
    assert.equal(found.facts["m.sec04.secrets_unexcepted"], 1, "the removed credential is still in the history");
    assert.ok(!JSON.stringify(found).includes(key.split(" ").pop()), "the credential itself is never written out");
    const fp = found.details.findings[0].fingerprint;
    const excepted = secrets(head, "HEAD", G.data.secrets, [{ criterion: "SEC-04", fingerprint: fp, reason: "a test fixture", date: "2026-11-06" }]);
    assert.equal(excepted.facts["m.sec04.secrets_unexcepted"], 0, "a motivated exception removes it");
    const blind = secrets(head, "HEAD", { ...G.data.secrets, patterns: G.data.secrets.patterns.filter((p) => p.id !== "npm-token") });
    assert.equal(blind.facts["m.sec04.control_detected"], false);
    assert.ok("$unobserved" in blind.facts["m.sec04.secrets_unexcepted"], "a scan that cannot see a planted credential observes nothing");
  } finally { r.cleanup(); }
});

test("CHAOSS: a bot's commits are left out of the factors", () => {
  const commits = [];
  for (let i = 0; i < 6; i++) commits.push({ files: { [`b${i}`]: "x" }, author: "dependabot[bot]", email: "49699333+dependabot[bot]@users.noreply.github.com" });
  for (let i = 0; i < 3; i++) commits.push({ files: { [`a${i}`]: "x" }, author: "Ann", email: "ann@example.org" });
  commits.push({ files: { c: "x" }, author: "Carl", email: "carl" + "@" + "gmail.com" });
  const r = repo(commits);
  try {
    const f = contributions(r.dir, "HEAD", null, G.data.bots, G.data.domains);
    assert.equal(f.facts["m.gou04.window_commits"], 4, "6 of 10 commits are a bot's");
    assert.equal(f.facts["m.gou04.absence_factor"], 1, "Ann alone makes half of the human commits");
    assert.equal(f.details.botCommits, 6);
    assert.ok(!JSON.stringify(f).includes("ann@example.org"), "no address is written out");
  } finally { r.cleanup(); }
});

test("measure: one commit, only facts the catalogue defines, and every mechanized commit fact present", () => {
  const r = repo([{ files: { LICENSE: MIT, "README.md": "# demo\n\n64 craft rules. See [g](docs/g.md).\n", "docs/g.md": "g", "SECURITY.md": "mailto:security@example.org within 3 days",
    "package.json": JSON.stringify({ name: "demo", version: "1.0.0", dependencies: { x: "1.0.0" } }), "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/x": { version: "1.0.0" } } }) } }]);
  try {
    const profile = { schema: "runward-assess-profile/1", profiles: ["L"], facts: { publie_paquet: "demo", surfaces_publiques: { files: ["README.md"], urls: [] }, exceptions: [] } };
    const m = measure({ repo: r.dir, rev: "HEAD", slug: "fixture/demo", profile, grid: G, network: "blocked (test)" });
    for (const k of Object.keys(m.facts)) assert.ok(G.catalogue.facts[k], `${k} is in the catalogue`);
    const mechanized = Object.entries(G.catalogue.facts).filter(([k, f]) => k.startsWith("m.") && f.mechanized === true).map(([k]) => k);
    for (const k of mechanized) assert.ok(k in m.facts, `${k} is emitted (mechanized: true)`);
    for (const [k, f] of Object.entries(G.catalogue.facts)) if (k.startsWith("m.") && f.mechanized === false) assert.ok(!(k in m.facts), `${k} is not emitted (mechanized: false)`);
    assert.equal(m.facts["m.sec02.lockfile"], true);
    assert.ok(!JSON.stringify(m).includes(r.dir), "no absolute path of the run reaches the measure");
  } finally { r.cleanup(); }
});

test("false alarms the heuristics must not raise: an inert documented key, a head fetched as objects, a set-on date, a forbidden-words list", () => {
  // the access key id AWS documents, assembled here: listed by fingerprint, never counted
  const doc = "AK" + "IA" + "IOSFODNN7" + "EXAMPLE";
  const r = repo([{ files: { "notes.md": `the documented example ${doc} is exempted\n` } }]);
  try {
    assert.equal(secrets(r.dir, "HEAD", G.data.secrets).facts["m.sec04.secrets_unexcepted"], 0);
    const live = plantedCredentials().find((c) => c.pattern === "aws-access-key-id").text;
    const r2 = repo([{ files: { "notes.md": live + "\n" } }]);
    try { assert.equal(secrets(r2.dir, "HEAD", G.data.secrets).facts["m.sec04.secrets_unexcepted"], 1, "positive control: any other key of that shape counts"); } finally { r2.cleanup(); }
  } finally { r.cleanup(); }
  const fetchOnly = `on:\n  pull_request_target:\npermissions:\n  contents: read\njobs:\n  guard:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567\n        with:\n          persist-credentials: false\n      # never checks out github.event.pull_request.head.sha\n      - run: git fetch origin "+refs/pull/1/head:refs/x/head"\n`;
  assert.equal(workflows(tree({ ".github/workflows/g.yml": fetchOnly })).facts["m.sec05.workflow_high"], 0, "the head fetched as objects, never checked out, is not W1");
  const adr = "# ADR-0001\n\n**Status**: accepted\n\n## Reevaluation trigger\n\nReopen if the journal moves.\n\n**Trigger set on**: 2026-07-16\n";
  assert.equal(decisions(tree({ "runward/adr/ADR-0001-x.md": adr }), "2026-11-05T00:00:00Z").facts["m.gou05.overdue_unnoted"], 0, "with no own date, the set-on date is still not a deadline");
  const list = lexiconHits(`- **Never** say: "${"compl" + "iant"}", "${"certi" + "fied"}".`, G.data.lexicon);
  assert.equal(list.hits, 0);
  assert.equal(list.negated, 2);
});
