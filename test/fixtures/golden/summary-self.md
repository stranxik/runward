<!-- runward:report-md · subject 2287b8c94ac0 -->
## runward gate: CLEAN

**Verdict: CLEAN**, exit code 0 (clean: the job passes). Exit code 0 is clean, 1 is gaps, 2 means the question could not be asked (no mission, a usage error or a refused gesture), never a red gate.

runward `0.43.1` · strict verdict · current gate: all gates passed · 4 architecture decision record(s)

| What | Reading | Standing |
|---|---|---|
| Verdict | **CLEAN** | computed by `runward check --strict` on this tree; unsigned, re-derivable below |
| Deliverable gaps | 0 | computed by the gate |
| Rule-conformance gaps | 0 | computed by the gate |
| Evidence rows | 46: 21 applied, 3 deviated, 22 n/a | 20 typed pointer(s) resolved by the gate; 1 prose row(s) declared, never verified; 5 signature-checked |
| Ratification | 48 traced: 2 line-by-line, 46 en bloc, 0 blind; 0 untraced | declared: names and dates as the tree writes them; runward cannot tell who answered |
| Evidence seal | absent (opt-in) | nothing is compared with a previous state |
| Delegation charter | stage 1 | declared: delegation: declared, not proved — the maintainer's credential is within agent reach; charter: declared, not proved |
| Assurance mode in force | `sampled` | declared, not degraded: assurance: sampled. A person reviewed 5 drawn acts and 1 seeded defect(s) per 7-day period; last period: control missed |
| Sample ledger | present | declared: sample: declared human, not proved; randomness: declared — the drand round is recomputed and its randomness checked against its signature; the signature is not verified against drand's public key |
| Forge approval | not verified | this command has no forge to ask (ADR-0080 part 2) |
| Attestation subject | `2287b8c94ac0ce0984a45a84468c4cdc9a2d16223c76bcb4a03ccb7165efd8e0` | unsigned: runward never signs and never verifies a signature |

### Gaps by kind

No gap: every expected deliverable is filled and every CRITICAL/HIGH rule mapped to a crossed phase is accounted for.

### Ratification (declared)

No decided row is ratified blind or changed since its ratification.

Ratifiers, as the tree declares them: `Thibault Souris`, `thibaultsouris`.

**Next.** Assemble the evidence pack with runward compliance &lt;regime&gt; (iso-42001 · nist-ai-rmf · eu-ai-act), or runward status for a handover snapshot.

### Re-derive this verdict

The attestation's subject digest is `2287b8c94ac0ce0984a45a84468c4cdc9a2d16223c76bcb4a03ccb7165efd8e0` (SHA-256 over the mission tree and the evidence files it cites).
On a checkout of the same commit, with no account and no network beyond the package registry:

```sh
npx runward@0.43.1 check --strict --attest > verdict.intoto.json
npx runward@0.43.1 verify verdict.intoto.json
```

`subject[0].digest.sha256` in the attestation must equal the digest above, and `verify` re-derives every field of the verdict from the tree. This summary computes nothing: every number in it is a field of `check --strict --json`.

**What the gate does not cover.** A green row proves a decision was traced to resolving, non-empty (and, if signed, shape-matching) evidence. It never proves the evidence truly implements the rule: the gate reads bytes at rest — it does not execute project code, run tests, or judge semantics. That judgment stays with the operator at the gate (ADR-0001, ADR-0005). Nor does a green row travel forward in time: the operator's judgment was made about the code that existed when the row was written. Every run re-verifies that the cited evidence still resolves and (if sealed) has not drifted, but code added later under the same rule is never re-judged — the gate has no signal that new work fell under an already-accounted-for rule. Confront the rules at the point of action, not only at the crossing. A ratification trace records that someone declared answering the displayed evidence; runward cannot tell who, or whether a person answered at all, and it never proves they understood it.

_Rendered by `runward report --format md` (ADR-0093, ADR-0094): deterministic, no network, no clock._
