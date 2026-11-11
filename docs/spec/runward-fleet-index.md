# runward-fleet: the index, its inputs and the one decision that raises a cell

**Status**: specification of `runward-fleet-index/0`, dated 2026-11-06, with the code that implements it
(`packages/runward-fleet`); additive fields of 2026-11-10 for the decision reading
([ADR-0125](../adr/ADR-0125-the-decision-reading-a-plain-language-projection-of-the-fleet-index-from-a-closed-lexicon-in-two-languages-without-a-model.md),
[runward-fleet-decision.md](runward-fleet-decision.md)) · **Implements**: [ADR-0093](../adr/ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
decisions 8, 10 and 11, delivery D4 (static `runward-fleet`, trust policy, signature verification) ·
**Interface**: the one ADR-0121 names for its two deployments (the static page inlines the index, a
hosted deployment serves the same `index.json` next to the same views) · **Contracts**: three, each
`/0`, expand-only.

`runward-fleet build fleet.json --out site` reads the files `fleet.json` declares and writes
`site/index.json` and `site/index.html`. It is a pure function of those files: no clock, no network,
no repository, no runward module, no spawned process. A declared file that is absent is a finding in
the index, never a reason to stop. The build stops (exit 1, nothing written) on four things only: a
manifest or a trust policy it cannot read, a private filesystem path that would reach the page, and a
view rule a rendered view breaks.

## 1. `runward-fleet-manifest/0`: `fleet.json`, the declared inventory

The only list the fleet counts against: what is not declared here is not counted, and what is declared
and not received is shown as such.

| Field | Meaning |
|---|---|
| `format` | `runward-fleet-manifest/0` |
| `title` | the page's title |
| `asOf` | a date label; the build and the page read no clock |
| `lang` | `en` or `fr`, the language of the interface |
| `names` | optional, `shown` (the default) or `omitted`: with `omitted`, the index carries none of the names of the people an export declares, for a page published in public (ADR-0125) |
| `trustPolicy` | optional, the path of `trust-policy.json`; without it nothing is verified and nothing raised |
| `missions[]` | one entry per runward mission |
| `missions[].id` | a plain identifier, the stable join key; source ids derive from it |
| `missions[].name`, `role`, `path` | labels |
| `missions[].repository` | `host/owner/repo`; a signature must have been made for this repository |
| `missions[].commit` | the landing commit the exports were produced at, declared; a signed commit is compared with it |
| `missions[].commitSource` | optional, where the author of `fleet.json` read `commit` (a label of 200 characters at most, e.g. the claim of an upload's workload identity token for a hosted deployment); carried as declared, never checked; refused without `commit` |
| `missions[].expects[]` | the kinds the operator expects (`check`, `attestation`, `verify`, `witness`, `summary`, `report`, `history`, `signature`); a missing one is a finding |
| `missions[].exports.<kind>` | `{ file, producedBy, at }`; `file` relative to `fleet.json`, the two others labels. Or, when the content of the export is not shared, `{ sha256, producedBy, at }` without `file`: the 64 hexadecimal digits of its SHA-256, a digest only, never read (ADR-0125); a file and a digest together are refused |
| `missions[].signatures[]` | `{ covers, kind, ... }`: `covers` names the export kind the signature is meant to cover; `kind` is `sigstore-bundle` (`file`) or `ed25519-manifest` (`manifest`, `signature`, `format`, optional `claimedKey`) |

Paths are relative and never absolute. The export kinds are what runward writes: `check` (`check
--strict --json`), `attestation` (`check --strict --attest`), `verify` (`verify --json`), `witness`
(`check --strict --witness`), `summary` (`report --format md`), `report` (the HTML report, cited by
digest only) and `history` (JSON lines of records, today the replay of `scripts/fleet-demo.mjs`, a
prototype of ADR-0093's `ledger replay`). The verdict is read from `check`, else from the attestation's
predicate, which carries the same fields.

## 2. `runward-fleet-trust-policy/0`: `trust-policy.json`

| Field | Meaning |
|---|---|
| `format` | `runward-fleet-trust-policy/0` |
| `trustedRoots[]` | paths, relative to the policy, of trusted roots in Sigstore's `trusted_root.json` format |
| `signers[]` | the identities the operator trusts |
| `signers[].id` | a plain identifier |
| `signers[].kind` | `sigstore` or `ed25519`; or `key`, read by `verify-run` only (runward-run Statements, [runward-run.md](runward-run.md) §6) |
| `signers[].repositories[]` | the repositories this signer may sign for, `host/owner/repo` |
| `signers[].ref` | the protected ref; an entry raises only if it is `refs/heads/main` |
| `issuer`, `workflow` (sigstore) | the OIDC issuer and the Build Signer URI, compared exactly |
| `workflowDigests[]` (sigstore) | the Build Signer Digests (the commit of the workflow file) the policy pins |
| `runnerEnvironment` (sigstore) | optional, e.g. `github-hosted` |
| `publicKey` or `jwk` (ed25519) | the key, a PEM file relative to the policy, or a JWK |
| `keyDigest` (ed25519) | `sha256:` and the hex digest of the key's SPKI, required; a digest that is not the key's stops the build |
| `publicKey`, `keyDigest` (key) | a PEM file relative to the policy (ECDSA P-256 or P-384, what `cosign generate-key-pair` writes, or Ed25519) and the digest of its SPKI, required; a key that signs DSSE envelopes of run Statements on an instance with no keyless signing |
| `manifestFormat` (ed25519) | the manifest schema this key signs; `dropyour.preuves-ci.v2` in this version |

An entry is **pinned** when it pins `refs/heads/main` and, for `sigstore`, at least one workflow digest.
An entry that is not pinned is kept, shown with what it does not pin, and raises nothing (ADR-0093 D4:
"unpinned policy raises nothing").

### 2.1 Verification, offline

- **A Sigstore bundle** (`application/vnd.dev.sigstore.bundle+json;version=0.1` to `0.3`, a DSSE
  envelope): the log entry's key is one the trusted root lists for the integrated time; its signed
  entry timestamp verifies; its inclusion proof (RFC 9162) reaches the root hash its checkpoint names;
  the checkpoint is signed by the log key; the entry's body (kind `dsse` 0.0.1) names this payload, this
  signature and this certificate; the certificate chains to a certificate authority of the trusted
  root valid at the integrated time, the integrated time lies inside its validity, and it is a
  code-signing leaf; the DSSE signature verifies under its key; the payload is an in-toto Statement.
  The signing time is the log's integrated time, trusted because its signature verified: the machine's
  clock is never read. Each check is named on the page.
- **A detached Ed25519 signature**: the signature (base64) verifies over the manifest's exact bytes
  under a key the policy pins for that manifest format. A key shipped with the export (`claimedKey`) is
  used only to tell a key outside the policy apart from a falsified manifest.

Not verified by this version, shown `not-verifiable`, never passed: a bundle whose time comes only from
an RFC 3161 timestamp (GitHub's instance for private repositories, a Rekor v2 entry), a log entry of a
kind other than `dsse`, a bundle without a certificate.

### 2.2 The decision

A cell is raised from `ci-declared` to `machine-established` only when every condition holds:

1. the signature verifies (§2.1);
2. its signer matches a policy entry for this mission's repository;
3. that entry is pinned;
4. the signed ref is `refs/heads/main`, and the signed commit is the mission's declared `commit`;
5. what was signed covers the export's bytes: the DSSE payload is the export, or the signed Statement
   equals it, or one of its subjects carries the export's sha256, or (a manifest) one of its listed
   files does;
6. the export is not a replay.

The raised cells are the verdict (`missions[].latest`) when the signature covers the file the verdict
was read from, and the attestation (`missions[].attestation`) when it covers it. A key names its holder,
not the workflow that used it, which ADR-0093 decision 8 asks a certificate to name; `KEY_SIGNATURES_RAISE`
in `src/trust.js` says whether this version raises a key-signed export (it does, and the page says
"a key names its holder, not the workflow that used it" beside it), pending the maintainer's note on
that decision.

### 2.3 Signature states and reason codes

`state` is one of `verified` (verified, the signer matches the policy), `outside-policy` (verified, the
signer is not one the policy pins for this repository), `refused` (a check failed on its own merits),
`absent` (a declared file is not there), `not-verifiable` (nothing to verify against, or a feature this
version does not verify). `raised` is true only for `verified` with no reason.

| Code | Why the cell is not raised |
|---|---|
| `signature-file-absent` | a declared file is absent |
| `no-policy`, `no-trusted-root` | nothing to verify against |
| `bundle-unreadable`, `manifest-unreadable` | the signed file is not readable |
| `unsupported-bundle`, `unsupported-manifest-format`, `unsupported-signature-kind` | this version does not verify it |
| `signature-does-not-verify` | a cryptographic check failed (the failed checks are listed) |
| `signer-not-in-policy`, `workflow-digest-not-pinned`, `key-not-in-policy` | the signer is not one the policy pins |
| `signer-pinned-for-other-repositories`, `signed-for-another-repository` | a repository cannot sign for another |
| `policy-unpinned-ref`, `policy-unpinned-workflow-digest` | the policy entry is not pinned |
| `signed-on-another-ref` | the signed ref is not `refs/heads/main` |
| `runner-not-pinned` | the runner environment is not the one the entry pins |
| `no-landing-commit`, `signed-at-another-commit` | no declared commit, or another one |
| `does-not-cover-export` | what was signed is not this export |
| `replay-never-raised` | a replayed record is never raised |
| `key-signatures-do-not-raise` | this build raises no key-signed export |

## 3. `runward-fleet-index/0`: `index.json`

Unknown values read `not-observed`. A grouping is always `{ state, n, N, list }`: `n` is the length of
`list`, `N` the denominator; the views display groupings and never compute one (ADR-0064, note of
2026-10-13).

| Key | Content |
|---|---|
| `format` | `runward-fleet-index/0` |
| `builtBy` | `{ name, version }` of runward-fleet |
| `title`, `lang` | from the manifest |
| `names` | present only when the manifest omits names: `{ state: "omitted", source: "fleet.json" }`. Then `ratification.ratifiers` is empty, the person of every `agents[]` and `agentRows[]` entry is `null`, and the build refuses (exit 1, nothing written) an index where a name an export declares (who ratified in a person's mode, the person an agent answers to) would still appear in another field projected from an export (a refusal's text, a summary, a note), naming where; the operator's own labels (a title, a mission name, a repository) are not read. A name written only in free text, a proposer quoted inside an evidence cell for instance, is not one the build knows, and it is not seen |
| `asOf` | `{ label, source }`: the declared date and the sentence that says no clock was read |
| `manifest` | `{ src }`, the manifest's source id |
| `policy` | `null`, or `{ src, trustedRoots[], signers[] }`: each signer with `pinned` and `unpinned[]` (`ref`, `workflow-digest`) |
| `fleet` | `declared`; groupings `byVerdict` (`clean`, `gaps`, `level-not-met`, `not-observed`, `not-available`, each always present; `level-not-met` is a strict gate with no gap below its required level of proof, exit 5, runward ADR-0114; `not-available` a mission whose check reached the inventory as a digest only, ADR-0125), `byImplemented` (`not-available` appended when a mission is), `sealed`, `findings`; `signatures` with `declared`, `byState`, `raised` |
| `missions[]` | one per declared mission, in declaration order |
| `absent[]` | what runward does not produce yet: `{ what, state, contract, delivery }` |
| `sources[]` | every file read: `{ id, path, sha256, bytes, kind, producedBy, at, origin, declaredIn }`; an export declared by its digest only is a source too, `{ …, path: null, bytes: null, origin: "declared", content: "digest-only" }`, its `sha256` the one `fleet.json` declares, never computed |

A mission carries `id`, `name`, `role`, `repository`, `path`, `commit` (`{ value, source }` or `null`;
`source` is `fleet.json (declared)`, and `commitSource` is added, as written in the inventory, only when
the inventory names one),
`expects`, `findings[]` (`{ what, state, why, ... }`, `why` one of `declared-file-absent`,
`expected-none-declared`, `unreadable`, `signature-refused`, and `digest-only` with the state
`not-available`), `signatures[]` and `signaturesByState`, and, when observed: `latest`, `attestation`,
`verify`, `witness`, `summary`, `report`, `history`.

- `latest` is `not-observed`, `not-available` (no check or attestation was read, and one of them was
  declared by its digest only), or the verdict: `from` (`check` or `attestation`), `src`, `origin`
  (`undetermined`, as for every record the CLI writes), `implemented` (`ci-declared` or
  `machine-established`), `raisedBy` when raised, and the fields projected from the payload: `runward`,
  `verdict`, `exitCode`, `currentGate`, `adrCount`, `strict`, `gaps`, `causesByKind`, `deliverables`
  (`list`, `byState`), `conformance`, `evidence`, `seal`, `corpus`, `criticalScope`, `ratification`
  (counts, `byState`, `changedRows`, `ratifiers`), `requiresUnmet` (`list`, `byNature`, `size`),
  `committedJUnit`, `assurance`, `delegationStage`, `gateNonScope`, `next`. Since ADR-0125, additively: each
  `conformance` row carries the export's `line` and `phaseId` beside `scope`, `rule`, `kind`, `problem` and
  `file` (`null` when the export does not carry them); `conformanceByKind` groups the rows by `kind`, in the
  order the export lists them (`not-observed` for a row without one), each `{ state, n, N, list }` listing
  `scope · rule`, and, since ADR-0128, `byText`: the rows of that kind by their `problem`, compared
  character for character, in the order the export lists them, each `{ state, n, N, list }`, `state` being
  the text as written, `N` the kind's `n` and `list` the positions of its rows in `conformance` (the groups
  of a kind partition its rows, a rule of the build); `ratification` adds `agent` (the rows an agent ratified, 0 when the export does not write
  the field, which the CLI omits at zero), `agents` (`{ agent, for, rows }` as the CLI writes them),
  `singleAccountable` (`{ rows, disclosure[] }` or `null`), `byMode` (the decided rows by how they were
  endorsed: the mode of a ratified row, `line-by-line`, `en bloc`, `agent` or `agent (single accountable)`,
  or the state of any other, `blind`, `changed` or `untraced`; each always present with n of N and its
  list, so the groups partition the decided rows, a row whose mode or state the export does not write
  being grouped as `not-observed`; `not-observed` in place of the list when the export lists no row) and
  `agentRows` (`{ state, agent, for, forDeclared, n, N, list }`, the ratified rows of each agent, person
  and mode, sorted; `forDeclared` says whether the export declared a person, which `for` no longer does
  when names are omitted). The payload's `mission` is
  never projected: the mission is named by the inventory's `name`, and the field was the checkout's
  absolute path until RWD-2026-0199 (it is now the name the mission declares, as in the attestation).
- `history` holds `series[]`, one per origin, never mixed: `src`, `origin`, `judgedBy[]`, `size`,
  `records[]` (`ref`, `commit`, `committedAt`, `verdict`, `exitCode`, `conformanceGaps`,
  `deliverableGaps`, `assurance`, `payloadSha256`, `judge` (an index into `judgedBy`),
  `signatureVerified`, always `false`), `byVerdict`, `maxConformanceGaps` (the chart's scale).
- A signature result carries `id`, `src[]`, `kind`, `covers`, `state`, `raised`, `via` (`sigstore` or
  `ed25519`), `signer` (the policy entry), `identity` (the certificate's claims, or the manifest's),
  `checks[]` (`{ id, ok, detail, as }`, `as` being `unsupported` or `skipped`), `binds` (`{ how, name }`)
  and `reasons[]` (`{ code, ... }`, §2.3).

**What a reader of `/0` handles since 2026-11-10.** The additions keep every key and every former value,
and widen three value sets: `latest` may be the string `not-available` beside `not-observed` (test whether
it is an object, never whether it equals `not-observed`); a source's `path` and `bytes` may be `null` (a
digest only, `content: "digest-only"`); a finding's `state` may be `not-available`. The views of this
package handle them, and so does any reader that tests `typeof latest === "object"`. Since 2026-11-11
(ADR-0128), each group of `conformanceByKind` carries `byText`, whose `state` is a refusal's free text,
never a closed value; an index built before carries none, and the decision reading then lists each refusal
alone.

Source ids are stable join keys: `fleet.json`, `trust-policy.json`, `policy:root:<n>`,
`policy:key:<signer>`, `<mission>:<kind>`, `<mission>:signature:<n>` (and `:manifest`, `:sig`,
`:claimed-key`). Adding a mission never renames another's sources.

## 4. The views and their rules

Eight views read the index: the decision reading (the page opens on it, ADR-0125,
[runward-fleet-decision.md](runward-fleet-decision.md)), the fleet, a mission, its history, the proof
(re-derive without us), the signatures, the PR summary, the sources. Each is a pure function of the index (`ui/views.js`), the same
in the static page and in a hosted deployment. Every number carries its source, its path in that
source and its path in the index. The eighteen rules of ADR-0093 decision 11:

| # | Rule | Held by |
|---|---|---|
| 1 | no state computed by a view | test: a planted view that counts for itself is caught by the tie check |
| 2 | the face is a function of fields, tied to the provenance by a golden test | build (every number resolved in the index) and test (golden faces in both languages) |
| 3 | states never summed, no composite percentage | build (no percentage shown, none computed by the page script) and test (no face prints a sum of its states) |
| 4 | gaps and silent repositories not filterable by default | test: every declared mission is listed |
| 5 | silence is a finding | test: a declared, absent export is counted and listed |
| 6 | `replayed` never mixed with other origins | test: one series per origin |
| 7 | no cross-version comparison without a marker | test: another judge, or another version than the latest export, is marked |
| 8 | no strong state carried by time | test: a mission silent today reads silent, whatever its history |
| 9 | the CLI verifies no signature | runward (`verify` reports `signatureVerified: false`, [runward-signing.md](runward-signing.md) §3) |
| 10 | `machine-established` only by the satellite under pinned policy | build (`checkIndex`) and tests of §2.2 |
| 11 | a repository cannot sign for another | tests of §2.2 |
| 12 | management-body approval never set by software | build: the index carries no approval field |
| 13 | the side channel never touches the verdict | runward (the event stream, D3, not built) |
| 14 | machine mode shows "machine mode in force" | test |
| 15 | a harness release is never an emergency | build: no view says it |
| 16 | bypass review is disclosure by default, strict only when opted in | runward (D3, not built) |
| 17 | join keys stable | test: source ids follow mission ids |
| 18 | no connector posts a pass or a conformity claim without the customer's rule | runward-fleet has no connector: no network code (`runtime-boundary.test.js`) |

The build also refuses a page that is not self-contained (an external script, stylesheet, font, image or
fetch), that defines the gold more than once or uses it outside `.or`, that shows gold more than once
in a view, that carries a colour the identity refuses, that reads or formats a clock in its script, or
whose own words include one runward never uses about itself; text the view marks as verbatim data (a
mission name, a rule slug, a quoted export) is the data's, not the view's.

## 5. What a hosted deployment imports

One interface, two deployments (ADR-0121 decision 1): a hosted deployment assembles the index and serves
the view with this package, pinned, and copies none of its files. Its entry points:

| Export | What it gives |
|---|---|
| `runward-fleet` | `buildIndex({ manifest, read, version })`, `readManifest`, `BuildError`, `PRIVATE_PATH`, `INDEX_FORMAT`, `MANIFEST_FORMAT` |
| `runward-fleet/rules` | `checkIndex`, `checkView`, `checkPage`: the view rules, run on an index before it is served; `checkReading`, `checkLexicon` and `checkRefusals` (with `refusalPaths`, the refusals a page lists), the rules of the decision reading, with the word lists they hold (`BANNED`, `INTERNAL`, `NOT_A_STATE`, each with its forms) |
| `runward-fleet/views` | `renderView`, `renderNav`, `renderStamp`, `allViews`, `ROUTES`: the views, for a shell of its own; `decide(index)`, the decision reading as a document (`runward-fleet-decision/0`), `renderDecision(index, id?)`, its HTML, `LEXICON` and `lexiconAt`, the closed lexicon in both languages |
| `runward-fleet/site` | `renderPage(index)`, the page `runward-fleet build` writes to `index.html`, byte for byte; `renderSite(index, assets)`, the same with assets given; `siteAssets()`, the template (the identity's tokens and the shell), the source of the views and the fonts, read from the package |
| `runward-fleet/trust`, `runward-fleet/sigstore` | the trust policy and the offline verification of §2 |

The template's shell reads the inlined index, else `index.json` from the same origin. The golden test of
`fleet-build.test.js` holds the property ADR-0121 names: the page `runward-fleet/site` renders from the
bytes of the `index.json` the build wrote is the `index.html` it wrote, and the index and the page of one
inventory are golden files (`test/fixtures/golden/fleet/`), regenerated with `UPDATE_GOLDEN=1` and read
in a diff.

The tests are `test/unit/fleet-build.test.js`, `fleet-view-rules.test.js`, `fleet-signatures.test.js`,
`fleet-release.test.js` and the ADR-0093 section of `runtime-boundary.test.js`.
