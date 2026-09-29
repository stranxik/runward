// Unit tests for the evidence layer (ADR-0019/0020/0021): pointer grammar,
// per-type checks, pointed-content non-vacuity, signatures, sealing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { parseEvidencePointers, prosePointerSpellings, prosePointerLedger, evidenceReport, renderEvidenceLock, verifyEvidenceLock, collectSealableEvidence, unsafeSignature, SIGNATURE_MAX_LENGTH } from "../../dist/lib/evidence.js";

function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "runward-ev-"));
  const mission = join(root, "runward");
  mkdirSync(join(mission, "adr"), { recursive: true });
  return { root, mission };
}
const manifest = (rows) =>
  "# Floor\n\n## Rule conformance\n\n| Rule | Status | Evidence |\n|---|---|---|\n" +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n") + "\n";

test("parseEvidencePointers — grammar", () => {
  assert.deepEqual(parseEvidencePointers("plain prose, no pointer"), []);
  assert.deepEqual(parseEvidencePointers("file:src/x.ts"), [{ kind: "file", raw: "file:src/x.ts", path: "src/x.ts", line: undefined, symbol: undefined }]);
  const full = parseEvidencePointers("guard shipped — file:src/x.ts:22#assertGrounded")[0];
  assert.equal(full.path, "src/x.ts"); assert.equal(full.line, 22); assert.equal(full.symbol, "assertGrounded");
  const t = parseEvidencePointers("test:test/x.test.ts::rejects an ungrounded figure; file:src/y.ts");
  assert.equal(t.length, 2);
  assert.equal(t[0].kind, "test"); assert.equal(t[0].path, "test/x.test.ts"); assert.equal(t[0].testName, "rejects an ungrounded figure");
  assert.equal(t[1].path, "src/y.ts");
  assert.deepEqual(parseEvidencePointers("adr:0003"), [{ kind: "adr", raw: "adr:0003", adrId: "0003" }]);
  // a prose "test: covered in CI" (space after the colon) is not a pointer
  assert.deepEqual(parseEvidencePointers("test: covered in CI"), []);
  // quoted test names lose their quotes
  assert.equal(parseEvidencePointers('test:t.spec.ts::"name with spaces"')[0].testName, "name with spaces");
  // trailing punctuation from prose is stripped
  assert.equal(parseEvidencePointers("see file:src/x.ts.")[0].path, "src/x.ts");
});

