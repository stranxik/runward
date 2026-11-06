# stranxik/runward · v0.46.0 · grille@1

Commit `192ca3d63c456a4235aac8062aff21f16733c520` (tree `64dd3decf1a8`), committed 2026-10-28T12:44:23+01:00. Window: 216 first-parent commit(s), previous-record from `0e194d6accf9`.

Snapshot of 2026-11-06, not concordant: taken while the default branch pointed at `32d8425b1cb4`, so every repository setting it read is not observed for this commit.

Record `b213d12732fb03c45bf9bb8f27e27b83ab3b728cfe6a35e66c2c33b94501ef2b` · internal part `2bd5e1c4d216` · external part `1cc57bfdc0f3` · runward-assess 0.1.0 · grid `34a443153fa1`.

## The face

Each axis reads the highest tier whose every applicable criterion is met, tiers cumulative. No global score, no average, no composite percentage. n/a does not block; not observed and error block, and are counted apart from not met.

| Axis | Tier | P1 met | P2 met | P3 met | n/a | not observed | error | first tier blocked by |
|---|---|---|---|---|---|---|---|---|
| FIA Reliability and test evidence | **P0** | 0/2 | 0/4 | 0/3 | 2 | 4 | 0 | FIA-01 P1 not observed, FIA-02 P1 not observed |
| SEC Security and supply chain | **P0** | 4/5 | 1/6 | 0/4 | 2 | 6 | 0 | SEC-02 P1 not observed |
| GOU Governance and continuity | **P0** | 3/4 | 1/6 | 0/4 | 0 | 2 | 0 | GOU-02 P1 not observed |
| PRV Evidence and conformity | **P0** | 3/4 | 3/4 | 0/3 | 0 | 2 | 0 | PRV-04 P1 not met |
| PRO Public promises | **P0** | 0/2 | 0/2 | 0/1 | 0 | 3 | 0 | PRO-01 P1 not observed, PRO-03 P1 not observed |
| ADO Adoption experience | **P0** | 0/2 | 0/3 | – | 1 | 2 | 0 | ADO-01 P1 not observed, ADO-02 P1 not met |
| MAR Market signals | **P0** | 0/1 | 0/1 | 0/1 | 0 | 0 | 0 | MAR-01 P1 not met |

No axis lost a tier against the previous record (v0.37.1).

## The profile

Declared profiles: L (snapshot). A fact the commit or the snapshot does not show is marked declared; one they contradict is marked contradicted.

| Fact | Value | Basis | Note |
|---|---|---|---|
| publie_paquet | runward | snapshot | the registry holds runward |
| deploie_service | [0 items] | declared | no service declared |
| appelle_modele | false | declared | no model SDK among the commit's dependencies |
| gate_declare | node dist/cli.js check --strict | commit | the commit runs runward check --strict (a workflow) |
| docs_conformite | [3 items] | commit | every document exists in the tree |
| build_cmd | npm run build | commit | package.json has the script build |
| perimetre_mutation | stryker.config.json | commit | stryker.config.json exists |
| coverage_tool_absent | false | declared |  |
| image_published | false | declared |  |
| versions_published | true | snapshot | 64 versions in the registry |
| repo_public | true | declared | visibility not read for this commit |

## Criteria

Legend: ● met · ◆ not met · ○ n/a · ◌ not observed · ✕ error · · indicator. Internal criteria read the commit alone; the others read the snapshot too.

### FIA · Reliability and test evidence · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| FIA-01 r1 The test suite passes, stably | M | ◌ not observed | none | P1 ◌ P2 ◌ | cases not observed · clean_runs not observed | m.fia01.cases: not mechanized in runward-assess 0.1.0: test_cmd run three times in the reference container, JUnit normalised to a census; m.fia01.run1_failures… |
| FIA-02 r1 Statement and branch coverage | M | ◌ not observed | none | P1 ◌ P2 ◌ P3 ◌ | statements not observed · branches not observed | m.fia02.report: not mechanized in runward-assess 0.1.0: a coverage report is produced by the pinned tool |
| FIA-03 r1 The tests catch sabotaged code | M | ◌ not observed | none | P2 ◌ P3 ◌ | files_caught not observed | m.fia03.files_caught: not mechanized in runward-assess 0.1.0: files of perimetre_sabotage whose stubbing turns the suite red, over the files of the perimeter |
| FIA-04 r1 The build is reproducible | M X | ◌ not observed | none | P2 ◌ P3 ◌ | two_builds_equal not observed | m.fia04.two_builds_equal: not mechanized in runward-assess 0.1.0: two clean builds in the reference container give the same digest |
| FIA-05 r1 Evaluations of the agentic behaviour | M noisy | ○ n/a | none | – | eval_set_digest not observed | applies to A; the profile declares L |
| FIA-06 r1 Reliability in operation | X | ○ n/a | none | – | slo_declared false | applies to W, A; the profile declares L |
| FIA-07 r1 Mutation (an instrument, never a tier: runward ADR-0046) | M noisy | · indicator | none | – | perimeter_files 25 · register_survivors 2403 · register_holes 1993 · holes_by_default 1621 |  |

