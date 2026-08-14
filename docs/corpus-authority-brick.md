# The corpus-authority brick — blueprint of the layer beyond runward's limit

**Status**: blueprint, not a commitment. Demand-gated ([ADR-0039](adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)):
built only when a real fleet needs one corpus governed centrally, never speculatively. This document
is the starting point for that second product; nothing here lives in the MIT `runward` package.

## Why there is a second brick at all

runward's four-way moat — independent, survivable, agent-agnostic, deterministic — exists **because
the gate does not run, hold state, or centralize**. An organization's real need — one authoritative,
versioned corpus across a fleet, published, signed, fanned out, and reported on — genuinely requires
a process that PRODUCES, HOLDS, SERVES, and AGGREGATES. That process cannot be runward without
killing the moat. So it is a **separate brick**, and it MAY be a runtime **precisely because it is not
the gate**: no repo's verdict depends on it being up. Delete the brick and every repo still re-runs
`runward check` against its vendored bytes and gets the identical verdict. The brick down degrades
org-level VISIBILITY and distribution convenience; it never touches a single repo's ability to gate.
That asymmetry — the authority is a runtime, the gate is not — is the whole architecture.

[ADR-0057](adr/ADR-0057-the-shared-corpus-is-pinned-without-a-registry.md) fixes where runward stops:
it RESOLVES a vendored corpus, COMPARES two in-tree stamps (advisory), SURFACES in-tree migrations,
EMITS the result — all in-repo, no fetch. This brick is everything past that line.

## What the brick is — four roles

1. **Publisher.** Holds the canonical org corpus, cuts the versioned package (`@org/rules@2.1` — an
   npm package, a git-tagged vendored directory, or a plain tarball), authors the migration records
   for renames and removals (in the [ADR-0006](adr/ADR-0006-rule-set-evolution-as-tracked-migrations.md)
   shape runward reads from `runward/rules/migrations.json`), and signs the release. One authoritative
   corpus, published once per version.
2. **Fan-out.** Opens the PRs across the fleet that bump each repo's pin and re-vendor the bytes
   (dependabot-style), turning "the whole org is on v2.1" into a per-repo commit on the operator's
   schedule. It never edits a repo silently; it proposes, the repo's own CI (runward) gates the change.
3. **Fleet compliance view.** Reduces the emitted `check --json` / verdict attestations from every
   repo into "who is on which corpus version, who is in good standing, signed-rule coverage,
   unratified-ADR debt" (roadmap objectives 15-16). Offline, operator-triggered, **reading emitted
   artifacts only** — never a repo's working tree, never a socket into a repo.
4. **Strong anti-forgery of the org corpus.** This is the subtle one, and it belongs HERE, not in
   runward. runward's OWN corpus is forgery-resistant because its authority ships with the tool
   (always present, even under a network-cut run). An org corpus vendored as separate data loses that
   on the repo alone — at a clean checkout the authority is absent, so runward can only catch the
   honest "drifted" mistake, not a deliberate re-signed fabrication (ADR-0057, "What this does not
   claim"). The **strong** guarantee — the non-re-signable authority — is enforced where the authority
   is present: **the org's own CI, `@org/rules` installed, the network cut**, running runward's strict
   gate against the vendored corpus with the published package as authority. The brick is what makes
   that CI check meaningful: it holds the authority the repo cannot.

## The seam — a vendored package, never a wire

The interface between the brick and runward is **versioned data at rest, crossing at install time,
out-of-band from any gate run**. Direction is strictly one-way and asynchronous:

> brick **PRODUCES** `@org/rules@2.1` → operator **INSTALLS + PINS** it → repo **COMMITS** the bytes →
> runward **READS** them.

The install IS the fetch — the operator's step, before and outside the gate, exactly what
[ADR-0054](adr/ADR-0054-the-runtime-boundary-is-explicit.md) requires ("carried as artifacts the
operator owns"). runward then consumes the bytes through the same `rulesDir` fallback it already uses;
the vendored corpus slots in as a third source of the identical shape. This is precisely how runward
distributes ITSELF (its npm package ships `templates/rules`). ADR-0054:113-115 names this seam by
hand: "a registry that vendors the rule package … is the operator's runtime, on the operator's side
of the seam." **runward has no client of the brick: no URL, no socket, no 'check for updates'.** The
pipe is a directory, not a wire.

## How the brick stays clean of runward — the bright line

The one move that would blur runward into the brick: **`runward check` resolving the corpus from the
authority at gate time instead of reading the pinned bytes on disk.** Every crossing is a variant:

- the gate fetching "latest" or "the org's current version" from a URL (the registry ADR-0024:23
  refuses by name);
- a daemon inside runward that auto-pulls or auto-bumps the pin ([ADR-0012](adr/ADR-0012-the-gate-as-a-port-with-harness-adapters.md));
- runward implementing the fan-out or the fleet rollup as a CLI command that reads other repos' trees
  or holds a served aggregate;
- even a `runward corpus publish` / `runward fleet status` subcommand — the authority's verbs inside
  the consumer.

The line, one sentence: **runward may READ and COMPARE a corpus already committed on disk; the instant
it FETCHES, RESOLVES, PUBLISHES, WATCHES, or AGGREGATES a corpus, it has become the brick.** The wall
is structural, not a promise: the moment the brick's needs would add a network primitive to runward's
`src/`, the CI network grep fails the build and the `unshare -n` core tests fail. The gate physically
cannot grow a client, so the brick is free to be as much of a runtime as it wants on its own side.

## What this unlocks — and the structure question it answers

The brick is where "enterprise-grade in practice" becomes buildable code. The 2026-08-12 product
review found that enterprise-grade at the purchase level "is not a code problem" — but that was for
**runward**. For the brick it is: publishing a governed corpus, a fleet dashboard, a corpus-authority
service are real product surfaces. And the seam — a package, never a pipe — is what allows the
**licence split** [ADR-0052](adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md)
anticipated: runward stays MIT, local, free (the adoption, the opposable trust); the brick can carry
the commercial offer and the legal entity (the revenue, the support, the SLA). The two amplify each
other — the brick's value depends on runward's adoption; runward gains value as the brick standardizes
a fleet — while neither can kill the other, because the moat lives in the gate and the runtime lives
in the brick.

## The trigger to build it

Do NOT build speculatively. Build the brick when a real fleet needs one corpus governed centrally —
the ADR-0039 demand signal. Until then, the zero-brick path is fully operable by one maintainer:
option B of ADR-0057 (a committed `runward/rules/` + version stamp + migration records, per repo) runs
inside a single repo with no service at all; option A/C add only a publish step, still no running
process. The blueprint waits here so that the day the trigger fires, the architecture is a reading,
not a scramble — and so that every step of runward's own roadmap is built knowing exactly which side
of the seam it is on.
