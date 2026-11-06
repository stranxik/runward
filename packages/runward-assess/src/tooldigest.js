// tooldigest.js: the digest of a directory, by sorted relative path and content. Used for the tool's
// own identity (its source, grid and corpus) and for the gate a snapshot acquired.
import { readdirSync, lstatSync, readFileSync, existsSync, readlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cmp } from "./canon.js";

export function dirDigest(root, skip = new Set([".git"])) {
  const h = createHash("sha256");
  const walk = (rel) => {
    for (const n of readdirSync(join(root, rel)).sort(cmp)) {
      if (skip.has(n)) continue;
      const r = rel ? rel + "/" + n : n;
      const st = lstatSync(join(root, r));
      if (st.isSymbolicLink()) { h.update(`L ${r}\0${readlinkSync(join(root, r))}\0`); continue; }
      if (st.isDirectory()) walk(r);
      else if (st.isFile()) { h.update(`F ${r}\0`); h.update(readFileSync(join(root, r))); h.update("\0"); }
    }
  };
  if (existsSync(root)) walk("");
  return h.digest("hex");
}

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The tool that measured: its source, grid and corpus, never its tests or its trial outputs. */
export function toolDigest() {
  const h = createHash("sha256");
  for (const d of ["bin", "src", "grid", "corpus"]) h.update(`${d}\0${dirDigest(join(PKG, d))}\0`);
  return h.digest("hex");
}
