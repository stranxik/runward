/**
 * The command line's own grammar: the declaration of a program and its commands, the reading of an
 * argument list against it, the help text and the usage errors (ADR-0129).
 *
 * runward owned none of this through 0.47.0: a dependency parsed the arguments and wrote the help. This
 * module replaces it on `util.parseArgs`, a Node.js built-in, and keeps the surface an operator, a CI
 * and the documentation already knew: the help text, the wording of each usage error and what each
 * one is called (`UsageCode`), all recorded from the previous implementation and compared byte for
 * byte by test/unit/cli-usage-golden.test.js.
 *
 * It is pure: it reads an argument list and returns an `Outcome`; it writes nothing, exits nowhere
 * and runs no command. `src/cli.ts` carries the outcome to the process.
 */
import { parseArgs } from "node:util";

export interface OptionSpec {
  /** As the help prints it: `--strict`, `-p, --path <path>`, `--accept <ids...>`, `--no-color`. */
  flags: string;
  description: string;
  /** The only values accepted; any other is a usage error. */
  choices?: readonly string[];
  /** The command refuses to run without it. */
  mandatory?: boolean;
}

export interface ArgumentSpec {
  /** As the help prints it: `<attestation>`, `[regime]`, `<artifacts...>`, `[verdicts...]`. */
  term: string;
  description: string;
}

export interface CommandSpec {
  name: string;
  description: string;
  options: OptionSpec[];
  arguments?: ArgumentSpec[];
  // Each command declares its own options type; the parser hands over what the declaration names.
  action: (...args: any[]) => unknown;
}

export interface ProgramSpec {
  name: string;
  description: string;
  /** Recognised before and after the command name. None takes a value. */
  options: OptionSpec[];
  commands: CommandSpec[];
}

/** What a usage error is called. Every one is operator misuse: exit 2 (ADR-0083). */
export type UsageCode =
  | "unknownCommand" | "unknownOption" | "invalidArgument" | "missingArgument" | "excessArguments"
  | "missingMandatoryOptionValue" | "optionMissingArgument";

export type Outcome =
  | { kind: "run"; command: CommandSpec; args: unknown[]; options: Record<string, unknown>; globals: Record<string, unknown> }
  /** `error`: the help nobody asked for (no command given, `help <unknown>`), written to stderr. */
  | { kind: "help"; command?: CommandSpec; error: boolean }
  | { kind: "version" }
  | { kind: "usage"; code: UsageCode; message: string; command?: CommandSpec };

interface Flag {
  spec: OptionSpec;
  long: string;         // "--path"
  short?: string;       // "-p"
  /** The key the command reads: `--dry-run` → `dryRun`, `--no-color` → `color`. */
  key: string;
  takesValue: boolean;
  variadic: boolean;
  negated: boolean;
}

const VERSION_OPTION: OptionSpec = { flags: "-V, --version", description: "output the version number" };
const HELP_OPTION: OptionSpec = { flags: "-h, --help", description: "display help for command" };
const HELP_COMMAND = { term: "help [command]", name: "help", description: "display help for command" };

function readFlag(spec: OptionSpec): Flag {
  const m = /^(?:(-[A-Za-z]), )?(--[A-Za-z][\w-]*)(?: <([^>]+)>)?$/.exec(spec.flags);
  if (!m) throw new Error(`cli-args: unreadable option declaration "${spec.flags}"`);
  const negated = m[2].startsWith("--no-");
  const name = m[2].slice(negated ? 5 : 2);
  return {
    spec, long: m[2], short: m[1], negated,
    key: name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase()),
    takesValue: m[3] !== undefined,
    variadic: m[3] !== undefined && m[3].endsWith("..."),
  };
}

const optionLike = (arg: string): boolean => arg.length > 1 && arg[0] === "-";
const negativeNumber = (arg: string): boolean => /^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg);
const asksForHelp = (arg: string): boolean => arg === "--help" || arg === "-h";
const usage = (code: UsageCode, message: string, command?: CommandSpec): Outcome => ({ kind: "usage", code, message, command });

