# Trial: runward at three commits

The first records of `grille@1`, taken on 2026-11-06 with runward-assess 0.1.0 on a fresh clone of
`stranxik/runward`, read only: `v0.37.1` (2026-09-01), `v0.46.0` (2026-10-28) and `main@32d8425`
(2026-11-05). The profile (`profile.json`) was declared by the assessor; the record says, fact by fact,
what the commit or the snapshot supports.

Each directory holds the measure, the snapshot without the gate it acquired (`tools/`, the runward CLI
built from that commit, is not committed; the manifest keeps its digest), the record, and its two
reports. `evolution.*` compares the three records. The snapshots were all taken on 2026-11-06, while
`main` pointed at `32d8425`: for the two tags, every repository setting the snapshot read is "not
observed", and the external part says why.

These records illustrate the method; they are not kept records (ADR-0123, decision 6).

Re-score one of them, anywhere, to the same bytes:

```sh
A=packages/runward-assess/bin/runward-assess.js
T=packages/runward-assess/trials/runward
node $A score --measure $T/main/measure.json --snapshot $T/main/snapshot --profile $T/profile.json \
  --previous $T/v0.46.0/record.json --label 32d8425 --trigger manual --out /tmp/record.json
shasum -a 256 /tmp/record.json $T/main/record.json
```
