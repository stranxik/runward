// A generator of missions and the eight metamorphic relations of ADR-0089 (increment 1, step 2).
// Test support: never shipped, never in the verdict path.
//
// A mission is a tree in memory (a Map from a POSIX path to raw bytes, see `mission-snapshot.js`),
// derived from the shipped example (`init --example`, green out of the box) by operators that keep
// it a valid mission: the rule rows of each gated manifest reordered, some `applied` rows decided
// otherwise (`n/a` with a reason, `deviated` with an ADR), new evidence files cited from `applied`
// rows, and uncited files added beside the code. Most generated missions are green; the red-turning
// relations only use the green ones (`fc.pre` in the test), the others use all of them.
//
// What it does not generate, said so the reach of a green run is not overread: malformed manifests,
// missions other than the example's shape, seals, charters, the regulated tier, workflow contracts.
// Those are increment 2 of ADR-0089, or the business of the attack corpus.
//
// The relations read the tree with their own small parsers (a table row, a `file:`/`test:` path, a
// rule's frontmatter), deliberately not runward's: a relation that chose its target with the
// verdict's own pointer grammar would inherit that grammar's blind spots and could not see them.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { readTree, sortTree } from "./mission-snapshot.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

/** The gated deliverables, their phase and their label in the verdict. Restated from
 *  `conformance.ts` `GATED_DELIVERABLES` rather than imported, for the reason given above. */
export const GATED = [
  { phase: "architect", file: "runward/architecture.md", label: "Architect" },
  { phase: "topology", file: "runward/execution-topology.md", label: "Topology" },
  { phase: "floor", file: "runward/floor.md", label: "Floor" },
  { phase: "govern", file: "runward/governance/threat-model.md", label: "Govern" },
  { phase: "handover", file: "runward/handover.md", label: "Handover" },
];

