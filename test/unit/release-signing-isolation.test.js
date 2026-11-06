// No job that signs runs the build (ADR-0116, decision 3).
//
// Until ADR-0116 the job of build-and-attest.yml holding `id-token: write`, the credential every
// provenance of a release is signed with, also ran `npm ci` with install scripts, the whole suite and
// `npm pack`; the job of release.yml signing the SBOM attestation ran the suite and the qualification
// kit. Any development dependency could have asked for the OIDC token and signed under the builder's
// name. SLSA's Build track: "Such secret material MUST NOT be accessible to the environment running the
// user-defined build steps." This file holds the rule where it can silently come back: in every job of
// the release chain that holds `id-token: write`, no checkout, no package-manager command that runs
// code of the tree or of its dependencies, no `node` of a file, no action outside a short list; no cache
// restored anywhere in the chain; and the jobs that sign check the digests of what they sign first. A
// positive control shows the check refuses the shape it replaced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHAIN = ["build-and-attest.yml", "release.yml"];
const workflow = (f) => loadYaml(readFileSync(join(ROOT, ".github", "workflows", f), "utf8"));

/** The jobs that hold the signing credential and run steps (a job that calls a reusable workflow has none). */
const signingJobs = (wf) => Object.entries(wf.jobs ?? {}).filter(([, j]) => j.permissions?.["id-token"] === "write" && Array.isArray(j.steps));

// What a signing job may use: the runtime for `npm publish`, the artifact hand-off and the attestation
// actions, each pinned by commit SHA (regulated-posture.test.js pins every `uses:`).
const ALLOWED_ACTIONS = ["actions/setup-node", "actions/download-artifact", "actions/upload-artifact", "actions/attest-build-provenance", "actions/attest"];
// A package-manager command that runs code of the tree or of a dependency, and `node` of a file. Inline
// `node -e` / `node -p` is the workflow's own text; `npm publish <tarball>`, `npm view` and
// `npm --version` run no script of the package.
const RUNS_THE_TREE = [
  [/\b(?:npm|pnpm|yarn)\s+(?:ci|install|i|test|t|run|run-script|pack|exec|rebuild|link|start)\b/, "a package-manager command that runs the tree's or a dependency's code"],
  [/\bnpx\b/, "npx"],
  [/\bnode\s+(?!-[ep]\s)\S/, "node of a file"],
];

/** Every way a signing job breaks the rule, each naming the job and the step. */
function signingProblems(file, wf) {
  const problems = [];
  for (const [id, job] of signingJobs(wf)) {
    for (const [i, step] of job.steps.entries()) {
      const where = `${file} ${id} step ${i + 1} (${step.name ?? step.uses ?? "unnamed"})`;
      if (step.uses) {
        const action = String(step.uses).split("@")[0];
        if (action === "actions/checkout") problems.push(`${where}: checks out the tree`);
        else if (!ALLOWED_ACTIONS.includes(action)) problems.push(`${where}: uses ${action}, which is not on the signing jobs' list`);
      }
      for (const [re, what] of RUNS_THE_TREE) if (re.test(step.run ?? "")) problems.push(`${where}: runs ${what}`);
    }
  }
  return problems;
}

/** A cache restored anywhere in the chain: the channel through which one run reaches another. */
function cacheProblems(file, wf) {
  const out = [];
  for (const [id, job] of Object.entries(wf.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (/^actions\/cache(\/|@)/.test(String(step.uses))) out.push(`${file} ${id}: ${step.uses}`);
      if (/^actions\/setup-(node|python)@/.test(String(step.uses)) && step.with && "cache" in step.with) out.push(`${file} ${id}: ${step.uses} restores a cache`);
    }
  }
  return out;
}

