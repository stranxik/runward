# Crosswalk: NIS2 (Directive (EU) 2022/2555)

**A documentation crosswalk, not a pack.** runward ships no NIS2 lens: there is no `runward compliance
nis2`, no `regimes/` file and no OSCAL export for this directive ([ADR-0099](../adr/ADR-0099-which-regime-lenses-come-after-the-three-ai-ones-cra-nis2-dora-gdpr-and-where-each-belongs.md),
option D for NIS2). This page says which artefacts a runward mission already carries that an essential
or important entity **may cite as supporting evidence** for which provision, and names the provisions
runward does not touch. It is not legal advice and never a compliance claim: runward reads a delivery
repository, it does not assess an entity.

**The directive, never a transposition.** NIS2 reaches an entity through the national law of a Member
State (Art. 41, "Transposition": measures to be adopted and published by 17 October 2024 and applied
from 18 October 2024). This page maps the directive's articles only. It tracks no national
transposition, and the obligations that bind you are the ones your national law and your competent
authority set. The Commission implementing acts adopted under Art. 21(5) were not read for this page
and are not mapped.

**Source.** Article numbers, titles and the points of Art. 21(2) were read on the Official Journal text
of Directive (EU) 2022/2555 (OJ L 333, 27.12.2022), English version, served by the EU Publications
Office at `https://publications.europa.eu/resource/celex/32022L2555`, on 2026-10-23. The EUR-Lex page
(`https://eur-lex.europa.eu/eli/dir/2022/2555/oj`) answered an automated client with an empty `202`
challenge that day and was not read. Corrigenda were not re-read here.

**Review by: 2027-04-23.**

## What a delivery repository can hold, and what it cannot

A runward mission is the delivery repository of one system. It holds evidence about **how that system
was designed, built and handed over**: decisions, rule conformance, the threat model, the gate's
verdict. It holds nothing about the entity's operation of its network and information systems, its
incidents, its management body or its staff. Art. 21(2) lists the measures an entity takes; most of
them are about operating an entity, and only a few are about developing a system.

## Artefacts an entity may cite

| Provision (as titled in the OJ text) | runward artefact an entity may cite | What it shows, and its limit |
|---|---|---|
| **Art. 21(2)(e)**, security in network and information systems acquisition, development and maintenance (within Art. 21, "Cybersecurity risk-management measures") | The gate per phase (`runward check --strict`); the `Rule conformance` manifest (each rule `applied` with a `file:line` or test, `deviated` with an ADR, or `n/a` with a reason); `check --sarif` and `check --junit` output; the ADR journal | That a system's development was gated on named engineering and security rules, with evidence per rule, at a commit. The same point of Art. 21(2)(e) names vulnerability handling and disclosure: see below, not touched. |
| **Art. 21(2)(d)**, supply chain security, and **Art. 21(3)**, which asks entities to take into account the quality of their suppliers' cybersecurity practices, including their secure development procedures | What a supplier that delivers with runward can hand over: the witness (`check --strict --witness`, re-checkable by a checker that shares no code with runward, [spec](../spec/witness.md)), the attestation (`check --attest`, re-derivable with `runward verify`), the evidence lock (`runward/evidence-lock.json`) | Evidence about one supplier's development procedure for one delivery, which the entity may weigh among others. It says nothing about the supplier as an organisation, nor about any other supplier. runward's own release provenance is described in [verifying-a-release.md](../verifying-a-release.md). |
| **Art. 21(2)(a)**, policies on risk analysis and information system security | `runward/governance/threat-model.md` and the ADRs it cites | The risk analysis done for one system's design: an input to the entity's policies, not a policy. |
| **Art. 21(2)(b)**, incident handling | The mission's runbook (`runward/runbook.md`, under the rule `handover-runbook-executable`) and the observability schema (`runward/governance/observability-schema.md`) | Delivery documents the entity's incident handling may refer to for this system. They are not the entity's incident-handling procedure. |

All of these artefacts are unsigned by decision; signing is an operator gesture under an operator key
([interop.md](../interop.md)). OSCAL is emitted only by `runward compliance` for the three AI regimes,
and carries no NIS2 mapping.

## Provisions runward does not touch

Named so that no row above is read as covering them:

- **Governance** (Art. 20): the approval of the risk-management measures by the management bodies, their
  oversight and their training. runward's ratification ledger records who ratified a row in a delivery
  repository; it is not a management body's approval.
- **The other measures of Art. 21(2)**: (c) business continuity, backup management, disaster recovery
  and crisis management; (f) policies and procedures to assess the effectiveness of the measures (a
  green gate judges that each rule is accounted for, not that a measure is effective); (g) basic cyber
  hygiene practices and cybersecurity training; (h) cryptography and encryption policies; (i) human
  resources security, access control policies and asset management; (j) multi-factor or continuous
  authentication and secured communications.
- **Vulnerability handling and disclosure**, named in Art. 21(2)(e), and coordinated vulnerability
  disclosure (Art. 12). runward's own security policy is about runward, not about the entity's systems.
- **Corrective measures** (Art. 21(4)). A `deviated` row with its ADR records a known departure in a
  delivery; it is not the corrective-measure process the article asks of an entity.
- **Reporting obligations** (Art. 23): early warning, incident notification, intermediate and final
  reports.
- **European cybersecurity certification schemes and standardisation** (Arts. 24 and 25). runward is
  not a certification scheme.
- **Scope and entity classification** (Arts. 2 and 3), **jurisdiction and the registry of entities**
  (Arts. 26 and 27), **information sharing** (Arts. 29 and 30), and **supervision, enforcement, fines
  and penalties** (Arts. 31 to 37).
- **Everything addressed to Member States, authorities and Union bodies**: national strategies, CSIRTs,
  the Cooperation Group, EU-CyCLONe, peer reviews (Arts. 7 to 19), coordinated risk assessments of
  critical supply chains (Art. 22), and the domain-name registration database (Art. 28).

## How to use this page

Cite the artefact, at the commit it was produced, beside the provision of your national measure that
transposes the article named here, in your own record. Do not cite this page as an assessment, and do
not write that a runward verdict covers a NIS2 measure: it is evidence about a delivery, read by the
entity that answers for its measures.
