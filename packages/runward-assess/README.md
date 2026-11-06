# runward-assess

The repeatable assessment grid, `grille@1`: 35 criteria on seven axes, read the same way on every
repository and every commit, so that two records of one project compare and a record of today can be
re-scored tomorrow to the same bytes. It lives outside runward's verdict path and outside the tool it
evaluates ([ADR-0123](../../docs/adr/ADR-0123-the-repeatable-assessment-grid-lives-outside-the-verdict-path-and-outside-the-evaluated-tool.md)):
it imports nothing from runward (`test/no-runward-import.test.js` checks it, with planted controls),
reads what runward writes as one more piece of evidence, and runs runward's CLI as a program when it
tests the gate a repository declares. It sits in this repository's `packages/` until it moves to its
own.

Node.js 22.12 or later, no dependency: Node's standard library, `git`, and `gh` and `npm` for the
snapshot only.

## Three stages, one of them on the network

| Stage | Reads | Writes | Network |
|---|---|---|---|
| `snapshot` | the forge (`gh api --method GET` only), the npm registry, OSV, the Scorecard API, the declared public pages; it installs the gate the commit pins | a directory: `facts.json`, `profile-evidence.json`, `raw/`, `tools/`, and `manifest.json`, which names every file with its sha256 | yes, the only stage that has it |
| `measure` | one commit, from the repository's object store (no checkout); the gate the snapshot acquired, verified by digest | `measure.json`, canonical | refused: the command re-runs itself under `sandbox-exec` (macOS) or `unshare --net` (Linux), and a probe that still connects stops it |
| `score` | the measure, the snapshot, the declared profile, the grid | the record (`record.json`, canonical), a Markdown and an HTML report | none, and no clock, no environment, no randomness, no model |

The record has two scored parts, each with its own digest. The **internal** part holds the criteria
that read the commit alone: it is valid for that commit for ever. The **external** part holds the
criteria that read the snapshot too: it is valid at the snapshot's date only, and a repository setting
read today (branch rules, administrators, private reporting) is never applied to a past commit; for a
past commit it reads "not observed", unless the fact is about that commit (its lockfile in OSV, the
pull requests of its window) or immutable (a published version).

## States, tiers, the face

A criterion reads **met**, **not met**, **n/a**, **not observed** or **error**. n/a is allowed only
where the grid's applicability condition is false, proved by a fact of the profile or of the record,
with its reason. A fact absent from the record is not observed, never false; a fact this version does
not collect is never inferred.

Tiers are cumulative: an axis reads the highest tier `P` such that every applicable criterion's every
tier up to `P` is met. n/a does not block; not observed and error block, and are counted apart from
not met. No tier is reached by vacuity: a tier no applicable criterion defines caps the axis below it.
There is no global score, no average and no composite percentage: the face of a record is the vector
of seven axis tiers, each with its `n/N` per tier, and the regressions against the previous record,
real losses apart from losses by observation.

The judged annex (J-01 to J-05) is a separate section of the record, outside every tier; emptying it
changes no tier and no part (`test/score.test.js`).

## The grid is data

