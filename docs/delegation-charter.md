# The delegation charter: `runward/delegation.md`

A delegation charter is the policy under which agents act for one accountable person. The gate reads
it, and it proves nothing by itself
([ADR-0088](adr/ADR-0088-runwards-own-delivery-runs-under-a-delegation-charter-the-gate-reads.md)
decision 5). The person it governs writes it, so every surface that reads it prints, at the character:

- « delegation: declared, not proved — the maintainer's credential is within agent reach » (decision 1,
  stage 1)
- « charter: declared, not proved » (decision 5)

The charter is optional. A mission without `runward/delegation.md` behaves exactly as before: no
section, no JSON key, no SARIF property, no gap.

## Who writes it

The accountable person. Signing, renewing, widening and revoking the charter are class R acts (trust
roots, ADR-0088 decision 2). `runward init`, `runward wire` and `runward update` never create one. To
start, copy the template shipped with the package and fill every field:

```sh
cp node_modules/runward/templates/delegation/delegation.md runward/delegation.md
```

A placeholder left in the template (`<account>`, `YYYY-MM-DD`) is a named gap under `check --strict`.
Commit the charter in its own commit. A widening (a new scope, a smaller sample, a shorter sampling
period) goes in its own commit too and must not ride a renewal.

## Format

A frontmatter block of `key: value` lines, the grammar of the workflow contracts. A list is written
`key: [a, b]`, or `key:` followed by `  - item` lines when an item carries a comma. The prose after
the block is for people; the gate does not read it. Every field below is required unless marked
optional. An unknown, duplicated or misshapen field is a named gap, never repaired.

| Field | Value | Read as |
|---|---|---|
| `charter` | `runward-delegation/1` | the format version this release reads |
| `stage` | `1` or `2` | ADR-0088 decision 1. Stage 2 is a gap in this version (`charter-stage-unread`): its evidence (a separate OS user for agents, commits signed by a key in `allowedSigners`, signed samples) is not read yet, and stage 2 is what the gate checks, not what the charter says |
| `accountable` | a canonical id, e.g. `github:<account>` | the one person who answers for every delegate |
| `aliases` | list (optional) | the other spellings of that person: login, name as written in ratifications |
| `delegates` | list | the agents allowed to act, as `ratify --agent` records them, and the App's forge identity (`<app>[bot]`). A delegate that is a spelling of the accountable person is refused: an agent acts under its own identity (ADR-0082) |
| `class-R`, `class-H` | `maintainer` | trust roots, and judgement owed to a third party: the maintainer's in every stage (`charter-class-refused` otherwise) |
| `class-I` | `refused` (stage 1) | irreversible public acts: not delegated in stage 1 (`charter-class-refused` otherwise) |
| `class-D` | `delegated` or `maintainer` | reversible or internal acts |
| `scope-R`, `scope-H`, `scope-I`, `scope-D` | list (optional) | what each class covers, in words; declared, not interpreted |
| `budget-consecutive-refusals`, `budget-refusals-per-period` | whole numbers ≥ 1 | the escalation budget (decision 9) |
| `sample-size`, `sample-seeds`, `sample-period-days` | whole numbers ≥ 1 | the weekly control (decision 6): acts drawn, seeded defective items, period |
| `effective`, `expires` | `YYYY-MM-DD` | the window; `expires` after `effective`, at most 90 days later |
| `pre-merge-paths` | list, must include `runward/delegation.md` | paths whose changes wait for the maintainer before merge (decision 7), repository-relative |
| `pre-merge-events` | list (optional) | events that wait for the maintainer before merge (decision 7) |

The sample fields drive the weekly sample (below). The budgets and the pre-merge list are data this
release validates and publishes (`check --json`, `delegation.preMerge`); it does not enforce them.
Enforcing them needs the forge, a later change of ADR-0088.

## What the gate reads

`runward check` prints a "Delegation charter" section with the two sentences above, the stage, the
accountable person, the delegates and the window. `check --json` and the attestation predicate carry a
`delegation` block, with and without `--strict`; the SARIF run carries `properties.delegation`; the
delivery report and `runward doctor` print the sentences.

Under `--strict`, each of these is a strict gap (exit 1, ADR-0083), counted in `gaps.charter` and listed
in the `conformance` table with scope `delegation`:

| Kind | When |
|---|---|
| `charter-malformed` | a field is missing, unknown, duplicated, a placeholder, or not of its shape; the window is over 90 days |
| `charter-class-refused` | class R or H is not `maintainer`; class I is `delegated` in stage 1 |
| `charter-stage-unread` | `stage: 2` |
| `agent-not-delegate` | the ratification in force on a decided row was made by an agent the charter does not list (`by:` compared folded) |
| `charter-expired` | the ratification in force on a decided row was made by a delegate on a date after `expires:` |
| `sample-malformed` | a record of `runward/delegation-samples.jsonl` does not re-perform (below); it lands on the ledger, rule `(sample)` |
| `class-suspended` | the ratification in force was made by a delegate after a sample rejected one of its acts |
| `sample-missed` | the ratification in force was made by a delegate on or after the end of the last sample that counts, with two or more periods missed |

