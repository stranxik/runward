# The open beta: runward on a repository it was not written on

**Decided**: by the maintainer, 2026-11-06; the merge of this page, which waits for the maintainer,
is its record · **Weekly support slot**: _not set yet: the maintainer writes its day, time and time
zone here_ · **Open**: from the day the slot is set, which this page's git history records ·
**Cost**: nothing in money; your time ([below](#what-it-costs)) · **Start**:
[open a beta mission](https://github.com/stranxik/runward/issues/new?template=beta_mission.yml)

runward checks, with plain code, that the engineering decisions behind a repository were made and
written down, and that the evidence each one cites still resolves. It is developed under its own
gate. The beta asks the next question: what does that gate do on a repository runward was not
written on, run by the team that owns it?

## What the beta is

- **Self-service.** No application, no selection, no approval. If the [criteria](#the-criteria)
  hold, you are in: open a beta mission and start.
- **The published package**, pinned, on your repository, run by your team.
- **One public issue per mission**, where your questions, the answers and your feedback live.
- **Free.**

## Who it is for

The same three doors as the [README](https://github.com/stranxik/runward#who-its-for--and-when):

| You are | Where you start |
|---|---|
| A tech lead with a working prototype that must now hold production | `characterize` the existing code, then `init` (the brownfield entry) |
| An operator or consultant delivering an agentic system for a client | `init`: framing first, a conversation with your sponsor, not code |
| A team whose spec is written (Spec Kit, OpenSpec, BMAD or your own) | `spec-check` the spec, then `init`: the spec becomes the input of framing |

The README's anti-cases still apply, as advice and not as a criterion: an already-specified tooling
request with no production stakes, recurring operations (runward hands over, it does not operate),
or a content or assistant use case with no tools and no blast radius. There, the gates would be
ceremony. And the beta crosses no gate and judges no evidence for anyone: the operator owns every
crossing (ADR-0001), in the beta as anywhere else.

## The criteria

All five hold, and nothing else is asked:

1. **A repository you may run tools on, and that the runward maintainer did not write.** Yours or
   your team's, greenfield or brownfield. No production stakes required, no model or agent required.
2. **One person who answers for the mission** on your side: runs the commands, owns each crossing,
   writes the feedback.
3. **The published package, pinned**: `npx --yes runward@0.46.0`, with Node.js 22.12 or later and
   git.
4. **The structured feedback, twice** ([below](#what-is-asked-a-structured-feedback)).
5. **Nothing confidential in the public issue.** If your organisation cannot describe the mission in
   public, take the [private route](#the-private-route).

## What it costs

Nothing in money: no fee, no contract, no account beyond the GitHub one that opens the issue (none
on the private route, except to report a vulnerability: the form SECURITY.md names needs a GitHub
account). The beta changes nothing in runward's MIT licence.

The real cost is your time: running a mission on your repository, and writing two feedbacks. This
page gives no estimate of that time, because none has been measured on a repository the maintainer
did not write. The feedback asks for yours.

## Start

```bash
npx --yes runward@0.46.0 characterize     # existing code: an inventory in runward/characterization.md, your code never modified
npx --yes runward@0.46.0 init             # the mission; the wizard asks where you start
npx --yes runward@0.46.0 check --strict   # the verdict, whenever you want it
```

A spec you already have: `npx --yes runward@0.46.0 spec-check <spec>` checks it, no mission needed.
To watch the gate catch something before you start on your own code, follow
[your first mission](first-mission.md) on the shipped example.

Then [open a beta mission](https://github.com/stranxik/runward/issues/new?template=beta_mission.yml).
Every beta mission opened with the form is public, and so is
[a search for the title the form pre-fills](https://github.com/stranxik/runward/issues?q=is%3Aissue+in%3Atitle+%22beta+mission%22):
keep the `beta mission:` prefix, or the mission drops out of it.

## What is asked: a structured feedback

Two comments in your beta mission issue, each copied from a block below and filled in:

1. **after your first `check --strict` on your own repository**;
2. **when you stop**, whatever the reason, "it was not worth it" included.

```text
### First verdict
- runward version and command:
- Exit code:
- Hours from install to this verdict, your estimate:
- The first red line that named something real (paste it, with any path or name you would not publish replaced), or "none":
- A red you think is wrong, or "none" (and open a bug report for it):
- A green you think should be red: never described here (see below); write "reported privately" or "none":
- What you expected the gate to check, and it did not:
- Next: continue, or stop, and why:
```

```text
### Closing
- How far the mission went (`runward status`, or the last phase crossed):
- Hours spent on the mission, your estimate:
- Bug reports you opened, by number:
- Does the gate stay a required check in your CI? Yes, no, or it never was, and why:
- The one change that would have made it worth more:
- May this feedback be quoted without any name? Yes or no:
```

A red you think is wrong also gets its own
[bug report](https://github.com/stranxik/runward/issues/new?template=bug_report.yml): it jumps the
queue ([SUPPORT.md](../SUPPORT.md)), and once reproduced it becomes an entry of the
[known-defects register](compliance/known-defects.md). **A green you think should be red is
different**: on a published version it may be a vulnerability (S1 in [SECURITY.md](../SECURITY.md)),
so report it only through the
[private vulnerability reporting form](https://github.com/stranxik/runward/security/advisories/new),
never in an issue. On the private route, a wrong red is reported by e-mail, and the maintainer files
it without any name.

What a participant reports is **declared**: their account, not a measurement. Anything published
from the beta says so, and says how many missions it rests on.

## What is given

### A weekly support slot

Once a week, at the time given at the top of this page, the maintainer works through the questions
asked in beta missions since the previous slot, oldest first, as far as the slot goes, and answers
in the issue (by e-mail on the private route). What a slot does not reach comes first in the next
one.

It is time set aside, not a response-time guarantee. [SUPPORT.md](../SUPPORT.md) still holds for
every issue (an acknowledgment within five business days, no SLA), and a security report follows
[SECURITY.md](../SECURITY.md). A slot that cannot be held is announced on this page before it
starts, with the date of the next one.

The slot answers what runward does and fixes what it does wrongly. It does not cross a gate, judge
your evidence, ratify a row or write your mission: those stay yours (ADR-0001).

### The bridge recipe

Without `--hooks`, the gate reads bytes at rest: it executes no project code, runs no test, and
judges no semantics (its own stated non-scope). `check --hooks` runs the commands your
`runward/hooks.json` names, and a failing one fails the gate. The bridge is the path from what a
mission declares to what its code does, and the slot helps you lay it on your repository.

- **Today, with 0.46.0**: [prove a committed JUnit report is fresh, in your CI](recipes/junit-freshness-in-ci.md).
  Your CI regenerates the report your rows cite, and refuses when it records other cases, or other
  verdicts, than the committed one.
- **Planned for the next release**, in two pull requests open on 2026-11-06. Neither is in runward
  0.46.0, the current release, and until a release carries them this section describes them, not
  the package:
  - [#483](https://github.com/stranxik/runward/pull/483): the shipped example cites four reports a
    tool writes (JUnit, LCOV coverage, ESLint JSON and SARIF). Under
    `runward check --strict --hooks`, its hook regenerates them and compares them with the committed
    ones before the gate; the GitHub Action and the GitLab template run the hooks by default. The
    recipe above extends to those four kinds of report; a Cobertura report or a CycloneDX SBOM that
    a mission cites gets no comparison yet.
  - [#484](https://github.com/stranxik/runward/pull/484): built-in analyzers. Under `--strict`, a
    mission that pins `"analysis": "runward-analysis/1"` in its lock has its delivered TypeScript
    and JavaScript read, never run, under the pinned policy: the boundaries it declares,
    capabilities, secrets, test integrity and the symbols it cites.

What the bridge does not prove: that the instrument was left alone. The scripts, the lint
configuration, `runward/hooks.json` and the CI workflow are files in the tree under review; put them
and `runward/` under CODEOWNERS, or under a ruleset that requires review (on GitLab, a CODEOWNERS
approval or a required approval needs Premium: ADR-0094). And a lint rule refuses the shapes it
names; a coverage report says a file ran, never that it was tested well.

## Confidentiality

**The issue is public**, in a public repository, and so is everything written in it, including the
GitHub account that opens it. Write only what you would publish yourself: no code, no secret, no
name of an internal system, a customer or a colleague, no personal data. The form asks for none of
it; it describes a repository by its size, stack and age.

**No name is published without written agreement.** The maintainer does not name you, your
organisation or your repository outside your own issue (in this repository, on runward.dev, in a
post or in a talk) unless you have agreed in writing to that use. An agreement covers the use it
names; withdrawing it stops every later use. Without one, what the beta teaches is published
without names.

**runward sends nothing.** The runward package contains no network code, and a test holds that for
its `src/` and `dist/`
([ADR-0094](adr/ADR-0094-the-forge-adapter-boundary-one-port-github-and-gitlab-at-parity-the-verdict-forge-neutral.md)).
The only commands of yours it runs are the ones your `runward/hooks.json` names, and only under
`check --hooks`. The beta learns what you write, and what anyone can find in public.

### The private route

For a regulated organisation, or anyone who cannot describe the mission in public: do not open the
form. Write to the author's address published at https://thibaultsouris.fr, the route
[SUPPORT.md](../SUPPORT.md) gives for a dated need. Same criteria, same slot, same two feedbacks, by
e-mail, and nothing from the exchange is published without the written agreement above.

Private here means not public: an e-mail exchange with the maintainer, not a confidentiality
agreement. If you need one, or need to know who and what will read the exchange, ask in your first
message; what to sign is the maintainer's decision. Send nothing your own obligations forbid you to
send: the beta needs no code and no data of yours.

A security vulnerability in runward, found during the beta or not, goes only to the
[private vulnerability reporting form](https://github.com/stranxik/runward/security/advisories/new)
([SECURITY.md](../SECURITY.md)): never to an issue, and never to the e-mail route.

## The beta and the pilot of ADR-0052

They are two different things, and the beta changes nothing in the pilot.

| | The beta | The pilot ([protocol](pilot-protocol.md)) |
|---|---|---|
| Who runs runward | your team, on its own | the runward maintainer, as the operator |
| What is measured | nothing under a protocol: the feedback is declared | the cost of a handover: a frozen questionnaire your engineer scores before and after |
| What it asks of you | the mission, and two feedbacks | one engineer, up to 8 hours boxed, twice |
| What is published | nothing named without written agreement | the result, whichever way it points, named to the precision you choose |
| How to join | the [beta mission form](https://github.com/stranxik/runward/issues/new?template=beta_mission.yml) | the [pilot candidate form](https://github.com/stranxik/runward/issues/new?template=pilot_candidate.yml) |

The pilot's protocol, its instruments in [`pilot/`](pilot/) and its candidate form are unchanged:
they were committed before any pilot data existed, and the beta does not edit them.

**One order matters.** The pilot measures a repository as it stands, before the method runs on it.
A repository that already holds a beta mission can no longer give that first measure: if you might
volunteer for the pilot, open the pilot form first.

Nor does the beta move the pilot's deadline. [ADR-0052](adr/ADR-0052-the-survival-thesis-and-the-first-third-party-mission.md)
sets it on 2026-11-17, and it is met by a published pilot result or by retaking the decision; a
beta mission is neither.

## When this page changes

- **A release carries #483 or #484**: the bridge section names that release and stops calling it
  planned. `test/unit/beta-form.test.js` compares the version this page names as the current release
  with `package.json`, so a version bump reddens the suite until someone edits that sentence; the
  test reads the version the sentence names, not what the release carries.
- **Two slots in a row cannot be held**, or more questions wait than one slot reaches: the slot's
  terms are reopened here, dated, rather than kept as a promise nobody keeps.
- **The beta closes**: this page says so, dated, and every open beta mission is told in its issue.

## What this page does not claim

That runward fits your repository: the feedback is where that gets said, either way. That anything
a participant reports is a measurement: it is declared. That the beta is the pilot, or replaces it.
That the bridge has a release date: "planned for the next release" is a plan, not a date.
