import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { specBundleConformance, SPEC_NON_SCOPE } from "../lib/spec-conformance.js";
import { toPosix } from "../lib/paths.js";
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
export async function specCheckCommand(specFiles: string[], opts: { path?: string; json?: boolean }): Promise<void> {
  const baseDir = resolve(process.cwd(), opts.path ?? ".");
  const fail2 = (verdict: string, msg: string): never => {
    if (opts.json) process.stdout.write(JSON.stringify({ runward: VERSION, spec: specFiles, verdict, exitCode: 2 }) + "\n");
    else console.error(status.error(msg));
    process.exit(2);
  };

  // A bundle is named by files, by a DIRECTORY (spec-kit's `specs/<feature>/`, OpenSpec's change
  // directory), or by both. A directory contributes its own `*.md`, sorted — never recursively: the
  // bundle is the feature's own files, not everything below it, and a deterministic order is what
  // makes two runs on the same tree emit the same report.
  const files: Array<{ path: string; content: string }> = [];
  for (const arg of specFiles) {
    const abs = resolve(process.cwd(), arg);
    if (!existsSync(abs)) fail2("no-spec", `Not found: ${arg}`);
    if (statSync(abs).isDirectory()) {
      const mds = readdirSync(abs).filter((f) => f.endsWith(".md")).sort();
      if (mds.length === 0) fail2("no-spec", `No .md file in ${arg} — a bundle directory must carry the spec files themselves.`);
      for (const f of mds) files.push({ path: toPosix(relative(baseDir, join(abs, f))), content: readFileSync(join(abs, f), "utf8") });
    } else {
      files.push({ path: toPosix(relative(baseDir, abs)), content: readFileSync(abs, "utf8") });
    }
  }

  const report = specBundleConformance(files, baseDir);
  if (!report.hasAnySection) {
    fail2("no-criteria", "No acceptance-criteria section in any file — a spec needs a heading naming `acceptance` or `criteria`, with its criteria as list items.");
  }

  const clean = report.unlinked === 0 && report.dangling.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({
      runward: VERSION,
      spec: files.map((f) => f.path),
      verdict: clean ? "linked" : "gaps",
      total: report.criteria, unlinked: report.unlinked,
      files: report.files,
      // ADR-0056:51, the internal-consistency half: an identifier the bundle references and no file
      // declares. Additive (ADR-0024); a single-file run simply reports an empty list.
      declaredIds: report.declaredIds, dangling: report.dangling,
      specNonScope: SPEC_NON_SCOPE, // the caveat travels with the numbers (ADR-0045 pattern)
      exitCode: clean ? 0 : 1,
    }, null, 2) + "\n");
    if (!clean) process.exitCode = 1;
    return;
  }

  console.log(createHeader(`Runward v${VERSION} — spec-check`, `${files.length} file(s) · ${report.criteria} criterion(s)`));
  for (const f of report.files) {
    if (!f.hasSection) {
      console.log(section(f.path));
      console.log("  " + c.darkGray("no acceptance-criteria section — read as part of the bundle, never as a spec of its own"));
      continue;
    }
    console.log(section(`${f.path} → delivered artifacts (linkage only)`));
    for (const cr of f.criteria) {
      console.log(`  ${cr.linked ? status.success("linked  ") : c.error("unlinked")} ${c.darkGray(`#${cr.line}`)} ${c.white(cr.text)}`);
      if (!cr.linked) console.log(`      ${c.darkGray(cr.reason)}`);
    }
  }
  if (report.dangling.length) {
    console.log(section("Internal consistency"));
    console.log("  " + c.darkGray("an identifier the bundle references, and no file of it declares:"));
    for (const d of report.dangling) console.log(`  ${c.error("dangling")} ${c.darkGray(`${d.file}:${d.line}`)} ${c.white(d.id)}`);
  }
  console.log(section("Non-scope"));
  console.log("  " + c.darkGray(SPEC_NON_SCOPE));
  console.log(section("Result"));
  if (clean) {
    console.log("  " + status.success(`every criterion is linked to a present artifact${report.declaredIds.length ? ", and every referenced identifier is declared" : ""}.`));
  } else {
    const parts = [];
    if (report.unlinked) parts.push(`${report.unlinked} criterion(s) not linked`);
    if (report.dangling.length) parts.push(`${report.dangling.length} dangling identifier(s)`);
    console.log("  " + status.error(parts.join(" · ") + " — link them, or fix the reference."));
    process.exitCode = 1;
  }
  console.log();
}
