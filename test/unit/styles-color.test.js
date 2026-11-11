// The terminal's colours, written in src/lib/styles.ts since ADR-0129: which level a run gets, the
// exact sequences of each level, and the same bytes as before when colours are off.
//
// The expected sequences below were recorded from the previous implementation (a dependency) at
// each level, on the same palette: a terminal that showed mineral gold still shows it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { colorLevel, paletteFor, status, createHeader } from "../../dist/lib/styles.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ESC = "\u001B";
const level = (env, { argv = [], tty = true, platform = "linux", release = "6.0.0" } = {}) => colorLevel(env, ["node", "cli.js", ...argv], tty, platform, release);

test("colours off: NO_COLOR, --no-color, FORCE_COLOR=0, an output that is not a terminal", () => {
  const term = { TERM: "xterm-256color", COLORTERM: "truecolor" };
  assert.equal(level(term), 3, "the control: this terminal gets colours");
  assert.equal(level({ ...term, NO_COLOR: "1" }), 0);
  assert.equal(level({ ...term, NO_COLOR: "1", FORCE_COLOR: "3" }), 0, "NO_COLOR wins over FORCE_COLOR");
  assert.equal(level({ ...term, NO_COLOR: "" }), 3, "an empty NO_COLOR is not set (no-color.org)");
  assert.equal(level(term, { argv: ["check", "--no-color"] }), 0);
  assert.equal(level(term, { argv: ["bundle", "--", "--no-color"] }), 3, "after `--` it is a file name, not the flag");
  assert.equal(level({ ...term, FORCE_COLOR: "0" }), 0);
  assert.equal(level({ ...term, FORCE_COLOR: "false" }), 0);
  assert.equal(level(term, { tty: false }), 0, "a pipe or a file gets no escape sequence");
  assert.equal(level({ TERM: "dumb" }), 0);
  assert.equal(level({}), 0, "a terminal that says nothing of itself");
});

test("FORCE_COLOR: a number is the level, `true` or empty turns colours on where they would be off", () => {
  assert.equal(level({ FORCE_COLOR: "1" }, { tty: false }), 1);
  assert.equal(level({ FORCE_COLOR: "2" }, { tty: false }), 2);
  assert.equal(level({ FORCE_COLOR: "3" }, { tty: false }), 3);
  assert.equal(level({ FORCE_COLOR: "9" }, { tty: false }), 3, "3 at most");
  assert.equal(level({ FORCE_COLOR: "true" }, { tty: false }), 1);
  assert.equal(level({ FORCE_COLOR: "" }, { tty: false }), 1);
  assert.equal(level({ FORCE_COLOR: "true", COLORTERM: "truecolor" }, { tty: false }), 3, "on, at the level the terminal declares");
  assert.equal(level({ FORCE_COLOR: "true", TERM: "dumb" }, { tty: false }), 1);
  assert.equal(level({ FORCE_COLOR: "yes", TERM: "xterm" }, { tty: false }), 0, "an unreadable value forces nothing");
  assert.equal(level({ FORCE_COLOR: "3" }, { argv: ["--no-color"] }), 3, "the variable is the more explicit of the two");
});

