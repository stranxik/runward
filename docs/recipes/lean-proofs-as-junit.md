# Recipe: a Lean proof as a JUnit case a mission row cites

**Status.** Increment 0 of [ADR-0091](../adr/ADR-0091-machine-checked-proofs-as-evidence-a-ratified-statement-a-kernel-checked-proof-read-and-never-run.md).
Documentation, a script and a workflow template for **your** repository. Nothing here changes how the
gate judges a row: the gate reads the JUnit file this recipe produces as it reads any committed JUnit
report, and it never runs Lean (ADR-0054). A dedicated `proof` nature in the gate is increment 1, built
only on the trigger the ADR names.

## What a green case says, and what it does not

A green case written by this recipe says: **in the run that wrote it, `comparator` accepted a proof of
the named theorem against the frozen statement file whose SHA-256 the name carries, the Lean kernel
and a second kernel accepted it, its axioms were the ones the name lists, all within runward's list,
and none of the forbidden constructs appeared in the project's sources.**

It does not say:

- that the statement is the right property. That is a person's judgement, recorded by ratifying the
  row (below);
- that the shipped code behaves like the Lean model. The proof is about the model. The link to the
  shipped code needs its own evidence, a differential test cited with its own `test:` pointer (below);
- that the committed report came from the job it names. A hand-written JUnit file with the right name
  is read by the gate like any other. The defence is outside the gate: the re-run job as a required
  check, and the attestation.

Say "a kernel-checked proof of the ratified statement is recorded in the committed report". Do not
write that the code is correct or verified on the strength of this case alone.

## What you need

- A Lake project (Lean 4) holding a **statement file**, the challenge in `comparator`'s terms: the
  definitions of the model and the theorems with `sorry` as their proofs, and a **solution** module
  restating them with proofs. A worked example is in [lean-proofs/example/](lean-proofs/example/).
