/**
 * The analysis policies the built-in analyzers read (ADR-0118), as data.
 *
 * A mission opts in by pinning one policy id in `runward/scaffold-lock.json` (`"analysis":
 * "runward-analysis/1"`). The pin is what keeps a verdict from moving between two runward versions
 * without a gesture of the mission: an entry below is never edited once released. A change to what a
 * policy refuses (a new family, a wider pattern, a narrower exclusion) is a NEW id beside the old one,
 * and a mission moves to it by changing its pin, in a diff a reviewer reads. A defect in the reading
 * itself (the code in analyze.ts) is fixed like any verdict defect: filed, and named in the changelog.
 *
 * What a policy holds: which files are read, which are set aside and why, the module classes the
 * families judge, the secret formats, and the conventions that say a file is a test. Nothing here is
 * inferred from a project; every item is a fixed declaration a reader can check against the tree.
 */

export interface SecretFormat {
  /** Stable id, part of the finding's check id (`secret-<id>`). */
  id: string;
  /** What the format is, in the words a finding prints. Never the value. */
  label: string;
  /** Regular-expression source, matched against the raw text of a file (comments and strings
   *  included: a key in a comment is still a key in the repository). Bounded quantifiers only. */
  pattern: string;
  /** Fixed text every match contains. A file holding none of them is not searched for this format:
   *  a speed-up that cannot change a result. */
  needles: readonly string[];
  /** A match that also matches this source is a documented example, not a credential. */
  example?: string;
}

export interface AnalysisPolicy {
  id: string;
  /** Extensions the families read as JavaScript or TypeScript source. */
  analysedExtensions: readonly string[];
  /** Extensions of other languages: counted under `notAnalyzed`, never judged. */
  otherLanguages: Readonly<Record<string, string>>;
  /** Extensions read for secrets only (configuration text). */
  configExtensions: readonly string[];
  /** File names never read: lock files hold integrity hashes and registry URLs, not code. */
  skippedFileNames: readonly string[];
  /** A file above this size is counted under `notAnalyzed`, never read. */
  maxFileBytes: number;
  /** Directory names set aside at any depth: installed dependencies and version-control metadata. */
  excludedDirectories: readonly string[];
  /** Directory names set aside only at the project root or beside a `package.json`: build output.
   *  Anywhere else (a `src/build/` directory) they are read like any directory. */
  buildOutputDirectories: readonly string[];
  /** A file is a test when its name matches one of these (basename), when it sits under a directory
   *  named in `testDirectories`, or under `__tests__`. The conventions of node:test, Jest and Vitest. */
  testFileNames: readonly string[];
  testDirectories: readonly string[];
  /** Imports that are the test framework, not the code under test. A browser or HTTP driver
   *  (Playwright, supertest) is not one: it reaches the delivery. */
  testFrameworkModules: readonly string[];
  /** Node.js built-in modules. In the domain core, every one is refused unless the mission
   *  allows it; these two lists name the ones that are a capability wherever they are imported. */
  builtinModules: readonly string[];
  processExecutionModules: readonly string[];
  codeExecutionModules: readonly string[];
  /** Refused in the domain core as the `network` capability. */
  networkModules: readonly string[];
  secretFormats: readonly SecretFormat[];
  /** Hosts whose credentials in a URL are a local or documentation placeholder. */
  placeholderHosts: readonly string[];
}

export const DEFAULT_ANALYSIS_POLICY = "runward-analysis/1";

