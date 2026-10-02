# Governance

runward is a small, deliberately scoped project. This document states how it is
run so contributors know what to expect.

## Roles

- **Maintainer.** Thibault Souris maintains runward and is its one accountable
  person. The maintainer sets direction, answers for every change merged and
  publishes releases. runward is solo-maintained today; this document will be
  revised if that changes.
- **Agents.** Coding agents do most of the work: they write changes, open pull
  requests and merge them. Today they act under the maintainer's account,
  because agent sessions hold the maintainer's credential, so the forge cannot
  tell the maintainer's acts from an agent's. Once the `runward-steward` GitHub
  App is installed on this repository, delegated acts run under the App's own
  identity ([ADR-0088](docs/adr/ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md),
  stage 1). That changes who the forge names, not what anyone can do.
  Delegation: declared, not proved, while the maintainer's credential is within
  agent reach.
- **Contributors.** Anyone opening an issue or a pull request. Contributions are
  welcome within the scope below. See [CONTRIBUTING.md](CONTRIBUTING.md).

## One accountable person

With one accountable person, no approval on this repository is independent. An
agent's ratification of a mission row, and an approval the forge records on a
pull request (from the maintainer's account today, from an App later), are
disclosed throughput, not independent approval. The forge's "approved" does not
carry that disclosure, so it is stated here. This is not a DORA change-approval
control: nothing here separates the function that approves a change from the
one that implements it. runward's SLSA Source level is not measured yet, and
none is claimed; its highest level asks for two trusted persons, which one
maintainer cannot provide.

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

Releases are tagged with semver and documented in [CHANGELOG.md](CHANGELOG.md)
with named GitHub release notes. A pushed tag prepares a draft release, and the
maintainer publishes it from their own session
([ADR-0085](docs/adr/ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md));
that is a rule the project follows, not one the forge enforces, since agent
sessions can reach the same credential today. The published npm package tracks
the `main` branch.

## Ownership and escalation

The owner of this project is its single maintainer (see above) — every verdict surface, release
and key decision routes to that one person. Escalation path: a security report goes through
SECURITY.md's process; anything else is a GitHub issue on this repository. There are no long-lived
credentials to hand over or revoke at succession: publishing is OIDC trusted-publishing bound to
this repository's release workflow, so succession is repository ownership itself. The bus factor
of one is stated as a known, priced risk in docs/compliance/regulated-adoption.md — read it before
depending on continuity.