test("evidenceReport — typed pointer checks", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "empty.ts"), "   \n");
    writeFileSync(join(root, "real.ts"), "export function assertGrounded() {}\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-empty", "applied", "file:empty.ts"],
      ["r-missing", "applied", "file:nope.ts"],
      ["r-line", "applied", "file:real.ts:99"],
      ["r-symbol", "applied", "file:real.ts#missingSym"],
      ["r-ok", "applied", "file:real.ts#assertGrounded"],
      ["r-adr", "applied", "adr:0042"],
      ["r-prose", "applied", "section §2 of the note"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.match(by("r-empty"), /empty file/);
    assert.match(by("r-missing"), /does not resolve/);
    assert.match(by("r-line"), /fewer than 99 lines/);
    assert.match(by("r-symbol"), /symbol "missingSym" not found/);
    assert.equal(by("r-ok"), "");
    assert.match(by("r-adr"), /no matching ADR/);
    assert.equal(by("r-prose"), ""); // prose stays the operator's judgment
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — untyped resolvable path must be non-empty; non-applied rows skipped", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "hollow.ts"), "");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-hollow", "applied", "implemented in hollow.ts overall"],
      ["r-na", "n/a", "file:nope.ts is irrelevant here"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.equal(v.length, 1);
    assert.equal(v[0].rule, "r-hollow");
    assert.match(v[0].problem, /empty file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — signatures (ADR-0020)", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "guard.ts"), "// fail-closed guard\n");
    writeFileSync(join(root, "plain.ts"), "export const x = 1;\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-signed-ok", "applied", "file:guard.ts"],
      ["r-signed-miss", "applied", "file:plain.ts"],
      ["r-signed-prose", "applied", "prose only, no file"],
      ["r-signed-bad", "applied", "file:plain.ts"],
      // A BARE path in prose is banked like a typed one (the non-vacuity loop reads it), so a signed
      // rule is satisfied — or refused — on what that file holds. Stryker 10's CallExpression
      // mutator dropped that `resolvedFiles.set` and nothing noticed: with it gone, both rows below
      // read "point the applied evidence at a file", the row citing the right file included.
      ["r-signed-bare-ok", "applied", "the guard lives in guard.ts, wired at boot"],
      ["r-signed-bare-miss", "applied", "see plain.ts for the wiring"],
    ]));
    const sig = "assertGrounded|fail[-\\s]?closed";
    const v = evidenceReport(mission, "floor.md", {
      "r-signed-ok": sig, "r-signed-miss": sig, "r-signed-prose": sig, "r-signed-bad": "([unclosed",
      "r-signed-bare-ok": sig, "r-signed-bare-miss": sig,
    });
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.equal(by("r-signed-ok"), "");
    assert.match(by("r-signed-miss"), /does not match the rule's signature/);
    assert.match(by("r-signed-prose"), /point the applied evidence at a file/);
    assert.match(by("r-signed-bad"), /invalid signature regex/);
    assert.equal(by("r-signed-bare-ok"), "", "a bare path at matching content satisfies the signed rule");
    assert.match(by("r-signed-bare-miss"), /does not match the rule's signature/,
      "a bare path is READ, so a mismatch is reported on the content, never as a missing pointer");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("unsafeSignature — catches nested quantifiers hidden inside a character class (ReDoS)", () => {
  // ([^()]+)+ hangs V8; the class-normalization screen must catch it, while leaving real signatures safe.
  assert.equal(unsafeSignature("(a+)+"), true);
  assert.equal(unsafeSignature("([^()]+)+$"), true);
  assert.equal(unsafeSignature("([a-z]+)*"), true);
  assert.equal(unsafeSignature("assertGrounded|GroundingError|fail[-\\s]?closed"), false);
  assert.equal(unsafeSignature("simple.*text"), false);
});

test("unsafeSignature — catches overlapping-alternation quantifiers, not just nested ones (ReDoS)", () => {
  // (a|a)+ hangs V8 the same way (a+)+ does, but has no quantifier INSIDE the group — the
  // nested-only screen missed it. The alternation screen catches a quantified alternation group.
  assert.equal(unsafeSignature("(a|a)+$"), true);
  assert.equal(unsafeSignature("(ab|a)+c"), true);
  assert.equal(unsafeSignature("(\\d|\\d)*x"), true);
  // A plain (unquantified) alternation or a linear quantified group stays safe — signatures need those.
  assert.equal(unsafeSignature("(GET|POST|PUT)"), false);
  assert.equal(unsafeSignature("(abc)+"), false);
});

test("verifyEvidenceLock — a lock key that escapes the project is rejected without reading it (traversal)", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(mission, "evidence-lock.json"), JSON.stringify({ version: 1, sealedAt: "2026-01-01", files: { "../../../../../../etc/hosts": "deadbeef" } }));
    const v = verifyEvidenceLock(mission).violations;
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /escapes the project/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidence lock — deterministic render, verify catches change and deletion", () => {
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "a.ts"), "content A\n");
    writeFileSync(join(mission, "floor.md"), manifest([["r1", "applied", "file:a.ts"]]));
    const lock1 = renderEvidenceLock(mission, "2026-07-16");
    const lock2 = renderEvidenceLock(mission, "2026-07-16");
    assert.equal(lock1, lock2); // byte-idempotent on unchanged evidence
    // The gated MANIFESTS are sealed alongside the files they cite. Without them, an audit sealed
    // 31 files, rewrote every `applied` row to `n/a`, and the gate still reported the seal intact:
    // the frozen files were no longer invoked by anything. A seal must cover the claim.
    assert.deepEqual(Object.keys(collectSealableEvidence(mission)), ["a.ts", "runward/floor.md"]);
    writeFileSync(join(mission, "evidence-lock.json"), lock1);
    assert.equal(verifyEvidenceLock(mission).violations.length, 0);
    writeFileSync(join(root, "a.ts"), "content B\n");
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /sealed evidence changed/);
    rmSync(join(root, "a.ts"));
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /sealed evidence missing/);
    // a corrupt lock is a violation, not a crash
    writeFileSync(join(mission, "evidence-lock.json"), "{not json");
    assert.match(verifyEvidenceLock(mission).violations[0].problem, /not valid JSON/);
    // no lock file → no seal check
    rmSync(join(mission, "evidence-lock.json"));
    assert.equal(verifyEvidenceLock(mission).present, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — a `../` pointer that climbs out of every base is refused (traversal)", () => {
  // Found by mutation: flipping `abs === baseAbs` to `!==` in resolveFile — which collapses the
  // containment check — survived the whole suite. `verifyEvidenceLock` had its traversal test; the
  // POINTER resolution path did not, and that is the path every `applied` row goes through.
  const { root, mission } = scaffold();
  const outside = join(root, "..", `rw-outside-${process.pid}.txt`);
  try {
    writeFileSync(outside, "a secret that lives outside the project\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-climb", "applied", `file:../../${basename(outside)}`],
      ["r-deep", "applied", "file:../../../../../../etc/hosts"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.match(by("r-climb"), /does not resolve/, "a real file outside the project is NOT evidence in it");
    assert.match(by("r-deep"), /does not resolve/, "and neither is one that exists on the machine");
  } finally { rmSync(outside, { force: true }); rmSync(root, { recursive: true, force: true }); }
});

