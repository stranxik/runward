// `check --hooks` executes the shell commands the operator's `runward/hooks.json` carries. Measured
// 2026-08-26: a hook of `sh -c "echo HOOK-RAN > /tmp/proof.txt"` writes that file OUTSIDE the audited
// repository and `check --strict --hooks` exits 0. Meanwhile README:164 read *"runs nothing of
// yours"* and runward's own port contract read *"no operation ever requires approval because none
// acts on the world"* — with `--hooks` listed in the signature nine lines above it.
//
// The CODE was precise the whole time: `hooks.ts` says "Opt-in only: runward's own gate never runs
// these ... so a clone cannot run anything by surprise", and the run prints `Hooks · before — N ok`.
// Only the prose overstated, which is the shape the 2026-08-26 audit found across the documents.
//
// This guard derives from the code rather than from a list: as long as `check` can call `runHooks`,
// the two documents that describe runward's execution surface must qualify their claim in the same
// sentence. Delete the hook seam and the guard goes quiet on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const CAN_EXECUTE = /runHooks\s*\(/.test(read("src/commands/check.ts"));

const CLAIMS = [
  ["README.md", /runs nothing of yours/],
  ["runward/contracts/port-contract.md", /none acts on the world|acts on nothing/],
];

test("while `check` can run operator commands, every 'runs nothing' claim names --hooks in the same sentence", () => {
  assert.ok(CAN_EXECUTE, "check.ts no longer calls runHooks — if the seam is gone, retire this guard deliberately");
  for (const [file, claim] of CLAIMS) {
    const text = read(file);
    // Sentence-level, not file-level: a caveat three paragraphs away is a caveat that was not made,
    // which is the principle compliance.ts already carries in a comment.
    const paras = text.split(/\n\s*\n/);
    const hits = paras.flatMap((para) =>
      para.split(/(?<=[.!?])\s+/).filter((s) => claim.test(s)).map((s) => [s, para]));
    assert.ok(hits.length > 0, `${file}: the claim this guard watches is gone — was it reworded? update the guard deliberately`);
    for (const [s, para] of hits) {
      // A sentence is honest if it names the exception, OR if it is explicitly SCOPED away from it
      // ("every other operation…") in a paragraph that names the exception. A caveat three
      // paragraphs away is a caveat that was not made — the principle compliance.ts already carries.
      const names = /--hooks|`hooks\.json`/;
      const scoped = /\b(every other|any other|other than|apart from|except|otherwise)\b/i.test(s) && names.test(para);
      assert.ok(names.test(s) || scoped,
        `${file}: "${s.trim().slice(0, 90)}…" claims runward runs nothing, in a build where \`check --hooks\` runs operator commands`);
    }
  }
});

test("the hook seam stays opt-in: nothing outside the --hooks flag reaches runHooks", () => {
  // The claim's other half. `--hooks` is honest only while it is the ONLY door: if any other path
  // called runHooks, "a clone cannot run anything by surprise" would stop being true.
  const check = read("src/commands/check.ts");
  const calls = [...check.matchAll(/runHooks\s*\(/g)];
  assert.ok(calls.length >= 1, "the seam exists");
  for (const m of calls) {
    const before = check.slice(Math.max(0, m.index - 400), m.index);
    assert.match(before, /opts\.hooks/, "a runHooks call not guarded by opts.hooks would run commands nobody asked for");
  }
  // And no other command may open the door.
  for (const f of ["src/commands/status.ts", "src/commands/compliance.ts", "src/commands/verify.ts"])
    assert.doesNotMatch(read(f), /runHooks/, `${f} must not run operator commands`);
});
