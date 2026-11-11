// ADR-0130: the identity of a repository is a host and a path of two to eight segments, for any forge,
// read by one closed grammar before anything is folded, with one canonical form.
//
//   - GitHub (`host/owner/repo`), GitLab with nested groups, Azure DevOps Services and a self-managed
//     instance on a port (`host:port`, 1 to 65535) are accepted, in
//     the inventory, in the trust policy, in a signature and in `verify-run`, and are shown;
//   - the planted controls are each refused: a path traversal, an empty segment, a nine-segment path, a
//     look-alike character (in the path, in the host, and one that lower-cases to a letter), an encoded
//     slash; and every refusal has an accepted neighbour, so a refusal is the rule's and not the test's;
//   - the canonical form reads back as itself, needs no encoding in a URL, and a three-segment identity
//     reads as it did before: the former reading is kept here and compared over a corpus, and the golden
//     files of the other suites are not regenerated;
//   - equality is decided on canonical identities: a name outside the grammar is equal to no repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PKG, allRendered, build, documents, fixture, indexFrom, manifestOf, missionWith, pageFor, realCheck, sigstore, trust } from "../support/fleet.js";
import { makeBundle, makeSigstore } from "../support/fleet-sigstore.js";

const repo = await import(pathToFileURL(join(PKG, "src", "repository.js")).href);
const runSig = await import(pathToFileURL(join(PKG, "src", "run-signature.js")).href);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const COMMIT = "c0ffee".padEnd(40, "0");

const GITHUB = "github.com/org/app";
const GITLAB = "gitlab.example.com/group/subgroup/project";
const GITLAB_DEEP = "gitlab.example.com/a/b/c/d/e/f/g/project"; // eight segments: the bound, inside
const AZURE = "dev.azure.com/org/project/_git/repo";
const AZURE_LEGACY = "org.visualstudio.com/project/_git/repo";
const PORTED = "gitlab-temoin.local:8929/temoin/demo"; // a self-managed instance on a port
const ACCEPTED = [GITHUB, GITLAB, GITLAB_DEEP, AZURE, AZURE_LEGACY, PORTED, "gitlab.internal:1/group/project", "gitlab.internal:65535/a/b/c/d/e/f/g/h", "github.com/org/.github", "gitlab/group/project", "github.com/o-r-g/a_b.c-d"];