/** Read an argument list (without `node` and the script) against the program's declaration. */
export function parseCli(program: ProgramSpec, argv: readonly string[]): Outcome {
  // ── The program's own options, wherever they stand before a `--` ──────────────────────────────
  // None takes a value, so each is one argument, recognised by its exact spelling. An argument is an
  // operand until the first option the program does not know; from there on everything is left to
  // the command, which is why a command name counts only before that point.
  const globalFlags = program.options.map(readFlag);
  const globals: Record<string, unknown> = {};
  for (const f of globalFlags) if (f.negated) globals[f.key] = true;
  const operands: string[] = [];
  const rest: string[] = [];
  let dest = operands;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      if (dest === rest) dest.push(arg);
      dest.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "--version" || (arg.startsWith("-V") && !arg.startsWith("--"))) return { kind: "version" };
    const flag = globalFlags.find((f) => f.long === arg);
    if (flag) { globals[flag.key] = !flag.negated; continue; }
    if (dest === operands && optionLike(arg)) dest = rest;
    dest.push(arg);
  }

  const command = program.commands.find((c) => c.name === operands[0]);
  if (command) return parseCommand(program, command, operands.slice(1), rest, globals);

  if (operands[0] === HELP_COMMAND.name) {
    if (!operands[1]) return { kind: "help", error: false };
    const about = program.commands.find((c) => c.name === operands[1]);
    return about ? { kind: "help", command: about, error: false } : { kind: "help", error: true };
  }
  if (operands.length === 0 && rest.length === 0) return { kind: "help", error: true };
  if (rest.some(asksForHelp)) return { kind: "help", error: false };
  if (operands.length > 0) {
    const names = [...program.commands.map((c) => c.name), HELP_COMMAND.name];
    return usage("unknownCommand", `error: unknown command '${operands[0]}'${suggestSimilar(operands[0], names)}`);
  }
  return usage("unknownOption", unknownOptionMessage(rest[0], [[VERSION_OPTION, ...program.options, HELP_OPTION]]));
}

function unknownOptionMessage(flag: string, visible: OptionSpec[][]): string {
  const suggestion = flag.startsWith("--")
    ? suggestSimilar(flag, visible.flat().map((o) => readFlag(o).long))
    : "";
  return `error: unknown option '${flag}'${suggestion}`;
}

function parseCommand(program: ProgramSpec, command: CommandSpec, before: string[], args: string[], globals: Record<string, unknown>): Outcome {
  const flags = command.options.map(readFlag);
  const byLong = new Map(flags.map((f) => [f.long.slice(2), f]));
  const config = {
    options: Object.fromEntries(flags.map((f) => [f.long.slice(2), {
      type: f.takesValue ? "string" as const : "boolean" as const,
      ...(f.short ? { short: f.short.slice(1) } : {}),
    }])),
    strict: false,
    allowPositionals: true,
    tokens: true,
  } as const;
  // `util.parseArgs` reads `-xp value` as the short options `-x` and `-p value`. Here a group of
  // short options is one argument, known as a whole or not at all (no command declares a short flag
  // without a value): when a group it does not start with a known option took the next argument as a
  // value, the group is set aside as the unknown option it is and the line is read again.
  const work = [...args];
  const written = new Map<number, string>();
  let tokens = parseArgs({ args: work, ...config }).tokens;
  for (;;) {
    const taker = tokens.find((t) => t.kind === "option" && !t.rawName.startsWith("--") && t.inlineValue === false
      && work[t.index].length > 2 && work[t.index].slice(0, 2) !== t.rawName);
    if (!taker) break;
    written.set(taker.index, work[taker.index]);
    work[taker.index] = `--\u0000${taker.index}`;
    tokens = parseArgs({ args: work, ...config }).tokens;
  }

  const options: Record<string, unknown> = {};
  const operands = [...before];
  let unknown: string | undefined;      // the first option this command does not know
  let helpAsked = false;
  let variadic: Flag | undefined;       // the option still collecting the operands that follow it
  let terminated = false;
  let lastIndex = -1;
  for (const token of tokens) {
    if (token.kind === "option-terminator") { terminated = true; variadic = undefined; continue; }
    if (token.kind === "positional") {
      if (terminated) {
        // After `--` nothing is an option; `--help` there counts only once an unknown option has
        // already handed the rest of the line over.
        if (unknown !== undefined && asksForHelp(token.value)) helpAsked = true;
        operands.push(token.value);
      } else if (variadic) (options[variadic.key] as string[]).push(token.value);
      else operands.push(token.value);
      continue;
    }
    // One argument can expand into several short options (`-ab`); it is judged once, as written.
    const raw = written.get(token.index) ?? work[token.index];
    const first = token.index !== lastIndex;
    lastIndex = token.index;
    const flag = byLong.get(token.name);
    // `-xp`: the `p` inside a group that does not start with a known option is not this command's `-p`.
    const insideGroup = !token.rawName.startsWith("--") && raw.length > 2 && !first;
    const declared = flag !== undefined && !insideGroup;
    if (declared && flag.takesValue) {
      variadic = undefined;
      if (token.value === undefined) return usage("optionMissingArgument", `error: option '${flag.spec.flags}' argument missing`, command);
      if (flag.spec.choices && !flag.spec.choices.includes(token.value)) {
        return usage("invalidArgument", `error: option '${flag.spec.flags}' argument '${token.value}' is invalid. Allowed choices are ${flag.spec.choices.join(", ")}.`, command);
      }
      if (flag.variadic) {
        options[flag.key] = [...((options[flag.key] as string[] | undefined) ?? []), token.value];
        // The operands that follow join it, unless its value came attached (`--accept=a`).
        if (!token.inlineValue) variadic = flag;
      } else options[flag.key] = token.value;
      continue;
    }
    if (declared && token.value === undefined) { variadic = undefined; options[flag.key] = !flag.negated; continue; }
    if (!first) continue;
    // Not an option of this command: a negative number is an operand, `--help` asks for the help,
    // anything else is the unknown option the error names (a flag given a value it does not take,
    // `--strict=1`, is named as written).
    if (negativeNumber(raw)) {
      if (variadic) (options[variadic.key] as string[]).push(raw);
      else operands.push(raw);
      continue;
    }
    variadic = undefined;
    if (asksForHelp(raw)) helpAsked = true;
    unknown ??= raw;
  }

  if (helpAsked) return { kind: "help", command, error: false };
  for (const f of flags) {
    if (f.spec.mandatory && options[f.key] === undefined) {
      return usage("missingMandatoryOptionValue", `error: required option '${f.spec.flags}' not specified`, command);
    }
  }
  if (unknown !== undefined) {
    return usage("unknownOption", unknownOptionMessage(unknown, [
      [...command.options, HELP_OPTION], [VERSION_OPTION, ...program.options, HELP_OPTION],
    ]), command);
  }

  const declaredArgs = (command.arguments ?? []).map(readArgument);
  for (const [i, a] of declaredArgs.entries()) {
    if (a.required && operands[i] === undefined) return usage("missingArgument", `error: missing required argument '${a.name}'`, command);
  }
  const lastIsVariadic = declaredArgs.length > 0 && declaredArgs[declaredArgs.length - 1].variadic;
  if (!lastIsVariadic && operands.length > declaredArgs.length) {
    const n = declaredArgs.length;
    return usage("excessArguments", `error: too many arguments for '${command.name}'. Expected ${n} argument${n === 1 ? "" : "s"} but got ${operands.length}: ${operands.join(", ")}.`, command);
  }
  const positional = declaredArgs.map((a, i) => (a.variadic ? operands.slice(i) : operands[i]));
  return { kind: "run", command, args: positional, options, globals };
}

