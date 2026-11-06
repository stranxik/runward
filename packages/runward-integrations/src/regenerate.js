// The step every recipe runs, on every forge (runward ADR-0122 decision 1): the project's own command
// writes its report to a scratch file outside the tree, the recipe's normaliser makes it committable
// (ADR-0073 option 1), and the result replaces the report the mission cites, before the gate reads it.
//
// It runs the command it is given, as an argument vector and never a shell line, in the directory it is
// given. It decides nothing: it writes what the tool wrote, red or green, and exits with the tool's own
// status. When the tool wrote no report of the recipe's format it fails closed: it removes the report at
// the cited path, so that the gate cannot read a report this tree did not produce, and exits 3.
//
// Run as a plain CI step, what it writes is `declared` (runward ADR-0119 decision 1): nothing binds the
// report to the tree. The same command as a leg of a runward-run policy is bound by the run Statement
// and signed by the operator's CI, and reaches `attested` (ADR-0122 decision 5, ADR-0120).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NORMALIZERS } from "./normalize.js";

/** The package's own root, which a command names as `{rwi}` (the recipe's writers live under it). */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const RECIPES = Object.keys(NORMALIZERS);

/** What a plain CI step's report is, in the vocabulary of runward ADR-0119 decision 1, said on every run. */
export const DECLARED = "declared: a plain CI step binds nothing to the tree; the same command as a runward-run leg is bound by its run Statement and reaches attested once the operator's CI signs it (runward ADR-0119, ADR-0122 decision 5)";

export class RegenerateError extends Error {
  /** @param {"usage"|"refused"} kind */
  constructor(kind, message) { super(message); this.kind = kind; }
}

/** A project-relative path, `/`-separated, with no `.`/`..` segment and no absolute prefix. */
export function safeRelative(p) {
  if (typeof p !== "string" || p === "" || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s !== "" && s !== "." && s !== "..");
}

/** Reads a command given as a JSON argument vector. */
export function parseCommand(text) {
  let argv;
  try { argv = typeof text === "string" ? JSON.parse(text) : text; }
  catch { throw new RegenerateError("usage", `the command is not a JSON argument vector: ${JSON.stringify(String(text).slice(0, 120))} (write ["node", "--test", ...], never a shell line)`); }
  if (!Array.isArray(argv) || argv.length === 0 || !argv.every((a) => typeof a === "string" && a.length > 0 && !a.includes("\0"))) {
    throw new RegenerateError("usage", "the command must be a non-empty JSON array of non-empty strings (an argument vector, never a shell line)");
  }
  if (!argv.some((a) => a.includes("{raw}"))) {
    throw new RegenerateError("usage", "the command names no {raw}: the file its tool writes the report to, outside the tree, which the recipe normalises before it replaces the cited report");
  }
  return argv;
}

/**
 * Regenerates one report. Returns { exit, toolExit, report, census, message }; throws a RegenerateError
 * for a usage problem (exit 2, nothing done) or a refusal (exit 3, the cited report removed).
 */
export function regenerate({ recipe, cwd = ".", report, command, env = process.env, stdio = "inherit" }) {
  const n = NORMALIZERS[recipe];
  if (!n) throw new RegenerateError("usage", `unknown recipe ${JSON.stringify(recipe)}: one of ${RECIPES.join(", ")}`);
  const dir = resolve(cwd);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new RegenerateError("usage", `the working directory ${cwd} does not exist`);
  if (!safeRelative(report)) throw new RegenerateError("usage", `the report ${JSON.stringify(report)} is not a path relative to the working directory, inside it`);
  const argv = parseCommand(command);
  const target = join(dir, ...report.split("/"));
  const scratch = mkdtempSync(join(tmpdir(), `runward-integrations-${recipe}-`));
  const raw = join(scratch, `raw.${recipe === "coverage" ? "info" : recipe === "sarif" ? "sarif" : "xml"}`);
  try {
    const expanded = argv.map((a) => a.replaceAll("{raw}", raw).replaceAll("{rwi}", PACKAGE_ROOT));
    // `node` is the Node.js running this step, never whichever one the PATH finds first.
    const exe = expanded[0] === "node" ? process.execPath : expanded[0];
    const run = spawnSync(exe, expanded.slice(1), { cwd: dir, env, stdio, shell: false });
    const toolExit = run.error ? 127 : (run.status ?? 128);
    const refuse = (why) => {
      rmSync(target, { force: true });
      throw new RegenerateError("refused", `${recipe}: ${why}. Nothing was regenerated, and ${report} was removed so that the gate cannot read a report this tree did not produce (tool exit ${toolExit}${run.error ? `: ${run.error.message}` : ""})`);
    };
    if (!existsSync(raw)) refuse(`the command wrote no report at {raw}`);
    const text = readFileSync(raw, "utf8");
    if (recipe !== "coverage" && !/\S/.test(text)) refuse(`the command wrote an empty file at {raw}, which is no ${n.format} report`);
    if (!n.is(text)) refuse(`the command wrote a file at {raw} that is not a ${n.format} report`);
    let roots = [dir];
    try { roots = [...new Set([dir, realpathSync(dir)])]; } catch { /* the directory exists: realpath only adds a spelling */ }
    let normalized;
    try { normalized = n.normalize(text, roots); } catch (e) { refuse(`the report could not be normalised (${e.message})`); }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, normalized);
    const census = n.census(normalized);
    const empty = recipe === "coverage" && census.files === 0;
    const exit = toolExit === 0 && !empty ? 0 : 1;
    const said = recipe === "junit" ? `${census.cases} case(s), ${census.notGreen} not green`
      : recipe === "coverage" ? `${census.files} source file(s), ${census.executed} executed${empty ? ": it records no source file, which is not evidence" : ""}`
      : `${census.rules} rule(s) in force, ${census.results} result(s)`;
    return { exit, toolExit, report, census,
      message: `runward-integrations ${recipe}: wrote ${report} from the project's own run (${said}; tool exit ${toolExit}) — ${DECLARED}` };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
