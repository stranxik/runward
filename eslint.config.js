// The hexagon, expressed so a machine can refuse it (ADR-0075, ratified 2026-09-12).
//
// `hexa-architecture` and `hexa-adapter-pattern` are HIGH rules of runward's own manifest, and until
// today both were `applied` with a SENTENCE. An architecture rule states a boundary; a boundary is
// provable by a lint rule that refuses the forbidden import and is not provable by prose saying the
// boundary holds. Both rules carry `requires: eslint` in the shipped corpus for exactly that reason,
// and runward's own mission could not satisfy it — this repository had no linter at all, while
// `src/lib/styles.ts` already carried an `eslint-disable` directive addressed to one. It believed it
// was linted.
//
// ONE boundary is encoded, deliberately. `src/lib/**` is the pure, filesystem-only library; commands
// are the adapters that carry it to a consumer, so the dependency runs one way — a command may import
// the library, the library may never import a command. That single arrow IS the architecture claim.
//
// What is NOT encoded, and why. "No adapter imports another adapter" was measured against the tree
// before being written down: `src/commands/init.ts` imports `checkCommand`, because init runs a check
// when it finishes. That is composition, deliberate and honest, and a rule refusing it would redden a
// correct design — the failure mode this ADR's own re-evaluation trigger watches for. A lint rule that
// refuses honest code is how a team learns to pass `--no-verify`.
import tsParser from "@typescript-eslint/parser";

const BOUNDARY =
  "src/lib/** is the pure library and src/commands/** are its adapters, so the dependency runs one " +
  "way only: a command may import the library, the library may never import a command. Move what you " +
  "need into src/lib/, or pass it in as an argument (runward/architecture.md, rule hexa-architecture).";

export default [
  {
    // The linted perimeter is the product's own source. `dist/` is generated, `examples/*/code` is a
    // separate project with its own tsconfig, and the reports directory holds evidence, not code.
    ignores: ["dist/**", "reports/**", ".stryker-tmp/**", "examples/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: "module" },
    // A directive that disables a rule nobody runs is a guard addressed to nobody. This makes such a
    // line an error, which is the shape of the very defect that made this file necessary.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/commands/*", "**/commands/**", "../commands/*"], message: BOUNDARY },
        ],
      }],
      // Enabled so the `eslint-disable-next-line no-control-regex` in src/lib/styles.ts is a real
      // exemption from a real rule rather than a comment about a linter that was never installed.
      "no-control-regex": "error",
    },
  },
  {
    // The adapters are the one place a command import is the point.
    files: ["src/cli.ts", "src/commands/**/*.ts"],
    languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: "module" },
    rules: { "no-restricted-imports": "off" },
  },
];
