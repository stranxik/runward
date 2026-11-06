/**
 * The files a project delivers, as its own `.gitignore` files say, read without git (ADR-0113 decision 5).
 *
 * `check --attest --whole-tree` binds them as a second subject of the attestation, so that `verify` can
 * answer "the whole delivered tree matches" or name each file that changed. "Tracked by git" is the
 * notion a reader has in mind, and asking git would be a spawned process on the command that owns the
 * exit code (ADR-0054 crossing 1). Reading `.git/index` would be reading git's state rather than the
 * working tree. What a project does not deliver is already written down, in its `.gitignore` files, so
 * this module reads those, with git's pattern rules (gitignore(5)), and nothing else:
 *
 * - only `.gitignore` files at or below the project root: no `.git/info/exclude`, no global excludes
 *   file (that would read the home directory, ADR-0054 crossing 3), nothing above the root;
 * - a `.git` entry is never listed, and a directory holding one is another repository, never entered
 *   (ADR-0054 crossing 4);
 * - a symbolic link is listed as a link and never followed;
 * - patterns match case-sensitively and paths are compared in Unicode NFC, on every operating system, so the
 *   same tree gives the same list on macOS, Linux and Windows.
 *
 * Pure: it reads, it returns, it hashes nothing. What is bound, and how, is attestation.ts's.
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One delivered entry: its project-relative, `/`-separated path (NFC), where it is, and what it is. */
export interface DeliveredEntry { rel: string; abs: string; kind: "file" | "symlink" }

interface IgnorePattern { negate: boolean; dirOnly: boolean; anchored: boolean; re: RegExp }
interface IgnoreLevel { base: string; patterns: IgnorePattern[] }

/** Trailing spaces end a pattern unless a backslash escapes them (gitignore(5)). */
function trimTrailingSpaces(line: string): string {
  let end = line.length;
  while (end > 0 && line[end - 1] === " ") {
    // Count the backslashes right before this space: an odd number escapes it.
    let k = end - 2, slashes = 0;
    while (k >= 0 && line[k] === "\\") { slashes++; k--; }
    if (slashes % 2 === 1) break;
    end--;
  }
  return line.slice(0, end);
}

const RE_SPECIAL = /[\\^$.*+?()[\]{}|/]/;
const escapeRe = (c: string): string => (RE_SPECIAL.test(c) ? `\\${c}` : c);

const POSIX_CLASSES: Record<string, string> = {
  alnum: "A-Za-z0-9", alpha: "A-Za-z", digit: "0-9", lower: "a-z", upper: "A-Z", xdigit: "0-9A-Fa-f",
  space: " \\t\\n\\r\\f\\v", blank: " \\t", cntrl: "\\x00-\\x1f\\x7f", print: "\\x20-\\x7e",
  graph: "\\x21-\\x7e", punct: "!-\\/:-@\\[-`{-~",
};

/** One literal character inside a regex character class: punctuation escaped, letters and digits as
 *  they are (an escaped letter in a glob is the letter; `\\d` in a class would be every digit). */
const classChar = (c: string): string => (/[A-Za-z0-9]/.test(c) ? c : `\\${c}`);

/** A bracket expression starting at `glob[start] === "["`, as a regex that never matches `/`, or null
 *  when it does not close (a lone `[` is then a literal, as in git's wildmatch). */
function bracket(glob: string, start: number): { re: string; end: number } | null {
  let i = start + 1;
  let negate = false;
  if (glob[i] === "!" || glob[i] === "^") { negate = true; i++; }
  let body = "";
  let first = true;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "]" && !first) {
      const cls = `[${negate ? "^" : ""}${body}]`;
      return { re: negate ? `(?!/)${cls}` : `(?:(?!/)${cls})`, end: i };
    }
    first = false;
    if (c === "[" && glob[i + 1] === ":") {
      const close = glob.indexOf(":]", i + 2);
      const name = close > 0 ? glob.slice(i + 2, close) : "";
      if (close > 0 && POSIX_CLASSES[name] !== undefined) { body += POSIX_CLASSES[name]; i = close + 2; continue; }
    }
    if (c === "\\" && i + 1 < glob.length) { body += classChar(glob[i + 1]); i += 2; continue; }
    if (c === "-" && body !== "" && glob[i + 1] !== "]" && i + 1 < glob.length) { body += "-"; i++; continue; }
    body += classChar(c);
    i++;
  }
  return null;
}

/** gitignore(5)'s glob as a regular expression body: `*` and `?` never cross `/`; `**` as a whole path
 *  component crosses directories (`**\/x`, `x/**`, `x/**\/y`); any other run of asterisks is one `*`. */
