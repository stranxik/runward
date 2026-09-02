# Support

runward is maintained by one person, and this page says plainly what that buys you.

## Where to ask

- **A bug, a wrong verdict, a false green**: open a [GitHub issue](https://github.com/stranxik/runward/issues).
  A reproduction (the mission tree, the command, the output you got and the one you expected) turns
  a week of back-and-forth into a fix.
- **A question about the method or a rule**: open a [discussion](https://github.com/stranxik/runward/discussions),
  or read the rule in full first — `runward explain <rule>` prints its why; the answer is often there.
- **A security report**: never a public issue — see [SECURITY.md](SECURITY.md).

## What to expect

Best effort, honestly stated: an acknowledgment within **five business days**, usually much
faster. Wrong-verdict reports (a false green, a false red) jump the queue — they are the product's
whole subject, and each one becomes an entry in the
[known-defects register](docs/compliance/known-defects.md) with what found it and what fixed it.

No SLA is promised here, because an unpaid promise is the kind this project refuses to make.
**A dated need contracts**: if your team needs guaranteed response times, a supported deployment,
or help running a pilot, that is a conversation — contact the author (address published at
https://thibaultsouris.fr), or open the [pilot form](.github/ISSUE_TEMPLATE/) if your case is an
evaluation under ADR-0052.

## What support is not

Support answers questions about what runward does and fixes what it does wrongly. It does not
certify your mission, cross your gates, or judge your evidence — those stay yours, by design
(ADR-0001): the gate reads bytes at rest, and the operator owns every crossing.
