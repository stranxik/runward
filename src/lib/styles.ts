import { release } from "node:os";
import { isatty } from "node:tty";

// The terminal's colours, written here since ADR-0129: a style is an opening and a closing ANSI
// sequence around a text, and what follows decides whether the terminal is sent any.
//
// How many colours standard output takes: 0 none, 1 the 16 basic ones, 2 the 256-colour palette,
// 3 24-bit. Decided once, when the process starts, in this order:
//   - NO_COLOR set to anything (https://no-color.org/): none;
//   - FORCE_COLOR: `0` or `false` none; a number, that level (3 at most); `true` or empty, colours
//     even when the output is not a terminal, at the level detected below (1 at least);
//   - `--no-color` before a `--`, when FORCE_COLOR says nothing readable: none. The variable wins
//     over the flag (`FORCE_COLOR=3 runward --no-color check` is coloured), as it did with the
//     dependency this replaces: kept as found, the maintainer's to decide (ADR-0129);
//   - output that is not a terminal (a pipe, a file): none;
//   - then what the terminal says of itself: TERM=dumb, the Windows build, a CI that renders
//     colours, COLORTERM, TERM_PROGRAM, TERM.
// A palette colour is sent as 24-bit at level 3, as its nearest palette entry at level 2 and as its
// nearest basic colour at level 1.
type Level = 0 | 1 | 2 | 3;

function detectLevel(env: NodeJS.ProcessEnv, argv: readonly string[], streamIsTTY: boolean, platform: string, osRelease: string): Level {
  if (env.NO_COLOR) return 0;
  const terminator = argv.indexOf("--");
  const noColorFlag = argv.indexOf("--no-color");
  let forced: Level | undefined = noColorFlag !== -1 && (terminator === -1 || noColorFlag < terminator) ? 0 : undefined;
  const force = env.FORCE_COLOR;
  const numeric = force !== undefined && /^\d+$/.test(force);
  if (force !== undefined) {
    if (force === "false") forced = 0;
    else if (force === "true" || force.length === 0) forced = 1;
    else if (numeric) forced = Math.min(Number.parseInt(force, 10), 3) as Level;
  }
  if (forced === 0) return 0;
  if (forced !== undefined && numeric) return forced;
  if ("TF_BUILD" in env && "AGENT_NAME" in env) return 1; // Azure Pipelines renders colours without a terminal
  if (!streamIsTTY && forced === undefined) return 0;
  const min: Level = forced ?? 0;
  if (env.TERM === "dumb") return min;
  if (platform === "win32") {
    // Windows 10 build 10586 is the first with 256 colours, build 14931 the first with 24-bit.
    const [major, , build] = osRelease.split(".").map(Number);
    if (major >= 10 && build >= 10586) return build >= 14931 ? 3 : 2;
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((k) => k in env)) return 3;
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((k) => k in env) || env.CI_NAME === "codeship") return 1;
    return min;
  }
  if (env.TEAMCITY_VERSION !== undefined) return /^(?:9\.0*[1-9]\d*\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  if (env.COLORTERM === "truecolor") return 3;
  if (env.TERM === "xterm-kitty" || env.TERM === "xterm-ghostty" || env.TERM === "wezterm") return 3;
  if (env.TERM_PROGRAM === "iTerm.app") return Number.parseInt((env.TERM_PROGRAM_VERSION ?? "").split(".", 1)[0], 10) >= 3 ? 3 : 2;
  if (env.TERM_PROGRAM === "Apple_Terminal") return 2;
  const term = env.TERM ?? "";
  if (/-256(?:color)?$/i.test(term)) return 2;
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(term)) return 1;
  if ("COLORTERM" in env) return 1;
  return min;
}

interface Style { open: string; close: string }
export type Painter = (...text: unknown[]) => string;

const sgr = (open: number | string, close: number): Style => ({ open: `\u001B[${open}m`, close: `\u001B[${close}m` });

/** The nearest entry of the 256-colour palette: its grey ramp for a grey, its 6×6×6 cube otherwise. */
function rgbToAnsi256(r: number, g: number, b: number): number {
  if (r === g && g === b) return r < 8 ? 16 : r > 248 ? 231 : Math.round(((r - 8) / 247) * 24) + 232;
  return 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
}

/** The nearest of the 16 basic colours (30-37, 90-97) for a palette entry of 16 and above. */
function ansi256ToAnsi(code: number): number {
  let r: number, g: number, b: number;
  if (code >= 232) r = g = b = ((code - 232) * 10 + 8) / 255;
  else {
    const c = code - 16;
    r = Math.floor(c / 36) / 5;
    g = Math.floor((c % 36) / 6) / 5;
    b = (c % 6) / 5;
  }
  const value = Math.max(r, g, b) * 2;
  if (value === 0) return 30;
  const basic = 30 + ((Math.round(b) << 2) | (Math.round(g) << 1) | Math.round(r));
  return value === 2 ? basic + 60 : basic;
}

function hex(level: Level, color: string): Style {
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  if (level === 3) return sgr(`38;2;${r};${g};${b}`, 39);
  if (level === 2) return sgr(`38;5;${rgbToAnsi256(r, g, b)}`, 39);
  return sgr(ansi256ToAnsi(rgbToAnsi256(r, g, b)), 39);
}

/**
 * A painter for a stack of styles, outermost first. Three things a bare "open + text + close" gets
 * wrong, each visible on a real screen:
 *   - a text that already carries a style's closing sequence (a painted word inside a painted
 *     sentence) would end the outer style there: the style is reopened after each one;
 *   - a style left open across a line break bleeds into the next line's padding on some terminals:
 *     it is closed before each break and reopened after;
 *   - an empty text gets no sequences at all.
 * With colours off the text is returned as it is, so a piped output carries no escape sequence.
 */
