// A security scan whose subject IS the rule (ADR-0075 part 2, ratified 2026-09-12).
//
// `checklist-pre-production-security` is a CRITICAL rule of runward's own manifest and it carries
// `requires: sarif`. Citing the OSSF Scorecard SARIF this repository already uploads was refused in the
// ADR and is refused here: it resolves, it is a real report, and it says nothing about this rule — a
// pointer that resolves and does not bear on its rule is the vague spelling that passes.
//
// This config is separate from `eslint.config.js` on purpose. That one expresses the hexagon and must
// stay green as a build gate; this one is a SCAN, read from a committed report, and the two answer
// different questions in different reports.
//
// WHAT IS ENABLED, AND WHAT IS NOT, WITH THE NUMBERS. Every rule below was measured against `src/` on
// 2026-09-12 before being placed, because choosing a ruleset by what it lets you pass is choosing a
// thermometer by the reading you want. The full recommended set produced 380 findings; here is where
// each went and why.
//
//   error, measured 0 — the properties this product actually commits to:
//     detect-child-process ......... 0, and that zero says almost nothing (RWD-2026-0121). The rule
//                                      only fires on `require("child_process")`; every file in src/
//                                      is ESM and spells it `import { … } from "node:child_process"`,
//                                      which it never sees. Measured 2026-09-27: hooks.ts (execSync)
//                                      and characterize.ts (execFileSync git) passed it silently. It
//                                      stays on for a CommonJS spelling, and it is not the evidence.
//     no-restricted-imports ........ 0, with a named exception. THIS is the spawn claim, and it is
//     no-restricted-syntax ......... 0. ADR-0054's, stated the way the code is written: no file under
//                                      src/ imports `child_process` / `node:child_process`, statically
//                                      or through `import("…")`, except the three that ADR-0054 and
//                                      RWD-2026-0118 name as operator-triggered or read-only git:
//                                      SPAWN_ALLOWED below. Its sensitivity is a test, not a
//                                      belief: test/unit/security-scan-control.test.js plants an ESM
//                                      import in a temporary src/lib and requires this config to
//                                      refuse it, and to pass the same import in an allowed file.
//                                      Not seen: `createRequire(…)("child_process")`, a computed
//                                      specifier. runtime-boundary.test.js walks the verdict's import
//                                      closure for those; this scan does not claim them.
//     detect-eval-with-expression .. 0.   detect-non-literal-require ... 0.
//     detect-pseudoRandomBytes ..... 0.   detect-new-buffer ............ 0.
//     detect-buffer-noassert ....... 0.   detect-bidi-characters ....... 0.
//     detect-disable-mustache-escape 0.   detect-no-csrf-before-method-override 0.
//     detect-invisible-characters .. 0, measured 2026-10-08 when eslint-plugin-security 4.1.0 added it
//                                      (U+3164 and U+FFA0, glyphless characters that can hide an
//                                      identifier from review; detect-bidi-characters' neighbour). A
//                                      planted U+3164 inside an identifier in a temporary src/ file
//                                      was reported, so the zero is a reading, not blindness.
//
//   warn, measured 9 — real, and left itching rather than hidden:
//     detect-unsafe-regex .......... 9, in ratify.ts, update.ts, characterize.ts (x2), evidence.ts
//                                      (x3), mission.ts, territory.ts. The scan's first run is what
//                                      found RWD-2026-0114: `unsafeSignature` — the product's OWN
//                                      ReDoS guard — was quadratic in its input (3202 ms on a 64 KB
//                                      signature). That is fixed; these nine patterns are recorded as
//                                      warnings so the rest stays visible instead of being configured
//                                      away. No row cites this rule, because a rule with findings is
//                                      not evidence.
//
//   off, with the count and the reason — relevance, never passability:
//     detect-non-literal-fs-filename 281. runward's entire job is opening files the operator names.
//                                      A rule that fires on every `readFileSync(path)` in a tool whose
//                                      purpose is reading operator-named paths reports its own
//                                      premise, and a guard that cries on the safe case gets switched
//                                      off — this project has watched that happen four times.
//     detect-object-injection ....... 66. Fires on any `obj[key]`. Its own documentation calls it
//                                      noisy; there is no version of this codebase where it is quiet.
//     detect-non-literal-regexp ..... 20. runward compiles operator-authored patterns BY DESIGN — that
//                                      is what a `signature:` is — and the product's answer to the
//                                      concern this rule names is `unsafeSignature`, a purpose-built
//                                      guard the linter cannot see. Bounded since RWD-2026-0114.
//     detect-possible-timing-attacks . 2, in evidence.ts. There is no remote attacker to time: the
//                                      verdict path has no network (ADR-0054) and the comparison is a
//                                      local digest against a local file. The threat the rule names
//                                      does not exist in this topology.
import tsParser from "@typescript-eslint/parser";
import security from "eslint-plugin-security";

// The process spawner, in both spellings Node resolves.
const SPAWNER = /^(node:)?child_process$/;
const SPAWN_MESSAGE = "ADR-0054: spawning a process is a boundary crossing. Only the files named in SPAWN_ALLOWED (eslint.security.config.js) may import child_process; a new one is a decision, argued in an ADR.";
// The crossings ADR-0054 enumerates, checked against the tree on 2026-09-27: these three files (four since 2026-10-02, below), and
// only these, import child_process. hooks.ts runs the operator's own checks behind `--hooks`;
// characterize.ts and doctor.ts run `git`, read-only (RWD-2026-0118). None is in the verdict path.
// sample.ts (ADR-0088 decision 6, 2026-10-02) runs `git` read-only too: the weekly sample's population
// is "from git alone" by that decision, and the gate re-performs it from the ledger without git.
export const SPAWN_ALLOWED = ["src/lib/hooks.ts", "src/lib/characterize.ts", "src/commands/doctor.ts", "src/commands/sample.ts"];

export default [
  { ignores: ["dist/**", "reports/**", ".stryker-tmp/**", "examples/**", "coverage/**"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: "module" },
    // A directive disabling a rule that belongs to the BOUNDARY config is not this scan's business.
    // Left on, this run reported two "unused eslint-disable" messages about `no-control-regex`, a rule
    // only `eslint.config.js` enables — a report complaining about a neighbour's configuration.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { security },
    rules: {
      "security/detect-child-process": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-bidi-characters": "error",
      "security/detect-invisible-characters": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-unsafe-regex": "warn",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-possible-timing-attacks": "off",
      // The spawn claim, in the spelling src/ actually uses (RWD-2026-0121).
      "no-restricted-imports": ["error", { paths: ["child_process", "node:child_process"].map((name) => ({ name, message: SPAWN_MESSAGE })) }],
      "no-restricted-syntax": ["error", { selector: `ImportExpression[source.value=${SPAWNER}]`, message: SPAWN_MESSAGE }],
    },
  },
  {
    // The named exception, and nothing wider: a file, not a directory.
    files: SPAWN_ALLOWED,
    rules: { "no-restricted-imports": "off", "no-restricted-syntax": "off" },
  },
];
