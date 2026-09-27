# Runbook: runward

**Version**: v0.42.2 · **Last review**: 2026-09-27 · **Owner**: Thibault Souris (maintainer)

This runbook is written for the next maintainer: how to build, test, release, debug a red gate, and evolve the rule set — using nothing but this repository.

## 1. Build and test

- **Prerequisites**: Node ≥ 20, npm. No required environment variable, no service, no key: the project runs fully offline.
- **Build**: `npm ci && npm run build` (plain `tsc` into `dist/`).
- **Test**: `npm test` — builds, then runs the unit suites (`node --test test/unit/`), the smoke suite (`test/smoke.js`), and the OSCAL schema validation (`test/oscal-schema.js`). All of it must pass with the network unplugged; CI proves that in the `core-offline` job.
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
2. On a release branch: bump the version in `package.json` and the lockfile, in every packaging manifest that carries it (`.claude-plugin/`, `plugins/`, `packaging/`; `git grep` the old version), and in the stamps that name it (ROADMAP, known-defects header, `CITATION.cff`); move the `Unreleased` entries of `CHANGELOG.md` under the version; regenerate the committed reports (§1) and the delivery report (`node dist/cli.js report`). Merge through a pull request.
3. Create the GitHub release for the tag on `main` (`gh release create vX.Y.Z --target main`). This triggers `.github/workflows/release.yml`, which builds and runs `npm publish --provenance --access public` using OIDC; the published release also triggers the full mutation ratchet (`mutation-ratchet.yml`), whose signed summary the release keeps (product ADR-0079). **No maintainer machine ever publishes**; if the workflow fails, fix and re-run it rather than publishing locally, or the provenance chain breaks.
4. Verify the release as an outsider would: `docs/verifying-a-release.md`, every step.

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

## References

- [governance/threat-model.md](governance/threat-model.md) — what to protect while operating this repo.
- [contracts/port-contract.md](contracts/port-contract.md) — the surfaces you must not break.
- docs/adr/ — the decision journal; read it before re-litigating a settled choice.