function painter(level: Level, styles: Style[]): Painter {
  const openAll = styles.map((s) => s.open).join("");
  const closeAll = [...styles].reverse().map((s) => s.close).join("");
  return (...text: unknown[]): string => {
    let out = text.length === 1 ? String(text[0]) : text.join(" ");
    if (level === 0 || !out) return out;
    if (out.includes("\u001B")) {
      for (const s of [...styles].reverse()) out = out.split(s.close).join(s.close + s.open);
    }
    if (out.includes("\n")) out = out.replace(/\r?\n/g, (lf) => closeAll + lf + openAll);
    return openAll + out + closeAll;
  };
}

// Runward palette — mineral gold, the house identity (the maintainer's call, 2026-09-09).
// The electric indigo this file carried was the one hue the brand's own design contract bans
// outright; the terminal now speaks the same warm mineral language as everything published.
export const colors = {
  primary: "#C9A45C",      // mineral gold, readable on dark bg — the house accent, owned here
  primaryLight: "#E0C285", // highlights, current step
  primaryDark: "#A8853F",  // borders, secondary accents
  secondary: "#B0B8C4",
  gray: "#8B95A5",
  darkGray: "#5A6577",
} as const;

/** The painters for a given level: `c` is this for the level detected at start; the tests build the others. */
export function paletteFor(level: Level) {
  const bold = sgr(1, 22);
  const p = (...styles: Style[]): Painter => painter(level, styles);
  return {
    primary: p(hex(level, colors.primary)),
    primaryLight: p(hex(level, colors.primaryLight)),
    primaryDark: p(hex(level, colors.primaryDark)),
    secondary: p(hex(level, colors.secondary)),
    gray: p(hex(level, colors.gray)),
    darkGray: p(hex(level, colors.darkGray)),
    bold: p(bold),
    dim: p(sgr(2, 22)),
    white: p(sgr(37, 39)),
    primaryBold: p(hex(level, colors.primary), bold),
    success: p(sgr(32, 39)),
    error: p(sgr(31, 39)),
    warning: p(sgr(33, 39)),
    info: p(sgr(36, 39)),
    muted: p(hex(level, colors.gray)),
  } as const;
}

/** Exported for the tests: the level a given environment, argument list and stream would get. */
export const colorLevel = detectLevel;

export const c = paletteFor(detectLevel(process.env, process.argv, isatty(1), process.platform, release()));

export const status = {
  success: (msg: string) => c.success("✓ ") + c.white(msg),
  error: (msg: string) => c.error("✗ ") + c.white(msg),
  warning: (msg: string) => c.warning("! ") + c.white(msg),
  info: (msg: string) => c.info("• ") + c.white(msg),
  skip: (msg: string) => c.darkGray("○ ") + c.gray(msg),
} as const;

export function createHeader(title: string, subtitle?: string): string {
  const width = Math.min(process.stdout.columns || 80, 72);
  const inner = width - 4;
  const pad = (s: string) => s + " ".repeat(Math.max(0, inner - stripAnsi(s).length));
  const lines = [
    c.primaryDark("┌" + "─".repeat(width - 2) + "┐"),
    c.primaryDark("│ ") + pad(c.primaryBold(title)) + c.primaryDark(" │"),
  ];
  if (subtitle) lines.push(c.primaryDark("│ ") + pad(c.gray(subtitle)) + c.primaryDark(" │"));
  lines.push(c.primaryDark("└" + "─".repeat(width - 2) + "┘"));
  return "\n" + lines.join("\n") + "\n";
}

export function section(title: string): string {
  return "\n" + c.primaryBold(title) + "\n" + c.darkGray("─".repeat(Math.min(title.length + 8, 60)));
}

export function isNonInteractive(): boolean {
  // An autonomous agent must never hang on a prompt it cannot answer (ADR-0030). Beyond the
  // explicit --yes, treat as non-interactive when CI is set or either standard stream is not a
  // TTY: a prompt reads stdin, so a non-TTY stdin (piped, or none) cannot answer it.
  if (process.env.RUNWARD_YES === "1") return true;
  const ci = process.env.CI;
  if (ci && ci !== "0" && ci.toLowerCase() !== "false") return true;
  return !process.stdout.isTTY || !process.stdin.isTTY;
}

/** Today (UTC, YYYY-MM-DD), or the RUNWARD_NOW override in non-interactive runs. The override is
 *  VALIDATED as a real YYYY-MM-DD date: an unvalidated value flowed straight into the OSCAL and the
 *  seal, so a malformed env var produced schema-invalid output. A bad value falls back to today. */
export function generationDate(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!isNonInteractive()) return today;
  const override = process.env.RUNWARD_NOW;
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) return today;
    const d = new Date(override + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === override ? override : today;
  }
  // SOURCE_DATE_EPOCH is the reproducible-builds convention, and it reached only `--vsa`. Measured
  // 2026-08-26: the evidence lock's `sealedAt` and the OSCAL pack's `last-modified` both carry a
  // wall clock and both ignored it, while docs/interop.md called the VSA "the ONE runward emission
  // that is not byte-idempotent by default". Two claims wrong in one sentence — the set was larger,
  // and the variable that pinned the rest was RUNWARD_NOW, which that document never names. One
  // convention now reaches every clock runward writes. RUNWARD_NOW still wins: it is the explicit
  // per-run override, SOURCE_DATE_EPOCH the ambient build-wide one.
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) {
    const d = new Date(Number(epoch) * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return today;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, "");
}
