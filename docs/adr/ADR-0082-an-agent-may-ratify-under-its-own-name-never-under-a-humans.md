# ADR-0082 — An agent may ratify, under its own name, never under a human's

**Date**: 2026-09-27
**Status**: accepted 2026-09-28 — the recommended direction, chosen by the maintainer, who opened the question on 2026-09-27 (« ça peut très bien être un autre agent IA qui va ratifier aussi, pas forcément un humain »)
**Deciders**: the maintainer
**Method**: the current doctrine read against the code; the ratification of runward's own mission on 2026-09-27 as the one measured session; the forges' own answer to the same question

## Context

**What the product says today.** A ratification is the operator answering displayed evidence
(ADR-0066 decision 4). `ratify` refuses a terminal-less run; the only way through without one is
`--attest-blind`, recorded `mode: BLIND`. The charter tells agents to propose and never to run
`ratify` (ADR-0066 decision 3, `AGENTS.md`). Under the regulated tier a BLIND ratification does not
count (ADR-0080), so an agent working a regulated mission has no path at all: the gate's Next line
sends it to `ratify --decided`, which refuses it, and `--attest-blind` leaves the rows counted.

**What the product cannot tell.** A `### Ratification` line typed by hand, or `ratify` driven by a
script through a pseudo-terminal, produces the same line-by-line trace as a person at the keyboard
(RWD-2026-0119). So an agent can already ratify: it just has to do it under a human's name, which is
the one outcome every other rule here exists to prevent. Forbidding the gesture does not stop it; it
only removes the honest way to make it.

**What the maintainer said.** The reader of a refusal, and the one who ratifies, may be another
agent, not necessarily a human. The CLI audit of 2026-09-27 found every surface written for a human
at a terminal, and the agent path ending in a refusal or in BLIND.

**What the forges did with the same question.** GitHub's answer to "may an AI approval count" moved
on 2026-09-01: « When enabled, Copilot can submit an approval that counts toward the repository's
required-approvals rule. » It is off by default (« By default, Copilot will not approve pull
requests »), administrators enable it at enterprise, organisation or repository level, and the
review is Copilot's own, never a person's. Its separate rule still holds: the person who asked the cloud agent for the
change cannot approve it. The pattern is: allowed, labelled, off by default, and never by the party
that did the work.

## Decision

**An agent may ratify, as itself.** `ratify --agent <name>` runs without a terminal, resolves and
records the same evidence a person would be shown, and writes the trace with `mode: agent` and
`by: <name> (declared, agent)`. It never writes a human's name, and `ratify` without `--agent` keeps
refusing a terminal-less run.

1. **Labelled everywhere.** The ledger counts agent ratifications apart (`ratification.agent`), and
   `check`, the JSON, the SARIF and the attestation say how many rows an agent ratified. A reader
   never has to infer it.
2. **Never the party that proposed.** An agent ratification of a row whose proposer segment names the
   same agent is refused. Both names are declared, so this stops the honest mistake, not the liar
   (RWD-2026-0119 applies unchanged).
3. **Counts by default, not under the regulated tier.** In a default mission an agent ratification
   is a ratification, disclosed. Under the regulated tier it counts only if the mission's lock also
   declares `"agentRatification": true`: the organisation's explicit choice, off by default, the
   forge's shape. Without it, an agent-ratified row stays a strict gap there, named as such.
4. **The charter follows.** `AGENTS.md` and ADR-0066 decision 3 change from "never run `ratify`" to
   "never ratify under a human's name; ratify only with `--agent`, only rows you did not propose".

