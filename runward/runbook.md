# Runbook: runward

**Version**: v0.43.1 · **Last review**: 2026-10-01 · **Owner**: Thibault Souris (maintainer)

This runbook is written for the next maintainer: how to build, test, release, debug a red gate, and evolve the rule set — using nothing but this repository.

## 1. Build and test

- **Prerequisites**: Node ≥ 20, npm. No required environment variable, no service, no key: the project runs fully offline.
- **Build**: `npm ci && npm run build` (plain `tsc` into `dist/`).
- **Test**: `npm test` — builds, then runs the unit suites (`node --test test/unit/`), the smoke suite (`test/smoke.js`), the schema validations (OSCAL, in-toto, SARIF shape), the spelling-conformance check and the corpus audit. CI runs the smoke, schema and self-gate legs with the network cut (`core-offline` job); the unit suites are not run offline in CI.
- **Lint**: `npm run lint`, the architecture boundary (`src/lib/**` may not import a command), refused by the linter in CI.
- **Committed reports**: `npm run test:junit`, `npm run test:eslint` and `npm run test:security` regenerate the reports the manifests cite (`reports/`); `npm run test:reports` proves they still describe the tree, and CI refuses a stale one (RWD-2026-0113).
- **Self-gate**: `node dist/cli.js check --strict` at the repo root must exit 0 — the repository carries its own mission (this directory) and the product passes its own gate. Treat a red self-gate like a failing test.

## 2. Dependencies and degraded modes

| Dependency | Role | Criticality | Behavior on failure |
|---|---|---|---|
| commander / chalk / inquirer | CLI parsing, color, prompts | required at runtime | none degrade at runtime; a supply-chain concern, not an availability one — see the threat model |
| GitHub Actions | CI, release publishing | critical for releasing, irrelevant for users | releases wait; installed CLIs are unaffected (no phone-home to fail) |
| npm registry | distribution | critical for installs only | existing installs keep working forever — the CLI has no online dependency |

There is no model provider, no database and no service to fail over: a gate run needs the local filesystem and nothing else.

## 3. Release

1. Ensure main is green (every workflow, not only CI) and the self-gate passes.
2. Read back the three security settings `SECURITY.md` and the threat model rely on (RWD-2026-0163):
   ```
   gh api repos/stranxik/runward/private-vulnerability-reporting          # expect {"enabled":true}
   gh api repos/stranxik/runward/vulnerability-alerts -i | head -1         # expect HTTP/2.0 204 (404 = alerts off)
   gh api repos/stranxik/runward/automated-security-fixes                 # expect {"enabled":true,"paused":false}
   ```
   After enablement only (product ADR-0085, migration step 4; the setting is not enabled yet), a fourth read-back joins them:
   ```
   gh api repos/stranxik/runward/immutable-releases                       # after enablement: expect "enabled":true
   ```
   GitHub's REST documentation requires admin access to the repository for all three (admin read access for the fourth). A workflow's `GITHUB_TOKEN` has no administration scope, and the repository keeps no Actions secret (`gh api repos/stranxik/runward/actions/secrets` reports 0), so no CI job can run this: it is a manual step, and nothing checks the settings between releases. Any other answer blocks the release until the setting is restored or the documents are corrected.
