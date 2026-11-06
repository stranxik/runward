// The GitLab step of each runward-integrations recipe, its script run as a GitLab Runner runs it (each
// line in a shell, the job stopping at the first line that fails), against runward-integrations packed by
// npm and served on the loopback address, as an offline instance would serve the release asset. Held here:
//   - with the pinned sha256, the package is fetched, unpacked, and the recipe's step regenerates the
//     cited report from the project's command;
//   - with any other sha256, nothing runs: the job fails at the fetch, exit 3, and the cited report is
//     the committed one, untouched (the gate job after it reads no report this job produced);
//   - a sha256 that is not one is refused before anything is fetched.
// GitLab CE itself, the include pinned by commit and the artifact handed to the gate job, is the GitLab
// bench's (test/gitlab-bench, docs/gitlab-bench.md): it needs a GitLab, which these tests do not boot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { ROOT } from "../support/run-lab.js";

const PKG = join(ROOT, "packages", "runward-integrations");
const skip = process.platform === "win32" ? "the GitLab Runner's docker executor runs these lines in a POSIX shell; Windows has none to run them in" : false;
const dirs = [];
test.after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const tmp = (p) => { const d = realpathSync(mkdtempSync(join(tmpdir(), p))); dirs.push(d); return d; };

/** The package as `npm pack` writes it, served on 127.0.0.1 at a port the system picks. */
async function served() {
  const dir = tmp("rwi-pack-");
  execFileSync("npm", ["pack", "--silent", "--pack-destination", dir], { cwd: PKG, stdio: "pipe" });
  const tgz = join(dir, readdirSync(dir).find((f) => f.endsWith(".tgz")));
  const body = readFileSync(tgz);
  const server = createServer((req, res) => {
    if (req.url === "/runward-integrations.tgz") { res.writeHead(200, { "content-length": body.length }); res.end(body); }
    else res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}/runward-integrations.tgz`, sha256: createHash("sha256").update(body).digest("hex"), close: () => server.close() };
}

/** Runs the job's script lines the way a runner does: one shell, stop at the first line that fails. */
function runJob(lines, env, cwd) {
  const script = `set -e\n${lines.join("\n")}\n`;
  return new Promise((resolve) => {
    const p = spawn("bash", ["-c", script], { cwd, env: { ...process.env, ...env } });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("close", (code) => resolve({ code, out }));
  });
}

const JUNIT_WRITER = ["node", "-e", 'require("fs").writeFileSync(process.argv[1], `<testsuites>\\n\\t<testcase name="the case" classname="t" time="0.1" file="${process.cwd()}/test/a.test.ts"/>\\n</testsuites>\\n`)', "{raw}"];

test("GitLab: with the pinned sha256 the recipe's job fetches the package and regenerates the cited report", { skip }, async () => {
  const srv = await served();
  try {
    const job = loadYaml(readFileSync(join(PKG, "recipes", "junit", "gitlab", "junit.gitlab-ci.yml"), "utf8"))[".runward-integrations-junit"];
    const project = tmp("rwi-gl-project-");
    mkdirSync(join(project, "code", "reports"), { recursive: true });
    writeFileSync(join(project, "code", "reports", "junit.xml"), "<testsuites><testcase name=\"committed\"/></testsuites>\n");
    const env = { ...job.variables, TMPDIR: tmp("rwi-gl-tmp-"), RWI_PACKAGE_URL: srv.url, RWI_PACKAGE_SHA256: srv.sha256, RWI_CWD: "code", RWI_REPORT: "reports/junit.xml", RWI_COMMAND: JSON.stringify(JUNIT_WRITER) };
    const r = await runJob(job.script, env, project);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /runward-integrations junit: wrote reports\/junit\.xml from the project's own run \(1 case\(s\), 0 not green; tool exit 0\)/);
    const report = readFileSync(join(project, "code", "reports", "junit.xml"), "utf8");
    assert.equal(report, "<testsuites>\n\t<testcase name=\"the case\" classname=\"t\"/>\n</testsuites>\n", "regenerated and normalised: no path, no time");
    assert.deepEqual(job.artifacts.paths, ["$RWI_CWD/$RWI_REPORT"], "the job keeps the report it wrote for the gate job");
  } finally { srv.close(); }
});

test("GitLab: with another sha256 nothing runs, and the committed report is left as it was", { skip }, async () => {
  const srv = await served();
  try {
    for (const id of ["sarif", "junit", "coverage"]) {
      const job = loadYaml(readFileSync(join(PKG, "recipes", id, "gitlab", `${id}.gitlab-ci.yml`), "utf8"))[`.runward-integrations-${id}`];
      const project = tmp("rwi-gl-project-");
      mkdirSync(join(project, "code", "reports"), { recursive: true });
      writeFileSync(join(project, "code", "reports", "r"), "committed\n");
      const base = { ...job.variables, TMPDIR: tmp("rwi-gl-tmp-"), RWI_PACKAGE_URL: srv.url, RWI_CWD: "code", RWI_REPORT: "reports/r", RWI_COMMAND: JSON.stringify(["node", "-e", "process.exit(9)", "{raw}"]) };
      const wrong = await runJob(job.script, { ...base, RWI_PACKAGE_SHA256: "0".repeat(64) }, project);
      assert.equal(wrong.code, 3, `${id}: ${wrong.out}`);
      assert.match(wrong.out, new RegExp(`has sha256 ${srv.sha256}, not the pinned 0{64}: nothing runs`));
      assert.equal(readFileSync(join(project, "code", "reports", "r"), "utf8"), "committed\n", `${id}: nothing ran`);
      const notOne = await runJob(job.script, { ...base, RWI_PACKAGE_SHA256: "latest" }, project);
      assert.equal(notOne.code, 3);
      assert.match(notOne.out, /RWI_PACKAGE_SHA256 is not a sha256, nothing runs/);
      const absent = await runJob(job.script, { ...base, RWI_PACKAGE_URL: srv.url.replace("runward-integrations.tgz", "other.tgz"), RWI_PACKAGE_SHA256: srv.sha256 }, project);
      assert.equal(absent.code, 3);
      assert.match(absent.out, /answered 404/);
    }
  } finally { srv.close(); }
});
