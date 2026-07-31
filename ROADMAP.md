# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-07-31 (v0.27.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

- **Implement [ADR-0043](docs/adr/ADR-0043-territory-is-declared-in-two-parts.md) — territory declared in two parts.** Ratified 2026-07-31; the decision is settled, the code is not written. Three tiers. **Tiers 1 and 2 ship together as the first increment** — tier 1 alone is inert, since nothing consumes a category until something maps files to it:
  1. **`governs:` on the rule** — the seven-category vocabulary named at ratification (`background-work`, `scheduled-work`, `configuration`, `schema-migration`, `port-adapter`, `model-provider`, `startup`), carried by the nine rules whose territory reaches the client's tree. `appliesTo:` stays on the five whose paths runward scaffolds itself.
  2. **The first derivation adapter** — the Cloudflare Workers manifest (`wrangler.jsonc`/`wrangler.toml`: `main` plus `triggers.crons` and queue consumers). Reads a declaration the operator already wrote; an unknown manifest derives nothing rather than guessing.
  3. **The mission tier** — `runward/territory.md`, a map completing derivation in both directions, on the `hooks.json` regime (outside `MISSION_LAYOUT`, never scaffolded, never refreshed, never written by runward). **Markdown, not JSON**, and the format is forced by the decision rather than chosen: `JSON.parse` destroys line numbers, and the match reason must carry the `<source>:<linenum>` of the `git check-ignore -v` model. Four columns — pattern (the existing glob dialect) · category (the closed seven) · effect (`declare` \| `remove`, because a mission must be able to correct a derivation in both directions) · why (mandatory, the cheapest anti-rot there is). Precedence named, never inferred: last matching row wins per (path, category); derivation < map < a rule's own `appliesTo`, which the map may never narrow.
     Ships **in the same increment**, because ADR-0043's amendment makes it a precondition rather than a follow-up: the **`## Territory coverage` section of `characterize`** — files walked, files carrying a category, map rows that matched nothing with their line numbers. `rules --for` structurally cannot measure inertness (it never learns which files exist), so without this the ratified trigger (b) would have no instrument at all.
  Open at implementation time: whether `governs:` and `appliesTo:` coexist on one rule (they may, by union, but the counters must partition without redefining `unscoped.count`), and the two-level match reason, which must carry the `<source>` component ADR-0041 named as its model and dropped.

## Watching

- **How the `--for` answer is read.** [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)'s own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the split counts, the output shape is wrong, not the operator.
- **Whether the two anchored `topology-*` rules pull their weight.** They were anchored to `execution-topology.md` because runward scaffolds that deliverable itself; if operators find the match noisy on a file that already carries four topology rules, the anchor is too coarse.
- **Rules whose `noTerritory` reason ages.** A declared absence is a decision, not a permanent fact: a rule rewritten to name an artifact becomes anchorable. Fifty of them now carry a reason that can be argued with — that is the point.

## Later

- Community workflow extensions
- More tool profiles (contributions welcome — see CONTRIBUTING.md)
- Legal review of the license split (tooling MIT / doctrine CC BY-ND)
- Submit the Claude Code plugin (runward-gate) to the official plugin directory
  (discoverability; the third-party marketplace channel already works)

## Someday

- Certification / training track (separate, commercial)
- Operator-layer satellite (adoption self-audit, operator cost recipes) — only on a real
  demand signal arriving through a channel (the ADR-0028 watch); never in the MIT CLI
  ([ADR-0039](docs/adr/ADR-0039-the-operator-layer-stays-outside-the-cli.md)). If the
  trigger ever fires, the citable reference frame exists: the AHE loop
  (observe/diagnose/propose/evaluate/promote under HITL) of arXiv 2605.18747 §2.3 —
  a frame, not a demand signal; the trigger stands unchanged
