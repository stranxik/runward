# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-07-31 (v0.25.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

- **Anchor the seven rules that target a real artifact but name no path.** The 2026-07-31 editorial pass ruled on all 64 rules (12 declare a territory, 45 declare they have none with a reason). These seven could not be ruled on, because each aims at a concrete artifact while its own text prescribes no location — a glob would be inference presented as an auditable fact: `async-post-turn-pipeline`, `contracts-governance`, `data-orphan-cleanup`, `observability-alert-configuration`, `scaling-db-connection-pooling`, `topology-sovereignty-by-data-class`, `topology-usage-registry-present`. **The fix is a sentence in each rule's text, not a decision in the matcher** — for instance naming the mission file that holds a sovereignty level, or the module where a connection pool is created. `topology-usage-registry-present` is the odd one out: it requires an artifact `MISSION_LAYOUT` does not host yet, so it needs a deliverable decision first. A test pins the list so it cannot grow in silence.
- **Watch how the `--for` answer is read.** ADR-0041's own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the split counts, the output shape is wrong, not the operator.

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
