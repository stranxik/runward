# The run Statement of runward-run: `https://runward.dev/run/v1`

**Status**: specification, dated 2026-11-06, with the code that implements it (`packages/runward-run`,
the reader in `src/lib/evidence-levels.ts`, the verifier in `packages/runward-fleet/src/run-signature.js`)
· **Implements**: [ADR-0120](../adr/ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md)
decisions 2 to 6, deliveries R1, D4a, R2 and R3 · **Contracts**: two, both expand-only: the run policy
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
| `legs[]` | `{ leg, cwd, command, reports[], timeoutSeconds }`; `leg` is `tests` or `reports` (R1), `coverage` or `mutation` (R2), `evals` (R3) |
| an `evals` leg | runs like a `tests` leg, the network cut: only evals that replay recorded outputs or run a pinned local model. With `remote: true`, `{ leg, remote, reports[], why? }` and no command: the evals need a remote model, runward-run runs nothing for them, and the Statement names their reports as declared (`declared[]`), never as subjects. A run needs at least one leg that runs |
| a `coverage` leg | writes a `coverage` report (LCOV); runward-run reads it for the coverage of the cited lines (§7) |
| a `mutation` leg | `{ leg, cwd, command, junit, timeoutSeconds, maxMutantsPerLocation }`, at most one, no `reports`: `command` runs the tests and writes a JUnit report at `junit` under `${out}`; `timeoutSeconds` bounds one mutant's run (default 300), `maxMutantsPerLocation` the mutants of one cited location, the first in source order (default 40). A run needs at least one leg that writes a report |
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
| `legs[]` | `{ leg, cwd, command (expanded), exitCode, reports[] }`, in policy order, the mutation leg last (its `exitCode` is the baseline's, §7); `timedOut: true` when a leg ran out of time |
| `manifests` | `{ files[], digest }`: the gated manifests of the mission and the digest of their map (§3) |
| `sources` | `{ rule, count, files: { <path>: <digest> } }`: the expected set of §3, hashed before any leg ran |
| `expected` | `{ from, runward }`: where the set came from, and the runward version that derived it |
| `coverage` | present only with a coverage leg (R2): `{ report, targets[] }`, each target `{ deliverable, rule, locations[] }`, a location `{ file, from, to, instrumented, executed }` (§7) |
| `mutation` | present only with a mutation leg (R2): `{ mutator, leg, distinction, baseline, targets[], locations[], mutants[] }` (§7) |
| `declared` | present only with a remote evals leg (R3): `[{ path, nature, leg: "evals", why }]`, the reports the run did not produce; runward reads a cited report listed here as `declared`, with `why` |
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
cites at least one execution piece and all are attested and, when it cites a code location and a test,
its mutation fact is met (§7); `declared` when it rests on prose; `re-derived` otherwise. `--require attested` is met when no applied row is declared, the declared territory is
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

## 7. The coverage and the mutation of the cited lines (R2, ADR-0119 decision 2)

**The targets are runward's.** `check --strict --require attested --json` publishes
`levels.execution.mutationTargets`: one per applied row that cites a code location (a `file:` pointer at
a JavaScript or TypeScript source file that is not a test) and a test (a `test:` pointer naming a case of
a JUnit report), `{ deliverable, rule, locations: [{ file, from, to }], tests: [<case name>] }`, locations
sorted and unique, tests sorted and unique. A location's lines are its symbol's for `#SYMBOL` (from the
declaration that names it to the end of the block or statement it opens, read on the code with comments,
strings, templates and regular expressions blanked), its line for `:LINE`, else the whole file.
runward-run mutates those lines and no other, and records the targets as it read them; a target it does
not find in the check output is refused (exit 3) before anything runs.

**The mutation leg.** The leg's command runs once on the unmutated copy (`baseline`: `{ exitCode, cases:
{ <name>: outcome } }`), then once per mutant: the copy's file changed by one operator of the mutator
`runward-run/js-ts/1` (equality, relational between spaces, logical, arithmetic after an operand, boolean
literal, negation before an operand, an `if` condition set to `true` and to `false`, a block emptied, a
string or template literal emptied except a module specifier, a directive and an object key), the
network cut, the file restored after the run. `locations[]` records each cited location's `candidates`
and the `mutants` run (the first `maxMutantsPerLocation` in source order; one change reached from two rows
runs once); `mutants[]` records each `{ file, line, column, operator, exitCode, timedOut?, cases }`,
`cases` holding the outcome of every cited case of every target: `passed`, `assertion` (failed on an
assertion: `AssertionError`, `ERR_ASSERTION`), `error` (failed on another error class, or JUnit's
`<error>`), `failure` (failed with no class the runner tells), `skipped`, or `absent` (not in the report:
the file did not load). No timing is recorded; runward-run prints the leg's wall clock on its output.

**What runward reads** (from a bound, signed Statement found as §4, beside the row's cited JUnit report):
for a row, its target as the Statement records it, compared with the one this tree implies (another one
binds nothing for the row: `mismatch`), its cited cases at the baseline (each must have `passed`), then
its mutants, those on its cited lines. A mutant is killed through a failed assertion when one of the row's
cases reads `assertion`; by a timeout; through an error when one reads `error` or `absent`; without the
distinction when one reads `failure`; otherwise it survived. The row's mutation fact is met when at least
one mutant is killed through a failed assertion, or, where no failure of its mutants carries the
distinction, when at least one is killed (`killed-indistinct`, said). It is not met when none is
(`not-killed`), when its cited lines hold no mutant (`no-mutant`: an interface, a type; the row cites the
lines that implement it), when a cited case fails at the baseline, or when no bound and signed Statement
carries it (`absent`, `unbound`, `unsigned`). A row whose cited code is in a language runward-run has no
mutator for reaches `attested` without the fact (`no-mutator`, said). Under `--require attested`, a row
whose fact is not met is below the level, with `mutation: <why>` among what holds it; the survivors are
listed on the row, never summed into a score.

**The coverage leg** gives, for each cited location, the lines the LCOV instruments and the lines it
records executed, by the suite (a runner reports coverage per run, not per test). runward shows it on the
row (`coverage`); it sets no level.
