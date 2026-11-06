// ADR-0114 decision 1: a `#SYMBOL` pointer is looked for outside the file's comments.
//
// Measured 2026-11-05 on 0.46.0 and `main` (RWD-2026-0194): the README's two-minute demo renames
// `guardFields` to `validateFields` everywhere, and the gate goes red on the two pointers that still
// cite the old name. Leave one line behind, `// validateFields was called guardFields before the
// rename.`, and `check --strict` exited 0, "all gates passed", over a floor note and a threat model
// citing a function that no longer exists. The search read the whole file, comments included.
//
// Each test below carries its positive control: the reading it replaces (the text, comments
// included) still sees the name, so a green here is the comment being set aside, never the name
// being missed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMENT_AWARE_EXTENSIONS, COMMENT_ONLY, symbolPresent, withoutComments } from "../../dist/lib/evidence.js";
import { specConformance } from "../../dist/lib/spec-conformance.js";
import { citationsForPaths } from "../../dist/lib/citations.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const env = { ...process.env, NO_COLOR: "1", RUNWARD_YES: "1" };
const check = (dir, ...a) => spawnSync("node", [CLI, "check", ...a], { cwd: dir, encoding: "utf8", env });

test("the README's rename demo: the old name left in a comment no longer turns the gate green", () => {
  const dir = mkdtempSync(join(tmpdir(), "rw-comment-rename-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    execFileSync("node", [CLI, "--yes", "init", "--example"], { cwd: dir, env });
    assert.equal(check(dir, "--strict").status, 0, "the shipped example is green");
    execFileSync("sh", ["-c", "grep -rl guardFields code/src | xargs sed -i.bak 's/guardFields/validateFields/g'"], { cwd: dir });
    const renamed = check(dir, "--strict");
    assert.equal(renamed.status, 1, "the control: renamed everywhere, the two pointers are red");
    assert.doesNotMatch(renamed.stdout, /occurs only in a comment/, "no comment holds the name yet, so the refusal says nothing about one");
    const guard = join(dir, "code/src/core/domain/guard.ts");
    const pristine = readFileSync(guard, "utf8");
    for (const left of ["\n// validateFields was called guardFields before the rename.\n", "\n/* validateFields was\n   called guardFields before the rename. */\n"]) {
      writeFileSync(guard, pristine + left);
      assert.ok(readFileSync(guard, "utf8").includes("guardFields"), "the old name is in the file, in a comment");
      const r = check(dir, "--strict");
      assert.equal(r.status, 1, `the old name in a comment keeps the gate red: ${JSON.stringify(left)}`);
      const causes = r.stdout.split("\n").filter((l) => l.startsWith("  ✗ ") && l.includes("#guardFields"));
      assert.ok(causes.length >= 2, `both pointers are named: ${causes.join(" | ")}`);
      for (const line of causes) assert.ok(line.includes(COMMENT_ONLY.trim().replace(/^— /, "")), `the refusal says the name is only in a comment: ${line}`);
      assert.doesNotMatch(r.stdout, /all gates passed/);
    }
    // A legitimate rename: code renamed, pointers updated, the old name still in a comment. Green.
    execFileSync("sh", ["-c", "sed -i.bak 's/#guardFields/#validateFields/' runward/floor.md runward/governance/threat-model.md"], { cwd: dir });
    const repaired = check(dir, "--strict");
    assert.equal(repaired.status, 0, `the repaired rename is green, the comment notwithstanding: ${repaired.stdout.split("\n").filter((l) => l.includes("✗")).join(" | ")}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// One case per language family the table knows: the name only in a comment is absent; the same
// name in code is present; and the text reading (no path), the control, sees it in both.
const ONLY_IN_COMMENT = {
  "a.ts": "export function fresh() {}\n// guardFields was renamed\n/* guardFields */\n",
  "a.tsx": "export const A = () => null; // guardFields\n",
  "a.mts": "/** guardFields was the name */ export const x = 1;\n",
  "a.cts": "// guardFields\nmodule.exports = {};\n",
  "a.js": "const x = 1; /* guardFields\n spans lines */\n",
  "a.jsx": "export default 1; // guardFields\n",
  "a.mjs": "// guardFields\nexport {};\n",
  "a.cjs": "/* guardFields */ module.exports = 1;\n",
  "a.py": "def fresh():\n    pass  # guardFields was renamed\n",
  "a.md": "# Heading\n\nText.\n<!-- guardFields -->\n",
  "a.markdown": "Text.\n<!--\nguardFields\n-->\n",
  "a.html": "<p>Text</p><!-- guardFields -->\n",
  "a.json": "{\n  // guardFields\n  \"a\": 1 /* guardFields */\n}\n",
  "a.yml": "key: value # guardFields\n# guardFields\n",
  "a.yaml": "a: 1  # guardFields\n",
  "a.toml": "a = 1 # guardFields\n",
  "a.go": "package a\n// guardFields\n/* guardFields */\n",
  "a.rs": "fn fresh() {} // guardFields\n/* outer /* inner */ guardFields */\n",
  "a.java": "class A { /* guardFields */ } // guardFields\n",
  "a.rb": "x = 1 # guardFields\n=begin\nguardFields\n=end\n",
  "a.php": "<?php\n// guardFields\n# guardFields\n/* guardFields */\n",
  "a.sql": "select 1; -- guardFields\n/* guardFields */\n",
  "a.sh": "echo ok # guardFields\n",
  "a.css": "a { color: red; } /* guardFields */\n",
  "a.scss": "a { b: c; } // guardFields\n/* guardFields */\n",
};
const IN_CODE = {
  "a.ts": "export function guardFields() {}\n", "a.tsx": "export const guardFields = 1;\n", "a.mts": "export const guardFields = 1;\n",
  "a.cts": "exports.guardFields = 1;\n", "a.js": "function guardFields() {}\n", "a.jsx": "export const guardFields = 1;\n",
  "a.mjs": "export const guardFields = 1;\n", "a.cjs": "module.exports.guardFields = 1;\n", "a.py": "def guardFields():\n    pass\n",
  "a.md": "## guardFields\n", "a.markdown": "The guardFields function.\n", "a.html": "<code>guardFields</code>\n",
  "a.json": "{ \"guardFields\": true }\n", "a.yml": "guardFields: true\n", "a.yaml": "- guardFields\n", "a.toml": "guardFields = true\n",
  "a.go": "func guardFields() {}\n", "a.rs": "fn guardFields() {}\n", "a.java": "void guardFields() {}\n", "a.rb": "def guardFields; end\n",
  "a.php": "<?php function guardFields() {}\n", "a.sql": "select guardFields from t;\n", "a.sh": "guardFields() { :; }\n",
  "a.css": ".guardFields { color: red; }\n", "a.scss": ".guardFields { b: c; }\n",
};

test("every language the table knows: a name only in a comment is absent, in code it is present", () => {
  assert.deepEqual(Object.keys(ONLY_IN_COMMENT).map((f) => f.slice(2)).sort(), [...COMMENT_AWARE_EXTENSIONS].sort(),
    "one case per extension the table knows, no more and no fewer");
  for (const [path, text] of Object.entries(ONLY_IN_COMMENT)) {
    assert.equal(symbolPresent(text, "guardFields"), true, `${path}: the control, the text reading sees the name`);
    assert.equal(symbolPresent(text, "guardFields", path), false, `${path}: outside its comments, the name is absent`);
    const kept = withoutComments(text, path);
    assert.equal(kept.length, text.length, `${path}: comments become spaces, nothing is removed`);
    assert.equal(kept.split("\n").length, text.split("\n").length, `${path}: every line keeps its number`);
  }
  for (const [path, text] of Object.entries(IN_CODE)) assert.equal(symbolPresent(text, "guardFields", path), true, `${path}: in code, present`);
});

test("a comment marker inside a string opens nothing, and a string inside a comment counts for nothing", () => {
  const present = (path, text) => symbolPresent(text, "guardFields", path);
  assert.ok(present("a.ts", 'const u = "https://example.com"; guardFields();\n'), "a URL in a string is not a line comment");
  assert.ok(present("a.ts", "const s = '/*'; guardFields(); const t = '*/';\n"), "a block opener in a string is not one");
  assert.ok(present("a.ts", "const t = `// ${a} /* ${b} */`; guardFields();\n"), "nor in a template literal");
  assert.ok(present("a.ts", "const r = /\\/\\*[^]*?\\*\\//g; guardFields();\n"), "nor in a regular expression");
  assert.ok(present("a.ts", "if (x) return /[/*]/.test(y); guardFields();\n"), "nor in a character class after `return`");
  assert.ok(present("a.ts", "const n = a / b; guardFields(); // tail\n"), "a division is not a regular expression");
  assert.ok(!present("a.ts", "f(`${a /* guardFields */}`);\n"), "a comment inside a template's ${} is a comment");
  assert.ok(present("a.py", "s = '#'; guardFields()\n"), "Python: a # in a string");
  assert.ok(present("a.sql", "select 'a--b', guardFields from t;\n"), "SQL: -- in a string");
  assert.ok(present("a.sh", 'echo "#" ${#x} $# a#b; guardFields\n'), "shell: # inside a word or a string opens nothing");
  assert.ok(present("a.yml", "a: 'it''s # here' \nb: guardFields\n"), "YAML: # in a quoted scalar");
  assert.ok(!present("a.yml", "d: don't # guardFields\n"), "YAML: an apostrophe in a plain scalar opens no string");
  assert.ok(present("a.yml", "run: |\n  echo # guardFields\n"), "YAML: the lines of a block scalar are a string");
  assert.ok(present("a.md", "`<!--` then guardFields\n"), "Markdown: <!-- in a code span opens nothing");
  assert.ok(present("a.md", "```\n<!-- guardFields -->\n```\n"), "Markdown: nor in a fenced block");
  assert.ok(present("a.md", "<!-- never closed guardFields\n"), "markup: an unterminated <!-- is text");
  assert.ok(present("a.rs", "fn f<'a>(s: &'a str) -> char { let c = '\\''; let r = r#\"// not\"#; guardFields(); c }\n"), "Rust: lifetimes, a char and a raw string");
  assert.ok(present("a.go", "s := `// raw`; guardFields()\n"), "Go: a raw string");
  assert.ok(present("a.php", "#[Attribute] function guardFields() {}\n"), "PHP: #[ is an attribute");
  assert.ok(!present("a.ts", "const s = 'x'; // 'guardFields'\n"), "a quoted name inside a comment is still a comment");
});

test("decided: a name in a string literal still counts, and a file of another language is read whole", () => {
  // Strings are code: a route, a rule id, a config key. `file:eslint.config.js#no-restricted-imports`
  // in runward's own architecture note cites a name that lives only in strings, and it stays green.
  assert.ok(symbolPresent('logger.warn("guardFields failed");\n', "guardFields", "a.ts"), "a string literal is code");
  assert.ok(symbolPresent('rules: { "no-restricted-imports": "off" },\n', "no-restricted-imports", "eslint.config.js"));
  assert.ok(symbolPresent('def f():\n    """guardFields was the old name"""\n', "guardFields", "a.py"), "a docstring is a string (a declared residual)");
  // A symbol that is not an identifier names no code: the textual reading, comments included.
  assert.ok(symbolPresent("// the guard fails closed\nexport const g = 1;\n", "the guard fails closed", "a.ts"), "a quoted sentence in a comment still counts");
  assert.ok(symbolPresent("# retry.max is three\n", "retry.max", "a.py"), "so does a dotted name");
  // Outside the table, nothing is removed: the reading before ADR-0114.
  for (const path of ["Makefile", "notes.txt", "a.kt", "Dockerfile"]) {
    assert.ok(symbolPresent("# guardFields\n// guardFields\n", "guardFields", path), `${path}: read whole`);
    assert.equal(withoutComments("// x\n", path), "// x\n");
  }
  assert.ok(!symbolPresent("// guardFields\n", "guardFields", "A.TS"), "the extension is read case-insensitively");
});

test("spec-check and the `rules --for` reminder read the symbol the way the gate does", () => {
  const root = mkdtempSync(join(tmpdir(), "rw-comment-spec-"));
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), "export function validateFields() {}\n// guardFields was the old name\n");
    const spec = "## Acceptance criteria\n\n- AC1: the guard. Evidence: file:src/a.ts#guardFields\n- AC2: the guard. Evidence: file:src/a.ts#validateFields\n";
    const r = specConformance(spec, root);
    assert.equal(r.criteria[0].linked, false, "spec-check: the name only in a comment does not link");
    assert.match(r.criteria[0].reason, /occurs only in a comment/);
    assert.equal(r.criteria[1].linked, true, "spec-check: the control, the name in code links");
    mkdirSync(join(root, "runward"), { recursive: true });
    writeFileSync(join(root, "runward", "floor.md"), "## Rule conformance\n\n| rule | status | evidence |\n|---|---|---|\n| a-rule | applied | file:src/a.ts#guardFields |\n| b-rule | applied | file:src/a.ts#validateFields |\n");
    const c = citationsForPaths(root, ["src/a.ts"]).citations;
    assert.equal(c.find((x) => x.rule === "a-rule").resolves, false, "rules --for: the stale pointer is said not to resolve");
    assert.match(c.find((x) => x.rule === "a-rule").note, /occurs only in a comment/);
    assert.equal(c.find((x) => x.rule === "b-rule").resolves, true, "rules --for: the control resolves");
    appendFileSync(join(root, "src", "a.ts"), "export const guardFields = validateFields;\n");
    assert.equal(specConformance(spec, root).criteria[0].linked, true, "spec-check: once the name is back in code, it links");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
