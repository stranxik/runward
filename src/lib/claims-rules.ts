/**
 * Claims runward is not entitled to make — the single source of truth, published with the package.
 *
 * ADR-0050 decision 2. These rules used to live inside `test/unit/no-overclaim.test.js`, where only
 * the CLI test could reach them. But the overclaim the 2026-08-04 reliability review caught lived in
 * the SITE repo, which that test cannot read. So the rules move here and ship with the npm package
 * (the `runward/claims` export): the CLI guard consumes them, and a site-build guard consumes the
 * SAME list from the pinned dependency — two lists cannot drift when there is one.
 *
 * Two design rules, learned the hard way and kept verbatim from the review:
 *   1. A guard that cries on the safe case gets switched off. Every pattern is word-bounded and its
 *      legitimate context (a negation, a roadmap item, a forbidden-list entry) is exempted by the
 *      `NEGATED` screen at the call site.
 *   2. What is FORBIDDEN is paired with what is ALLOWED (`instead`), so the failure hands over the
 *      sentence to use. A rule that only says no teaches nothing.
 *
 * This module is data only: no import, no side effect, so any consumer — the CLI test, a site
 * script — reads it without pulling the CLI in. New classes (absolutes about the gate, impossible by
 * design, secured from day one, a dated competitive claim, verbatim on a translation) are added with
 * the site guard that enforces them, where the surface that carries them lives.
 */

export interface ClaimRule {
  /** Short label, shown in the failure and used as the identity in tests. */
  name: string;
  /** The forbidden shape. Word-bounded; case-insensitivity is in the flags. */
  re: RegExp;
  /** The sentence to use instead — the failure hands it over. */
  instead: string;
  /** The source that makes the claim forbidden. */
  why: string;
}

