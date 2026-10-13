// The forge port (ADR-0094 decision 2), written once.
//
// Everything that talks to a forge sits behind these functions, in this package, outside the
// `runward` package and therefore outside the verdict's import closure (ADR-0054, ADR-0094 decision
// 4). An adapter implements every function; the boundary test checks that each adapter exports the
// whole port, so a forge cannot ship half of it silently.
//
//   readChangeFacts(change)        -> Facts | Refusal      evidence: fails closed (D5 ships the readers)
//   postSummary(markdown, ctx)     -> Posted | NotPosted   convenience: never fails the job
//   setExternalStatus(verdict, ref)-> Refusal              claim: fails closed, needs a customer policy
//   identifyChange(commitMessage)  -> { forge, id } | null pure, no I/O
//   renderPath(path, ctx)          -> string | null        pure, no I/O: a link to a file at a ref
//
// The closed behaviours (ADR-0094 decision 3), one per failure. The summary is a convenience, so a
// failure to post it is said and the caller exits 0: the summary stays an artifact. Facts and status
// are evidence or claims, so every failure is a named refusal. No adapter turns a forge error into a
// green: a refusal carries `ok: false`, always.

export const PORT_FUNCTIONS = Object.freeze(["readChangeFacts", "postSummary", "setExternalStatus", "identifyChange", "renderPath"]);

/** The marker that identifies the one summary note runward-forge creates, then updates in place. */
export const SUMMARY_MARKER = "<!-- runward-forge:summary -->";

/** A summary that was posted. */
export function posted(where, detail = {}) {
  return { ok: true, posted: true, where, ...detail, message: `summary posted: ${where}` };
}

/** A summary that was not posted. `ok` stays true: a missing summary never fails the job (decision 3). */
export function notPosted(reason, detail = {}) {
  return { ok: true, posted: false, reason, ...detail, message: `summary not posted: ${reason}` };
}

/** A refusal: evidence or a claim that could not be produced. `ok` is false, never anything else. */
export function refusal(reason, detail = {}) {
  return { ok: false, refused: true, reason, ...detail, message: `refused: ${reason}` };
}

/** The adapter's `setExternalStatus`, shared: in this delivery no customer policy reader exists, so
 *  every call is the "customer policy absent" row of decision 3. A pass or fail is the customer's
 *  mapping (ADR-0093 decision 9), never runward's; without it the poster refuses. */
export function refuseExternalStatusWithoutPolicy(forge) {
  return refusal("no customer policy maps the verdict to a status (ADR-0093 decision 9); nothing was set", { forge });
}

/** The adapter's `readChangeFacts`, shared until D5 ships the fact readers: a named refusal, never an
 *  empty Facts object an independence rule could read as "no approval needed". */
export function refuseFactsNotShipped(forge) {
  return refusal("the change-fact reader ships in D5 (ADR-0093); no facts were read", { forge });
}

/** Assert that an adapter implements the whole port (used by the tests and by `index.js`). */
export function assertImplementsPort(name, adapter) {
  for (const fn of PORT_FUNCTIONS) {
    if (typeof adapter[fn] !== "function") throw new Error(`forge adapter ${name} does not implement ${fn}`);
  }
  return adapter;
}
