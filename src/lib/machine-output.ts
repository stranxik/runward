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

/**
 * ADR-0083 option A: exit 2 keeps its value for every case, and a machine run is told WHICH case it
 * was. `error` is additive (ADR-0030): it sits beside the `verdict`/`reason` a document already
 * carried, which keep their values. Four classes, the reader's next move for each:
 *   no-mission        run `runward init` (or point -p at the mission)
 *   usage             the invocation is wrong: a flag, a value, a missing argument
 *   refused           a gesture runward will not perform here (no terminal, an agent, an overwrite)
 *   unreadable-input  a file the command was given cannot be read as what it must be
 * Never a red gate: a red gate is exit 1 and a verdict, and carries no `error`.
 */
export const ERROR_CLASSES = ["no-mission", "usage", "refused", "unreadable-input"] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** The error document of a machine run that exits 2: the class, the sentence stderr carries, the code. */
export function errorPayload(version: string, error: ErrorClass, message: string): { runward: string; error: ErrorClass; message: string; exitCode: 2 } {
  return { runward: version, error, message, exitCode: 2 };
}

/** The shape `check --json` already publishes when no mission is found: same keys, same meaning,
 *  plus the additive `error` class (ADR-0083). */
export function noMissionPayload(version: string): { runward: string; mission: null; verdict: "no-mission"; error: "no-mission"; exitCode: 2 } {
  return { runward: version, mission: null, verdict: "no-mission", error: "no-mission", exitCode: 2 };
}
