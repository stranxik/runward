# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-07-31 (v0.24.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

- **Write `appliesTo:` on the rules whose text prescribes a territory.** [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) shipped with four seeded (`async-job-guardrails`, `async-scheduled-maintenance`, `config-secrets-boundary`, `data-migrations-forward-only`): the primitive is complete, its coverage is not, and every `--for` run says how many rules it could not evaluate. The remaining work is editorial and deliberately slow — a territory is written when a rule's own text is about a specific artifact class, never by quota (the ADR-0020 discipline), and never invented for a rule that prescribes no path. Candidates worth weighing next: the `data-memory-*` family, `state-event-sourcing`, `observability-structured-json-logs`, `scaling-db-connection-pooling`.
- **Watch how the `--for` answer is read.** ADR-0041's own reopening trigger (a): if the list is taken as exhaustive despite the standing caveat and the unscoped count, the output shape is wrong, not the operator.

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