> **Amended 2026-09-28: the trace names the person accountable for the agent.** Chosen by the
> maintainer after a sourced check of how agent identity works where it already exists. Every forge
> and directory that gives an agent its own identity also records a person answerable for it: the
> GitHub cloud agent authors its commits and marks the requesting developer as co-author, GitLab's
> composite identity puts a service account and « The person who initiated the request » in one
> token, for Microsoft Entra « At least one sponsor is required for each agent identity », and OAuth token
> exchange (RFC 8693) keeps the agent as actor beside the person as subject. None has an agent with
> no one behind it, and none lets an agent act under a person's credentials. So:
>
> - **The trace carries two names.** `ratify --agent <name> --for <person>` writes
>   `by: <name> (declared, agent)` and `for: <person> (declared, accountable)`; `--for` is mandatory.
>   Both are declared; the forge alone proves accounts (ADR-0080).
> - **Decision 2, extended.** Refused when the agent, or its accountable person, is the row's
>   proposer.
> - **Decision 3, extended.** Under the regulated tier, `agentRatification` counts an agent
>   ratification only when its accountable person differs from the proposer. The independence
>   DORA's RTS 2024/1774 art. 17(1)(b) asks of the « functions » that approve and implement is,
>   read here, that of the person answerable for the agent, not of the agent (no text says so; it
>   is this ADR's reading). It never relaxes ADR-0080 part 2: the forge approval still requires a
>   human account, not a bot or an app.
> - **Consequences, added.** ANSSI's PA-102 recommendation R30 asks that a human regularly review
>   AI-generated code; for an organisation that follows it, the human-sample alternative discarded
>   below stays the documented choice. The AI Act's human oversight (art. 14) is exercised « by
>   natural persons » on a high-risk system in use; it does not address the tools that built it, and
>   this ADR does not claim otherwise.

## Alternatives discarded

- **Keep "agents never ratify".** It holds only on paper: the gesture is already possible under a
  human's name, and an agent on a regulated mission is left with a Next line it cannot follow.
- **Let an agent ratify as the operator, by delegation.** A delegation the trace does not show is the
  false record this ADR exists to prevent.
- **Agent ratification with a mandatory human sample.** Heavier, and it needs a second, human gesture
  per session; it is the natural next step if agent ratifications turn out to be caught wrong.

## Consequences

- **Positive.** An agent-built mission gets an honest path to green, and the attestation says which
  rows a person answered and which an agent did, the question an assessor asks first.
- **Negative, accepted.** A mission may cross the default gate with no human answer at all; the
  label is the only safeguard there, and the regulated tier stays the place where that is refused.
- **On other boundaries.** No model call enters runward: the agent runs `ratify`, runward does not
  run an agent. The verdict path is unchanged except for one more disclosed counter.

## What would settle it

Chosen on 2026-09-28. What would reverse it, on use: whether agent
ratifications are later found wrong more often than human ones on the same missions (the ADR-0052
pilot is the first place to count it), and whether a regulated organisation accepts
`agentRatification` or asks for the human sample instead.

## Reevaluation trigger (mandatory, dated)

Reopen if a forge or a supervisor states whether an AI approval may stand for a human one
in change management, or if agent-ratified rows are caught wrong where human-ratified ones are not.

**Trigger set on**: 2026-09-27 · **Watched via**: the `ratification.agent` counter on this
repository's mission and on the pilot; forge changelogs.

## References

- [ADR-0066](ADR-0066-a-manifest-row-can-be-proposed-and-a-proposal-never-crosses.md) — ratification, decisions 3 and 4, which this would amend.
- [ADR-0080](ADR-0080-the-regulated-tier-the-repository-disciplines-the-forge-proves.md) — the regulated tier, where agent ratification stays off unless declared.
- RWD-2026-0119 — why the trace cannot tell who ratified.
- GitHub changelog, 2026-09-01: Copilot code review can approve pull requests (off by default).
- The accountable-person amendment's sources: GitHub, [cloud agent risks and mitigations](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations); GitLab, [composite identity](https://docs.gitlab.com/user/duo_agent_platform/composite_identity/); Microsoft, [Entra agent owners, sponsors and managers](https://learn.microsoft.com/en-us/entra/agent-id/agent-owners-sponsors-managers); [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html); ANSSI, [recommandations de sécurité pour un système d'IA générative](https://messervices.cyber.gouv.fr/documents-guides/Recommandations_de_s%C3%A9curit%C3%A9_pour_un_syst%C3%A8me_d_IA_g%C3%A9n%C3%A9rative.pdf) (R30).