3. On a release branch: bump the version in `package.json` and the lockfile, in every packaging manifest that carries it (`.claude-plugin/`, `plugins/`, `packaging/`; `git grep` the old version), and in the stamps that name it (ROADMAP, known-defects header, `CITATION.cff`); move the `Unreleased` entries of `CHANGELOG.md` under the version and leave the `## Unreleased` heading in place, empty (the mission's journal row cites it); regenerate the committed reports (§1) and the delivery report (`node dist/cli.js report`). Merge through a pull request.
4. Release in two phases (product ADR-0085). The workflow prepares a draft; the maintainer publishes it; npm receives the file the release holds.
   1. **Pin the commit.** On `main`, at the release merge commit: `git tag -a vX.Y.Z -m "vX.Y.Z" <merge-commit>` then `git push origin vX.Y.Z`. The tag must name the version in `package.json`, or the prepare run refuses.
   2. **Wait for the draft.** The tag push starts `.github/workflows/release.yml` (prepare phase): isolated build and provenance, SBOM, cross-check, SBOM attestation, then the qualification kit (built, rebuilt byte for byte, run against the tarball, attested; ADR-0087), then a draft release `vX.Y.Z` holding six assets (`runward-X.Y.Z.tgz`, `runward-X.Y.Z.intoto.jsonl`, `runward-X.Y.Z.provenance.intoto.jsonl`, `runward-sbom.cdx.json`, `runward-qualification-kit-X.Y.Z.tgz`, `runward-qualification-kit-X.Y.Z.provenance.intoto.jsonl`). Nothing is published to npm in this phase. A failed preparation is repaired on the draft, which is mutable: delete the draft, or re-run the phase with `gh workflow run release.yml --ref vX.Y.Z` (the upload replaces the draft's assets).
   3. **Check the six assets.** Download them from the draft (`gh release download vX.Y.Z --dir draft-check`; a draft is visible to an account with push access) and run `docs/verifying-a-release.md` Steps 2 and 3 on them (Step 2c included), and Step 8 on the kit. Any failure stops the release here.
   4. **Write the notes**, then **publish the draft from your own session**: `gh release edit vX.Y.Z --draft=false`, or the release page. This is the one irreversible gesture of a release, and it stays the maintainer's (declared, not proved, while agent sessions can reach the maintainer's credential; product ADR-0088, stage 1): a release published with a workflow's `GITHUB_TOKEN` fires no `release: published` run, so neither the npm publish nor the mutation ratchet would start, and no verification would follow to say so. **Never publish the release with a workflow token.**
   5. **The publish phase runs by itself** on `release: published`: `release.yml` downloads the tarball from the release, verifies it against the isolated builder's signature and the tag's commit, then runs `npm publish --provenance --access public` using OIDC. **No maintainer machine ever publishes**; if the npm publish fails, re-run that failed job (the release is not touched) rather than publishing locally, or the provenance chain breaks. The same event starts the full mutation ratchet (`mutation-ratchet.yml`), whose signed summary is kept as a workflow artifact for 90 days.
   6. **Keep the ratchet summary.** Once the ratchet's `summary` job has finished, download `ratchet-summary-X.Y.Z.json` (artifact `ratchet-summary` of that run), verify it with `gh attestation verify ratchet-summary-X.Y.Z.json --repo stranxik/runward --signer-workflow stranxik/runward/.github/workflows/mutation-ratchet.yml`, commit it unchanged in the next release pull request under `docs/compliance/ratchet-summaries/`, and add its SHA-256 and path to the release notes (notes stay editable on an immutable release). Its proof is the attestation, not the commit (product ADR-0079, ADR-0085).
5. Verify the release as an outsider would: `docs/verifying-a-release.md`, every step. `verify-release.yml` replays it on the publish run only (the prepare run publishes nothing to npm).

## 4. Common incidents

| Symptom | Diagnosis | Action |
|---|---|---|
| `check --strict` red: "not accounted for" | a CRITICAL/HIGH rule gained a phase mapping, or a manifest row was deleted | `runward manifest --sync` scaffolds the missing rows (form only); fill status + evidence honestly |
| red: "typed pointer does not resolve" / "symbol not found" | code moved or was renamed since the row was written | re-read the rule, update the pointer to where the evidence now lives; never widen the pointer to "somewhere nearby" |
| red: "evidence does not match the rule's signature" | the pointed file lacks the rule's shape — cited, not applied | implement the rule or change the row's status honestly; do not paste the token to appease the regex |
| red: "sealed evidence changed" | an evidence file drifted since `--freeze` | re-read the pointer, confirm the evidence still holds, re-seal with `runward check --freeze` |
| red: DRAFT ADR under Reconstruction lifecycle | a `characterize --mine` hypothesis was never ratified | write the real why + a re-evaluation trigger, set `Status: accepted`, rename DRAFT→ADR — or delete it |
| golden OSCAL test fails after an intentional output change | the pack format changed on purpose | regenerate with `UPDATE_GOLDEN=1 npm test`, then **review the golden diff like production code** — it is the reviewed anchor |
| CI red on `reports-fresh` | a committed report no longer describes the tree (a test added, renamed or removed; a lint finding moved) | `npm run test:junit && npm run test:eslint && npm run test:security`, commit the reports, re-run `npm run test:reports` |
| a checkpoint to resume, a suspended approval, a provider to swap | none: runward is a CLI, never a runtime; it holds no checkpoint, no pending approval and no provider | nothing to operate; the rows naming these gestures are `n/a` in the manifests |
| smoke failure only in `core-offline` | something in the core touched the network | find and remove the call; the zero-network invariant is not negotiable (docs/adr/ADR-0001) |

## 5. Evolving the rule set and regimes

- **Add a rule**: one markdown file in `templates/rules/` with frontmatter (`title`, `impact`, `phases`, optional `asi`, optional `signature`). A CRITICAL/HIGH rule mapped to a gated phase immediately raises what every mission must account for — that is the product's blast radius, so it goes through CODEOWNERS review. Update `EXPECTED_RULES` in `src/lib/constants.ts` (the smoke suite pins the shipped count) and, if the phase floors move, `EXPECTED_MAPPED`.
- **Rename or remove a rule**: never silently — add an entry to `src/lib/rule-migrations.ts` so existing manifests get a named migration path (`manifest --sync` rewrites renamed slugs in place; docs/adr/ADR-0006).
- **Add a compliance regime**: a mapping in `src/lib/compliance.ts` framing the same universal inputs (docs/adr/ADR-0015/0022); regimes are lenses, the manifest stays universal.
- **Add a harness adapter**: an inert sample under `templates/adapters/` plus a line in its README (docs/adr/ADR-0012). The armed tier is the one exception: `runward wire --install` writes the harness hook, in a terminal only, by the operator's hand (docs/adr/ADR-0065).

## 6. Contacts

| Role | Person | Channel |
|---|---|---|
| Maintainer / releases / security | Thibault Souris | GitHub (@stranxik); security reports per SECURITY.md |
| Everything else | — | GitHub issues on the runward repository |

## 7. Delegation (stage 1)

Product ADR-0088, stage 1: delegated acts run under the `runward-steward` App, and every surface says « delegation: declared, not proved — the maintainer's credential is within agent reach ». Stage 1 changes who the forge names, not what anyone can do.

- **The stop.** `.github/workflows/delegation-stop.yml`, check `delegation stop`, reads the repository variable `RUNWARD_DELEGATION_STOP`. When it is on, the check fails on every pull request `runward-steward[bot]` or a delegate of `runward/delegation.md` (default branch) opened, pushed to, or authored a commit of; unset or `off` passes; any other value is a stop. It stops a merge only once it is a required check (an administrator's act, once). Who can set it: on a personal-account repository GitHub lets any repository collaborator create a repository variable; runward's only collaborator is the owner (admin), and the App holds no `variables` permission. A second collaborator would be able to set it too.
  ```
  gh variable set RUNWARD_DELEGATION_STOP --body on --repo stranxik/runward    # stop
  gh variable set RUNWARD_DELEGATION_STOP --body off --repo stranxik/runward   # resume
  gh variable get RUNWARD_DELEGATION_STOP --repo stranxik/runward              # read back
  ```
  A pull request already checked keeps its earlier result until the check runs again: after turning the stop on, push to it or re-run its `delegation stop` run (`gh run rerun <run-id> --repo stranxik/runward`), and read the value the run printed. **In stage 1 an agent holding the maintainer's credential can clear it**, and an agent acting under the maintainer's account is not a delegate identity: the stop binds the App and the charter's delegates only. The escalation budget (3 consecutive refusals, 20 per period) is published by the charter, not enforced by the check, in stage 1.
- **The weekly act.** One signed commit carrying the sample, the shipped-code digest and, in stage 2 only, the patch authorizations (ADR-0088 decision 6). `runward sample` (no action) says where the period stands and prints the next command: an agent plants the seed before the period closes (`sample plant`), anyone draws after it (`sample draw --signature` with the drand round it names), the maintainer reviews with the one printed command (`sample review ... && git commit -S`, refused inside an agent session), and the planter reveals (`sample reveal`). Details: `docs/delegation-charter.md`.
- **Installing the App on runward.** A 2FA web session gesture, never an agent's: open https://github.com/settings/installations, **Configure** next to `runward-steward`, under *Repository access* add `stranxik/runward`, save. Its permissions stay the lab's (`metadata: read`, `contents: write`, `pull_requests: write`, `repository_advisories: write`, `actions: read`, `checks: read`, `statuses: read`); never `administration`, `workflows` or `variables`, and the App is in no bypass list. Revocation is uninstalling it from the same page.
- **What stays the maintainer's.** Class R (the charter and every change to it, forge and admin settings, the stop variable and the required checks, lock opt-ins, arming the gate, constitutional ADRs), class H (reported vulnerabilities, acknowledgements, CVE requests, embargoes), and class I in stage 1 (every release and advisory publication, as ADR-0085 and ADR-0084 decide them). Before merge, the pre-merge paths of ADR-0088 decision 7, which `.github/CODEOWNERS` names; an App approval is never presented as a review.

## References

- [governance/threat-model.md](governance/threat-model.md) — what to protect while operating this repo.
- [contracts/port-contract.md](contracts/port-contract.md) — the surfaces you must not break.
- docs/adr/ — the decision journal; read it before re-litigating a settled choice.
