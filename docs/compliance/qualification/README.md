# Qualification templates

**Read this first.** The material in this directory helps you, the user of runward, produce your own
tool qualification or tool confidence work, in your context of use. runward does not determine a TQL,
a TCL, a tool class or a validation outcome, for you or for anyone. No body has assessed runward, this
directory, or the qualification kit these templates will ship in.

## What is here

| File | For | What it is |
|---|---|---|
| [do-178c-tql-5-plan-and-summary.md](do-178c-tql-5-plan-and-summary.md) | An applicant under DO-178C who uses runward as a verification tool and has determined that criteria 3 applies to that use | A skeleton for your tool qualification plan and your tool accomplishment summary, with the DO-330 objectives treated as yours |
| [iso-26262-8-clause-11-method-1c.md](iso-26262-8-clause-11-method-1c.md) | A user under ISO 26262 who classifies runward and, where the resulting class asks for it, validates it with method 1c | A skeleton for your tool classification and your tool validation report |

Each is a skeleton for **your** document. It is not a filled plan and it is not a report about runward.

## What runward fills, and what stays blank

runward fills only what it can state about itself, from the repository:

- the tool description and the version identity;
- the references to runward's tool operational requirements
  ([tool-operational-requirements.md](../tool-operational-requirements.md), TOR identifiers);
- the place where the kit's report, or until then the results of
  [regulated-adoption.md section 9](../regulated-adoption.md#9-running-runwards-own-suite-on-your-installation-interim),
  is cited;
- the pointer to the known anomalies for that version ([known-defects.md](../known-defects.md) and
  `scripts/open-anomalies.mjs`).

Everything that depends on your use is blank, with the questions to answer: the use case, the
classification, the error-detection argument and the conclusion. runward's requirements are a
statement of what the tool does; they are an input to your tool operational requirements, never a
substitute for them.

## How the standards were read

DO-178C, DO-330 and ISO 26262 are sold, and no licensed copy of any of them was read to write these
templates. What was read at the source, and what was not, is listed in the Context of
[ADR-0087](../../adr/ADR-0087-a-qualification-kit-the-user-runs-runward-ships-the-evidence.md). Every
clause number, table identifier, class definition or method table below that comes from a secondary
source carries the marker **[to check against your licensed copy]**. Where no marker appears, the
statement is either about runward or was read in a public text (FAA AC 20-115D, EASA AMC 20-115D, FAA
Order 8110.49A), which the template names.

## Where these templates travel

They are authored here and will ship inside the qualification kit (ADR-0087 decision 1), never in the
npm package: a tool qualification plan is the applicant's document, not a mission deliverable. Templates
for IEC 61508-3 clause 7.4.4 and EN 50716 clause 6.7 are added on a first request, not before.

The overclaim guard (`test/unit/no-overclaim.test.js`) scans this directory with the rest of `docs/`.
