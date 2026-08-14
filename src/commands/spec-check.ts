import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { specConformance, SPEC_NON_SCOPE } from "../lib/spec-conformance.js";
import { c, createHeader, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Deterministic spec/constitution conformance (ADR-0056): every acceptance criterion in a spec must
 * be LINKED to a delivered artifact that is present. The hard verdict the LLM-prose-gated SDD tools
 * cannot produce — and, by construction, never a judgment that a criterion is semantically met.
 *
 * Exit codes (the 0/1/2 port): 0 = every criterion linked · 1 = some criterion is not linked to a
 * present artifact · 2 = the spec is not found, or it declares no acceptance-criteria section.
 */
export async function specCheckCommand(specFile: string, opts: { path?: string; json?: boolean }): Promise<void> {
  const abs = resolve(process.cwd(), specFile);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    if (opts.json) process.stdout.write(JSON.stringify({ runward: VERSION, spec: specFile, verdict: "no-spec", exitCode: 2 }) + "\n");
    else console.error(status.error(`Spec file not found: ${specFile}`));
    process.exit(2);
  }
  const content = readFileSync(abs, "utf8");
  // Pointers are project-relative; resolve them against the project root (--path or cwd), where the
  // delivered artifacts live — not the spec's own directory.
  const baseDir = resolve(process.cwd(), opts.path ?? ".");
  const report = specConformance(content, baseDir);

  if (!report.hasSection) {
    if (opts.json) process.stdout.write(JSON.stringify({ runward: VERSION, spec: specFile, verdict: "no-criteria", exitCode: 2 }) + "\n");
    else console.error(status.error("No acceptance-criteria section — the spec needs a heading naming `acceptance` or `criteria`, with its criteria as list items."));
    process.exit(2);
  }

  const clean = report.unlinked === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({
      runward: VERSION, spec: specFile,
      verdict: clean ? "linked" : "gaps",
      total: report.criteria.length, unlinked: report.unlinked, criteria: report.criteria,
      specNonScope: SPEC_NON_SCOPE, // the caveat travels with the numbers (ADR-0045 pattern)
      exitCode: clean ? 0 : 1,
    }, null, 2) + "\n");
    if (!clean) process.exitCode = 1;
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — spec-check`, `${specFile} · ${report.criteria.length} criterion(s)`));
  console.log(section("Acceptance criteria → delivered artifacts (linkage only)"));
  for (const cr of report.criteria) {
    console.log(`  ${cr.linked ? status.success("linked  ") : c.error("unlinked")} ${c.darkGray(`#${cr.line}`)} ${c.white(cr.text)}`);
    if (!cr.linked) console.log(`      ${c.darkGray(cr.reason)}`);
  }
  console.log(section("Non-scope"));
  console.log("  " + c.darkGray(SPEC_NON_SCOPE));
  console.log(section("Result"));
  if (clean) {
    console.log("  " + status.success(`every criterion is linked to a present artifact (${report.criteria.length}) — a deterministic linkage verdict, never a claim they are met.`));
  } else {
    console.log("  " + status.warning(`${report.unlinked} of ${report.criteria.length} criterion(s) not linked to a present artifact.`));
    process.exitCode = 1;
  }
  console.log();
}
