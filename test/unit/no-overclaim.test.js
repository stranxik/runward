// Claims runward is not entitled to make, refused across the whole shipped surface.
//
// `positioning-drift.test.js` already guards one doctrine file. A reliability review of the project
// (2026-08-04) noted the gap: the overclaim it caught that week lived in the SITE repo, which that
// test cannot read, and the compliance document handed to regulated buyers carried a claim nothing
// checked. So this guard scans everything the project ships: the README, the docs, the templates a
// mission receives, runward's own mission files, and the strings the CLI itself prints.
//
// Every entry below comes from that review's "phrases interdites" list, each with the source that
// makes it forbidden. Two design rules, both learned the hard way today:
//
//   1. A guard that cries on the safe case gets switched off. Every pattern is word-bounded and
//      carries an `unless` escape for the legitimate context (a negation, a roadmap item, a
//      forbidden-list entry like this one).
//   2. What is FORBIDDEN is paired with what is ALLOWED, so the failure message hands over the
//      sentence to use instead. A rule that only says no teaches nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN = ["README.md", "docs", "templates", "runward", "src"];
const SKIP = /node_modules|\.git|dist|coverage|\.stryker/;

function files(rel) {
  const abs = join(ROOT, rel);
  let st; try { st = statSync(abs); } catch { return []; }
  if (st.isFile()) return [abs];
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (SKIP.test(p)) continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(md|ts|json|ya?ml)$/.test(e.name)) out.push(p);
    }
  };
  walk(abs);
  return out;
}

const CORPUS = SCAN.flatMap(files).map((abs) => ({
  path: relative(ROOT, abs),
  lines: readFileSync(abs, "utf8").split("\n"),
}));

/** A line is exempt when it argues AGAINST the claim, lists it as forbidden, or plans it. */
const NEGATED = /\b(not|never|no|cannot|can't|without|forbidden|interdit|jamais|refus|aucun|sans)\b|^\s*[-*]\s*(Interdit|Forbidden)|→|->/i;

const RULES = [
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
    name: "tool confidence level asserted by us",
    re: /\brunward\b[^.\n]{0,50}\b(TCL ?1|TCL1|class(e)? T1|T1 by nature)\b/i,
    instead: "the analysis that makes the client's own classification quick, with the adverse case instructed",
    why: "the level is determined in the client's context, and our own registry of 22 false greens is an input to it",
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

test("no forbidden claim anywhere on the shipped surface", () => {
  const hits = [];
  for (const { path, lines } of CORPUS) {
    // This file states the forbidden phrases in order to forbid them.
    if (path.endsWith("no-overclaim.test.js")) continue;
    lines.forEach((line, i) => {
      for (const r of RULES) {
        if (!r.re.test(line)) continue;
        if (NEGATED.test(line)) continue;
        hits.push(`${path}:${i + 1}\n      claim: ${r.name}\n      line:  ${line.trim().slice(0, 120)}\n      why:   ${r.why}\n      say:   ${r.instead}`);
      }
    });
  }
  assert.deepEqual(hits, [],
    `\n\n${hits.length} forbidden claim(s) on the shipped surface:\n\n    ${hits.join("\n\n    ")}\n\n` +
    `Each of these was ruled out with a source by the 2026-08-04 reliability review. If a claim has since\n` +
    `become TRUE, back it with a mechanism first and then relax the rule here, in that order.\n`);
});

test("the guard scans more than one file, and knows what it scanned", () => {
  // The previous guard read a single doctrine file, which is how an overclaim shipped in the
  // compliance document and another on the website. A guard whose reach is not asserted quietly
  // shrinks to nothing.
  assert.ok(CORPUS.length > 100, `only ${CORPUS.length} files scanned`);
  for (const must of ["README.md", "docs/compliance/regulated-adoption.md", "templates/targets/AGENTS.md"]) {
    assert.ok(CORPUS.some((f) => f.path === must), `${must} must be in the scanned surface`);
  }
});

test("the guard does not fire on legitimate prose", () => {
  // A guard that cries on the safe case gets switched off, and then it guards nothing. Today alone,
  // three guards written here refused an honest input before this lesson landed.
  const safe = [
    "runward is not SOC 2 certified, and cannot be: there is no organisation behind it",
    "Interdit : « CRA-compliant ». Autorisé : « hors champ tant que non monétisé »",
    "SOC 2 (later) — a control-matrix skeleton with criteria mapping",
    "Detect workspace markers without parsing them",
    "npm OIDC Trusted Publishing plus SLSA provenance attestation; verify with npm audit signatures",
    "each release carries a SLSA attestation linking the tarball to the exact workflow run",
    "runward never makes you compliant; it produces pieces an assessment consumes",
  ];
  for (const line of safe) {
    const fired = RULES.filter((r) => r.re.test(line) && !NEGATED.test(line)).map((r) => r.name);
    assert.deepEqual(fired, [], `false positive on: ${line}`);
  }
});