function readArgument(spec: ArgumentSpec): { name: string; required: boolean; variadic: boolean } {
  const m = /^([<[])([\w-]+)(\.\.\.)?[>\]]$/.exec(spec.term);
  if (!m) throw new Error(`cli-args: unreadable argument declaration "${spec.term}"`);
  return { name: m[2], required: m[1] === "<", variadic: m[3] !== undefined };
}

// ── Suggestions ───────────────────────────────────────────────────────────────────────────────────

const MAX_DISTANCE = 3;

/** Optimal string alignment distance (Damerau-Levenshtein, no substring edited twice). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > MAX_DISTANCE) return Math.max(a.length, b.length);
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The closest names, all at the same distance, as the line an error carries; "" when none is close. */
export function suggestSimilar(word: string, candidates: readonly string[]): string {
  const isOption = word.startsWith("--");
  const strip = (s: string): string => (isOption ? s.slice(2) : s);
  const target = strip(word);
  let similar: string[] = [];
  let best = MAX_DISTANCE;
  for (const candidate of new Set(candidates.map(strip))) {
    if (candidate.length <= 1) continue;
    const distance = editDistance(target, candidate);
    const length = Math.max(target.length, candidate.length);
    if ((length - distance) / length <= 0.4) continue;
    if (distance < best) { best = distance; similar = [candidate]; }
    else if (distance === best) similar.push(candidate);
  }
  similar = similar.sort((a, b) => a.localeCompare(b)).map((s) => (isOption ? `--${s}` : s));
  if (similar.length > 1) return `\n(Did you mean one of ${similar.join(", ")}?)`;
  return similar.length === 1 ? `\n(Did you mean ${similar[0]}?)` : "";
}

// ── Help ──────────────────────────────────────────────────────────────────────────────────────────

const MIN_WIDTH_TO_WRAP = 40;

/** Break a text at spaces so no line exceeds `width`; narrower than 40 columns, it is left as it is. */
function wrap(text: string, width: number): string {
  if (width < MIN_WIDTH_TO_WRAP) return text;
  const lines: string[] = [];
  for (const line of text.split(/\r\n|\n/)) {
    const chunks = line.match(/[\s]*[^\s]+/g);
    if (chunks === null) { lines.push(""); continue; }
    let current = [chunks[0]];
    let used = chunks[0].length;
    for (const chunk of chunks.slice(1)) {
      if (used + chunk.length <= width) { current.push(chunk); used += chunk.length; continue; }
      lines.push(current.join(""));
      const next = chunk.trimStart();
      current = [next];
      used = next.length;
    }
    lines.push(current.join(""));
  }
  return lines.join("\n");
}

