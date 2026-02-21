/**
 * Thesis Drift Checker
 * Compares original vs current signals to detect thesis drift
 *
 * Usage: bun run tools/drift.ts [--json]
 */
import { parseArgs } from "util";
import { z } from "zod";
import { initDb } from "../src/storage";
import { output, table, signal as signalEmoji, formatDate } from "./lib/output";

// ============================================
// Result schema
// ============================================

const DriftSchema = z.object({
  slug: z.string(),
  question: z.string(),
  originalSignal: z.string(),
  currentSignal: z.string(),
  firstDate: z.string(),
  lastDate: z.string(),
});

const HistorySchema = z.object({
  market: z.string(),
  versions: z.number(),
  firstSignal: z.string(),
  lastSignal: z.string(),
  biasChange: z.number(),
});

const ResultSchema = z.object({
  drifts: z.array(DriftSchema),
  history: z.array(HistorySchema),
});

type ToolResult = z.infer<typeof ResultSchema>;

// ============================================
// Core logic
// ============================================

async function run(): Promise<ToolResult> {
  const db = initDb();

  // Find markets where signal changed
  const drifts = db.query(`
    SELECT
      m.slug,
      substr(m.question, 1, 50) as question,
      t1.signal as originalSignal,
      t2.signal as currentSignal,
      t1.created_at as firstDate,
      t2.created_at as lastDate
    FROM thesis_history t1
    JOIN thesis_history t2 ON t1.market_slug = t2.market_slug
    JOIN markets m ON m.slug = t1.market_slug
    WHERE t1.id = (SELECT MIN(id) FROM thesis_history WHERE market_slug = t1.market_slug)
      AND t2.id = (SELECT MAX(id) FROM thesis_history WHERE market_slug = t1.market_slug)
      AND t1.signal != t2.signal
      AND m.resolved = 0
  `).all() as Array<{
    slug: string;
    question: string;
    originalSignal: string;
    currentSignal: string;
    firstDate: number;
    lastDate: number;
  }>;

  // Get all thesis history summary
  const history = db.query(`
    SELECT
      substr(market_slug, 1, 35) as market,
      COUNT(*) as versions,
      MIN(signal) as firstSignal,
      MAX(signal) as lastSignal,
      MAX(bias_total) - MIN(bias_total) as biasChange
    FROM thesis_history
    GROUP BY market_slug
    ORDER BY versions DESC
  `).all() as Array<{
    market: string;
    versions: number;
    firstSignal: string;
    lastSignal: string;
    biasChange: number;
  }>;

  return {
    drifts: drifts.map((d) => ({
      ...d,
      firstDate: formatDate(d.firstDate),
      lastDate: formatDate(d.lastDate),
    })),
    history: history.map((h) => ({
      ...h,
      biasChange: h.biasChange || 0,
    })),
  };
}

// ============================================
// Pretty formatter
// ============================================

function formatPretty(result: ToolResult): string {
  const lines: string[] = [];

  lines.push("=== THESIS DRIFT CHECK ===");
  lines.push("");

  if (result.drifts.length === 0) {
    lines.push("No signal changes detected. All theses holding steady.");
  } else {
    lines.push("Markets where signal changed:");
    lines.push("");
    for (const d of result.drifts) {
      const orig = signalEmoji(d.originalSignal as "green" | "yellow" | "red");
      const curr = signalEmoji(d.currentSignal as "green" | "yellow" | "red");
      lines.push(`  ${d.slug}`);
      lines.push(`    ${d.question}`);
      lines.push(`    ${orig} ${d.originalSignal} -> ${curr} ${d.currentSignal}`);
      lines.push(`    ${d.firstDate} -> ${d.lastDate}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("All thesis history:");
  lines.push("");

  const tableRows = result.history.map((h) => ({
    market: h.market,
    versions: h.versions,
    first: h.firstSignal,
    last: h.lastSignal,
    "bias \u0394": h.biasChange,
  }));

  lines.push(table(tableRows));

  return lines.join("\n");
}

// ============================================
// CLI entry point
// ============================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
  },
});

const result = await run();
output(result, { json: values.json, pretty: formatPretty });
