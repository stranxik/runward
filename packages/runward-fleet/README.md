# runward-fleet

A static view of every runward mission of an organisation, built from the files runward writes, with
the signatures verified offline against the operator's trust policy. It is the customer-run satellite
of [ADR-0093](https://github.com/stranxik/runward/blob/main/docs/adr/ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 10), and its interface is the one a hosted deployment serves too (ADR-0121, one interface,
two deployments).

MIT. Node.js 22.12 or later, no dependency. It imports nothing from `runward`, reads no repository,
opens no connection, spawns no process and reads no clock: `test/unit/runtime-boundary.test.js`, in the
repository, checks the first four with planted controls, and `test/unit/fleet-build.test.js` the last.

```sh
runward-fleet build fleet.json --out site    # writes site/index.json and site/index.html
```

`index.json` is the contract `runward-fleet-index/0`
([docs/spec/runward-fleet-index.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-fleet-index.md)).
`index.html` is one page: the index, the views and the fonts inlined, a content security policy that
loads nothing by default, nothing fetched from elsewhere. Exit codes: 0 written, 1 refused (nothing is
written), 2 a usage error.

## What it shows, and what it never does

- It shows what each export says, the source and the JSON path of every number, the sha256 of every
  file it read, and every count as `n / N` with the list it counts. A refusal's own text is shown as
  written, and no sentence is read from it.
- It never computes a state in a view, never adds states into one score, never prints a percentage,
  never hides a silent mission: a mission declared in `fleet.json` whose export is absent is a finding.
- It never raises a cell above what a verified signature under a pinned policy supports. A record runward
  writes reads `ci-declared` at most; only this satellite may raise it to `machine-established`.
- The eighteen view rules of ADR-0093 decision 11 are listed on the page with where each is held. The
  build renders every view and checks the rules it can read on them before it writes anything: a page
  that breaks one is not written.

## The decision reading

