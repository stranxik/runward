# Governance

runward is a small, deliberately scoped project. This document states how it is
run so contributors know what to expect.

## Roles

- **Maintainer.** Thibault Souris maintains runward. The maintainer sets
  direction, reviews and merges changes, and cuts releases. runward is
  solo-maintained today; this document will be revised if that changes.
- **Contributors.** Anyone opening an issue or a pull request. Contributions are
  welcome within the scope below. See [CONTRIBUTING.md](CONTRIBUTING.md).

## How decisions are made

- **Defaults move on evidence, not on preference.** A change to the method, a
  craft rule, or a default is justified by an objective trigger or a measured
  gain, not by taste. Requests are asked to name the problem and the trigger
  before the solution.
- **Structural decisions are recorded.** Anything that changes the architecture
  of the tool is captured as an ADR under [`docs/adr/`](docs/adr/), dated, with
  the reason and a review trigger. The ADR journal is the record of *why*.
- **The maintainer decides.** On disagreement, the maintainer makes the call and
  explains it. Discussion happens in the open, in issues and pull requests.

## Scope, and the doctrine boundary

runward is the **tooling** of the doctrine *Designing and Running Agentic
Systems*. The two are governed differently, on purpose:

- The **tooling** (this repository: CLI, templates, workflows, craft rules,
  examples, the `floor-ts` scaffold) is **MIT**. Fork it, adapt it, contribute.
- The **doctrine** text is a separate work under **CC BY-ND 4.0**, kept in
  [its own repository](https://github.com/stranxik/designing-and-running-agentic-systems).
  It accepts no derivative text. Contributions to runward must not copy doctrine
  text; short, attributed quotations inside original MIT prose are the limit.
  See [NOTICE.md](NOTICE.md).

## Security

Security reports follow [SECURITY.md](SECURITY.md): report privately, disclosure
is coordinated.

## Releases

Releases are cut by the maintainer, tagged with semver, and documented in
[CHANGELOG.md](CHANGELOG.md) with named GitHub release notes. The published npm
package tracks the `main` branch.
