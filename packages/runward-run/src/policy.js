// The run policy (ADR-0120 decision 5): what runward-run executes, written by the operator and kept
// with the workflow that runs it, never in the judged tree. The mission declares what to verify (its
// territory, its citations); the policy says how it is executed: the image, pinned by digest; the
// install command and its lockfile; the legs, each with its command and the reports it writes.
//
// A policy this version cannot honour is refused before anything runs, with the reason. Two kinds:
//   usage   the document is malformed (exit 2);
//   refusal the document asks for what would make the run unprovable (exit 3): an image not pinned by
//           digest, an install whose scripts are not disabled, a leg this version does not deliver.
export const POLICY_FORMAT = "runward-run-policy/0";

/** The legs of ADR-0120 decision 2 this version runs; the others are refused by name. */
export const LEGS = ["tests", "reports"];
const LATER_LEGS = { coverage: "R2", mutation: "R2", evals: "R3" };
export const NATURES = ["junit", "sarif", "eslint", "coverage", "sbom", "loadtest"];
/** An image reference pinned by digest: `name[:tag]@sha256:<64 hex>`. */
export const PINNED_IMAGE = /^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/;
/** Package managers whose install can run scripts the agent chose, and the flag that disables them. */
const SCRIPT_FLAGS = { npm: "--ignore-scripts", pnpm: "--ignore-scripts", yarn: "--ignore-scripts", bun: "--ignore-scripts" };

export class PolicyError extends Error {
  /** @param {"usage"|"refusal"} kind */
  constructor(kind, message) { super(message); this.kind = kind; }
}
const usage = (m) => new PolicyError("usage", `run policy: ${m}`);
const refusal = (m) => new PolicyError("refusal", `run policy: ${m}`);

/** A project-relative path, `/`-separated, with no `.` or `..` segment and no absolute prefix. */
export function safeRel(p) {
  if (typeof p !== "string" || p === "" || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s !== "" && s !== "." && s !== "..");
}
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");

function command(c, where) {
  if (!Array.isArray(c) || c.length === 0 || !c.every((x) => typeof x === "string" && x.length > 0 && !x.includes("\0"))) {
    throw usage(`${where}.command must be a non-empty list of strings (an argument vector, never a shell line)`);
  }
  return [...c];
}

/** Read and validate a policy document. Returns the policy as runward-run uses it. */
export function readPolicy(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw usage("not a JSON object");
  if (doc.format !== POLICY_FORMAT) throw usage(`format must be "${POLICY_FORMAT}" (found ${JSON.stringify(doc.format)})`);
  if (typeof doc.image !== "string" || !PINNED_IMAGE.test(doc.image)) {
    throw refusal(`the image ${JSON.stringify(doc.image)} is not pinned by digest (name@sha256:<64 hex>): a tag can name other bytes tomorrow, and a run whose image cannot be named is not one a reader can redo (ADR-0120 decision 3)`);
  }
  let install = null;
  if (doc.install !== undefined && doc.install !== null) {
    const i = doc.install;
    if (typeof i !== "object") throw usage("install must be an object");
    const cwd = i.cwd ?? ".";
    if (cwd !== "." && !safeRel(cwd)) throw usage(`install.cwd ${JSON.stringify(cwd)} is not a project-relative path`);
    if (!safeRel(i.lockfile)) throw refusal("install.lockfile names no project-relative lockfile: dependencies are installed from the lockfile the tree commits, or not at all (ADR-0120 decision 3)");
    const cmd = command(i.command, "install");
    const tool = cmd[0].split("/").pop();
    const flag = SCRIPT_FLAGS[tool];
    if (flag && !cmd.includes(flag)) {
      throw refusal(`install.command runs ${tool} without ${flag}: an install script is code the agent chose, run while the network is open (ADR-0120 decision 3)`);
    }
    install = { cwd, lockfile: i.lockfile, command: cmd, scripts: flag ? "disabled" : "not-applicable" };
  }
  if (!Array.isArray(doc.legs) || doc.legs.length === 0) throw usage("legs must be a non-empty list");
  const legs = doc.legs.map((l, i) => {
    const where = `legs[${i}]`;
    if (!l || typeof l !== "object") throw usage(`${where} must be an object`);
    if (Object.hasOwn(LATER_LEGS, l.leg)) throw refusal(`${where}: the ${l.leg} leg is not delivered by this version of runward-run (ADR-0120 ${LATER_LEGS[l.leg]})`);
    if (!LEGS.includes(l.leg)) throw usage(`${where}.leg must be one of ${LEGS.join(", ")} (found ${JSON.stringify(l.leg)})`);
    const cwd = l.cwd ?? ".";
    if (cwd !== "." && !safeRel(cwd)) throw usage(`${where}.cwd ${JSON.stringify(cwd)} is not a project-relative path`);
    if (!Array.isArray(l.reports) || l.reports.length === 0) throw usage(`${where}.reports must list the reports the leg writes`);
    const reports = l.reports.map((r, k) => {
      if (!r || !safeRel(r.path)) throw usage(`${where}.reports[${k}].path must be a project-relative path`);
      if (!NATURES.includes(r.nature)) throw usage(`${where}.reports[${k}].nature must be one of ${NATURES.join(", ")}`);
      return { path: r.path, nature: r.nature };
    });
    if (l.leg === "tests" && !reports.some((r) => r.nature === "junit")) throw usage(`${where}: a tests leg writes a JUnit report`);
    const timeoutSeconds = l.timeoutSeconds ?? 1800;
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 6 * 3600) throw usage(`${where}.timeoutSeconds must be an integer between 1 and 21600`);
    return { leg: l.leg, cwd, command: command(l.command, where), reports, timeoutSeconds };
  });
  const paths = legs.flatMap((l) => l.reports.map((r) => r.path));
  const dup = paths.find((p, i) => paths.indexOf(p) !== i);
  if (dup) throw usage(`two legs write ${dup}`);
  const dirs = [...new Set(paths.map(dirOf))];
  // runward reads a run Statement in the directory of the report it binds (docs/spec/runward-run.md §4):
  // one run, one directory, one Statement beside every report it binds.
  if (dirs.length !== 1) throw usage(`every report of a run is written to one directory, where its Statement is written too (found ${dirs.join(", ")})`);
  return { format: POLICY_FORMAT, image: doc.image, install, legs, reportsDir: dirs[0] };
}

/** `${out}` and `${work}` in a command, expanded to the container paths of the run. */
export function expand(arg, paths) {
  return arg.replaceAll("${out}", paths.out).replaceAll("${work}", paths.work);
}
