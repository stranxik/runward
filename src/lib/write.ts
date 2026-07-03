import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { c } from "./styles.js";

export interface WriteOptions {
  force: boolean;
  dryRun: boolean;
  root: string; // for relative display
}

export interface WriteStats {
  written: number;
  skipped: number;
}

export function makeWriter(opts: WriteOptions) {
  const stats: WriteStats = { written: 0, skipped: 0 };

  function write(path: string, content: string) {
    const rel = relative(opts.root, path) || path;
    if (existsSync(path) && !opts.force) {
      stats.skipped++;
      console.log(`  ${c.darkGray("skip ")} ${c.gray(rel)} ${c.darkGray("(exists — --force to overwrite)")}`);
      return;
    }
    if (opts.dryRun) {
      stats.written++;
      console.log(`  ${c.info("would write")} ${rel}`);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    stats.written++;
    console.log(`  ${c.success("write")} ${c.white(rel)}`);
  }

  function copy(src: string, dest: string, transform?: (s: string) => string) {
    let content = readFileSync(src, "utf8");
    if (transform) content = transform(content);
    write(dest, content);
  }

  return { write, copy, stats };
}
