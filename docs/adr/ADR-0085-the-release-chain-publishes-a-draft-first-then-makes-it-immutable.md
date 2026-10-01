# ADR-0085 — The release chain publishes a draft first, then makes it immutable

**Date**: 2026-10-01
**Status**: accepted (2026-10-01) — the maintainer chose the recommended chain, with the prepare phase started by a tag push, and the ratchet summary committed under `docs/compliance/ratchet-summaries/`; the setting is enabled only after one release has run on the new chain
**Deciders**: the maintainer
**Method**: `.github/workflows/release.yml`, `build-and-attest.yml`, `verify-release.yml` and
`mutation-ratchet.yml`, `docs/verifying-a-release.md`, `runward/runbook.md` §3, ADR-0048, ADR-0049,
ADR-0079 and `ROADMAP.md` ("Immutable releases") read on the branch of this ADR (base `main` after
0.42.3); GitHub's and npm's documentation and the `gh` manual read at the source on 2026-10-01 and
quoted below; the repository setting read through the API on 2026-09-30 and again on 2026-10-01
**Relates to**: [ADR-0048](ADR-0048-the-release-carries-verifiable-proof.md) (the release carries
its proof as assets), [ADR-0049](ADR-0049-the-build-is-isolated-from-the-publish.md) (the isolated
builder and the determinism cross-check), [ADR-0079](ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md)
(the signed ratchet summary), [ADR-0065](ADR-0065-the-gate-can-be-armed-only-by-the-operators-hand.md)
(what an agent may prepare, only the operator's hand completes)

## Context

**The chain as it stands.** The maintainer creates a published release (`gh release create vX.Y.Z
--target main`, runbook §3 step 4). `release.yml` runs on `release: types: [published]`: the isolated
builder packs and attests the tarball, an unprivileged job writes the SBOM, and the `publish` job
cross-checks the builder's tarball against its own pack, attests the SBOM, runs `npm publish
"$TARBALL" --provenance --access public`, and only then attaches the tarball, the two `.intoto.jsonl`
bundles and the SBOM with `gh release upload ... --clobber`. The same `published` event starts
`mutation-ratchet.yml`, whose `summary` job signs `ratchet-summary-X.Y.Z.json` hours later and keeps it
as a workflow artifact for 90 days; ADR-0079 and runbook step 4 say the maintainer may then attach it to
the release by hand. `verify-release.yml` runs on `workflow_run` of the Release workflow and replays the
reader's verification against the published assets.

**The setting.** `gh api repos/stranxik/runward/immutable-releases` returned `{"enabled":false}` on
2026-09-30 and `{"enabled":false,"enforced_by_owner":false}` on 2026-10-01.

**What GitHub documents, read at the source on 2026-10-01.**

1. *What immutability locks.* *Immutable releases*
   (docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases):
   "**Immutable releases** are releases where the assets and associated Git tag cannot be changed after
   publication." "Once an immutable release is published, its associated Git tag is locked to a
   specific commit, cannot be changed, and cannot be deleted while the release exists. If you delete the
   immutable release, you can delete the tag, but you cannot reuse the same tag name." "All files
   attached to the release (such as binaries and archives) are protected from modification or
   deletion." "Only the assets and tag are locked. You can still edit the title and release notes of a
   published immutable release, and change whether it is marked as a pre-release or as the latest
   release." "creating an immutable release automatically generates a **release attestation**, which is
   a cryptographically verifiable record of a release containing the release tag, commit SHA, and
   release assets."
2. *From when.* The same page recommends: "1. Create the release as a draft. 2. Attach all associated
   assets to the draft release. 3. Publish the draft release. This ensures that all assets are in place
   before the release becomes immutable". The `gh release create` manual (cli.github.com/manual/gh_release_create):
   "Immutability is enforced only after a release is published. Draft releases can be modified or
   deleted, and the associated git tags can be modified or deleted as well."
3. *Existing releases.* *Preventing changes to your releases*: "select **Enable release
   immutability**. Be aware that immutability will only apply to future releases." Every release up to
   the one after enablement stays mutable.
4. *Uploading to a draft.* The immutable-releases page (point 2) and *Managing releases in a
   repository* ("If you have enabled immutable releases for the repository, creating a draft first
   allows you to attach all assets before the release becomes immutable") both describe attaching
   assets to a draft. Whether a NEW file can be added to a published immutable release is not stated in
   those words; the docs state that attached files cannot be modified or deleted, which already rules
   out the `--clobber` replace the current step relies on. The chain designed here does not depend on
   the answer either way.
5. *Which events fire for a draft.* *Events that trigger workflows*, `release`: "Workflows are not
   triggered for the `created`, `edited`, or `deleted` activity types for draft releases." And: "The
   `prereleased` type will not trigger for pre-releases published from draft releases, but the
   `published` type will trigger." A draft starts no workflow; publishing it fires `published`.
6. *Who may publish without losing the event.* *GITHUB_TOKEN*
   (docs.github.com/en/actions/concepts/security/github_token): "events triggered by the
   `GITHUB_TOKEN` will not create a new workflow run, with the following exceptions: `workflow_dispatch`
   and `repository_dispatch` events always create workflow runs." A job that publishes the draft with
   its own token fires no `published` run: not the ratchet, not anything else listening.
7. *Where a draft's tag comes from.* REST *Create a release*, `target_commitish`: "Specifies the
   commitish value that determines where the Git tag is created from. Can be any branch or commit SHA.
   Unused if the Git tag already exists." The `gh` manual: "Use --verify-tag to abort the release if the
   tag doesn't already exist."
8. *npm trusted publishing.* docs.npmjs.com/trusted-publishers, for GitHub Actions: "Workflow filename
   (required): The filename of your workflow (e.g., publish.yml)". The trust names `release.yml`, not an
   event; and "Some GitHub Actions workflows use `workflow_call` to invoke other workflows that run `npm
   publish`, or use `workflow_dispatch` for manual publishing. When this happens, validation checks the
   calling workflow's name instead of the workflow that actually contains the publish command". Keeping
   `npm publish` in `release.yml` keeps the configuration on npmjs.com unchanged.

**What breaks if the setting is turned on today.** In `release.yml`, `npm publish` runs before `gh
release upload`. On an immutable release the version would reach npm and the release would keep
whatever it holds at publication (nothing), with no way to replace an asset afterwards (point 1). The
ratchet summary could not be attached later the way ADR-0079 allows. And `verify-release.yml` would
fail on missing assets for a release that cannot be repaired.

## Decision

**Recommended chain: the workflow prepares a draft, the maintainer publishes it, npm receives the
immutable asset.** Two phases in `release.yml`, one irreversible gesture, and it is human.

1. **Pin the commit first.** The maintainer creates an annotated tag `vX.Y.Z` on the release merge
   commit and pushes it. The tag is what every later step reads; nothing derives the commit from `main`
   at a later time.
2. **Prepare (trigger: `push` of a `v*` tag, plus `workflow_dispatch` on a tag ref for a re-run).**
   The isolated builder, the SBOM job and the cross-check run exactly as today (ADR-0049 unchanged). The
   SBOM attestation stays in a job holding `id-token: write` and `attestations: write` and no
   `contents: write`. A separate `draft` job holding only `contents: write` runs `gh release create
   "$TAG" --draft --verify-tag` and uploads the tarball, both `.intoto.jsonl` bundles and the SBOM to
   the draft. **No `npm publish` in this phase.** A failure here leaves a draft that can be deleted or
   re-run with `--clobber`, because a draft is mutable (Context, 2).
3. **Look, then publish (the maintainer).** The maintainer opens the draft, checks the four assets
   (the commands of `docs/verifying-a-release.md` Steps 2 and 3 run on downloaded draft assets, which a
   user with push access can list), writes the notes, and publishes from their own session (`gh release
   edit vX.Y.Z --draft=false` or the web page). Because the gesture is not the `GITHUB_TOKEN`, it fires
   `release: published` (Context, 5 and 6). From that moment the tag and the assets are locked.
4. **Publish to npm (trigger: `release: published`).** A `publish` job holding `contents: read` and
   `id-token: write` downloads the tarball **from the release**, verifies it before anything else
   (`gh attestation verify --signer-workflow .../build-and-attest.yml`; the tag's commit equals the
   commit the provenance names; once the setting is on, `gh release verify "$TAG"`), then runs `npm
   publish "$TARBALL" --provenance --access public`. What npm serves is then the byte-identical file the
   immutable release holds, checked against its signature, not a second pack.
5. **The mutation ratchet is unchanged.** It still runs on `release: published`, which the maintainer's
   gesture fires. Its `summary` job keeps its condition (`github.event_name == 'release'`).
6. **`verify-release.yml` verifies the publish run only.** It gains the condition
   `github.event.workflow_run.event == 'release'` (a prepare run must not be verified: npm does not have
   the version yet), and, once the setting is on, two steps: `gh release verify "$TAG"` and `gh release
   verify-asset "$TAG" runward-X.Y.Z.tgz`, documented on GitHub's *Verifying the integrity of a release*
   page.
7. **Where the ratchet summary lives.** It is signed hours after publication and can no longer be
   attached to an immutable release. Its proof never was the attachment: it is the attestation in
   GitHub's attestation store, which `gh attestation verify ... --signer-workflow
   .../mutation-ratchet.yml` reads by the file's digest. The file itself (a few kilobytes) is committed
   by the maintainer, in the next release pull request, under `docs/compliance/ratchet-summaries/`, and
   the release notes (still editable, Context, 1) carry its SHA-256 and path. ADR-0079 refused a
   committed ledger because a line in the repository is self-declared; that objection does not reach a
   committed file that must still verify against a signature only the ratchet workflow can produce.
   This replaces one sentence of ADR-0079's decision ("may be attached to the release by the
   maintainer's hand") and the matching sentence of runbook step 4 and of `docs/verifying-a-release.md`
   Step 6; the rest of ADR-0079 stands.

**Migration order.**

1. Decide this ADR.
2. One pull request changes `release.yml` (two phases), `verify-release.yml` (condition and steps),
   runbook §3 step 4, `docs/verifying-a-release.md` (Step 6 sentence; a step for `gh release verify`
   marked "from the first immutable release"), and adds the `ratchet-summaries/` directory.
3. Cut **one release on the new chain with the setting still off.** It exercises the draft, the
   maintainer's gesture, the `published` event, npm, the ratchet and `verify-release`; if any link
   fails, the release can still be repaired the old way, because nothing is locked.
4. Enable the setting (an administrator's act, the maintainer's) and read it back with `gh api
   repos/stranxik/runward/immutable-releases`, expecting `"enabled":true`. That read-back joins the
   three settings of runbook §3 step 2.
5. The next release is the first immutable one: `gh release verify vX.Y.Z` must report it, and
   `docs/verifying-a-release.md` and `ROADMAP.md` say so from that version on, never before.

**What immutability shows, and what it does not.** It shows that, after publication, the tag still
points at the commit it pointed at and every attached file is the file that was attached: no
collaborator, stolen token or workflow can swap them silently, and a deleted release burns its tag
name. It shows nothing about what was attached: whether the tarball is sound is still the attestations'
and the cross-check's question (ADR-0048, ADR-0049). It does not cover the draft window, the release
notes or the title, the npm registry (a separate store with its own rules), or any release published
before the setting was enabled. A compromised maintainer account can still publish a bad release, which
then stays bad, visibly. Immutability preserves; it does not judge.

## Alternatives discarded

- **One dispatched run does everything, publication included.** `workflow_dispatch`, the job builds,
  drafts, uploads, publishes npm and publishes the release. One gesture, but the publication comes from
  the `GITHUB_TOKEN`, so `release: published` starts nothing (Context, 6): the ratchet would have to
  move to `workflow_run` or be dispatched by the release job (`actions: write`), and the summary's
  condition would change with it. npm would be published before the release becomes immutable, so a
  failure between the two leaves npm ahead of GitHub. And the one irreversible act would run with no
  person looking at the draft. Cost: the largest change of the options. Risk: a workflow holding
  `contents: write` publishes something nobody can take back.
- **The maintainer creates the draft by hand, then dispatches the build.** Same end state as the
  recommendation with three gestures instead of two (draft, dispatch, publish), because creating a draft
  fires no workflow (Context, 5). Kept as the fallback if the tag-push trigger is judged too easy to fire
  by accident; an accidental tag push only produces a draft, which is why it is not preferred.
- **Enable the setting now and keep the chain.** Breaks the next release in the worst order: npm
  published, the GitHub release locked without its assets (Context, "What breaks").
- **Keep releases mutable.** Costs nothing, and the 2026-08-11 retroactive attachment to v0.32.0 through
  v0.33.2 (`docs/verifying-a-release.md`) shows mutability was once used for a legitimate repair. It
  leaves every asset and tag of every release replaceable by anyone holding write access or a token
  with `contents: write`, which today includes the `publish` job itself. Default until this ADR is
  decided.
- **Publish npm in the prepare phase, before the release is public.** The tarball would reach npm while
  the GitHub release is still a draft that may never be published, so the two stores could disagree
  for good; and the npm publish would read the builder's artifact rather than the locked asset.

## Consequences

- **Positive.** The only irreversible gesture of a release is the maintainer's, made after they have seen
  the assets. npm serves the file the immutable release holds, verified against its signature before
  publication. The job that writes to the release no longer holds `id-token: write`, and the job that
  holds `id-token: write` no longer writes to the release, a narrower split than today's `publish` job,
  which holds both. A failed preparation is repairable; a failed npm publish is re-run from the locked
  asset without touching the release.
- **Negative, accepted.** One more gesture per release (publish the draft). The ratchet and the npm
  publish depend on that gesture coming from a person's token: a future automation that publishes with
  the `GITHUB_TOKEN` would silently start neither, and no `verify-release` run would follow to say so.
  The runbook names the gesture; the reevaluation trigger watches for it. Releases up to the first
  immutable one stay mutable forever. The ratchet summary file moves into the repository, a few
  kilobytes per release.
- **On other boundaries.** The CLI, the gate, the npm package's content and the mission are untouched;
  this concerns how runward's own releases are produced. ADR-0079 keeps its decision except the one
  sentence on where the summary file lives.

## What would settle it

- **Ratify the chain** when one release cut on it with the setting off shows, in its runs: a draft
  created by the prepare run with four assets; a `release: published` run started by the maintainer's
  gesture; `npm publish` from the release's own tarball, `verify-release` green on that run only; the
  ratchet started by the same event with its summary signed.
- **Ratify the setting** when the following release reports immutable under `gh release verify`, and an
  attempt to delete one of its assets (`gh release delete-asset`) is refused; the refusal's text is
  recorded here.
- **Reverse to the fallback** (maintainer-created draft) if a tag push ever starts a prepare run nobody
  meant; **reverse the whole decision** if GitHub's documentation stops describing assets attached to a
  draft as kept at publication, or if `published` stops firing for a draft published by a person.
- **Settle point 4 of the Context by measurement, not by reading**: whether adding a new file to a
  published immutable release is refused. The chain does not need the answer; the documentation of what
  immutability covers does.

## Reevaluation trigger (mandatory, dated)

Reopen when GitHub changes what immutability locks, which release events fire for drafts, or the
`GITHUB_TOKEN` exception list; when npm changes how a trusted publisher is matched (the workflow
filename today); when a release is published by anything other than a person's session; or when a
prepare run starts without a tag the maintainer pushed.

**Trigger set on**: 2026-10-01 · **Watched via**: the GitHub changelog and the four pages quoted above,
read at each release's runbook step 2; the actor of each `release: published` run in the Actions history.

## References

- `.github/workflows/release.yml`, `build-and-attest.yml`, `verify-release.yml`,
  `mutation-ratchet.yml`; `docs/verifying-a-release.md`; `runward/runbook.md` §3; `ROADMAP.md`
  ("Immutable releases").
- GitHub Docs, read 2026-10-01: *Immutable releases*; *Preventing changes to your releases*; *Managing
  releases in a repository*; *Verifying the integrity of a release*; *Events that trigger workflows*
  (`release`); *GITHUB_TOKEN*; *REST API endpoints for releases* (`target_commitish`).
- `gh release create` manual, cli.github.com/manual/gh_release_create, read 2026-10-01 (gh 2.100.0).
- npm Docs, *Trusted publishing for npm packages*, docs.npmjs.com/trusted-publishers, read 2026-10-01.
