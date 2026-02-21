/**
 * Output helpers for CLI tools
 * Supports both pretty (human) and JSON (AI) output modes
 */

export interface OutputOptions<T> {
  json: boolean;
  pretty: (result: T) => string;
}

export function output<T>(result: T, opts: OutputOptions<T>): void {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(opts.pretty(result));
  }
}

/** Visual progress bar */
export function bar(value: number, max: number = 100, width: number = 10): string {
  const clamped = Math.max(0, Math.min(value, max));
  const filled = Math.round((clamped / max) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

/** Signal emoji */
export function signal(s: "green" | "yellow" | "red"): string {
  const map = { green: "\u{1F7E2}", yellow: "\u{1F7E1}", red: "\u{1F534}" };
  return map[s];
}

/** Sentiment emoji based on Fear & Greed value */
export function sentiment(value: number): { emoji: string; signal: string } {
  if (value <= 25) return { emoji: "\u{1F631}", signal: "EXTREME FEAR - BUY ZONE (contrarian)" };
  if (value <= 45) return { emoji: "\u{1F61F}", signal: "Fear - accumulate" };
  if (value <= 55) return { emoji: "\u{1F610}", signal: "Neutral" };
  if (value <= 75) return { emoji: "\u{1F60A}", signal: "Greed - caution" };
  return { emoji: "\u{1F911}", signal: "EXTREME GREED - SELL ZONE (contrarian)" };
}

/** Format unix timestamp to date string */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/** Simple table formatter */
export function table(
  rows: Record<string, unknown>[],
  columns?: string[]
): string {
  if (rows.length === 0) return "(no data)";

  const cols = columns || Object.keys(rows[0]);
  const widths: Record<string, number> = {};

  // Calculate column widths
  for (const col of cols) {
    widths[col] = col.length;
    for (const row of rows) {
      const val = String(row[col] ?? "");
      widths[col] = Math.max(widths[col], val.length);
    }
  }

  // Header
  const header = cols.map((c) => c.padEnd(widths[c])).join("  ");
  const separator = cols.map((c) => "-".repeat(widths[c])).join("  ");

  // Rows
  const body = rows
    .map((row) =>
      cols.map((c) => String(row[c] ?? "").padEnd(widths[c])).join("  ")
    )
    .join("\n");

  return `${header}\n${separator}\n${body}`;
}
