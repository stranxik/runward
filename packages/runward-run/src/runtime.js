// The container runtime, behind one port (ADR-0120 decision 3). The adapter shipped drives a CLI with
// Docker's grammar (`docker`, or `podman`, which accepts it): every argument a separate argv entry, no
// shell, so nothing a policy or a tree carries is ever interpreted by one (CWE-78).
//
// What each call of the port answers, checked by run.js and never assumed:
//   version()        the runtime answers (else the run is refused: there is nowhere to execute);
//   pull(image)      the image is fetched by its digest, before any leg, while the network is open;
//   digests(image)   the digests the runtime holds for it, so the run refuses an image it cannot name;
//   run(spec)        one container, removed when it exits, with the network `none` unless the spec
//                    says `default` (the install step only), the mounts given and nothing else.
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

const MAX_BUFFER = 64 * 1024 * 1024;

export function containerRuntime(bin = "docker") {
  const call = (args, opts = {}) => spawnSync(bin, args, { encoding: "utf8", maxBuffer: MAX_BUFFER, ...opts });
  return {
    name: basename(bin).replace(/\.(exe|cmd)$/i, ""),
    version() {
      const r = call(["version", "--format", "{{.Server.Version}}"], { stdio: ["ignore", "pipe", "pipe"] });
      if (r.error || r.status !== 0) return { ok: false, detail: (r.error?.message ?? r.stderr ?? "").trim().slice(0, 400) };
      return { ok: true, version: String(r.stdout).trim() };
    },
    pull(image) {
      const r = call(["pull", image], { stdio: ["ignore", "inherit", "inherit"] });
      return { ok: !r.error && r.status === 0, detail: r.error?.message ?? null };
    },
    digests(image) {
      const r = call(["image", "inspect", "--format", "{{json .RepoDigests}}", image], { stdio: ["ignore", "pipe", "pipe"] });
      if (r.error || r.status !== 0) return [];
      try {
        const list = JSON.parse(String(r.stdout).trim());
        return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
      } catch { return []; }
    },
    /**
     * @param {{ image: string, network: "none"|"default", mounts: Array<{ host: string, container: string }>,
     *           workdir: string, command: string[], user?: string|null, env?: Record<string,string>,
     *           timeoutSeconds?: number, capture?: boolean }} spec
     */
    run(spec) {
      const args = ["run", "--rm", "--network", spec.network === "default" ? "bridge" : "none"];
      for (const m of spec.mounts) args.push("--volume", `${m.host}:${m.container}`);
      args.push("--workdir", spec.workdir);
      if (spec.user) args.push("--user", spec.user);
      for (const [k, v] of Object.entries(spec.env ?? {})) args.push("--env", `${k}=${v}`);
      args.push(spec.image, ...spec.command);
      const r = call(args, {
        stdio: ["ignore", spec.capture ? "pipe" : "inherit", spec.capture ? "pipe" : "inherit"],
        timeout: (spec.timeoutSeconds ?? 1800) * 1000,
      });
      return {
        status: r.error ? null : r.status,
        timedOut: r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM",
        stdout: spec.capture ? String(r.stdout ?? "") : "",
        stderr: spec.capture ? String(r.stderr ?? "") : "",
        error: r.error?.message ?? null,
      };
    },
  };
}

/** The network interfaces a container sees, from `/proc/net/dev` (the probe's output). */
export function interfacesOf(procNetDev) {
  return String(procNetDev).split("\n").slice(2).map((l) => l.split(":")[0].trim()).filter(Boolean);
}