`grid/grille-1.json` holds every criterion: identifier `AXE-NN`, `rev`, axis, classes (M mechanical,
X external snapshot, J judged, noisy), applicability, and each tier as a condition over named facts
with its threshold. `grid/facts-1.json` names every fact a criterion reads, where it comes from, and
whether 0.1.0 collects it. `grid/grille-1.lock.json` holds each criterion's normative digest (what can
move a result, not its wording): a threshold changed without raising `rev` is refused
(`runward-assess grid`, `test/grid.test.js`). Two results compare only when `(id, rev)` are equal.
The auxiliary lists are versioned files beside the grid: secret patterns, the overpromise lexicon,
bots, free-mail domains, the OSV control, model SDKs. The shared tables (Scorecard risk levels and the
P3 minimum, the vulnerability severities and the days after publication, the web findings counted as
high, the register's days, the CHAOSS share) are data too, locked with the criteria. A measure and a
snapshot record the digest of the tables and lists they applied, and `score` refuses inputs collected
under others: a count is never mixed with one taken under another rule. The snapshot keeps the text of
every page it read, so a later version can read it again.

## The profile

A repository declares what it is in a profile, given with `--profile`. Its intended place is a file
versioned in the assessed repository; the trial's profiles were declared by the assessor, and say so.

```json
{
  "schema": "runward-assess-profile/1",
  "profiles": ["L"],
  "facts": {
    "publie_paquet": "runward",
    "deploie_service": [],
    "appelle_modele": false,
    "gate_declare": "node dist/cli.js check --strict",
    "docs_conformite": ["regimes/eu-ai-act@2024-1689.json"],
    "surfaces_publiques": { "files": ["README.md"], "urls": ["https://runward.dev/"] },
    "build_cmd": "npm run build",
    "perimetre_mutation": "stryker.config.json",
    "defect_register": { "path": "docs/compliance/known-defects.md", "format": "runward-known-defects/1" },
    "public_facts": [],
    "exceptions": [],
    "repo_public": true
  }
}
```

Each fact is checked against the commit and the snapshot. The record says, fact by fact, what supports
it: `commit` (the commit states it), `snapshot` (the registry or the forge shows it), `declared`
(nothing shows it: it rests on the declaration), or `contradicted` (the commit or the snapshot says
otherwise, for example a model SDK among the dependencies of a profile that declares no model call).
An exception (`SEC-03`, `SEC-04`, `PRO-03`) names its fingerprint or identifier, a reason and a date.

## Commands

```sh
A=packages/runward-assess/bin/runward-assess.js

node $A snapshot --repo ./repo --slug owner/name --profile profile.json --commit v1.2.0 --out snap/
node $A measure  --repo ./repo --slug owner/name --profile profile.json --commit v1.2.0 --snapshot snap/ \
                 --alt-node "$(command -v node22)" --out measure.json
node $A score    --measure measure.json --snapshot snap/ --profile profile.json --label v1.2.0 \
                 --previous last.json --out record.json --md report.md --html report.html
node $A diff     --out evolution.md --json evolution.json --html evolution.html v1.1.0=a.json v1.2.0=record.json
node $A selftest --measure measure.json --snapshot snap/ --profile profile.json --alt-node "$(command -v node22)"
node $A grid
```

`--since <rev>` bounds a record's window by the previous record's commit; without it, the window is
the 100 first-parent commits before the assessed one. `--alt-node` gives a second Node.js release to
the measure (the gate's verdict is re-derived under it) and to the self-test. `score` exits 3 when the
record would not cover every criterion of the version, 2 on inputs that do not belong together (a
snapshot of another commit, a measure of another grid, a profile other than the one measured).

## Determinism

The record, the measure and the manifest are canonical JSON: keys sorted by UTF-16 code units at every
depth, no insignificant whitespace, non-negative integers only (a ratio is `{n, d}`), one final line
feed, as runward's witness specifies (docs/spec/witness.md, section 3). Nothing in them depends on the
clock, the user, the host, an absolute path or the order a directory lists. `selftest` scores the same
inputs under `TZ=UTC LC_ALL=C`, `TZ=Pacific/Kiritimati LC_ALL=fr_FR.UTF-8` and, with `--alt-node`,
two more combinations on another Node.js release, and fails unless the record, the Markdown and the
HTML are byte-identical. `test/determinism.test.js` runs it, after proving that those environment axes
do change a locale-dependent output, and `test/purity.test.js` proves the score reaches no file,
clock, environment, network or chance, by its import closure and with those globals poisoned.

## saboteur@1

`corpus/saboteur-1/cases.json` is the catalogue PRV-03 replays on fresh copies with the gate a
repository pins: sixteen cases on the example mission the gate scaffolds (T00 to T15, unsealed and
sealed), nine generic cases on the repository's own mission (M00 to M08). T00 to T13 are those of the
2026-11-05 audit. Two were added with this grid: **T14**, an honest attestation whose `currentGate`,
`adrCount` and an unknown `independentAudit` field are written by hand, which `verify` must refuse
(RWD-2026-0192; its control, the verdict flipped, must be refused or the case cannot conclude), and
**T15**, one cited case named with a double quote and the same report written as Node.js 24.22 writes
it and as earlier releases do, which must give one verdict (RWD-2026-0187). `expected.json` holds what
each gate version did when the catalogue was frozen. The payloads are templates: the fake credentials
they carry are assembled at run time and never written in a file.

## What 0.1.0 collects, and what it does not

Collected: governance files, disclosure policy and private reporting, lockfiles, the project's
vulnerabilities in OSV with a known vulnerable control, the project's own advisories and their
visibility, secrets over the whole reachable history with a planted control, the workflow reader
(W1 to W3) and the signing jobs, Scorecard when its result is of the assessed commit, branch rules,
review of the window's pull requests, administrators and registry owners, CHAOSS absence and elephant
factors, ADR statuses and overdue triggers, versions against tags and CHANGELOG, the mission's trace
and its pointers (this package's own reader), the gate's verdict and its re-derivation, the sabotage
catalogue, the defect register (runward's format), conformity data, public surfaces, public facts, the
overpromise lexicon, internal links, third-party activity, downloads and stars.

Not collected, so every tier that needs it reads not observed and blocks: running the project's own
tests three times (FIA-01), coverage (FIA-02), exhaustive stubbing of a source perimeter (FIA-03), two
clean builds and a second environment (FIA-04), evaluation runs and offline guard tests (FIA-05 P2
and P3), SLI exports and DORA logs (FIA-06 P2 and P3), an install from the lockfile and a fresh
registry install (SEC-02), SAST (SEC-04 P2), offline attestation verification (SEC-06 P2), the
injection corpus and egress tests (SEC-07 P2 and P3), a dynamic web scan (SEC-08 P2), regenerating
cited reports (PRV-02), EUR-Lex amending acts (PRV-05 P2), a claims checker (PRO-01 P2), installs in
clean containers (ADO-01), running the Quickstart and checking external links (ADO-02), the interface
against its reference (ADO-03), accessibility (ADO-04), dependents and references (MAR-01 P3). Each
record lists them under "Not mechanized".

## Tests

```sh
node --test packages/runward-assess/test/*.test.js
RUNWARD_ASSESS_ALT_NODE=/path/to/another/node node --test packages/runward-assess/test/*.test.js
```

Every criterion has a held and a not-held fixture (`test/fixtures/criteria.json`); every test carries
its positive control. The saboteur's functional test runs the corpus against `dist/cli.js` of this
repository when it is built (or `RUNWARD_ASSESS_GATE_CLI`), and against a gate that always says yes,
which must catch nothing. These tests are not in runward's own suite: they run with the package, so
runward's committed JUnit report is unchanged, and they move with it when it leaves.

## The trial

`trials/runward/` holds the first records: runward at v0.37.1, v0.46.0 and `main@32d8425`, each with
its measure, its snapshot (without the acquired gate), its record and reports, and the evolution. The
same run on two private repositories of the maintainer stays outside this public repository.

MIT. See [LICENSE](LICENSE).