An agent ratification dated before `effective:` predates the charter and is not judged by it. A row an
agent ratified outside the charter and a person re-ratified since is not a gap: like the regulated tier,
the gate reads the ratification in force.

`runward ratify` consults the charter on the agent path only: when `runward/delegation.md` exists,
`ratify --agent <name>` (`--list` included) is refused, exit 2, class `refused` (ADR-0083), unless
`<name>` is one of its delegates, compared folded as the gate compares it; a charter whose delegates
cannot be read refuses every agent. It names the charter and writes nothing. Without a charter the
agent path is unchanged. The refusal reads the same declared names as the gate: an agent that edits
the charter, or ratifies under a delegate's name, is not stopped by it (stage 1).

## Expiry, and why the gate has no clock

The verdict path reads no clock: the same working tree gives the same verdict on any day
([ADR-0054](adr/ADR-0054-the-runtime-boundary-is-explicit.md), crossing 4 and its test). A charter
that lapses overnight must not turn yesterday's green tree red with no change committed. So the gate
reads expiry against the dates the tree itself declares: an agent ratification whose entry is dated
after `expires:` is a `charter-expired` gap, on any day the gate runs, and a tree with no act after
`expires:` reads the same before and after the date.

`runward doctor`, outside the verdict path, sets `expires:` beside today's date (the clock every runward
date honours: `RUNWARD_NOW`, then `SOURCE_DATE_EPOCH`, in non-interactive runs). It warns when the
charter has expired and when it expires within 14 days (decision 7), and otherwise says how many days
are left.

Dates in ratification entries are declared too: `ratify` writes the day it ran, and a hand-edited date
is a readable diff, not a proof.

## The weekly sample: `runward/delegation-samples.jsonl`

ADR-0088 decision 6. Once a period, the planter commits a defective item, a draw picks `sample-size`
acts from what happened, the maintainer reviews every item, and the planter reveals which item was the
seed. The ledger is one JSON object per line, append-only, written by `runward sample` and read by the
gate. Every surface prints, at the character, « sample: declared human, not proved »: in stage 1 the
key that signs the review is within agent reach, and the sample never unlocks class I.

### Who does what, each period

| Step | Who | Command | What it writes |
|---|---|---|---|
| plant | the planter: an agent or the operator layer, never the reviewer | `runward sample plant --ref <ref> --summary <text> --defect <text>` | a `seed` record: `H(seed, nonce)` and the drand round the draw will use. The seed and its nonce wait in the git directory (`.git/runward/sample-seeds/`), outside the tree. Commit it before the period ends |
| draw | anyone, after the period ends | `runward sample draw --signature <hex>` | a `draw` record: the population, its counts and hash, the round's signature and randomness, the items, the shipped-code digest. It prints the items to review and the one command to sign |
| review | the maintainer | `runward sample review 1=accept 2=reject …` then `git commit -S` | a `review` record: a verdict per item, the shipped-code digest acknowledged. Refused when the process runs in an agent session (a stop for the honest mistake, environment detection, not proof) |
| reveal | the planter, after the review commit | `runward sample reveal` | a `reveal` record: the seeds and their nonces |

`runward sample` with no action says where the period stands and what comes next, and reads what git
says: whether the review commit is signed (`%G?` against the repository's
`gpg.ssh.allowedSignersFile`), whether each seed was committed strictly before the draw, and whether the
reveal was committed strictly after the review.

The maintainer's weekly act is therefore: read the list `runward sample` prints (the drawn acts, then
every shipped-code merge of the period), then run the one command it prints, changing `accept` to
`reject` where needed:

```sh
runward sample review 1=accept 2=accept 3=reject 4=accept 5=accept 6=accept \
  && git add runward/delegation-samples.jsonl && git commit -S -m "sample: review of the period ending 2026-10-08"
```

### The population, from git

`runward sample draw` reads git, read-only, outside the verdict path (it is in `SPAWN_ALLOWED` beside
`doctor` and `characterize`). From the end of the last sample that counts (or `effective:`) to the
period's end, end excluded, all dates in UTC:

- the first-parent merges on the branch (`--branch`, default `main`), dated by committer time; the count
  is reconciled with a second count of the same commits by their parents, and both are recorded;
- the tags, dated by their creation;
- the ratification entries of the gated deliverables at the branch's tip, dated as they declare.

A merge is **shipped code** when it touches a path of the published package: an entry of
`package.json` `files`, `package.json` itself, `templates/` and `plugins/` (named by decision 7), and
`src/` when `dist` ships, since `dist` is built from it. Every shipped-code merge is listed, 100 %, with
its digest; the review acknowledges that digest (decision 7).

### The draw, and where the randomness comes from

