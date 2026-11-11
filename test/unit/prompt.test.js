// The questions `runward init` asks at a terminal, written on node:readline (ADR-0129): a line of
// text, one choice by its number, several by their numbers; Ctrl-C and a closed input each end the
// question with an error the command reports; without a terminal, the question is refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openPrompter, PromptInterrupted, PromptInputClosed } from "../../dist/lib/prompt.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const strip = (s) => s.replaceAll(/\u001B\[[0-9;?]*[A-Za-z]/g, "");

/** A prompter fed by the test: `type(text)` is the person typing, `screen()` what was written. */
function session({ terminal = false } = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", (d) => { written += d; });
  const prompts = openPrompter({ input, output, terminal });
  return { prompts, type: (text) => input.write(text), end: () => input.end(), screen: () => strip(written) };
}
const CHOICES = [{ value: "a", name: "Alpha" }, { value: "b", name: "Beta" }, { value: "c", name: "Gamma" }];

test("input: the answer, trimmed; Enter alone takes the default; the default is shown", async () => {
  const s = session();
  const first = s.prompts.input({ message: "Project directory", default: "." });
  s.type("  my-dir \n");
  assert.equal(await first, "my-dir");
  const second = s.prompts.input({ message: "Project directory", default: "." });
  s.type("\n");
  assert.equal(await second, ".");
  const third = s.prompts.input({ message: "What are you building?", default: "" });
  s.type("\n");
  assert.equal(await third, "");
  s.prompts.close();
  assert.match(s.screen(), /\? Project directory \(\.\) /);
  assert.match(s.screen(), /\? What are you building\? $/m, "no hint for an empty default");
});

test("select: numbered choices; a number picks, Enter alone takes the first, anything else is asked again", async () => {
  const s = session();
  const picked = s.prompts.select({ message: "Entry mode", choices: CHOICES });
  s.type("2\n");
  assert.equal(await picked, "b");
  const first = s.prompts.select({ message: "Entry mode", choices: CHOICES });
  s.type("\n");
  assert.equal(await first, "a");
  const retried = s.prompts.select({ message: "Entry mode", choices: CHOICES });
  s.type("4\n");
  s.type("beta\n");
  s.type("0\n");
  s.type(" 3 \n");
  assert.equal(await retried, "c");
  s.prompts.close();
  const screen = s.screen();
  assert.match(screen, /\? Entry mode\n {2}1\) Alpha\n {2}2\) Beta\n {2}3\) Gamma\n {2}Number \(1\) /);
  for (const bad of ["4", "beta", "0"]) assert.ok(screen.includes(`! "${bad}" is not one of the numbers 1 to 3`), bad);
});

test("checkbox: several numbers, by spaces or commas, in the list's order; Enter alone takes none", async () => {
  const s = session();
  const some = s.prompts.checkbox({ message: "Tool profiles", choices: CHOICES });
  s.type("3, 1 3\n");
  assert.deepEqual(await some, ["a", "c"]);
  const none = s.prompts.checkbox({ message: "Tool profiles", choices: CHOICES });
  s.type("\n");
  assert.deepEqual(await none, []);
  const retried = s.prompts.checkbox({ message: "Tool profiles", choices: CHOICES });
  s.type("1 9\n");
  s.type("2\n");
  assert.deepEqual(await retried, ["b"], "a line with one wrong number selects nothing: it is asked again whole");
  s.prompts.close();
  assert.ok(s.screen().includes('! "9" is not one of the numbers 1 to 3'));
  assert.match(s.screen(), /Numbers, separated by spaces or commas \(Enter for none\) /);
});

test("lines typed ahead of their question are kept for it", async () => {
  const s = session();
  s.type("dir\n2\n1 2\n");
  assert.equal(await s.prompts.input({ message: "Directory", default: "." }), "dir");
  assert.equal(await s.prompts.select({ message: "Mode", choices: CHOICES }), "b");
  assert.deepEqual(await s.prompts.checkbox({ message: "Tools", choices: CHOICES }), ["a", "b"]);
  s.prompts.close();
});

test("Ctrl-C at a question ends it with PromptInterrupted, and every later question too", async () => {
  const s = session({ terminal: true });
  const asked = s.prompts.select({ message: "Entry mode", choices: CHOICES });
  s.type("\u0003");
  await assert.rejects(asked, (err) => err instanceof PromptInterrupted && /Ctrl-C/.test(err.message));
  await assert.rejects(s.prompts.input({ message: "again" }), PromptInterrupted);
  s.prompts.close();
});

test("an input that closes before the answer ends the question with PromptInputClosed", async () => {
  const s = session();
  const asked = s.prompts.input({ message: "Directory", default: "." });
  s.end();
  await assert.rejects(asked, (err) => err instanceof PromptInputClosed && /--yes/.test(err.message));
  // What was typed before the close is still answered; only the question left without a line fails.
  const t = session();
  t.type("dir\n");
  t.end();
  await new Promise((r) => setImmediate(r));
  assert.equal(await t.prompts.input({ message: "Directory" }), "dir");
  await assert.rejects(t.prompts.input({ message: "Idea" }), PromptInputClosed);
});

test("close() gives the input back: no question keeps the process alive", () => {
  const src = `const { openPrompter } = await import(${JSON.stringify(pathToFileURL(join(ROOT, "dist", "lib", "prompt.js")).href)});
    const { PassThrough } = await import("node:stream");
    const p = openPrompter({ input: process.stdin, output: new PassThrough(), terminal: false });
    p.close(); console.log("closed");`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", src], { encoding: "utf8", timeout: 20_000, stdio: ["pipe", "pipe", "pipe"] });
  assert.deepEqual([r.status, r.stdout.trim(), r.signal], [0, "closed", null]);
});

test("without a terminal the standard streams are refused with a sentence, never left waiting", () => {
  const src = `const { openPrompter } = await import(${JSON.stringify(pathToFileURL(join(ROOT, "dist", "lib", "prompt.js")).href)});
    try { openPrompter(); console.log("opened"); } catch (e) { console.log(e.message); }`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", src], { encoding: "utf8", input: "", timeout: 20_000 });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /a question needs a terminal to be answered in: run it in one, or pass --yes/);
});

test("init without a terminal asks nothing and takes the defaults, as before (ADR-0030)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-prompt-init-"));
  try {
    const env = { ...process.env, NO_COLOR: "1" };
    for (const k of ["CI", "RUNWARD_YES", "RUNWARD_DRY_RUN"]) delete env[k];
    const r = spawnSync(process.execPath, [CLI, "init"], { cwd: dir, encoding: "utf8", input: "", env, timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes("? "), "no question was printed");
    assert.ok(readdirSync(dir).includes("runward"), "the mission was scaffolded in the current directory");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
