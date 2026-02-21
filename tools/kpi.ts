/**
 * KPI Tracker
 * Records and views KPIs (Fear & Greed, BTC price) for historical tracking
 *
 * Usage:
 *   bun run tools/kpi.ts --record [--json]   # Record current values
 *   bun run tools/kpi.ts --view [--json]     # View history
 */
import { parseArgs } from "util";
import { z } from "zod";
import { initDb } from "../src/storage";
import { output, table, formatDate } from "./lib/output";
import {
  fetchAndValidate,
  FearGreedResponse,
  CoinGeckoPriceResponse,
} from "./lib/schemas";

// ============================================
// Result schemas
// ============================================

const RecordedKpi = z.object({
  name: z.string(),
  value: z.number(),
  classification: z.string().nullable(),
});

const HistoryEntry = z.object({
  name: z.string(),
  value: z.number(),
  classification: z.string().nullable(),
  date: z.string(),
});

const ResultSchema = z.object({
  mode: z.enum(["record", "view"]),
  recorded: z.array(RecordedKpi).optional(),
  history: z.array(HistoryEntry).optional(),
});

type ToolResult = z.infer<typeof ResultSchema>;

// ============================================
// Core logic
// ============================================

async function record(): Promise<ToolResult> {
  const db = initDb();
  const now = Math.floor(Date.now() / 1000);
  const recorded: Array<{ name: string; value: number; classification: string | null }> = [];

  // Fear & Greed Index
  try {
    const fng = await fetchAndValidate(
      "https://api.alternative.me/fng/?limit=1",
      FearGreedResponse
    );
    const value = parseInt(fng.data[0].value, 10);
    const classification = fng.data[0].value_classification;

    db.run(
      `INSERT INTO kpi_history (kpi_name, value, classification, recorded_at)
       VALUES (?, ?, ?, ?)`,
      ["fear_greed", value, classification, now]
    );
    recorded.push({ name: "fear_greed", value, classification });
  } catch (err) {
    console.error("Failed to fetch Fear & Greed:", err);
  }

  // BTC Price
  try {
    const btc = await fetchAndValidate(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      CoinGeckoPriceResponse
    );
    const value = btc.bitcoin.usd;

    db.run(
      `INSERT INTO kpi_history (kpi_name, value, classification, recorded_at)
       VALUES (?, ?, ?, ?)`,
      ["btc_price", value, null, now]
    );
    recorded.push({ name: "btc_price", value, classification: null });
  } catch (err) {
    console.error("Failed to fetch BTC price:", err);
  }

  return { mode: "record", recorded };
}

async function view(limit: number): Promise<ToolResult> {
  const db = initDb();

  const rows = db.query(`
    SELECT kpi_name as name, value, classification, recorded_at
    FROM kpi_history
    ORDER BY recorded_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    name: string;
    value: number;
    classification: string | null;
    recorded_at: number;
  }>;

  return {
    mode: "view",
    history: rows.map((r) => ({
      name: r.name,
      value: r.value,
      classification: r.classification,
      date: formatDate(r.recorded_at),
    })),
  };
}

// ============================================
// Pretty formatter
// ============================================

function formatPretty(result: ToolResult): string {
  const lines: string[] = [];

  if (result.mode === "record" && result.recorded) {
    lines.push("=== KPI RECORDED ===");
    lines.push("");
    for (const kpi of result.recorded) {
      const cls = kpi.classification ? ` (${kpi.classification})` : "";
      const val = kpi.name === "btc_price" ? `$${kpi.value.toLocaleString()}` : String(kpi.value);
      lines.push(`  ${kpi.name}: ${val}${cls}`);
    }
    lines.push("");
    lines.push("Done.");
  } else if (result.mode === "view" && result.history) {
    lines.push("=== KPI HISTORY ===");
    lines.push("");
    const tableRows = result.history.map((h) => ({
      date: h.date,
      kpi: h.name,
      value: h.name === "btc_price" ? `$${h.value.toLocaleString()}` : String(h.value),
      class: h.classification || "-",
    }));
    lines.push(table(tableRows));
  }

  return lines.join("\n");
}

// ============================================
// CLI entry point
// ============================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
    record: { type: "boolean", default: false },
    view: { type: "boolean", default: false },
    limit: { type: "string", default: "20" },
  },
});

let result: ToolResult;

if (values.record) {
  result = await record();
} else if (values.view) {
  result = await view(parseInt(values.limit || "20", 10));
} else {
  // Default to view
  result = await view(parseInt(values.limit || "20", 10));
}

output(result, { json: values.json, pretty: formatPretty });
