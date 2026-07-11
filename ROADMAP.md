# Roadmap

Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md). This file lists only what is ahead.

## In progress

- English pass on the `floor-ts/` documentation.

## Next

- `runward status`: richer phase tracking read from the mission files (gate history, dates)
- **CLI as a transmission surface** — audit that every command (`init`/`check`/`status`/`doctor`/`update`/`characterize`/`compliance`) emits clear, actionable next-step guidance in its output, so the operating agent can transmit "what the operator must decide next" to the human. A command that does work but names no next gesture breaks the transmission chain. See the operator-ratification loop in [docs/retro-documentation.md](docs/retro-documentation.md).

## Later

- Community workflow extensions
- More tool profiles (contributions welcome — see CONTRIBUTING.md)
- Legal review of the license split (tooling MIT / doctrine CC BY-ND)

## Someday

- Documentation site, content, release cadence — recurring cost, needs an owner
- Certification / training track (separate, commercial)
