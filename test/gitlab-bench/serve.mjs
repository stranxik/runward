// The bench's local package server: serves the files of one directory, read-only, to the
// containers of the bench's internal network. It stands in for the npm registry the bench cuts off:
// the GitLab job downloads runward's packed tarball and a pre-warmed npm cache from here and installs
// with `npm install --offline`. Test-only; it never runs outside test/gitlab-bench/bench.sh.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";

const root = process.argv[2] ?? "/srv";
const port = Number(process.argv[3] ?? 8080);

createServer(async (req, res) => {
  // One flat directory, no traversal: only the base name of the requested path is looked up.
  const name = basename(decodeURIComponent(new URL(req.url, "http://pkgs").pathname));
  try {
    const body = await readFile(join(root, name));
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": body.length });
    res.end(body);
    console.log(`200 ${name} ${body.length}`);
  } catch {
    res.writeHead(404).end();
    console.log(`404 ${name}`);
  }
}).listen(port, "0.0.0.0", () => console.log(`serving ${root} on ${port}`));
