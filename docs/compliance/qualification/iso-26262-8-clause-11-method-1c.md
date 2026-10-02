# Tool classification and tool validation report: runward, ISO 26262-8 clause 11, method 1c (skeleton)

> **Read this first.** This skeleton helps you, the user of runward, produce your own tool
> classification and, where your classification calls for it, your own tool validation report, in
> your context of use. runward does not determine a TQL, a TCL, a tool class or a validation outcome,
> and no body has assessed runward or this template. Every answer below marked **[YOUR ANSWER]** is
> yours. ISO 26262-8:2018 clause 11 could not be read at the source to write this template: the class
> names, the method table and every clause number below come from a vendor briefing reproducing the
> tables, and each carries **[to check against your licensed copy]** (see the Context of
> [ADR-0087](../../adr/ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md)).

## How to use this skeleton

- Part A is your classification of runward for each of your use cases. Part B is your validation
  report, needed only if Part A leads you to a class that asks for qualification methods and you
  choose method 1c, the validation of the software tool.
- Fields marked **[runward fills]** carry what runward can state about itself. Under the qualification
  kit (ADR-0087 decision 1), the kit fills them for its own version. Before the kit, fill them from the
  version you installed and from
  [regulated-adoption.md section 9](../regulated-adoption.md#9-running-runwards-own-suite-on-your-installation-interim).
- [regulated-adoption.md section 8.3](../regulated-adoption.md#83-automotive-and-rail) sets out the
  arguments an assessor would use against runward, adverse case first. Read it before Part A: it
  explains why the arguments for the lower classes are hard to make from the tool alone, and why
  method 1c is the method a supplier without an organisation can support.

---

## Part A. Tool classification

### A.1 Tool identification **[runward fills]**

| Field | Value |
|---|---|
| Name | runward |
| Description | An open source command-line tool that reads a mission's files in a repository and returns a verdict through its exit code. `runward check --strict` exits 0 when every expected rule is accounted for, every typed evidence pointer resolves and the seal is intact; 1 when it refuses (gaps, conformance violations, drift, a broken seal, failed hooks); 2 when the question could not be asked (no mission, a usage error, a refused gesture). It reads files at rest and executes nothing of the project it judges, except the operator's own hooks under `check --hooks`. Contract: `runward/contracts/port-contract.md`. |
| Version | `X.Y.Z` (the kit fills its own version; before the kit, the output of `runward --version` on the installation you ran) |
| Licence | MIT |
| Distribution | npm package `runward`; source at github.com/stranxik/runward, tag `vX.Y.Z` |
| Integrity of the installed package | verified as [verifying-a-release.md](../../verifying-a-release.md) describes, before any other step |
| Runtime | Node.js (the version range in the package's `engines` field); three runtime dependencies (`@inquirer/prompts`, `chalk`, `commander`); `git` for some commands |
| What it is not | It does not generate, compile or modify the item's code. Its declared non-scope is printed in every compliance pack it emits and readable through `runward rules --json` (`GATE_NON_SCOPE`). |

### A.2 Use cases

Classify each use case separately: the same tool can be used in more than one way, and the class
belongs to the use, not to the tool **[to check against your licensed copy]**.

For each use case:

- Which activity or task required by ISO 26262 does it support, in which part and clause?
  **[YOUR ANSWER]**
- Which command and options, at which point of your lifecycle, and which output do you consume (exit
  code, `--json` document, report text)? **[YOUR ANSWER]**
- What does your process do on exit 0, on exit 1, on exit 2? **[YOUR ANSWER]**
- Are the relevant outputs examined or verified for that process step, by whom and how? (If they are,
  say whether clause 11 applies to this use case at all **[to check against your licensed copy]**.)
  **[YOUR ANSWER]**
- Is runward used to tailor your process so that an activity or task required by the standard is
  omitted? (A requirement of clause 11 addresses that case; its subclause number in the 2018 edition
  is not established here **[to check against your licensed copy]**.) **[YOUR ANSWER]**

### A.3 Tool impact

The classes TI1 and TI2: TI1 only where an argument shows that a malfunction of the tool cannot
introduce or fail to detect errors in the item or element being developed **[to check against your
licensed copy]**.

- Can a malfunction of runward, in this use case, fail to detect an error (a green verdict granted
  wrongly)? The defect register records dated cases where it did:
  [known-defects.md](../known-defects.md). **[YOUR ANSWER]**
- Can it introduce an error into the item? (runward does not write the item's code; say what it
  writes in your repository and whether any of it reaches the item.) **[YOUR ANSWER]**
- Your tool impact class, and the argument: **[YOUR ANSWER]**

### A.4 Tool error detection

The classes TD1 to TD3, by the confidence that a malfunction and its erroneous output will be
prevented or detected **[to check against your licensed copy]**.

- Which of **your** measures would detect a wrong verdict: a review of the report, an independent
  second check, a re-derivation, a sample of green verdicts re-examined? **[YOUR ANSWER]**
- How often do they run, and what is their own reliability? **[YOUR ANSWER]**
- Which measures of the tool itself do you rely on, if any (the seal, the typed pointers, the strict
  gate's refusals), and what does the register say about their history? **[YOUR ANSWER]**
- Your tool error detection class, and the argument: **[YOUR ANSWER]**

### A.5 Tool confidence level

The classes TCL1 to TCL3, determined from the tool impact and the tool error detection classes by a
table of clause 11 **[to check against your licensed copy]**.

- Your tool confidence level for this use case, and the table you read it from: **[YOUR ANSWER]**
- If TCL1: no qualification method is required for this use case **[to check against your licensed
  copy]**; record the argument and stop here for it.
- If TCL2 or TCL3: the qualification method or methods you choose, and the ASIL they serve:
  **[YOUR ANSWER]**

The secondary source read lists four methods: 1a increased confidence from use, 1b evaluation of the
tool development process, 1c validation of the software tool, 1d development in accordance with a
safety standard. For TCL2 it marks 1c "+" at ASIL A to C and "++" at ASIL D, and 1a and 1b "++" at
ASIL A to C **[to check against your licensed copy: the method names, the table for TCL2 and TCL3,
and what "+" and "++" require of you]**. Section 8.3 of `regulated-adoption.md` explains why 1a and
1b are weak or closed for runward.

---

## Part B. Tool validation report (method 1c)

The validation of a software tool asks, according to the secondary sources read, for evidence that
the tool meets its specified requirements, an analysis of its malfunctions and their erroneous
outputs with their possible consequences and the measures to avoid or detect them, and an examination
of its behaviour under anomalous operating conditions **[to check against your licensed copy: the
subclause numbers and the exact wording of each requirement]**.

### B.1 Scope

- Which use cases of Part A, at which TCL and ASIL, does this validation cover? **[YOUR ANSWER]**
- The environment in which the validation was performed, and whether it is the environment of use:
  operating system, architecture, Node.js version, `git` version. **[YOUR ANSWER]**

### B.2 The tool's requirements

**[runward fills]** runward's tool operational requirements:
[tool-operational-requirements.md](../tool-operational-requirements.md), one requirement per TOR
identifier, each with the test that exercises it, what a green on it does not assert, and a final
section listing what has no requirement yet. For 0.42.3: TOR-001 to TOR-157, third edition, at
commit `d3a953c`.

- Which of these requirements does each of your use cases rely on? **[YOUR ANSWER]**
- Which properties you rely on have no requirement there, and how do you validate them?
  **[YOUR ANSWER]**

### B.3 Validation results

**[runward fills]** The evidence runward supplies for its version: the qualification kit's
`qualification-report.json` and `junit.xml` (ADR-0087 decision 1). Before the kit, the files the
commands of [regulated-adoption.md section 9](../regulated-adoption.md#9-running-runwards-own-suite-on-your-installation-interim)
leave: `junit.xml`, `unit.txt`, `smoke.txt`, `corpus.json`, `anomalies.txt`. Each result carries its
kind: `interface` (through the `runward` binary only), `internal` (through compiled modules of the
package, which are not a public interface), or `static` (files read as text). Cases that need the
repository's source tree are reported `not-run-here`, never as passed; on 0.42.3 there are nine.

- Cited report: file names, version, date, environment. **[YOUR ANSWER]**
- For each requirement of B.2 you rely on: the result in your environment, and its kind.
  **[YOUR ANSWER]**
- Do you accept `internal` results as validation evidence, or only `interface` results? Why?
  **[YOUR ANSWER]**
- How do you treat the `not-run-here` cases? **[YOUR ANSWER]**
- Which validation of your own exercises the tool on your use cases, beyond runward's suite?
  **[YOUR ANSWER]**

### B.4 Malfunctions, erroneous outputs and their safeguards

**[runward fills]** The known malfunctions: the defect register, [known-defects.md](../known-defects.md),
and the open anomalies for your version, `node scripts/open-anomalies.mjs X.Y.Z` (the kit carries its
result). On 0.42.3, read on 2026-10-02: one open entry and five whose versions the register does not
establish. The declared non-scope: `GATE_NON_SCOPE`, through `runward rules --json`.

- For each open or undetermined entry: does it affect your use case, what erroneous output would it
  produce, and what is your measure to avoid or detect it? **[YOUR ANSWER]**
- For the non-scope: which of its statements bear on your use case, and what covers them?
  **[YOUR ANSWER]**

### B.5 Behaviour under anomalous operating conditions

**[runward fills]** The attack corpus, `test/audit-corpus.js`: missions built and altered so that a
correct gate must refuse them (`REFUSE`) or must accept them (`ACCEPT`), each with a stable identifier
(`AC-001` onward) and the defect or decision it came from. Its JSON result measures regression on a
fixed set of known vectors, every one a defect found and closed, not a detection rate on vectors
nobody has found.

- The corpus result in your environment: **[YOUR ANSWER]**
- Which anomalous conditions of **your** use does the corpus not cover (your repository layout, your
  CI, your file system), and how do you examine them? **[YOUR ANSWER]**

### B.6 Conclusion

- Given Part A and B.1 to B.5, what do you conclude about the validation of runward for the use cases
  of B.1, and on what argument? This conclusion is yours and your assessor's to accept.
  **[YOUR ANSWER]**
- What triggers a new validation (a new runward version, a new environment, a new use case)?
  **[YOUR ANSWER]**