const POLICY_1: AnalysisPolicy = {
  id: "runward-analysis/1",
  analysedExtensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
  otherLanguages: {
    ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin",
    ".scala": "Scala", ".rb": "Ruby", ".php": "PHP", ".cs": "C#", ".fs": "F#", ".swift": "Swift",
    ".c": "C", ".h": "C", ".cc": "C++", ".cpp": "C++", ".hpp": "C++", ".m": "Objective-C",
    ".ex": "Elixir", ".exs": "Elixir", ".clj": "Clojure", ".dart": "Dart", ".lua": "Lua",
    ".sh": "shell", ".vue": "Vue component", ".svelte": "Svelte component",
  },
  configExtensions: [".json", ".jsonc", ".yml", ".yaml", ".toml", ".ini", ".properties", ".cfg", ".conf", ".xml"],
  skippedFileNames: ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock"],
  maxFileBytes: 1_000_000,
  excludedDirectories: ["node_modules", ".git", ".hg", ".svn"],
  buildOutputDirectories: ["dist", "build", "out", "coverage", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
    ".parcel-cache", ".output", ".vercel", ".stryker-tmp", "storybook-static"],
  testFileNames: [
    "^.+[._-](?:test|spec)\\.[cm]?[jt]sx?$",
    "^(?:test|spec)\\.[cm]?[jt]sx?$",
    "^test-.+\\.[cm]?[jt]sx?$",
  ],
  testDirectories: ["test", "tests", "__tests__"],
  testFrameworkModules: ["node:test", "test", "node:assert", "node:assert/strict", "assert", "assert/strict",
    "vitest", "jest", "@jest/globals", "mocha", "chai", "ava", "tap", "uvu", "uvu/assert", "expect"],
  builtinModules: ["assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto",
    "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http", "http2", "https", "inspector", "module",
    "net", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "sqlite", "stream",
    "string_decoder", "sys", "test", "timers", "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi",
    "worker_threads", "zlib"],
  processExecutionModules: ["child_process"],
  codeExecutionModules: ["vm"],
  networkModules: ["http", "https", "http2", "net", "tls", "dgram", "dns"],
  secretFormats: [
    { id: "model-api-key", needles: ["sk-"], label: "model provider API key (sk-live/sk-proj/sk-ant/sk-svcacct/sk-admin)",
      pattern: "\\bsk-(?:live|proj|ant|svcacct|admin)-[A-Za-z0-9_-]{20,200}" },
    { id: "openai-legacy-key", needles: ["T3BlbkFJ"], label: "model provider API key (legacy format)",
      pattern: "\\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\\b" },
    { id: "stripe-live-key", needles: ["k_live_"], label: "payment provider live key (sk_live/rk_live)",
      pattern: "\\b[sr]k_live_[0-9a-zA-Z]{20,200}" },
    { id: "aws-access-key", needles: ["AKIA", "ASIA"], label: "cloud access key id (AKIA/ASIA)",
      pattern: "\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b", example: "EXAMPLE$" },
    { id: "github-token", needles: ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"], label: "forge token (ghp_/gho_/ghu_/ghs_/ghr_)",
      pattern: "\\bgh[pousr]_[A-Za-z0-9]{36,255}\\b" },
    { id: "github-fine-grained-token", needles: ["github_pat_"], label: "forge fine-grained token (github_pat_)",
      pattern: "\\bgithub_pat_[A-Za-z0-9_]{60,255}\\b" },
    { id: "slack-token", needles: ["xox"], label: "chat workspace token (xoxb/xoxa/xoxp/xoxr/xoxs)",
      pattern: "\\bxox[abprs]-[A-Za-z0-9-]{10,250}" },
    { id: "npm-token", needles: ["npm_"], label: "package registry token (npm_)",
      pattern: "\\bnpm_[A-Za-z0-9]{36}\\b" },
    { id: "google-api-key", needles: ["AIza"], label: "cloud API key (AIza)",
      pattern: "\\bAIza[0-9A-Za-z_-]{35}\\b" },
    { id: "private-key-block", needles: ["PRIVATE KEY"], label: "PEM private key block",
      pattern: "-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----" },
    { id: "url-credentials", needles: ["://"], label: "URL with an embedded user name and password",
      pattern: "\\b[a-z][a-z0-9+.-]{1,20}://[^\\s:@/\"'`<>]{1,64}:[^\\s@/\"'`<>]{1,128}@[^\\s/\"'`<>:]{1,253}" },
  ],
  placeholderHosts: ["localhost", "127.0.0.1", "0.0.0.0", "::1", "example.com", "example.org", "example.net"],
};

/** Every policy this version ships, by id. Frozen: an entry is never edited once released. */
export const ANALYSIS_POLICIES: Readonly<Record<string, AnalysisPolicy>> = Object.freeze({
  [POLICY_1.id]: Object.freeze(POLICY_1),
});
