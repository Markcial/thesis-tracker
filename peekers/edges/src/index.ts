#!/usr/bin/env bun

import { loadConfig, getDbPath, needsRefresh, getRefreshIntervalMinutes } from "./config";
import {
  initDb,
  getWatchedMarkets,
  upsertMarket,
  recordPriceHistory,
  pruneIfNeeded,
  rotateLogIfNeeded,
  getDbSizeFormatted,
  getStats,
  closeDb,
} from "./storage";
import { fetchMarkets, extractMarketData, isResolved } from "./fetcher";
import { fetchPortfolioPositions } from "./portfolio";
import { extractTags } from "./tagger";
import type { MarketRow } from "./types";

function timestamp(): string {
  return new Date().toISOString();
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

// Refresh markets that need updating
async function refreshMarkets(config: ReturnType<typeof loadConfig>): Promise<number> {
  const markets = getWatchedMarkets();
  const now = Math.floor(Date.now() / 1000);

  // Filter markets needing refresh based on adaptive timing
  const needsUpdate = markets.filter(m =>
    needsRefresh(m.last_refreshed || 0, m.end_date || now + 86400 * 30, config.refresh)
  );

  if (needsUpdate.length === 0) return 0;

  log(`Refreshing ${needsUpdate.length} markets...`);

  const slugs = needsUpdate.map(m => m.slug);
  const fetched = await fetchMarkets(slugs);

  let updated = 0;
  for (const market of needsUpdate) {
    const data = fetched.get(market.slug);
    if (data) {
      const extracted = extractMarketData(data);
      const resolved = isResolved(data);

      upsertMarket({
        slug: market.slug,
        yes_price: extracted.yes_price ?? undefined,
        volume: extracted.volume ?? undefined,
        liquidity: extracted.liquidity ?? undefined,
        end_date: extracted.end_date ?? undefined,
        last_refreshed: now,
        resolved: resolved,
      });

      // Record price history (max 1 per hour)
      if (extracted.yes_price !== null) {
        recordPriceHistory(market.slug, extracted.yes_price, extracted.volume || 0);
      }

      updated++;
    }
  }

  return updated;
}

// Sync portfolio positions
async function syncPortfolio(config: ReturnType<typeof loadConfig>): Promise<number> {
  if (!config.portfolio.wallet) {
    return 0;
  }

  log("Syncing portfolio positions...");
  const positions = await fetchPortfolioPositions(config.portfolio.wallet);

  if (positions.length === 0) {
    log("No portfolio positions found");
    return 0;
  }

  // First, clear in_portfolio flag for all markets
  const db = (await import("./storage")).getDb();
  db.prepare("UPDATE markets SET in_portfolio = 0, portfolio_outcome = NULL, portfolio_size = NULL").run();

  // Add/update portfolio positions
  let added = 0;
  for (const pos of positions) {
    const tags = extractTags(pos.question);

    upsertMarket({
      slug: pos.slug,
      question: pos.question,
      yes_price: pos.currentPrice,
      watch_source: "portfolio",
      in_portfolio: true,
      portfolio_outcome: pos.outcome,
      portfolio_size: pos.size,
      tags,
    });
    added++;
  }

  log(`Synced ${added} portfolio positions`);
  return added;
}

// Main daemon loop cycle
async function cycle(config: ReturnType<typeof loadConfig>, lastPortfolioSync: number): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // Refresh market prices
  const refreshed = await refreshMarkets(config);
  if (refreshed > 0) {
    log(`Updated ${refreshed} markets`);
  }

  // Sync portfolio periodically
  let newLastSync = lastPortfolioSync;
  const syncIntervalSeconds = config.portfolio.syncIntervalMinutes * 60;
  if (now - lastPortfolioSync >= syncIntervalSeconds) {
    await syncPortfolio(config);
    newLastSync = now;
  }

  // Prune old data
  const pruneResult = pruneIfNeeded(config.storage);
  if (pruneResult.deleted > 0) {
    log(`Pruned ${pruneResult.deleted} old records${pruneResult.vacuumed ? ", vacuumed DB" : ""}`);
  }

  // Rotate logs
  rotateLogIfNeeded(config.storage.maxLogSizeBytes);

  // Report stats
  const stats = getStats();
  log(`Stats: ${stats.markets} markets (${stats.portfolio} in portfolio, ${stats.withEdge} with edge), ${stats.historyPoints} price points, ${getDbSizeFormatted()}`);

  return newLastSync;
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
  log("Market Peeker Daemon starting...");

  const config = loadConfig();

  if (!config.daemon.enabled) {
    log("Daemon disabled in config, exiting");
    return;
  }

  initDb();
  log(`Database: ${getDbPath()}`);

  if (config.portfolio.wallet) {
    log(`Portfolio wallet: ${config.portfolio.wallet.slice(0, 10)}...`);
  } else {
    log("No portfolio wallet configured");
  }

  setupShutdownHandlers();

  // Initial sync
  let lastPortfolioSync = 0;
  if (config.portfolio.wallet) {
    await syncPortfolio(config);
    lastPortfolioSync = Math.floor(Date.now() / 1000);
  }

  // Initial cycle
  lastPortfolioSync = await cycle(config, lastPortfolioSync);

  log("=".repeat(50));
  log("Daemon running. Checking every minute for markets needing refresh.");

  // Main loop - check every minute
  setInterval(async () => {
    try {
      lastPortfolioSync = await cycle(config, lastPortfolioSync);
    } catch (error) {
      console.error(`[${timestamp()}] Error in cycle:`, error);
    }
  }, 60 * 1000); // Check every minute
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
