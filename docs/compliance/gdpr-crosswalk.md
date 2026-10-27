# Crosswalk: GDPR (Regulation (EU) 2016/679)

**A documentation crosswalk, not a pack.** runward ships no GDPR lens: there is no `runward compliance
gdpr`, no `regimes/` file and no OSCAL export for this regulation ([ADR-0099](../adr/ADR-0099-which-regime-lenses-come-after-the-three-ai-ones-cra-nis2-dora-gdpr-and-where-each-belongs.md),
option D for the GDPR). This page says which artefacts a runward mission already carries that a
controller or processor **may cite as supporting evidence** for which provision, and names the
provisions runward does not touch. It is not legal advice and never a compliance claim: runward reads a
delivery repository, it does not assess an entity, and the GDPR obligations fall on the controller and
the processor, not on a tool. Verify the current text, and the guidance of your supervisory authority,
before you rely on a row.

**Source.** Article numbers and titles were read on the Official Journal text of Regulation (EU)
2016/679 (OJ L 119, 4.5.2016), English version, served by the EU Publications Office at
`https://publications.europa.eu/resource/celex/32016R0679`, on 2026-10-23. The EUR-Lex page
(`https://eur-lex.europa.eu/eli/reg/2016/679/oj`) answered an automated client with an empty
`202` challenge that day and was not read. Corrigenda were not re-read here.

**Review by: 2027-04-23.**

## What a delivery repository can hold, and what it cannot

A runward mission is the delivery repository of one system: its framing, architecture, execution
topology, floor, governance files and the decisions behind them. It holds evidence of **design
decisions about** the processing a system will perform. It holds none of the **processing itself**: no
record of what personal data a running system processed, for whom, or when. Every row below is bounded
by that line.

## Artefacts a controller or processor may cite

| Provision (as titled in the OJ text) | runward artefact an entity may cite | What it shows, and its limit |
|---|---|---|
| **Art. 5(2)**, accountability (within Art. 5, "Principles relating to processing of personal data"), and **Art. 24**, "Responsibility of the controller" | The ADR journal (`runward/adr/`, each decision with context, alternatives and a dated reevaluation trigger) and the `Rule conformance` manifest (each rule `applied` with a `file:line` or test, `deviated` with an ADR, or `n/a` with a reason) | That named design decisions were taken, traced and reviewable, at a commit. It does not show that processing is performed in accordance with the Regulation; that is the controller's demonstration, and these are inputs to it. |
| **Art. 25**, "Data protection by design and by default" | Rows of `runward/execution-topology.md` decided under the rules `topology-sovereignty-by-data-class` (a sovereignty level per class of data crossing each port) and `topology-trace-export-decision` (an export of execution traces is absent, or a traced decision naming the recipient, the data class and the retention); the retention policy per data type recorded under `data-ttl-types`; the ADRs those rows cite | That the delivery recorded, per port and per data type, where data may go and how long it is kept, before the system ran. Art. 25(2) speaks of the period of storage and accessibility "by default": the rows record the decided default, not its operation. The retention durations in the `data-ttl-types` template are examples; the rule itself says to set them with legal counsel. |
| **Art. 30**, "Records of processing activities" | The same topology rows and the retention decisions | Inputs the entity may copy into its record (the categories of data a port carries, the recipients a trace-export decision names, the time limits for erasure decided per data type). runward keeps no record of processing activities; the record is the controller's or the processor's. |
| **Art. 32**, "Security of processing" | `runward/governance/threat-model.md`; the conformance rows of the security rules (prompt injection, code-execution sandbox, MCP server pinning, secrets boundary, pre-production security checklist); `check --sarif` and `check --junit` output; the evidence lock (`runward/evidence-lock.json`, written by `check --freeze`); the witness (`check --strict --witness`) and the attestation (`check --attest`) | That security measures were designed and accounted for in the delivery, and that the evidence cited for them had not changed since it was sealed. Art. 32(1)(d) asks for a process for regularly testing, assessing and evaluating the effectiveness of measures: a green gate is not that assessment. It judges that each rule is accounted for, not that a measure works in operation. |
| **Art. 35**, "Data protection impact assessment" | The threat model and the ADRs, as inputs to the description of the measures envisaged (Art. 35(7)(d)) | Material the controller may draw on. runward performs no impact assessment, and nothing in a mission decides whether one is required. |
| **Art. 28**, "Processor" | [regulated-adoption.md](regulated-adoption.md) | About runward itself, not the system it governs: runward runs on your infrastructure with no data flow to a third party, so using it creates no processor relationship. |

All of these artefacts are unsigned by decision; signing is an operator gesture under an operator key
([interop.md](../interop.md)). OSCAL is emitted only by `runward compliance` for the three AI regimes;
an entity that wants a machine-readable export for a GDPR file can take the manifest rows from an AI
pack's component-definition, but no GDPR mapping exists in it.

## Provisions runward does not touch

Named so that no row above is read as covering them:

- **Lawfulness and the legal basis** (Arts. 6 to 11): consent, children's consent, special categories,
  criminal-conviction data, processing without identification. A mission records no legal basis.
- **The rights of the data subject** (Chapter III, Arts. 12 to 23): information, access,
  rectification, erasure, restriction, portability, objection, automated individual decision-making. A
  system may implement them; no runward rule checks that it does.
- **Personal data breaches** (Art. 33, notification to the supervisory authority; Art. 34,
  communication to the data subject).
- **The data protection officer** (Arts. 37 to 39) and **prior consultation** (Art. 36).
- **Codes of conduct and certification** (Arts. 40 to 43). runward is neither a code of conduct nor a
  certification mechanism, and a mission is not an element of either.
- **Transfers to third countries** (Chapter V, Arts. 44 to 50). A trace-export decision names a
  recipient; whether a transfer to it is lawful is not touched.
- **Supervisory authorities, cooperation, remedies, liability and penalties** (Chapters VI to VIII,
  Arts. 51 to 84), and the **specific processing situations** of Chapter IX (Arts. 85 to 91).
- **Joint controllers and representatives** (Arts. 26 and 27), and processing under the authority of
  the controller or processor (Art. 29).

## How to use this page

Cite the artefact, at the commit it was produced, beside the provision, in your own record. Do not cite
this page as an assessment, and do not write that a runward verdict covers a GDPR provision: it is
evidence about a delivery, read by the entity that answers for the processing.