The draw is fixed: one act from each non-empty stratum first (merges, ratifications, tags), then
risk-weighted without replacement (a shipped-code merge and an agent ratification weigh 3, a tag 2, the
rest 1) until `sample-size` acts. Each seed is put at a position the same randomness fixes.

The randomness is a drand round (the quicknet chain, 3-second rounds): the first round emitted at or
after 00:00 UTC on the period's end, so it is announced by arithmetic when the period is, cannot be
known before the period closes, and no agent can choose it. It is never the mission-state digest.
runward opens no socket: whoever runs the draw fetches the round (`runward sample` prints the URL) and
passes its signature. The gate then, offline:

- recomputes the round from the period's end and compares it with the round the seed and the draw name;
- recomputes the randomness from the signature (quicknet is unchained: randomness is SHA-256 of the
  signature) and compares it;
- does **not** verify the signature against drand's public key: that takes a BLS12-381 pairing, which
  Node does not ship, and runward adds no dependency to the verdict path for it. The randomness is
  therefore declared, and every surface carrying the sample says « randomness: declared — the drand
  round is recomputed and its randomness checked against its signature; the signature is not verified
  against drand's public key ». Anyone can verify it with a drand client and the public key the ledger's
  chain names.

### What the gate checks, from the ledger alone

No process, no socket, no git, no clock (ADR-0054). For each period: the seeds were recorded before the
draw, the draw starts on the chain and ends on a period boundary, the population's hash, counts and
dates hold, the draw re-performs from the population and the randomness, the shipped-code digest
recomputes, the review gives every item a verdict and acknowledges the same digest, and the reveal opens
every commitment and puts the seeds where the randomness says. A record that fails any of these is a
`sample-malformed` gap and the sample does not count.

A sample that re-performs is then:

- `control-missed` when a seed was accepted: it does not count (decision 6);
- `rejected` when it caught every seed and rejected an act: it counts, and a delegate whose act was
  rejected has class D suspended from the period's end (`class-suspended` on its later ratifications)
  until a renewed charter starts a new chain (class R);
- `passed` otherwise.

Before the review and the reveal it is `planted`, `awaiting-review` or `awaiting-reveal`: it counts
for nothing and is not a gap. A record whose period ended on or before `effective:` belongs to a
previous charter and is `superseded`.

### Missed periods, and why the gate still has no clock

Periods are fixed by the charter: `effective:`, then every `sample-period-days:`. The samples that count
form a chain; its end is the last one's end (or `effective:`). The gate's only "now" is the latest date
a ratification entry in the tree declares. Every period that ended on or before that date after the
chain's end is missed:

- one missed period: « unsampled since <date> » on `check` (text, JSON `delegation.sample.notice`),
  the SARIF run properties (`delegation.unsampled`), the delivery report and `doctor`;
- two or more: under `--strict`, each agent ratification in force dated on or after the chain's end is
  a `sample-missed` gap on its row, and under the regulated tier agent ratifications since then stop
  counting (`agent-unsampled`).

A sample that counts moves the chain. A late sample covers everything since the chain's end: its
population starts there, however many periods it spans. The same tree reads the same on any day; a
tree where nothing is declared after a period ended reads no missed period, whatever the calendar
says. `runward doctor` and `runward sample` read the periods against today's date instead, so their
notice comes before the gate's.

### The single-accountable exception

Under the regulated tier, a row ratified as `agent (single accountable)` under the lock's
`"singleAccountable"` exception counts only when a `passed` sample covers its date
(`[start, end)` of the sample); otherwise it stays `single-accountable-unsampled` (ADR-0088 decision 4).

## Identities: the charter and the lock

ADR-0088 decision 4 compares accountable persons by canonical id. Until this release the ids lived in
`runward/scaffold-lock.json`, `"identities": { "<canonical id>": ["<alias>", …] }`, as an interim home.
Both are read now. The precedence:

1. Every id the lock declares stays declared, with its aliases: nothing a lock declared stops resolving.
2. The charter's `accountable` id gets the union of the charter's `aliases` and the lock's aliases for
   that id, the charter's first, one spelling per folded name.
3. An alias the charter gives its accountable person is removed from every other id in the lock. On
   the accountable person's own names, the charter wins.

`"singleAccountable"` and the other opt-ins stay in the lock. `runward doctor` says when the charter and
the lock both declare the accountable person.

## What it does not do

- It does not prove who acted. Every name is declared: `by:`, `for:`, the delegates, the dates. In
  stage 1 an agent holding the maintainer's credential can edit the charter, and the banner says so.
- It does not make an agent ratification independent approval, nor a DORA change-approval control
  (ADR-0088, Consequences).
- It does not read git history, the forge or the clock in the verdict path.
- It does not verify the drand round's BLS signature, nor who signed the review commit, in the verdict
  path. `runward sample` reports the commit signature; the drand signature is recorded for anyone who
  verifies it with a BLS library.
