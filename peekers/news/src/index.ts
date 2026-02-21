#!/usr/bin/env bun

import { loadConfig, getDbPath } from "./config";
import { fetchAllFeeds, getEnabledSourceCount } from "./fetcher";
import {
  initDb,
  storeHeadlines,
  pruneIfNeeded,
  getDbSizeFormatted,
  getHeadlineCount,
  closeDb,
  rotateLogIfNeeded,
  getTotalStorageSizeFormatted,
} from "./storage";
import { compilePatterns, tagHeadlines } from "./tagger";

// Timestamp formatter
function timestamp(): string {
  return new Date().toISOString();
}

// Log with timestamp
function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

// Main fetch cycle
async function cycle(config: ReturnType<typeof loadConfig>): Promise<void> {
  log("Starting fetch cycle...");

  try {
    // Fetch headlines from all enabled feeds
    const rawHeadlines = await fetchAllFeeds(config.feeds);
    log(`Fetched ${rawHeadlines.length} headlines from feeds`);

    // Tag headlines with relevance keywords
    const taggedHeadlines = tagHeadlines(rawHeadlines);

    // Count tagged headlines
    const taggedCount = taggedHeadlines.filter((h) => h.relevanceTags.length > 0).length;
    log(`Tagged ${taggedCount}/${taggedHeadlines.length} headlines with relevance tags`);

    // Store in database
    const inserted = storeHeadlines(taggedHeadlines);
    log(`Inserted ${inserted} new headlines (${taggedHeadlines.length - inserted} duplicates skipped)`);

    // Prune old/excess entries
    const pruneResult = pruneIfNeeded(config.storage);
    if (pruneResult.deleted > 0) {
      log(`Pruned ${pruneResult.deleted} old headlines${pruneResult.vacuumed ? ", vacuumed DB" : ""}`);
    }

    // Rotate log if needed
    rotateLogIfNeeded(config.storage.maxLogSizeBytes);

    // Report stats
    const totalHeadlines = getHeadlineCount();
    const totalSize = getTotalStorageSizeFormatted();
    log(`Stats: ${totalHeadlines} headlines, ${totalSize} total storage`);
  } catch (error) {
    console.error(`[${timestamp()}] Error in fetch cycle:`, error);
  }
}

// Graceful shutdown
function setupShutdownHandlers(): void {
  const shutdown = () => {
    log("Shutting down...");
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Main entry point
async function main(): Promise<void> {
  log("=".repeat(50));
  log("Polymarket News Daemon starting...");

  // Load configuration
  const config = loadConfig();
  const sourceCount = getEnabledSourceCount(config.feeds);
  log(`Config loaded: ${sourceCount} sources, ${config.daemon.intervalMinutes}min interval`);

  // Initialize database
  initDb();
  log(`Database: ${getDbPath()}`);

  // Compile keyword patterns
  compilePatterns(config.keywords.patterns);
  log(`Compiled ${config.keywords.patterns.length} keyword patterns`);

  // Setup shutdown handlers
  setupShutdownHandlers();

  // Initial fetch
  await cycle(config);

  // Calculate interval
  const intervalMs = config.daemon.intervalMinutes * 60 * 1000;
  log(`Next fetch in ${config.daemon.intervalMinutes} minutes`);
  log("=".repeat(50));

  // Main loop
  setInterval(async () => {
    await cycle(config);
    log(`Next fetch in ${config.daemon.intervalMinutes} minutes`);
  }, intervalMs);
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