// Each planted control, with the accepted neighbour it differs from by the one thing the rule refuses.
const KELVIN = "K"; // lower-cases to "k" under Unicode rules
const PLANTED = [
  ["a path traversal", "gitlab.example.com/group/../project", /dots alone/, "gitlab.example.com/group/sub/project"],
  ["a path traversal at the end", "gitlab.example.com/group/project/..", /dots alone/, "gitlab.example.com/group/project/x"],
  ["a single dot segment", "github.com/./app", /dots alone/, "github.com/o/app"],
  ["an empty segment", "gitlab.example.com/group//project", /empty/, "gitlab.example.com/group/x/project"],
  ["a trailing slash", "github.com/org/app/", /empty/, "github.com/org/app"],
  ["a nine-segment path", "gitlab.example.com/a/b/c/d/e/f/g/h/project", /more than 8/, GITLAB_DEEP],
  ["a one-segment path", "github.com/app", /fewer than 2/, GITHUB],
  ["a look-alike in the path (Cyrillic а)", "github.com/org/аpp", /outside letters/, "github.com/org/app"],
  ["a look-alike that folds to a letter (Kelvin sign)", `github.com/org/${KELVIN}app`, /outside letters/, "github.com/org/Kapp"],
  ["a look-alike in the host (Cyrillic і)", "gіthub.com/org/app", /not a DNS name/, "github.com/org/app"],
  ["a look-alike host in its ASCII spelling", "xn--gthub-cph.com/org/app", /internationalised/, "github.com/org/app"],
  ["an encoded slash", "gitlab.example.com/group%2Fsubgroup/project", /outside letters/, "gitlab.example.com/group/subgroup/project"],
  ["an encoded dot segment", "gitlab.example.com/group/%2e%2e/project", /outside letters/, "gitlab.example.com/group/x/project"],
  ["a doubly encoded slash", "gitlab.example.com/group%252Fsub/project", /outside letters/, "gitlab.example.com/group/sub/project"],
  ["a backslash", "gitlab.example.com/group\\sub/project", /outside letters/, "gitlab.example.com/group/sub/project"],
  ["a full-width solidus", "gitlab.example.com/group／sub/project", /outside letters/, "gitlab.example.com/group/sub/project"],
  ["a space (an Azure DevOps project name with one)", "dev.azure.com/org/My Project/_git/repo", /outside letters/, "dev.azure.com/org/My-Project/_git/repo"],
  ["a query", "github.com/org/app?x=1", /outside letters/, "github.com/org/app"],
  ["a fragment", "github.com/org/app#x", /outside letters/, "github.com/org/app"],
  ["credentials", "user@github.com/org/app", /not a DNS name/, "github.com/org/app"],
  ["credentials with a password", "user:pass@github.com/org/app", /its port/, "github.com/org/app"],
  ["port 0", "gitlab-temoin.local:0/temoin/demo", /its port is not a number from 1 to 65535/, "gitlab-temoin.local:1/temoin/demo"],
  ["port 65536", "gitlab-temoin.local:65536/temoin/demo", /its port is not a number from 1 to 65535/, "gitlab-temoin.local:65535/temoin/demo"],
  ["a six-digit port", "gitlab-temoin.local:100000/temoin/demo", /its port/, "gitlab-temoin.local:10000/temoin/demo"],
  ["a non-numeric port", "gitlab-temoin.local:http/temoin/demo", /its port/, PORTED],
  ["a port with a letter", "gitlab-temoin.local:8929a/temoin/demo", /its port/, PORTED],
  ["a hexadecimal port", "gitlab-temoin.local:0x22e1/temoin/demo", /its port/, PORTED],
  ["an empty port", "gitlab-temoin.local:/temoin/demo", /its port/, PORTED],
  ["a port with a leading zero", "gitlab-temoin.local:08929/temoin/demo", /its port/, PORTED],
  ["a signed port", "gitlab-temoin.local:+8929/temoin/demo", /its port/, PORTED],
  ["a port in other digits", "gitlab-temoin.local:\u0668\u0669\u0662\u0669/temoin/demo", /its port/, PORTED],
  ["two ports", "gitlab-temoin.local:8929:8929/temoin/demo", /its port/, PORTED],
  ["a port and no host", ":8929/temoin/demo", /not a DNS name/, PORTED],
  ["a port and an empty segment", "gitlab-temoin.local:8929/temoin//demo", /empty/, PORTED],
  ["a port and a path traversal", "gitlab-temoin.local:8929/temoin/../demo", /dots alone/, PORTED],
  ["a port and a nine-segment path", "gitlab-temoin.local:8929/a/b/c/d/e/f/g/h/i", /more than 8/, "gitlab-temoin.local:8929/a/b/c/d/e/f/g/h"],
  ["a port on an address", "127.0.0.1:8929/temoin/demo", /an address/, PORTED],
  ["a colon in the path", "gitlab-temoin.local/temoin:8929/demo", /outside letters/, "gitlab-temoin.local/temoin/demo"],
  ["a scheme", "https://github.com/org/app", /its port/, "github.com/org/app"],
  ["an address for a host", "10.0.0.1/group/project", /an address/, "gitlab.internal/group/project"],
  ["an address a URL parser would rewrite", "0x7f.1/group/project", /an address/, "gitlab.internal/group/project"],
  ["an empty host label", "gitlab..com/group/project", /not a DNS name/, "gitlab.com/group/project"],
  ["a name that is the clone suffix alone", "github.com/org/.git", /empty/, "github.com/org/app.git"],
  ["a name that ends in .git twice", "github.com/org/app.git.git", /still ends in \.git/, "github.com/org/app.git"],
  ["a NUL", "github.com/org/app\0", /outside letters/, "github.com/org/app"],
  ["a line break", "github.com/org/app\n", /outside letters/, "github.com/org/app"],
  ["513 characters", `github.com/org/${"a".repeat(498)}`, /longer than 512/, `github.com/org/${"a".repeat(255)}`],
  ["a 256-character segment", `github.com/org/${"a".repeat(256)}`, /outside letters/, `github.com/org/${"a".repeat(255)}`],
];

