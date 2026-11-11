// The views of runward-fleet: pure functions from the index to HTML strings.
//
// One interface, two deployments (ADR-0121): the static page inlines this module with the index;
// a hosted deployment serves the same module and the same index.json. Either way the view reads no
// clock, fetches nothing, and computes no state: every count it prints arrives in the index with its
// denominator and the list it counts, and every number carries the source and the path that give it.
// The same functions run in Node at build time, where the view rules are checked on their output
// before a page is written (src/rules.js), and in the tests, against planted mutations.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ words
const WORDS = {
  en: {
    clean: "clean", gaps: "refused", "level-not-met": "level not met", "not-observed": "not observed", "not-available": "not available", observed: "present",
    filled: "filled", missing: "missing", ratified: "ratified", changed: "changed since", untraced: "untraced", blind: "blind",
    sealed: "sealed", unsealed: "unsealed", declared: "declared", undetermined: "origin undetermined", replayed: "replayed",
    "machine-established": "machine-established", "ci-declared": "ci-declared", verified: "verified", "outside-policy": "outside the policy",
    refused: "refused", absent: "absent", "not-verifiable": "not verifiable here", raised: "raised", "not-raised": "not raised",
    pinned: "pinned", unpinned: "unpinned",
  },
  fr: {
    clean: "sans écart", gaps: "refusé", "level-not-met": "niveau non atteint", "not-observed": "non observé", "not-available": "non disponible", observed: "présent",
    filled: "rempli", missing: "manquant", ratified: "ratifié", changed: "modifié depuis", untraced: "sans ratification enregistrée", blind: "à l'aveugle",
    sealed: "scellé", unsealed: "non scellé", declared: "déclaré", undetermined: "origine indéterminée", replayed: "rejoué",
    "machine-established": "machine-established", "ci-declared": "ci-declared", verified: "vérifiée", "outside-policy": "hors politique",
    refused: "refusée", absent: "absente", "not-verifiable": "non vérifiable ici", raised: "élevée", "not-raised": "non élevée",
    pinned: "épinglée", unpinned: "non épinglée",
  },
};
// The shape of a mark carries the state with its word, never a colour alone; a refusal inverts.
const SHAPE = {
  clean: "full", filled: "full", ratified: "full", sealed: "full", observed: "full", verified: "full", "machine-established": "full", raised: "full", pinned: "full",
  gaps: "inv", "level-not-met": "inv", missing: "inv", refused: "inv",
  changed: "half", untraced: "half", blind: "half", declared: "half", undetermined: "half", replayed: "half", "ci-declared": "half", "outside-policy": "half",
  unsealed: "void", "not-observed": "void", "not-available": "void", absent: "void", "not-verifiable": "void", "not-raised": "void", unpinned: "void",
};

