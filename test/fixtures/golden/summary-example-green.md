<!-- runward:report-md · subject <digest12> -->
## runward gate: CLEAN

**Verdict: CLEAN**, exit code 0 (clean: the job passes). Exit code 0 is clean, 1 is gaps, 2 means the question could not be asked (no mission, a usage error or a refused gesture), never a red gate.

runward `<version>` · strict verdict · current gate: all gates passed · 3 architecture decision record(s)

| What | Reading | Standing |
|---|---|---|
| Verdict | **CLEAN** | computed by `runward check --strict` on this tree; unsigned, re-derivable below |
| Deliverable gaps | 0 | computed by the gate |
| Rule-conformance gaps | 0 | computed by the gate |
| Evidence rows | 46: 24 applied, 0 deviated, 22 n/a | 22 typed pointer(s) resolved by the gate; 2 prose row(s) declared, never verified; 5 signature-checked |
| Ratification | 0 traced: 0 line-by-line, 0 en bloc, 0 blind; 46 untraced | declared: names and dates as the tree writes them; runward cannot tell who answered |
| Evidence seal | absent (opt-in) | nothing is compared with a previous state |
| Assurance mode in force | none | no delegation charter: not-observed |
| Attestation subject | `<digest>` | unsigned: runward never signs and never verifies a signature |

### Gaps by kind

No gap: every expected deliverable is filled and every CRITICAL/HIGH rule mapped to a crossed phase is accounted for.

### Ratification (declared)

No decided row is ratified blind or changed since its ratification. 46 decided row(s) carry no trace; `runward check --strict --json` lists them under `ratification.byRow`.

**Next.** Assemble the evidence pack with runward compliance &lt;regime&gt; (iso-42001 · nist-ai-rmf · eu-ai-act), or runward status for a handover snapshot.

### Re-derive this verdict

The attestation's subject digest is `<digest>` (SHA-256 over the mission tree and the evidence files it cites).
On a checkout of the same commit, with no account and no network beyond the package registry:

```sh
npx runward@<version> check --strict --attest > verdict.intoto.json
npx runward@<version> verify verdict.intoto.json
```

`subject[0].digest.sha256` in the attestation must equal the digest above, and `verify` re-derives every field of the verdict from the tree. This summary computes nothing: every number in it is a field of `check --strict --json`.

**What the gate does not cover.** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing. A ratification trace records that someone declared answering the displayed evidence; runward cannot tell who, or whether a person answered at all, and it never proves they understood it.

_Rendered by `runward report --format md` (ADR-0093, ADR-0094): deterministic, no network, no clock._