- [`comparator`](https://github.com/leanprover/comparator) (Lean FRO), with `lean4export`, `landrun`
  (Linux) and a second kernel, [`nanoda`](https://github.com/ammkrn/nanoda_lib), declared in the
  comparator config under `external_kernels`.
- Node.js, to run [lean-proofs/lean-proof-junit.mjs](lean-proofs/lean-proof-junit.mjs), which you copy
  into your repository.

## The steps

1. **Write and freeze the statement.** Put the model and the theorems in the statement file. Add, for
   each property, a **sensitivity control**: a theorem stating that a stronger variant does NOT hold,
   so a vacuous statement (`True`, contradictory hypotheses) has no proof of its control. List the
   controls in `theorem_names` too. The example's control is `Shop.refund_le_charge_sensitive`.
2. **Configure comparator** with runward's list, exactly:

   ```json
   {
     "challenge_module": "Challenge",
     "solution_module": "Solution",
     "theorem_names": ["Shop.refund_le_charge", "Shop.refund_le_charge_sensitive"],
     "permitted_axioms": ["propext", "Quot.sound", "Classical.choice"],
     "external_kernels": { "nanoda": ["nanoda_bin"] }
   }
   ```

3. **Run the script** from the Lake project, on a machine where nothing has built the solution yet
   (comparator must build it first, inside its sandbox):

   ```sh
   node tools/lean-proof-junit.mjs --config comparator.json --out ../reports/lean-proofs.xml
   ```

   It runs comparator, requires the second kernel, checks the config's axiom list, scans the sources,
   prints each theorem's axioms (`Lean.collectAxioms`, what `#print axioms` reads) and writes one JUnit
   case per theorem. Exit 0 only when every case is green. Commit the report.
4. **Install the reference job** [lean-proofs/lean-proofs.yml](lean-proofs/lean-proofs.yml) as
   `.github/workflows/lean-proofs.yml` in your repository, and make it a **required check**. It
   re-runs step 3 on every pull request, fails when the regenerated report differs from the committed
   one, and attests the report on the default branch.
5. **Cite the case from the row**, and cite the statement file:

   ```
   | <rule> | applied | test:reports/lean-proofs.xml::"lean-proof Shop.refund_le_charge statement-sha256=a51fb4616d6e2473a9ab0ceb4fdf7c7c92c5642331d291884e02d16fec85fec8 axioms=propext"; file:proofs/Challenge.lean; test:reports/junit.xml::"refund: the Lean model and the service agree on generated cases" — the refund never exceeds the charge |
   ```

6. **Ratify the row** with `runward ratify --decided` (or as a proposal under ADR-0066), reading the
   whole statement file, definitions, theorems and controls, not the proofs. ADR-0091 decision 3: a row
   citing a proof requires a bound ratification **in every tier**. Until increment 1, the gate counts
   an unbound ratification only under the regulated tier (`"regulated": true`); outside it, this
   requirement is yours to keep, and the recipe cannot enforce it.

## The case name, exactly

```
lean-proof <Theorem.name> statement-sha256=<64 hex> axioms=<sorted list, or none>
```

- `<Theorem.name>`: the full dotted name from `theorem_names`. The script refuses a name outside the
  plain dotted form (`«…»` names, spaces).
- `<64 hex>`: the SHA-256 of the statement file, CRLF folded to LF, as runward's seal computes a file
  digest, so a Windows checkout reads the same.
- `<sorted list>`: the axioms printed for that theorem, comma-separated, sorted by code point; `none`
  when the theorem uses none. A failed run writes `axioms=unknown`, which no row should cite.

The name holds no `|`, `;`, `"` or `::`, so it fits a manifest table cell and the pointer grammar. The
cell is quoted because the name holds spaces.

## How the statement freeze works

`rowDigest`, the digest a ratification binds to, hashes the row's rule, status and **cell text**; it
does not read the files a cell cites. The statement's SHA-256 is therefore written in the cell, inside
the case name:

| Event | What happens |
|---|---|
| The proof changes, the statement does not | Same digest, same case name, same cell: nothing unbinds. The report must be regenerated, or the required job fails. |
| The statement changes, the cell does not | The regenerated report carries a new digest; the cited case is absent: the gate refuses the row. |
| The statement changes and the cell is rewritten with the new digest | The cell text changed, so `rowDigest` changed: the ratification no longer binds the row, and a person ratifies the new statement. |

Measured on 2026-10-12 with the example: weakening the statement to `refund ≤ charged + 1` and
regenerating the report left the old cell citing a case the report no longer had, and
`runward check --strict` exited 1 (« no JUnit test case named … in the committed report »).

## The axiom list and the forbidden constructs

Axioms: **`propext`, `Quot.sound`, `Classical.choice`** and nothing else. Refused by name: `sorryAx`
(a `sorry` or an elaboration error reached the proof), `Lean.ofReduceBool` and `Lean.trustCompiler`
(the compiler joins the trusted base); any other axiom is refused as a user axiom. No option widens the
list. A project that needs another axiom records the row `deviated` with an ADR rather than citing
this case. Measured on Lean v4.35.0-rc4: `native_decide` shows up as an auxiliary axiom named
`<declaration>._native.native_decide.ax_…`, refused as a user axiom.

Forbidden constructs, matched as whole identifiers in the code with comments removed, independently of
what Lean prints:

| Where | Forbidden |
|---|---|
| every `.lean` file of the project (`.lake/` excluded) | `native_decide`, `implemented_by`, `extern`, `unsafe`, `axiom`, `skipKernelTC` |
| every file but the statement file | `sorry`, `admit` (the statement's own proofs are `sorry` by design) |
| the statement file only | `partial`, `opaque` |

A forbidden word inside a string literal is a false red, named as such in the failure message: the
scan fails on the safe side.

## The link to the shipped code

The kernel checks a proof about the Lean model. Whether your TypeScript, Python or Rust code behaves
like that model is a separate claim, and the honest evidence for it today is a **differential test**:
the same inputs, generated or from a corpus, run through the model (compiled Lean) and the shipped
code, the outputs compared, a disagreement failing the test. Cite its JUnit case with its own `test:`
pointer in the same cell, as in step 5. It shows agreement on the inputs tried, not on all inputs. The
model must avoid `partial`, `unsafe`, `implemented_by`, `extern` and `native_decide`, or the compiled
model is not the definition the kernel checked. Without such a test, write in the cell that the link to
the shipped code is not established.

## What was run, and what was not

Run on 2026-10-12, macOS arm64, toolchain `leanprover/lean4:v4.35.0-rc4`, comparator `ca04cfc7`,
nanoda `0f88b5f3`, the example project:

- installing elan and the toolchain took 6 s; building comparator and lean4export 50 s; nanoda 55 s;
- the script, from a fresh copy: 107 s, both cases green, `axioms=propext` and
  `axioms=Quot.sound,propext`; a second fresh run produced a byte-identical report (60 s);
- `sorry` in the proof, a user `axiom`, and `native_decide`: comparator refused each (« Illegal axiom
  detected »), the scan named the construct, every case red, exit 1;
- an unused `unsafe def` in the solution: comparator accepted, the scan refused, every case red; a
  mission row citing that case: `runward check --strict` exit 1 (« present but not green »);
- a row citing the green case and `file:proofs/Challenge.lean`, without the differential test of
  step 5 (the example has no shipped code), in a mission scaffolded by `runward init --example`:
  `check --strict` exit 0.

Not run: `landrun`. comparator's development shim replaced it on macOS, so **no sandbox was in place**
in this measurement. The workflow template has not been run on a GitHub runner; your first run is its
first measurement. The duration on a Mathlib project was not measured.

## When this recipe changes

The pins follow comparator's releases (it pins its own toolchain and `lean4export`). Lean announced
`lake check --paranoid` for v4.35.0, which re-checks a project with every kernel; when it ships, it can
replace part of the reference job. ADR-0091 lists what reopens the decision.
