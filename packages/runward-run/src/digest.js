// The digests a run Statement records, computed exactly as runward computes them when it re-derives
// the binding (docs/spec/runward-run.md §3), with no code shared with it (ADR-0120 decision 1):
//   a file's digest: SHA-256 of its content, the UTF-8 text with every CRLF read as LF when the bytes
//     hold no NUL, the bytes as they are otherwise (runward's seal and mission-state digest);
//   a map's digest: SHA-256 of the JSON of {path: digest} with the keys sorted by UTF-16 code unit;
//   a report's digest (a subject): SHA-256 of the bytes written, what `sha256sum` prints.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const hex = (data) => createHash("sha256").update(data).digest("hex");

/** The normalised digest of a file, or null when it cannot be read. */
export function fileDigest(abs) {
  let buf;
  try { buf = readFileSync(abs); } catch { return null; }
  return bufferDigest(buf);
}

export function bufferDigest(buf) {
  if (buf.includes(0)) return hex(buf);
  return hex(buf.toString("utf8").replace(/\r\n/g, "\n"));
}

/** SHA-256 of the raw bytes. */
export const rawDigest = (buf) => hex(buf);

/** The digest of a {path: digest} map. */
export function mapDigest(map) {
  const keys = Object.keys(map).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return hex(JSON.stringify(Object.fromEntries(keys.map((k) => [k, map[k]]))));
}