test("the grammar accepts GitHub, GitLab nested groups and Azure DevOps, and gives each one canonical form", () => {
  for (const id of ACCEPTED) {
    assert.equal(repo.repositoryProblem(id), null, id);
    assert.equal(repo.canonRepository(id), id, `${id} is already canonical`);
  }
  assert.deepEqual(repo.repositoryParts(AZURE), { id: AZURE, host: "dev.azure.com", port: null, segments: ["org", "project", "_git", "repo"] });
  assert.deepEqual(repo.repositoryParts(PORTED), { id: PORTED, host: "gitlab-temoin.local", port: 8929, segments: ["temoin", "demo"] });
  assert.equal(repo.canonRepository("GitLab-Temoin.LOCAL:8929/Temoin/Demo.git"), PORTED);
  // An https address has port 443 without saying so: one spelling. Any other port is another instance.
  assert.equal(repo.canonRepository("gitlab.example.com:443/group/subgroup/project"), GITLAB);
  assert.notEqual(repo.canonRepository("gitlab-temoin.local:8930/temoin/demo"), PORTED);
  assert.notEqual(repo.canonRepository("gitlab-temoin.local/temoin/demo"), PORTED);
  assert.deepEqual(repo.repositoryParts(GITLAB).segments, ["group", "subgroup", "project"]);
  // Case: one repository, one spelling. The clone suffix is the forge's, not the name's.
  assert.equal(repo.canonRepository("GitLab.Example.COM/Group/SubGroup/Project.git"), GITLAB);
  assert.equal(repo.canonRepository("dev.azure.com/Org/Project/_git/Repo"), AZURE);
  assert.equal(repo.canonRepository("github.com/org/App.GIT"), GITHUB);
  assert.deepEqual(repo.REPOSITORY_SEGMENTS, { min: 2, max: 8 });
});

test("each planted control is refused, says why, and its accepted neighbour is read", () => {
  for (const [what, planted, why, neighbour] of PLANTED) {
    assert.match(repo.repositoryProblem(planted) ?? "", why, `${what}: refused for its own reason`);
    assert.equal(repo.canonRepository(planted), null, `${what}: no canonical form`);
    assert.equal(repo.repositoryParts(planted), null, what);
    assert.equal(repo.repositoryUrl(planted), null, `${what}: no address`);
    assert.equal(repo.repositoryProblem(neighbour), null, `${what}: the neighbour ${neighbour} is accepted, so the refusal is the rule's`);
  }
  for (const v of [undefined, null, 7, {}, [], ""]) assert.equal(repo.canonRepository(v), null, `${JSON.stringify(v)} is not an identity`);
});

test("the canonical form reads back as itself and needs no encoding in a URL", () => {
  const spellings = [...ACCEPTED, ...PLANTED.map((p) => p[3]), "GitHub.com/Org/App.git", "A.B/C/D/E/F/G/H/I/J.GIT", "a.b:443/c/d", "a.b:80/c/d"];
  for (const s of spellings) {
    const id = repo.canonRepository(s);
    assert.ok(id, s);
    assert.equal(repo.canonRepository(id), id, `${s}: canonical is a fixed point`);
    assert.equal(id, id.toLowerCase());
    assert.ok(!id.endsWith(".git"));
    const { host, port, segments } = repo.repositoryParts(id);
    const u = new URL(repo.repositoryUrl(s));
    assert.equal(u.href, `https://${id}`, `${s}: a URL parser changes nothing`);
    assert.deepEqual([u.protocol, u.hostname, u.pathname, u.port, u.username, u.password, u.search, u.hash], ["https:", host, `/${segments.join("/")}`, port === null ? "" : String(port), "", "", "", ""]);
  }
});

