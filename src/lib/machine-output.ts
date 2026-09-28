// The `--json` plumbing the read commands share (ADR-0030: one document on stdout, nothing else).
//
// `check --json` set the rule: in a machine run every human line is suppressed and the sole output is
// the payload. `status`, `doctor`, `manifest`, `propose`, `report` and `compliance` follow it with the
// same two gestures, written once here: a logger that is silent under `--json`, and the emission.

/** `console.log` for a human run, a no-op for a machine run: prose never interleaves the document. */
export function humanLog(json: boolean | undefined): (...args: unknown[]) => void {
  return json ? () => {} : (...args: unknown[]) => console.log(...args);
}

/** The one document of a machine run, on stdout, newline-terminated. */
export function emitJson(doc: unknown): void {
  process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
}

/** The shape `check --json` already publishes when no mission is found: same keys, same meaning. */
export function noMissionPayload(version: string): { runward: string; mission: null; verdict: "no-mission"; exitCode: 2 } {
  return { runward: version, mission: null, verdict: "no-mission", exitCode: 2 };
}