### SEC · Security and supply chain · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| SEC-01 r1 Coordinated disclosure | M X | ◌ not observed | P1 | P1 ● P2 ◌ | channel true · pvr_enabled not observed | x.sec01.pvr_enabled: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45 |
| SEC-02 r1 What is installed is what was tested; the product's SBOM | M X | ◌ not observed | none | P1 ◌ P2 ◌ P3 ◌ | lockfile true | x.sec02.install_from_lock: not mechanized in runward-assess 0.1.0: an install from the committed lockfile succeeds in a sandbox |
| SEC-03 r1 Known vulnerabilities; visibility of the project's advisories | X | ◌ not observed | P2 | P1 ● P2 ● P3 ◌ | vulnerable_packages 1 · high_unexcepted 0 · advisories_published not observed | x.sec03.advisories_not_visible: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45; x.sec03.affected_not… |
| SEC-04 r1 Static analysis and secrets | M | ◌ not observed | P1 | P1 ● P2 ◌ | blobs_scanned 5314 · secrets_unexcepted 0 | m.sec04.sast_high_unexcepted: not mechanized in runward-assess 0.1.0: high-severity SAST results (rules pinned by digest) without a motivated exception |
| SEC-05 r1 Hardened CI; Scorecard | M X | ◌ not observed | P1 | P1 ● P2 ◌ P3 ◌ | workflow_high 0 · scorecard_score not observed · scorecard_version not observed | x.sec05.scorecard_zero_crit_high: Scorecard's latest result is of commit 32d8425b1cb4, not of this one |
| SEC-06 r1 Provenance of the deliverables | X M | ◌ not observed | none | P2 ◌ P3 ◆ | signing_jobs 6 · signing_job_clean false | x.sec06.provenance_verified: not mechanized in runward-assess 0.1.0: gh attestation verify --bundle with a captured trusted root and the signer workflow pinned |
| SEC-07 r1 Agentic surface | M | ○ n/a | none | – | tools_registered not observed · tools_missing not observed | applies to A; the profile declares L |
| SEC-08 r1 Web surface | X | ○ n/a | none | – | urls not observed · high_findings not observed | applies to W; the profile declares L |

### GOU · Governance and continuity · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| GOU-01 r1 Governance files | M | ● met | P2 | P1 ● P2 ● | license_id MIT |  |
| GOU-02 r1 Independent review and branch protection | X | ◌ not observed | none | P1 ◌ P2 ◆ P3 ◆ | reviewed 0/145 (0.0 %) · required_checks not observed | x.gou02.force_push_blocked: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45; x.gou02.deletion_blocked… |
| GOU-03 r1 Continuity of access | X | ◌ not observed | none | P2 ◌ P3 ◌ | admin_humans not observed · registry_owners not observed | x.gou03.admin_humans: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45; p.publie_paquet is empty is no… |
| GOU-04 r1 Dependence on few people (CHAOSS) | M | ◆ not met | none | P2 ◆ P3 ◆ | window_commits 177 · authors 1 · absence_factor 1 · elephant_factor 1 | m.gou04.absence_factor >= 2 is not met (read 1) |
| GOU-05 r1 Decisions recorded and kept current | M | ◆ not met | P1 | P1 ● P2 ◆ | adrs 106 · trigger_dated 106/106 (100.0 %) · overdue_unnoted 3 | m.gou05.overdue_unnoted = 0 is not met (read 3) |
| GOU-06 r1 Versions and support | M X | ◆ not met | P1 | P1 ● P2 ◆ P3 ◆ | published_before_commit 63 · published_without_tag 0 · published_without_changelog 0 | m.gou06.support_policy is true is not met (read false); d.gou06.support_consistent is true is not met (read false) |

### PRV · Evidence and conformity · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| PRV-01 r1 Traceability from requirement or decision to evidence | M | ● met | P2 | P1 ● P2 ● | rows 46 · pointers 70/70 (100.0 %) |  |
| PRV-02 r1 The cited evidence is fresh | M | ◌ not observed | none | P3 ◌ | stale_reports not observed | m.prv02.stale_reports: not mechanized in runward-assess 0.1.0: cited reports whose regenerated census or verdicts differ |
| PRV-03 r1 The declared gate withstands the sabotage catalogue | M | ◆ not met | P2 | P1 ● P2 ● P3 ◆ | gate_version 0.46.0 · gate_exit 0 · must_refuse 20/32 (62.5 %) · false_red 1 | m.prv03.must_refuse >= 100/100 is not met (read 20/32); m.prv03.false_red = 0 is not met (read 1) |
| PRV-04 r1 Defect register | M | ◆ not met | none | P1 ◆ P2 ● P3 ◆ | entries 182 · unclassified_over_30d 0 · fixed_without_test 44 | m.prv04.parsed >= 100/100 is not met (read 162/182) |
| PRV-05 r1 The regulatory texts cited are current | X | ◌ not observed | P1 | P1 ● P2 ◌ | cited 3/3 (100.0 %) | x.prv05.late: not mechanized in runward-assess 0.1.0: documents behind an amending act captured from EUR-Lex |

