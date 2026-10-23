# Recipe: a repository rule the gate can see

**Status.** Documentation and a script for **your** repository. Nothing here changes how the gate
judges a row: the gate reads the JUnit file this recipe produces as it reads any committed JUnit report,
and it never runs the script (ADR-0054). The same shape as the
[Lean proofs recipe](lean-proofs-as-junit.md), for a rule that is not a theorem.

## The problem

Some rules live in the repository and nowhere else: "every change to the kit bumps `KIT_VERSION`",
"every migration has a rollback", "the public API file changes only with a changelog line". Written in a
README or a CONTRIBUTING file, the gate never sees them: they are not in the corpus, no manifest row
accounts for them, and nothing turns red when one is broken.

The recipe makes such a rule gate-visible in four pieces:

1. the rule in the corpus, vendored with `runward update --corpus`, so the gate requires a row for it;
2. `requires: junit` on the rule, so an `applied` row must cite a JUnit case, not a bare file;
3. a check that writes that JUnit case, whose **name carries a fingerprint of what it checked**;
4. the manifest row citing the case by that name.

## What a green case says, and what it does not

A green case written by [repository-rules/repo-rule-junit.mjs](repository-rules/repo-rule-junit.mjs)
says: **in the run that wrote it, the guarded files had the SHA-256 fingerprint the name carries, the
version file held the version the name carries, and the committed lock recorded that fingerprint for
that version.**

It does not say:

- that the version bump is the right size (major, minor, patch). That is a person's judgement;
- that the committed report came from CI. A hand-written JUnit file with the right name is read by the
  gate like any other. The defence is outside the gate: a CI job that re-runs the script and fails when
  the regenerated report differs from the committed one, as a required check;
- that the lock was not edited by hand. `--record` refuses to overwrite a recorded version; a person
  editing the JSON is visible in review, not to the gate.

The gate reads the committed report and never runs the script. A guarded file changed and committed
**without** regenerating the report keeps the old case name, and the row stays green until the CI job
above regenerates the report. Make that job required.

## The check, for "every change to X bumps V"

The gate reads no git history (ADR-0067 crossing 4), so "a change" is made visible by content:

- the **fingerprint** is the SHA-256 of the guarded files, paths sorted, CRLF read as LF, the version
  file excluded;
- a committed **lock** records, for each version, the fingerprint it was released with;
- the case is green when the lock's fingerprint for the current version is the current fingerprint.

Change a guarded file without bumping: the fingerprint no longer matches, the case is red. Bump the
version: it has no fingerprint yet, the case is red until `--record` writes one. `--record` never
overwrites a version already recorded with another fingerprint.

The case name is `repo-rule <rule-id> <KEY>=<version> sha256=<64 hex>`. A row citing it stops linking
as soon as the report is regenerated after any change to the guarded files, bumped or not: the row is
updated in the same change, and, if it is ratified, the new case name moves the row's digest, so the
ratification has to be given again.

## Worked example, on `runward init --example`

Run on 2026-10-20 with runward built from this repository (0.44.0 plus this recipe), macOS, Node 24.
The example's port contracts, `code/src/core/ports/`, are the "kit"; `code/KIT_VERSION` holds its
version.

**1. Write the rule, in a corpus.** `--corpus` takes an already-vendored directory of rules; start
from the rules the mission already holds, so nothing else changes, and add yours:

```sh
mkdir -p ../corpus && cp runward/rules/*.md ../corpus/
printf 'KIT_VERSION=1\n' > code/KIT_VERSION
```

`../corpus/repo-kit-version-bump.md`:

```markdown
---
title: Every Change to the Port Kit Bumps KIT_VERSION
requires: junit
impact: HIGH
phases: [floor]
noAsi: A versioning discipline of this repository, not an agentic-security surface.
appliesTo: [code/src/core/ports/**, code/KIT_VERSION]
nonScope: A green row proves the committed report names the current KIT_VERSION and the current fingerprint of the port kit, and that the lock records that pair; it does not prove the bump is the right size, nor that the report was produced by CI rather than written by hand.
impactDescription: Consumers pin the port kit by KIT_VERSION; a change shipped under an old number reaches them unannounced.
tags: [repository, versioning, contracts]
---

## Every Change to the Port Kit Bumps KIT_VERSION

> **A port changes, the number changes.** Consumers of `code/src/core/ports/` pin it by `KIT_VERSION`.
```