// The reading before ADR-0130, kept to compare: the pattern of build.js and trust.js, then normRepo.
const FORMER = /^[a-z0-9.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const formerNorm = (s) => s.replace(/^https?:\/\//, "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();

test("a three-segment identity reads exactly as before; what the former pattern let through and is now refused is listed", () => {
  // A deterministic corpus over the alphabet of the former pattern, hosts and names of every shape.
  const hosts = ["github.com", "gitlab.example.com", "git.internal", "localhost", "a-b.c0.org", "..", "-x.com", "x-.com", "a..b", "1.2.3.4", "host.9", ".com", "com.", "xn--a.com", "0x7f.1"];
  const names = ["org", "Org", "app", "App.JS", ".github", "a_b", "a-b", "-", "_", "x.git", "X.GIT", ".", "..", "...", ".git", "a.git.git", "9", "a.b.c"];
  let same = 0;
  const tightened = new Map();
  for (const h of hosts) for (const o of names) for (const r of names) {
    const s = `${h}/${o}/${r}`;
    assert.ok(FORMER.test(s), s);
    const now = repo.canonRepository(s);
    if (now !== null && now === formerNorm(s)) { same++; continue; }
    const why = now === null ? repo.repositoryProblem(s) : `read as ${now === formerNorm(s).replace(/\.git$/, "") ? "the name without its upper-case clone suffix" : now}`;
    tightened.set(why, (tightened.get(why) ?? 0) + 1);
  }
  // Every difference is a refusal of something no forge names, or the clone suffix in upper case.
  assert.deepEqual([...tightened.keys()].sort(), [
    "a segment of its path is empty",
    "a segment of its path is made of dots alone",
    "its host holds an internationalised label (xn--), which this version does not read",
    "its host is an address, not a name",
    "its host is not a DNS name (letters, digits and inner hyphens, no scheme, no credentials)",
    "its last segment still ends in .git once the clone suffix is dropped",
    "read as the name without its upper-case clone suffix",
  ]);
  assert.ok(same > 800, `${same} identities read as before`);
  // On well-formed hosts and names, nothing moved at all.
  for (const h of ["github.com", "gitlab.example.com", "git.internal", "localhost", "a-b.c0.org"]) for (const o of ["org", "Org", "a_b", "a-b", "-", "_", "9"]) for (const r of ["app", "App.JS", ".github", "x.git", "a.b.c", "-", "_"]) {
    const s = `${h}/${o}/${r}`;
    assert.equal(repo.canonRepository(s), formerNorm(s), s);
  }
  // The index of a three-segment inventory: the same field, the same bytes.
  const idx = indexFrom(manifestOf([{ ...missionWith("a"), repository: "github.com/Example/A.git" }]), { "exports/a/check.json": realCheck() });
  assert.equal(idx.format, "runward-fleet-index/0", "the format did not move");
  assert.equal(idx.missions[0].repository, "github.com/example/a");
  assert.equal(JSON.stringify(idx.missions[0].repository), JSON.stringify(formerNorm("github.com/Example/A.git")));
});

test("fleet.json: nested and Azure identities build an index; a planted identity stops the build and the message says why", () => {
  const files = { "exports/gl/check.json": realCheck(), "exports/az/check.json": realCheck(), "exports/gh/check.json": realCheck() };
  const idx = indexFrom(manifestOf([
    { ...missionWith("gl"), repository: "gitlab.example.com/Group/SubGroup/Project.git" },
    { ...missionWith("az"), repository: AZURE },
    { ...missionWith("gh"), repository: GITHUB },
    { ...missionWith("pt"), repository: "Gitlab-Temoin.local:8929/temoin/demo" },
  ]), { ...files, "exports/pt/check.json": realCheck() });
  assert.deepEqual(idx.missions.map((m) => m.repository), [GITLAB, AZURE, GITHUB, PORTED]);
  assert.deepEqual(idx.missions.map((m) => m.latest.verdict), ["clean", "clean", "clean", "clean"], "the reading of the exports does not depend on the forge");
  for (const [what, planted, why] of PLANTED) {
    assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), repository: planted }]), { "exports/a/check.json": realCheck() }),
      (e) => e instanceof build.BuildError && /missions\[0\]: repository must read host\/path with 2 to 8 path segments/.test(e.message) && why.test(e.message), what);
  }
  assert.throws(() => indexFrom(manifestOf([{ ...missionWith("a"), repository: 7 }])), /repository must read/);
});

