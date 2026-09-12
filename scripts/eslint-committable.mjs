// Produce `reports/eslint.json` as a report a repository can COMMIT and a gate can re-open
// (ADR-0075, ratified 2026-09-12; the pattern is `scripts/junit-committable.mjs`, ADR-0073 option 1).
//
// Two things make a tool's own output uncommittable, and both are here. ESLint writes an ABSOLUTE
// `filePath`, which is the generating machine's layout rather than a fact about the code — the same
// defect the JUnit step strips (`file=`) and the same one ADR-0071 removed from the delivery report.
// And the traversal order of a directory is not a promise, so entries are sorted.
//
// It exits with ESLint's OWN status. The first version of the JUnit step answered exit 0 on a broken
// suite because a pipe returned the filter's status — precisely the defect its output exists to
// prevent. The lesson is cheap to reapply and expensive to relearn.
//
// ESLint's binary is invoked through `process.execPath` rather than a `.bin` shim: `execFileSync` does
// not resolve PATHEXT on Windows, and Node's CVE-2024-27980 mitigation refuses a `.cmd` without a
// shell. The packaging guard learned both of those the hard way.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "reports", "eslint.json");
const BIN = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

const run = spawnSync(process.execPath, [BIN, "src", "-f", "json"], {
  cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
if (run.error) { console.error(run.error.message); process.exit(2); }
if (run.stderr) process.stderr.write(run.stderr);

let report;
try { report = JSON.parse(run.stdout); }
catch { console.error("eslint did not emit JSON:\n" + run.stdout.slice(0, 2000)); process.exit(2); }

const posix = (p) => p.split("\\").join("/");
for (const entry of report) {
  if (typeof entry.filePath === "string") entry.filePath = posix(relative(ROOT, entry.filePath));
  // `source` is the file's whole text, echoed back only when a message fires. The file is in the
  // repository already; carrying a second copy into the evidence would make the report grow with
  // every finding and say nothing the pointer cannot.
  delete entry.source;
}
report.sort((a, b) => String(a.filePath).localeCompare(String(b.filePath), "en"));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

const errors = report.reduce((n, e) => n + (e.errorCount ?? 0), 0);
const warnings = report.reduce((n, e) => n + (e.warningCount ?? 0), 0);
console.log(`reports/eslint.json — ${report.length} file(s) linted, ${errors} error(s), ${warnings} warning(s)`);
process.exit(run.status ?? 0);
