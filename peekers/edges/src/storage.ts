import { Database } from "bun:sqlite";
import { statSync, unlinkSync, renameSync, existsSync } from "fs";
import type { StorageConfig, MarketRow, PriceHistoryRow, Market, ThesisAnalysis, ThesisHistoryRow, Signal, ContriarianSignals, BiasScores } from "./types";
import { getDbPath, getLogPath } from "./config";

let db: Database | null = null;

export function initDb(): Database {
  const dbPath = getDbPath();
  db = new Database(dbPath, { create: true });

  // Create markets table
  db.run(`
    CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      question TEXT NOT NULL,
      yes_price REAL,
      volume REAL,
      liquidity REAL,
      end_date INTEGER,
      last_refreshed INTEGER,
      watch_source TEXT,
      in_portfolio INTEGER DEFAULT 0,
      portfolio_outcome TEXT,
      portfolio_size REAL,
      tags TEXT,
      edge_type TEXT,
      edge_direction TEXT,
      thesis TEXT,
      confidence TEXT,
      thesis_updated INTEGER,
      resolution_criteria TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_outcome TEXT,
      added_at INTEGER NOT NULL
    )
  `);

  // Create price history table
  db.run(`
    CREATE TABLE IF NOT EXISTS price_history (
      market_slug TEXT NOT NULL,
      yes_price REAL,
      volume REAL,
      recorded_at INTEGER NOT NULL,
      PRIMARY KEY (market_slug, recorded_at),
      FOREIGN KEY (market_slug) REFERENCES markets(slug)
    )
  `);

  // Create thesis history table (versioned analysis)
  db.run(`
    CREATE TABLE IF NOT EXISTS thesis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_slug TEXT NOT NULL,
      created_at INTEGER NOT NULL,

      -- Traffic light result
      signal TEXT NOT NULL,
      one_liner TEXT NOT NULL,

      -- Layer 1: Contrarian
      contrarian_score INTEGER,
      contrarian_signals TEXT,

      -- Layer 2: Source
      source_tier INTEGER,
      source_description TEXT,

      -- Layer 3: Biases
      bias_recency INTEGER,
      bias_availability INTEGER,
      bias_anchoring INTEGER,
      bias_confirmation INTEGER,
      bias_favlong INTEGER,
      bias_bandwagon INTEGER,
      bias_total INTEGER,

      -- Thesis
      thesis_text TEXT,

      -- Position tracking
      position_taken TEXT,
      position_price REAL,

      FOREIGN KEY (market_slug) REFERENCES markets(slug)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_in_portfolio ON markets(in_portfolio)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_edge_type ON markets(edge_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_end_date ON markets(end_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tags ON markets(tags)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resolved ON markets(resolved)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_last_refreshed ON markets(last_refreshed)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_thesis_market ON thesis_history(market_slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_thesis_created ON thesis_history(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_thesis_signal ON thesis_history(signal)`);

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

export function getDb(): Database {
  if (!db) return initDb();
  return db;
}

// Add or update a market in watchlist
export function upsertMarket(market: Partial<Market> & { slug: string }): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = db.prepare("SELECT id FROM markets WHERE slug = ?").get(market.slug);

  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];

    if (market.question !== undefined) { updates.push("question = ?"); values.push(market.question); }
    if (market.yes_price !== undefined) { updates.push("yes_price = ?"); values.push(market.yes_price); }
    if (market.volume !== undefined) { updates.push("volume = ?"); values.push(market.volume); }
    if (market.liquidity !== undefined) { updates.push("liquidity = ?"); values.push(market.liquidity); }
    if (market.end_date !== undefined) { updates.push("end_date = ?"); values.push(market.end_date); }
    if (market.last_refreshed !== undefined) { updates.push("last_refreshed = ?"); values.push(market.last_refreshed); }
    if (market.in_portfolio !== undefined) { updates.push("in_portfolio = ?"); values.push(market.in_portfolio ? 1 : 0); }
    if (market.portfolio_outcome !== undefined) { updates.push("portfolio_outcome = ?"); values.push(market.portfolio_outcome); }
    if (market.portfolio_size !== undefined) { updates.push("portfolio_size = ?"); values.push(market.portfolio_size); }
    if (market.tags !== undefined) { updates.push("tags = ?"); values.push(JSON.stringify(market.tags)); }
    if (market.edge_type !== undefined) { updates.push("edge_type = ?"); values.push(market.edge_type); }
    if (market.edge_direction !== undefined) { updates.push("edge_direction = ?"); values.push(market.edge_direction); }
    if (market.thesis !== undefined) { updates.push("thesis = ?"); values.push(market.thesis); updates.push("thesis_updated = ?"); values.push(now); }
    if (market.confidence !== undefined) { updates.push("confidence = ?"); values.push(market.confidence); }
    if (market.resolution_criteria !== undefined) { updates.push("resolution_criteria = ?"); values.push(market.resolution_criteria); }
    if (market.resolved !== undefined) { updates.push("resolved = ?"); values.push(market.resolved ? 1 : 0); }
    if (market.resolved_outcome !== undefined) { updates.push("resolved_outcome = ?"); values.push(market.resolved_outcome); }

    if (updates.length > 0) {
      values.push(market.slug);
      db.prepare(`UPDATE markets SET ${updates.join(", ")} WHERE slug = ?`).run(...values);
    }
  } else {
    db.prepare(`
      INSERT INTO markets (slug, question, yes_price, volume, liquidity, end_date, last_refreshed,
        watch_source, in_portfolio, portfolio_outcome, portfolio_size, tags, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      market.slug,
      market.question || "",
      market.yes_price || null,
      market.volume || null,
      market.liquidity || null,
      market.end_date || null,
      market.last_refreshed || now,
      market.watch_source || "manual",
      market.in_portfolio ? 1 : 0,
      market.portfolio_outcome || null,
      market.portfolio_size || null,
      JSON.stringify(market.tags || []),
      now
    );
  }
}

// Get all watched markets
export function getWatchedMarkets(): MarketRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM markets WHERE resolved = 0 ORDER BY end_date ASC").all() as MarketRow[];
}

// Get markets needing refresh
export function getMarketsNeedingRefresh(beforeTimestamp: number): MarketRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM markets
    WHERE resolved = 0 AND (last_refreshed IS NULL OR last_refreshed < ?)
    ORDER BY end_date ASC
  `).all(beforeTimestamp) as MarketRow[];
}

