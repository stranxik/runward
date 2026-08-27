import { existsSync, statSync } from "node:fs";
import { basename, relative, resolve , isAbsolute } from "node:path";
import { findMissionRoot } from "../lib/mission.js";
import { buildBundleStatement, rawFileSha256, type BundleSubject } from "../lib/attestation.js";
import { status } from "../lib/styles.js";
import { VERSION, toPosix } from "../lib/paths.js";

/**
 * Bind several already-emitted delivery artifacts into ONE in-toto-attested manifest (ADR-0055
 * layer 4). The operator names the artifacts they produced — the verdict attestation, the evidence
 * seal, an OSCAL export, a CycloneDX SBOM — and `bundle` references each by its raw SHA-256 as an
 * in-toto subject, so an assessor gets a single provenance instead of a pile of files. It emits a
 * file; it runs nothing, holds no key, reaches no network (ADR-0054). `runward verify` re-hashes the
 * subjects; so does any cosign/in-toto tool.
 *
 * Exit codes (the 0/1/2 port): 0 = bundle emitted · 2 = no artifact named, or one is missing / not a
 * regular file.
 */
export async function bundleCommand(artifacts: string[], opts: { path?: string }): Promise<void> {
  if (!artifacts || artifacts.length === 0) {
    console.error(status.error("Name at least one artifact to bundle, e.g. `runward bundle verdict.intoto.json runward/evidence-lock.json`."));
    process.exit(2);
  }
  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  const missionName = basename(root ?? resolve(process.cwd()));

  const subjects: BundleSubject[] = [];
  const seen = new Set<string>();
  for (const a of artifacts) {
    const abs = resolve(process.cwd(), a);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      console.error(status.error(`Artifact not found (or not a regular file): ${a}`));
      process.exit(2);
    }
    // The name is the path a verifier will re-hash — project-relative, so the bundle is portable.
    // It was `relative(cwd, abs)` with nothing stopping a climb out: `runward bundle ../outside.txt`
    // emitted a subject literally named `../outside.txt`, which is neither project-relative nor
    // portable, and bound a file the mission does not contain into a document about that mission.
    // Measured 2026-08-26. ADR-0019's containment governs evidence; a bundle subject is the same
    // claim one envelope out, so it holds here too.
    const boundary = root ?? process.cwd();
    const rel = relative(boundary, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      console.error(status.error(`Artifact resolves outside the project this mission audits (ADR-0019): ${a} → ${abs}. A bundle binds the artifacts of THIS delivery; cite a path inside ${boundary}.`));
      process.exit(2);
    }
    const name = toPosix(relative(process.cwd(), abs)) || basename(abs);
    if (seen.has(name)) continue; // naming one artifact twice binds it once
    seen.add(name);
    subjects.push({ name, digest: { sha256: rawFileSha256(abs) } });
  }

  process.stdout.write(JSON.stringify(buildBundleStatement(subjects, missionName, VERSION), null, 2) + "\n");
}