### PRO · Public promises · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| PRO-01 r1 Factual statements tagged and checked (runward ADR-0092) | M X | ◌ not observed | none | P1 ◌ P2 ◆ P3 ◌ | captured not observed · untagged not observed | d.pro01.captured: derived from x.pro01.site_surfaces: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45 |
| PRO-02 r1 Public numbers are consistent | M X | ◌ not observed | none | P2 ◌ | checked not observed · mismatches not observed | d.pro02.checked: derived from x.pro02.site: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45; d.pro02.… |
| PRO-03 r1 Overpromise lexicon | M X | ◌ not observed | none | P1 ◌ | hits not observed · negated not observed | d.pro03.hits: derived from x.pro03.site_hits: read when main pointed at 32d8425b1cb4: a repository setting of 2026-11-06 does not describe 192ca3d63c45 |

### ADO · Adoption experience · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| ADO-01 r1 Clean install | M | ◌ not observed | none | P1 ◌ P2 ◌ | install_ref not observed | m.ado01.install_ref: not mechanized in runward-assess 0.1.0: the documented install in a blank reference container |
| ADO-02 r1 The documented start runs as written; links | M X | ◆ not met | none | P1 ◆ P2 ◌ | internal_links 954 · internal_broken 7 | m.ado02.quickstart: not mechanized in runward-assess 0.1.0: the Quickstart's commands run in a sandbox and exit as documented; m.ado02.internal_broken = 0 is n… |
| ADO-03 r1 The documented interface is the real one | M | ◌ not observed | none | P2 ◌ | interface_gaps not observed | m.ado03.interface_gaps: not mechanized in runward-assess 0.1.0: options, routes or tool schemas that differ from the documented reference |
| ADO-04 r1 Automated accessibility | M | ○ n/a | none | – | critical not observed · serious not observed | applies to W; the profile declares L |

### MAR · Market signals · P0

| Criterion | Class | State | Reached | Tiers | Values | Why |
|---|---|---|---|---|---|---|
| MAR-01 r1 Third-party signals | X | ◆ not met | none | P1 ◆ P2 ◆ P3 ◌ | third_party_humans 0 · third_party_merged_prs 0 | x.mar01.third_party_humans >= 1 is not met (read 0) |
| MAR-02 r1 Market indicators | X | · indicator | none | – | downloads_last_month 1342 · stars not observed · forks not observed |  |

## Not mechanized in runward-assess 0.1.0

These criteria read at least one fact this version does not collect. It is never inferred: the tier that needs it reads not observed, and blocks.

- ADO-01: m.ado01.install_alt, m.ado01.install_ref (P1, P2)
- ADO-02: m.ado02.outputs_found, m.ado02.quickstart, x.ado02.external_broken (P1, P2)
- ADO-03: m.ado03.interface_gaps (P2)
- FIA-01: m.fia01.cases, m.fia01.census_identical, m.fia01.clean_runs, m.fia01.run1_failures (P1, P2)
- FIA-02: m.fia02.branches, m.fia02.report, m.fia02.statements (P1, P2, P3)
- FIA-03: m.fia03.files_caught (P2, P3)
- FIA-04: m.fia04.two_builds_equal, x.fia04.alt_equals_published (P2, P3)
- MAR-01: x.mar01.dependents, x.mar01.references (P3)
- PRO-01: m.pro01.claims_false (P2)
- PRV-02: m.prv02.stale_reports (P3)
- PRV-05: x.prv05.late (P2)
- SEC-02: x.sec02.install_from_lock, x.sec02.installed_diverging, x.sec02.release_sbom_named (P1, P2, P3)
- SEC-04: m.sec04.sast_high_unexcepted (P2)
- SEC-06: x.sec06.provenance_verified (P2)

## Judged annex

Judged items stay apart from every tier; none was judged in this record.

- J-01: Is the value proposition understood from the home page alone? (0 / 1 / 2 / 3): not judged
- J-02: Overlap with each actor of the market list (low / medium / high): not judged
- J-03: Do provoked errors (outputs captured in M) state the cause and the gesture? (0 / 1 / 2 / 3): not judged
- J-04: Status of each dated promise of the roadmap (kept / partial / abandoned / not-started): not judged
- J-05: Design review by a person not involved (NIST SSDF PW.2) (attested / absent): not judged

## Inputs

- measure `5e33587580f8`, facts `341c9ab4776a`, by runward-assess 0.1.0 (tool `e2b3e69fce4d`) on darwin/arm64, Node.js v24.22.1, network blocked (EPERM)
- snapshot `49ff419e7f82`, 5 external fact(s) not observed: x.sec05.scorecard_below_8, x.sec05.scorecard_score, x.sec05.scorecard_version, x.sec05.scorecard_zero_crit_high, x.sec08.high_findings
- profile `e7c98762b394` · trigger tag · origin collected