test("trust-policy.json: the same grammar; a planted identity among a signer's repositories stops the build", () => {
  const key = generateKeyPairSync("ed25519").publicKey;
  const signer = (repositories) => ({ format: "runward-fleet-trust-policy/0", signers: [{ id: "k", kind: "key", repositories, publicKey: "k.pem", keyDigest: `sha256:${sha(key.export({ type: "spki", format: "der" }))}`, ref: "refs/heads/main" }] });
  const read = () => Buffer.from(key.export({ type: "spki", format: "pem" }));
  const p = trust.readPolicy(signer(["GitLab.example.com/Group/SubGroup/Project", AZURE, GITHUB, PORTED]), read);
  assert.deepEqual(p.signers[0].repositories, [GITLAB, AZURE, GITHUB, PORTED]);
  assert.deepEqual(trust.describePolicy(p).signers[0].repositories, [GITLAB, AZURE, GITHUB, PORTED]);
  for (const [what, planted, why] of PLANTED) {
    assert.throws(() => trust.readPolicy(signer([GITHUB, planted]), read), (e) => /repositories\[1\] must read host\/path/.test(e.message) && why.test(e.message), what);
  }
  assert.throws(() => trust.readPolicy(signer([]), read), /repositories must list/);
  assert.throws(() => trust.readPolicy(signer("github.com/org/app"), read), /repositories must list/);
});

// ------------------------------------------------------------------ signatures: equality on canonical identities
/** A key-signed run Statement (a DSSE envelope) naming `said` as its mission's repository. */
function keySigned(said, { repositories }) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const policy = trust.readPolicy({ format: "runward-fleet-trust-policy/0", signers: [{ id: "ops", kind: "key", repositories, publicKey: "k.pem", keyDigest: `sha256:${sha(publicKey.export({ type: "spki", format: "der" }))}`, ref: "refs/heads/main" }] },
    () => Buffer.from(publicKey.export({ type: "spki", format: "pem" })));
  const statement = { _type: "https://in-toto.io/Statement/v1", subject: [{ name: "reports/junit.xml", digest: { sha256: "5".repeat(64) } }], predicateType: runSig.RUN_PREDICATE_TYPE, predicate: { network: "none", mission: { repository: said, commit: COMMIT, ref: "refs/heads/main" } } };
  const payload = Buffer.from(JSON.stringify(statement));
  const payloadType = "application/vnd.in-toto+json";
  const document = { payloadType, payload: payload.toString("base64"), signatures: [{ sig: sign(null, sigstore.pae(payloadType, payload), privateKey).toString("base64") }] };
  return { document, policy };
}
const codes = (r) => r.reasons.map((x) => x.code);

test("verify-run: a key pinned for an Azure DevOps or a nested GitLab repository is accepted for it, in any spelling a forge writes", () => {
  for (const mission of [AZURE, GITLAB, GITLAB_DEEP, PORTED]) {
    const { document, policy } = keySigned(mission, { repositories: [mission] });
    const r = runSig.verifyRunSignature({ document, policy, expect: { repository: mission, commit: COMMIT } });
    assert.deepEqual(codes(r), [], mission);
    assert.equal(r.accepted, true);
    assert.equal(r.vouched.repository, mission);
    assert.equal(r.landing, true);
  }
  // The spellings of one repository: an address, a clone address, upper case.
  for (const said of [`https://${AZURE}`, "https://dev.azure.com/Org/Project/_git/Repo/", "dev.azure.com/org/project/_git/repo.git"]) {
    const { document, policy } = keySigned(said, { repositories: [AZURE] });
    const r = runSig.verifyRunSignature({ document, policy, expect: { repository: "https://dev.azure.com/org/project/_git/repo", commit: COMMIT } });
    assert.equal(r.accepted, true, said);
    assert.equal(r.vouched.repository, AZURE, "what is shown is the canonical identity");
  }
});

