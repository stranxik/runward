# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

Last groomed: 2026-07-31 (v0.23.0) — a packaging test fails the build if this stamp lags the
package version, so this file can no longer rot silently (it had, from v0.14.2 to v0.21.0:
the floor-ts English pass and the documentation site were both long shipped and still listed).

## Next

- **Implement [ADR-0041](docs/adr/ADR-0041-rules-for-paths-declared-territory-with-a-named-match-reason.md) — `runward rules --for <paths>`.** Ratified 2026-07-31; the decision is settled, the code is not written. Roughly seven files: the optional `appliesTo:` glob field on the rule, the matcher, `matchedBy` + `selector` in the `--json` envelope, the unscoped count and the standing caveat in both surfaces, the CLI flag, tests, and the `port-contract.md` update. No rule-set migration (an optional frontmatter field is additive — the ADR-0040 precedent). Then the editorial pass: `appliesTo` written rule by rule, soberly, only where a rule's text prescribes a territory — never by quota (the ADR-0020 discipline). Open at implementation time: the glob dialect and its cross-OS input normalisation, and the documented base for resolving a relative path in a monorepo.
- Until it lands, "confront at the point of action" rests on the coarse gesture shipped in v0.23.0 with [ADR-0042](docs/adr/ADR-0042-craft-rule-confrontation-is-continuous-not-a-gate-crossing-ritual.md): `runward rules --phase <phase>` — twelve rules where three might apply.

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
