# ADR-0130: A repository identity is a host and a path of two to eight segments, read by one closed grammar for every forge

**Date**: 2026-11-11
**Status**: proposed. It records the first step of a plan the maintainer approved on 2026-11-11 for the hosted
product (outside this repository): accept verdicts sent from GitHub, GitLab (gitlab.com and self-managed) and
Azure DevOps Services. The plan was relayed to the session that wrote this record; the maintainer has not
read this text: it becomes accepted with his approval of the pull request that carries it, or is amended on
his review. Non-constitutional: it changes how `runward-fleet` reads one text field, changes no format, and
amends no accepted record
**Deciders**: the maintainer, by approving the pull request that carries this record; proposed by an agent
session. Under ADR-0088 decision 4 the maintainer is the single accountable person, and the agent's writing
is disclosed throughput, not independent review
**Method**: read on a clone at `main@31e086c`: `packages/runward-fleet` (`src/build.js`, `src/trust.js`,
`src/run-signature.js`, `src/cli.js`, `src/site.js`, `src/rules.js`, `ui/views.js`, `ui/mission.js`,
`ui/documents.js`), `docs/spec/runward-fleet-index.md`, `docs/spec/runward-run.md`, ADR-0093, ADR-0120,
ADR-0121, ADR-0125 to ADR-0128. Every place the identity is read, compared, shown or could reach a URL was
listed by search and read. The former reading (the pattern of `build.js` and `trust.js`, then `normRepo`) is
kept in `test/unit/fleet-repository.test.js` and compared with the new one over a generated corpus. URL
behaviour and the Unicode fold measured with Node.js 24.22.1. The forges' naming rules (GitHub account and
repository names, GitLab namespace and project paths, Azure DevOps clone addresses, case) are stated from
the session's knowledge of them and were not read again from each forge's documentation, nor tried on a
real project: "What would settle it" says what confirms them
**Relates to**: [ADR-0093](ADR-0093-what-runward-shows-is-assembled-from-files-the-cli-writes-a-customer-run-satellite-verifies-a-hosted-product-is-separate.md)
(decision 8: a repository cannot sign for another; decision 10: the build), [ADR-0120](ADR-0120-an-executor-outside-the-cli-runward-run-executes-the-tests-in-a-pinned-container-and-the-operators-ci-signs-what-it-wrote.md)
(`verify-run`, the GitLab runner project), [ADR-0121](ADR-0121-runward-fleet-and-the-hosted-product-one-interface-two-deployments.md)
(one interface, two deployments), [ADR-0127](ADR-0127-mission-documents-are-rendered-by-runward-fleet-from-a-closed-subset-of-markdown-safe-by-construction-and-checked-on-the-way-out-the-register-is-read-from-each-records-header.md)
(a document's `source` and `route`), ADR-0030 (values are only ever added)

## Context

`runward-fleet` read a repository as exactly three segments, `host/owner/repo`, by the pattern
`^[a-z0-9.-]+/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$` in the inventory (`src/build.js`) and in the trust policy
(`src/trust.js`). That is GitHub's shape. A GitLab project in nested groups
(`gitlab.example.com/group/subgroup/project`) and an Azure DevOps repository
(`dev.azure.com/org/project/_git/repo`) were refused, so neither could appear in an inventory, be pinned by
a policy, or be verified by `verify-run`. A hosted deployment builds its inventory with the same module
(ADR-0121): the refusal is the first thing in the way of a second forge.

Reading the same code for the change showed two things the three-segment pattern did not hold:

- it accepted a segment made of dots (`github.com/../app`, `github.com/./app`), a host of dots or hyphens
  (`../a/b`), and a name that is the clone suffix alone (`github.com/org/.git`, read as the two-segment
  `github.com/org`);
- a name carried by a signature was compared after `normRepo`, which lower-cased with Unicode rules and
  without reading the name first. U+212A (the Kelvin sign) lower-cases to `k`: a signed manifest naming
  `github.com/org/<U+212A>app` compared equal to the mission `github.com/org/kapp`. No forge lets a
  repository carry that character, and the signer must already be pinned for the mission, so no wrong raise
  was reachable through a real repository; it is filed as RWD-2026-0211 because equality rested on a fold
  nobody had read.

The identity is a join key and a trust boundary (a repository cannot sign for another), and a deployment
puts it in addresses. It has to be one text per repository, readable back, and safe wherever it lands.

## Decision

1. **One grammar, for every forge, in one module** (`packages/runward-fleet/src/repository.js`). An identity
   is `host/segment/segment…`:
   - the **host** is a DNS name in ASCII: labels of letters, digits and inner hyphens, 63 characters at most
     each and 253 in all, the last label starting with a letter. No scheme, no credentials. Not an
     address (`10.0.0.1`, and `0x7f.1`, which a URL parser rewrites to `127.0.0.1`). Not an
     internationalised label (`xn--`): a look-alike host is refused in both of its spellings;
   - the host **may be followed by a port**, `host:port`: 1 to 65535, in decimal digits, without a leading
     zero (`gitlab.internal:8929/group/project`). A self-managed instance that answers on a port writes it
     in its own addresses and in the claims of its tokens, and it is part of which instance is named: the
     same path on another port, or on none, is another repository. `:443` is the port an https address has
     without saying so and is dropped, so an instance has one spelling. Port 0, a port above 65535, a port
     that is not digits, an empty port and a second colon are refused. (Added on 2026-11-11, in the same
     pull request, when a self-managed witness instance on port 8929 was refused by the first draft.)
   - the **path** holds 2 to 8 segments, each of letters, digits, `_`, `.` and `-`, 255 characters at most.
     No segment is empty, none is made of dots alone. Nothing is decoded, and `%`, `\`, `?`, `#`, `@`, `:`
     and a space are outside the set: an encoded slash or an encoded dot segment has no way in;
   - one `.git` at the end is the forge's clone suffix and is dropped, in any case; a name that still ends
     in `.git` is refused, so a canonical identity never reads back as another;
   - the whole is 512 characters at most, checked first, and read in linear time.
2. **Case: one repository, one spelling.** The canonical form is lower case. DNS is case-insensitive, and
   GitHub, GitLab and Azure DevOps each resolve an owner, a group, a project and a repository without regard
   to case (as this session knows them, see Method); two spellings that differ by case are
   therefore one repository on every forge this record names. The fold is ASCII, applied after the identity
   was read against the grammar, never before: a character that Unicode would fold into a letter is refused,
   not folded.
3. **Two to eight segments.** Two is GitHub (`owner/repo`) and the smallest GitLab project. Azure DevOps
   Services writes four (`org/project/_git/repo`), its former host three (`org.visualstudio.com/project/_git/repo`).
   GitLab nests groups far deeper than that; eight covers a group and six levels of subgroups, a bound
   chosen so an identity stays readable in a table cell and a policy stays reviewable. A ninth segment is
   refused, and the message says so.
4. **The Azure DevOps identity is the clone address's path**, `_git` included: it is what the forge writes,
   it is unambiguous, and no rule about a forge is needed to read it. The grammar knows no forge.
5. **Equality is decided on canonical identities only.** The inventory, the policy and
   `verify-run --repository` are read by the grammar and stop on anything else, with the rule broken in the
   message. A name carried by a signature (a certificate's source repository, a Statement's mission, a
   signed manifest) is read by the same grammar once one `https://` or `http://` in front and the slashes at
   the end are taken off (`foreignRepository`); a name that is not an identity is equal to no repository,
   and is shown as written (`normRepo`, now an ASCII fold, display only) in the reason
   `signed-for-another-repository`. A parent group, a child path, a sibling by prefix are other
   repositories: equality is of the whole text.
6. **An address is the identity, unencoded.** `repositoryUrl(id)` is `https://` followed by the canonical
   identity, or null. Every character of the grammar is unreserved (RFC 3986) and no segment is a dot
   segment, so a URL parser reads back this host, this port and this path and nothing else; the test holds that
   property for every accepted identity. `repositoryParts(id)` gives the host and the segments to a caller
   that needs them apart. Both are exported from `runward-fleet/trust` for a deployment's `source` function
   (ADR-0127).
7. **`runward-fleet-index/0` does not change.** `missions[].repository` and `policy.signers[].repositories[]`
   stay one text each, in the canonical form. No field is added: a structured form would be a second
   spelling of the same thing to keep equal. A three-segment identity reads as it did, byte for byte, so
   an index, an inventory and a policy written before this record are unchanged and the golden files are
   not regenerated.

### What changed for a three-segment identity

Nothing, for a name a forge can carry. Compared over 4,860 identities the former pattern accepted (fifteen
hosts, eighteen owner and repository names of every shape): those built from a well-formed host and names
read the same. What the former pattern accepted and is now refused: a dot segment, a host that is not a DNS
name (`..`, `-x.com`, `a..b`), a host that is an address or an internationalised label, the clone suffix
alone, a name ending in `.git.git`. One reading moved: `App.GIT` reads `app` where it read `app.git`.

## Where the identity is used (searched at `main@31e086c`)

| Place | What it does with the identity | After this record |
|---|---|---|
| `src/build.js`, the inventory | validates, then writes it to the index | the grammar; the canonical form |
| `src/trust.js`, the policy | validates `repositories[]`, compares a signature's name | the grammar; canonical equality |
| `src/run-signature.js`, `src/cli.js` | `verify-run`: the expected, the signed and the signer's repository | the grammar; canonical equality |
| `ui/views.js`, the signatures view | shows the pinned repositories and a signature's identity, escaped | unchanged; held by a test on GitLab and Azure DevOps identities |
| `src/site.js`, `src/rules.js` | build every view and check the page | unchanged; the page of such a fleet passes its rules |
| `ui/views.js` (the decision reading), `ui/mission.js` (the projections) | do not read the identity: they join on the mission `id` | unchanged |
| `ui/documents.js` | never sees the identity: the deployment's `source(path)` and `route(path)` do | `repositoryUrl` for `source`; see below |

## Alternatives discarded

- **Widen the pattern to `(/segment)+`.** It keeps the dot segments and the Unicode fold, and leaves two
  copies of the rule. Rejected: the reason to touch the line is that it is a trust boundary.
- **A structured identity in the index (`{ forge, host, path[] }`).** A new field every reader must keep
  equal to the text, and a `forge` value the build cannot observe (it reads no network, ADR-0093). Rejected
  as larger than the need: the text is already unambiguous. If a consumer needs the forge kind, it is an
  additive field for a later record, declared in the inventory.
- **Case-sensitive identities.** Then `Org/App` and `org/app`, one repository on every forge named here,
  are two missions, and a policy pinned in one case does not match a certificate in the other. Rejected.
- **Percent-decoding, to admit an Azure DevOps name with a space.** Decoding is where a second slash or a
  dot segment comes back. Rejected; the limit is stated below.
- **Dropping `_git` from Azure DevOps identities.** It needs a rule per forge and makes the identity differ
  from the address. Rejected.
- **A higher bound (as deep as GitLab nests groups).** Nothing asks for it today; a bound that is never reached
  holds nothing. Eight can be raised by a dated amendment.

## Consequences

- A GitLab project in nested groups and an Azure DevOps Services repository can be declared, pinned,
  verified and shown. The hosted product re-pins the package to get it (its own record).
- Refused, and said so in the message: an identity with a dot or empty segment, an encoded character, a
  ninth segment, a non-ASCII character, a port outside 1 to 65535, an address or an internationalised label.
- **Not representable**: an Azure DevOps project or repository whose name holds a space or another character
  outside the set (Azure DevOps allows them; its address then carries `%20`); an internationalised host. Each
  is refused, never approximated.
- `repositoryUrl` writes `https://` whatever the instance serves: an instance reached in clear on its port
  is the deployment's to know, the identity names no scheme.
- **Documents on Azure DevOps**: `ui/documents.js` (rule D3) keeps a forge address only when it ends with
  the path asked. Azure DevOps addresses a file in the query (`?path=/…`), so a relative link of a document
  of such a mission is shown as text, not as a link to the forge. Unchanged here: widening D3 is a change to
  a rule held by an attack corpus and belongs to its own record. A link to a route of the application
  (`route`) is unaffected.
- The Ed25519 signed-manifest format read today (`dropyour.preuves-ci.v2`) names `owner/repo` on
  `github.com`: a second forge signs by Sigstore or by a `key` signer, both read here.
- `normRepo` stays exported, for display; nothing compares its result.
- This record does not decide how a hosted deployment authenticates a forge, or which level of proof a
  forge's token supports: that is the hosted product's.

## What would settle it

- A first real GitLab project in nested groups and a first real Azure DevOps repository built into an index
  by a hosted deployment, with the identity its forge's token names equal to the declared one.
- An Azure DevOps project with a space in its name asked for by a user: then either an escape form with its
  own planted controls, or the answer that the identity is the repository's stable id and the path a label.
- A project deeper than eight segments asked for by a user.
- The self-managed witness on its port built into an index with the identity its token names.
- A forge named here shown to tell two repositories apart by case alone: decision 2 is then wrong for it.

## Reevaluation trigger (mandatory, dated)

Reopen on 2026-12-11, or earlier when: a forge named here stops resolving paths without regard to case; a
user's repository is refused by the grammar (a space, a ninth segment, an internationalised host); a
fourth forge is added whose addresses do not fit a host and a path; `runward-fleet-index/0` changes in a
non-additive way.

**Trigger set on**: 2026-11-11 · **Watched via**: `test/unit/fleet-repository.test.js` (the planted controls
and the comparison with the former reading), a refusal reported by a user

## References

- [docs/spec/runward-fleet-index.md](../spec/runward-fleet-index.md) §1.1, [docs/spec/runward-run.md](../spec/runward-run.md) §6.
- RFC 3986 (unreserved characters, dot segments), RFC 1035 and RFC 5891 (labels, A-labels), the URL Living
  Standard (host parsing: a last label that is a number makes an address).
- Unicode `SpecialCasing` and `UnicodeData`: U+212A KELVIN SIGN lower-cases to U+006B.
- [known-defects.md](../compliance/known-defects.md), RWD-2026-0211.