test("ADR-0116: the jobs of the release chain that hold id-token: write are exactly the signing ones", () => {
  assert.deepEqual(signingJobs(workflow("build-and-attest.yml")).map(([id]) => id), ["attest"], "the builder signs in its attest job only");
  assert.deepEqual(signingJobs(workflow("release.yml")).map(([id]) => id).sort(), ["attest", "publish"],
    "the release signs the SBOM attestation and the npm provenance, and nothing else holds the credential");
  const build = workflow("build-and-attest.yml").jobs.build;
  assert.deepEqual(build.permissions, { contents: "read" }, "the job that installs, tests and packs holds contents: read and nothing else");
  assert.ok(build.steps.some((s) => s.run === "npm ci --ignore-scripts"), "and installs without install scripts");
  for (const id of ["sbom", "verify"]) {
    assert.deepEqual(workflow("release.yml").jobs[id].permissions, { contents: "read" }, `release.yml ${id} holds contents: read only`);
  }
  assert.ok(workflow("release.yml").jobs.verify.steps.some((s) => s.run === "npm ci --ignore-scripts"), "the release's own test run installs without install scripts too");
});

test("ADR-0116: no job that signs checks out the tree, runs it, or uses an action outside the list", () => {
  for (const f of CHAIN) assert.deepEqual(signingProblems(f, workflow(f)), [], f);
});

test("ADR-0116: no cache is restored anywhere in the release chain", () => {
  for (const f of CHAIN) assert.deepEqual(cacheProblems(f, workflow(f)), [], f);
});

test("ADR-0116: each signing job checks the digests of what it signs before it signs", () => {
  const order = (steps, check, sign) => {
    const c = steps.findIndex((s) => check.test(s.run ?? ""));
    const a = steps.findIndex((s) => sign.test(String(s.uses ?? "")));
    assert.ok(c >= 0, `a digest check (${check})`);
    assert.ok(a >= 0, `an attestation (${sign})`);
    assert.ok(c < a, "the check comes first");
  };
  order(workflow("build-and-attest.yml").jobs.attest.steps, /check "\$TARBALL" "\$TARBALL_SHA256"[\s\S]*check "\$KIT" "\$KIT_SHA256"[\s\S]*check "\$FORGE" "\$FORGE_SHA256"/, /^actions\/attest-build-provenance@/);
  order(workflow("release.yml").jobs.attest.steps, /\[ "\$A" = "\$TARBALL_SHA256" \][\s\S]*\[ "\$B" = "\$SBOM_SHA256" \]/, /^actions\/attest@/);
  const draft = workflow("release.yml").jobs.draft.steps;
  const check = draft.findIndex((s) => /\$TARBALL_SHA256[\s\S]*\$SBOM_SHA256/.test(s.run ?? ""));
  const upload = draft.findIndex((s) => /gh release upload/.test(s.run ?? ""));
  assert.ok(check >= 0 && check < upload, "the draft job checks the staged tarball and SBOM before it uploads");
});

test("ADR-0116, control: the builder's shape before the split is refused, step by step", () => {
  const before = { jobs: { build: { permissions: { contents: "read", "id-token": "write", attestations: "write" }, steps: [
    { name: "Checkout code", uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1" },
    { name: "Install dependencies", run: "npm ci" },
    { name: "Verify", run: "npm test" },
    { name: "Pack the tarball", run: 'echo "tarball=$(npm pack --silent)" >> "$GITHUB_OUTPUT"' },
    { name: "Build the kit", run: "node scripts/build-qualification-kit.mjs --tarball x --out ." },
    { name: "Generate SBOM", uses: "anchore/sbom-action@66cbf4bc1f1c0d2edc94016e65bc221b6bb0ad6c" },
    { name: "Read the name", run: "node -p 'require(\"./package.json\").version'" },
  ] } } };
  const problems = signingProblems("before.yml", before);
  for (const step of ["Checkout code", "Install dependencies", "Verify", "Pack the tarball", "Build the kit", "Generate SBOM"]) {
    assert.ok(problems.some((p) => p.includes(`(${step})`)), `refused: ${step}\n${problems.join("\n")}`);
  }
  assert.ok(!problems.some((p) => p.includes("(Read the name)")), "inline node -p is the workflow's own text, not the tree's");
  const cached = { jobs: { x: { steps: [{ uses: "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1", with: { cache: "npm" } }, { uses: "actions/cache@0000000000000000000000000000000000000000" }] } } };
  assert.equal(cacheProblems("cached.yml", cached).length, 2, "a setup-node cache and actions/cache are both refused");
});