let example = null;
/** The example mission as a tree, built once per process with the CLI under test. */
export function exampleTree() {
  if (example) return example;
  const dir = mkdtempSync(join(tmpdir(), "rw-mr-example-"));
  try {
    execFileSync(process.execPath, [CLI, "init", "--yes", "--example", "-p", "."], { cwd: dir, stdio: "pipe" });
    example = readTree(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return example;
}

// ---------------------------------------------------------------------------------------------
// Small readers, independent of runward's.

const text = (tree, p) => tree.get(p).toString("utf8");
const withText = (tree, p, s) => sortTree(new Map(tree).set(p, Buffer.from(s, "utf8")));
/** Split keeping each line's terminator off and its CR on, so a CRLF file round-trips. */
const lines = (s) => s.split("\n");

/** The line indices of the rule rows of a manifest's single `Rule conformance` table. */
export function ruleRowIndices(s) {
  const ls = lines(s);
  let start = -1, fenced = false;
  for (let i = 0; i < ls.length; i++) {
    if (/^\s*(```|~~~)/.test(ls[i])) { fenced = !fenced; continue; }
    if (!fenced && /^#{1,6}\s+Rule conformance/i.test(ls[i])) { start = i; break; }
  }
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < ls.length; i++) {
    if (/^#{1,6}\s/.test(ls[i])) break;
    const cells = cellsOf(ls[i]);
    if (cells && /^[a-z][a-z0-9-]+$/.test(cells[0]) && cells.length >= 3) out.push(i);
  }
  return out;
}

/** The trimmed cells of a table row, or null for a line that is not one. */
export function cellsOf(line) {
  const t = line.replace(/\r$/, "").trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return null;
  return t.slice(1, -1).split("|").map((c) => c.trim());
}

/** Every rule row of every gated manifest: `{ file, phase, label, index, rule, status, evidence }`. */
export function rows(tree) {
  const out = [];
  for (const g of GATED) {
    if (!tree.has(g.file)) continue;
    const ls = lines(text(tree, g.file));
    for (const index of ruleRowIndices(text(tree, g.file))) {
      const [rule, status, ...rest] = cellsOf(ls[index]);
      out.push({ ...g, index, rule, status, evidence: rest.join(" | ") });
    }
  }
  return out;
}

/** The frontmatter fields the expected set is made of, per rule slug. */
export function ruleMeta(tree) {
  const out = new Map();
  for (const [p, b] of tree) {
    const m = p.match(/^runward\/rules\/([a-z0-9-]+)\.md$/);
    if (!m) continue;
    const fm = b.toString("utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const impact = fm.match(/^impact:\s*(\S+)/m)?.[1] ?? "";
    const phases = (fm.match(/^phases:\s*\[([^\]]*)\]/m)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    out.set(m[1], { impact, phases });
  }
  return out;
}

const expectedIn = (meta, rule, phase) => {
  const r = meta.get(rule);
  return Boolean(r) && /^(CRITICAL|HIGH)$/.test(r.impact) && r.phases.includes(phase);
};

/** The project-relative paths an evidence cell cites with `file:` or `test:`, resolved against the
 *  three bases a pointer may use (the root, `runward/`, the deliverable's directory) and kept only
 *  when the tree holds them. */
export function citedPaths(tree, row) {
  const out = new Set();
  for (const m of row.evidence.matchAll(/\b(?:file|test):([^\s#;,"]+?)(?=::|[\s#;,"]|$)/g)) {
    const raw = m[1].replace(/:\d+(-\d+)?$/, "");
    for (const base of ["", "runward", posix.dirname(row.file)]) {
      const p = posix.normalize(posix.join(base, raw));
      if (!p.startsWith("..") && tree.has(p)) { out.add(p); break; }
    }
  }
  return [...out];
}

/** Files outside `runward/` that no file of the mission and no file at the root mentions, by path or
 *  by name. Conservative on purpose: a file this calls uncited is uncited however a pointer, a prose
 *  token or a territory row would spell it. */
export function uncitedFiles(tree) {
  const corpus = [...tree].filter(([p]) => p.startsWith("runward/") || !p.includes("/")).map(([, b]) => b.toString("utf8")).join("\n");
  return [...tree.keys()].filter((p) => !p.startsWith("runward/") && !corpus.includes(p) && !corpus.includes(posix.basename(p)));
}

const isText = (b) => !b.includes(0);

function replaceLine(tree, file, index, fn) {
  const ls = lines(text(tree, file));
  const out = fn(ls, index);
  return withText(tree, file, out.join("\n"));
}

function rowLine(cells) {
  return `| ${cells.join(" | ")} |`;
}

// ---------------------------------------------------------------------------------------------
// The generator.

const slug = fc.stringMatching(/^[a-z][a-z0-9]{3,9}$/);
const words = fc.array(fc.constantFrom("the", "floor", "keeps", "no", "queue", "surface", "this", "mission", "reads", "nothing", "here", "deterministic"), { minLength: 4, maxLength: 9 }).map((w) => w.join(" "));
const content = fc.array(fc.string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 .,;:-_()éü\n"), minLength: 1, maxLength: 40 }), { minLength: 1, maxLength: 4 })
  .map((ls) => ls.join("\n") + "\n").filter((s) => new Set(s.replace(/\s/g, "")).size >= 3);

/** One permutation of `n` items, as a list of indices. */
const permutation = (n) => fc.shuffledSubarray([...Array(n).keys()], { minLength: n, maxLength: n });

function buildArbitrary() {
  const base = exampleTree();
  const perFile = GATED.map((g) => ruleRowIndices(text(base, g.file)).length);
  return fc.record({
    order: fc.tuple(...perFile.map(permutation)),
    decisions: fc.array(fc.record({ pick: fc.nat(), to: fc.constantFrom("n/a", "deviated"), reason: words }), { maxLength: 3 }),
    cited: fc.array(fc.record({ name: slug, body: content, pick: fc.nat() }), { maxLength: 3 }),
    noise: fc.array(fc.record({ dir: fc.constantFrom("code/notes", "docs", "code/src/extra", ""), name: slug, ext: fc.constantFrom(".txt", ".md", ".ts"), body: content }), { maxLength: 3 }),
  }).map((g) => {
    const tree = generate(base, g);
    // A counterexample prints the generated description, not 150 files of bytes.
    Object.defineProperty(tree, fc.toStringMethod, { value: () => `mission(${JSON.stringify(g)})` });
    return tree;
  });
}

/** Apply one generated description to the example. Pure: same description, same tree. */
export function generate(base, { order, decisions, cited, noise }) {
  let tree = base;
  // Reorder each gated table.
  GATED.forEach((g, k) => {
    const idx = ruleRowIndices(text(tree, g.file));
    const ls = lines(text(tree, g.file));
    const moved = order[k].map((i) => ls[idx[i]]);
    idx.forEach((i, j) => { ls[i] = moved[j]; });
    tree = withText(tree, g.file, ls.join("\n"));
  });
  // Decide some applied rows otherwise.
  for (const d of decisions) {
    const applied = rows(tree).filter((r) => r.status === "applied");
    if (!applied.length) break;
    const r = applied[d.pick % applied.length];
    const evidence = d.to === "n/a" ? `${d.reason}, said in one line` : `ADR-0001 — ${d.reason}`;
    tree = replaceLine(tree, r.file, r.index, (ls, i) => { ls[i] = rowLine([r.rule, d.to, evidence]); return ls; });
  }
  // Cite new evidence files from applied rows.
  for (const c of cited) {
    const p = `code/evidence/${c.name}.md`;
    if (tree.has(p)) continue;
    const applied = rows(tree).filter((r) => r.status === "applied");
    if (!applied.length) break;
    const r = applied[c.pick % applied.length];
    tree = sortTree(new Map(tree).set(p, Buffer.from(c.body, "utf8")));
    tree = replaceLine(tree, r.file, r.index, (ls, i) => { ls[i] = rowLine([r.rule, r.status, `${r.evidence}; file:${p}`]); return ls; });
  }
  // Add files nobody cites.
  for (const n of noise) {
    const p = (n.dir ? `${n.dir}/` : "") + `${n.name}-uncited${n.ext}`;
    if (!tree.has(p)) tree = sortTree(new Map(tree).set(p, Buffer.from(n.body, "utf8")));
  }
  return tree;
}

let arbitrary = null;
/** The mission arbitrary (built lazily: it needs the example tree, which needs a build). */
export function missionArb() {
  return (arbitrary ??= buildArbitrary());
}

// ---------------------------------------------------------------------------------------------
// The eight relations. Each is `{ name, expect, params(tree) → Arbitrary | null, apply(tree, p) }`;
// `params` returns null when the tree offers the relation no target (the property then discards the
// case). `expect` is "same" (the canonical verdict is byte-identical), "same-but-one-row" (the same,
// except that the evidence breakdown counts the added row), or a violation kind the transformed
// mission must carry on a green mission it turns red.

export const RELATIONS = [
  {
    id: "MR-1", name: "renaming a file no row cites leaves the verdict unchanged", expect: "same",
    params: (tree) => {
      const c = uncitedFiles(tree);
      return c.length ? fc.record({ pick: fc.nat(c.length - 1), name: slug }).map((p) => ({ ...p, from: c[p.pick] })) : null;
    },
    apply: (tree, { from, name }) => {
      const to = posix.join(posix.dirname(from), `${name}-renamed${posix.extname(from)}`);
      if (tree.has(to)) return null;
      const t = new Map(tree);
      t.set(to, t.get(from));
      t.delete(from);
      return sortTree(t);
    },
  },
  {
    id: "MR-2", name: "reversing the order of a manifest's rule rows leaves the verdict unchanged", expect: "same",
    params: () => fc.subarray(GATED.map((g) => g.file), { minLength: 1 }).map((files) => ({ files })),
    apply: (tree, { files }) => {
      let t = tree;
      for (const f of files) {
        const ls = lines(text(t, f));
        const idx = ruleRowIndices(text(t, f));
        const rev = idx.map((i) => ls[i]).reverse();
        idx.forEach((i, k) => { ls[i] = rev[k]; });
        t = withText(t, f, ls.join("\n"));
      }
      return t;
    },
  },
  {
    id: "MR-3", name: "re-padding the cells of every rule row leaves the verdict unchanged", expect: "same",
    params: () => fc.array(fc.nat(3), { minLength: 32, maxLength: 32 }).map((pads) => ({ pads })),
    apply: (tree, { pads }) => {
      let t = tree, k = 0;
      const pad = () => " ".repeat(pads[k++ % pads.length]);
      for (const g of GATED) {
        const ls = lines(text(t, g.file));
        for (const i of ruleRowIndices(text(t, g.file))) {
          ls[i] = pad() + "|" + cellsOf(ls[i]).map((c) => `${pad()}${c}${pad()}`).join("|") + "|" + pad();
        }
        t = withText(t, g.file, ls.join("\n"));
      }
      return t;
    },
  },
  {
    id: "MR-4", name: "converting files to CRLF leaves the verdict unchanged", expect: "same",
    params: (tree) => fc.subarray([...tree].filter(([, b]) => isText(b)).map(([p]) => p), { minLength: 1 }).map((files) => ({ files })),
    apply: (tree, { files }) => {
      const t = new Map(tree);
      for (const f of files) t.set(f, Buffer.from(t.get(f).toString("utf8").replace(/\r?\n/g, "\r\n"), "utf8"));
      return sortTree(t);
    },
  },
  {
    id: "MR-5", name: "adding an n/a row for a rule the phase does not expect leaves the verdict unchanged", expect: "same-but-one-row",
    params: (tree) => {
      const meta = ruleMeta(tree);
      const present = new Set(rows(tree).map((r) => `${r.file}\u0000${r.rule}`));
      const pairs = GATED.flatMap((g) => [...meta.keys()].filter((rule) => !expectedIn(meta, rule, g.phase) && !present.has(`${g.file}\u0000${rule}`)).map((rule) => ({ file: g.file, rule })));
      return pairs.length ? fc.record({ pick: fc.nat(pairs.length - 1), at: fc.nat(), reason: words }).map((p) => ({ ...p, ...pairs[p.pick] })) : null;
    },
    apply: (tree, { file, rule, at, reason }) => {
      const idx = ruleRowIndices(text(tree, file));
      const ls = lines(text(tree, file));
      const where = idx.length ? idx[at % idx.length] + (at % 2) : ls.length;
      ls.splice(where, 0, rowLine([rule, "n/a", `${reason}, said in one line`]));
      return withText(tree, file, ls.join("\n"));
    },
  },
  {
    id: "MR-6", name: "deleting a file an applied row cites turns a green verdict red", expect: "unresolved-pointer",
    params: (tree) => {
      const c = [...new Set(rows(tree).filter((r) => r.status === "applied").flatMap((r) => citedPaths(tree, r)))].filter((p) => !p.startsWith("runward/")).sort();
      return c.length ? fc.nat(c.length - 1).map((i) => ({ path: c[i] })) : null;
    },
    apply: (tree, { path }) => { const t = new Map(tree); t.delete(path); return t; },
  },
  {
    id: "MR-7", name: "duplicating a rule row turns a green verdict red", expect: "duplicate-row",
    params: (tree) => {
      const rs = rows(tree);
      return rs.length ? fc.record({ pick: fc.nat(rs.length - 1), at: fc.nat() }).map((p) => ({ ...p, row: rs[p.pick] })) : null;
    },
    apply: (tree, { row, at }) => {
      const idx = ruleRowIndices(text(tree, row.file));
      const ls = lines(text(tree, row.file));
      ls.splice(idx[at % idx.length] + (at % 2), 0, ls[row.index]);
      return withText(tree, row.file, ls.join("\n"));
    },
    rule: (p) => ({ label: p.row.label, rule: p.row.rule }),
  },
  {
    id: "MR-8", name: "emptying the evidence of an applied row turns a green verdict red", expect: "applied-without-evidence",
    params: (tree) => {
      const meta = ruleMeta(tree);
      const rs = rows(tree).filter((r) => r.status === "applied" && expectedIn(meta, r.rule, r.phase));
      return rs.length ? fc.record({ pick: fc.nat(rs.length - 1), blank: fc.constantFrom("", " ", "   ") }).map((p) => ({ ...p, row: rs[p.pick] })) : null;
    },
    apply: (tree, { row, blank }) => replaceLine(tree, row.file, row.index, (ls, i) => { ls[i] = `| ${row.rule} | applied |${blank}|`; return ls; }),
    rule: (p) => ({ label: p.row.label, rule: p.row.rule }),
  },
];