/** A line is exempt when it argues AGAINST the claim, lists it as forbidden, or plans it. */
export const NEGATED = /\b(not|never|no|cannot|can't|without|forbidden|interdit|jamais|refus|aucun|sans)\b|^\s*[-*]\s*(Interdit|Forbidden)|→|->/i;

export const CLAIMS_RULES: ClaimRule[] = [
  {
    name: "CRA compliance",
    re: /\bCRA[- ]compliant\b|\bconforme au CRA\b|\bcompliant with the CRA\b/i,
    instead: "hors champ du CRA tant que le logiciel n'est pas monétisé (règlement (UE) 2024/2847, art. 3(22) et considérant 18)",
    why: "no conformity assessment exists for a non-monetised FOSS project, and none was done",
  },
  {
    name: "CRA out of scope for the wrong reason",
    re: /hors champ du CRA parce que.*(réseau|network)|out of (the )?CRA scope because.*(network|offline)/i,
    instead: "hors champ par NON-MONÉTISATION, jamais par l'absence de réseau",
    why: "standalone software executed locally IS in scope when placed on the market; only non-monetisation protects",
  },
  {
    name: "CE marking",
    re: /\bCE[- ]mark(ing|ed)?\b/,
    instead: "nothing: outside placing on the market, no marking is possible, not even for a steward",
    why: "regulation (EU) 2024/2847, recital 19",
  },
  {
    name: "tool qualified or certified against a safety standard",
    re: /\b(qualified|certified|pre-?qualified|qualifié|certifié)\b[^.\n]{0,60}\b(ISO ?26262|DO-?178C|DO-?330|EN ?50716|EN ?50128|IEC ?61508|IEC ?62304|TÜV|TUV)\b/i,
    instead: "the kit lets THE CLIENT qualify runward, in THEIR environment (MathWorks wording is the ceiling)",
    why: "qualification belongs to the operator's context; no body has assessed runward",
  },
  {
    // First version listed only `TCL 1 | TCL1 | class(e) T1 | T1 by nature`. An adversarial review of
    // the regulated material (2026-08-06) pointed out that it saw neither TQL-4, nor TQL-5, nor TCL2,
    // nor TCL3, nor the rail classes — and that the text about to be written, a tool-confidence
    // section covering four schemes, is precisely the page that produces the risk. A guard whose
    // perimeter is narrower than the document it guards is the recurring defect of this repository,
    // and it had to be widened BEFORE the section was written, not after.
    //
    // Direction matters: what is forbidden is asserting a level FOR RUNWARD. Explaining a scheme, or
    // naming a class in order to say the determination is not ours, must stay writable, which is why
    // the pattern requires `runward` (or `it`/`the tool` in a claiming verb) close to the level.
    name: "tool confidence level asserted by us",
    re: /\brunward\b[^.\n]{0,60}\b(is|as|at|reaches|qualifies as|est|atteint)\b[^.\n]{0,20}\b(TCL ?[1-3]|TQL[- ]?[1-5]|class(e)? T[1-3]|T[1-3] by nature|SIL ?[1-4])\b/i,
    instead: "state the arguments an assessor would use, adverse case first, and leave the level to the client's environment",
    why: "the level is determined in the client's context; our 22 false greens and the unguarded seal are inputs an assessor uses to raise it, not lower it",
  },
  {
    // Same review, same day: a draft concluded that clause 6.7.4.3 was "already satisfied by
    // port-contract.md plus GATE_NON_SCOPE". Declaring a normative clause satisfied is a conformity
    // statement, and only the operator's justification, accepted by THEIR assessor, establishes it.
    name: "a normative clause declared satisfied by us",
    re: /\b(satisfies|satisfied by|meets|already meets|fulfils|fulfills|satisfait|répond à)\b[^.\n]{0,50}\b(clause|§|IEC ?6\d{3,4}|ISO ?26262|EN ?50[0-9]{3}|DO-?[13][378]0|4\.1\.6|6\.7|7\.4\.4|11\.4|5\.1\.\d)\b/i,
    instead: "name what the material supplies as an input, and leave the clause to the operator's justification",
    why: "conformity to a clause is established by the operator's argument accepted by their assessor, never by the tool's own page",
  },
  {
    name: "organisation certification",
    re: /\b(SOC ?2|ISO ?27001|ISO ?42001|OpenChain)\b[- ]?(certified|compliant|attested|certifié)\b/i,
    instead: "no organisation, no service, MIT AS IS — see docs/compliance/regulated-adoption.md",
    why: "these certify an organisation running a service; there is neither here",
  },
  {
    name: "independent third-party audit",
    re: /\b(audited|reviewed|assessed)\s+by\s+an?\s+(independent|external|third[- ]party)\b/i,
    instead: "auto-audits adversariaux, replayable via test/audit-corpus.js",
    why: "no externally published audit exists; the 2026-08-04 campaign was run by the maintainer",
  },
  {
    name: "zero false positives",
    re: /\bzero[- ](false[- ]positives?|CVE|defects?)\b|\bz[ée]ro faux[- ]positifs?\b/i,
    instead: "a maintained register of known verdict defects, and a rate measured on a replayable corpus",
    why: "ADR-0045 documents 22 false positives found in one day",
  },
  {
    // First version of this rule forbade SLSA WITHOUT a level, and fired on four honest lines that
    // simply name the provenance format ("SLSA provenance attestation" is npm's own wording). That
    // is the fourth guard written today that cried on the safe case, on the very day the lesson was
    // learned. The real risk is the opposite: announcing a LEVEL nobody assessed.
    name: "SLSA level asserted without an assessment",
    re: /\bSLSA\b[^.\n]{0,20}\b(level ?[0-9]|L[0-9]|Build L[0-9])\b/i,
    instead: "name the provenance without a level, or cite the assessment that established it",
    why: "no SLSA level assessment has been performed on this project",
  },
  {
    name: "makes you compliant",
    re: /\b(makes?|rend|renders?)\s+(you|your\s+\w+|votre\s+\w+|vous)\s+(compliant|conforme)\b/i,
    instead: "runward produces pieces an assessment consumes; compliance belongs to an entity",
    why: "a tool cannot confer conformity",
  },
];

/**
 * Citations that may appear VERBATIM even where a rule above would fire (ADR-0048, precondition to
 * the isolated-builder work). GitHub's own documentation names SLSA levels, and describing what a
 * scheme's author documents is not claiming a level for runward — but until 2026-08-11 those
 * sentences passed the SLSA rule only because "v1.0" carries a dot and the rule's gap class is
 * `[^.\n]`. An exemption that rests on a regex accident is one "fix" away from firing on honest
 * prose, or worse, one paraphrase away from letting a real overclaim through. This list makes the
 * exemption a DECISION: the exact quoted sentence is writable, and any paraphrase, cut or
 * translation of it faces the rules with no accident to hide behind.
 *
 * Rule for adding here: the string must be a full sentence quoted from a primary source, carried
 * with quotation marks at the call site, and the source must be named nearby in the document.
 */
export const FROZEN_CITATIONS: string[] = [
  "Artifact attestations by itself provides SLSA v1.0 Build Level 2.",
  "Reusable workflows can provide isolation between the build process and the calling workflow, to meet SLSA v1.0 Build Level 3.",
];
