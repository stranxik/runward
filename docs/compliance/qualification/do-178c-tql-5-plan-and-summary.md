# Tool qualification plan and tool accomplishment summary: runward, DO-178C criteria 3 (skeleton)

> **Read this first.** This skeleton helps you, the applicant, produce your own tool qualification
> plan and tool accomplishment summary for your use of runward, in your context of use. runward does
> not determine a TQL, a TCL, a tool class or a validation outcome, and no body has assessed runward
> or this template. Every answer below marked **[YOUR ANSWER]** is yours; every statement marked
> **[to check against your licensed copy]** comes from a secondary source, because DO-178C and DO-330
> were not read at the source to write it (see the Context of
> [ADR-0087](../../adr/ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md)).

## How to use this skeleton

- It assumes you have already decided, in Part 0, that your use of runward needs tool qualification
  and that criteria 3 applies to it. If either answer is no, this skeleton is not the document you
  need; Part 0 says what to record instead.
- Fields marked **[runward fills]** carry what runward can state about itself. Under the qualification
  kit (ADR-0087 decision 1), the kit fills them for its own version. Before the kit, fill them from the
  version you installed and from
  [regulated-adoption.md section 9](../regulated-adoption.md#9-running-runwards-own-suite-on-your-installation-interim).
- DO-330 is written for both the tool developer and the tool user. Here, every objective is treated as
  yours: runward has no tool developer data under DO-330 (no tool plans, no tool design description,
  no configuration index), as
  [regulated-adoption.md section 8.4](../regulated-adoption.md#84-airborne-software) records.

---

## Part 0. Before the plan: does qualification arise, and under which criteria

What was read at the source: FAA AC 20-115D (21 July 2017), §10, states that section 12.2 of
DO-178C and DO-330 "provide an acceptable method for tool qualification", that DO-330 "contains its
own complete set of objectives, activities, and life cycle data for tool qualification", and in
§10.c(1) that DO-178C "establishes five levels of tool qualification based on the tool use and its
potential impact". EASA AMC 20-115D §10 carries the same sentence on DO-330. FAA Order 8110.49A,
definition 7.n: "Tool qualification is the process necessary to obtain certification credit for a
software tool within the context of a specific airborne system".

**0.1 Does qualification arise at all?** AC 20-115D §10.a directs you to the criteria of DO-178C
section 12.2 **[to check against your licensed copy]**.

- Does any DO-178C process in your plans get eliminated, reduced or automated on the strength of
  runward's verdict, without its output being verified? **[YOUR ANSWER]**
- If no: record in your plan for software aspects of certification that runward is used as an
  engineering discipline and that no DO-178C objective credit is claimed from its verdict. No tool
  qualification arises, and the rest of this skeleton does not apply.
- If yes: name each process and each objective concerned. **[YOUR ANSWER]**

**0.2 Which criteria?** The criteria 3 wording, a tool that "could fail to detect an error", is taken
from a vendor briefing reproducing DO-178C section 12.2 **[to check against your licensed copy]**.
The line between criteria 3 and criteria 2 is whether the tool's output is also used to justify
eliminating or reducing verification processes *other than those the tool automates*, or development
processes that could affect the airborne software **[to check against your licensed copy]**.

- Which verification activity does runward's verdict automate in your process? **[YOUR ANSWER]**
- Is a green verdict used to shorten any review, test or analysis that runward does not itself
  perform? If yes, your use is not criteria 3, and this skeleton does not fit it. **[YOUR ANSWER]**
- Who checks, and how often, that the use has not drifted from criteria 3 (for example, a review
  shortened because the gate was green)? **[YOUR ANSWER]**

**0.3 Which TQL?** DO-178C relates the criteria and the software level to a tool qualification level
in a table of section 12.2 **[to check against your licensed copy]**. AC 20-115D Table 2, read at the
source, maps a verification tool under criteria 3, at every software level, to TQL-5; that table is a
transition table for tools whose qualification was obtained under DO-178B, not DO-178C's own table.

- Software level of the airborne software concerned: **[YOUR ANSWER]**
- TQL you determine, and the table you read it from: **[YOUR ANSWER]**

---

## Part A. Tool qualification plan

### A.1 Purpose and scope

- Which airborne software, which project and which certification basis does this plan cover?
  **[YOUR ANSWER]**
- Which other plans reference this one (your plan for software aspects of certification, your
  software verification plan)? **[YOUR ANSWER]**

### A.2 Tool identification **[runward fills]**

| Field | Value |
|---|---|
| Name | runward |
| Description | An open source command-line tool that reads a mission's files in a repository and returns a verdict through its exit code. `runward check --strict` exits 0 when every expected rule is accounted for, every typed evidence pointer resolves and the seal is intact; 1 when it refuses (gaps, conformance violations, drift, a broken seal, failed hooks); 2 when the question could not be asked (no mission, a usage error, a refused gesture). It reads files at rest and executes nothing of the project it judges, except the operator's own hooks under `check --hooks`. Contract: `runward/contracts/port-contract.md`. |
| Version | `X.Y.Z` (the kit fills its own version; before the kit, the output of `runward --version` on the installation you ran) |
| Licence | MIT |
| Distribution | npm package `runward`; source at github.com/stranxik/runward, tag `vX.Y.Z` |
| Integrity of the installed package | verified as [verifying-a-release.md](../../verifying-a-release.md) describes, before any other step |
| Runtime | Node.js (the version range in the package's `engines` field); three runtime dependencies (`@inquirer/prompts`, `chalk`, `commander`); `git` for some commands |
| What it is not | It does not generate, compile or modify airborne code. Its declared non-scope is printed in every compliance pack it emits and readable through `runward rules --json` (`GATE_NON_SCOPE`). |

Your operational environment, the one the results in A.8 must come from:

- Operating system, architecture, Node.js version, `git` version: **[YOUR ANSWER]**
- How the installed version is pinned in your environment (lockfile, mirror, offline copy):
  **[YOUR ANSWER]**

### A.3 Use of the tool in your life cycle

- Which command and options do you run, at which point of the life cycle? **[YOUR ANSWER]**
- Which of its outputs do you consume: the exit code, the `--json` document, the report text?
  **[YOUR ANSWER]**
- What does your process do on exit 0, on exit 1, on exit 2? **[YOUR ANSWER]**
- Who reads the report, and what do they check that the verdict does not? **[YOUR ANSWER]**

### A.4 Qualification need and criteria

Carry over Parts 0.1 and 0.2, with their justification. **[YOUR ANSWER]**

### A.5 Tool qualification level

Carry over Part 0.3. **[YOUR ANSWER]**

### A.6 Tool operational requirements

Your tool operational requirements state what you need the tool to do in your use. runward publishes
its own: [tool-operational-requirements.md](../tool-operational-requirements.md), one requirement
per TOR identifier, each with the test that exercises it and what a green on it does not assert, and
a final section listing what has no requirement yet. They are an input to yours, never a substitute.
**[runward fills]** For 0.42.3: TOR-001 to TOR-157, third edition, at commit `d3a953c`.

- Which of your requirements rely on which runward TOR identifiers? (A table of your requirement,
  the TOR identifiers it relies on, and your own verification where none applies.) **[YOUR ANSWER]**
- Which of your needs fall in the requirements document's "What has no requirement yet" section, and
  how do you verify them instead? **[YOUR ANSWER]**
- For each TOR you rely on, have you read its "Does not assert" paragraph, and what covers the gap it
  names? **[YOUR ANSWER]**

### A.7 Objectives and activities

At the least demanding level, DO-330 draws its objectives from four groups: the tool operational
processes, configuration management, quality assurance and qualification liaison, fourteen objectives
in all according to the secondary sources read **[to check against your licensed copy: the table
identifiers, the objective count, the wording of each objective, and which of them apply at TQL-5]**.

| Objective group **[to check against your licensed copy]** | Your activities and outputs | runward material you may cite |
|---|---|---|
| Tool operational processes (tool operational requirements, installation, operational verification and validation) | **[YOUR ANSWER]** | the requirements document; the kit's report, or the section 9 results (A.8) |
| Configuration management | **[YOUR ANSWER]** | version identity, the attested tarball and SBOM ([verifying-a-release.md](../../verifying-a-release.md)), the changelog |
| Quality assurance | **[YOUR ANSWER]** | none: this is your organisation's activity |
| Qualification liaison | **[YOUR ANSWER]** | none: this is your exchange with your certification authority |

### A.8 Operational verification and validation

**[runward fills]** The evidence runward supplies for its version: the qualification kit's
`qualification-report.json` and `junit.xml` (ADR-0087 decision 1). Before the kit, the files the
commands of [regulated-adoption.md section 9](../regulated-adoption.md#9-running-runwards-own-suite-on-your-installation-interim)
leave: `junit.xml`, `unit.txt`, `smoke.txt`, `corpus.json`, `anomalies.txt`. Each result carries its
kind: `interface` (through the `runward` binary only), `internal` (through compiled modules of the
package, which are not a public interface), or `static` (files read as text). Cases that need the
repository's source tree, or a development dependency the kit does not carry, are reported
`not-run-here`, never as passed; on 0.42.3 there are nine.

- On which machine, in which environment, and on which date did you run it? Is that the environment
  of A.2? **[YOUR ANSWER]**
- Which of your tool operational requirements does each result serve as evidence for? **[YOUR ANSWER]**
- Do you accept `internal` results as evidence for your requirements, or only `interface` results?
  Why? **[YOUR ANSWER]**
- How do you treat the `not-run-here` cases (accept the repository's recorded result, verify the
  property another way, or exclude the requirement)? **[YOUR ANSWER]**
- Which verification of your own, beyond runward's suite, exercises the tool on your use case?
  **[YOUR ANSWER]**

### A.9 Known problems

**[runward fills]** The defect register, [known-defects.md](../known-defects.md), and the open
anomalies for your version: `node scripts/open-anomalies.mjs X.Y.Z` (the kit carries its result). On
0.42.3, read on 2026-10-02: one open entry and five whose versions the register does not establish.

- For each open or undetermined entry: does it affect your use, and what is your mitigation?
  **[YOUR ANSWER]**
- How do you learn of new entries after this plan is approved? **[YOUR ANSWER]**

### A.10 Configuration management

- How do you identify, store and control the installed version and its environment? **[YOUR ANSWER]**
- What triggers a re-run of A.8 (a new runward version, a new Node.js or `git` version, a new
  operating system)? **[YOUR ANSWER]**

### A.11 Quality assurance

- Who assures that this plan was followed, and how is it recorded? **[YOUR ANSWER]**

### A.12 Qualification liaison

- Which certification authority, and at which points do you submit this plan and the accomplishment
  summary? **[YOUR ANSWER]**

---

## Part B. Tool accomplishment summary

### B.1 Tool identification and configuration

- Tool, version and integrity verification: carried over from A.2. **[runward fills]**
- The environment the results come from: **[YOUR ANSWER]**

### B.2 Activities performed

- What was done, against each activity of A.7, and where it is recorded. **[YOUR ANSWER]**

### B.3 Results

**[runward fills]** Where the results are: the kit's report (or the section 9 files), cited by file
name, version and date.

| Count | Value |
|---|---|
| Requirements you rely on (A.6) | **[YOUR ANSWER]** |
| Of those, with a result that passed in your environment | **[YOUR ANSWER]** |
| Of those, `not-run-here`, and their treatment (A.8) | **[YOUR ANSWER]** |
| Of those, failed, and their treatment | **[YOUR ANSWER]** |
| Attack corpus result in your environment | **[YOUR ANSWER]** |

runward supplies the results; whether they show that your tool operational requirements are met is
your statement, not runward's.

### B.4 Open problems

- Each open or undetermined anomaly of A.9 that applies to your use, and its treatment.
  **[YOUR ANSWER]**

### B.5 Deviations from the plan

- **[YOUR ANSWER]**

### B.6 Conclusion

- Given A.4 to A.12 and B.1 to B.5, what do you conclude about your use of runward for this project,
  and on what argument? This conclusion is yours and your certification authority's to accept.
  **[YOUR ANSWER]**
