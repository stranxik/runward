// Every gate adapter `init` writes runs the runward version that wrote it (TOR-249).
//
// The adapters under templates/adapters/ used to call a bare `runward` (whatever global binary the
// machine had) or an unpinned `npx --yes runward`. Measured on main dbcbc7a: the same tree exits 0
// under runward 0.31.0 and 1 under 0.44.0, so a pre-commit hook's verdict depended on which binary
// happened to be installed, not on the mission. The templates now carry a placeholder, and `init`
// and `update` stamp it at write time, so the published templates cite no version (the
// template-version-pin net stays exact) and every written copy names the release that wrote it.
import { VERSION } from "./paths.js";

/** The token every adapter template carries where the runward version goes. */
export const ADAPTER_VERSION_PLACEHOLDER = "{{RUNWARD_VERSION}}";

/** The adapter text as `init`/`update` write it: the placeholder replaced by `version`. */
export function stampAdapterVersion(text: string, version: string = VERSION): string {
  return text.split(ADAPTER_VERSION_PLACEHOLDER).join(version);
}

const EXACT = /^(?:\d+\.\d+\.\d+|\{\{RUNWARD_VERSION\}\})$/;

/** The commands an adapter text runs. JSON adapters: the values of their `command`, `bash` and
 *  `powershell` keys (the `"//"` prose beside them runs nothing). Every other adapter: its lines
 *  without `#` comments. */
function commandsOf(text: string): string[] {
  try {
    const out: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (typeof x === "string" && (k === "command" || k === "bash" || k === "powershell")) out.push(x);
          else walk(x);
        }
      }
    };
    walk(JSON.parse(text));
    return out;
  } catch {
    return text.split("\n").filter((l) => !/^\s*#/.test(l));
  }
}

/** Every runward invocation in an adapter text that does not name an exact version: a bare
 *  `runward <cmd>` (whatever binary PATH resolves, a global of any age), `command -v runward`, an
 *  unpinned `npx runward`, or `runward@latest|next`. `runward@$RUNWARD_VERSION` is pinned only when
 *  every assignment of RUNWARD_VERSION in the text is an exact version (or the placeholder `init`
 *  stamps). Exported so one definition holds the templates, the stamped copies, the packaged hooks
 *  and the wire entries. */
export function unpinnedInvocations(text: string): string[] {
  // An assignment that reads another variable (`$(RUNWARD_VERSION)`, `${RUNWARD_VERSION:-…}`) is
  // an indirection, not a value: its default is matched on its own.
  const assigned = [...text.matchAll(/RUNWARD_VERSION(?::-|:\s*|=)"?([^"\s}$]+(?:\}\})?)/g)].map((m) => m[1]);
  const varPinned = assigned.length > 0 && assigned.every((v) => EXACT.test(v));
  const out: string[] = [];
  for (const cmd of commandsOf(text)) {
    // No quantified group holding a quantifier (eslint-plugin-security's unsafe-regex): the version
    // is read from the matched token in code.
    for (const m of cmd.matchAll(/\bnpx\s+(?:--yes|-y)?\s*"?runward[^\s"']*/g)) {
      const tail = m[0].slice(m[0].lastIndexOf("runward") + "runward".length);
      const v = tail.startsWith("@") ? tail.slice(1) : undefined;
      const ok = v !== undefined && (EXACT.test(v) || (/^\$\{?RUNWARD_VERSION\}?$/.test(v) && varPinned));
      if (!ok) out.push(m[0].trim());
    }
    // A bare `runward <cmd>` in COMMAND position (line start, a YAML `- ` or `run:`, after a shell
    // separator or `then`/`else`/`exec`): whatever PATH resolves. In a message or a step name the
    // same words run nothing.
    for (const m of cmd.matchAll(/(?:^\s*-?\s*(?:run:)?\s*|(?:;|&&|\|\||\||\(|\bthen|\belse|\bdo|\bexec)\s*)(runward\s+(?:check|gate-hook|report|verify|init|update))\b/g)) out.push(m[1]);
    if (/command\s+-v\s+runward\b/.test(cmd)) out.push("command -v runward");
  }
  return out;
}