const TEXT = {
  en: {
    nav: { "": "Fleet", mission: "Mission", history: "History", proof: "Proof", signatures: "Signatures", pr: "In the PR", sources: "Sources" },
    stamp: (title, asOf, n) => `${title} · as of <b>${asOf}</b> · ${n} sources`,
    asOfMissing: "no date declared",
    silent: "silent",
    fleetHead: (asOf, fmt) => `as of <b>${asOf}</b> · ${fmt}`,
    inventory: (name) => `inventory: <b>${name}</b>`,
    fleetTitle: "What the fleet proves.",
    fleetFace: (N, one, clean, gaps, silent, me, ci, notCrossed, digests) => `${N} ${one ? "mission" : "missions"} declared: ${clean} clean, ${gaps} refused, ${notCrossed ? `${notCrossed} at a level not met (nothing verified mechanically), ` : ""}${digests ? `${digests} received as digests only, ` : ""}${silent} silent. ${me} machine-established, ${ci} ci-declared.`,
    silentRow: "No export received for this declared mission: a finding, not a filter.",
    digestRow: "Received as a digest only: its content is not shared, so nothing of it is shown.",
    exit: "exit",
    historyOf: (o) => `history ${o}`,
    notThere: "What is not there",
    object: "Object", state: "State", whyCol: "Why",
    notThereNote: "An absence is shown, never filtered. States are never added into one score.",
    facts: {
      filled: "deliverables filled", rows: "conformance rows", applied: "applied", deviated: "deviated", na: "n/a",
      ratification: "ratification", ratifiedW: "ratified", changedW: "changed", untracedW: "untraced",
      seal: "seal", files: "files", requires: "evidence of another nature", flagged: "flagged, not blocking",
      assurance: "assurance mode in force", degraded: "degraded", verdictCell: "verdict cell",
    },
    why: {
      "declared-file-absent": (f) => `declared in fleet.json, file absent${f.file ? ` (${f.file})` : ""}`,
      "expected-none-declared": () => "expected in fleet.json, no export declared",
      unreadable: () => "present, unreadable",
      "signature-refused": () => "a declared signature does not verify: nothing is raised",
      "digest-only": () => "declared by its digest only: the content is not shared",
    },
    absent: {
      "period-report": "runward-period/1 (D3) is not built: no population of changes is written yet.",
      "landing-population": "ledger population (D2) is not built; a history here is a replay, not a population.",
      "event-stream": "runward-event/1 (D3) is not built: no agent activity is visible here.",
      "rfc3161-timestamps": "This version takes a signing time from a transparency log only; a bundle timed by an RFC 3161 authority reads not verifiable here.",
    },
    absentWhat: { "period-report": "Period report", "landing-population": "Landing population", "event-stream": "Event stream", "rfc3161-timestamps": "RFC 3161 timestamps" },
    kinds: { check: "check --json", attestation: "attestation", verify: "verify", witness: "witness", summary: "PR summary", report: "report", history: "history", signature: "signature" },
    mission: "mission",
    missionFace: (verdict, exit, gate, filled, rows, typed, prose) => `Verdict ${verdict} (exit ${exit}), current gate “${gate}”. ${filled} deliverables filled; ${rows} rows, of which ${typed} typed pointers opened by the gate and ${prose} in prose, never verified.`,
    gateChecked: "What the gate checked",
    rowsLine: "Rows applied · deviated · n/a", typedLine: "Typed pointers resolved", proseLine: "Rows in prose, declared",
    signedLine: "Rows whose signature shape was checked", filesLine: "Evidence files cited (outside runward/)", criticalLine: "Critical rules tied to a phase",
    sealLine: "Seal", sealDated: (d) => `dated ${d} (a date the mission declares)`, junitLine: "Committed JUnit report", junitRows: "row(s)",
    neverAsked: "Never asked by this gate:",
    ratTitle: "Ratification, as the tree declares it",
    ratNames: "Names declared:",
    ratNamesOmitted: "Names declared: not published on this page (fleet.json omits them).",
    ratUnknown: "runward cannot tell who answered, nor whether a person answered.",
    machineMode: "machine mode in force: a row without ratification is not a gap under this mode.",
    assurTitle: "Assurance mode",
    assurNone: "No delegation charter: the assurance mode is not declared.",
    assurLine: (m, deg) => `Mode <b>${m}</b> in force${deg ? ", degraded" : ""}.`,
    notInForce: "Not in force, as the CLI writes it:",
    stage: "delegation stage",
    conformanceTitle: "Conformance gaps", phase: "Phase", rule: "Rule", cause: "Cause", says: "What the gate says",
    noGaps: "No conformance gap in this export.",
    requiresTitle: "Evidence of another nature than required",
    requiresNote: "Flagged, not refused: the gate does not refuse these rows yet (ADR-0073).",
    nature: "Nature required", rowsCol: "Rows", which: "Which", none: "None.",
    byPhase: "Deliverables by phase",
    nonScope: "What the gate does not cover", verbatim: "verbatim",
    overTime: "Over time", replayedRevs: (n) => `${n} revisions replayed`, neverMixed: ", never mixed with other origins.",
    srcKinds: {},
    dossierTitle: "Evidence dossier", piece: "Piece", note: "Note",
    attPiece: "Verdict attestation (in-toto)", witPiece: "Verdict witness", verPiece: "verify output", sumPiece: "PR summary", repPiece: "Report for the assessor",
    sigPiece: "Signatures", noneDeclared: "none declared: nothing is raised above ci-declared",
    subject: "subject",
    keyHolder: "A key names its holder, not the workflow that used it.",
    histTitle: "The same judge, on every past tree.",
    histFace: (size, name, judge, clean, gaps, notCrossed) => `${size} revisions of ${name}, judged again by ${judge}: ${clean} clean, ${gaps} refused${notCrossed ? `, ${notCrossed} at a level not met (nothing verified mechanically)` : ""}.`,
    histNone: "No history in the exports: no record of a past tree reached this page.",
    histNote: "This replay prefigures ledger replay (ADR-0093, D2, not delivered): each past tree judged by one version, read from git, writing nothing in the repository. It is not what the CI said at the time, and a past green carries no present state. No record of a replay is ever raised.",
    legendBars: "bars: conformance gaps", legendClean: "● clean", legendRefused: "◆ refused or level not met", judgedBy: (j) => `judged by ${j}`,
    otherJudge: "⧉ judged by another version: not comparable without this marker",
    skew: (a, b) => `The latest export was judged by runward ${a}; this history by ${b}. The two are not compared.`,
    cols: { ref: "Ref.", commit: "Commit", date: "Commit date", verdict: "Verdict", gaps: "Gaps", assurance: "Assurance", digest: "Export digest" },
    proofHead: "proof · <b>re-check without us</b>",
    proofTitle: "The auditor needs only the repository.",
    proofFace: "At the cited commit, two commands re-derive the verdict, with no account and no network beyond the package registry. This page signs nothing; what it verified is on the signatures view.",
    proofNone: "No attestation in the exports: nothing here can be re-derived.",
    redo: "Redo the computation", expectSubject: "Expected subject:",
    builtFrom: (v) => `This export was judged by runward ${v}; a published version may differ.`,
    verifyTitle: "What verify re-derived",
    vDigest: "subject digest matches the tree", vVerdict: "verdict re-derives", vPredicate: "predicate body re-derives",
    vNot: "not re-derived offline:", vCaution: "Fields not re-derived prove nothing on their own.",
    noTree: "Without the tree", noTreeText: "Without the repository at the cited commit, or a mission snapshot, a third party inspects; it does not re-derive (ADR-0093, decision 8). verify re-derives from the working tree present.",
    witTitle: "The witness", witText: (f, n, r) => `${f}, ${n} files digested, result ${r}. A separate checker sharing no code with runward is the witness's reader (ADR-0089).`,
    witNot: "What the witness does not carry:",
    sigHead: "signatures · <b>the satellite's check</b>",
    sigTitle: "What a signature establishes, and what it does not.",
    sigFace: (N, one, ve, op, re, ab, nv, me) => `${N} ${one ? "signature" : "signatures"} declared: ${ve} verified under the policy, ${op} outside the policy, ${re} refused, ${ab} absent, ${nv} not verifiable here. ${me} missions machine-established.`,
    sigNoPolicy: "No trust policy: nothing can be raised, every cell reads ci-declared at most.",
    sigCli: "runward itself verifies no signature; this check is the satellite's, against the operator's trust policy (ADR-0093, decision 8).",
    policyTitle: "Trust policy", roots: "Trusted roots", logs: "log(s)", authorities: "authority(ies)",
    signersTitle: "Signers the policy pins", sId: "Id", sKind: "Kind", sRepos: "Repositories", sPins: "Pins", sState: "State",
    unpinnedRef: "does not pin refs/heads/main", unpinnedDigest: "does not pin the workflow file digest",
    perMission: "Per mission", covers: "covers", via: "via", signer: "signer", identity: "identity", checks: "checks", binds: "binds", reasons: "why not raised",
    raisedNote: "raised: the export it covers reads machine-established",
    reason: {
      "signature-file-absent": (r) => `the declared file is absent (${r.file})`,
      "no-policy": () => "no trust policy: nothing to verify against",
      "no-trusted-root": () => "the policy provides no trusted root",
      "bundle-unreadable": () => "the bundle is not JSON",
      "unsupported-bundle": (r) => `this version does not verify what the bundle relies on (${(r.checks ?? []).join(", ")})`,
      "signature-does-not-verify": (r) => `the signature does not verify (${(r.checks ?? []).join(", ")})`,
      "signer-pinned-for-other-repositories": () => "the signer is pinned for other repositories: a repository cannot sign for another",
      "workflow-digest-not-pinned": (r) => `the workflow digest ${r.digest} is not one the policy pins`,
      "signer-not-in-policy": (r) => `the signer ${r.workflow ?? "unknown"} is not in the policy`,
      "policy-unpinned-ref": (r) => `the policy entry ${r.signer} does not pin refs/heads/main: it raises nothing`,
      "policy-unpinned-workflow-digest": (r) => `the policy entry ${r.signer} does not pin the workflow file digest: it raises nothing`,
      "signed-for-another-repository": (r) => `signed for ${r.signed}, the mission is ${r.mission}: a repository cannot sign for another`,
      "signed-on-another-ref": (r) => `signed on ${r.signed ?? "no ref"}, the policy pins ${r.pinned}`,
      "runner-not-pinned": (r) => `runner ${r.signed ?? "unknown"}, the policy pins ${r.pinned}`,
      "no-landing-commit": () => "no landing commit declared in fleet.json: nothing to compare the signed commit with",
      "signed-at-another-commit": (r) => `signed at ${r.signed ?? "no commit"}, the landing commit declared is ${r.declared}`,
      "does-not-cover-export": (r) => `what was signed does not cover the ${r.covers} export`,
      "replay-never-raised": () => "a replayed record is never raised",
      "unsupported-manifest-format": (r) => `manifest format ${r.format} is not one this version reads`,
      "key-not-in-policy": () => "it verifies only under a key the policy does not pin",
      "manifest-unreadable": () => "the manifest is unreadable",
      "key-signatures-do-not-raise": () => "this build raises no key-signed export",
      "unsupported-signature-kind": (r) => `signature kind ${r.kind} is not one this version reads`,
    },
    prHead: "developer · <b>in the PR and in the agent</b>",
    prTitle: "The same verdict, where the work happens.",
    prFace: "The summary the forge shows is another writing of the same JSON: it computes nothing.",
    prNone: "No PR summary in the exports.",
    agentTitle: "In the agent and the IDE",
    agentText1: "<code>runward rules --for &lt;file&gt;</code> gives the rules when the file is touched; <code>runward gate-hook</code> blocks the end of a turn once when the gate is red, and logs every release.",
    agentText2: "An MCP server may make these commands discoverable; it never makes the gate apply, since the model may not call it (ADR-0029).",
    forgeTitle: "On the forge",
    forgeText: "The job summary, the check run and the MR note are renderings of the same JSON (ADR-0094). A forge view shows findings; it keeps no history and re-checks nothing.",
    srcHead: (n) => `sources · <b>${n} files</b>`,
    srcTitle: "Where every number comes from.",
    srcFace: "Every number shown carries the source and the JSON path that give it: hover it. The index is a function of the files below.",
    srcCols: { id: "Id", file: "File", by: "Produced by", origin: "Origin", digest: "sha256" },
    bytes: "bytes",
    rebuild: "Rebuild this page",
    fonts: "Fonts",
    builtBy: (v) => `Built by runward-fleet ${v}.`,
    dateNote: (d, s) => `Date: ${d}, ${s}.`,
    rulesTitle: "The rules this view holds",
    readingRulesTitle: "The rules the decision reading holds",
    readingRulesNote: "Five rules (ADR-0125), held on the reading and on the lexicon it is written from, in both languages; a test reddens on a planted breach of each.",
    rulesNote: "Eighteen rules (ADR-0093, decision 11). A rule held by the build is checked on every view before the page is written; a test reddens on a planted mutation of each.",
    held: { build: "build and test", test: "test", elsewhere: "held by runward, not by this view" },
    renderError: "This view could not be built from the index.",
  },
  fr: {
    nav: { "": "Flotte", mission: "Mission", history: "Historique", proof: "Preuve", signatures: "Signatures", pr: "Dans la PR", sources: "Sources" },
    stamp: (title, asOf, n) => `${title} · relevé du <b>${asOf}</b> · ${n} sources`,
    asOfMissing: "aucune date déclarée",
    silent: "silencieuse",
    fleetHead: (asOf, fmt) => `relevé du <b>${asOf}</b> · ${fmt}`,
    inventory: (name) => `inventaire : <b>${name}</b>`,
    fleetTitle: "Ce que la flotte prouve.",
    fleetFace: (N, one, clean, gaps, silent, me, ci, notCrossed, digests) => `${N} ${one ? "mission déclarée" : "missions déclarées"} : ${clean} sans écart, ${gaps} refusées, ${notCrossed ? `${notCrossed} au niveau non atteint (rien de vérifié mécaniquement), ` : ""}${digests ? `${digests} reçues en empreintes seules, ` : ""}${silent} silencieuses. ${me} machine-established, ${ci} ci-declared.`,
    silentRow: "Aucun export reçu pour cette mission déclarée : c'est un constat, pas un filtre.",
    digestRow: "Reçue en empreinte seule : son contenu n'est pas partagé, donc rien n'en est montré.",
    exit: "sortie",
    historyOf: (o) => `historique ${o}`,
    notThere: "Ce qui n'est pas là",
    object: "Objet", state: "État", whyCol: "Pourquoi",
    notThereNote: "Une absence s'affiche, elle ne se filtre pas. Les états ne s'additionnent jamais en une note.",
    facts: {
      filled: "livrables remplis", rows: "lignes de conformité", applied: "appliquées", deviated: "en écart", na: "n/a",
      ratification: "ratification", ratifiedW: "ratifiées", changedW: "modifiées", untracedW: "sans ratification enregistrée",
      seal: "sceau", files: "fichiers", requires: "preuves d'une autre nature", flagged: "signalées, non bloquantes",
      assurance: "mode d'assurance en vigueur", degraded: "dégradé", verdictCell: "cellule du verdict",
    },
    why: {
      "declared-file-absent": (f) => `déclaré dans fleet.json, fichier absent${f.file ? ` (${f.file})` : ""}`,
      "expected-none-declared": () => "attendu dans fleet.json, aucun export déclaré",
      unreadable: () => "présent, illisible",
      "signature-refused": () => "une signature déclarée ne se vérifie pas : rien n'est élevé",
      "digest-only": () => "déclaré par son empreinte seule : le contenu n'est pas partagé",
    },
    absent: {
      "period-report": "runward-period/1 (D3) n'est pas construit : aucune population de changements n'est encore écrite.",
      "landing-population": "ledger population (D2) n'est pas construit ; un historique ici est un rejeu, pas une population.",
      "event-stream": "runward-event/1 (D3) n'est pas construit : aucune activité d'agent n'est visible ici.",
      "rfc3161-timestamps": "Cette version lit l'heure de signature dans un journal de transparence seulement ; un bundle daté par une autorité RFC 3161 se lit non vérifiable ici.",
    },
    absentWhat: { "period-report": "Rapport de période", "landing-population": "Population des atterrissages", "event-stream": "Flux d'événements", "rfc3161-timestamps": "Horodatages RFC 3161" },
    kinds: { check: "check --json", attestation: "attestation", verify: "verify", witness: "témoin", summary: "résumé de PR", report: "rapport", history: "historique", signature: "signature" },
    mission: "mission",
    missionFace: (verdict, exit, gate, filled, rows, typed, prose) => `Verdict ${verdict} (sortie ${exit}), porte courante « ${gate} ». ${filled} livrables remplis ; ${rows} lignes, dont ${typed} pointeurs typés ouverts par le gate et ${prose} en prose, jamais vérifiée.`,
    gateChecked: "Ce que le gate a vérifié",
    rowsLine: "Lignes appliquées · en écart · n/a", typedLine: "Pointeurs typés résolus", proseLine: "Lignes en prose, déclarées",
    signedLine: "Lignes à signature de forme vérifiée", filesLine: "Fichiers de preuve cités (hors runward/)", criticalLine: "Règles critiques reliées à une phase",
    sealLine: "Sceau", sealDated: (d) => `daté ${d} (date déclarée par la mission)`, junitLine: "Rapport JUnit committé", junitRows: "ligne(s)",
    neverAsked: "Jamais demandées par ce gate :",
    ratTitle: "Ratification, telle que l'arbre la déclare",
    ratNames: "Noms déclarés :",
    ratNamesOmitted: "Noms déclarés : non publiés sur cette page (fleet.json les omet).",
    ratUnknown: "runward ne sait pas qui a répondu, ni si une personne a répondu.",
    machineMode: "mode machine en vigueur : une ligne sans ratification n'est pas un écart sous ce mode.",
    assurTitle: "Mode d'assurance",
    assurNone: "Aucune charte de délégation : le mode d'assurance n'est pas déclaré.",
    assurLine: (m, deg) => `Mode <b>${m}</b> en vigueur${deg ? ", dégradé" : ""}.`,
    notInForce: "Non en vigueur, tel que le CLI l'écrit :",
    stage: "étape de délégation",
    conformanceTitle: "Écarts de conformité", phase: "Phase", rule: "Règle", cause: "Cause", says: "Ce que dit le gate",
    noGaps: "Aucun écart de conformité dans cet export.",
    requiresTitle: "Preuves d'une autre nature que celle exigée",
    requiresNote: "Signalées, pas refusées : le gate ne refuse pas encore ces lignes (ADR-0073).",
    nature: "Nature exigée", rowsCol: "Lignes", which: "Lesquelles", none: "Aucune.",
    byPhase: "Livrables par phase",
    nonScope: "Ce que le gate ne couvre pas", verbatim: "verbatim",
    overTime: "Dans le temps", replayedRevs: (n) => `${n} révisions rejouées`, neverMixed: ", jamais mêlées aux autres origines.",
    srcKinds: {
      "fleet manifest": "inventaire de flotte", "trust policy": "politique de confiance", "trusted root": "racine de confiance", "public key": "clé publique",
      "records (JSON lines)": "relevés (lignes JSON)", "report (HTML)": "rapport (HTML)", "sigstore bundle": "bundle Sigstore", "signed manifest": "manifeste signé",
      "detached Ed25519 signature": "signature Ed25519 détachée", "public key shipped with the export (never trusted)": "clé publique livrée avec l'export (jamais de confiance)",
    },
    dossierTitle: "Dossier de preuve", piece: "Pièce", note: "Note",
    attPiece: "Attestation du verdict (in-toto)", witPiece: "Témoin du verdict", verPiece: "Sortie de verify", sumPiece: "Résumé de PR", repPiece: "Rapport pour l'auditeur",
    sigPiece: "Signatures", noneDeclared: "aucune déclarée : rien n'est élevé au-delà de ci-declared",
    subject: "sujet",
    keyHolder: "Une clé désigne son détenteur, pas le workflow qui l'a utilisée.",
    histTitle: "Le même juge, sur chaque arbre passé.",
    histFace: (size, name, judge, clean, gaps, notCrossed) => `${size} révisions de ${name}, rejugées par ${judge} : ${clean} sans écart, ${gaps} refusées${notCrossed ? `, ${notCrossed} au niveau non atteint (rien de vérifié mécaniquement)` : ""}.`,
    histNone: "Aucun historique dans les exports : aucun relevé d'un arbre passé n'a atteint cette page.",
    histNote: "Ce rejeu préfigure ledger replay (ADR-0093, D2, non livré) : chaque arbre passé jugé par une même version, lu depuis git, sans rien écrire dans le dépôt. Ce n'est pas ce que la CI a dit à l'époque, et un vert passé ne porte aucun état présent. Aucun relevé de rejeu n'est jamais élevé.",
    legendBars: "barres : écarts de conformité", legendClean: "● sans écart", legendRefused: "◆ refusé ou niveau non atteint", judgedBy: (j) => `jugé par ${j}`,
    otherJudge: "⧉ jugé par une autre version : non comparable sans ce marqueur",
    skew: (a, b) => `Le dernier export a été jugé par runward ${a} ; cet historique par ${b}. Les deux ne sont pas comparés.`,
    cols: { ref: "Réf.", commit: "Commit", date: "Date du commit", verdict: "Verdict", gaps: "Écarts", assurance: "Assurance", digest: "Empreinte de l'export" },
    proofHead: "preuve · <b>re-vérifier sans nous</b>",
    proofTitle: "L'auditeur n'a besoin que du dépôt.",
    proofFace: "Au commit cité, deux commandes re-dérivent le verdict, sans compte et sans réseau au-delà du registre de paquets. La page ne signe rien ; ce qu'elle a vérifié est sur la vue des signatures.",
    proofNone: "Aucune attestation dans les exports : rien ici ne se re-dérive.",
    redo: "Refaire le calcul", expectSubject: "Sujet attendu :",
    builtFrom: (v) => `Cet export a été jugé par runward ${v} ; une version publiée peut différer.`,
    verifyTitle: "Ce que verify a re-dérivé",
    vDigest: "l'empreinte du sujet correspond à l'arbre", vVerdict: "le verdict se re-dérive", vPredicate: "le corps du prédicat se re-dérive",
    vNot: "non re-dérivés hors ligne :", vCaution: "Les champs non re-dérivés ne prouvent rien par eux-mêmes.",
    noTree: "Sans l'arbre", noTreeText: "Sans le dépôt au commit cité, ni instantané de mission, un tiers inspecte ; il ne re-dérive pas (ADR-0093, décision 8). verify re-dérive depuis l'arbre de travail présent.",
    witTitle: "Le témoin", witText: (f, n, r) => `${f}, ${n} fichiers empreints, résultat ${r}. Un vérificateur séparé, sans code commun avec runward, en est le lecteur (ADR-0089).`,
    witNot: "Ce que le témoin ne porte pas :",
    sigHead: "signatures · <b>la vérification du satellite</b>",
    sigTitle: "Ce qu'une signature établit, et ce qu'elle n'établit pas.",
    sigFace: (N, one, ve, op, re, ab, nv, me) => `${N} ${one ? "signature déclarée" : "signatures déclarées"} : ${ve} vérifiées sous la politique, ${op} hors politique, ${re} refusées, ${ab} absentes, ${nv} non vérifiables ici. ${me} missions machine-established.`,
    sigNoPolicy: "Aucune politique de confiance : rien ne peut être élevé, chaque cellule se lit ci-declared au plus.",
    sigCli: "runward ne vérifie lui-même aucune signature ; cette vérification est celle du satellite, contre la politique de confiance de l'opérateur (ADR-0093, décision 8).",
    policyTitle: "Politique de confiance", roots: "Racines de confiance", logs: "journal(aux)", authorities: "autorité(s)",
    signersTitle: "Signataires que la politique épingle", sId: "Id", sKind: "Type", sRepos: "Dépôts", sPins: "Épingles", sState: "État",
    unpinnedRef: "n'épingle pas refs/heads/main", unpinnedDigest: "n'épingle pas l'empreinte du workflow",
    perMission: "Par mission", covers: "couvre", via: "par", signer: "signataire", identity: "identité", checks: "contrôles", binds: "lie", reasons: "pourquoi rien n'est élevé",
    raisedNote: "élevée : l'export couvert se lit machine-established",
    reason: {
      "signature-file-absent": (r) => `le fichier déclaré est absent (${r.file})`,
      "no-policy": () => "aucune politique de confiance : rien contre quoi vérifier",
      "no-trusted-root": () => "la politique ne fournit aucune racine de confiance",
      "bundle-unreadable": () => "le bundle n'est pas du JSON",
      "unsupported-bundle": (r) => `cette version ne vérifie pas ce dont le bundle dépend (${(r.checks ?? []).join(", ")})`,
      "signature-does-not-verify": (r) => `la signature ne se vérifie pas (${(r.checks ?? []).join(", ")})`,
      "signer-pinned-for-other-repositories": () => "le signataire est épinglé pour d'autres dépôts : un dépôt ne signe pas pour un autre",
      "workflow-digest-not-pinned": (r) => `l'empreinte de workflow ${r.digest} n'est pas une de celles que la politique épingle`,
      "signer-not-in-policy": (r) => `le signataire ${r.workflow ?? "inconnu"} n'est pas dans la politique`,
      "policy-unpinned-ref": (r) => `l'entrée ${r.signer} de la politique n'épingle pas refs/heads/main : elle n'élève rien`,
      "policy-unpinned-workflow-digest": (r) => `l'entrée ${r.signer} de la politique n'épingle pas l'empreinte du workflow : elle n'élève rien`,
      "signed-for-another-repository": (r) => `signé pour ${r.signed}, la mission est ${r.mission} : un dépôt ne signe pas pour un autre`,
      "signed-on-another-ref": (r) => `signé sur ${r.signed ?? "aucune ref"}, la politique épingle ${r.pinned}`,
      "runner-not-pinned": (r) => `runner ${r.signed ?? "inconnu"}, la politique épingle ${r.pinned}`,
      "no-landing-commit": () => "aucun commit d'atterrissage déclaré dans fleet.json : rien à quoi comparer le commit signé",
      "signed-at-another-commit": (r) => `signé au commit ${r.signed ?? "absent"}, le commit d'atterrissage déclaré est ${r.declared}`,
      "does-not-cover-export": (r) => `ce qui a été signé ne couvre pas l'export ${r.covers}`,
      "replay-never-raised": () => "un relevé rejoué n'est jamais élevé",
      "unsupported-manifest-format": (r) => `le format de manifeste ${r.format} n'est pas lu par cette version`,
      "key-not-in-policy": () => "elle ne se vérifie que sous une clé que la politique n'épingle pas",
      "manifest-unreadable": () => "le manifeste est illisible",
      "key-signatures-do-not-raise": () => "cette version n'élève aucun export signé par clé",
      "unsupported-signature-kind": (r) => `le type de signature ${r.kind} n'est pas lu par cette version`,
    },
    prHead: "développeur · <b>dans la PR et dans l'agent</b>",
    prTitle: "Le même verdict, là où l'on travaille.",
    prFace: "Le résumé que la forge affiche est une autre écriture du même JSON : il ne calcule rien.",
    prNone: "Aucun résumé de PR dans les exports.",
    agentTitle: "Dans l'agent et l'IDE",
    agentText1: "<code>runward rules --for &lt;fichier&gt;</code> donne les règles au moment où le fichier est touché ; <code>runward gate-hook</code> bloque une fois la fin de tour quand le gate est rouge, et consigne chaque passage outre.",
    agentText2: "Un serveur MCP peut faire découvrir ces commandes ; il ne fait jamais appliquer le gate, que le modèle peut ne pas appeler (ADR-0029).",
    forgeTitle: "À l'écrit de la forge",
    forgeText: "Le résumé de job, le check-run et la note de MR sont des rendus du même JSON (ADR-0094). Une vue de forge montre des constats ; elle ne garde pas l'historique et ne re-vérifie rien.",
    srcHead: (n) => `sources · <b>${n} fichiers</b>`,
    srcTitle: "D'où vient chaque chiffre.",
    srcFace: "Chaque nombre affiché porte la source et le chemin JSON qui le donnent : survolez-le. L'index est une fonction des fichiers ci-dessous.",
    srcCols: { id: "Id", file: "Fichier", by: "Produit par", origin: "Origine", digest: "sha256" },
    bytes: "octets",
    rebuild: "Reconstruire cette page",
    fonts: "Polices",
    builtBy: (v) => `Construit par runward-fleet ${v}.`,
    dateNote: (d, s) => `Date : ${d}, ${s}.`,
    rulesTitle: "Les règles que cette vue tient",
    readingRulesTitle: "Les règles que tient la lecture décideur",
    readingRulesNote: "Cinq règles (ADR-0125), tenues sur la lecture et sur le lexique dont elle est écrite, dans les deux langues ; un test rougit sur une infraction plantée de chacune.",
    rulesNote: "Dix-huit règles (ADR-0093, décision 11). Une règle tenue par le build est vérifiée sur chaque vue avant que la page ne s'écrive ; un test rougit sur une mutation plantée de chacune.",
    held: { build: "build et test", test: "test", elsewhere: "tenue par runward, pas par cette vue" },
    renderError: "Cette vue n'a pas pu se construire depuis l'index.",
  },
};