// Record price history (max 1 per hour per market)
export function recordPriceHistory(slug: string, yesPrice: number, volume: number): boolean {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const hourAgo = now - 3600;

  // Check if we already have a record in the last hour
  const recent = db.prepare(`
    SELECT 1 FROM price_history
    WHERE market_slug = ? AND recorded_at > ?
  `).get(slug, hourAgo);

  if (recent) return false;

  db.prepare(`
    INSERT INTO price_history (market_slug, yes_price, volume, recorded_at)
    VALUES (?, ?, ?, ?)
  `).run(slug, yesPrice, volume, now);

  return true;
}

// Get price history for a market
export function getPriceHistory(slug: string, days: number = 7): PriceHistoryRow[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  return db.prepare(`
    SELECT * FROM price_history
    WHERE market_slug = ? AND recorded_at > ?
    ORDER BY recorded_at ASC
  `).all(slug, cutoff) as PriceHistoryRow[];
}

// Get correlated markets
export function getCorrelatedMarkets(slug: string, portfolioWeight: number): any[] {
  const db = getDb();
  const market = db.prepare("SELECT tags, in_portfolio FROM markets WHERE slug = ?").get(slug) as MarketRow | undefined;

  if (!market) return [];

  const tags: string[] = JSON.parse(market.tags || "[]");
  if (tags.length === 0) return [];

  const others = db.prepare(`
    SELECT slug, question, yes_price, in_portfolio, edge_type, tags
    FROM markets
    WHERE slug != ? AND resolved = 0
  `).all(slug) as MarketRow[];

  return others
    .map(m => {
      const mTags: string[] = JSON.parse(m.tags || "[]");
      const sharedTags = tags.filter(t => mTags.includes(t));

      let score = sharedTags.length;
      if (m.in_portfolio) score *= portfolioWeight;

      return {
        slug: m.slug,
        question: m.question,
        yes_price: m.yes_price,
        in_portfolio: !!m.in_portfolio,
        edge_type: m.edge_type,
        score,
        sharedTags,
      };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Get database size
export function getDbSize(): number {
  try {
    return statSync(getDbPath()).size;
  } catch {
    return 0;
  }
}

export function getDbSizeFormatted(): string {
  const bytes = getDbSize();
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Prune old data
export function pruneIfNeeded(config: StorageConfig): { deleted: number; vacuumed: boolean } {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  let deleted = 0;
  let vacuumed = false;

  // 1. Delete old resolved markets
  const resolvedCutoff = now - config.resolvedRetentionDays * 24 * 60 * 60;
  const resolvedResult = db.prepare("DELETE FROM markets WHERE resolved = 1 AND added_at < ?").run(resolvedCutoff);
  deleted += resolvedResult.changes;

  // 2. Delete old price history
  const historyCutoff = now - config.maxPriceHistoryDays * 24 * 60 * 60;
  const historyResult = db.prepare("DELETE FROM price_history WHERE recorded_at < ?").run(historyCutoff);
  deleted += historyResult.changes;

  // 3. Check size and prune if needed
  const currentSize = getDbSize();
  const pruneThreshold = config.maxSizeBytes * config.pruneAt;

  if (currentSize > pruneThreshold) {
    console.log(`DB size ${getDbSizeFormatted()} exceeds threshold, pruning...`);

    // Delete oldest non-portfolio markets
    while (getDbSize() > config.maxSizeBytes * config.targetAfterPrune) {
      const result = db.prepare(`
        DELETE FROM markets WHERE id IN (
          SELECT id FROM markets
          WHERE in_portfolio = 0 AND resolved = 0
          ORDER BY added_at ASC LIMIT 10
        )
      `).run();

      deleted += result.changes;
      if (result.changes === 0) break;
    }

    // Clean up orphaned price history
    db.prepare(`
      DELETE FROM price_history
      WHERE market_slug NOT IN (SELECT slug FROM markets)
    `).run();

    db.run("VACUUM");
    vacuumed = true;
  }

  // 4. Enforce max watched markets
  const marketCount = (db.prepare("SELECT COUNT(*) as count FROM markets WHERE resolved = 0").get() as { count: number }).count;
  if (marketCount > config.maxWatchedMarkets) {
    const excess = marketCount - config.maxWatchedMarkets;
    const result = db.prepare(`
      DELETE FROM markets WHERE id IN (
        SELECT id FROM markets
        WHERE in_portfolio = 0 AND resolved = 0
        ORDER BY added_at ASC LIMIT ?
      )
    `).run(excess);
    deleted += result.changes;
  }

  return { deleted, vacuumed };
}

// Log rotation
export function rotateLogIfNeeded(maxLogSizeBytes: number): boolean {
  const logPath = getLogPath();
  if (!existsSync(logPath)) return false;

  try {
    const stats = statSync(logPath);
    if (stats.size > maxLogSizeBytes) {
      const backupPath = `${logPath}.old`;
      if (existsSync(backupPath)) unlinkSync(backupPath);
      renameSync(logPath, backupPath);
      console.log(`Rotated log file (was ${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      return true;
    }
  } catch (error) {
    console.warn(`Error rotating log: ${error}`);
  }
  return false;
}

// Stats
export function getStats(): { markets: number; portfolio: number; withEdge: number; historyPoints: number } {
  const db = getDb();
  const markets = (db.prepare("SELECT COUNT(*) as c FROM markets WHERE resolved = 0").get() as { c: number }).c;
  const portfolio = (db.prepare("SELECT COUNT(*) as c FROM markets WHERE in_portfolio = 1 AND resolved = 0").get() as { c: number }).c;
  const withEdge = (db.prepare("SELECT COUNT(*) as c FROM markets WHERE edge_type IS NOT NULL AND resolved = 0").get() as { c: number }).c;
  const historyPoints = (db.prepare("SELECT COUNT(*) as c FROM price_history").get() as { c: number }).c;
  return { markets, portfolio, withEdge, historyPoints };
}

// ==================== Thesis History Functions ====================

// Save a new thesis analysis
export function saveThesis(analysis: ThesisAnalysis): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    INSERT INTO thesis_history (
      market_slug, created_at, signal, one_liner,
      contrarian_score, contrarian_signals,
      source_tier, source_description,
      bias_recency, bias_availability, bias_anchoring,
      bias_confirmation, bias_favlong, bias_bandwagon, bias_total,
      thesis_text, position_taken, position_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    analysis.marketSlug,
    now,
    analysis.signal,
    analysis.oneLiner,
    analysis.contrarianScore,
    JSON.stringify(analysis.contrarianSignals),
    analysis.sourceTier,
    analysis.sourceDescription,
    analysis.biasScores.recency,
    analysis.biasScores.availability,
    analysis.biasScores.anchoring,
    analysis.biasScores.confirmation,
    analysis.biasScores.favoriteLongshot,
    analysis.biasScores.bandwagon,
    analysis.biasTotal,
    analysis.thesisText,
    analysis.positionTaken,
    analysis.positionPrice || null
  );

  return result.lastInsertRowid as number;
}

// Get latest thesis for a market
export function getLatestThesis(slug: string): ThesisHistoryRow | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM thesis_history
    WHERE market_slug = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(slug) as ThesisHistoryRow | undefined;

  return row || null;
}

// Get all thesis history for a market
export function getThesisHistory(slug: string): ThesisHistoryRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM thesis_history
    WHERE market_slug = ?
    ORDER BY created_at DESC
  `).all(slug) as ThesisHistoryRow[];
}

// Detect thesis drift - markets where signal changed
export function getThesisDrift(): Array<{
  slug: string;
  question: string;
  originalSignal: string;
  currentSignal: string;
  originalDate: number;
  currentDate: number;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT
      m.slug,
      m.question,
      t1.signal as originalSignal,
      t2.signal as currentSignal,
      t1.created_at as originalDate,
      t2.created_at as currentDate
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
    originalDate: number;
    currentDate: number;
  }>;
}

// Calibration - compare thesis signals to outcomes
export function getCalibrationStats(): Array<{
  signal: string;
  total: number;
  wins: number;
  winRate: number;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      th.signal,
      COUNT(*) as total,
      SUM(CASE
        WHEN (th.position_taken = 'yes' AND m.resolved_outcome = 'yes')
          OR (th.position_taken = 'no' AND m.resolved_outcome = 'no')
        THEN 1 ELSE 0
      END) as wins
    FROM thesis_history th
    JOIN markets m ON m.slug = th.market_slug
    WHERE m.resolved = 1
      AND th.position_taken IS NOT NULL
      AND th.position_taken != 'pass'
      AND th.id = (SELECT MAX(id) FROM thesis_history WHERE market_slug = th.market_slug)
    GROUP BY th.signal
  `).all() as Array<{ signal: string; total: number; wins: number }>;

  return rows.map(r => ({
    ...r,
    winRate: r.total > 0 ? (r.wins / r.total) * 100 : 0
  }));
}

// Get markets by signal type
export function getMarketsBySignal(signal: Signal): Array<{
  slug: string;
  question: string;
  yesPrice: number;
  oneLiner: string;
  createdAt: number;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT
      m.slug,
      m.question,
      m.yes_price as yesPrice,
      th.one_liner as oneLiner,
      th.created_at as createdAt
    FROM thesis_history th
    JOIN markets m ON m.slug = th.market_slug
    WHERE th.signal = ?
      AND m.resolved = 0
      AND th.id = (SELECT MAX(id) FROM thesis_history WHERE market_slug = th.market_slug)
    ORDER BY th.created_at DESC
  `).all(signal) as Array<{
    slug: string;
    question: string;
    yesPrice: number;
    oneLiner: string;
    createdAt: number;
  }>;
}

// Format thesis for display
export function formatThesisOneLiner(row: ThesisHistoryRow): string {
  const signalEmoji = row.signal === "green" ? "🟢" : row.signal === "yellow" ? "🟡" : "🔴";
  return `${signalEmoji} ${row.one_liner}\n└─ Contrarian: ${row.contrarian_score}/4 | Source: Tier${row.source_tier} | Bias: ${row.bias_total}/60`;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