test("the level a terminal declares: TERM, COLORTERM, the terminal program, a CI, Windows", () => {
  assert.equal(level({ TERM: "xterm" }), 1);
  assert.equal(level({ TERM: "screen" }), 1);
  assert.equal(level({ TERM: "xterm-256color" }), 2);
  assert.equal(level({ TERM: "xterm-kitty" }), 3);
  assert.equal(level({ COLORTERM: "truecolor" }), 3);
  assert.equal(level({ COLORTERM: "yes" }), 1);
  assert.equal(level({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" }), 3);
  assert.equal(level({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "2.9.0" }), 2);
  assert.equal(level({ TERM_PROGRAM: "Apple_Terminal" }), 2);
  assert.equal(level({ CI: "true", GITHUB_ACTIONS: "true" }), 3);
  assert.equal(level({ CI: "true", GITLAB_CI: "true" }), 1);
  assert.equal(level({ CI: "true", TERM: "xterm-256color" }), 0, "a CI that is not known to render colours");
  assert.equal(level({ TF_BUILD: "True", AGENT_NAME: "a" }, { tty: false }), 1, "Azure Pipelines renders them without a terminal");
  assert.equal(level({}, { platform: "win32", release: "10.0.22631" }), 3);
  assert.equal(level({}, { platform: "win32", release: "10.0.10586" }), 2);
  assert.equal(level({}, { platform: "win32", release: "6.1.7601" }), 1);
  assert.equal(level({}, { platform: "win32", release: "10.0.22631", tty: false }), 0);
});

test("the sequences of each level: 24-bit, the 256-colour palette, the 16 basic colours", () => {
  const sample = (lv) => Object.fromEntries(Object.entries(paletteFor(lv)).map(([k, paint]) => [k, paint("x")]));
  const fixed = { bold: `${ESC}[1mx${ESC}[22m`, dim: `${ESC}[2mx${ESC}[22m`, white: `${ESC}[37mx${ESC}[39m`, success: `${ESC}[32mx${ESC}[39m`,
    error: `${ESC}[31mx${ESC}[39m`, warning: `${ESC}[33mx${ESC}[39m`, info: `${ESC}[36mx${ESC}[39m` };
  const fg = (code) => `${ESC}[${code}mx${ESC}[39m`;
  assert.deepEqual(sample(3), { ...fixed, primary: fg("38;2;201;164;92"), primaryLight: fg("38;2;224;194;133"), primaryDark: fg("38;2;168;133;63"),
    secondary: fg("38;2;176;184;196"), gray: fg("38;2;139;149;165"), darkGray: fg("38;2;90;101;119"), muted: fg("38;2;139;149;165"),
    primaryBold: `${ESC}[38;2;201;164;92m${ESC}[1mx${ESC}[22m${ESC}[39m` });
  assert.deepEqual(sample(2), { ...fixed, primary: fg("38;5;180"), primaryLight: fg("38;5;187"), primaryDark: fg("38;5;143"),
    secondary: fg("38;5;152"), gray: fg("38;5;145"), darkGray: fg("38;5;102"), muted: fg("38;5;145"),
    primaryBold: `${ESC}[38;5;180m${ESC}[1mx${ESC}[22m${ESC}[39m` });
  assert.deepEqual(sample(1), { ...fixed, primary: fg("33"), primaryLight: fg("37"), primaryDark: fg("33"),
    secondary: fg("37"), gray: fg("37"), darkGray: fg("30"), muted: fg("37"),
    primaryBold: `${ESC}[33m${ESC}[1mx${ESC}[22m${ESC}[39m` });
});

test("colours off: every painter returns its text as it is, byte for byte", () => {
  const off = paletteFor(0);
  for (const [name, paint] of Object.entries(off)) {
    for (const text of ["plain", "", "two\nlines", `already ${ESC}[31mred${ESC}[39m`]) assert.equal(paint(text), text, name);
    assert.equal(paint(42), "42", "a number is written as text");
    assert.equal(paint("a", "b"), "a b", "several texts are joined by a space");
  }
});

test("a painted text inside a painted text, a line break, an empty text", () => {
  const c = paletteFor(3);
  const gold = `${ESC}[38;2;201;164;92m`, gray = `${ESC}[38;2;139;149;165m`, off = `${ESC}[39m`;
  // The inner word's closing sequence would end the sentence's colour: the sentence reopens after it.
  assert.equal(c.gray(`run ${c.primary("runward check")} now`), `${gray}run ${gold}runward check${off}${gray} now${off}`);
  assert.equal(c.primaryBold(`a ${c.bold("b")} c`), `${gold}${ESC}[1ma ${ESC}[1mb${ESC}[22m${ESC}[1m c${ESC}[22m${off}`);
  // Closed before a line break and reopened after it, so the colour never runs into the margin.
  assert.equal(c.error("one\ntwo"), `${ESC}[31mone${off}\n${ESC}[31mtwo${off}`);
  assert.equal(c.error("one\r\ntwo"), `${ESC}[31mone${off}\r\n${ESC}[31mtwo${off}`);
  assert.equal(c.error(""), "", "nothing to paint, no sequence");
});

test("the real binary: no escape sequence in a pipe, the palette under FORCE_COLOR=3, none again with NO_COLOR or --no-color", () => {
  const probe = (env, args = []) => execFileSync(process.execPath, ["-e",
    `const { c, status, createHeader } = await import(${JSON.stringify(pathToFileURL(join(ROOT, "dist", "lib", "styles.js")).href)}); process.stdout.write(c.primary("gold") + status.success("ok") + createHeader("T"));`,
    "--input-type=module", "--", ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...env } });
  const plain = probe({});
  assert.ok(!plain.includes(ESC), "piped, with nothing forced");
  assert.ok(plain.startsWith("gold✓ ok\n┌"), plain.slice(0, 20));
  const forced = probe({ FORCE_COLOR: "3" });
  assert.ok(forced.startsWith(`${ESC}[38;2;201;164;92mgold${ESC}[39m${ESC}[32m✓ ${ESC}[39m${ESC}[37mok${ESC}[39m`), JSON.stringify(forced.slice(0, 80)));
  assert.equal(probe({ FORCE_COLOR: "3", NO_COLOR: "1" }), plain);
  assert.equal(probe({ TERM: "xterm-256color", FORCE_COLOR: "true" }, ["--no-color"]).includes(ESC), true, "FORCE_COLOR is the more explicit");
  assert.equal(probe({ FORCE_COLOR: "false" }), plain);
  // And the helpers measure what is seen, not the sequences: the header's box is as wide either way.
  const strip = (s) => s.replaceAll(/\u001B\[[0-9;]*m/g, "");
  assert.equal(strip(forced), plain);
  assert.equal(status.success("ok").includes("ok"), true);
  assert.equal(createHeader("T").split("\n").filter(Boolean).every((l) => strip(l).length === strip(createHeader("T").split("\n")[1]).length), true);
});