// The eighteen view rules of ADR-0093 decision 11, and where each is held.
export const RULES = [
  { id: 1, held: "test", en: "No state is computed by a view.", fr: "Aucun état n'est calculé par une vue." },
  { id: 2, held: "build", en: "The face is a function of fields, tied to its provenance by a golden test.", fr: "La face est une fonction des champs, liée à sa provenance par un test de référence." },
  { id: 3, held: "build", en: "States are never summed; no composite percentage.", fr: "Les états ne s'additionnent jamais ; aucun pourcentage composite." },
  { id: 4, held: "test", en: "Gaps and silent repositories are not filterable by default.", fr: "Écarts et dépôts silencieux ne se filtrent pas par défaut." },
  { id: 5, held: "test", en: "Silence is a finding.", fr: "Le silence est un constat." },
  { id: 6, held: "test", en: "A replayed record is never mixed with other origins.", fr: "Un relevé rejoué ne se mêle jamais aux autres origines." },
  { id: 7, held: "test", en: "No cross-version comparison without a marker.", fr: "Aucune comparaison entre versions sans marqueur." },
  { id: 8, held: "test", en: "No strong state is carried by time.", fr: "Aucun état fort n'est porté par le temps." },
  { id: 9, held: "elsewhere", en: "The CLI verifies no signature.", fr: "Le CLI ne vérifie aucune signature." },
  { id: 10, held: "test", en: "machine-established is set by the satellite only, under a pinned policy.", fr: "machine-established n'est posé que par le satellite, sous une politique épinglée." },
  { id: 11, held: "test", en: "A repository cannot sign for another.", fr: "Un dépôt ne signe pas pour un autre." },
  { id: 12, held: "test", en: "A management-body approval is never set by software.", fr: "Une approbation de l'organe de direction n'est jamais posée par un logiciel." },
  { id: 13, held: "elsewhere", en: "The side channel never touches the verdict.", fr: "Le canal latéral ne touche jamais le verdict." },
  { id: 14, held: "test", en: "Machine mode reads “machine mode in force”, never a gap.", fr: "Le mode machine se lit « mode machine en vigueur », jamais un écart." },
  { id: 15, held: "build", en: "A harness release is shown as a release, never as a landing without a passing record.", fr: "Un passage outre du harness s'affiche comme tel, jamais comme un atterrissage sans relevé passant." },
  { id: 16, held: "elsewhere", en: "Bypass review is disclosure by default, strict only when opted in.", fr: "La revue des passages outre est une divulgation par défaut, stricte sur option." },
  { id: 17, held: "test", en: "Join keys are stable.", fr: "Les clés de jointure sont stables." },
  { id: 18, held: "test", en: "No connector posts a pass on runward's word: the rule is the customer's.", fr: "Aucun connecteur ne publie un succès sur la parole de runward : la règle est celle du client." },
];

// `decision` first: the static page opens on the decision reading (ADR-0125); `""` stays the fleet view.
export const ROUTES = ["decision", "", "mission", "history", "proof", "signatures", "pr", "sources"];

let t = TEXT.en;
let W = WORDS.en;
let IDX = null;

// ------------------------------------------------------------------ helpers
const word = (s) => W[s] ?? s;
function st(state, label) {
  const shape = SHAPE[state] ?? "half";
  const w = esc(label ?? word(state));
  if (shape === "inv") return `<span class="st chip-inv" data-state="${esc(state)}"><span class="mk mk-full" aria-hidden="true"></span>${w}</span>`;
  return `<span class="st" data-state="${esc(state)}"><span class="mk mk-${shape}" aria-hidden="true"></span>${w}</span>`;
}
/** A number, with its source, its path in that source, and its path in the index. */
function n(v, src, sp, ip) {
  const tip = esc(`${src ?? ""}${sp ? ` · ${sp}` : ""}`);
  if (v === undefined || v === null || v === "not-observed") return `<span class="n na" data-src="${esc(src)}" data-index="${esc(ip)}" title="${tip}">${esc(word("not-observed"))}</span>`;
  return `<span class="n" data-src="${esc(src)}" data-index="${esc(ip)}"${sp ? ` data-path="${esc(sp)}"` : ""} title="${tip}">${esc(v)}</span>`;
}
/** A count is never alone: n / N, both from the index, the list it counts one hover away. */
function frac(g, src, ip, gold) {
  if (!g) return n(null, src, null, ip);
  const cls = gold ? "frac or" : "frac";
  return `<span class="${cls}" data-index="${esc(ip)}" title="${esc((g.list ?? []).join(" · "))}">${n(g.n, src, null, `${ip}.n`)} / ${n(g.N, src, null, `${ip}.N`)}</span>`;
}
const find = (arr, state) => (arr ?? []).find((x) => x.state === state);
/** The count of exit 5 (runward ADR-0114) for a face: n / N whenever a mission or revision is in it, else
 *  nothing, so a face without one keeps its words. Read from the index, never counted here. */
const notCrossed = (arr, src, ip) => { const g = find(arr, "level-not-met"); return g && g.n > 0 ? frac(g, src, gp(ip, "level-not-met")) : ""; };
const gp = (base, state) => `${base}[state=${state}]`;
/** The count of missions received as digests only (ADR-0125), for a face: n / N whenever one is, else nothing. */
const digestsOnly = (arr, src, ip) => { const g = find(arr, "not-available"); return g && g.n > 0 ? frac(g, src, gp(ip, "not-available")) : ""; };
const verb = (s) => `<span data-verbatim>${esc(s)}</span>`;
const code = (s) => `<code>${esc(s)}</code>`;
const rv = (html) => `<span class="rv">${html}</span>`;
const srcRef = (...ids) => ids.flat().filter(Boolean).map((id) => `<a href="#/sources" data-ref="${esc(id)}" title="${esc(id)}">${esc(id)}</a>`).join(" · ");
const head = (left, right) => `<div class="head">${rv(left)}${rv(right)}</div>`;
const mp = (m) => `missions[id=${m.id}]`;

// ------------------------------------------------------------------ fleet
function missionFacts(m) {
  const L = m.latest, s = L.src, b = `${mp(m)}.latest`;
  const ratB = `${b}.ratification.byState`;
  const some = (state) => { const g = find(L.ratification.byState, state); return g && g.n > 0 ? g : null; };
  const rat = [["ratified", t.facts.ratifiedW], ["changed", t.facts.changedW], ["untraced", t.facts.untracedW]]
    .map(([state, w]) => { const g = some(state); return g ? `${frac(g, s, gp(ratB, state))} ${esc(w)}` : ""; }).filter(Boolean).join(" · ");
  const assur = L.assurance === "not-observed" ? n(null, s, "delegation.assurance", `${b}.assurance`)
    : `${verb(L.assurance.inForce)}${L.assurance.degraded ? `, ${esc(t.facts.degraded)}` : ""}`;
  const seal = L.seal !== "not-observed" && L.seal.present ? `${st("sealed")} ${n(L.seal.count, s, "seal.count", `${b}.seal.count`)} ${esc(t.facts.files)}` : st("unsealed");
  return `<div class="facts">
    <div><span class="k">${esc(t.facts.filled)}</span>${frac(find(L.deliverables.byState, "filled"), s, gp(`${b}.deliverables.byState`, "filled"))}</div>
    <div><span class="k">${esc(t.facts.rows)}</span>${n(L.evidence.applied, s, "evidence.applied", `${b}.evidence.applied`)} ${esc(t.facts.applied)} · ${n(L.evidence.deviated, s, "evidence.deviated", `${b}.evidence.deviated`)} ${esc(t.facts.deviated)} · ${n(L.evidence.na, s, "evidence.na", `${b}.evidence.na`)} ${esc(t.facts.na)}</div>
    <div><span class="k">${esc(t.facts.ratification)}</span>${rat || st("not-observed")}</div>
    <div><span class="k">${esc(t.facts.seal)}</span>${seal}</div>
    <div><span class="k">${esc(t.facts.requires)}</span>${n(L.requiresUnmet.size, s, "requiresUnmet.length", `${b}.requiresUnmet.size`)} <span class="soft">${esc(t.facts.flagged)}</span></div>
    <div><span class="k">${esc(t.facts.assurance)}</span>${assur}</div>
    <div><span class="k">${esc(t.facts.verdictCell)}</span>${st(L.implemented)}${L.raisedBy ? ` ${srcRef(L.raisedBy)}` : ""}</div>
  </div>`;
}

