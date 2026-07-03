import chalk from "chalk";

// Respect the NO_COLOR standard (https://no-color.org/)
if (process.env.NO_COLOR) chalk.level = 0;

// Runward palette — electric indigo, tuned for dark terminals.
export const colors = {
  primary: "#7B74FF",      // electric indigo, readable on dark bg
  primaryLight: "#A8A3FF", // highlights, current step
  primaryDark: "#5B54F0",  // borders, secondary accents
  secondary: "#B0B8C4",
  gray: "#8B95A5",
  darkGray: "#5A6577",
} as const;

export const c = {
  primary: chalk.hex(colors.primary),
  primaryLight: chalk.hex(colors.primaryLight),
  primaryDark: chalk.hex(colors.primaryDark),
  secondary: chalk.hex(colors.secondary),
  gray: chalk.hex(colors.gray),
  darkGray: chalk.hex(colors.darkGray),
  bold: chalk.bold,
  dim: chalk.dim,
  white: chalk.white,
  primaryBold: chalk.hex(colors.primary).bold,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  muted: chalk.hex(colors.gray),
} as const;

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
  return process.env.RUNWARD_YES === "1" || !process.stdout.isTTY;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, "");
}
