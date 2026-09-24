# The history rewrite of 2026-09-24

On 2026-09-24 the history of this repository was rewritten, once, from commit `ecea924`
(2026-08-12) onward. This page says what changed, why, what it costs a reader, and how to check
that nothing shipped was altered. It is declared in the register as
[RWD-2026-0116](known-defects.md).

## Why

The pilot protocol's candidate list, and ADR-0052 which carried it, named organisations that had
agreed to nothing. Removing the names from `main` (#292) left them readable in every commit and tag
since 2026-08-12. Naming a third party before it has agreed to anything is not ours to do, so the
passages were removed from the history as well. The names are not repeated here.

## What changed

- **Content**: two files, and only the candidate passages in them —
  `docs/pilot-protocol.md` and `docs/adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md`
  — plus one commit message that listed the same candidates. Nothing else.
- **Commit identifiers**: the 390 commits from `ecea924` to the head of `main` on that day have new
  identifiers. Author and commit dates are preserved. Every commit before `ecea924` keeps its
  identifier and its signature.
- **Signatures**: the rewritten commits that GitHub had signed on merge no longer carry a signature
  — a signature cannot remain valid over changed content.
- **Tags**: the twelve release tags below point at the rewritten commits. The 43 earlier tags are
  untouched, object for object.

| Tag | Commit before | Commit after |
|---|---|---|
| `v0.34.0` | `98f1369d581b0f2b2825fc32ee369d1cebf307d5` | `c000b972c2d32e6db4b9b54d61d55d653888f330` |
| `v0.35.0` | `cc50e5d243358d0e5307b2a3e2a9a0feb113fef2` | `8c94c80f1340f4cab6fdb851b2cf2a5cdcdd7336` |
| `v0.36.0` | `071238c4253e51505fcd2eb8e54f63d6e53c4fb7` | `bfeaed5aa940ca218e2827afc24d16214fc9b1e0` |
| `v0.36.1` | `b331782b5fc7d754a79d9f795eaf8ec80a5bc3e7` | `7939e29d8e84f62336cf68d276cfc9247b8753c8` |
| `v0.36.2` | `9e32911056792dd5ee95758eb83933a3ad3dcf59` | `0c0cb8db0bfe787484788988f66ff9aa70d0328b` |
| `v0.37.0` | `ca65f105f4a2c6d0b0eea6e13fa6272050dd56b7` | `018fc1b5753ef4e55e4ebf66f6843489f1b00c3e` |
| `v0.37.1` | `2d43b516e11c882efd2beeedc7464cfff97a3513` | `0e194d6accf91aa13c511b9a96a115644098223f` |
| `v0.38.0` | `1cf89a70f38f748b9a2a253549946e84445b0432` | `9066c6d976ad7a0657c048dee76222eabe1ab1cf` |
| `v0.39.0` | `e36dc0857b5a5bf4c3135a261c58e17b864600fe` | `b84eeb175bfc48e1d968fb779fbcccdd1b4ff2d0` |
| `v0.40.0` | `15dc3de0958e1fe86ab2e3de169e8cdada091078` | `9a5affd4423376a4bc1382f9f269b03294bc1016` |
| `v0.41.0` | `18485f01a05b1a19f92dfeb6c1a36b96b1396963` | `ff0b6d93a994ff8190de55c38a7bdeb8cfb3b0bc` |
| `v0.42.0` | `61d7d830539c2b1551946493fabc48aa8cf1b898` | `b96e5ea775faa7ad87b5a9c688780727e22c7b08` |

## What it costs a reader

- **Provenance of these twelve releases names the commit BEFORE.** The npm provenance and the GitHub
  attestations are signed statements recorded in a transparency log; they cannot be re-signed, and
  they still verify (repository, workflow and builder identity are unchanged). What no longer works
  is checking out the commit they name: use the table above to find its successor.
- **The pre-registration of the pilot protocol** was dated by the git history. The protocol's
  questions, measures and failure criterion are byte-identical before and after, and the commit
  dates are preserved — but a rewritten history is a weaker witness than an untouched one, and that
  is said here rather than left for a reader to discover.

## How to check that nothing shipped changed

The npm package is built from `dist/`, `templates/`, `regimes/`, the example mission and the root
notices — none of which the rewrite touched. Measured on 2026-09-24: `npm ci && npm run build &&
npm pack` at the rewritten `v0.42.0` yields a tarball whose SHA-256 equals the one npm serves
(`926663c401d161ca…`). The same two commands at any tag above, compared with
`https://registry.npmjs.org/runward/-/runward-<version>.tgz`, repeat the check. The
`Verify release` workflow was re-run on all twelve tags the same day.
