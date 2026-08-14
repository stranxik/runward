# ADR-0057: the shared corpus is pinned without a registry

**Date**: 2026-08-14
**Status**: accepted 2026-08-14 (all four ratification criteria met on the built binary; this document crosses nothing)

## Context

An organization running a fleet of repositories wants ONE authoritative, versioned rule corpus — the
whole org governs its agents against the same v2.1. That is legitimate policy-as-code and real
enterprise value. The obvious shape — an HTTP rules registry each repo fetches from — is refused by
name: "An HTTP/registry endpoint for rules. runward is never a runtime; the CLI is the seam"
([ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md):23), consolidated into the runtime-boundary
invariant ([ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) crossing 1). The moment a verdict
depends on a reachable corpus, all four moat properties die at once: not independent (needs the
service up), not survivable (delete the service and the repo cannot reproduce the verdict months
later), non-deterministic (the corpus mutates under the gate between two runs of one commit).

A six-agent analysis on 2026-08-14 (counter-expertised) asked what the MAXIMUM corpus-sharing runward
can do is, while staying no-fetch and no-runtime. Three findings shape this ADR.

**A nuance that unlocks it.** ADR-0024:24 also discards "a separate rules-data npm package … the
mission-copy resolution (operators may edit their rules) would be lost." That refuses splitting
RUNWARD'S OWN craft rules from the gate that verifies them. It does NOT forbid an ORG vendoring ITS
OWN policy corpus — a different artifact (the org's policy, not runward's rules), and exactly what a
shared corpus is. runward is already a hybrid resolver: `rulesDir(missionDir)` returns the mission's
committed `runward/rules/` else the installed package's `templates/rules`
(`src/lib/conformance.ts:54-57`). A vendored org corpus is a THIRD source of the identical shape
(`.md` read by slug), not a new mechanism.

**The naive design breaches the boundary in three places**, and the adversarial pass caught each.
This ADR bakes in the subtractions rather than shipping the breach.

**The deepest finding: anti-forgery does not survive the trip.** runward's own corpus check is
forgery-resistant because its authority ships WITH THE TOOL — "The authority is the INSTALLED
PACKAGE, under node_modules, outside the repository" (`src/lib/scaffold-lock.ts:116-119`), always
present, even under the network-cut CI run. An org corpus vendored as separate DATA loses that on the
repo alone: at a clean checkout the authority (`@org/rules`) is absent, the missing-check is skipped,
and a re-signed fabricated corpus passes — the 2026-08-04 vacuity hole
([ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md)) reopened for the org corpus.
It cannot be closed in-repo: anything committed is re-signable by the audited party. So the strong
anti-forgery of a shared corpus lives where the authority is present — the org's CI, `@org/rules`
installed, network cut — on the brick side of the seam (see the blueprint,
[corpus-authority-brick.md](../corpus-authority-brick.md)), never in runward's repo-alone verdict.

## Decision

runward's limit is four verbs, all in-repo, pure `node:fs`, survival-safe on the repo alone:
**RESOLVE** a version-pinned vendored corpus, **COMPARE** two in-tree version stamps, **SURFACE** its
migration records, **EMIT** the result. Three corrections are load-bearing and are the decision as
much as the four verbs.

**1. RESOLVE — unchanged path, a third source.** At gate time runward reads the vendored corpus from
the committed `runward/rules/` through the unchanged `rulesDir()`/`ruleSetDir()`: `readdirSync` the
`*.md`, sort by slug, `readFileSync`, `parseRule` — the resolution path does not change, which is the
point. The vendoring — the fetch — is the operator's install step BEFORE and OUTSIDE the gate.