test("verify-run: a sibling, a parent group, a prefix or a planted name is another repository, and an expectation outside the grammar is not asked", () => {
  const others = [
    "gitlab.example.com/group/subgroup", // the parent group
    "gitlab.example.com/group/subgroup/project/extra", // a child path
    "gitlab.example.com/group/subgroup/project2", // a sibling by prefix
    "gitlab.example.com/group/other/project", // a sibling group
    "gitlab.example.com/group/subgroup/../subgroup/project", // a traversal back to it
    "gitlab.example.com/group%2Fsubgroup/project", // an encoded slash
    "gitlab.example.com/group//subgroup/project", // an empty segment
    `gitlab.example.com/group/subgroup/${KELVIN}roject`,
    "gitlab.example.com/group/subgroup/project/.git", // the former reading took this for the project
    "https://https://gitlab.example.com/group/subgroup/project",
    "", undefined, 7,
  ];
  for (const said of others) {
    const { document, policy } = keySigned(said, { repositories: [GITLAB] });
    const r = runSig.verifyRunSignature({ document, policy, expect: { repository: GITLAB, commit: COMMIT } });
    assert.equal(r.accepted, false, String(said));
    assert.deepEqual(codes(r), ["signed-for-another-repository"], String(said));
  }
  // The Kelvin sign against the repository it would fold into: refused, where the former fold made them equal.
  const k = keySigned(`github.com/org/${KELVIN}app`, { repositories: ["github.com/org/kapp"] });
  assert.equal(`github.com/org/${KELVIN}app`.toLowerCase(), "github.com/org/kapp", "the control is planted: Unicode lower case makes them equal");
  assert.deepEqual(codes(runSig.verifyRunSignature({ ...k, expect: { repository: "github.com/org/kapp", commit: COMMIT } })), ["signed-for-another-repository"]);
  // A key pinned for the parent group does not sign for a project inside it.
  const parent = keySigned(GITLAB, { repositories: ["gitlab.example.com/group/subgroup"] });
  assert.deepEqual(codes(runSig.verifyRunSignature({ ...parent, expect: { repository: GITLAB, commit: COMMIT } })), ["signer-pinned-for-other-repositories"]);
  // What `--repository` is given is read as a forge writes it: an address and a trailing slash are spellings.
  const spellings = new Set(["a trailing slash", "a scheme"]);
  for (const [what, planted] of PLANTED) {
    const { document, policy } = keySigned(GITLAB, { repositories: [GITLAB] });
    if (spellings.has(what)) { assert.equal(repo.foreignRepository(planted), "github.com/org/app", what); continue; }
    assert.equal(repo.foreignRepository(planted), null, what);
    assert.throws(() => runSig.verifyRunSignature({ document, policy, expect: { repository: planted, commit: COMMIT } }), /expect\.repository \(host\/path with 2 to 8 path segments/, what);
  }
});

test("verify-run, keyless on GitLab: a runner project and a mission in nested groups; the mission's own pipeline is still refused", () => {
  const ss = makeSigstore();
  const WF = "d1ce57".padEnd(40, "0");
  const runnerRepo = "gitlab.example.com/platform/ci/runners/runward";
  const runner = `https://${runnerRepo}//.gitlab-ci.yml@refs/heads/main`;
  const gl = { san: runner, claims: { 8: "https://gitlab.example.com", 9: runner, 10: WF, 11: "self-hosted", 12: `https://${runnerRepo}`, 13: WF, 14: "refs/heads/main", 18: runner, 19: WF, 20: "pipeline", 21: `https://${runnerRepo}/-/pipelines/9`, 22: "private" } };
  const statement = { _type: "https://in-toto.io/Statement/v1", subject: [{ name: "reports/junit.xml", digest: { sha256: "5".repeat(64) } }], predicateType: runSig.RUN_PREDICATE_TYPE, predicate: { network: "none", mission: { repository: GITLAB, commit: COMMIT, ref: "refs/heads/main" } } };
  const policy = trust.readPolicy({ format: "runward-fleet-trust-policy/0", trustedRoots: ["root.json"], signers: [{ id: "gl-runner", kind: "sigstore", repositories: [GITLAB], issuer: "https://gitlab.example.com", workflow: runner, workflowDigests: [WF], ref: "refs/heads/main" }] },
    () => Buffer.from(JSON.stringify(ss.trustedRoot)));
  const r = runSig.verifyRunSignature({ document: makeBundle(ss, gl, statement), policy, expect: { repository: GITLAB, commit: COMMIT } });
  assert.deepEqual(codes(r), []);
  assert.equal(r.accepted, true);
  assert.deepEqual(r.vouched, { repository: GITLAB, commit: COMMIT, ref: "refs/heads/main", from: "statement" });
  assert.equal(runSig.workflowRepository(runner), runnerRepo);
  assert.equal(runSig.workflowRepository("https://github.com/Org/CI/.github/workflows/x.yml@refs/heads/main"), "github.com/org/ci");
  assert.equal(runSig.workflowRepository("https://gitlab.example.com/group/../x//.gitlab-ci.yml@main"), null, "a workflow address that names no repository names none");
  assert.equal(runSig.workflowRepository("https://example.com/somewhere/else.yml@main"), null);
  // The witness instance: what its token writes in ci_config_ref_uri, with and without a scheme.
  assert.equal(runSig.workflowRepository("gitlab-temoin.local:8929/temoin/demo//.gitlab-ci.yml@refs/heads/main"), PORTED);
  assert.equal(runSig.workflowRepository("https://gitlab-temoin.local:8929/temoin/demo//.gitlab-ci.yml@refs/heads/main"), PORTED);
  assert.equal(runSig.workflowRepository("gitlab-temoin.local:0/temoin/demo//.gitlab-ci.yml@refs/heads/main"), null);
  assert.equal(runSig.workflowRepository("gitlab-temoin.local:65536/temoin/demo//.gitlab-ci.yml@refs/heads/main"), null);
  assert.equal(repo.foreignRepository("http://gitlab-temoin.local:8929/temoin/demo/"), PORTED);
  // A signature for the same project on another port, or on none, is for another repository.
  for (const said of ["gitlab-temoin.local:8930/temoin/demo", "gitlab-temoin.local/temoin/demo", "gitlab-temoin.local:08929/temoin/demo"]) {
    const k = keySigned(said, { repositories: [PORTED] });
    assert.deepEqual(codes(runSig.verifyRunSignature({ ...k, expect: { repository: PORTED, commit: COMMIT } })), ["signed-for-another-repository"], said);
  }
  const own = `https://${GITLAB}//.gitlab-ci.yml@refs/heads/main`;
  const mine = runSig.verifyRunSignature({ document: makeBundle(ss, { san: own, claims: { ...gl.claims, 9: own, 12: `https://${GITLAB}`, 18: own } }, statement), policy, expect: { repository: GITLAB, commit: COMMIT } });
  assert.ok(codes(mine).includes("signed-from-the-mission-workflow"));
});

test("the build: an Ed25519 manifest whose repository folds into the mission's under Unicode rules raises nothing", () => {
  const fleet = (depot, mission) => {
    const ci = generateKeyPairSync("ed25519");
    const verdict = fixture("exports", "runward.verdict.intoto.json");
    const bytes = Buffer.from(`${JSON.stringify({ schema: "dropyour.preuves-ci.v2", depot, commit: COMMIT, ref: "refs/heads/main", run: "42", fichiers: [{ chemin: "verdict.intoto.json", sha256: sha(verdict) }] }, null, 2)}\n`);
    const files = {
      "trust-policy.json": { format: "runward-fleet-trust-policy/0", signers: [{ id: "app-ci-key", kind: "ed25519", repositories: [mission], publicKey: "keys/ci.pem", keyDigest: `sha256:${sha(ci.publicKey.export({ type: "spki", format: "der" }))}`, ref: "refs/heads/main", manifestFormat: "dropyour.preuves-ci.v2" }] },
      "keys/ci.pem": ci.publicKey.export({ type: "spki", format: "pem" }),
      "p/verdict.intoto.json": verdict, "p/manifeste.json": bytes, "p/manifeste.sig": `${sign(null, bytes, ci.privateKey).toString("base64")}\n`,
    };
    const m = { id: "app", name: "org/kapp", repository: mission, commit: COMMIT, exports: { attestation: { file: "p/verdict.intoto.json" } }, signatures: [{ covers: "attestation", kind: "ed25519-manifest", format: "dropyour.preuves-ci.v2", manifest: "p/manifeste.json", signature: "p/manifeste.sig" }] };
    const index = indexFrom(manifestOf([m], { trustPolicy: "trust-policy.json" }), files);
    return { index, s: index.missions[0].signatures[0] };
  };
  const good = fleet("Org/Kapp", "github.com/org/kapp");
  assert.equal(good.s.raised, true, "the positive control: the same repository in another case raises");
  const planted = fleet(`org/${KELVIN}app`, "github.com/org/kapp");
  assert.equal(planted.s.raised, false);
  assert.deepEqual(planted.s.reasons.map((r) => [r.code, r.mission]), [["signed-for-another-repository", "github.com/org/kapp"]]);
  assert.notEqual(planted.s.reasons[0].signed, "github.com/org/kapp", "what is shown is what was signed, never folded into the mission");
});

// ------------------------------------------------------------------ what is shown
test("every view of a fleet of GitLab and Azure DevOps repositories builds, the page passes its rules, and the identities are shown as declared", () => {
  const key = generateKeyPairSync("ed25519").publicKey;
  const files = {
    "exports/gl/check.json": realCheck(), "exports/az/check.json": realCheck(),
    "exports/pt/check.json": realCheck(),
    "trust-policy.json": { format: "runward-fleet-trust-policy/0", signers: [{ id: "ops", kind: "key", repositories: [GITLAB, AZURE, PORTED], publicKey: "k.pem", keyDigest: `sha256:${sha(key.export({ type: "spki", format: "der" }))}`, ref: "refs/heads/main" }] },
    "k.pem": key.export({ type: "spki", format: "pem" }),
  };
  for (const lang of ["en", "fr"]) {
    const idx = indexFrom(manifestOf([{ ...missionWith("gl"), repository: GITLAB, commit: COMMIT }, { ...missionWith("az"), repository: AZURE, commit: COMMIT }, { ...missionWith("pt"), repository: PORTED, commit: COMMIT }], { trustPolicy: "trust-policy.json", lang }), files);
    const rendered = allRendered(idx);
    assert.ok(rendered.length >= 8);
    const signatures = rendered.find(([where]) => where === "#/signatures")[1];
    assert.ok(signatures.includes(`<code>${GITLAB}</code>`) && signatures.includes(`<code>${AZURE}</code>`) && signatures.includes(`<code>${PORTED}</code>`), "the signers' table names each repository");
    const page = pageFor(idx); // renderSite refuses a page that breaks a rule
    assert.ok(page.includes(GITLAB) && page.includes(AZURE) && page.includes(PORTED));
    assert.ok(!/%2f|%2e/i.test(page.replace(/data:font[^)]*\)/g, "")), "no identity was encoded on its way to the page");
  }
});