test("evidenceReport — a sibling directory sharing the base's prefix is not inside it", () => {
  // The separator in `baseAbs + sep` is what stops `/a/project-evil` counting as under `/a/project`.
  // Nothing pinned it, so removing the separator would have gone unnoticed.
  const { root, mission } = scaffold();
  const sibling = `${root}-evil`;
  try {
    mkdirSync(sibling, { recursive: true });
    writeFileSync(join(sibling, "planted.ts"), "export const x = 1;\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-sibling", "applied", `file:../${basename(sibling)}/planted.ts`],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.match(v.filter((x) => x.rule === "r-sibling").map((x) => x.problem).join(" "), /does not resolve/,
      "a directory whose name merely starts with the base name is outside it");
  } finally { rmSync(sibling, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

// ── RWD-2026-0110 / RWD-2026-0111: prose is free, and a refusal quotes what was written ──────────
// Two defects found by measurement on 2026-09-12, both in the pointer tokeniser, both fixed here.
//
// 0110: a `file:`/`test:`/`adr:` spelling was read as a pointer ANYWHERE in a cell, so an ordinary
// sentence carrying one manufactured a pointer nobody wrote and the gate refused an HONEST row. It
// failed safe — red, never a false green — but it made prose more expensive than silence, which
// ADR-0072 ratified against. Position was tried as the fix and was wrong twice, measured against the
// 92 shipped manifest rows: "a run starts the segment" lost 14 readings and three rows their only
// pointer; "a run touches an edge" still lost two, because this repository cites mid-sentence in
// parentheses and as a sentence's subject. The operand's SHAPE is what separates a citation from a
// mention, so that is what the grammar asks.
//
// These tests pin BOTH directions, because a fix that only removed phantoms could have swallowed a
// real pointer instead — the failure this file has already paid for twice.

test("RWD-2026-0110: a sentence that contains a colon is not a pointer, and it is disclosed", () => {
  for (const [cell, spelling] of [
    ["the report is produced by npm run test:junit and committed", "test:junit"],
    ["we follow the adr:process we wrote down", "adr:process"],
    ["the file:name convention applies here", "file:name"],
  ]) {
    assert.deepEqual(parseEvidencePointers(cell), [], `${cell} — no phantom`);
    // Never silently: the operator who MEANT a pointer has to be able to see that it was not read.
    assert.deepEqual(prosePointerSpellings(cell), [spelling], `${cell} — disclosed`);
  }
  // The real pointer of a cell survives the mention that shares it.
  const mixed = parseEvidencePointers("file:src/x.ts#sym — produced by npm run test:junit and committed");
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].path, "src/x.ts");
  assert.deepEqual(prosePointerSpellings("file:src/x.ts#sym — produced by npm run test:junit and committed"), ["test:junit"]);
});

test("RWD-2026-0110: every shape the shipped manifests actually use still resolves", () => {
  // Each of these is a cell form measured in runward's own manifests on 2026-09-12. A fix that
  // dropped any one of them would have taken a real pointer out of the gate's reach while the row
  // still read as typed — which is how a deleted file once stayed cited and invisible.
  const shapes = [
    ["two separated by a space", "file:a.ts#Sym file:deleted.ts", ["a.ts", "deleted.ts"]],
    ["two separated by a comma", "file:a.ts#Sym, file:b.ts", ["a.ts", "b.ts"]],
    ["judgment first, citation last", "pure filesystem-only logic behind thin adapters — file:src/lib/conformance.ts#conformance", ["src/lib/conformance.ts"]],
    ["cited in parentheses, mid-sentence", "command handlers adapt the library (file:src/commands/check.ts#checkCommand), and CI samples stay inert", ["src/commands/check.ts"]],
    ["the pointer is the subject", "file:src/commands/manifest.ts#manifestCommand adapts the sync library to the CLI", ["src/commands/manifest.ts"]],
    ["written the way markdown is written", "`file:src/auth.ts#login`", ["src/auth.ts"]],
    ["trailing prose punctuation", "see file:src/x.ts.", ["src/x.ts"]],
  ];
  for (const [what, cell, paths] of shapes) {
    assert.deepEqual(parseEvidencePointers(cell).map((p) => p.path), paths, what);
    assert.deepEqual(prosePointerSpellings(cell), [], `${what} — nothing to disclose`);
  }
});

test("RWD-2026-0110: an ADR cited wrongly still fails loud; `adr:` inside a sentence does not", () => {
  // The two cases look alike and must not be treated alike. `adr:ADR-9999` is somebody citing a
  // decision and getting the spelling wrong: it stays a pointer that fails, because silence there is
  // how an operator comes to believe a decision was cited. `adr:process` is English.
  const wrong = parseEvidencePointers("adr:ADR-9999");
  assert.equal(wrong.length, 1);
  assert.match(wrong[0].malformed, /digits only/);
  assert.deepEqual(parseEvidencePointers("adr:0073").map((p) => p.adrId), ["0073"]);
  assert.deepEqual(parseEvidencePointers("we follow the adr:process we wrote down"), []);
});

test("RWD-2026-0110: the declared residual — an extension-less path reads as prose, and says so", () => {
  // Not a bug discovered later: the boundary the fix chose, pinned so it stays a choice. `Makefile`
  // is indistinguishable from `junit` by shape, and the tokeniser has no filesystem to ask (it must
  // parse a cell the same way in every checkout). So it is read as prose AND disclosed, and the
  // spelling that works costs two characters.
  assert.deepEqual(parseEvidencePointers("file:Makefile"), []);
  assert.deepEqual(prosePointerSpellings("file:Makefile"), ["file:Makefile"]);
  assert.deepEqual(parseEvidencePointers("file:./Makefile").map((p) => p.path), ["./Makefile"]);
});

test("RWD-2026-0110: an honest cell mentioning a script is not refused, end to end", () => {
  // The defect's actual cost, at the gate rather than in the parser: this row went red, on a
  // truthful sentence, for a reason that had nothing to do with its evidence.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "real.ts"), "export function guardFields() {}\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-honest", "applied", "file:real.ts#guardFields — the report is produced by npm run test:junit and committed"],
      ["r-placeholder", "applied", "[file:line, a test, ADR-id, or a reason]"],
    ]));
    const v = evidenceReport(mission, "floor.md", {});
    assert.deepEqual(v.filter((x) => x.rule === "r-honest"), []);
    // And the guard the old accident was doing keeps working, under its own name this time.
    const ph = v.filter((x) => x.rule === "r-placeholder");
    assert.equal(ph.length, 1);
    assert.match(ph[0].problem, /still the template placeholder/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("RWD-2026-0111: a refusal quotes the whole pointer, including a quoted name with spaces", () => {
  // The diagnosis was right and complete; the echo beside it stopped at the first space, so the
  // reader was shown a pointer nobody wrote, looking malformed, next to a sentence saying it was not.
  const cell = 'test:code/reports/junit.xml::"guard: a fabricated account reference never routes — escalated to review"';
  const p = parseEvidencePointers(cell)[0];
  assert.equal(p.raw, cell);
  assert.equal(p.testName, "guard: a fabricated account reference never routes — escalated to review");
  // An unquoted name echoes back QUOTED, so what the operator reads is a form they can paste.
  assert.equal(parseEvidencePointers("test:reports/junit.xml::an unquoted name with spaces")[0].raw,
    'test:reports/junit.xml::"an unquoted name with spaces"');
});

test("RWD-2026-0110: the disclosure is a mission-level ledger, so `check` can say it", () => {
  // The parser knowing is not enough — the operator has to be told, and the wiring is what tells
  // them. Applied rows only: a `deviated` or `n/a` row's cell is a reason, not a citation.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "real.ts"), "export function guardFields() {}\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-mention", "applied", "file:real.ts#guardFields — produced by npm run test:junit"],
      ["r-clean", "applied", "file:real.ts#guardFields"],
      ["r-na", "n/a", "no queue in this delivery, so the file:name convention cannot apply"],
    ]));
    assert.deepEqual(prosePointerLedger(mission), [
      { deliverable: "floor.md", rule: "r-mention", spelling: "test:junit" },
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── RWD-2026-0114: the ReDoS guard was itself quadratic ──────────────────────────────────────────
// Found on the FIRST run of the security scan installed under ADR-0075, which is the whole argument
// for installing one. `unsafeSignature`'s two flat scans are shaped `\([^()]*X[^()]*\)`, and two
// unbounded negated classes around one character class backtrack over every split point. Measured
// against `"(" + "a+".repeat(n) + ")x"` — an input that fails late by construction — 1.2 ms at 1 KB,
// 12.8 ms at 4 KB, 201 ms at 16 KB, 3202 ms at 64 KB: 4x the input, 16x the time.
//
// The answer it returned was never wrong. What was missing is a bound on the cost of a guard whose
// whole purpose is bounding cost.
test("RWD-2026-0114: the signature guard is bounded, and says which bound refused", () => {
  const pathological = "(" + "a+".repeat(32000) + ")x";
  const started = process.hrtime.bigint();
  assert.equal(unsafeSignature(pathological), true, "refusing is the safe direction and the true one");
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  // 3202 ms before the bound, ~0 ms after. 500 ms is a ceiling a slow runner clears and quadratic
  // behaviour cannot: a timing assertion is the only way to pin a cost fix, so it is set far from both.
  assert.ok(ms < 500, `the bound did not apply: ${ms.toFixed(0)} ms on a ${pathological.length}-character signature`);

  // Nothing that was refused before is accepted now, and nothing accepted before is refused.
  assert.equal(unsafeSignature("(a+)+"), true);
  assert.equal(unsafeSignature("idempoten|dead[-\\s]?letter|bounded[-\\s]?concurren"), false, "the longest signature this corpus ships (49 characters)");
  assert.equal("x".repeat(SIGNATURE_MAX_LENGTH).length, 512, "the bound is ten times the real ceiling, not near it");
  assert.equal(unsafeSignature("x".repeat(SIGNATURE_MAX_LENGTH)), false, "at the bound, still analysed");
  assert.equal(unsafeSignature("x".repeat(SIGNATURE_MAX_LENGTH + 1)), true, "one character past it, refused unanalysed");
});

test("RWD-2026-0114: the refusal names the real reason and does not dump 64 KB into the verdict", () => {
  // A length problem announced as "nested quantifiers" sends the operator looking for something that
  // is not there, and the full echo put the whole signature into the run, the machine payload and the
  // delivery report.
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    writeFileSync(join(root, "real.ts"), "export function guardFields() {}\n");
    const huge = "(" + "a+".repeat(2000) + ")x";
    for (const [slug, sig] of [["r-long", huge], ["r-shape", "(a+)+"]]) {
      writeFileSync(join(mission, "rules", `${slug}.md`),
        `---\ntitle: ${slug}\nimpact: CRITICAL\nasi: [ASI01]\nphases: [floor]\nsignature: ${sig}\n---\n\nBody.\n`);
    }
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-long", "applied", "file:real.ts#guardFields"],
      ["r-shape", "applied", "file:real.ts#guardFields"],
    ]));
    const v = evidenceReport(mission, "floor.md", { "r-long": huge, "r-shape": "(a+)+" });
    const by = (rule) => v.filter((x) => x.rule === rule).map((x) => x.problem).join(" | ");
    assert.match(by("r-long"), /longer than 512 characters/);
    assert.match(by("r-long"), /\(\d+ characters\)/, "the echo says how long it was instead of printing it");
    assert.ok(by("r-long").length < 500, `the refusal is readable, not a dump: ${by("r-long").length} characters`);
    assert.match(by("r-shape"), /nested or overlapping-alternation/);
    assert.ok(!/longer than/.test(by("r-shape")), "a shape problem is not reported as a length problem");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── Qualified survivors of the 0.40.0 ratchet: what changes a verdict gets killed ────────────────
// Each of these tests was written AFTER applying the mutant to the build and reading the difference,
// not before. The probe that told them apart had to be widened three times: each time, an "identical"
// turned out to be a "never reached". The 56 instructed survivors are all on a line the probe
// executes — the condition without which an equivalence is only an absence of observation.

test("the echo of a refused signature is whole below 120 characters, truncated above", () => {
  // Three mutants lived here: `sig.length > 120` -> `true` (always truncate), `>= 120` (the bound off
  // by one character), and `>= SIGNATURE_MAX_LENGTH` (the bound at 512). The message is what the
  // operator reads: a truncation that lies about the length, or a bound off by one character, is the
  // surface describing something other than what it did.
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(mission, "rules"), { recursive: true });
    writeFileSync(join(root, "real.ts"), "export function guardFields() {}\n");
    writeFileSync(join(mission, "rules", "r-sig.md"),
      "---\ntitle: r\nimpact: CRITICAL\nasi: [ASI01]\nphases: [floor]\n---\n\nBody.\n");
    writeFileSync(join(mission, "floor.md"), manifest([["r-sig", "applied", "file:real.ts#guardFields"]]));
    const say = (sig) => evidenceReport(mission, "floor.md", { "r-sig": sig })
      .filter((v) => v.rule === "r-sig").map((v) => v.problem).join(" | ");

    const unsafe = (n) => { let s = "(" + "a+".repeat(Math.ceil(n / 2)); return s.slice(0, n - 2) + ")x"; };
    const short = unsafe(90);
    assert.equal(short.length, 90);
    assert.ok(say(short).includes(`/${short}/`), "just under the threshold, the echo carries the whole signature");
    assert.ok(!/\(\d+ characters\)/.test(say(short)), "nothing is truncated below the threshold");

    const at120 = unsafe(120);
    assert.ok(say(at120).includes(`/${at120}/`), "at exactly 120, still whole — the bound is strict");
    const at121 = unsafe(121);
    assert.ok(!say(at121).includes(`/${at121}/`), "at 121, truncated");
    assert.match(say(at121), /\(121 characters\)/, "and the real length is stated, not guessed");

    // The analysis bound, for its part, is at 512: at 512 the signature is still analysed (so refused
    // for its SHAPE), at 513 it is refused without being analysed. Two refusals, two different reasons.
    assert.match(say(unsafe(512)), /nested or overlapping-alternation/);
    assert.match(say("b".repeat(513)), /longer than 512 characters/);
    assert.ok(!/longer than/.test(say(unsafe(512))), "at the exact bound, the reason stays the shape");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the seal freezes the ADR the row CITES, not the first one in the journal", () => {
  // Mutant: `adrPath(missionDir, \`ADR-${p.adrId}\`)` -> `adrPath(missionDir, \`\`)`. With a single ADR
  // in the journal, "the first" and "the right one" are the same file and the mutant is invisible. With
  // two, the seal freezes ADR-0001 while the row cites ADR-0007: the decision the deviation rests on
  // is no longer covered, which is what the ADR sealing loop exists to prevent.
  const { root, mission } = scaffold();
  try {
    mkdirSync(join(root, "docs", "adr"), { recursive: true });
    const adr = (id) => `# ${id} — a decision\n\n**Status**: accepted\n\n## Context\n\nIt had to be decided, and this records it.\n`;
    writeFileSync(join(root, "docs", "adr", "ADR-0001-first.md"), adr("ADR-0001"));
    writeFileSync(join(root, "docs", "adr", "ADR-0007-second.md"), adr("ADR-0007"));
    writeFileSync(join(mission, "floor.md"), manifest([["r-a", "applied", "adr:0007"]]));
    const keys = Object.keys(collectSealableEvidence(mission));
    assert.ok(keys.includes("docs/adr/ADR-0007-second.md"), `the cited ADR must be sealed — ${JSON.stringify(keys)}`);
    assert.ok(!keys.includes("docs/adr/ADR-0001-first.md"), "and not another one that happened to be there");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a cell that STARTS with a bracket is not a template left in place", () => {
  // Two mutants on the template guard's regex: losing `$` (everything that starts with a bracket),
  // and `\s` -> `\S`. The first refuses an honest cell that opens on a reference in brackets, the
  // second stops refusing the template. Both directions count: a guard that refuses correct work
  // gets switched off just as surely as a guard that refuses nothing.
  const { root, mission } = scaffold();
  try {
    writeFileSync(join(root, "real.ts"), "export function guardFields() {}\n");
    writeFileSync(join(mission, "floor.md"), manifest([
      ["r-template", "applied", "[file:line, a test, ADR-id, or a reason]"],
      ["r-spaces", "applied", "   [file:line, a test, ADR-id, or a reason]   "],
      ["r-prefix", "applied", "[the note in the annex] details what was applied, see file:real.ts#guardFields"],
      ["r-suffix", "applied", "[file:line, a test, ADR-id, or a reason] and a sentence written after"],
      ["r-abridged", "applied", "[abridged]"],
    ]));
    const by = (rule) => evidenceReport(mission, "floor.md", {}).filter((v) => v.rule === rule)
      .map((v) => v.problem).join(" | ");
    assert.match(by("r-template"), /still the template placeholder/);
    assert.match(by("r-spaces"), /still the template placeholder/, "surrounding spaces do not save the template");
    assert.ok(!/placeholder/.test(by("r-prefix")), "a cell that opens on a bracket and goes on is work");
    assert.ok(!/placeholder/.test(by("r-suffix")), "a sentence after the bracket is work");
    // The template is recognised by its SENTENCE in brackets, not by the bracket alone: `[abridged]` is
    // a reference someone wrote, and a guard that refuses it refuses correct work.
    assert.ok(!/placeholder/.test(by("r-abridged")), "a single word in brackets is not the template");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a `test:` whose target is not a path is prose, with or without a case name", () => {
  // Three mutants here: the `pathShaped` condition of the `::` branch, the block it guards, and the
  // echo of the branch without `::`. The first site was reached by NO input of the probe before it
  // was widened — there are two `if (!pathShaped(tpath))` and only the other one was exercised.
  assert.deepEqual(parseEvidencePointers("test:junit::a name"), []);
  // The disclosure carries the WHOLE spelling, case name included: the operator must recognise what
  // they wrote to decide whether it was a sentence or a misplaced citation.
  assert.deepEqual(prosePointerSpellings("test:junit::a name"), ['test:junit::"a name"']);
  assert.deepEqual(parseEvidencePointers('test:junit::"a quoted name"'), []);
  assert.deepEqual(parseEvidencePointers("test:junit"), []);
  // And the counterpart: a real target stays a pointer, with its echo intact.
  const p = parseEvidencePointers("test:reports/junit.xml")[0];
  assert.equal(p.raw, "test:reports/junit.xml");
  assert.equal(p.path, "reports/junit.xml");
  // An unquoted name comes back quoted: the echo is a form the operator can paste back (RWD-2026-0111).
  assert.equal(parseEvidencePointers("test:reports/junit.xml::a case")[0].raw, 'test:reports/junit.xml::"a case"');
  // The echo of a misspelt `adr:` names what was written, otherwise the refusal talks about an empty pointer.
  assert.equal(parseEvidencePointers("adr:ADR-9999")[0].raw, "adr:ADR-9999");
});