function spark(m, w = 240, h = 34) {
  const S = m.history?.series?.find((x) => x.origin === "replayed") ?? m.history?.series?.[0];
  if (!S || S.records.length === 0) return "";
  const max = Math.max(1, S.maxConformanceGaps);
  const bw = w / S.records.length;
  const bars = S.records.map((r, i) => {
    const v = r.conformanceGaps ?? 0, bh = v === 0 ? 1.5 : Math.max(3, (v / max) * (h - 4));
    return `<rect x="${(i * bw + 0.5).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${Math.max(1, bw - 1.5).toFixed(2)}" height="${bh.toFixed(2)}" fill="currentColor" opacity="${v === 0 ? 0.35 : 0.9}"></rect>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(t.legendBars)}">${bars}</svg>`;
}

function viewFleet() {
  const F = IDX.fleet, s0 = IDX.manifest.src;
  const BV = "fleet.byVerdict", BI = "fleet.byImplemented";
  const me = find(F.byImplemented, "machine-established");
  const rows = IDX.missions.map((m) => {
    if (typeof m.latest === "string") {
      const silent = m.latest === "not-observed";
      return `<div class="mrow" data-mission="${esc(m.id)}"><div><div class="nm">${verb(m.name)}</div><div class="role">${verb(m.role ?? "")}</div></div><div>${silent ? st("not-observed", t.silent) : st(m.latest)}</div><div class="soft small">${esc(silent ? t.silentRow : t.digestRow)}</div></div>`;
    }
    const L = m.latest;
    const hist = m.history?.series?.length ? `<div style="margin-top:10px">${spark(m, 140, 26)}</div><div class="rv">${esc(t.historyOf(word(m.history.series[0].origin)))}</div>` : "";
    return `<a class="mrow" data-mission="${esc(m.id)}" href="#/mission/${esc(m.id)}">
      <div><div class="nm">${verb(m.name)}</div><div class="role">${verb(m.role ?? "")}</div>
        <div style="margin-top:8px">${rv(`${st(L.origin)} · ${esc(L.src)}`)}</div></div>
      <div>${st(L.verdict)}<div class="rv" style="margin-top:6px">${esc(t.exit)} ${n(L.exitCode, L.src, "exitCode", `${mp(m)}.latest.exitCode`)}</div>${hist}</div>
      ${missionFacts(m)}
    </a>`;
  }).join("");
  const findings = IDX.missions.flatMap((m) => m.findings.map((f) => `<tr><td>${verb(m.name)} · ${esc(t.kinds[f.what] ?? f.what)}</td><td>${st(f.state)}</td><td class="soft">${esc((t.why[f.why] ?? (() => f.why))(f))}</td></tr>`));
  const absent = IDX.absent.map((a) => `<tr><td>${esc(t.absentWhat[a.what] ?? a.what)}</td><td>${st(a.state)}</td><td class="soft">${esc(t.absent[a.what] ?? "")}</td></tr>`);
  return `${head(t.fleetHead(esc(IDX.asOf.label ?? t.asOfMissing), esc(IDX.format)), `${t.inventory(esc(IDX.sources[0]?.path ?? "fleet.json"))} · ${srcRef(s0)}`)}
    <h1 class="v">${esc(t.fleetTitle)}</h1>
    <p class="face" data-face="fleet">${t.fleetFace(n(F.declared, s0, "missions.length", "fleet.declared"), F.declared === 1, frac(find(F.byVerdict, "clean"), s0, gp(BV, "clean")), frac(find(F.byVerdict, "gaps"), s0, gp(BV, "gaps")), frac(find(F.byVerdict, "not-observed"), s0, gp(BV, "not-observed")),
      frac(me, s0, gp(BI, "machine-established"), me && me.n > 0), frac(find(F.byImplemented, "ci-declared"), s0, gp(BI, "ci-declared")), notCrossed(F.byVerdict, s0, BV), digestsOnly(F.byVerdict, s0, BV))}</p>
    <section class="blk" aria-label="missions">${rows}</section>
    <section class="blk"><h2>${esc(t.notThere)}</h2>
      <div class="tw"><table class="t"><thead><tr><th>${esc(t.object)}</th><th>${esc(t.state)}</th><th>${esc(t.whyCol)}</th></tr></thead><tbody>${[...findings, ...absent].join("")}</tbody></table></div>
      <p class="soft small" style="margin-top:10px">${esc(t.notThereNote)}</p></section>`;
}

// ------------------------------------------------------------------ mission
function viewMission(id) {
  const m = IDX.missions.find((x) => x.id === id) ?? IDX.missions[0];
  if (!m) return `<p class="face">${esc(t.histNone)}</p>`;
  const tabs = IDX.missions.map((x) => `<a href="#/mission/${esc(x.id)}" ${x.id === m.id ? 'aria-current="page"' : ""}>${verb(x.name)}</a>`).join(" · ");
  if (m.latest === "not-observed") return `${head(esc(t.mission), verb(m.name))}<p class="small">${tabs}</p><h1 class="v">${verb(m.name)}</h1><p class="face" data-face="mission">${st("not-observed", t.silent)} ${esc(t.silentRow)}</p>`;
  if (typeof m.latest === "string") return `${head(esc(t.mission), verb(m.name))}<p class="small">${tabs}</p><h1 class="v">${verb(m.name)}</h1><p class="face" data-face="mission">${st(m.latest)} ${esc(t.digestRow)}</p>`;
  const L = m.latest, s = L.src, b = `${mp(m)}.latest`;
  const phases = [...new Set(L.deliverables.list.map((d) => d.phase))].map((ph) => {
    const items = L.deliverables.list.filter((d) => d.phase === ph).map((d) => `<tr><td>${verb(d.artifact)}</td><td>${code(d.relPath)}</td><td>${st(d.state)}</td></tr>`).join("");
    return `<tr><th colspan="3" style="padding-top:14px">${verb(ph)}</th></tr>${items}`;
  }).join("");
  const gapsRows = L.conformance.length ? L.conformance.map((c) => `<tr><td>${verb(c.scope)}</td><td>${code(c.rule)}</td><td>${st("refused", c.kind)}</td><td class="small">${verb(c.problem)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="soft">${esc(t.noGaps)}</td></tr>`;
  const req = L.requiresUnmet.byNature.map((g) => `<tr><td>${code(g.state)}</td><td>${frac(g, s, gp(`${b}.requiresUnmet.byNature`, g.state))}</td><td class="small soft">${g.list.map(verb).join(" ; ")}</td></tr>`).join("");
  const machine = L.assurance !== "not-observed" && /^machine/.test(L.assurance.inForce ?? "");
  const rat = L.ratification.byState.filter((g) => g.n > 0).map((g) => `<tr><td>${st(g.state)}</td><td>${frac(g, s, gp(`${b}.ratification.byState`, g.state))}</td></tr>`).join("");
  const assur = L.assurance === "not-observed" ? `<p>${st("not-observed")} <span class="soft">${esc(t.assurNone)}</span></p>`
    : `<p>${t.assurLine(verb(L.assurance.inForce), L.assurance.degraded)} ${rv(`${esc(t.stage)} ${n(L.delegationStage, s, "delegation.stage", `${b}.delegationStage`)}`)}</p>
       <p class="soft small">${esc(t.notInForce)}</p><ul class="small">${L.assurance.notInForce.map((x) => `<li>${verb(x)}</li>`).join("")}</ul>`;
  const crit = L.criticalScope === "not-observed" ? null : L.criticalScope;
  const seal = L.seal !== "not-observed" && L.seal.present ? `${st("sealed")} ${n(L.seal.count, s, "seal.count", `${b}.seal.count`)} ${esc(t.facts.files)}${L.seal.sealedAt ? `, ${esc(t.sealDated(L.seal.sealedAt))}` : ""}` : st("unsealed");
  const junit = L.committedJUnit === "not-observed" ? n(null, s, "committedJUnit", `${b}.committedJUnit`) : `${n(L.committedJUnit.rows, s, "committedJUnit.rows", `${b}.committedJUnit.rows`)} ${esc(t.junitRows)} · <span class="soft">${verb(L.committedJUnit.freshness)}</span>`;
  const H = m.history?.series?.[0];
  const gold = L.implemented === "machine-established";
  return `${head(`${esc(t.mission)} · <b>${verb(m.name)}</b>`, `${st(L.origin)} · ${L.runward ? `runward ${verb(L.runward)}` : ""} · ${srcRef(s)}`)}
    <p class="small">${tabs}</p>
    <h1 class="v">${verb(m.name)}</h1>
    <p class="face" data-face="mission">${t.missionFace(st(L.verdict), n(L.exitCode, s, "exitCode", `${b}.exitCode`), verb(L.currentGate), frac(find(L.deliverables.byState, "filled"), s, gp(`${b}.deliverables.byState`, "filled")), n(L.evidence.rows, s, "evidence.rows", `${b}.evidence.rows`), n(L.evidence.typed, s, "evidence.typed", `${b}.evidence.typed`), n(L.evidence.prose, s, "evidence.prose", `${b}.evidence.prose`))}
      <span class="${gold ? "cell or" : "cell"}">${esc(t.facts.verdictCell)} ${st(L.implemented)}</span></p>
    <div class="grid2">
      <section class="blk panel"><h2>${esc(t.gateChecked)}</h2>
        <table class="t"><tbody>
          <tr><td>${esc(t.rowsLine)}</td><td>${n(L.evidence.applied, s, "evidence.applied", `${b}.evidence.applied`)} · ${n(L.evidence.deviated, s, "evidence.deviated", `${b}.evidence.deviated`)} · ${n(L.evidence.na, s, "evidence.na", `${b}.evidence.na`)}</td></tr>
          <tr><td>${esc(t.typedLine)}</td><td>${n(L.evidence.typed, s, "evidence.typed", `${b}.evidence.typed`)}</td></tr>
          <tr><td>${esc(t.proseLine)}</td><td>${n(L.evidence.prose, s, "evidence.prose", `${b}.evidence.prose`)}</td></tr>
          <tr><td>${esc(t.signedLine)}</td><td>${n(L.evidence.signed, s, "evidence.signed", `${b}.evidence.signed`)}</td></tr>
          <tr><td>${esc(t.filesLine)}</td><td>${n(L.evidence.evidenceFiles?.total, s, "evidence.evidenceFiles.total", `${b}.evidence.evidenceFiles.total`)} (${n(L.evidence.evidenceFiles?.external, s, "evidence.evidenceFiles.external", `${b}.evidence.evidenceFiles.external`)})</td></tr>
          <tr><td>${esc(t.criticalLine)}</td><td>${n(crit?.mapped, s, "criticalScope.mapped", `${b}.criticalScope.mapped`)} / ${n(crit?.total, s, "criticalScope.total", `${b}.criticalScope.total`)}</td></tr>
          <tr><td>${esc(t.sealLine)}</td><td>${seal}</td></tr>
          <tr><td>${esc(t.junitLine)}</td><td>${junit}</td></tr>
        </tbody></table>
        ${crit?.unmapped?.length ? `<p class="small soft" style="margin-top:10px">${esc(t.neverAsked)} ${crit.unmapped.map(code).join(", ")}.</p>` : ""}
      </section>
      <section class="blk panel"><h2>${esc(t.ratTitle)}</h2>
        ${machine ? `<p class="small" data-rule="machine-mode">${esc(t.machineMode)}</p>` : ""}
        <table class="t"><tbody>${rat}</tbody></table>
        ${IDX.names?.state === "omitted" ? `<p class="small" style="margin-top:10px">${esc(t.ratNamesOmitted)}</p>` : L.ratification.ratifiers.length ? `<p class="small" style="margin-top:10px">${esc(t.ratNames)} ${L.ratification.ratifiers.map(verb).join(", ")}.</p>` : ""}
        <p class="small soft">${esc(t.ratUnknown)}</p>
        <h2 style="margin-top:18px">${esc(t.assurTitle)}</h2>${assur}
      </section>
    </div>
    <section class="blk"><h2>${esc(t.conformanceTitle)}</h2><div class="tw"><table class="t"><thead><tr><th>${esc(t.phase)}</th><th>${esc(t.rule)}</th><th>${esc(t.cause)}</th><th>${esc(t.says)}</th></tr></thead><tbody>${gapsRows}</tbody></table></div></section>
    <section class="blk"><h2>${esc(t.requiresTitle)}</h2>
      <p class="small soft">${esc(t.requiresNote)}</p>
      <div class="tw"><table class="t"><thead><tr><th>${esc(t.nature)}</th><th>${esc(t.rowsCol)}</th><th>${esc(t.which)}</th></tr></thead><tbody>${req || `<tr><td colspan="3" class="soft">${esc(t.none)}</td></tr>`}</tbody></table></div></section>
    <section class="blk"><h2>${esc(t.byPhase)}</h2><div class="tw"><table class="t"><tbody>${phases}</tbody></table></div></section>
    <section class="blk"><h2>${esc(t.nonScope)}</h2><p class="quote small">${verb(L.gateNonScope)}</p>${rv(`${esc(t.verbatim)} · gateNonScope · ${esc(s)}`)}</section>
    ${H ? `<section class="blk"><h2>${esc(t.overTime)}</h2><p class="small"><a href="#/history">${t.replayedRevs(n(H.size, H.src, "records.length", `${mp(m)}.history.series[0].size`))}</a>${esc(t.neverMixed)}</p>${spark(m, 600, 48)}</section>` : ""}
    <section class="blk"><h2>${esc(t.dossierTitle)}</h2>${dossierTable(m)}</section>`;
}

function dossierTable(m) {
  const by = Object.fromEntries(IDX.sources.map((x) => [x.id, x]));
  const row = (label, src, extra) => `<tr><td>${esc(label)}</td><td>${src ? st("observed") : st("not-observed")}</td><td><span class="hash">${src && by[src] ? `${esc(by[src].sha256.slice(0, 16))}…` : ""}</span></td><td class="small">${extra || ""} ${src ? srcRef(src) : ""}</td></tr>`;
  const sigs = m.signatures.length ? m.signatures.map((x) => `${st(x.state)}${x.raised ? ` ${st("raised")}` : ""} ${srcRef(x.id)}`).join(" · ") : `<span class="soft">${esc(t.noneDeclared)}</span>`;
  return `<div class="tw"><table class="t"><thead><tr><th>${esc(t.piece)}</th><th>${esc(t.state)}</th><th>sha256</th><th>${esc(t.note)}</th></tr></thead><tbody>
    ${row(t.attPiece, m.attestation?.src, m.attestation?.subject?.[0] ? `${esc(t.subject)} <span class="hash">${esc(String(m.attestation.subject[0].sha256).slice(0, 16))}…</span> · ${st(m.attestation.implemented)}` : "")}
    ${row(t.witPiece, m.witness?.src, m.witness ? verb(m.witness.format) : "")}
    ${row(t.verPiece, m.verify?.src, "")}
    ${row(t.sumPiece, m.summary?.src, "report --format md")}
    ${row(t.repPiece, m.report?.src, "report")}
    <tr><td>${esc(t.sigPiece)}</td><td colspan="3" class="small">${sigs}</td></tr>
  </tbody></table></div>`;
}

// ------------------------------------------------------------------ history
function viewHistory() {
  const withH = IDX.missions.filter((x) => x.history?.series?.length);
  if (withH.length === 0) return `${head(esc(t.nav.history), "")}<h1 class="v">${esc(t.histTitle)}</h1><p class="face" data-face="history">${st("not-observed")} ${esc(t.histNone)}</p>`;
  return withH.map((m) => m.history.series.map((S, k) => seriesView(m, S, k)).join("")).join("");
}

function seriesView(m, S, k) {
  const s = S.src, base = `${mp(m)}.history.series[${k}]`;
  const recs = S.records, w = 1000, h = 190, pad = 28, bw = (w - pad) / Math.max(1, recs.length);
  const max = Math.max(1, S.maxConformanceGaps);
  const judges = S.judgedBy;
  const bars = recs.map((r, i) => {
    const v = r.conformanceGaps ?? 0, x = pad + i * bw, bh = v === 0 ? 2 : (v / max) * (h - 70);
    const y = h - 40 - bh;
    const mark = r.verdict === "clean" ? `<circle cx="${(x + bw / 2).toFixed(1)}" cy="${h - 26}" r="3.2" fill="currentColor"/>` : `<rect x="${(x + bw / 2 - 3.2).toFixed(1)}" y="${h - 29.2}" width="6.4" height="6.4" fill="currentColor" transform="rotate(45 ${(x + bw / 2).toFixed(1)} ${h - 26})"/>`;
    return `<g><rect x="${(x + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" fill="currentColor" opacity="${v === 0 ? 0.3 : 0.92}"><title>${esc(r.ref)} · ${esc(r.committedAt)} · ${esc(word(r.verdict))}</title></rect>${mark}</g>`;
  }).join("");
  const labels = recs.map((r, i) => (i % 4 === 0 || i === recs.length - 1) ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(String(r.ref ?? "").startsWith("v") ? r.ref : String(r.commit ?? "").slice(0, 7))}</text>` : "").join("");
  const axis = `<text x="0" y="${h - 40}">0</text><text x="0" y="${h - 40 - (h - 70) + 8}">${esc(max)}</text>`;
  const BV = `${base}.byVerdict`;
  const table = recs.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => `<tr><td><code>${esc(r.ref)}</code>${r.judge > 0 ? ` <span class="rv" data-marker="other-judge" title="${esc(judges[r.judge])}">⧉</span>` : ""}</td><td class="hash">${esc(r.commit)}</td><td>${esc(r.committedAt)}</td><td>${st(r.verdict)}</td><td class="c">${n(r.conformanceGaps, s, `records[${i}].verdict.gaps.conformance`, `${base}.records[${i}].conformanceGaps`)}</td><td class="small">${r.assurance === "not-observed" ? esc(word("not-observed")) : `${verb(r.assurance.inForce)}${r.assurance.degraded ? `, ${esc(t.facts.degraded)}` : ""}`}</td><td class="hash">${esc(String(r.payloadSha256 ?? "").slice(0, 12))}</td></tr>`).join("");
  const judgeVersion = (j) => (/runward@([^\s]+)/.exec(j) ?? [])[1] ?? null;
  const latestV = typeof m.latest === "object" ? m.latest.runward : null;
  const hv = judges.map(judgeVersion).filter(Boolean);
  const skew = latestV && hv.length && hv.some((v) => v !== latestV) ? `<p class="small" data-marker="version-skew">${esc(t.skew(latestV, hv.join(", ")))}</p>` : "";
  return `${head(`${esc(t.nav.history)} · <b>${verb(m.name)}</b>`, `${st(S.origin)} · ${srcRef(s)}`)}
    <h1 class="v">${esc(t.histTitle)}</h1>
    <p class="face" data-face="history">${t.histFace(n(S.size, s, "records.length", `${base}.size`), verb(m.name), verb(judges.join(", ")), frac(find(S.byVerdict, "clean"), s, gp(BV, "clean")), frac(find(S.byVerdict, "gaps"), s, gp(BV, "gaps")), notCrossed(S.byVerdict, s, BV))}</p>
    <section class="blk panel"><svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(t.legendBars)}">${axis}${bars}${labels}</svg>
      <div class="legend"><span>${esc(t.legendBars)}</span><span>${esc(t.legendClean)}</span><span>${esc(t.legendRefused)}</span>${judges.length > 1 ? `<span data-marker="other-judge">${esc(t.otherJudge)}</span>` : ""}<span>${rv(esc(t.judgedBy(judges[0])))}</span></div></section>
    ${skew}
    <section class="blk"><p class="small">${esc(t.histNote)}</p></section>
    <section class="blk"><div class="tw"><table class="t"><thead><tr><th>${esc(t.cols.ref)}</th><th>${esc(t.cols.commit)}</th><th>${esc(t.cols.date)}</th><th>${esc(t.cols.verdict)}</th><th class="c">${esc(t.cols.gaps)}</th><th>${esc(t.cols.assurance)}</th><th>${esc(t.cols.digest)}</th></tr></thead><tbody>${table}</tbody></table></div></section>`;
}

// ------------------------------------------------------------------ proof
function viewProof() {
  const m = IDX.missions.find((x) => x.verify || x.attestation);
  if (!m) return `${head(t.proofHead, "")}<h1 class="v">${esc(t.proofTitle)}</h1><p class="face" data-face="proof">${st("not-observed")} ${esc(t.proofNone)}</p>`;
  const V = m.verify, A = m.attestation, Wt = m.witness, L = typeof m.latest === "object" ? m.latest : null;
  const v = L?.runward ?? V?.runward ?? "X.Y.Z";
  const line = (ok, text, gold) => `<tr><td style="width:28px">${gold ? '<span class="mk mk-full or" aria-hidden="true"></span>' : ok ? '<span class="mk mk-full" aria-hidden="true"></span>' : '<span class="mk mk-void" aria-hidden="true"></span>'}</td><td class="small">${text}</td></tr>`;
  const lines = V ? [
    line(V.digestMatches, esc(t.vDigest)),
    line(V.verdictMatches, esc(t.vVerdict), V.verified && V.verdictMatches),
    line(V.predicateMatches, esc(t.vPredicate)),
    line(false, `${esc(t.vNot)} ${V.notReDerived.map(code).join(", ")}`),
  ].join("") : `<tr><td colspan="2" class="soft">${st("not-observed")}</td></tr>`;
  const nw = Wt ? Wt.notWitnessed.map((x) => `<li>${code(x.family)} : ${verb(x.why)}</li>`).join("") : "";
  return `${head(t.proofHead, `${L ? st(L.origin) : ""} · ${srcRef(A?.src, V?.src, Wt?.src)}`)}
    <h1 class="v">${esc(t.proofTitle)}</h1>
    <p class="face" data-face="proof">${esc(t.proofFace)}</p>
    <section class="blk grid2">
      <div class="panel"><h2>${esc(t.redo)}</h2>
        <div class="term"><span class="ln">npx runward@${esc(v)} check --strict --attest &gt; verdict.intoto.json</span><span class="ln">npx runward@${esc(v)} verify verdict.intoto.json</span></div>
        ${A?.subject?.[0] ? `<p class="small" style="margin-top:12px">${esc(t.expectSubject)} <span class="hash">${esc(A.subject[0].sha256)}</span></p>` : ""}
        <p class="small soft">${esc(t.builtFrom(v))}</p></div>
      <div class="panel"><h2>${esc(t.verifyTitle)}</h2><table class="t"><tbody>${lines}</tbody></table>
        <p class="small soft" style="margin-top:10px">${esc(t.vCaution)}</p></div>
    </section>
    <section class="blk grid2">
      <div class="panel"><h2>${esc(t.noTree)}</h2><p class="small">${esc(t.noTreeText)}</p></div>
      <div class="panel"><h2>${esc(t.witTitle)}</h2>${Wt ? `<p class="small">${t.witText(verb(Wt.format), n(Wt.files, Wt.src, "files", `${mp(m)}.witness.files`), code(Wt.result))}</p><p class="small soft">${esc(t.witNot)}</p><ul class="small">${nw}</ul>` : `<p>${st("not-observed")}</p>`}</div>
    </section>`;
}

// ------------------------------------------------------------------ signatures
function viewSignatures() {
  const F = IDX.fleet, s0 = IDX.manifest.src, B = "fleet.signatures.byState", BI = "fleet.byImplemented";
  const me = find(F.byImplemented, "machine-established");
  const P = IDX.policy;
  const policy = !P ? `<p class="small">${st("not-observed")} ${esc(t.sigNoPolicy)}</p>` : `
    <p class="small">${srcRef(P.src)}</p>
    <h2 style="margin-top:12px">${esc(t.roots)}</h2>
    <ul class="small">${P.trustedRoots.map((r, i) => `<li>${code(r.path)} · ${n(r.logs, r.src, "tlogs.length", `policy.trustedRoots[${i}].logs`)} ${esc(t.logs)} · ${n(r.authorities, r.src, "certificateAuthorities.length", `policy.trustedRoots[${i}].authorities`)} ${esc(t.authorities)} · <span class="hash">${esc(r.sha256.slice(0, 16))}…</span> ${srcRef(r.src)}</li>`).join("") || `<li>${st("not-observed")}</li>`}</ul>
    <h2 style="margin-top:12px">${esc(t.signersTitle)}</h2>
    <div class="tw"><table class="t"><thead><tr><th>${esc(t.sId)}</th><th>${esc(t.sKind)}</th><th>${esc(t.sRepos)}</th><th>${esc(t.sPins)}</th><th>${esc(t.sState)}</th></tr></thead><tbody>
    ${P.signers.map((x) => `<tr><td>${code(x.id)}</td><td>${esc(x.kind)}</td><td class="small">${x.repositories.map(code).join(" ")}</td><td class="small">${x.kind === "sigstore" ? `${code(x.workflow)} · ${x.workflowDigests.map((d) => `<span class="hash">${esc(d.slice(0, 12))}</span>`).join(" ")}` : `${code(x.keyDigest)} · ${code(x.manifestFormat)}`} · ${code(x.ref ?? "")}</td><td>${x.pinned ? st("pinned") : `${st("unpinned")} <span class="small soft">${x.unpinned.map((u) => esc(u === "ref" ? t.unpinnedRef : t.unpinnedDigest)).join(" ; ")}</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
  const per = IDX.missions.filter((m) => m.signatures.length).map((m) => `<section class="blk"><h2>${verb(m.name)}</h2>${m.signatures.map((x, j) => sigCard(m, x, j)).join("")}</section>`).join("");
  const sigF = (state) => frac(find(F.signatures.byState, state), s0, gp(B, state));
  return `${head(t.sigHead, srcRef(P?.src))}
    <h1 class="v">${esc(t.sigTitle)}</h1>
    <p class="face" data-face="signatures">${t.sigFace(n(F.signatures.declared, s0, "missions[].signatures.length", "fleet.signatures.declared"), F.signatures.declared === 1, sigF("verified"), sigF("outside-policy"), sigF("refused"), sigF("absent"), sigF("not-verifiable"), frac(me, s0, gp(BI, "machine-established"), me && me.n > 0))}</p>
    <p class="small soft">${esc(t.sigCli)}</p>
    <section class="blk panel"><h2>${esc(t.policyTitle)}</h2>${policy}</section>
    ${per ? `<h2 style="margin-top:8px">${esc(t.perMission)}</h2>${per}` : ""}`;
}

function sigCard(m, x, j) {
  const id = x.identity ?? {};
  const ident = x.via === "sigstore"
    ? [["workflow", id.buildSignerURI], ["digest", id.buildSignerDigest], ["repository", id.sourceRepositoryURI], ["ref", id.sourceRepositoryRef], ["commit", id.sourceRepositoryDigest], ["runner", id.runnerEnvironment]]
    : [["key", id.key], ["repository", id.repository], ["ref", id.ref], ["commit", id.commit], ["run", id.run]];
  const checks = (x.checks ?? []).map((c) => `<li>${c.ok ? "✓" : "✗"} ${code(c.id)} <span class="soft">${verb(c.detail ?? "")}</span></li>`).join("");
  const reasons = x.reasons.map((r) => `<li>${esc((t.reason[r.code] ?? (() => r.code))(r))}</li>`).join("");
  return `<div class="panel" style="margin-bottom:12px" data-signature="${esc(x.id)}">
    <p>${st(x.state)} ${x.raised ? st("raised") : st("not-raised")} ${rv(`${esc(t.covers)} <b>${esc(t.kinds[x.covers] ?? x.covers)}</b> · ${esc(t.via)} ${esc(x.via ?? "")}${x.signer ? ` · ${esc(t.signer)} ${esc(x.signer)}` : ""} · ${srcRef(x.src)}`)}</p>
    ${x.raised ? `<p class="small">${esc(t.raisedNote)}</p>` : ""}
    ${x.via === "ed25519" ? `<p class="small soft">${esc(t.keyHolder)}</p>` : ""}
    ${x.identity ? `<p class="small"><span class="k">${esc(t.identity)}</span> ${ident.filter(([, v]) => v).map(([k, v]) => `${esc(k)} ${code(v)}`).join(" · ")}</p>` : ""}
    ${checks ? `<p class="small" style="margin-bottom:4px">${esc(t.checks)}</p><ul class="small checks">${checks}</ul>` : ""}
    ${x.binds ? `<p class="small">${esc(t.binds)} ${code(x.binds.how)}${x.binds.name ? ` ${code(x.binds.name)}` : ""}</p>` : ""}
    ${reasons ? `<p class="small" style="margin-bottom:4px">${esc(t.reasons)}</p><ul class="small">${reasons}</ul>` : ""}
  </div>`;
}

// ------------------------------------------------------------------ in the PR
/**
 * `s` without its HTML comments, each `<!--` to the first `-->` after it, left to right, in one pass:
 * what `s.replace(/<!--[\s\S]*?-->/g, "")` gives, which read the rest of the text again from every
 * `<!--` that does not close (1.4 s for 100,000 characters, RWD-2026-0206). A `<!--` left in the text
 * is shown as text: `md` escapes every character of its input.
 */
export function withoutComments(s) {
  let out = "";
  let at = 0;
  for (;;) {
    const i = s.indexOf("<!--", at);
    if (i === -1) break;
    const j = s.indexOf("-->", i + 4);
    if (j === -1) break;
    out += s.slice(at, i);
    at = j + 3;
  }
  return out + s.slice(at);
}

/** Markdown, escaped first: a value from the tree can never inject markup. */
export function md(src) {
  const lines = withoutComments(String(src)).split("\n");
  const out = []; let i = 0;
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;])/g, "$1<i>$2</i>");
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre>${esc(buf.join("\n"))}</pre>`); continue; }
    if (/^### /.test(l)) { out.push(`<h3>${inline(l.slice(4))}</h3>`); i++; continue; }
    if (/^## /.test(l)) { out.push(`<h2>${inline(l.slice(3))}</h2>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const body = rows.filter((r, k) => k !== 1);
      out.push(`<div class="tw"><table>${body.map((r, k) => `<tr>${cells(r).map((c) => k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</table></div>`); continue;
    }
    if (l.trim() === "") { i++; continue; }
    const buf = [l]; i++; while (i < lines.length && lines[i].trim() !== "" && !/^(#|\||```)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

function viewPR() {
  const m = IDX.missions.find((x) => x.summary);
  return `${head(t.prHead, m ? srcRef(m.summary.src) : "")}
    <h1 class="v">${esc(t.prTitle)}</h1>
    <p class="face" data-face="pr">${esc(t.prFace)}</p>
    <section class="blk"><div class="panel md">${m ? `<!--verbatim:start-->${md(m.summary.markdown)}<!--verbatim:end-->` : `<p>${st("not-observed")} ${esc(t.prNone)}</p>`}</div></section>
    <section class="blk grid2">
      <div class="panel"><h2>${esc(t.agentTitle)}</h2>
        <p class="small">${t.agentText1}</p>
        <p class="small">${esc(t.agentText2)}</p></div>
      <div class="panel"><h2>${esc(t.forgeTitle)}</h2>
        <p class="small">${esc(t.forgeText)}</p></div>
    </section>`;
}

// ------------------------------------------------------------------ sources
function viewSources() {
  const L = IDX.lang === "fr" ? "fr" : "en";
  const rows = IDX.sources.map((s, i) => `<tr id="${esc(s.id)}"><td><b>${esc(s.id)}</b></td><td>${code(s.path)}<div class="small soft">${esc(t.srcKinds[s.kind] ?? s.kind)}</div></td><td class="small">${verb(s.producedBy ?? "")}<div class="soft">${verb(s.at ?? "")}</div></td><td>${st(s.origin)}</td><td class="hash">${esc(s.sha256)}<div class="soft">${n(s.bytes, s.id, "bytes", `sources[${i}].bytes`)} ${esc(t.bytes)}</div></td></tr>`).join("");
  const rules = RULES.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r[L])}</td><td class="small soft">${esc(t.held[r.held])}</td></tr>`).join("");
  const reading = DECISION_RULES.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r[L])}</td><td class="small soft">${esc(t.held[r.held])}</td></tr>`).join("");
  return `${head(t.srcHead(esc(IDX.sources.length)), `${esc(IDX.format)}`)}
    <h1 class="v">${esc(t.srcTitle)}</h1>
    <p class="face" data-face="sources">${esc(t.srcFace)}</p>
    <section class="blk"><div class="tw"><table class="t"><thead><tr><th>${esc(t.srcCols.id)}</th><th>${esc(t.srcCols.file)}</th><th>${esc(t.srcCols.by)}</th><th>${esc(t.srcCols.origin)}</th><th>${esc(t.srcCols.digest)}</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="blk grid2"><div class="panel"><h2>${esc(t.rebuild)}</h2><div class="term"><span class="ln">runward-fleet build ${esc(IDX.sources[0]?.path ?? "fleet.json")} --out site</span></div>
      <p class="small soft" style="margin-top:10px">${esc(t.builtBy(IDX.builtBy.version ?? ""))} ${esc(t.dateNote(IDX.asOf.label ?? t.asOfMissing, IDX.asOf.source))}</p></div>
    <div class="panel"><h2>${esc(t.fonts)}</h2><ul class="small"><li>Inter © The Inter Project Authors, SIL Open Font License 1.1.</li><li>Departure Mono © Helena Zhang, SIL Open Font License 1.1.</li></ul></div></section>
    <section class="blk"><h2>${esc(t.rulesTitle)}</h2><p class="small soft">${esc(t.rulesNote)}</p><div class="tw"><table class="t" data-rules><tbody>${rules}</tbody></table></div></section>
    <section class="blk"><h2>${esc(t.readingRulesTitle)}</h2><p class="small soft">${esc(t.readingRulesNote)}</p><div class="tw"><table class="t" data-reading-rules><tbody>${reading}</tbody></table></div></section>`;
}

// ------------------------------------------------------------------ the decision reading (ADR-0125)
//
// A plain-language reading of the index for the people who answer for what agents deliver and do not read
// code. It is a projection: every sentence comes from the closed lexicon below, keyed on a closed value
// the index holds (a verdict, a deliverable's state and cause, a refusal's kind, a deliverable, a phase,
// how a row was endorsed), and names the index path it was read from. The free text of a refusal is shown
// as it is, marked as data, and never read: no sentence is derived from it. A value the lexicon does not
// know is shown as written, never dropped and never guessed. No model, no clock, nothing computed: every
// count is a grouping the index holds, with its denominator and its list.
export const DECISION_FORMAT = "runward-fleet-decision/0";

const NB = " "; // French puts a no-break space before a colon
export const LEXICON = {
  en: {
    title: "Before your go / no-go",
    nav: "In plain words",
    lede: "What the team's own check says about each application. The decision stays yours.",
    order: "Applications are listed in the order of the inventory.",
    orderByState: "Sorted by state: refused by the check first, then required level not met, then the others; within a state, in the order of the inventory.",
    read: "Read the detail",
    technical: "Technical detail",
    back: "All applications",
    state: { clean: "Nothing is blocking", gaps: "Refused by the check", "level-not-met": "Required level not met", "not-observed": "No check received", "not-available": "Content not shared" },
    group: { clean: "Nothing is blocking, according to the team's requirements", gaps: "Refused by the check", "level-not-met": "Required level not met", "not-observed": "No check received", "not-available": "Content not shared" },
    qualifier: { clean: "according to the team's requirements" },
    received: { state: "Check received, no state written", reason: "The check received for this application writes no state." },
    reason: {
      clean: "The check found no missing document and refuses nothing. The decision stays yours.",
      gaps: "The check refuses this version, for the reasons that follow.",
      "level-not-met": "No gap was found, but the evidence does not reach the level the team requires.",
      "not-observed": "No check has been received for this application.",
      "not-available": "Only fingerprints are sent for this application: its content is not shared.",
    },
    date: { received: "Last check received: {date}", fingerprints: "Last fingerprints received: {date}", none: "date not declared" },
    pieces: {
      title: "Missing or unfinished documents",
      legend: "A document here is one the team requires before production.",
      item: "{piece}: {state}",
      itemCause: "{piece}: {state}, {cause}",
      nature: { frame: "Framing", architect: "Design", topology: "Design", floor: "First version in service", govern: "Controls", handover: "Handover" },
      natureNone: "Documents with no kind written",
      piece: {
        "framing.md": "Framing note", "mission-contract.md": "Steering agreement", "architecture.md": "Architecture note",
        "execution-topology.md": "Execution map", "decision-matrix.md": "Decision matrix", adr: "Written decisions", contracts: "Interface contracts",
        "floor.md": "First-version measurements", "governance/threat-model.md": "Security assessment", "governance/evaluation-rubric.md": "Evaluation criteria",
        "governance/observability-schema.md": "Monitoring plan", "runbook.md": "Recovery procedure", "handover.md": "Handover note",
      },
      state: { missing: "document absent", untouched: "missing document", "in-progress": "document started, not finished", filled: "document filled in" },
      count: { missing: "{count} documents absent", untouched: "{count} documents missing", "in-progress": "{count} documents started, not finished", filled: "{count} documents filled in" },
      cause: {
        placeholders: "parts are still to be filled in", "below-floor": "the text is still too short to count", "missing-section": "an expected section is missing",
        "invalid-field": "an expected field does not have the required form", "row-out-of-domain": "a line holds a value outside the allowed list",
        "incoherent-rows": "lines contradict each other", "broken-echo": "a passage that must be repeated in another document is not",
      },
    },
    problems: {
      title: "What the check refuses", byKind: "{count} refusals of this kind: {reason}", items: "Where, refusal by refusal", line: "{subject}: {reason}",
      detail: "Check detail, as written", same: "Check detail, as written (the same for {count})", entry: "{subject}: {where}",
      where: "{file}, line {line}, requirement {rule}", whereFile: "{file}, requirement {rule}", whereRule: "requirement {rule}",
    },
    kind: {
      proposed: "a proposed answer is not yet endorsed.",
      "missing-row": "a requirement of the team has no answer in the record.",
      "empty-status": "a requirement of the team has no answer chosen yet.",
      "invalid-status": "a requirement has an answer the check does not recognise.",
      "applied-without-evidence": "a requirement is said to be met, with no evidence attached.",
      "evidence-placeholder": "a requirement is said to be met, its evidence left as the template's example.",
      "deviated-without-adr": "a deliberate deviation has no written decision.",
      "na-without-reason": "a requirement is set aside with no written reason.",
      "unknown-rule": "the record answers a requirement that is not among the team's rules.",
      "duplicate-row": "a requirement has several answers in the record.",
      "deliverable-missing": "a required document is missing.",
      "manifest-unreadable": "the check cannot read this document's list of answers in full.",
      "mapping-floor": "this document's list of requirements was cut below its minimum.",
      "unresolved-pointer": "the record cites a file or an item the check cannot find.",
      "evidence-refused": "a cited piece of evidence is refused by the check.",
      "requires-unmet": "a requirement asks for evidence of another kind than the one cited.",
      "rule-violation": "the check refuses an answer in the record.",
      "corpus-missing": "one of the team's rules was deleted.",
      "corpus-edited": "one of the team's rules was changed since it was set up.",
      "corpus-extra": "a rule was added without going through the tool.",
      "corpus-unrecorded": "the team's rules are not recorded: the check cannot tell whether they changed.",
      "seal-violation": "a piece of evidence changed since it was recorded.",
      "unratified-decision": "a written decision is not yet endorsed.",
      "unbound-row": "an item's endorsement is not accepted under the stricter rules the team chose.",
      "charter-malformed": "the charter that delegates acts to agents is malformed.",
      "charter-stage-unread": "the delegation charter declares a level this version of the check cannot read.",
      "charter-class-refused": "the charter delegates to agents an act that cannot be delegated to them.",
      "charter-expired": "an agent acted after its delegation ended.",
      "agent-not-delegate": "an agent endorsed an item without being a delegate of the charter.",
      "sample-malformed": "the record of sample reviews is malformed.",
      "sample-missed": "an agent acted while the sample reviews did not take place.",
      "class-suspended": "an agent acted in a class of acts that a sample review suspended.",
      "analysis-boundary": "the delivered code crosses a boundary the team declared.",
      "analysis-capability": "the delivered code uses a capability the team did not allow there.",
      "analysis-secret": "the delivered code holds what looks like a secret.",
      "analysis-test-integrity": "a test of the delivered code does not check what it claims to.",
      "analysis-symbol": "a name the record cites has no real content in the delivered code.",
      "analysis-linkage": "a file the record cites refers to an item that does not exist.",
      "analysis-policy": "the analysis policy the team chose is unknown to this version of the check.",
      "not-observed": "a refusal whose kind the check does not write.",
    },
    scope: {
      Architect: "Design", Topology: "Design", Floor: "First version in service", Govern: "Controls", Handover: "Handover",
      corpus: "The team's rules", "evidence-seal": "Evidence record", reconstruction: "Written decisions", delegation: "Delegation to agents",
      ratification: "Endorsements", analysis: "Delivered code",
    },
    endorsement: {
      title: "How the items were endorsed",
      mode: {
        "line-by-line": "{count} items endorsed item by item",
        "en bloc": "{count} items endorsed all at once",
        agent: "{count} items endorsed by a reviewing agent",
        "agent (single accountable)": "{count} items endorsed by a reviewing agent; the same person answers for the agent that proposed them and for the one that endorsed them",
        blind: "{count} items endorsed without reviewing the detail",
        changed: "{count} items changed since they were endorsed",
        untraced: "{count} items with no endorsement recorded",
        "not-observed": "{count} items endorsed, with no mode written",
      },
      agent: "{count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of {person} (declared person)",
      agentSingle: "{count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of {person} (declared person); the same person answers for the agent that proposed them and for the one that endorsed them",
      agentNotPublished: "{count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of a declared person whose name is not published here",
      agentSingleNotPublished: "{count} items endorsed by a reviewing agent ({agent}, declared name), under the responsibility of a declared person whose name is not published here; the same person answers for the agent that proposed them and for the one that endorsed them",
      agentNoPerson: "{count} items endorsed by a reviewing agent ({agent}, declared name), with no person declared as responsible",
      noneRecorded: "No endorsement recorded.",
      notDetailed: "Endorsement mode not detailed.",
      declared: "These names and modes are declared by the team: the check does not verify who answered.",
      disclosure: "What the check writes about it:",
    },
    origin: {
      "ci-declared": "Where this comes from: computed in the team's delivery chain.",
      "machine-established": "Where this comes from: computed in the team's delivery chain; its signature was verified by this page, under the operator's trust policy.",
      version: "Check run with runward {version}.",
    },
    unknown: {
      state: "State as the check writes it: {value}",
      kind: "detail of the check, as written: {value}.",
      piece: "Document as the check names it: {value}",
      scope: "Part of the record as the check names it: {value}",
      nature: "Kind of document as the check names it: {value}",
      pieceState: "state as the check writes it: {value}",
      cause: "cause as the check writes it: {value}",
      mode: "{count} items, endorsed in a mode as the check writes it: {value}",
      origin: "Where this comes from, as the record writes it: {value}",
    },
  },
  fr: {
    title: "Avant votre go / no-go",
    nav: "En clair",
    lede: "Ce que le contrôle de l'équipe dit de chaque application. La décision reste la vôtre.",
    order: "Les applications sont listées dans l'ordre de l'inventaire.",
    orderByState: `Triées par état${NB}: refusées par le contrôle d'abord, puis niveau exigé non atteint, puis les autres ; dans un même état, dans l'ordre de l'inventaire.`,
    read: "Lire le détail",
    technical: "Détail technique",
    back: "Toutes les applications",
    state: { clean: "Rien ne bloque", gaps: "Refusée par le contrôle", "level-not-met": "Niveau exigé non atteint", "not-observed": "Aucun contrôle reçu", "not-available": "Contenu non partagé" },
    group: { clean: "Rien ne bloque, selon les exigences de l'équipe", gaps: "Refusées par le contrôle", "level-not-met": "Niveau exigé non atteint", "not-observed": "Aucun contrôle reçu", "not-available": "Contenu non partagé" },
    qualifier: { clean: "selon les exigences de l'équipe" },
    received: { state: "Contrôle reçu, sans état écrit", reason: "Le contrôle reçu pour cette application n'écrit pas d'état." },
    reason: {
      clean: "Le contrôle n'a relevé aucune pièce manquante et ne refuse rien. La décision reste la vôtre.",
      gaps: "Le contrôle refuse cette version, pour les raisons qui suivent.",
      "level-not-met": "Aucun écart, mais le niveau de preuve que l'équipe exige n'est pas atteint.",
      "not-observed": "Aucun contrôle n'a été reçu pour cette application.",
      "not-available": `Seules des empreintes remontent pour cette application${NB}: son contenu n'est pas partagé.`,
    },
    date: { received: `Dernier contrôle reçu${NB}: {date}`, fingerprints: `Dernières empreintes reçues${NB}: {date}`, none: "date non déclarée" },
    pieces: {
      title: "Pièces manquantes ou inachevées",
      legend: "Une pièce est un document que l'équipe exige avant la production.",
      item: `{piece}${NB}: {state}`,
      itemCause: `{piece}${NB}: {state}, {cause}`,
      nature: { frame: "Cadrage", architect: "Conception", topology: "Conception", floor: "Première version en service", govern: "Contrôles", handover: "Passation" },
      natureNone: "Pièces sans nature écrite",
      piece: {
        "framing.md": "Note de cadrage", "mission-contract.md": "Contrat de pilotage", "architecture.md": "Note d'architecture",
        "execution-topology.md": "Carte d'exécution", "decision-matrix.md": "Matrice de décision", adr: "Décisions écrites", contracts: "Contrats d'interface",
        "floor.md": "Mesures de la première version", "governance/threat-model.md": "Dossier de sécurité", "governance/evaluation-rubric.md": "Grille d'évaluation",
        "governance/observability-schema.md": "Plan de surveillance", "runbook.md": "Procédure de reprise", "handover.md": "Note de passation",
      },
      state: { missing: "pièce absente", untouched: "pièce manquante", "in-progress": "pièce commencée, pas finie", filled: "pièce remplie" },
      count: { missing: "{count} pièces absentes", untouched: "{count} pièces manquantes", "in-progress": "{count} pièces commencées, pas finies", filled: "{count} pièces remplies" },
      cause: {
        placeholders: "des passages restent à remplir", "below-floor": "le texte est encore trop court pour compter", "missing-section": "une section attendue manque",
        "invalid-field": "un champ attendu n'a pas la forme demandée", "row-out-of-domain": "une ligne contient une valeur hors de la liste permise",
        "incoherent-rows": "des lignes se contredisent", "broken-echo": "un passage à reprendre dans une autre pièce ne l'est pas",
      },
    },
    problems: {
      title: "Ce que le contrôle refuse", byKind: `{count} refus de ce genre${NB}: {reason}`, items: "Où, refus par refus", line: `{subject}${NB}: {reason}`,
      detail: "Détail du contrôle, tel quel", same: "Détail du contrôle, tel quel (le même pour {count})", entry: `{subject}${NB}: {where}`,
      where: "{file}, ligne {line}, exigence {rule}", whereFile: "{file}, exigence {rule}", whereRule: "exigence {rule}",
    },
    kind: {
      proposed: "un point proposé n'est pas encore validé.",
      "missing-row": "une exigence de l'équipe n'a pas de réponse dans le dossier.",
      "empty-status": "une exigence de l'équipe n'a pas encore de réponse choisie.",
      "invalid-status": "une exigence a une réponse que le contrôle ne reconnaît pas.",
      "applied-without-evidence": "une exigence est dite tenue sans preuve jointe.",
      "evidence-placeholder": "une exigence est dite tenue, sa preuve laissée telle que le modèle l'écrit.",
      "deviated-without-adr": "un écart assumé n'a pas sa décision écrite.",
      "na-without-reason": "une exigence est écartée sans raison écrite.",
      "unknown-rule": "le dossier répond à une exigence qui n'existe pas dans les règles de l'équipe.",
      "duplicate-row": "une exigence a plusieurs réponses dans le dossier.",
      "deliverable-missing": "une pièce exigée est absente.",
      "manifest-unreadable": "le contrôle ne peut pas lire en entier la liste des réponses de cette pièce.",
      "mapping-floor": "la liste des exigences de cette pièce a été réduite sous son minimum.",
      "unresolved-pointer": "le dossier cite un fichier ou un élément que le contrôle ne trouve pas.",
      "evidence-refused": "une preuve citée est refusée par le contrôle.",
      "requires-unmet": "une exigence demande une preuve d'une autre nature que celle qui est citée.",
      "rule-violation": "le contrôle refuse une réponse du dossier.",
      "corpus-missing": "une des règles de l'équipe a été supprimée.",
      "corpus-edited": "une des règles de l'équipe a été modifiée depuis sa mise en place.",
      "corpus-extra": "une règle a été ajoutée sans passer par l'outil.",
      "corpus-unrecorded": `l'état des règles de l'équipe n'est pas enregistré${NB}: le contrôle ne peut pas dire si elles ont changé.`,
      "seal-violation": "une preuve a changé depuis son enregistrement.",
      "unratified-decision": "une décision écrite n'est pas encore validée.",
      "unbound-row": "la validation d'un point n'est pas retenue sous les règles plus strictes que l'équipe a choisies.",
      "charter-malformed": "la charte de délégation aux agents est mal formée.",
      "charter-stage-unread": "la charte de délégation déclare un niveau que cette version du contrôle ne sait pas lire.",
      "charter-class-refused": "la charte délègue aux agents un acte qui ne peut pas leur être délégué.",
      "charter-expired": "un agent a agi après la fin de sa délégation.",
      "agent-not-delegate": "un agent a validé un point sans figurer parmi les délégués de la charte.",
      "sample-malformed": "le relevé des revues par échantillon est mal formé.",
      "sample-missed": "un agent a agi alors que les revues par échantillon n'ont pas eu lieu.",
      "class-suspended": "un agent a agi dans une catégorie d'actes qu'une revue par échantillon a suspendue.",
      "analysis-boundary": "le code livré franchit une frontière que l'équipe a déclarée.",
      "analysis-capability": "le code livré utilise une capacité que l'équipe n'a pas autorisée à cet endroit.",
      "analysis-secret": "le code livré contient ce qui ressemble à un secret.",
      "analysis-test-integrity": "un test du code livré ne vérifie pas ce qu'il annonce.",
      "analysis-symbol": "un nom que cite le dossier n'a pas de contenu réel dans le code livré.",
      "analysis-linkage": "un fichier que cite le dossier fait appel à un élément qui n'existe pas.",
      "analysis-policy": "la politique d'analyse choisie par l'équipe est inconnue de cette version du contrôle.",
      "not-observed": "un refus dont le contrôle n'écrit pas le genre.",
    },
    scope: {
      Architect: "Conception", Topology: "Conception", Floor: "Première version en service", Govern: "Contrôles", Handover: "Passation",
      corpus: "Règles de l'équipe", "evidence-seal": "Enregistrement des preuves", reconstruction: "Décisions écrites", delegation: "Délégation aux agents",
      ratification: "Validations", analysis: "Code livré",
    },
    endorsement: {
      title: "Comment les points ont été validés",
      mode: {
        "line-by-line": "{count} points validés point par point",
        "en bloc": "{count} points validés en une fois",
        agent: "{count} points validés par un agent relecteur",
        "agent (single accountable)": "{count} points validés par un agent relecteur ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés",
        blind: "{count} points validés sans relecture du détail",
        changed: "{count} points modifiés depuis leur validation",
        untraced: "{count} points sans validation enregistrée",
        "not-observed": "{count} points validés, sans mode écrit",
      },
      agent: "{count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité de la personne déclarée {person}",
      agentSingle: "{count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité de la personne déclarée {person} ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés",
      agentNotPublished: "{count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité d'une personne déclarée dont le nom n'est pas publié ici",
      agentSingleNotPublished: "{count} points validés par un agent relecteur ({agent}, nom déclaré), sous la responsabilité d'une personne déclarée dont le nom n'est pas publié ici ; la même personne répond de l'agent qui les a proposés et de celui qui les a validés",
      agentNoPerson: "{count} points validés par un agent relecteur ({agent}, nom déclaré), sans personne responsable déclarée",
      noneRecorded: "Aucune validation enregistrée.",
      notDetailed: "Mode de validation non détaillé.",
      declared: `Ces noms et ces modes sont déclarés par l'équipe${NB}: le contrôle ne vérifie pas qui a répondu.`,
      disclosure: `Ce que le contrôle écrit à ce sujet${NB}:`,
    },
    origin: {
      "ci-declared": `D'où vient cette lecture${NB}: calculée par la chaîne de livraison de l'équipe.`,
      "machine-established": `D'où vient cette lecture${NB}: calculée par la chaîne de livraison de l'équipe ; sa signature a été vérifiée par cette page, sous la politique de confiance de l'opérateur.`,
      version: "Contrôle fait avec runward {version}.",
    },
    unknown: {
      state: `État tel que le contrôle l'écrit${NB}: {value}`,
      kind: `détail du contrôle, tel quel${NB}: {value}.`,
      piece: `Pièce telle que le contrôle la nomme${NB}: {value}`,
      scope: `Partie du dossier telle que le contrôle la nomme${NB}: {value}`,
      nature: `Nature telle que le contrôle la nomme${NB}: {value}`,
      pieceState: `état tel que le contrôle l'écrit${NB}: {value}`,
      cause: `cause telle que le contrôle l'écrit${NB}: {value}`,
      mode: `{count} points, validés selon un mode tel que le contrôle l'écrit${NB}: {value}`,
      origin: `D'où vient cette lecture, telle que le relevé l'écrit${NB}: {value}`,
    },
  },
};

// The rules of the decision reading (ADR-0125), listed on the sources view beside the eighteen of ADR-0093.
export const DECISION_RULES = [
  { id: "R1", held: "build", en: "The reading's own words hold none of the method's internal words.", fr: "Les mots propres de la lecture ne contiennent aucun mot interne de la méthode." },
  { id: "R2", held: "build", en: "Every closed value the CLI writes has a sentence in both languages, which hold the same keys; an unknown value is shown as written, never dropped or guessed.", fr: "Chaque valeur fermée que le CLI écrit a sa phrase dans les deux langues, qui tiennent les mêmes clés ; une valeur inconnue s'affiche telle qu'écrite, jamais omise ni devinée." },
  { id: "R3", held: "build", en: "No state reads as a decision taken (go, no-go, ready, blocked); the reader's decision is named in a title only.", fr: "Aucun état ne se lit comme une décision prise (go, no-go, prêt, bloqué) ; la décision du lecteur n'est nommée que dans un titre." },
  { id: "R4", held: "build", en: "Nothing is blocking is always followed by the team's requirements, and, for an application, by the date of the last check received.", fr: "Rien ne bloque est toujours suivi des exigences de l'équipe et, pour une application, de la date du dernier contrôle reçu." },
  { id: "R5", held: "test", en: "A row endorsed by an agent is never worded as a person's endorsement; a refusal's text is shown as written and never read.", fr: "Une ligne validée par un agent ne se dit jamais validée par une personne ; le texte d'un refus s'affiche tel quel et n'est jamais lu." },
  { id: "R6", held: "build", en: "Grouped, no refusal is hidden: within a kind, its texts share out its refusals, and an application's page lists each refusal once.", fr: "Regroupés, aucun refus n'est caché : dans un genre, ses textes se partagent ses refus, et la page d'une application liste chaque refus une fois." },
];

const AGENT_ENDORSEMENTS = new Set(["agent", "agent (single accountable)"]);
const ptr = (...keys) => `/${keys.map((k) => String(k).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;

/** The lexicon's sentence a JSON Pointer (RFC 6901) names, in one language, or undefined. */
export function lexiconAt(lang, pointer) {
  let cur = LEXICON[lang === "fr" ? "fr" : "en"];
  for (const raw of String(pointer).split("/").slice(1)) cur = cur?.[raw.replace(/~1/g, "/").replace(/~0/g, "~")];
  return typeof cur === "string" ? cur : undefined;
}

/** A sentence of the lexicon: its pointer, the index path of the closed value it was read from, its
 *  arguments (each a datum with its index path, or a grouping with its n, N and list), and its text. */
function sentence(lang, keys, args = {}, from = null) {
  const key = ptr(...keys);
  const template = lexiconAt(lang, key);
  if (template === undefined) return null;
  const text = template.replace(/\{([A-Za-z]+)\}/g, (_, k) => String(args[k]?.text ?? ""));
  return { key, text, ...(from ? { from } : {}), ...(Object.keys(args).length ? { args } : {}) };
}
const datum = (text, path) => ({ text: String(text ?? ""), path, verbatim: true });
const count = (g, path, src) => ({ text: `${g.n} / ${g.N}`, n: g.n, N: g.N, list: g.list ?? [], path, src });
const number = (value, path, src) => ({ text: String(value), value, path, src });

/** The deliverable a refusal's file belongs to, read on the closed list of the lexicon, or null. */
function pieceOf(file) {
  if (typeof file !== "string" || !file.startsWith("runward/")) return null;
  const rest = file.slice("runward/".length);
  return Object.keys(LEXICON.en.pieces.piece).filter((k) => rest === k || rest.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

function lastCheck(lang, idx, m, state) {
  const L = typeof m.latest === "object" ? m.latest : null;
  const id = L ? L.src : state === "not-available" ? [`${m.id}:check`, `${m.id}:attestation`].find((x) => idx.sources.some((s) => s.id === x)) : null;
  if (!id) return null;
  const at = idx.sources.find((s) => s.id === id)?.at;
  const date = at ? datum(at, `sources[id=${id}].at`) : { text: lexiconAt(lang, "/date/none") };
  return sentence(lang, ["date", state === "not-available" ? "fingerprints" : "received"], { date }, `sources[id=${id}]`);
}

/** The documents not filled in, by state, each with its n / N from the index. */
function pieceCountsOf(lang, L, b) {
  return (Array.isArray(L.deliverables?.byState) ? L.deliverables.byState : []).map((g, i) => [g, i]).filter(([g]) => g.state !== "filled" && g.n > 0).map(([g, i]) => {
    const gpath = `${b}.deliverables.byState[${i}]`;
    return sentence(lang, ["pieces", "count", g.state], { count: count(g, gpath, L.src) }, `${gpath}.state`)
      ?? sentence(lang, ["unknown", "pieceState"], { value: datum(g.state, `${gpath}.state`) }, `${gpath}.state`);
  });
}

function piecesOf(lang, L, b) {
  const out = [];
  const byNature = new Map();
  (L.deliverables?.list ?? []).forEach((d, i) => {
    if (d.state === "filled") return;
    const p = `${b}.deliverables.list[${i}]`;
    const nature = d.phaseId ?? "";
    if (!byNature.has(nature)) {
      const label = nature === "" ? sentence(lang, ["pieces", "natureNone"], {}, `${p}.phaseId`)
        : sentence(lang, ["pieces", "nature", nature], {}, `${p}.phaseId`) ?? sentence(lang, ["unknown", "nature"], { value: datum(nature, `${p}.phaseId`) }, `${p}.phaseId`);
      const g = { nature, label, items: [] };
      byNature.set(nature, g);
      out.push(g);
    }
    const piece = sentence(lang, ["pieces", "piece", d.relPath], {}, `${p}.relPath`) ?? sentence(lang, ["unknown", "piece"], { value: datum(d.artifact ?? d.relPath, `${p}.artifact`) }, `${p}.relPath`);
    const stateWord = sentence(lang, ["pieces", "state", d.state], {}, `${p}.state`) ?? sentence(lang, ["unknown", "pieceState"], { value: datum(d.state, `${p}.state`) }, `${p}.state`);
    const cause = d.cause ? sentence(lang, ["pieces", "cause", d.cause], {}, `${p}.cause`) ?? sentence(lang, ["unknown", "cause"], { value: datum(d.cause, `${p}.cause`) }, `${p}.cause`) : null;
    const line = sentence(lang, ["pieces", cause ? "itemCause" : "item"], { piece: { text: piece.text, sentence: piece }, state: { text: stateWord.text, sentence: stateWord }, ...(cause ? { cause: { text: cause.text, sentence: cause } } : {}) }, p);
    byNature.get(nature).items.push({ path: p, relPath: d.relPath, state: d.state, cause: d.cause ?? null, line });
  });
  return out;
}

/** The sentence of a refusal's kind, or, for a kind the lexicon does not know, the kind as written. */
function kindSentence(lang, kind, from) {
  return sentence(lang, ["kind", kind], {}, from) ?? sentence(lang, ["unknown", "kind"], { value: datum(kind, from) }, from);
}

/**
 * The refusals by kind, each with its n / N from the index: what a reader takes in first. Within a kind,
 * its refusals by their text as written (ADR-0127, `byText`): the text once, the label of its detail with
 * the n / N of the refusals it stands for when there are several, and their positions in `conformance`.
 */
function kindsOf(lang, L, b) {
  const known = Array.isArray(L.conformance) ? L.conformance.length : 0;
  return (Array.isArray(L.conformanceByKind) ? L.conformanceByKind : []).map((g, i) => {
    const gpath = `${b}.conformanceByKind[${i}]`;
    const reason = kindSentence(lang, g.state, `${gpath}.state`);
    const texts = (Array.isArray(g.byText) ? g.byText : []).map((t, j) => {
      const tpath = `${gpath}.byText[${j}]`;
      const refusals = (Array.isArray(t.list) ? t.list : []).filter((x) => Number.isInteger(x) && x >= 0 && x < known);
      // The list a reader hovers names each refusal as the kind's list does (`scope · rule`); the index's
      // own list holds their positions, which `refusals` keeps.
      const named = { ...t, list: refusals.map((x) => `${L.conformance[x].scope} · ${L.conformance[x].rule}`) };
      // The text shown is the first listed refusal's own `problem`, as written; the group's key is the same
      // text, by construction of the index.
      return {
        path: tpath,
        problem: refusals.length ? datum(L.conformance[refusals[0]].problem, `${b}.conformance[${refusals[0]}].problem`) : datum(t.state, `${tpath}.state`),
        label: t.n > 1 ? sentence(lang, ["problems", "same"], { count: count(named, tpath, L.src) }, tpath) : sentence(lang, ["problems", "detail"], {}, tpath),
        refusals,
      };
    });
    return { kind: g.state, path: gpath, line: sentence(lang, ["problems", "byKind"], { count: count(g, gpath, L.src), reason: { text: reason.text, sentence: reason } }, `${gpath}.state`), texts };
  });
}

/**
 * The positions of the refusals no text group names, in the export's order: none for an index this
 * version builds; every refusal of an index built before ADR-0127, which carries no `byText`. Each is
 * then shown alone, with its own sentence and its detail: grouping never hides a refusal.
 */
function ungroupedOf(L, kinds) {
  const named = new Set(kinds.flatMap((k) => k.texts.flatMap((t) => t.refusals)));
  return (Array.isArray(L.conformance) ? L.conformance : []).map((_, i) => i).filter((i) => !named.has(i));
}

/** The states the reading lists first (ADR-0127): what the check refuses, then the level not met. */
const FIRST = ["gaps", "level-not-met"];
/** The groupings of a list of `{ state }`, those of FIRST first, the others after them in their order. */
const ranked = (groups) => [...FIRST.flatMap((s) => groups.filter((g) => g.state === s)), ...groups.filter((g) => !FIRST.includes(g.state))];

/**
 * The order the reading lists the applications in (ADR-0127), read from `fleet.byVerdict`: the lists of
 * its groups, refused first, then level not met, then the others in the index's order, each list in the
 * inventory's order. An application no list names is listed after them, in the inventory's order: never
 * dropped.
 */
function listingOf(lang, idx) {
  const ids = (idx.missions ?? []).map((m) => m.id);
  const declared = new Set(ids);
  const out = [];
  const seen = new Set();
  const add = (id) => { if (declared.has(id) && !seen.has(id)) { seen.add(id); out.push(id); } };
  for (const g of ranked(Array.isArray(idx.fleet?.byVerdict) ? idx.fleet.byVerdict : [])) for (const id of Array.isArray(g.list) ? g.list : []) add(id);
  ids.forEach(add);
  return { note: sentence(lang, ["orderByState"], {}, "fleet.byVerdict"), ids: out };
}

function problemsOf(lang, L, b) {
  return (L.conformance ?? []).map((c, i) => {
    const p = `${b}.conformance[${i}]`;
    const piece = pieceOf(c.file);
    const subject = piece !== null
      ? sentence(lang, ["pieces", "piece", piece], {}, `${p}.file`)
      : sentence(lang, ["scope", c.scope ?? ""], {}, `${p}.scope`) ?? sentence(lang, ["unknown", "scope"], { value: datum(c.scope, `${p}.scope`) }, `${p}.scope`);
    const reason = kindSentence(lang, c.kind ?? "not-observed", `${p}.kind`);
    const file = c.file ? { ...datum(c.file, `${p}.file`), code: true } : null;
    const rule = { ...datum(c.rule, `${p}.rule`), code: true };
    const at = typeof c.line === "number" ? number(c.line, `${p}.line`, L.src) : null;
    const where = file && at ? sentence(lang, ["problems", "where"], { file, line: at, rule }, p)
      : file ? sentence(lang, ["problems", "whereFile"], { file, rule }, p) : sentence(lang, ["problems", "whereRule"], { rule }, p);
    return {
      path: p, kind: c.kind, known: reason.key.startsWith("/kind/"),
      line: sentence(lang, ["problems", "line"], { subject: { text: subject.text, sentence: subject }, reason: { text: reason.text, sentence: reason } }, p),
      where,
      entry: sentence(lang, ["problems", "entry"], { subject: { text: subject.text, sentence: subject }, where: { text: where.text, sentence: where } }, p),
      problem: datum(c.problem, `${p}.problem`),
    };
  });
}

function endorsementOf(lang, idx, L, b) {
  const r = L.ratification ?? {};
  const rp = `${b}.ratification`;
  const lines = [];
  if (!Array.isArray(r.byMode)) {
    // An index built before the projection, or an export that lists no row: the mode is not known here.
    lines.push(sentence(lang, ["endorsement", "notDetailed"], {}, `${rp}.byMode`));
  } else {
    if (r.byMode.every((g) => g.n === 0)) lines.push(sentence(lang, ["endorsement", "noneRecorded"], {}, `${rp}.byMode`));
    for (const [i, g] of r.byMode.entries()) {
      if (g.n === 0 || (AGENT_ENDORSEMENTS.has(g.state) && Array.isArray(r.agentRows))) continue; // an agent's rows are said with its name, below
      const gp2 = `${rp}.byMode[${i}]`;
      lines.push(sentence(lang, ["endorsement", "mode", g.state], { count: count(g, gp2, L.src) }, `${gp2}.state`)
        ?? sentence(lang, ["unknown", "mode"], { count: count(g, gp2, L.src), value: datum(g.state, `${gp2}.state`) }, `${gp2}.state`));
    }
    const omitted = idx.names?.state === "omitted";
    (Array.isArray(r.agentRows) ? r.agentRows : []).forEach((a, i) => {
      if (a.n === 0) return;
      const ap = `${rp}.agentRows[${i}]`;
      const single = a.state === "agent (single accountable)";
      const person = typeof a.for === "string" && a.for ? datum(a.for, `${ap}.for`) : null;
      // Not published only when one was declared and the index omits names; otherwise none was declared.
      const declared = a.forDeclared === true || (a.forDeclared === undefined && omitted);
      const key = person ? (single ? "agentSingle" : "agent") : omitted && declared ? (single ? "agentSingleNotPublished" : "agentNotPublished") : "agentNoPerson";
      lines.push(sentence(lang, ["endorsement", key], { count: count(a, ap, L.src), agent: datum(a.agent, `${ap}.agent`), ...(person ? { person } : {}) }, `${ap}.state`));
    });
  }
  const disclosure = r.singleAccountable?.disclosure?.length ? r.singleAccountable.disclosure.map((d, i) => datum(d, `${rp}.singleAccountable.disclosure[${i}]`)) : [];
  return { detailed: Array.isArray(r.byMode), lines, disclosure, declared: sentence(lang, ["endorsement", "declared"], {}, rp) };
}

/**
 * The decision reading of an index, `runward-fleet-decision/0`: for the fleet, the groupings n / N by
 * state with their lists, and the order the reading lists the applications in (`listing`, read from
 * those groupings, ADR-0127); for each application, in the inventory's order, its state (the index's
 * own, renamed, never recomputed), the sentence that follows it, the date of the last check received,
 * the reason, the missing pieces by their nature, the refusals by kind and, within a kind, by their text
 * as written, each refusal with its sentence and where it is, how the decided rows were endorsed, and
 * where the reading comes from. Every value carries its index path.
 */
export function decide(idx) {
  const lang = idx?.lang === "fr" ? "fr" : "en";
  const s0 = idx.manifest?.src ?? "fleet.json";
  return {
    format: DECISION_FORMAT,
    lang,
    index: { format: idx.format ?? null, builtBy: idx.builtBy ?? null },
    names: idx.names?.state === "omitted" ? "omitted" : "shown",
    title: sentence(lang, ["title"]),
    listing: listingOf(lang, idx),
    fleet: {
      declared: number(idx.fleet.declared, "fleet.declared", s0),
      groups: (idx.fleet.byVerdict ?? []).map((g, i) => {
        const gpath = `fleet.byVerdict[${i}]`;
        return { state: g.state, label: sentence(lang, ["group", g.state], {}, `${gpath}.state`) ?? sentence(lang, ["unknown", "state"], { value: datum(g.state, `${gpath}.state`) }, `${gpath}.state`), count: count(g, gpath, s0) };
      }),
    },
    applications: (idx.missions ?? []).map((m) => {
      const b = `missions[id=${m.id}].latest`;
      const L = typeof m.latest === "object" ? m.latest : null;
      const state = L ? L.verdict : m.latest;
      const from = L ? `${b}.verdict` : b;
      // A check received whose export writes no verdict: the index reads its verdict `not-observed`, and
      // the reading says what happened, never that nothing was received.
      const unwritten = L !== null && (typeof L.verdict !== "string" || L.verdict === "not-observed");
      const known = !unwritten && lexiconAt(lang, ptr("state", state)) !== undefined;
      const kinds = L ? kindsOf(lang, L, b) : [];
      return {
        id: m.id,
        path: `missions[id=${m.id}]`,
        name: datum(m.name, `missions[id=${m.id}].name`),
        state,
        stateWord: unwritten ? sentence(lang, ["received", "state"], {}, from) : known ? sentence(lang, ["state", state], {}, from) : sentence(lang, ["unknown", "state"], { value: datum(state, from) }, from),
        qualifier: state === "clean" ? sentence(lang, ["qualifier", "clean"], {}, from) : null,
        date: lastCheck(lang, idx, m, state),
        reason: unwritten ? sentence(lang, ["received", "reason"], {}, from) : known ? sentence(lang, ["reason", state], {}, from) : null,
        pieces: L ? piecesOf(lang, L, b) : [],
        kinds,
        pieceCounts: L ? pieceCountsOf(lang, L, b) : [],
        problems: L ? problemsOf(lang, L, b) : [],
        ungrouped: L ? ungroupedOf(L, kinds) : [],
        endorsement: L ? endorsementOf(lang, idx, L, b) : null,
        origin: L ? sentence(lang, ["origin", L.implemented], {}, `${b}.implemented`) ?? sentence(lang, ["unknown", "origin"], { value: datum(L.implemented, `${b}.implemented`) }, `${b}.implemented`) : null,
        version: L?.runward ? sentence(lang, ["origin", "version"], { version: datum(L.runward, `${b}.runward`) }, `${b}.runward`) : null,
      };
    }),
  };
}

// ---- its rendering: semantic roles (`data-role`), styled by each deployment's own layer
function say(lang, s) {
  if (!s) return "";
  const template = lexiconAt(lang, s.key) ?? "";
  let html = "", at = 0;
  for (const m of template.matchAll(/\{([A-Za-z]+)\}/g)) {
    html += esc(template.slice(at, m.index)) + arg(lang, s.args?.[m[1]]);
    at = m.index + m[0].length;
  }
  return html + esc(template.slice(at));
}
function arg(lang, a) {
  if (!a) return "";
  if (a.sentence) return say(lang, a.sentence);
  if (a.N !== undefined) return frac({ n: a.n, N: a.N, list: a.list }, a.src, a.path);
  if (typeof a.value === "number") return n(a.value, a.src, null, a.path);
  if (a.verbatim) return a.code ? code(a.text) : verb(a.text);
  return esc(a.text);
}
const role = (r, inner, attrs = "") => `<p data-role="${r}"${attrs}>${inner}</p>`;

function stateBlock(lang, app) {
  const st0 = `data-state="${esc(app.state)}"`;
  return `<p data-role="state" ${st0}><span data-role="mark" aria-hidden="true"></span><span data-role="state-word">${say(lang, app.stateWord)}</span></p>
      ${app.qualifier ? role("qualifier", say(lang, app.qualifier)) : ""}${app.date ? role("date", say(lang, app.date)) : ""}`;
}

/** The refusals by kind and the documents not filled in, each with its n / N: why, in a few lines. An
 *  application's page says the refusals by kind in its section of refusals, and only the documents here. */
function why(lang, a, { kinds = true } = {}) {
  const lines = [...(kinds ? a.kinds : []).map((k) => `<li data-role="kind" data-kind="${esc(k.kind)}">${say(lang, k.line)}</li>`), ...a.pieceCounts.map((c) => `<li data-role="piece-count">${say(lang, c)}</li>`)];
  return lines.length ? `<ul data-role="kinds">${lines.join("")}</ul>` : "";
}

/** The applications of the reading, in the order it lists them (`listing`, ADR-0127). */
function listed(doc) {
  const byId = new Map(doc.applications.map((a) => [a.id, a]));
  return (doc.listing?.ids ?? doc.applications.map((a) => a.id)).map((id) => byId.get(id)).filter(Boolean);
}

function decisionPortfolio(doc) {
  const X = LEXICON[doc.lang], lang = doc.lang;
  // Every state, with its n / N, 0 / N included (ADR-0127): a state with no application is a fact too.
  const groups = ranked(doc.fleet.groups).map((g) =>
    `<li data-role="group" data-state="${esc(g.state)}"><span data-role="mark" aria-hidden="true"></span><span data-role="group-label">${say(lang, g.label)}</span> ${arg(lang, g.count)}</li>`).join("");
  const apps = listed(doc).map((a) => `<li data-role="application" data-state="${esc(a.state)}" data-mission="${esc(a.id)}">
      <h2 data-role="name">${verb(a.name.text)}</h2>
      ${stateBlock(lang, a)}
      ${a.reason ? role("reason", say(lang, a.reason)) : ""}
      ${why(lang, a)}
      <p data-role="links"><a href="#/decision/${esc(a.id)}">${esc(X.read)}</a> · <a href="#/mission/${esc(a.id)}">${esc(X.technical)}</a></p>
    </li>`).join("");
  return `<section data-reading="decision" data-view="portfolio">
    <h1 data-role="title">${say(lang, doc.title)}</h1>
    ${role("lede", esc(X.lede))}
    <ul data-role="groups">${groups}</ul>
    ${role("note", doc.listing ? say(lang, doc.listing.note) : esc(X.order))}
    <ol data-role="applications">${apps}</ol>
  </section>`;
}

/** The check's text, once, behind a disclosure whose label carries the n / N of the refusals it stands for. */
const detailOf = (lang, label, text, open) => `<details data-role="detail"${open ? " open" : ""}><summary data-role="detail-label">${label}</summary><!--verbatim:start--><p data-role="verbatim" lang="en">${esc(text)}</p><!--verbatim:end--></details>`;
/** One refusal: its document and where it is (file, line, requirement), as the index names them. */
const refusalOf = (lang, p, tag) => `<${tag} data-role="problem" data-kind="${esc(p.kind ?? "")}" data-index="${esc(p.path)}">${say(lang, p.entry)}</${tag}>`;

/**
 * What the check refuses (ADR-0127): for each kind, its sentence with n / N; for each text the check wrote
 * for that kind, the text once, folded (the first of the page open), and every refusal it stands for,
 * listed behind a second disclosure when there are several. A refusal no text group names is shown alone,
 * with its own sentence: no refusal is ever hidden by a grouping. No script: `<details>` folds.
 */
function refusalsOf(lang, X, a) {
  let first = true;
  const once = () => { const o = first; first = false; return o; };
  const kinds = a.kinds.map((k) => `<li data-role="refusal-kind" data-kind="${esc(k.kind)}">${role("sentence", say(lang, k.line))}${k.texts.map((t) => {
    const items = t.refusals.map((i) => a.problems[i]).filter(Boolean);
    const where = items.length === 0 ? "" : items.length === 1 ? refusalOf(lang, items[0], "p")
      : `<details data-role="where"><summary data-role="where-label">${esc(X.problems.items)}</summary><ol data-role="refusals">${items.map((p) => refusalOf(lang, p, "li")).join("")}</ol></details>`;
    return `<div data-role="refusal-text">${detailOf(lang, say(lang, t.label), t.problem.text, once())}${where}</div>`;
  }).join("")}</li>`);
  const alone = a.ungrouped.map((i) => a.problems[i]).filter(Boolean).map((p) => `<li data-role="refusal-kind" data-kind="${esc(p.kind ?? "")}">${role("sentence", say(lang, p.line))}<div data-role="refusal-text">${detailOf(lang, esc(X.problems.detail), p.problem.text, once())}${refusalOf(lang, p, "p")}</div></li>`);
  const all = [...kinds, ...alone];
  return all.length ? `<section data-role="problems"><h2>${esc(X.problems.title)}</h2><ol data-role="refusal-kinds">${all.join("")}</ol></section>` : "";
}

function decisionApplication(doc, a) {
  const X = LEXICON[doc.lang], lang = doc.lang;
  const problems = refusalsOf(lang, X, a);
  const pieces = a.pieces.length ? `<section data-role="pieces"><h2>${esc(X.pieces.title)}</h2>${role("legend", esc(X.pieces.legend))}${a.pieces.map((g) => `<div data-role="nature"><h3>${say(lang, g.label)}</h3><ul>${g.items.map((it) => `<li data-role="piece" data-state="${esc(it.state)}">${say(lang, it.line)}</li>`).join("")}</ul></div>`).join("")}</section>` : "";
  const E = a.endorsement;
  const endorsement = E ? `<section data-role="endorsement"><h2>${esc(X.endorsement.title)}</h2><ul>${E.lines.filter(Boolean).map((s) => `<li>${say(lang, s)}</li>`).join("")}</ul>
      ${E.disclosure.length ? `<div data-role="detail"><p data-role="detail-label">${esc(X.endorsement.disclosure)}</p><!--verbatim:start-->${E.disclosure.map((d) => `<p data-role="verbatim" lang="en">${esc(d.text)}</p>`).join("")}<!--verbatim:end--></div>` : ""}
      ${role("note", say(lang, E.declared))}</section>` : "";
  return `<section data-reading="decision" data-view="application" data-mission="${esc(a.id)}">
    <p data-role="back"><a href="#/decision">${esc(X.back)}</a></p>
    <h1 data-role="name">${verb(a.name.text)}</h1>
    ${stateBlock(lang, a)}
    ${a.reason ? role("reason", say(lang, a.reason)) : ""}
    ${why(lang, a, { kinds: false })}
    ${problems}${pieces}${endorsement}
    ${a.origin ? role("origin", say(lang, a.origin)) : ""}${a.version ? role("version", say(lang, a.version)) : ""}
    <p data-role="links"><a href="#/mission/${esc(a.id)}">${esc(X.technical)}</a></p>
  </section>`;
}

/**
 * The HTML of the decision reading: the portfolio, or one application's page when `id` names a mission.
 * Each element carries its role (`data-role`), never a look: the static page and a hosted deployment
 * style the same roles with their own layer, and render the same bytes from the same index.
 */
export function renderDecision(idx, id) {
  const doc = decide(idx);
  if (id === undefined || id === null || id === "") return decisionPortfolio(doc);
  const a = doc.applications.find((x) => x.id === id);
  return a ? decisionApplication(doc, a) : decisionPortfolio(doc);
}

// ------------------------------------------------------------------ entry points
function use(idx) {
  IDX = idx;
  const L = idx?.lang === "fr" ? "fr" : "en";
  t = TEXT[L];
  W = WORDS[L];
}

/**
 * The HTML of one view: `route` is one of ROUTES, `arg` a mission id for the mission view. The page
 * shows a sentence when a view cannot be built; the build passes `{ strict: true }` and refuses instead.
 */
export function renderView(idx, route = "", arg, { strict = false } = {}) {
  use(idx);
  try {
    if (route === "decision") return renderDecision(idx, arg);
    if (route === "mission") return viewMission(arg);
    if (route === "history") return viewHistory();
    if (route === "proof") return viewProof();
    if (route === "signatures") return viewSignatures();
    if (route === "pr") return viewPR();
    if (route === "sources") return viewSources();
    return viewFleet();
  } catch (e) {
    if (strict) throw e;
    return `<p class="face">${esc(t.renderError)}</p><p class="small soft">${esc(e.message)}</p>`;
  }
}

/** Every view the page can show, as [route, arg] pairs: the build checks each of them. */
export function allViews(idx) {
  return [["decision", null], ...idx.missions.map((m) => ["decision", m.id]), ["", null], ...idx.missions.map((m) => ["mission", m.id]), ["history", null], ["proof", null], ["signatures", null], ["pr", null], ["sources", null]];
}

export function renderNav(idx, route) {
  use(idx);
  return ROUTES.map((r) => {
    const target = r === "mission" ? `mission/${idx.missions[0]?.id ?? ""}` : r;
    return `<a href="#/${esc(target)}"${r === route ? ' aria-current="page"' : ""}>${esc(r === "decision" ? LEXICON[lang(idx)].nav : t.nav[r])}</a>`;
  }).join("");
}

export function renderStamp(idx) {
  use(idx);
  return t.stamp(esc(idx.title), esc(idx.asOf.label ?? t.asOfMissing), esc(idx.sources.length));
}

export function lang(idx) {
  return idx?.lang === "fr" ? "fr" : "en";
}
