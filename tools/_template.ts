/**
 * Tool Template
 * Copy this file to create a new tool
 *
 * Usage: bun run tools/<name>.ts [--json]
 */
import { parseArgs } from "util";
import { z } from "zod";
import { initDb } from "../src/storage";
import { output, table } from "./lib/output";
// import { fetchAndValidate, SomeApiSchema } from "./lib/schemas";

// ============================================
// 1. Define result schema
// ============================================

const ResultSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    value: z.number(),
  })),
  summary: z.string(),
});

type ToolResult = z.infer<typeof ResultSchema>;

// ============================================
// 2. Core logic (pure, testable)
// ============================================

async function run(): Promise<ToolResult> {
  const db = initDb();

  // Query database
  // const rows = db.query("SELECT * FROM markets").all();

  // Or fetch external API with Zod validation
  // const apiData = await fetchAndValidate(
  //   "https://api.example.com/data",
  //   SomeApiSchema
  // );

  return {
    items: [
      { name: "example", value: 42 },
    ],
    summary: "This is a template tool",
  };
}

// ============================================
// 3. Pretty formatter
// ============================================

function formatPretty(result: ToolResult): string {
  const lines: string[] = [];

  lines.push("=== TOOL NAME ===");
  lines.push("");
  lines.push(table(result.items));
  lines.push("");
  lines.push(result.summary);

  return lines.join("\n");
}

// ============================================
// 4. CLI entry point
// ============================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
    // Add more options as needed:
    // days: { type: "string", default: "7" },
  },
});

const result = await run();
output(result, { json: values.json, pretty: formatPretty });
