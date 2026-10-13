// runward-forge: the forge adapters behind one port (ADR-0094). This package imports nothing from
// `runward`; it reads the files `runward` writes. The `runward` package imports nothing from it and
// opens no connection (test/unit/forge-boundary.test.js).
import * as github from "./github.js";
import * as gitlab from "./gitlab.js";
import { assertImplementsPort } from "./port.js";

export { PORT_FUNCTIONS, SUMMARY_MARKER } from "./port.js";

export const ADAPTERS = Object.freeze({
  github: assertImplementsPort("github", github),
  gitlab: assertImplementsPort("gitlab", gitlab),
});

/** The forge this process runs in, from the CI's own marker variable, or null. */
export function detectForge(env = process.env) {
  if (env.GITLAB_CI === "true") return "gitlab";
  if (env.GITHUB_ACTIONS === "true") return "github";
  return null;
}
