// Read a .tgz (ustar, gzip) with Node.js built-ins only. Shared by the qualification kit builder
// (ADR-0087) and the package SBOM (ADR-0116), which runs in a release job that installs nothing, so it
// must not import the kit builder (that one loads typescript).
import { gunzipSync } from "node:zlib";

/** Every regular file of a .tgz: [{ path, data }]. Handles ustar prefixes and pax path records. */
export function readTgz(buf) {
  const tar = gunzipSync(buf);
  const out = [];
  let off = 0, paxPath = null, longName = null;
  const str = (b, s, n) => b.subarray(s, s + n).toString("utf8").replace(/\0.*$/s, "");
  while (off + 512 <= tar.length) {
    const h = tar.subarray(off, off + 512);
    if (h.every((x) => x === 0)) break;
    const size = parseInt(str(h, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(h[156] || 48);
    const prefix = str(h, 345, 155);
    let name = (prefix ? `${prefix}/` : "") + str(h, 0, 100);
    const data = tar.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") { const m = data.toString("utf8").match(/\d+ path=([^\n]*)\n/); paxPath = m ? m[1] : null; continue; }
    if (type === "L") { longName = data.toString("utf8").replace(/\0.*$/s, ""); continue; }
    if (paxPath) { name = paxPath; paxPath = null; }
    if (longName) { name = longName; longName = null; }
    if (type === "0" || type === "\0") out.push({ path: name, data: Buffer.from(data) });
  }
  return out;
}