**2. COMPARE — two in-tree stamps, advisory.** The vendored corpus self-describes with a committed
`runward/rules/corpus.json` (`{name, version}`); a new optional `corpus: {name, version}` field on
the existing `ScaffoldLock` (`src/lib/scaffold-lock.ts`, beside the informational `writtenBy`) records
the pin. runward compares the two committed stamps and reports a drift ("`runward/rules` holds corpus
v2.1 but the pin is v2.2 — re-vendor and apply migrations"). **This drift is ADVISORY, never a
`--strict` gap**: both stamps live in the audited repo and are re-signable together, so as a strict
gap it would be the re-signable floor ADR-0002 closed; as a guide it catches the honest "forgot to
bump", which is its whole job.

**3. SURFACE — an in-tree migrations file.** An org renames its own rules on its own version line, so
its migration records travel WITH the corpus: a committed `runward/rules/migrations.json` of the exact
[ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md) shape (`oldSlug → {to?, reason,
since}`, `since` a corpus version), loaded and MERGED with the built-in `RULE_MIGRATIONS` at the three
surfaces that already read it (the gate form-lint, `explain`, `manifest-sync`). A manifest citing a
renamed org slug is guided, never left to guess. Pure `readFileSync`, grow-by-addition, the ADR-0006
change-contract discipline carried.

**4. EMIT — into `check --json`.** The resolved corpus, its version, and the divergence are additive
fields on the machine surface ([ADR-0030](ADR-0030-agent-operates-runward-neutral-baseline-best-effort-detection.md)),
so a fleet view (the brick) reads them.

**The three corrections, stated as the boundary this ADR holds:**

- **The `--corpus` flag takes a PATH, never a registry coordinate.** `runward update --corpus
  ./vendor/org-rules` points the existing vendoring loop at an already-vendored directory and runs
  the identical `classify()` (local edit kept, upstream refreshed, unknown kept). It must NEVER accept
  an npm specifier like `@org/rules` — the moment runward resolves "what `@org/rules` resolves to" it
  is a registry client, a wire by proxy. runward speaks no registry coordinates.
- **The gate reads no `node_modules` and no lockfile.** `corpusDivergence` keeps its authority as
  `templates/rules` — the tool's own shipped files, always present under the network-cut run. It is
  NOT repointed at `node_modules/@org/rules`: that is gitignored, absent on a clean checkout, and its
  version floats independently, so `npm install @org/rules@2.2` would change the verdict with zero
  committed change — breaking "same working tree ⇒ same verdict" (ADR-0054 crossing 4). The only
  verdict-path inputs are the two in-tree stamps.
- **Version-drift stays advisory** (correction 2 above), so no re-signable input gates.

**The seam** (named by ADR-0054:113-115: "a registry that vendors the rule package … is the
operator's runtime, on the operator's side of the seam") is a versioned vendored data package,
crossing at install time, one-way and asynchronous: the brick PRODUCES `@org/rules@2.1` + its
migrations + its version stamp; the operator INSTALLS and PINS it; the repo COMMITS the bytes; the
gate READS them. runward has no client of the brick — no URL, no socket, no "check for updates". The
pipe is a directory, not a wire.

## Alternatives considered

- **A — pure vendored package, no local override.** Removes a capability runward already ships and
  ADR-0024:24 refused to lose (operators may edit their rules copy). More work, not less.
- **B — corpus committed per repo, no shared upstream.** Forfeits the fleet property: a v2.1→v2.2 bump
  becomes an N-repo hand-edit with no single upstream to publish once — the exact pain a shared corpus
  removes. (It remains the zero-satellite fallback a single maintainer runs today.)
- **C — hybrid (chosen).** A shared org package is a second source of the identical shape, vendored
  into the existing `runward/rules/`, with the local-override + migration machinery runward already
  has. Single publishable upstream (the brick) AND repo-alone survivability (the resolved bytes are
  committed) AND the existing override.
- **Repoint `corpusDivergence` at `node_modules/@org/rules` + read the lockfile, to keep org
  anti-forgery in runward.** The design's one real overreach: it injects a beyond-mission-tree,
  gitignored, version-floating input into the verdict path and breaks same-tree⇒same-verdict.
  Rejected; the strong anti-forgery moves to the brick/CI side (see What this does not claim).
- **A `runward corpus publish` / `runward fleet status` subcommand.** Puts the authority's verbs
  (produce, serve, aggregate) inside the consumer — the satellite mislabelled as CLI. Rejected;
  ADR-0039 keeps them on the brick.

## Consequences

- **A real but small addition to runward** (~4 maintainer-days after the subtractions, not the ~6-8 a
  design that kept the anti-forgery in the gate would cost): the `corpus` field + render/read, the
  path-valued `update --corpus`, the in-tree `migrations.json` merge at the three existing surfaces,
  the advisory drift signal, and the blocking no-fetch CI test.
- **The enterprise value mostly lives in the brick.** This ADR is honest that runward's part is the
  smaller half; publishing, signing, fan-out, the fleet view, and the strong anti-forgery are the
  satellite. Trying to make runward's part bigger is exactly where the boundary reopens.
- **Survival holds.** A checkout with `node_modules` absent and no registry reachable still resolves
  the pinned corpus from committed bytes and produces a verdict (ADR-0052).
- Crosses no phase; `node dist/cli.js check --strict` reads exit 0 before and after.

## What this does not claim

- It does not make runward authoritative across a fleet: it consumes vendored bytes; the brick
  produces, signs, fans out, and aggregates ([corpus-authority-brick.md](../corpus-authority-brick.md)).
- **It does not make the org corpus adversary-proof on the repo alone.** For the org corpus,
  runward's repo-alone check catches the honest "forgot to bump / drifted" mistake, NOT a deliberate
  re-signed fabrication — because the non-re-signable authority (`@org/rules`) is absent at a clean
  checkout. The strong anti-forgery is enforced where the authority is present: the org's CI, the
  package installed, the network cut. This is the inverse of runward's OWN-corpus guarantee, and it is
  stated, not hidden.
- It does not fetch, resolve "latest", publish, watch, or aggregate a corpus. It reads and compares
  bytes already on disk.
- It crosses no phase: proposed, cited by no manifest ([ADR-0045](ADR-0045-the-gate-cannot-be-satisfied-by-paperwork.md) decision 4).

## Ratification

**Accepted 2026-08-14.** All four criteria are met on the built binary, and the four verbs of the
decision are implemented in-tree with pure `node:fs` (no `node_modules`, no lockfile, no socket):
RESOLVE through the unchanged `rulesDir()` (the vendored corpus is a third source of the identical
shape); COMPARE the two in-tree stamps (`corpusDrift` in `src/lib/rules.ts`, advisory); SURFACE the
in-tree `migrations.json` merged with `RULE_MIGRATIONS` at the three reading surfaces (`ruleMigrations`
in `src/lib/rule-migrations.ts`); EMIT `corpusPin` + `corpusDrift` into `check --json`. The path-valued
`update --corpus <path>` vendors the corpus and records the pin in the scaffold-lock's new `corpus`
field, and refuses a registry coordinate by name. Evidence against each criterion:

1. **No live fetch, under `unshare -n`.** `test/unit/corpus-no-fetch.test.js` vendors an org corpus via
   `update --corpus`, then resolves and reports — `check --strict` (exit 0), `rules --json`, and the
   advisory drift — from committed bytes only, with no `@org/rules` anywhere. Its negative control
   deletes a shipped rule and confirms the gate fails LOUD (`corpus.missing`), never a silent fetch.
   `.github/workflows/ci.yml` runs this file INSIDE the `sudo unshare -n` block, so a green CI run is a
   structural proof that resolution never opened a socket; `test/unit/regulated-posture.test.js` asserts
   that step is present so it cannot be silently dropped.
2. **Drift is advisory.** `corpus-no-fetch.test.js` asserts `check --strict`'s exit code and verdict
   are byte-identical whether the corpus stamp matches the pin or drifts — the drift is reported in
   `corpusDrift`, never a gap.
3. **No node_modules / no lockfile in the verdict path.** Resolution and comparison read only
   `runward/rules/` and the scaffold-lock; `corpusDivergence` keeps its authority at the shipped
   `templates/rules`, and the network-cut CI run passes with no registry reachable.
4. **Global invariant.** `check --strict` exits 0 before and after; the full suite (505 unit + smoke +
   oscal-schema + audit-corpus) and `no-overclaim` are green.

The criteria as originally required, kept as the record of the bar that was cleared:

1. **No live fetch, under `unshare -n`.** A fixture mission whose committed `runward/rules/` holds a
   small vendored corpus + `corpus.json` + a scaffold-lock `corpus` field + `migrations.json`, run
   with `node_modules/@org/rules` removed and networking cut (extending the existing
   `sudo unshare -n` core-tests run, `.github/workflows/ci.yml:196`): `check --strict`, `rules --for
   --json`, and the drift check all resolve the pinned corpus from local bytes and exit 0, because any
   socket attempt fails the job. A negative control: a mission whose corpus could only resolve by a
   fetch fails loud (couldNotRead), never silently passes. `test/unit/regulated-posture.test.js` gains
   an assertion that the corpus-under-`unshare` step is present (mirroring its `/unshare -n/` check at
   line 65), so the guard cannot be silently removed.
2. **Drift is advisory.** A test asserts `check --strict`'s exit code and verdict are byte-identical
   whether the corpus version stamp matches the pin or drifts — the drift is reported, never gated.
3. **No node_modules / no lockfile in the verdict path.** A test (or the CI network grep it already
   passes) confirms the resolution and comparison read only `runward/rules/` and the scaffold-lock,
   not `node_modules` or `package-lock.json`.
4. **Global invariant.** `check --strict` exits 0 before and after; `no-overclaim` green.

## References

- [ADR-0024](ADR-0024-machine-surface-of-the-rule-set.md) — refuses the registry, and (line 24) splitting runward's OWN rules; an org corpus is a different artifact
- [ADR-0054](ADR-0054-the-runtime-boundary-is-explicit.md) — the runtime boundary; the seam (113-115) sanctioned by name; crossing 4 (same working tree ⇒ same verdict)
- [ADR-0006](ADR-0006-rule-set-evolution-as-tracked-migrations.md) — the migration-record shape the in-tree `migrations.json` reuses
- [ADR-0002](ADR-0002-harden-the-strict-gate-against-vacuous-passing.md) — the re-signable vacuity floor that keeps drift advisory and org anti-forgery off the repo-alone path
- [ADR-0039](ADR-0039-the-operator-layer-stays-outside-the-cli.md) — the satellite (publish / fan-out / fleet view / strong anti-forgery) stays outside the MIT CLI
- [ADR-0052](ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md) — the survival thesis the committed vendored bytes preserve
- [ADR-0011](ADR-0011-neutral-ecosystem-standards-as-versioned-ports.md) — the `corpus` field and predicate as versioned, additive ports
- [corpus-authority-brick.md](../corpus-authority-brick.md) — the blueprint of the brick beyond this limit
