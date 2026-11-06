// The planted sabotages of the controls (runward ADR-0122 decision 1), one per recipe, each applied to
// the shipped example (`runward init --example`). Each is chosen so that only the regenerated report can
// refuse it, and each control measures that too: the gate on the committed tree, built-in analyzers
// included, lets it through; the gate on the same tree after the recipe's step refuses it.
//
// In every case the committed reports are left as they were: the agent changed the code or the tests and
// did not regenerate, or wrote the reports by hand. That is the case the default CI path reads as green.
//
// A sabotage is a pure edit of files the example ships. When the text it edits is not found, planting
// throws: a control whose sabotage silently did nothing would pass for the wrong reason.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function edit(tree, rel, from, to) {
  const file = join(tree, ...rel.split("/"));
  if (!existsSync(file)) throw new Error(`the sabotage cannot be planted: ${rel} is not in the tree (the shipped example changed)`);
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (!text.includes(from)) throw new Error(`the sabotage cannot be planted: ${rel} no longer holds the text it edits (the shipped example changed)`);
  writeFileSync(file, text.replace(from, to));
}

export const SABOTAGES = {
  // The guard fails open: an account reference the registry does not know is promoted as verified, and
  // the record routes instead of escalating. The case that proves the guard now fails; the committed
  // JUnit report still records it green.
  junit: {
    id: "guard-fails-open",
    plant(tree) {
      edit(tree, "code/src/core/domain/guard.ts",
        "    } else {\n      out.escalations.push(\n        `unverified account reference \"${proposedRef.value}\" (not in registry)`,\n      );\n    }",
        "    } else {\n      out.accountRef = { value: proposedRef.value, provenance: \"verified\" };\n    }");
    },
  },
  // The journal no longer appends, and the tests no longer run it: they carry their own copy of the
  // adapter. Every case stays green, every case still asserts and imports the code it tests, and the
  // committed LCOV report still records the adapter as executed.
  coverage: {
    id: "journal-swapped-out-of-the-tests",
    plant(tree) {
      const adapterRel = "code/src/adapters/in-memory-triage-log.adapter.ts";
      const adapter = readFileSync(join(tree, ...adapterRel.split("/")), "utf8").replace(/\r\n/g, "\n");
      const at = adapter.indexOf("export class InMemoryTriageLog implements TriageLogPort");
      if (at === -1) throw new Error(`the sabotage cannot be planted: ${adapterRel} no longer declares InMemoryTriageLog (the shipped example changed)`);
      const copy = adapter.slice(at).replace("export class InMemoryTriageLog", "class InMemoryTriageLog");
      edit(tree, "code/test/triage.test.ts",
        'import { InMemoryTriageLog } from "../src/adapters/in-memory-triage-log.adapter.ts";\n',
        'import type { TriageLogPort, TriageLogEntry, PendingRouting } from "../src/core/ports/triage-log.port.ts";\n');
      edit(tree, "code/test/triage.test.ts", "const fixedClock", `${copy}\nconst fixedClock`);
      edit(tree, adapterRel,
        "    const list = this.entries.get(requestId) ?? [];\n    list.push({ ...entry });\n    this.entries.set(requestId, list);",
        "    this.entries.set(requestId, [{ ...entry }]);");
    },
  },
  // A credential written as a literal in a new adapter, in a shape the built-in analyzers do not know and
  // the example's lint configuration does (a bearer token). No row cites the new file; the SARIF log is
  // cited by rule, so the regenerated log reddens the row that cites the rule. The committed log still
  // records no result.
  sarif: {
    id: "credential-literal-in-a-new-adapter",
    plant(tree) {
      const rel = "code/src/adapters/upstream-auth.adapter.ts";
      // Assembled here, at run time, so that no file of this repository holds a credential-shaped literal.
      const token = ["Bearer", " ", "rwi", "0".repeat(29)].join("");
      writeFileSync(join(tree, ...rel.split("/")),
        `// Sends the triage summary upstream.\nexport const UPSTREAM_AUTHORIZATION = "${token}";\n`);
    },
  },
};

/** Plants the sabotage of a recipe into a tree. */
export function plant(recipe, tree) {
  const s = SABOTAGES[recipe];
  if (!s) throw new Error(`no sabotage for recipe ${JSON.stringify(recipe)}`);
  s.plant(tree);
  return s;
}