**2. Vendor it.** Copied into `runward/rules/` by hand, a HIGH rule with a gated phase is refused as "a rule runward never wrote" (it could stand in for a shipped rule). Vendored, the scaffold lock records it as your corpus's (ADR-0057):

```
$ runward update --corpus ../corpus
  write runward/rules/repo-kit-version-bump.md
Summary
  ✓ 91 up to date   • 1 added
```

The gate now requires a row for it:

```
$ runward check --strict
  ✗ Floor · repo-kit-version-bump — not accounted for in the Rule conformance manifest — `runward manifest --sync` scaffolds the missing row(s), with an empty status the gate still refuses; the decision stays yours: applied with a file:line/test, deviated with an ADR, or n/a with a reason
  Current gate  deliverables filled, gate red at Floor
```

**3. Run the check.** Copy the script to `tools/`, and a wrapper so CI and people run it the same way:

```sh
# tools/kit-rule.sh
exec node tools/repo-rule-junit.mjs --rule repo-kit-version-bump --version-file code/KIT_VERSION --key KIT_VERSION \
  --guard code/src/core/ports --lock code/repo-rules.lock.json --out code/reports/repo-rules.xml "$@"
```

```
$ sh tools/kit-rule.sh
FAIL  repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920
      KIT_VERSION=1 has no recorded fingerprint: record it with --record once the change is reviewed
$ sh tools/kit-rule.sh --record
recorded KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920 (4 files)
ok  repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920
```

Commit `code/repo-rules.lock.json` and `code/reports/repo-rules.xml`.

**4. Cite the case from the row** in `runward/floor.md`, Rule conformance:

```
| repo-kit-version-bump | applied | test:code/reports/repo-rules.xml::"repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920"; file:code/repo-rules.lock.json — the port kit's fingerprint is recorded under the current KIT_VERSION |
```

`runward check --strict` exits 0: `Current gate  all gates passed`.

**5. Break the rule.** Change a port, do not bump:

```
$ echo "// a new optional field on the routing port" >> code/src/core/ports/routing.port.ts
$ sh tools/kit-rule.sh
FAIL  repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=00812e442911e192e52cbb26669ff3c95bd5f2c18c41347eb24fe5637d154bd3
      the guarded files changed since KIT_VERSION=1 was recorded (2e073c2d93e2…): bump KIT_VERSION
$ runward check --strict        # exit 1
  ✗ Floor · repo-kit-version-bump — typed pointer test:code/reports/repo-rules.xml::"repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920" — no JUnit test case named "repo-rule repo-kit-version-bump KIT_VERSION=1 sha256=2e073c2d93e226c452bf0131ca2d84dcc8618c51c7584498c8f2201b81ffe920" in the committed report
```

Recording the change under the old number is refused:

```
$ sh tools/kit-rule.sh --record
repo-rule-junit: KIT_VERSION=1 is already recorded with another fingerprint — bump KIT_VERSION instead
```

**6. Follow the rule.** Bump, record, update the row's case name to the one printed:

```
$ printf 'KIT_VERSION=2\n' > code/KIT_VERSION
$ sh tools/kit-rule.sh --record
recorded KIT_VERSION=2 sha256=00812e442911e192e52cbb26669ff3c95bd5f2c18c41347eb24fe5637d154bd3 (4 files)
ok  repo-rule repo-kit-version-bump KIT_VERSION=2 sha256=00812e442911e192e52cbb26669ff3c95bd5f2c18c41347eb24fe5637d154bd3
```

With the row citing `KIT_VERSION=2 sha256=00812e44…`, `runward check --strict` exits 0 again.

## The CI job

Re-run the check on every pull request and fail when the committed report is not the one it writes.
The script's output has no time, duration or host, so the comparison is byte for byte:

```yaml
- run: sh tools/kit-rule.sh
- run: git diff --exit-code -- code/reports/repo-rules.xml code/repo-rules.lock.json
```

Make the job a required check. Without it, the limit named above holds: the gate reads the report you
committed, not the files as they are now.

## Other rules of the same shape

The script checks one shape, "a change to these files moves this number". For another repository rule,
keep the four pieces and write the check that fits it; what keeps it gate-visible is the case name:
put in it a fingerprint of exactly what the check read, so a row citing an old case stops linking when
what it read changes.
