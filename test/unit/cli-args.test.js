// The argument parser, read directly (ADR-0129): what a command is called with.
//
// test/unit/cli-usage-golden.test.js fixes the surface (help, usage errors, exit codes) on the real
// binary. This file reads the other half, which no screen shows: the arguments and options an
// argument list becomes, on a small program declared here so each rule is one line to read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineProgram, formatHelp, parseCli, suggestSimilar } from "../../dist/lib/cli-args.js";

function program() {
  const p = defineProgram("tool", "A tool.").option("--no-color", "no colours").option("--yes", "accept").option("--dry-run", "write nothing");
  p.command("build").description("build it")
    .option("-p, --path <path>", "where")
    .option("--strict", "strictly")
    .option("--whole-tree", "all of it")
    .option("--level <level>", "how far", { choices: ["low", "high"] })
    .option("--accept <ids...>", "which")
    .action(() => {});
  p.command("show").description("show it").argument("<what>", "the thing").argument("[rest...]", "more").option("--json", "as JSON").action(() => {});
  p.command("hook").description("hooked").requiredOption("--harness <id>", "which harness").action(() => {});
  return p;
}
const parse = (...argv) => parseCli(program(), argv);
const run = (...argv) => {
  const o = parse(...argv);
  assert.equal(o.kind, "run", `${argv.join(" ")}: ${JSON.stringify(o)}`);
  return o;
};

test("options: long, short, attached and separate values, the last one wins, keys are camelCased", () => {
  assert.deepEqual(run("build").options, {});
  assert.deepEqual(run("build", "--strict", "--whole-tree").options, { strict: true, wholeTree: true });
  for (const form of [["--path", "x"], ["--path=x"], ["-p", "x"], ["-px"]]) assert.deepEqual(run("build", ...form).options, { path: "x" }, form.join(" "));
  assert.deepEqual(run("build", "-p", "a", "--path", "b").options, { path: "b" });
  assert.deepEqual(run("build", "--path=").options, { path: "" }, "an attached empty value is a value");
  assert.deepEqual(run("build", "--path", "--strict").options, { path: "--strict" }, "an option that takes a value takes the next argument, whatever it looks like");
  assert.deepEqual(run("build", "--level", "high").options, { level: "high" });
});

test("variadic options collect the operands that follow, and repeat", () => {
  assert.deepEqual(run("build", "--accept", "a", "b", "--strict").options, { accept: ["a", "b"], strict: true });
  assert.deepEqual(run("build", "--accept", "a", "--accept", "b,c").options, { accept: ["a", "b,c"] });
  assert.deepEqual(run("build", "--accept", "-5", "-1.5").options, { accept: ["-5", "-1.5"] }, "a negative number is a value");
  const attached = parse("build", "--accept=a", "b");
  assert.equal(attached.kind, "usage", "an attached value closes the list: what follows is an operand");
  assert.equal(attached.code, "excessArguments");
  const ended = parse("build", "--accept", "a", "--", "b");
  assert.equal(ended.code, "excessArguments", "`--` closes the list too");
});

test("the program's options are read before and after the command, and never after `--`", () => {
  assert.deepEqual(run("build").globals, { color: true });
  assert.deepEqual(run("--yes", "build", "--dry-run", "--no-color").globals, { color: false, yes: true, dryRun: true });
  assert.deepEqual(run("build", "--path", "x", "--yes").globals, { color: true, yes: true });
  const o = run("show", "a", "--", "--yes", "--json");
  assert.deepEqual([o.args, o.options, o.globals], [["a", ["--yes", "--json"]], {}, { color: true }]);
  // A program option is taken wherever it stands, even where a command's option expected its value.
  assert.equal(parse("build", "--path", "--yes").code, "optionMissingArgument");
});

test("arguments: in their declared order, the variadic one takes the rest, an absent optional one is empty", () => {
  assert.deepEqual(run("show", "a").args, ["a", []]);
  assert.deepEqual(run("show", "a", "b", "c", "--json").args, ["a", ["b", "c"]]);
  assert.deepEqual(run("show", "--json", "a").options, { json: true });
  assert.deepEqual(run("show", "-5").args, ["-5", []], "a negative number is an operand, not an option");
  assert.equal(parse("show").code, "missingArgument");
  assert.equal(parse("build", "x").code, "excessArguments");
});

