# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-07-31 (v0.23.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

Two candidate decisions from the Dropyour field report (2026-07-31), each with a dated
ratification trigger — a candidate that is neither accepted nor rejected by its date lapses to
`rejected`, so neither can sit half-open:

- **Ratify or reject [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md)** — craft-rule confrontation is continuous, not a crossing ritual. Shipped in v0.23.0 as a method change (`iterate.md` carries the step); the decision behind it is still a candidate. **By 2026-10-01.**
- **Ratify or reject [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md)** — `runward rules --for <paths>`, matching on a territory the rule declares (`appliesTo:`), with the matched pattern rendered. Nothing is implemented: ratification comes first, then the code (~7 files), then the editorial work of writing `appliesTo` rule by rule, soberly, where a rule's text prescribes a territory. **By 2026-11-01.**

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
