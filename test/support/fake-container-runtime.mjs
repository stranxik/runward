#!/usr/bin/env node
// A container runtime of the tests' own, with Docker's command grammar for the subset runward-run
// speaks (`version`, `pull`, `image inspect`, `run`). It starts no container and touches no network:
// `run` executes the command on this machine, with every container path of a `--volume` mapped back
// to its host directory, and records each invocation, one JSON line, in $FAKE_RUNTIME_LOG. The unit
// tests drive runward-run with it, so they never need Docker (the maintainer's machine must not start
// Docker Desktop); the real container runs are the CI job's and the NAS's.
//
// Behaviours a test plants, through the environment:
//   FAKE_RUNTIME_DOWN=1          `version` fails: no daemon
//   FAKE_RUNTIME_DIGESTS=<json>  what `image inspect` answers (default: the digest of the reference)
//   FAKE_RUNTIME_NO_NETWORK_NONE=1  `run --network none` exits 125, as a runtime that cannot cut it
//   FAKE_RUNTIME_LEAK=1          a `--network none` container still sees eth0 (a runtime that ignores the flag)
//   FAKE_RUNTIME_INSTALL_FAIL=1  the install container (network open) exits 1
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const log = (entry) => { if (process.env.FAKE_RUNTIME_LOG) appendFileSync(process.env.FAKE_RUNTIME_LOG, `${JSON.stringify(entry)}\n`); };

if (argv[0] === "version") {
  log({ cmd: "version" });
  if (process.env.FAKE_RUNTIME_DOWN === "1") { process.stderr.write("Cannot connect to the container daemon\n"); process.exit(1); }
  process.stdout.write("27.0.0-fake\n");
  process.exit(0);
}
if (argv[0] === "pull") { log({ cmd: "pull", image: argv[1] }); process.exit(0); }
if (argv[0] === "image" && argv[1] === "inspect") {
  const image = argv[argv.length - 1];
  log({ cmd: "inspect", image });
  const name = image.slice(0, image.indexOf("@")).replace(/:[^/]*$/, "");
  process.stdout.write(`${process.env.FAKE_RUNTIME_DIGESTS ?? JSON.stringify([`${name}${image.slice(image.indexOf("@"))}`])}\n`);
  process.exit(0);
}
if (argv[0] !== "run") { process.stderr.write(`fake runtime: unknown command ${argv[0]}\n`); process.exit(2); }

// run --rm --network <n> [--volume h:c]... --workdir <d> [--user u] [--env K=V]... <image> <command...>
let i = 1;
const spec = { network: null, mounts: [], workdir: null, user: null, env: {}, rm: false };
for (; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--rm") spec.rm = true;
  else if (a === "--network") spec.network = argv[++i];
  else if (a === "--volume") {
    // host:container[:options], the host path possibly holding a ":" of its own: the container path is
    // the last segment that starts with "/", the options what follows it.
    const parts = argv[++i].split(":");
    const c = parts.findLastIndex((p) => p.startsWith("/"));
    spec.mounts.push({ host: parts.slice(0, c).join(":"), container: parts[c], options: parts.slice(c + 1).join(":") });
  }
  else if (a === "--workdir") spec.workdir = argv[++i];
  else if (a === "--user") spec.user = argv[++i];
  else if (a === "--env") { const v = argv[++i]; const k = v.indexOf("="); spec.env[v.slice(0, k)] = v.slice(k + 1); }
  else break;
}
const image = argv[i];
const command = argv.slice(i + 1);
log({ cmd: "run", ...spec, image, command });

if (spec.network === "none" && process.env.FAKE_RUNTIME_NO_NETWORK_NONE === "1") {
  process.stderr.write("Error response from daemon: network none is not available on this runtime\n");
  process.exit(125);
}
if (command[0] === "cat" && command[1] === "/proc/net/dev") {
  const rows = ["    lo:       0       0    0    0    0     0          0         0        0       0    0    0    0     0       0          0"];
  if (spec.network !== "none" || process.env.FAKE_RUNTIME_LEAK === "1") rows.push("  eth0:    1024      12    0    0    0     0          0         0     2048      24    0    0    0     0       0          0");
  process.stdout.write(`Inter-|   Receive                                                |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n${rows.join("\n")}\n`);
  process.exit(0);
}
if (spec.network !== "none" && process.env.FAKE_RUNTIME_INSTALL_FAIL === "1") { process.stderr.write("npm ERR! install failed\n"); process.exit(1); }

// The container paths, mapped back to the host: the longest container prefix first.
const mounts = [...spec.mounts].sort((a, b) => b.container.length - a.container.length);
const toHost = (s) => {
  for (const m of mounts) {
    if (s === m.container) return m.host;
    if (s.startsWith(`${m.container}/`)) return `${m.host}${s.slice(m.container.length)}`;
    const at = s.indexOf(`${m.container}/`);
    if (at > 0) return `${s.slice(0, at)}${m.host}${s.slice(at + m.container.length)}`;
  }
  return s;
};
const exe = command[0] === "node" ? process.execPath : command[0];
const r = spawnSync(exe, command.slice(1).map(toHost), { cwd: toHost(spec.workdir), stdio: "inherit", env: { ...process.env, ...spec.env, FAKE_RUNTIME_CONTAINER_WORKDIR: spec.workdir } });
process.exit(r.status ?? 1);