test("each usage error has its name and its sentence, and the first cause in this order is the one reported", () => {
  const cases = [
    [["nope"], "unknownCommand", "error: unknown command 'nope'"],
    [["buidl"], "unknownCommand", "error: unknown command 'buidl'\n(Did you mean build?)"],
    [["--nope"], "unknownOption", "error: unknown option '--nope'"],
    [["build", "--strct"], "unknownOption", "error: unknown option '--strct'\n(Did you mean --strict?)"],
    [["build", "--strict=1"], "unknownOption", "error: unknown option '--strict=1'\n(Did you mean --strict?)"],
    [["build", "-x"], "unknownOption", "error: unknown option '-x'"],
    [["build", "--path"], "optionMissingArgument", "error: option '-p, --path <path>' argument missing"],
    [["build", "--level", "mid"], "invalidArgument", "error: option '--level <level>' argument 'mid' is invalid. Allowed choices are low, high."],
    [["hook"], "missingMandatoryOptionValue", "error: required option '--harness <id>' not specified"],
    [["show"], "missingArgument", "error: missing required argument 'what'"],
    [["build", "a", "b"], "excessArguments", "error: too many arguments for 'build'. Expected 0 arguments but got 2: a, b."],
    // Precedence: a bad value before the help, the help before a missing required option, that
    // before an unknown option, that before the arguments.
    [["build", "--nope", "--level", "mid", "--help"], "invalidArgument", "error: option '--level <level>' argument 'mid' is invalid. Allowed choices are low, high."],
    [["hook", "--nope"], "missingMandatoryOptionValue", "error: required option '--harness <id>' not specified"],
    [["show", "--nope"], "unknownOption", "error: unknown option '--nope'"],
  ];
  for (const [argv, code, message] of cases) {
    const o = parse(...argv);
    assert.deepEqual([o.kind, o.code, o.message], ["usage", code, message], argv.join(" "));
  }
  assert.equal(parse("build", "--nope").command.name, "build", "a command's usage error names the command");
  assert.equal(parse("nope").command, undefined);
});

test("help and version: asked for, or shown because nothing else can be done", () => {
  assert.deepEqual(parse("--version"), { kind: "version" });
  assert.deepEqual(parse("build", "-V"), { kind: "version" });
  assert.deepEqual(parse("build", "--", "-V").kind, "usage", "after `--` it is an operand");
  assert.deepEqual([parse().kind, parse().error], ["help", true], "no command: the help, as an error");
  assert.deepEqual([parse("help").kind, parse("help").error, parse("help").command], ["help", false, undefined]);
  assert.equal(parse("help", "build").command.name, "build");
  assert.deepEqual([parse("help", "nope").kind, parse("help", "nope").error], ["help", true]);
  assert.equal(parse("build", "--help").command.name, "build");
  assert.equal(parse("build", "--nope", "-h").kind, "help", "the help is asked for even beside an unknown option");
  assert.equal(parse("--help", "build").command, undefined, "before the command name, it is the program's help");
  assert.equal(parse("nope", "--help").kind, "help");
  assert.equal(parse("build", "--path", "--help").kind, "run", "as an option's value it is a value");
});

test("suggestions: the closest names, only when close enough", () => {
  assert.equal(suggestSimilar("chekc", ["check", "status"]), "\n(Did you mean check?)");
  assert.equal(suggestSimilar("--jsno", ["--json", "--path"]), "\n(Did you mean --json?)");
  assert.equal(suggestSimilar("stat", ["stats", "state", "check"]), "\n(Did you mean one of state, stats?)");
  assert.equal(suggestSimilar("zzz", ["check", "status"]), "");
  assert.equal(suggestSimilar("x", ["y"]), "", "no one-letter guess");
});

test("the help: terms aligned, descriptions wrapped in their own column, to the width given", () => {
  const p = defineProgram("tool", "A tool that does a thing.").option("--yes", "accept");
  p.command("go").description("one two three four five six seven eight nine ten eleven twelve thirteen fourteen").argument("<file>", "the file").option("-p, --path <path>", "where it is").option("--mode <m>", "how", { choices: ["a", "b"] }).action(() => {});
  assert.equal(formatHelp(p, undefined, 80), [
    "Usage: tool [options] [command]", "", "A tool that does a thing.", "",
    "Options:", "  -V, --version        output the version number", "  --yes                accept", "  -h, --help           display help for command", "",
    "Commands:", "  go [options] <file>  one two three four five six seven eight nine ten eleven",
    "                       twelve thirteen fourteen", "  help [command]       display help for command", "",
  ].join("\n"));
  assert.equal(formatHelp(p, p.commands[0], 50), [
    "Usage: tool go [options] <file>", "", "one two three four five six seven eight nine ten", "eleven twelve thirteen fourteen", "",
    "Arguments:", "  file               the file", "",
    "Options:", "  -p, --path <path>  where it is", '  --mode <m>         how (choices: "a", "b")', "  -h, --help         display help for command", "",
  ].join("\n"));
  // Narrower than 40 columns for the descriptions, nothing is wrapped: a broken line helps nobody.
  assert.ok(formatHelp(p, undefined, 60).includes("eleven twelve thirteen fourteen\n"));
});

test("a declaration the parser cannot read fails when it is written, not when it is first used", () => {
  const p = defineProgram("tool", "");
  assert.throws(() => p.command("x").option("path <p>", "no dashes"), /unreadable option declaration/);
  assert.throws(() => p.command("y").argument("file", "no brackets"), /unreadable argument declaration/);
  assert.throws(() => defineProgram("t", "").option("-x", "short only"), /unreadable option declaration/);
  assert.throws(() => defineProgram("t", "").option("--level <n>", "a value"), /a program option takes no value/);
});
