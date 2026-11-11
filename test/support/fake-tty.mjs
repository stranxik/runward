// Runs the CLI as if both standard streams were terminals of a given width, so the help's wrapping
// (which follows the terminal's columns, and is fixed at 80 when the stream is not a terminal) can be
// recorded and compared without a pseudo-terminal: `node fake-tty.mjs <cli.js> <columns> [args...]`.
import { pathToFileURL } from "node:url";

const [cli, columns, ...args] = process.argv.slice(2);
for (const stream of [process.stdout, process.stderr]) {
  Object.defineProperty(stream, "isTTY", { value: true, configurable: true });
  Object.defineProperty(stream, "columns", { value: Number(columns), configurable: true });
}
process.argv = [process.argv[0], cli, ...args];
await import(pathToFileURL(cli).href);