export function globToRegexBody(glob: string): string {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      let j = i;
      while (glob[j] === "*") j++;
      const run = j - i;
      if (run >= 2 && (i === 0 || glob[i - 1] === "/") && (j === glob.length || glob[j] === "/")) {
        if (j === glob.length) re += ".*";
        else { re += "(?:.*/)?"; j++; }
        i = j - 1;
        continue;
      }
      re += "[^/]*";
      i = j - 1;
      continue;
    }
    if (c === "?") { re += "[^/]"; continue; }
    if (c === "[") {
      const b = bracket(glob, i);
      if (b) { re += b.re; i = b.end; continue; }
      re += "\\[";
      continue;
    }
    if (c === "\\" && i + 1 < glob.length) { re += escapeRe(glob[i + 1]); i++; continue; }
    re += escapeRe(c);
  }
  return re;
}

/** One line of a `.gitignore`, or null for a blank line, a comment, or a pattern that names nothing. */
export function parseIgnoreLine(raw: string): IgnorePattern | null {
  let line = raw.replace(/\r$/, "");
  if (line === "" || line.startsWith("#")) return null;
  line = trimTrailingSpaces(line);
  if (line === "") return null;
  let negate = false;
  if (line.startsWith("!")) { negate = true; line = line.slice(1); }
  let dirOnly = false;
  if (line.endsWith("/")) { dirOnly = true; line = line.replace(/\/+$/, ""); }
  let anchored = false;
  if (line.startsWith("/")) { anchored = true; line = line.replace(/^\/+/, ""); }
  if (line.includes("/")) anchored = true;
  if (line === "") return null;
  return { negate, dirOnly, anchored, re: new RegExp(`^${globToRegexBody(line.normalize("NFC"))}$`) };
}

function readIgnoreFile(abs: string): IgnorePattern[] {
  try {
    // A `.gitignore` that is a symbolic link is not followed, as git does not follow it.
    if (!lstatSync(abs).isFile()) return [];
    const text = readFileSync(abs, "utf8").replace(/^﻿/, "");
    return text.split("\n").map(parseIgnoreLine).filter((p): p is IgnorePattern => p !== null);
  } catch { return []; }
}

/** Whether `rel` (project-relative, `/`-separated) is ignored by the levels in force, deepest last: the
 *  last pattern that matches decides, a negation re-including (gitignore(5)). */
export function ignoredBy(levels: readonly IgnoreLevel[], rel: string, isDir: boolean): boolean {
  let ignored = false;
  for (const level of levels) {
    const local = level.base === "" ? rel : rel.slice(level.base.length + 1);
    const name = local.slice(local.lastIndexOf("/") + 1);
    for (const p of level.patterns) {
      if (p.dirOnly && !isDir) continue;
      if (p.re.test(p.anchored ? local : name)) ignored = !p.negate;
    }
  }
  return ignored;
}

/** Whether anything, a dangling link included, stands at `abs`. */
function present(abs: string): boolean {
  try { lstatSync(abs); return true; } catch { return false; }
}

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every file and symbolic link under `root` that the project's `.gitignore` files do not ignore, sorted
 * by path. A directory that is ignored is not entered, so nothing below it can be re-included, as in git.
 */
export function deliveredEntries(root: string): DeliveredEntry[] {
  const out: DeliveredEntry[] = [];
  const walk = (abs: string, rel: string, levels: IgnoreLevel[]): void => {
    const here = readIgnoreFile(join(abs, ".gitignore"));
    const inForce = here.length ? [...levels, { base: rel, patterns: here }] : levels;
    let names: string[];
    try { names = readdirSync(abs); } catch { return; }
    for (const name of names.sort(byName)) {
      if (name === ".git") continue;
      const childAbs = join(abs, name);
      const childRel = (rel === "" ? name : `${rel}/${name}`).normalize("NFC");
      let st;
      try { st = lstatSync(childAbs); } catch { continue; }
      if (st.isSymbolicLink()) {
        if (!ignoredBy(inForce, childRel, false)) out.push({ rel: childRel, abs: childAbs, kind: "symlink" });
      } else if (st.isDirectory()) {
        if (ignoredBy(inForce, childRel, true)) continue;
        if (present(join(childAbs, ".git"))) continue; // another repository: never entered
        walk(childAbs, childRel, inForce);
      } else if (st.isFile()) {
        if (!ignoredBy(inForce, childRel, false)) out.push({ rel: childRel, abs: childAbs, kind: "file" });
      }
    }
  };
  walk(root, "", []);
  return out.sort((a, b) => byName(a.rel, b.rel));
}