The page opens on a plain-language reading of the index, for the people who answer for what agents deliver
and do not read code (ADR-0125): the applications refused first, then those whose required level is not
met, then the others (ADR-0128); for each, its state, the reason, the refusals by kind and, within a kind,
by their own text as written, shown once and folded with every refusal it stands for, the documents not
filled in, how the decided rows were endorsed (an agent's endorsement is never worded as a person's), and
where the reading comes from. Every sentence
comes from a closed lexicon in English and French, keyed on a closed value of the index; nothing is
computed and no model is called. `decide(index)` and `renderDecision(index, id?)`, exported by
`runward-fleet/views`, give it as a document (`runward-fleet-decision/0`) and as HTML whose elements carry
style roles. The specification, the lexicon and the closed lists are
[docs/spec/runward-fleet-decision.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-fleet-decision.md)
and [docs/spec/runward-closed-values.json](https://github.com/stranxik/runward/blob/main/docs/spec/runward-closed-values.json).

## A mission's documents

`runward-fleet/documents` is for a deployment that shows a mission's own Markdown documents, which are
untrusted text (ADR-0127). `renderDocument(markdown, context?)` renders a closed subset of Markdown into a
closed list of elements: raw HTML is shown as text, a link is rewritten (a slug, a route of the
application, or an https address without credentials) and anything else stays text; there is no class, no
style and no image. `checkRendered(html)` is the check a page asks before inserting an output.
`register(files)` reads the register of the decision records from each record's header, and
`topology(markdown)` the port placement table. The module has no import and no DOM. The specification is
[docs/spec/runward-fleet-documents.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-fleet-documents.md).

## The mission projections

`runward-fleet/mission` (ADR-0126) says where each application stands in the six steps of the method (Frame,
Architect, Floor, Iterate, Govern, Hand over; in French Cadrer, Architecturer, Plancher, Itérer, Gouverner,
Transmettre), side by side for a portfolio, and how that changed over the versions a hosted service received.
`path(index, id)` reads each step crossed, documents complete, refused at this step, current, not reached yet,
or not asked by the gate (step 4: the gate asks for no document there), each with its documents and
refusals as n / N and what is missing; `portfolio(index)` maps applications by step; `point(index)` is one
version's compact summary, and `series(entries)` the series of points over the versions received, with since
when the last state holds. They read the index as it is and add nothing to it, share the decision reading's
words, and `renderPath`, `renderPortfolio` and `renderSeries` give their HTML with style roles. The static page
does not show them yet. The specification is
[docs/spec/runward-fleet-mission.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-fleet-mission.md).

## fleet.json, the declared inventory

```json
{
  "format": "runward-fleet-manifest/0",
  "title": "Our missions",
  "asOf": "2026-11-06",
  "lang": "en",
  "trustPolicy": "trust-policy.json",
  "missions": [
    {
      "id": "app",
      "name": "org/app",
      "repository": "github.com/org/app",
      "commit": "<the landing commit these exports were produced at>",
      "expects": ["check", "attestation", "signature"],
      "exports": {
        "check": { "file": "exports/app/check.json", "producedBy": "runward check --strict --json" },
        "attestation": { "file": "exports/app/verdict.intoto.json" }
      },
      "signatures": [
        { "covers": "check", "kind": "sigstore-bundle", "file": "exports/app/check.sigstore.json" }
      ]
    }
  ]
}
```

Paths are relative to `fleet.json`. `asOf` is a label: neither the build nor the page reads a clock.
An export whose content is not shared is declared by its digest alone, `{ "sha256": "<64 hex digits>" }`
without `file`: the mission then reads "content not shared". `"names": "omitted"` keeps the names of the
people an export declares out of the index, for a page published in public; the build refuses one that
would still carry such a name in another field.
`lang` is `en` or `fr`. The export kinds are `check`, `attestation`, `verify`, `witness`, `summary`,
`report` and `history`; `expects` may also name `signature`. A mission may add `commitSource`, a short
label of where `commit` was read from; the index carries it as written, and nothing checks it.

`repository` is the identity of the mission's repository, for any forge (ADR-0130): a host and a path of
two to eight segments, `github.com/org/app`, `gitlab.example.com/group/subgroup/project`,
`dev.azure.com/org/project/_git/repo`. Letters, digits, `_`, `.` and `-` only in a segment, nothing
decoded, no empty or dot segment, no scheme and no port; the index carries it in lower case, without
`.git`. The build stops on anything else and says which rule it breaks. The trust policy's `repositories`
and `verify-run --repository` read the same grammar
([the specification](../../docs/spec/runward-fleet-index.md), §1.1).

## In a hosted deployment

A hosted deployment imports this package, pinned, and copies none of its files: `buildIndex` from
`runward-fleet`, the view rules from `runward-fleet/rules`, the views from `runward-fleet/views`, and from
`runward-fleet/site` `renderPage(index)`, the page `runward-fleet build` writes, byte for byte, or
`siteAssets()`, the template, the views' source and the fonts. The same `index.json` gives the same page in
both deployments; `test/unit/fleet-build.test.js` holds it against golden files.

## trust-policy.json, and when a cell is raised

```json
{
  "format": "runward-fleet-trust-policy/0",
  "trustedRoots": ["trust/sigstore-public-good.trusted_root.json"],
  "signers": [
    {
      "id": "app-ci",
      "kind": "sigstore",
      "repositories": ["github.com/org/app"],
      "issuer": "https://token.actions.githubusercontent.com",
      "workflow": "https://github.com/org/ci/.github/workflows/runward-sign.yml@refs/heads/main",
      "workflowDigests": ["<the commit of that workflow file>"],
      "ref": "refs/heads/main"
    },
    {
      "id": "app-ci-key",
      "kind": "ed25519",
      "repositories": ["github.com/org/private-app"],
      "publicKey": "keys/ci.pem",
      "keyDigest": "sha256:<sha256 of the key's SPKI>",
      "ref": "refs/heads/main",
      "manifestFormat": "dropyour.preuves-ci.v2"
    }
  ]
}
```

A trusted root is a file in Sigstore's `trusted_root.json` format (for the public instance, the
`trusted_root.json` target of its TUF repository; `gh attestation trusted-root` prints the ones GitHub
uses). A cell is raised to `machine-established` only when all of these hold, and otherwise stays
`ci-declared` with the reasons on the page:

1. the signature verifies offline: for a bundle, its transparency log entry (signed entry timestamp,
   inclusion proof, signed checkpoint), its certificate chain to an authority of the trusted root at the
   log's time, and its DSSE envelope; for a key, the Ed25519 signature over the manifest's bytes;
2. its signer is an entry of the policy for this repository (a repository cannot sign for another);
3. that entry pins `refs/heads/main` and, for a certificate, the workflow file digest; an entry that
   does not raises nothing;
4. the signed ref is `refs/heads/main` and the signed commit is the `commit` fleet.json declares;
5. what was signed covers the export's bytes (the statement itself, a subject, or a listed file);
6. the export is not a replay.

A key names its holder, not the workflow that used it: the page says so beside every key-signed cell.

Not verified by this version, and shown as `not-verifiable`, never as a pass: a bundle whose signing
time comes only from an RFC 3161 timestamp (GitHub's instance for private repositories, Rekor v2
entries), and log entries of a kind other than `dsse`.

## verify-run: the identity half of a runward-run Statement (ADR-0120 D4a)

```sh
runward-fleet verify-run code/reports/runward-run.sigstore.json --policy trust-policy.json \
  --repository github.com/org/app --commit <sha> [--ref refs/heads/main] [--statement code/reports/runward-run.intoto.json] [--json]
```

runward reads a runward-run Statement at `check --strict --require attested`: it re-derives the binding
to the tree and counts the signature, and never verifies it. `verify-run` verifies it, offline, against
this trust policy: the bundle as above (log entry, chain, DSSE signature), then the rules of a run
Statement. It refuses, each by name, a Statement signed from the mission's own workflow (the agent can
write that file, whatever the policy pins), by a signer workflow the policy does not pin or pins without
a commit, by the pinned workflow at another commit, for another repository or another commit, and a key
signature under no key the policy pins. On GitHub the mission's commit is the certificate's; for a
pipeline that runs in the signer's own project (the GitLab runner project) or a key, it is the signed
Statement's `mission` claim. A key signer is `"kind": "key"` with `publicKey` (a PEM file: ECDSA P-256 or
P-384, or Ed25519) and its `keyDigest`. Exit 0 accepted, 1 refused, 2 a question it cannot ask. The
specification is [docs/spec/runward-run.md](https://github.com/stranxik/runward/blob/main/docs/spec/runward-run.md) §6.

## Install and run

From the first release that carries it, the release holds `runward-fleet-X.Y.Z.tgz`, packed and
attested by the release workflow's isolated builder, like `runward`. It is not published to npm.
Verify it before you install it:

```sh
gh release download vX.Y.Z --repo stranxik/runward --pattern runward-fleet-X.Y.Z.tgz
gh attestation verify runward-fleet-X.Y.Z.tgz --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/build-and-attest.yml \
  --source-ref refs/tags/vX.Y.Z \
  --deny-self-hosted-runners
npm install --save-dev ./runward-fleet-X.Y.Z.tgz
npx runward-fleet build fleet.json --out site
```

In GitHub Actions, the Action of the repository builds the page and, if asked, publishes it on Pages:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  fleet:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/checkout@<sha>
      - uses: stranxik/runward/fleet@<sha>     # pin by commit
        with:
          manifest: fleet/fleet.json
          pages: "true"
```

## Fonts

The page embeds Inter (latin subset of `@fontsource/inter` 5.1.0, © The Inter Project Authors) and
Departure Mono 1.500 (© Helena Zhang), both under the SIL Open Font License 1.1, whose texts are in
`ui/fonts/`.
