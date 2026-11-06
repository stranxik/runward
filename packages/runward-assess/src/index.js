// runward-assess: the repeatable assessment grid, as a library. The CLI is bin/runward-assess.js.
export { score, recordText, CoverageError, InputError, resolveProfile, regressions, isoSeconds } from "./score.js";
export { evaluate, lookup } from "./predicates.js";
export { canonJSON, canonValue, isCanonical, sha256, cmp, ratio } from "./canon.js";
export { loadGrid, gridProblems, lockFor, normativeDigest, TOOL } from "./grid.js";
export { reportMarkdown } from "./report-md.js";
export { reportHtml } from "./report-html.js";
export { evolution, evolutionMarkdown, evolutionHtml } from "./diff.js";