test("documents: a deployment's `source` built on repositoryUrl links a file of a nested GitLab project; an address that does not end with the path stays text", () => {
  const md = "See [the floor](../floor.md).";
  const blob = (id, sep) => (p) => `${repo.repositoryUrl(id)}${sep}${COMMIT}/${p.split("/").map(encodeURIComponent).join("/")}`;
  const gl = documents.renderDocument(md, { path: "runward/adr/ADR-0001-x.md", source: blob(GITLAB, "/-/blob/") });
  assert.ok(gl.includes(`href="https://${GITLAB}/-/blob/${COMMIT}/runward/floor.md"`), gl);
  const gh = documents.renderDocument(md, { path: "runward/adr/ADR-0001-x.md", source: blob(GITHUB, "/blob/") });
  assert.ok(gh.includes(`href="https://${GITHUB}/blob/${COMMIT}/runward/floor.md"`));
  const pt = documents.renderDocument(md, { path: "runward/adr/ADR-0001-x.md", source: blob(PORTED, "/-/blob/") });
  assert.ok(pt.includes(`href="https://${PORTED}/-/blob/${COMMIT}/runward/floor.md"`), pt);
  assert.deepEqual([documents.checkRendered(gl).ok, documents.checkRendered(gh).ok, documents.checkRendered(pt).ok], [true, true, true]);
  // Azure DevOps addresses a file in the query (`?path=/runward/floor.md`): rule D3 asks that a forge
  // address end with the path, so the link is shown as text. Said in ADR-0130, not changed here.
  const az = documents.renderDocument(md, { path: "runward/adr/ADR-0001-x.md", source: (p) => `${repo.repositoryUrl(AZURE)}?path=/${p}&version=GC${COMMIT}` });
  assert.ok(!az.includes("<a "), az);
  // A planted identity gives no address, so a `source` built on it gives no link.
  const none = documents.renderDocument(md, { path: "runward/adr/ADR-0001-x.md", source: (p) => `${repo.repositoryUrl("gitlab.example.com/group/../project")}/-/blob/${COMMIT}/${p}` });
  assert.ok(!none.includes("<a "), none);
});

test("the identity is read in time linear in its length, which is bounded first", () => {
  const long = [`${"a.".repeat(200_000)}com/x/y`, `github.com/${"/".repeat(400_000)}`, `github.com/${"a/".repeat(200_000)}b`, `https://${"/".repeat(400_000)}`, `github.com/org/${".git".repeat(100_000)}`];
  const t0 = process.hrtime.bigint();
  for (const s of long) { assert.equal(repo.canonRepository(s), null); assert.equal(repo.foreignRepository(s), null); repo.normRepo(s); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 2000, `${ms} ms`);
});
