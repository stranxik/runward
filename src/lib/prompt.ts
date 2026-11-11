/**
 * The three questions `runward init` asks a person at a terminal: a line of text, one choice in a
 * list, any number of choices in a list (ADR-0129). Written on `node:readline`, line by line.
 *
 * Choices are numbered and answered by typing the number, then Enter. There is no arrow-key
 * navigation and no menu to redraw: runward writes no raw-mode or cursor code of its own. At a
 * terminal `node:readline` does both for the line being typed (it reads keys in raw mode, which is
 * why Ctrl-C arrives here as its SIGINT event, and it writes cursor sequences to edit the line), and
 * gives the terminal back when the reader closes: Ctrl-C and a closed input close it. A process
 * killed in the middle of a question (SIGTERM, SIGKILL) may leave the terminal in raw mode.
 *
 * Who must not be asked is decided by the caller (`isNonInteractive`, ADR-0030: `--yes`, a CI, a
 * stream that is not a terminal). Called without a terminal all the same, a question is refused
 * with a sentence, never left waiting for an answer nobody can type.
 */
import { createInterface, type Interface } from "node:readline";
import { c } from "./styles.js";

export interface PromptStreams {
  input?: NodeJS.ReadableStream & { isTTY?: boolean };
  output?: NodeJS.WritableStream;
  /** Read keys as a terminal does (Ctrl-C is then a key). Default: whether `input` is a terminal. */
  terminal?: boolean;
}

export interface Choice<T extends string> { value: T; name: string }

/** Ctrl-C at a question. The caller's failure path reports it; `init` has written nothing yet. */
export class PromptInterrupted extends Error {
  constructor() {
    super("interrupted at a question (Ctrl-C): no answer was taken");
    this.name = "PromptInterrupted";
  }
}

/** The input ended (Ctrl-D, a closed pipe) before the question was answered. */
export class PromptInputClosed extends Error {
  constructor() {
    super("the input closed before the question was answered: run it in a terminal, or pass --yes to accept the defaults");
    this.name = "PromptInputClosed";
  }
}

export interface Prompter {
  /** A line of text; Enter alone takes the default. */
  input(opts: { message: string; default?: string }): Promise<string>;
  /** One choice, by its number; Enter alone takes the first. Asked again until the answer is one. */
  select<T extends string>(opts: { message: string; choices: readonly Choice<T>[] }): Promise<T>;
  /** Any number of choices, by their numbers; Enter alone takes none. Returned in the list's order. */
  checkbox<T extends string>(opts: { message: string; choices: readonly Choice<T>[] }): Promise<T[]>;
  /** Give the input back: an open question keeps the process alive. */
  close(): void;
}

const head = (message: string): string => `${c.info("?")} ${c.bold(message)}`;

/**
 * Open the questions on a terminal (standard input and output by default). One reader serves every
 * question, so a line typed or pasted ahead of its question is kept for it, not lost between two.
 */
export function openPrompter(streams: PromptStreams = {}): Prompter {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;
  const terminal = streams.terminal ?? input.isTTY === true;
  if (streams.input === undefined && !terminal) {
    throw new Error("a question needs a terminal to be answered in: run it in one, or pass --yes to accept the defaults");
  }
  const rl: Interface = createInterface({ input, output, terminal });
  const write = (s: string): void => { output.write(s); };

  const lines: string[] = [];
  let waiting: { resolve: (line: string) => void; reject: (err: Error) => void } | undefined;
  let failure: Error | undefined;
  let closedByUs = false;
  const fail = (err: Error): void => {
    if (failure || closedByUs) return;
    failure = err;
    write("\n");
    rl.close();
    waiting?.reject(err);
    waiting = undefined;
  };
  rl.on("line", (line) => {
    if (waiting) { const w = waiting; waiting = undefined; w.resolve(line); } else lines.push(line);
  });
  rl.on("SIGINT", () => fail(new PromptInterrupted()));
  rl.on("close", () => fail(new PromptInputClosed()));

  /** One line from the person; rejects on Ctrl-C and when the input ends first. */
  const ask = (query: string): Promise<string> => {
    const ahead = lines.shift();
    if (ahead !== undefined) { write(`${query}\n`); return Promise.resolve(ahead); }
    if (failure) return Promise.reject(failure);
    rl.setPrompt(query);
    rl.prompt();
    return new Promise((resolve, reject) => { waiting = { resolve, reject }; });
  };

  const list = <T extends string>(message: string, choices: readonly Choice<T>[]): void => {
    write(`${head(message)}\n`);
    choices.forEach((ch, i) => write(`  ${c.primary(`${i + 1})`)} ${ch.name}\n`));
  };
  const notANumber = (answer: string, count: number): void => {
    write(`  ${c.warning("!")} "${answer}" is not one of the numbers 1 to ${count}\n`);
  };

  return {
    async input(opts) {
      const hint = opts.default ? ` ${c.dim(`(${opts.default})`)}` : "";
      const answer = (await ask(`${head(opts.message)}${hint} `)).trim();
      return answer === "" ? opts.default ?? "" : answer;
    },
    async select(opts) {
      list(opts.message, opts.choices);
      for (;;) {
        const answer = (await ask(`  Number ${c.dim("(1)")} `)).trim();
        if (answer === "") return opts.choices[0].value;
        const picked = /^\d+$/.test(answer) ? opts.choices[Number(answer) - 1] : undefined;
        if (picked) return picked.value;
        notANumber(answer, opts.choices.length);
      }
    },
    async checkbox(opts) {
      list(opts.message, opts.choices);
      for (;;) {
        const answer = (await ask(`  Numbers, separated by spaces or commas ${c.dim("(Enter for none)")} `)).trim();
        const words = answer.split(/[\s,]+/).filter(Boolean);
        const bad = words.find((w) => !/^\d+$/.test(w) || opts.choices[Number(w) - 1] === undefined);
        if (bad === undefined) {
          const picked = new Set(words.map((w) => Number(w) - 1));
          return opts.choices.filter((_, i) => picked.has(i)).map((ch) => ch.value);
        }
        notANumber(bad, opts.choices.length);
      }
    },
    close() {
      closedByUs = true;
      rl.close();
    },
  };
}