function optionDescription(o: OptionSpec): string {
  return o.choices ? `${o.description} (choices: ${o.choices.map((c) => JSON.stringify(c)).join(", ")})` : o.description;
}

const commandTerm = (c: CommandSpec): string => [c.name, "[options]", ...(c.arguments ?? []).map((a) => a.term)].join(" ");

/**
 * The help of the program, or of one command, for a stream `width` columns wide (a terminal's
 * columns; 80 when the stream is not a terminal). Descriptions wrap in their own column, and are
 * left on one line when that column would be narrower than 40.
 */
export function formatHelp(program: ProgramSpec, command: CommandSpec | undefined, width: number): string {
  const options = command ? [...command.options, HELP_OPTION] : [VERSION_OPTION, ...program.options, HELP_OPTION];
  // The usage line shows an argument as declared (`<attestation>`); its own entry, by its name.
  const args = (command?.arguments ?? []).map((a) => ({ term: readArgument(a).name, description: a.description }));
  const commands = command ? [] : [...program.commands.map((c) => ({ term: commandTerm(c), description: c.description })), HELP_COMMAND];
  const termWidth = Math.max(0, ...options.map((o) => o.flags.length), ...args.map((a) => a.term.length), ...commands.map((c) => c.term.length));

  const item = (term: string, description: string): string => {
    if (!description) return `  ${term}`;
    const room = width - termWidth - 4;
    const text = room < MIN_WIDTH_TO_WRAP || /\n[^\S\r\n]/.test(description)
      ? description
      : wrap(description, room).replace(/\n/g, "\n" + " ".repeat(termWidth + 2));
    return `  ${term.padEnd(termWidth)}  ${text.replace(/\n/g, "\n  ")}`;
  };
  const list = (heading: string, items: string[]): string[] => (items.length === 0 ? [] : [heading, ...items, ""]);

  const description = command ? command.description : program.description;
  const usageLine = command
    ? `${program.name} ${commandTerm(command)}`
    : `${program.name} [options] [command]`;
  return [
    `Usage: ${usageLine}`, "",
    ...(description ? [wrap(description, width), ""] : []),
    ...list("Arguments:", args.map((a) => item(a.term, a.description))),
    ...list("Options:", options.map((o) => item(o.flags, optionDescription(o)))),
    ...list("Commands:", commands.map((c) => item(c.term, c.description))),
  ].join("\n");
}

// ── Declaration ───────────────────────────────────────────────────────────────────────────────────

/** A command being declared: each call adds one line of its help, in the order written. */
export interface CommandBuilder {
  description(text: string): CommandBuilder;
  option(flags: string, description: string, extra?: { choices?: readonly string[] }): CommandBuilder;
  /** An option the command refuses to run without. */
  requiredOption(flags: string, description: string): CommandBuilder;
  argument(term: string, description: string): CommandBuilder;
  /** Called with the arguments in their declared order, then the options read. */
  action(fn: CommandSpec["action"]): void;
}

export interface ProgramBuilder extends ProgramSpec {
  /** One of the program's own options, recognised before and after the command name; none takes a value. */
  option(flags: string, description: string): ProgramBuilder;
  command(name: string): CommandBuilder;
}

/** Declare a program: its own options, then each of its commands, in the help's order. */
export function defineProgram(name: string, description: string): ProgramBuilder {
  const commands: CommandSpec[] = [];
  const options: OptionSpec[] = [];
  const program: ProgramBuilder = {
    name, description, options, commands,
    option(flags, text) {
      const option: OptionSpec = { flags, description: text };
      if (readFlag(option).takesValue) throw new Error(`cli-args: a program option takes no value ("${flags}")`);
      options.push(option);
      return program;
    },
    command(name: string): CommandBuilder {
      const spec: CommandSpec = { name, description: "", options: [], arguments: [], action: () => undefined };
      commands.push(spec);
      const builder: CommandBuilder = {
        description(text) { spec.description = text; return builder; },
        option(flags, description, extra) {
          const option: OptionSpec = { flags, description, ...extra };
          readFlag(option); // an unreadable declaration fails here, at start, not at the first use
          spec.options.push(option);
          return builder;
        },
        requiredOption(flags, description) {
          builder.option(flags, description);
          spec.options[spec.options.length - 1].mandatory = true;
          return builder;
        },
        argument(term, description) {
          readArgument({ term, description });
          spec.arguments!.push({ term, description });
          return builder;
        },
        action(fn) { spec.action = fn; },
      };
      return builder;
    },
  };
  return program;
}
