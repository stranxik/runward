# The run Statement of runward-run: `https://runward.dev/run/v1`

**Status**: specification, dated 2026-11-06, with the code that implements it (`packages/runward-run`,
the reader in `src/lib/evidence-levels.ts`, the verifier in `packages/runward-fleet/src/run-signature.js`)
· **Implements**: [ADR-0120](../adr/ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md)
decisions 3 to 6, deliveries R1 and D4a · **Contracts**: two, both expand-only: the run policy
`runward-run-policy/0`, read by runward-run; the run predicate `https://runward.dev/run/v1`, written by
runward-run and read by runward and runward-fleet.

Three programs meet on this document and share no code: runward-run writes the Statement, runward
re-derives its binding to the tree and counts its signatures, runward-fleet verifies a signature against
the operator's trust policy. A disagreement between this document and any of them is a defect of one of
them, filed in `docs/compliance/known-defects.md` before either side changes.

## 1. The run policy: `runward-run-policy/0`

The operator's, kept with the workflow that runs runward-run, never in the judged tree (a policy inside
the tree is refused, exit 3).

| Field | Meaning |
|---|---|
| `format` | `runward-run-policy/0` |
| `image` | `name[:tag]@sha256:<64 hex>`; anything else is refused (exit 3) |
| `install` | optional: `{ cwd, lockfile, command }`; `lockfile` must exist in the tree; for `npm`, `pnpm`, `yarn` and `bun` the command must carry `--ignore-scripts` (exit 3 otherwise) |
| `legs[]` | `{ leg, cwd, command, reports[], timeoutSeconds }`; `leg` is `tests` or `reports` (R1); `coverage`, `mutation` and `evals` are refused by name until R2 and R3 |
| `legs[].command` | an argument vector, never a shell line; `${out}` and `${work}` expand to the container paths of the output directory and of the copy of the tree |
| `legs[].reports[]` | `{ path, nature }`: the project-relative path the report is committed at, and its nature (`junit`, `sarif`, `eslint`, `coverage`, `sbom`, `loadtest`); a `tests` leg writes a `junit` report |

Every report of a run is in one directory, the one the Statement is written to (§4).

## 2. The Statement

An in-toto Statement v1, unsigned, written as `runward-run.intoto.json` in the reports' directory, with
`runward-run.test-result.intoto.json` beside it (the in-toto `test-result` predicate, v0.1, whose subject
is the source set of §3, named `sources`). Deterministic: the same inputs give the same bytes, so that
several signers sign one payload.

- `subject[]`: one per report, `{ name: <project-relative path>, digest: { sha256: <hex of the bytes written> } }`, sorted by name.
- `predicateType`: `https://runward.dev/run/v1`.
- `predicate`:

| Key | Meaning |
|---|---|
| `executor` | `{ name: "runward-run", version }` |
| `mission` | `{ repository, commit, ref }` as the workflow passed them (`--repository`, `--commit`, `--ref`), or null. A signer that is not the mission's forge identity vouches for them by signing (§6) |
| `policy` | `{ sha256: <hex of the policy file's bytes>, legs: [...] }` |
| `runtime` | `{ name, version }` of the container runtime |
| `image` | `{ ref, digest }`, as pinned |
| `network` | `"none"`, always: a run that could not cut it writes nothing |
| `install` | `{ command, cwd, exitCode, network: "open", installScripts: "disabled" \| "not-applicable" }`, or null |
| `lockfile` | `{ path, sha256 }` (the digest of §3), or null |
| `legs[]` | `{ leg, cwd, command (expanded), exitCode, reports[] }`, in policy order; `timedOut: true` when a leg ran out of time |
| `manifests` | `{ files[], digest }`: the gated manifests of the mission and the digest of their map (§3) |
| `sources` | `{ rule, count, files: { <path>: <digest> } }`: the expected set of §3, hashed before any leg ran |
| `expected` | `{ from, runward }`: where the set came from, and the runward version that derived it |
| `nonScope` | what a run Statement never claims, at the character of `RUN_NON_SCOPE` |

A key a reader does not know is ignored; no key changes meaning under this URI.

## 3. Digests, and the expected set

- **A file's digest**: SHA-256 of its content; when the bytes hold no NUL, of the UTF-8 text with every
  CRLF read as LF (the seal's and the mission-state digest's normalisation).
- **A map's digest**: SHA-256 of the JSON of `{path: digest}`, keys sorted by UTF-16 code unit, no space.
- **A subject's digest**: SHA-256 of the report's bytes as written. runward also accepts the digest of
  the same bytes with CRLF read as LF, so a checkout that rewrote line endings still binds.
