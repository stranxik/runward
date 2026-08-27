# Interop: signing, depositing, and consuming a runward verdict

runward emits files and runs nothing (ADR-0054). Everything on this page is therefore a recipe
**you** run, with tools **you** already have: runward produces the artifact, your cosign signs it,
your store keeps it, your policy engine acts on it. Nothing here calls a network, holds a key, or
needs an account — on runward's side.

The line this page draws, and the reason it exists: runward is the **construction gate** (a verdict
about a working tree, before the merge, re-derivable months later on the repo alone). Kosli, JFrog
AppTrust, Chainloop and the SLSA toolchain are the **release/custody layer** (a verdict about a
published artifact, its provenance and its promotion). They are different stages, and this page is
how a runward verdict enters theirs.

## What runward emits

| Command | Artifact | Consumed by |
|---|---|---|
| `check --attest` | in-toto Statement, predicate `https://runward.dev/verdict/v1` | `runward verify`, and anything that reads in-toto |
| `check --vsa --resource-uri <uri>` | in-toto Statement, predicate `https://slsa.dev/verification_summary/v1` | any SLSA-aware verifier — **no runward vocabulary required** |
| `check --sarif` | SARIF 2.1.0 log | your forge's code-scanning surface (PR annotations) |
| `bundle <artifacts…>` | in-toto Statement, predicate `https://runward.dev/bundle/v1` | `runward verify`, cosign, any in-toto tool |
| `compliance <regime>` | OSCAL component-definition + readiness draft | your GRC tool, your assessor |

All of them are **unsigned**, by decision: signing is an operator gesture under an operator key, and
runward custodies none (ADR-0021, ADR-0055).

## 1. Sign a verdict, with your key

```sh
runward check --strict --attest > verdict.intoto.json

# Keyless (OIDC), the usual CI shape:
cosign attest-blob \
  --predicate verdict.intoto.json \
  --type https://runward.dev/verdict/v1 \
  --yes --output-attestation verdict.dsse.json \
  <the artifact this verdict is about>
```

`runward verify` reads the DSSE envelope back: it **decodes the payload and re-derives the verdict**,
and reports the signature as *present and not verified* — it anchors no trust root, so verifying the
signature is `cosign verify-blob-attestation`, not runward. Two tools, two claims, neither borrowing
the other's authority.

## 2. Deposit it where your evidence lives

The envelope is an ordinary in-toto attestation, so every store takes it as-is:

```sh
# Archivista (in-toto's own store)
archivistactl store --archivista-server <url> verdict.dsse.json

# OCI registry, beside the image it is about
cosign attach attestation --attestation verdict.dsse.json <image-ref>

# Chainloop
chainloop attestation add --value verdict.dsse.json
```

## 3. Push the verdict into a release gate

This is the empilement made concrete: the release layer already accepts external evidence, so a
runward verdict becomes one input among the others its gate evaluates.

```sh
# Kosli — the verdict as generic evidence on the artifact's trail
kosli attest generic \
  --name runward-gate --flow <flow> --trail <trail> \
  --attachments verdict.dsse.json \
  --compliant=true   # from runward's exit code, never asserted by hand

# JFrog Evidence — external evidence attached to the package version
jf evd create --package-name <pkg> --package-version <v> \
  --predicate verdict.intoto.json \
  --predicate-type https://runward.dev/verdict/v1
```

The `--compliant` value comes from runward's exit code (`0` clean, `1` gaps, `2` misuse), never from
a human retyping a verdict they did not re-derive. That is the whole point of the port contract.

## 4. Admit or refuse a deployment on it

For a policy engine, prefer the **VSA**: it is a neutral predicate, so your admission policy needs to
learn nothing about runward.

```sh
runward check --strict --vsa --resource-uri pkg:npm/acme-service@1.2.3 > vsa.intoto.json
```

```json
{
  "verifier": { "id": "https://runward.dev", "version": { "runward": "0.35.0" } },
  "timeVerified": "2026-08-17T12:00:00Z",
  "resourceUri": "pkg:npm/acme-service@1.2.3",
  "policy": { "uri": "https://runward.dev/docs/concepts/the-gate/" },
  "verificationResult": "PASSED",
  "verifiedLevels": ["RUNWARD_GATE_STRICT"]
}
```

A **reference policy ships with runward**: [`examples/kyverno/require-runward-verdict.yaml`](../examples/kyverno/require-runward-verdict.yaml)
(ADR-0055 layer 6), verified against the Kyverno `verifyImages` documentation of August 2026. It pins
four things, and each one is there because dropping it breaks something specific:

| Condition | Why it cannot be dropped |
|---|---|
| `verifier.id == https://runward.dev` | the VSA format is public: without this, a VSA from **any** verifier satisfies the policy |
| `verificationResult == PASSED` | the verdict itself |
| `verifiedLevels` **AnyIn** your accepted list | the check most easily forgotten, and the one that matters — see below |
| `policy.uri` | cheap, and it survives a runward that one day publishes more than one policy |

**The level is not a detail.** `RUNWARD_GATE_PRESENCE` is a weaker statement than
`RUNWARD_GATE_STRICT` (the deliverables are present, their rule-conformance manifests unverified),
and `RUNWARD_GATE_STRICT_THROUGH_<PHASE>` is a **declared prefix** of the delivery arc — a
construction signal, never a finished mission (ADR-0053). A policy that checks only
`verificationResult == PASSED` **admits a prefix verdict as a completion**. That is precisely why the
horizon travels inside the level: so one line of your policy can catch it.

The signature is verified by Kyverno against **your** identity (keyless subject *and* issuer, both
pinned — an unpinned issuer admits anyone that provider will sign for). That is the half runward
refuses to claim: `runward verify` reports a signature as present and *not verified*, because it
anchors no trust root. Read the level, not just the result: `RUNWARD_GATE_PRESENCE` is a
weaker statement than `RUNWARD_GATE_STRICT`, and `RUNWARD_GATE_STRICT_THROUGH_FLOOR` is a **declared
prefix of the arc, not a finished mission** (ADR-0053). The horizon is in the level precisely so a
policy cannot lose it.

### Two things the VSA does NOT say

- **It claims no SLSA level.** `verifiedLevels` carries a custom value and never an `SLSA_` one,
  because runward evaluates no build pipeline. A VSA saying `SLSA_BUILD_LEVEL_3` because a delivery
  gate is green would be a claim about machinery runward never looked at. (The SLSA spec allows
  custom values explicitly, and forbids custom values starting with `SLSA_` — this is that rule,
  honoured.)
- **It does not judge your code.** `PASSED` means the delivery record holds: the decisions were
  traced, the evidence resolves, the shapes match. `GATE_NON_SCOPE` applies to this envelope exactly
  as it applies to the terminal output.

### Reproducibility, stated

Three runward emissions carry a clock and are therefore not byte-idempotent across days: the **VSA**
(its spec requires a `timeVerified` reading), the **evidence lock** (`sealedAt`), and the **OSCAL
pack** (`metadata.last-modified`). Everything else — `--json`, `--sarif`, the in-toto verdict
statement, the bundle statement — is byte-identical on an unchanged tree.

Set `SOURCE_DATE_EPOCH` and all three are byte-identical again: the operator owns the clock, the
reproducible-builds convention. `RUNWARD_NOW` (a `YYYY-MM-DD` date) overrides it per run and wins
where both are set. Both are honoured only in non-interactive runs.

This paragraph used to say the VSA was *the one* emission that was not byte-idempotent, and that
`SOURCE_DATE_EPOCH` restored it. Measured 2026-08-26: the set was larger by two, and the variable
reached only the VSA — the lock and the pack ignored it and were pinned by `RUNWARD_NOW`, which this
document never named (RWD-2026-0069). The convention now reaches every clock runward writes.

The verdict itself is unaffected either way: the timestamp is in the envelope, never in what was
verified.

`--resource-uri` is required and has no default. runward reads a working tree and knows nothing about
where you publish it (no registry, no remote, no network), so guessing a name would put an
unverifiable claim into an attestation your policy engine acts on.

## 5. Re-check, months later, on the repo alone

```sh
runward verify verdict.intoto.json     # or verdict.dsse.json
```

Re-derives the mission-state digest and the verdict from the current tree: a drifted tree and a
tampered predicate both fail, loud. No network, no trust root, no second tree. If the attestation was
produced by an older runward, the version skew is named, so an evolved verdict is never mistaken for
a forgery.

## What is deliberately absent

runward does not publish, upload, fetch, aggregate, or watch. There is no `runward push`, no fleet
view, no hosted store — those are the operator's runtime, on the operator's side of the seam
(ADR-0054), and the org-scale half of them is a separate brick that stays unbuilt until a real fleet
demands it ([corpus-authority-brick.md](corpus-authority-brick.md), ADR-0039).
