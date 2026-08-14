import { writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { buildVerdictStatement } from "../lib/attestation.js";
import { analyze, findMissionRoot } from "../lib/mission.js";
import { decisionCoverage, rulesDir } from "../lib/conformance.js";
import { GATE_NON_SCOPE, corpusStamp } from "../lib/rules.js";
import { renderEvidenceLock, EVIDENCE_LOCK } from "../lib/evidence.js";
import { computeVerdict, verdictFrom } from "../lib/verdict.js";

import { behavioralProof } from "../lib/behavioral-proof.js";
import { verifyFindings, VERIFY_FINDINGS } from "../lib/verify-findings.js";
import { runHooks } from "../lib/hooks.js";
import { c, createHeader, generationDate, section, status } from "../lib/styles.js";
import { VERSION } from "../lib/paths.js";

/**
 * Gate audit — the gap analysis: which deliverable, expected at which
 * phase, is present, started, or still a raw template.
 * With --strict, also verifies the rule-conformance manifests (ADR-0001): every
 * CRITICAL/HIGH rule mapped to a build phase must be accounted for, applied
 * evidence must point at something real (ADR-0019/0020/0021 — typed pointers,
 * non-vacuity, signatures, drift, seal). It checks the presence and shape of a
 * traced decision, never the quality of the implementation — that stays the
 * operator's judgment at the gate.
 * With --freeze (implies --strict), a green gate is sealed: the resolvable
 * evidence files are hashed into runward/evidence-lock.json (ADR-0021).
 * With --json, the same verdict is emitted as a stable machine contract (ADR-0030)
 * so an agent drives on data, not scraped text — the exit-code contract is unchanged.
 * Exit codes: 0 = current gate clean, 1 = gaps, 2 = no mission found.
 */
export async function checkCommand(opts: { path?: string; strict?: boolean; hooks?: boolean; coverage?: boolean; freeze?: boolean; json?: boolean; through?: string; attest?: boolean }): Promise<void> {
  if (opts.freeze) opts.strict = true; // a seal certifies a strict crossing
  // ADR-0053: a declared horizon certifies only a prefix; a seal certifies a full crossing. The two
  // are mutually exclusive by construction — sealing a partial arc would read like completion, the
  // precise false green this mode refuses. Misuse → exit 2, like any bad flag combination.
  if (opts.through && opts.freeze) {
    console.error(status.error("`--through` cannot be combined with `--freeze`: a seal certifies a full crossing, a declared horizon only a prefix. Seal the whole arc (drop --through), or drop --freeze."));
    process.exit(2);
  }
  // In --json and --attest mode every human line is suppressed; the sole output is one JSON object
  // at the end (the payload, or the in-toto Statement wrapping it).
  const machine = !!opts.json || !!opts.attest;
  const log = (s = ""): void => { if (!machine) console.log(s); };

  const root = findMissionRoot(resolve(process.cwd(), opts.path ?? "."));
  if (!root) {
    if (machine) {
      process.stdout.write(JSON.stringify({ runward: VERSION, mission: null, verdict: "no-mission", exitCode: 2 }) + "\n");
    } else {
      console.error(status.error("No runward/ mission found here or above. Run `runward init` first."));
    }
    process.exit(2);
  }
  const mission = join(root, "runward");
  const report = analyze(mission);

  log(createHeader(`Runward v${VERSION} — gate audit`, root));

  let hookFailed = 0;
  if (opts.hooks) {
    const before = runHooks(mission, "before", root, { quietStdout: !!opts.json });
    if (before.ran > 0) {
      log(section("Hooks · before"));
      log("  " + (before.failed.length ? status.error(`${before.failed.length}/${before.ran} failed`) : status.success(`${before.ran} ok`)));
      hookFailed += before.failed.length;
    }
  }

  const glyph = {
    "filled": c.success("✓"),
    "in-progress": c.warning("◐"),
    "untouched": c.darkGray("○"),
    "missing": c.error("✗"),
  } as const;
  const legendNote = {
    "filled": "",
    "in-progress": c.warning(" — placeholders remain"),
    "untouched": c.darkGray(" — raw template"),
    "missing": c.error(" — file missing"),
  } as const;

  // Structured collectors for --json (ADR-0030) — populated alongside the human render.
  const deliverablesData: Array<{ phase: string; artifact: string; relPath: string; state: string }> = [];
  const conformanceData: Array<{ scope: string; rule: string; problem: string }> = [];

  // ADR-0047: the verdict is computed in src/lib/verdict.ts, which a unit test can import. Nothing
  // below re-decides anything — it renders `v` and, at the end, exits on `v.exitCode`. A second
  // opinion here would be the defect, not a safety net.
  const verdict = computeVerdict(mission, { strict: opts.strict, freeze: opts.freeze, hookFailed, through: opts.through });
  const { gaps, strictGaps, checked } = verdict;

  for (const phase of report.phases) {
    log(section(phase.spec.label));
    for (const { artifact, state } of phase.artifacts) {
      log(`  ${glyph[state]} ${c.white(artifact.label)} ${c.darkGray(`(runward/${artifact.relPath})`)}${legendNote[state]}`);
    }
  }
  deliverablesData.push(...verdict.deliverables);

  // ADR-0053: the declared-horizon banner, printed loud so a green prefix is never read as a
  // completion. The verdict certifies phases up to `--through`; everything past it is deferred,
  // named here and in the JSON, never conflated with "crossed".
  if (verdict.horizon) {
    const deferredPhases = [...new Set(verdict.horizon.deferred.map((r) => r.phase))];
    log(section(`Construction horizon (--through ${verdict.through})`));
    log(`  ${c.warning("◑")} ${c.white(`prefix verdict through ${verdict.through}`)}${c.darkGray(` — ${verdict.horizon.deferred.length} later deliverable(s) deferred; this is NOT a completion verdict.`)}`);
    if (deferredPhases.length) log(`      ${c.darkGray("deferred: " + deferredPhases.join(", "))}`);
    log(`  ${c.darkGray("The release / merge-to-main gate is always the full")} ${c.primary("runward check --strict")} ${c.darkGray("(no --through). This flag is a construction progress signal, never the sole required release check (ADR-0053).")}`);
  }

  if (opts.strict) {
    log(section("Rule conformance (--strict)"));
    for (const g of verdict.gated) {
      if (g.skipped) continue;
      if (g.violations.length === 0) {
        log(`  ${status.success(`${g.label}: ${g.expectedCount} rule(s) accounted for`)}`);
      } else {
        for (const viol of g.violations) {
          log(`  ${c.error("✗")} ${c.darkGray(g.label + " · ")}${c.white(viol.rule)}${c.darkGray(" — " + viol.problem)}`);
          conformanceData.push({ scope: g.label, rule: viol.rule, problem: viol.problem });
        }
      }
    }
    if (checked === 0) log("  " + c.darkGray("no CRITICAL/HIGH rules mapped to a build phase"));
    // The lines above read as though the critical set were covered. It is not: on the shipped corpus,
    // 45 rules are CRITICAL or HIGH and 31 are mapped to a gated phase. The other 14 are never
    // demanded, five of them CRITICAL. That is a scope decision and it is reported, never gated —
    // turning it into a gap would red every honest mission on day one. Leaving it unsaid was the
    // defect, because it let a reader believe a sentence the output never supported.
    {
      const cs = verdict.criticalScope;
      if (cs.unmapped.length > 0) {
        log(`  ${c.darkGray(`scope: ${cs.mapped} of ${cs.total} CRITICAL/HIGH rules are mapped to a gated phase. The other ${cs.unmapped.length} are never demanded by this gate:`)}`);
        log(`      ${c.darkGray(cs.unmapped.slice(0, 6).join(", ") + (cs.unmapped.length > 6 ? `, … and ${cs.unmapped.length - 6} more (\`runward rules --json\`)` : ""))}`);
      }
    }

    // The corpus the gate judges against belongs to the audited party. ADR-0002's floor is an
    // invariant of CARDINALITY, so substitution and fabrication passed it untouched: an audit made
    // this gate exit 0 on 36 rule files containing the word "ok". `scaffold-lock.json` already held
    // the hash of every rule runward wrote; nothing read it here. Now the verdict does.
    const corpus = verdict.corpus;
    if (corpus.status === "verifiable" && (corpus.edited.length || corpus.missing.length || corpus.extra.length)) {
      log(section("Rule corpus (--strict)"));
      for (const f of corpus.missing) {
        log(`  ${c.error("✗")} ${c.white(f)}${c.darkGray(" — a rule runward wrote is gone from runward/rules/")}`);
        conformanceData.push({ scope: "corpus", rule: f, problem: "rule removed from the mission corpus" });
      }
      for (const f of corpus.edited) {
        log(`  ${c.error("✗")} ${c.white(f)}${c.darkGray(" — edited since runward wrote it (impact, phases or signature may no longer be the shipped ones)")}`);
        conformanceData.push({ scope: "corpus", rule: f, problem: "rule edited since runward wrote it" });
      }
      for (const f of corpus.extra) {
        log(`  ${c.error("✗")} ${c.white(f)}${c.darkGray(" — a rule runward never wrote, declaring a gated phase at CRITICAL/HIGH: it would count toward the non-vacuity floor and stand in for a shipped rule. House rules are welcome; give them `phases: []` or a MEDIUM/LOW impact so they do not satisfy the gate on their own.")}`);
        conformanceData.push({ scope: "corpus", rule: f, problem: "rule not written by runward" });
      }
      log(`  ${c.darkGray("The gate judges your mission against this corpus. If the corpus moved, the verdict is about something else. Run")} ${c.primary("runward update")} ${c.darkGray("to restore it, or")} ${c.primary("runward update --force")} ${c.darkGray("to take the package version.")}`);
    } else if (corpus.status === "unrecorded") {
      log(section("Rule corpus (--strict)"));
      log(`  ${c.error("✗")} ${c.white("(corpus)")}${c.darkGray(" — this mission keeps its own copy of the rules and carries no scaffold-lock.json, so the gate cannot check that corpus against what runward wrote: it would be judging your mission against rules it cannot vouch for. Run")} ${c.primary("runward update")} ${c.darkGray("once to record it, or remove")} ${c.primary("runward/rules/")} ${c.darkGray("to judge against the installed package instead.")}`);
      conformanceData.push({ scope: "corpus", rule: "(corpus)", problem: "rule corpus not recorded: scaffold-lock.json is absent, so the corpus the gate judges against cannot be verified" });
    }

    // What the gate actually verified, on THIS mission (ADR-0040 applied per-run rather than in
    // the abstract). Accepting prose is a decision, not a defect: an absence cannot be pointed at
    // — "the CLI reads no secret at runtime" has no file to cite, and forcing a pointer there
    // would manufacture the cited-not-applied this tool exists to catch. What WAS a defect is
    // accepting it silently. A field report ran with 0 of 24 rows mechanically verified for
    // months; the number was one line of arithmetic away and nobody printed it. The verdict is
    // unchanged: this counts, it never gates.
    const ev = verdict.breakdown;
    // PRINTED UNCONDITIONALLY. It used to be gated on `applied > 0`, so a mission answering `n/a`
    // to all 36 rules — the emptiest pass an audit could build — removed the only vacuity signal
    // the product has. The worst case must not be the quietest.
    {
      log(section("What this gate verified"));
      log(`  ${c.darkGray(`${ev.applied} applied · ${ev.deviated} deviated · ${ev.na} n/a`)}`);
      if (ev.applied === 0 && ev.rows > 0) {
        log(`  ${c.warning("!")} ${c.white("nothing was verified mechanically")}${c.darkGray(" — every row was answered by judgment or set aside. That can be legitimate; it is not a machine-checked gate.")}`);
      }
      const pct = ev.applied === 0 ? 0 : Math.round((ev.typed / ev.applied) * 100);
      if (ev.applied > 0) log(`  ${c.white(String(ev.typed))} ${c.darkGray(`of ${ev.applied} \`applied\` row(s) carry a pointer the gate opened and checked`)} ${c.darkGray(`(${pct}%)`)}`);
      // ADR-0051 decision 3: how many applied rows rest on a SIGNED rule — the gate checked the
      // evidence's shape, not only that it exists. Counted, never gated. Most rules are unsigned by
      // design (their text prescribes no token), so a low number here is expected, not a failure.
      if (ev.applied > 0) log(`  ${c.white(String(ev.signed))} ${c.darkGray(`of ${ev.applied} \`applied\` row(s) rest on a signed rule — the gate checked the evidence's shape; for the others it verified the evidence exists, not its shape`)}`);
      if (ev.prose > 0) {
        log(`  ${c.warning("!")} ${c.white(String(ev.prose))} ${c.darkGray("row(s) are prose: accepted on your judgment, never verified (ADR-0004)")}`);
        for (const r of ev.proseRows.slice(0, 5)) log(`      ${c.darkGray(`${r.deliverable} · ${r.rule}`)}`);
        if (ev.proseRows.length > 5) log(`      ${c.darkGray(`… and ${ev.proseRows.length - 5} more`)}`);
        log(`  ${c.darkGray("Prose is legitimate where nothing can be pointed at. Everywhere else, a typed pointer turns a sentence into something CI re-opens on every push:")} ${c.primary("file:PATH[:LINE][#SYMBOL]")}${c.darkGray(", ")}${c.primary("test:PATH[::NAME]")}${c.darkGray(", ")}${c.primary("adr:NNNN")}${c.darkGray(".")}`);
      }
    }
    // Under --freeze the old seal is being replaced, not verified — otherwise a changed
    // sealed file would make re-sealing impossible (the seal violation reddens the gate
    // that freeze requires green). Everything else must still be green to seal.
    const seal = verdict.seal;
    if (seal.present) {
      log(section("Evidence seal (--strict)"));
      if (seal.violations.length === 0) {
        // `sealedAt` is DECLARED, not observed. The lock is a JSON file in the audited repository and
        // nothing signs it: editing the date by hand yields "sealed 1999-12-31" with exit 0, verified
        // 2026-08-08. `RUNWARD_NOW` reaches it too, but that is a detail — the date is unverifiable by
        // construction, and hardening the env var would be theatre. What the seal proves is that the
        // cited files still hash to what they hashed WHEN it was written; the "when" is the operator's
        // word. Saying so where the date is printed is the only honest fix available.
        log(`  ${status.success(`seal intact — ${seal.count} evidence file(s)`)}${c.darkGray(`, sealed ${seal.sealedAt ?? "?"} (date declared by the mission, not observed by the gate)`)}`);
      } else {
        for (const v of seal.violations) {
          log(`  ${c.error("✗")} ${c.white(v.rule)}${c.darkGray(" — " + v.problem)}`);
          conformanceData.push({ scope: "evidence-seal", rule: v.rule, problem: v.problem });
        }
      }
    }
    const unratified = verdict.unratified;
    if (unratified.length > 0) {
      log(section("Reconstruction lifecycle (--strict)"));
      for (const u of unratified) {
        log(`  ${c.error("✗")} ${c.white(u.file)}${c.darkGray(" — " + u.reason)}`);
        conformanceData.push({ scope: "reconstruction", rule: u.file, problem: u.reason });
      }
      log("  " + c.darkGray("ratify each: write the real why + a re-evaluation trigger and set Status: accepted (rename DRAFT→ADR), or set Status: rejected and keep the file (a deleted DRAFT is re-proposed by the next --mine). A hypothesis is not a decision."));
    }
    if (checked > 0 && strictGaps === 0) {
      // The two proofs, made legible together: this gate is the DOCUMENTARY proof (decisions traced);
      // the BEHAVIORAL proof is the operator's test suite. runward reads the pointer, never runs the code.
      log(section("Behavioral proof (advisory, above the gate)"));
      log("  " + c.darkGray("this gate is the documentary proof: the decisions are traced. runward did not run your code — it is not a runtime. The behavioral proof is your test suite."));
      const bp = behavioralProof(mission, root);
      if (!bp.declared) {
        log("  " + c.darkGray("no behavioral proof declared — add `Behavioral proof: <command>` to runward/floor.md §2 (and optionally `Proof artifact: <path>`)."));
      } else {
        if (bp.command) log(`  ${c.darkGray("prove behavior with:")} ${c.white(bp.command)}`);
        if (bp.artifact) {
          if (!bp.present) log(`  ${c.warning("◑")} ${c.darkGray("proof artifact")} ${c.white(bp.artifact)} ${c.warning("missing — run the command to produce it")}`);
          else {
            const fresh = bp.fresh === undefined ? "" : bp.fresh ? c.success(" · fresh") : c.warning(" · stale (older than the code — re-run)");
            log(`  ${c.success("✓")} ${c.darkGray("proof artifact")} ${c.white(bp.artifact)} ${c.darkGray(`(${bp.date})`)}${fresh}`);
          }
        }
        log("  " + c.darkGray("advisory — runward reports presence and freshness, never runs or reads the result. You cross on both proofs."));
      }
      log(section("Semantic check (advisory, above the gate)"));
      log("  " + c.darkGray("the gate proved every CRITICAL/HIGH rule was traced — not that the code applies it. Before you cross, run the verify workflow (runward/workflows/verify.md): an adversarial cite-vs-apply pass, ideally on a different model. Advisory, agent-executed, never blocks the gate (ADR-0007)."));
      const vf = verifyFindings(mission);
      if (!vf.present) {
        log("  " + c.darkGray(`no verify findings recorded yet — the workflow writes them to runward/${VERIFY_FINDINGS}.`));
      } else {
        const freshness = vf.fresh ? c.success(" · fresh") : c.warning(" · stale (a gated manifest changed since — re-run the verify workflow)");
        log(`  ${c.success("✓")} ${c.darkGray("verify findings")} ${c.white(`runward/${VERIFY_FINDINGS}`)} ${c.darkGray(`(${vf.date})`)}${freshness}`);
        log("  " + c.darkGray("advisory — runward reports presence and freshness, never reads a verdict. The findings inform your crossing; they never gate it."));
      }
    }
  }

  if (opts.coverage) {
    log(section("Documentation coverage (advisory)"));
    let filled = 0, totalArt = 0;
    for (const phase of report.phases) for (const { state } of phase.artifacts) { totalArt++; if (state === "filled") filled++; }
    log(`  ${c.primaryBold("Deliverables")}  ${c.white(`${filled}/${totalArt} filled`)}`);
    const dc = decisionCoverage(mission);
    log(`  ${c.primaryBold("Decisions")}     ${c.white(`${dc.ratified}/${dc.total} ratified`)}${dc.unratified.length ? c.warning(`  (${dc.unratified.length} to ratify)`) : ""}`);
    for (const u of dc.unratified) log(`     ${c.warning("◑")} ${c.white(u.file)}${c.darkGray(" — " + u.reason)}`);
    log("  " + c.darkGray("advisory — a ratio of what is documented and ratified, not a claim of completeness. Does not affect the verdict."));
  }

  if (opts.hooks) {
    const after = runHooks(mission, "after", root, { quietStdout: !!opts.json });
    if (after.ran > 0) {
      log(section("Hooks · after"));
      log("  " + (after.failed.length ? status.error(`${after.failed.length}/${after.ran} failed`) : status.success(`${after.ran} ok`)));
      hookFailed += after.failed.length;
    }
  }

  // Same arithmetic as computeVerdict, from the same function: the `after` hooks land after the
  // reading, so the count is only final here. There is no second definition of "clean".
  const { clean } = verdictFrom(gaps, strictGaps, hookFailed);

  log(section("Summary"));
  log(`  ${c.primaryBold("Current gate")}  ${c.white(report.currentPhase)}`);
  log(`  ${c.primaryBold("ADRs")}          ${c.white(String(report.adrCount))}${report.adrCount === 0 ? c.warning("  — no structural decision locked yet") : ""}`);
  if (clean && verdict.horizon) {
    log("\n" + status.success(`In good standing through ${verdict.through}. ${verdict.horizon.deferred.length} later deliverable(s) remain — a construction checkpoint, not a completion verdict. Release stays behind the full \`runward check --strict\`.`));
  } else if (clean) {
    log("\n" + status.success("All expected deliverables are filled. Cross gates on evidence, not on paperwork."));
  } else {
    const parts: string[] = [];
    if (gaps) parts.push(`${gaps} deliverable(s) not filled`);
    if (strictGaps) parts.push(`${strictGaps} floor rule-conformance gap(s)`);
    if (hookFailed) parts.push(`${hookFailed} hook(s) failed`);
    log("\n" + status.warning(`${parts.join(" · ")}. No phase closes without its artifact — and, under --strict, without its CRITICAL/HIGH rules accounted for.`));
    process.exitCode = 1;
  }

  if (opts.freeze) {
    log(section("Evidence seal — freeze (ADR-0021)"));
    if (gaps || strictGaps || hookFailed) {
      log("  " + status.error("refusing to seal a red gate — a seal certifies a crossing, not a hope. Close the gaps above, then re-run `runward check --freeze`."));
    } else {
      const sealedAt = generationDate();
      const content = renderEvidenceLock(mission, sealedAt);
      const count = Object.keys(JSON.parse(content).files).length;
      // Sealing nothing produced `✓ sealed 0 evidence file(s)` and then `✓ seal intact — 0 file(s)`
      // on every later run: rendered identically to a real seal, one number apart. A seal over an
      // empty set certifies nothing and reads like certification, which is the worst pair.
      if (count === 0) {
        log("  " + status.error("refusing to seal zero files — nothing in this mission resolves to evidence, so there is nothing to freeze. A seal over an empty set reads like proof and is not."));
        process.exitCode = 1;
      } else if (process.env.RUNWARD_DRY_RUN === "1") {
        log("  " + c.darkGray(`dry-run — would seal ${count} evidence file(s) into runward/${EVIDENCE_LOCK}`));
      } else {
        writeFileSync(join(mission, EVIDENCE_LOCK), content);
        log(`  ${status.success(`sealed ${count} evidence file(s) into runward/${EVIDENCE_LOCK} — commit it`)}`);
        log("  " + c.darkGray("a sealed file that later changes or disappears fails `check --strict` until you re-verify and re-seal."));
      }
    }
  }

  // Transmission surface: name the next gesture, so the operating agent can hand the human a decision.
  log(section("Next"));
  if (clean) {
    log(`  Assemble the evidence pack with ${c.primary("runward compliance <regime>")} ${c.darkGray("(iso-42001 · nist-ai-rmf · eu-ai-act), or")} ${c.primary("runward status")} ${c.darkGray("for a handover snapshot.")}`);
  } else {
    log(`  Fill the deliverable(s) named above, then re-run ${c.primary("runward check")}. ${c.primary("runward status")} ${c.darkGray("names exactly what is open at the current gate.")}`);
  }
  log();

  // ── Machine contract (ADR-0030) ──────────────────────────────────────
  // One deterministic JSON object; the exit code (set above) stays the primary signal.
  if (machine) {
    const payload = {
      runward: VERSION,
      mission: root,
      currentGate: report.currentPhase,
      adrCount: report.adrCount,
      strict: !!opts.strict,
      verdict: clean ? "clean" : "gaps",
      exitCode: clean ? 0 : 1,
      gaps: { deliverables: gaps, conformance: strictGaps, hooks: hookFailed, deferred: verdict.deferredGaps },
      deliverables: deliverablesData,
      // ADR-0053: additive. `through` is the declared horizon (null without --through); `horizon`
      // surfaces the deferred deliverables as an explicit machine state, so a consumer cannot read a
      // prefix green as mission-complete. `currentGate`/`steadyState` above keep their whole-arc truth.
      through: verdict.through,
      horizon: verdict.horizon,
      // ADR-0057: the vendored org corpus's self-described {name, version}, or null (the package
      // corpus and a legacy mission carry no stamp). Additive, read in-tree with no fetch; a fleet
      // view (the corpus-authority brick) reads it to see which corpus each repo is pinned to.
      // Named `corpusPin` to avoid the strict-block `corpus` (corpus divergence) — a different thing.
      corpusPin: corpusStamp(rulesDir(mission)),
      // ADDITIVE, per ADR-0030. Until 2026-08-08 this payload was strictly LESS informative than the
      // terminal beside it: an agent driving on `--json` could not see how much of the verdict was
      // mechanically verified, whether the rule corpus could be checked at all, or whether a seal
      // existed. That inverts the doctrine of ADR-0045 — the machine surface is the one a CI consumes
      // blind, so it is the one that must not go quiet at the worst moment. Measured on 2026-08-06: a
      // mission answering `n/a` to every row and one carrying real evidence produced the same object.
      //
      // `gateNonScope` travels with the counters on purpose. A consumer that keeps the numbers and
      // drops the caveat is the exact failure this project keeps finding in its own artifacts.
      ...(opts.strict ? {
        conformance: conformanceData,
        evidence: {
          rows: verdict.breakdown.rows, applied: verdict.breakdown.applied,
          deviated: verdict.breakdown.deviated, na: verdict.breakdown.na,
          typed: verdict.breakdown.typed, prose: verdict.breakdown.prose,
          signed: verdict.breakdown.signed,
        },
        corpus: {
          status: verdict.corpus.status, missing: verdict.corpus.missing,
          edited: verdict.corpus.edited, extra: verdict.corpus.extra,
        },
        seal: {
          present: verdict.seal.present, count: verdict.seal.count,
          sealedAt: verdict.seal.sealedAt ?? null, violations: verdict.seal.violations.length,
        },
        criticalScope: verdict.criticalScope,
        gateNonScope: GATE_NON_SCOPE,
      } : {}),
    };
    if (opts.attest) {
      // ADR-0055 layer 1: wrap the verdict in an UNSIGNED in-toto Statement. The predicate is the
      // same payload with the machine-specific absolute mission path replaced by the mission's own
      // name, so the attestation is portable; the subject digest (mission tree ∪ cited evidence)
      // binds it to this exact state. No signature field: signing is the operator's opt-in step
      // under their own key (layer 5).
      const predicate = { ...payload, mission: basename(root) };
      const statement = buildVerdictStatement(root, mission, predicate);
      process.stdout.write(JSON.stringify(statement, null, 2) + "\n");
    } else {
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    }
  }
}
