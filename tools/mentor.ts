/**
 * Mentor Tool
 * Stage detection, config generation, and onboarding guidance
 *
 * Usage:
 *   bun run tools/mentor.ts              # Check stage, get guidance
 *   bun run tools/mentor.ts --init       # Interactive config setup
 *   bun run tools/mentor.ts --json       # For skill to parse
 */
import { parseArgs } from "util";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { existsSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { output } from "./lib/output";

// ============================================
// Paths
// ============================================

const EDGES_DIR = join(homedir(), ".claude", "polymarket-edges");
const NEWS_DIR = join(homedir(), ".claude", "polymarket-news");
const EDGES_DB = join(EDGES_DIR, "edges.db");
const NEWS_DB = join(NEWS_DIR, "news.db");
const CONFIG_FILE = join(EDGES_DIR, "config.json");

// ============================================
// Result schema
// ============================================

const ReflectionSchema = z.object({
  market: z.string(),
  question: z.string(),
  outcome: z.enum(["win", "loss"]),
  yourPosition: z.string(),
  resolvedTo: z.string(),
  driftDetected: z.boolean(),
});

const ResultSchema = z.object({
  stage: z.enum(["setup", "learning", "active", "reflection"]),
  message: z.string(),
  nextStep: z.string(),
  details: z.object({
    hasConfig: z.boolean(),
    hasEdgesDb: z.boolean(),
    hasNewsDb: z.boolean(),
    edgesDaemonRunning: z.boolean(),
    newsDaemonRunning: z.boolean(),
    marketsTracked: z.number(),
    positionsWithThesis: z.number(),
    pendingReflections: z.number(),
  }),
  reflection: ReflectionSchema.optional(),
});

type ToolResult = z.infer<typeof ResultSchema>;
type Reflection = z.infer<typeof ReflectionSchema>;

// ============================================
// Detection helpers
// ============================================

function checkDaemonRunning(name: string): boolean {
  try {
    const result = Bun.spawnSync(["pgrep", "-f", name]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function getRecentHeadlines(db: Database, hours: number = 1): number {
  const cutoff = Math.floor(Date.now() / 1000) - hours * 60 * 60;
  const row = db.query("SELECT COUNT(*) as count FROM headlines WHERE fetched_at > ?").get(cutoff) as { count: number };
  return row?.count || 0;
}

function getMarketsTracked(db: Database): number {
  const row = db.query("SELECT COUNT(*) as count FROM markets WHERE resolved = 0").get() as { count: number };
  return row?.count || 0;
}

function getPositionsWithThesis(db: Database): number {
  const row = db.query(`
    SELECT COUNT(DISTINCT th.market_slug) as count
    FROM thesis_history th
    JOIN markets m ON m.slug = th.market_slug
    WHERE m.in_portfolio = 1 AND m.resolved = 0
  `).get() as { count: number };
  return row?.count || 0;
}

function getPendingReflections(db: Database): Reflection[] {
  const rows = db.query(`
    SELECT
      m.slug,
      m.question,
      m.resolved_outcome,
      th.position_taken,
      th.signal
    FROM markets m
    JOIN thesis_history th ON th.market_slug = m.slug
    WHERE m.resolved = 1
      AND m.in_portfolio = 1
      AND th.id = (SELECT MAX(id) FROM thesis_history WHERE market_slug = m.slug)
    ORDER BY m.last_refreshed DESC
    LIMIT 5
  `).all() as Array<{
    slug: string;
    question: string;
    resolved_outcome: string;
    position_taken: string;
    signal: string;
  }>;

  return rows.map((r) => {
    const won = r.position_taken === r.resolved_outcome;
    return {
      market: r.slug,
      question: r.question,
      outcome: won ? "win" as const : "loss" as const,
      yourPosition: r.position_taken,
      resolvedTo: r.resolved_outcome,
      driftDetected: false, // TODO: check drift
    };
  });
}

// ============================================
// Stage detection
// ============================================

async function detectStage(): Promise<ToolResult> {
  const hasConfig = existsSync(CONFIG_FILE);
  const hasEdgesDb = existsSync(EDGES_DB);
  const hasNewsDb = existsSync(NEWS_DB);
  const edgesDaemonRunning = checkDaemonRunning("polymarket-edges-daemon");
  const newsDaemonRunning = checkDaemonRunning("polymarket-news-daemon");

  let marketsTracked = 0;
  let positionsWithThesis = 0;
  let reflections: Reflection[] = [];

  if (hasEdgesDb) {
    const db = new Database(EDGES_DB, { readonly: true });
    marketsTracked = getMarketsTracked(db);
    positionsWithThesis = getPositionsWithThesis(db);
    reflections = getPendingReflections(db);
    db.close();
  }

  const details = {
    hasConfig,
    hasEdgesDb,
    hasNewsDb,
    edgesDaemonRunning,
    newsDaemonRunning,
    marketsTracked,
    positionsWithThesis,
    pendingReflections: reflections.length,
  };

  // Stage 4: Reflection (has resolved markets with positions)
  if (reflections.length > 0) {
    const r = reflections[0];
    return {
      stage: "reflection",
      message: `Hey - your "${r.question.slice(0, 50)}..." position just resolved. You ${r.outcome}.

Want to do a quick retro?

Not to beat yourself up - to learn. Did your thesis hold?
Did you drift from your original thinking?
What would you do differently?

Just say "let's review" if you want to dig in.`,
      nextStep: "Review your thesis drift with: bun run drift",
      details,
      reflection: r,
    };
  }

  // Stage 3: Active (has thesis + portfolio positions)
  if (positionsWithThesis > 0) {
    return {
      stage: "active",
      message: `You're in the game. You have skin in the arena.

Remember: the market can stay wrong longer than you can stay solvent.
But that's why we track thesis drift - to catch when WE'RE the ones drifting.

Run \`bun run drift\` anytime to check if your thinking has changed.`,
      nextStep: "Scan for more edges or check your positions",
      details,
    };
  }

  // Stage 2: Learning (peekers live but no real positions)
  if (hasEdgesDb && marketsTracked > 0) {
    return {
      stage: "learning",
      message: `Peekers are running. You now have:
- Market data refreshing in edges.db (${marketsTracked} markets tracked)
- News headlines flowing into news.db

Let's find your first edge together. I'll show you how to:
1. Scan for cognitive biases (where crowd psychology creates mispricings)
2. Develop a thesis (why YOU think the market is wrong)
3. Take a position (skin in the game)

Ready to scan?`,
      nextStep: "Use the edge scanner to find your first mispriced market",
      details,
    };
  }

  // Stage 1: Setup
  let setupMessage = `Welcome to edge hunting.

Quick clarification: I'm not an arbitrage bot. I don't buy low and sell high
across markets. I help you find where the crowd is wrong.

I surface facts and trends. But facts don't make things happen - you develop
the thesis about what those facts mean.

`;

  if (!hasConfig) {
    setupMessage += `Let's get you set up. Run:
  bun run mentor --init

This will create your config with your Polymarket wallet address.`;
  } else if (!edgesDaemonRunning || !newsDaemonRunning) {
    setupMessage += `Config looks good. Now start the peekers:

# Terminal 1: News daemon
cd ~/.claude/polymarket-news && ./polymarket-news-daemon

# Terminal 2: Edges daemon
cd ~/.claude/polymarket-edges && ./polymarket-edges-daemon

Or run them in background with nohup.`;
  }

  return {
    stage: "setup",
    message: setupMessage,
    nextStep: hasConfig ? "Start the daemons" : "Run --init to create config",
    details,
  };
}

// ============================================
// Interactive config setup
// ============================================

async function initConfig(): Promise<void> {
  console.log(`
Welcome to edge hunting.

Quick clarification: I'm not an arbitrage bot. I don't buy low and sell high
across markets. I help you find where the crowd is wrong.

I surface facts and trends. But facts don't make things happen - you develop
the thesis about what those facts mean.

Let's get you set up.
`);

  // Check if config exists
  if (existsSync(CONFIG_FILE)) {
    console.log("Config already exists at:", CONFIG_FILE);
    console.log("Delete it first if you want to reconfigure.");
    return;
  }

  // Prompt for wallet
  process.stdout.write("What's your Polymarket wallet address?\n(Find it at polymarket.com -> Profile -> copy address)\n\n> ");

  const reader = Bun.stdin.stream().getReader();
  const { value } = await reader.read();
  const wallet = new TextDecoder().decode(value).trim();

  if (!wallet || !wallet.startsWith("0x")) {
    console.log("\nInvalid wallet address. Should start with 0x");
    return;
  }

  // Create config
  const config = {
    portfolio: {
      wallet: wallet,
      syncIntervalMinutes: 60,
    },
    storage: {
      maxSizeBytes: 52428800,
      maxWatchedMarkets: 200,
      maxPriceHistoryDays: 7,
    },
  };

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.log(`
Config created at: ${CONFIG_FILE}

Next steps:
1. Build the daemons (if not already):
   cd ~/.claude/polymarket-news && bun run build
   cd ~/.claude/polymarket-edges && bun run build

2. Start the peekers:
   cd ~/.claude/polymarket-news && ./polymarket-news-daemon &
   cd ~/.claude/polymarket-edges && ./polymarket-edges-daemon &

3. Run me again to check your stage:
   bun run mentor
`);
}

// ============================================
// Pretty formatter
// ============================================

function formatPretty(result: ToolResult): string {
  const lines: string[] = [];

  const stageEmoji = {
    setup: "\u{1F6E0}\u{FE0F}",      // 🛠️
    learning: "\u{1F4DA}",           // 📚
    active: "\u{1F3AF}",             // 🎯
    reflection: "\u{1F4AD}",         // 💭
  };

  lines.push(`${stageEmoji[result.stage]} Stage: ${result.stage.toUpperCase()}`);
  lines.push("");
  lines.push(result.message);
  lines.push("");
  lines.push(`Next: ${result.nextStep}`);

  return lines.join("\n");
}

// ============================================
// CLI entry point
// ============================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
    init: { type: "boolean", default: false },
  },
});

if (values.init) {
  await initConfig();
} else {
  const result = await detectStage();
  output(result, { json: values.json, pretty: formatPretty });
}