- **The expected set**, derived by runward from the tree and published by `check --strict --require
  attested --json` at `levels.execution.expected` (`{ rule, files[], manifests[], manifestsDigest }`):
  the files the built-in analyzers read under the pinned policy (source and configuration files), the
  files the applied rows cite and the tests they cite, less the files whose content is an execution
  report (§5) and the in-toto documents (Statements, DSSE envelopes, Sigstore bundles). runward-run
  records it; it never chooses it.

## 4. Where runward looks

For each report an applied row cites, in that report's directory only: every regular file of at most
8 MiB whose name ends in `.intoto.json`, `.intoto.jsonl`, `.dsse.json`, `.sigstore.json`,
`.sigstore.jsonl` or `.sigstore`, whose content is a run Statement: bare (no signature), in a DSSE
envelope (`payloadType` `application/vnd.in-toto+json`), or in a Sigstore bundle around one (the first
line, for a JSON Lines file). Nothing else is read, nothing is fetched (ADR-0054 crossing 4).

## 5. The binding, re-derived by runward (ADR-0120 decision 6)

An execution piece is a cited file whose content is a report of a nature of §1 (not a source file).
It is **attested** when a run Statement found as §4 says:

1. has the report's digest among its subjects;
2. records `network: "none"`;
3. records `manifests.digest` equal to this tree's;
4. records a source set that holds every file of the expected set this tree implies (not narrower),
   and every recorded digest equals this tree's (a recorded path outside the project is a problem, never
   opened);
5. and carries at least one signature: a non-empty `sig` in its envelope. Counted, never verified.

Otherwise the piece is **declared**, and runward names why: no Statement binds the digest, the Statement
does not bind to this tree (which check failed), or it carries no signature. A row is `attested` when it
cites at least one execution piece and all are attested; `declared` when it rests on prose; `re-derived`
otherwise. `--require attested` is met when no applied row is declared, the declared territory is
analysed, no execution piece is declared, and every `requires:` nature a row's rule names is carried by
an attested report. Every payload says `signatureVerified: false` and « attested: the binding is
re-derived by this command; the signature is verified outside it ».

## 6. The identity, verified by runward-fleet (D4a)

`runward-fleet verify-run <bundle|envelope> --policy <trust-policy.json> --repository <host/owner/repo>
--commit <sha> [--ref <ref>] [--statement <run.intoto.json>]` verifies offline, against the trusted
roots and keys of the operator's trust policy (`runward-fleet-trust-policy/0`,
[runward-fleet-index.md](runward-fleet-index.md) §2, which gains the signer kind `key`: `publicKey`, a
PEM file, and its `keyDigest`, for ECDSA P-256, P-384 or Ed25519 DSSE signatures).

- **Keyless** (a bundle with a certificate): the log entry, the chain at the log's time and the DSSE
  signature verify (sigstore.js); the certificate's issuer and Build Signer URI are those of a policy
  entry for this repository, which pins the Build Signer Digest. The mission's repository, commit and
  ref are the certificate's Source Repository claims, unless the pipeline ran in the signer's own
  repository (a GitLab runner project): then they are the Statement's `mission`, vouched for by the
  signer. The Statement's `mission`, when present, must agree with the certificate.
- **A key** (a bare DSSE envelope, or a bundle with a public key hint): the signature verifies under a
  key the policy pins for this repository; the mission is the Statement's `mission`.
- Refused by name: `signed-from-the-mission-workflow` (the signer workflow lives in the mission's
  repository: the agent can write it, whatever the policy says), `signer-not-in-policy`,
  `policy-unpinned-workflow-digest`, `workflow-digest-not-pinned`, `signer-pinned-for-other-repositories`,
  `signed-for-another-repository`, `signed-at-another-commit`, `signed-on-another-ref`,
  `statement-names-another-repository`, `statement-names-another-commit`, `key-not-in-policy`,
  `not-a-run-statement`, `run-network-not-cut`, `no-mission-claims`, `statement-differs`, and the
  verification failures of sigstore.js.
- Accepted only when the signature verifies and no reason stands. A landing (ADR-0093 decision 8) only
  when the signed ref is `refs/heads/main` and the policy entry pins it.

Exit codes: 0 accepted, 1 refused or not verifiable, 2 a question it cannot ask (no commit, a policy it
cannot read). Its result enters no file runward reads (ADR-0119, a question left closed under ADR-0093).
