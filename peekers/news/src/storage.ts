import { Database } from "bun:sqlite";
import { statSync, unlinkSync, renameSync, existsSync, truncateSync } from "fs";
import type { StorageConfig, TaggedHeadline, HeadlineRow } from "./types";
import { getDbPath, getLogPath } from "./config";

let db: Database | null = null;

// Initialize database with schema
export function initDb(): Database {
  const dbPath = getDbPath();
  db = new Database(dbPath, { create: true });

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS headlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      categories TEXT,
      published_at INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL,
      relevance_tags TEXT
    )
  `);

  // Create indexes for common queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_published ON headlines(published_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_relevance ON headlines(relevance_tags)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fetched ON headlines(fetched_at)`);

  // Create unique constraint to avoid duplicate headlines
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_headline ON headlines(source, title, published_at)`);

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

export function getDb(): Database {
  if (!db) {
    return initDb();
  }
  return db;
}

// Store headlines, ignoring duplicates
export function storeHeadlines(headlines: TaggedHeadline[]): number {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO headlines
    (source, source_url, title, summary, categories, published_at, fetched_at, relevance_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const insertMany = db.transaction((items: TaggedHeadline[]) => {
    for (const h of items) {
      const result = insert.run(
        h.source,
        h.sourceUrl,
        h.title,
        h.summary || "",
        JSON.stringify(h.categories),
        h.publishedAt,
        h.fetchedAt,
        JSON.stringify(h.relevanceTags)
      );
      if (result.changes > 0) inserted++;
    }
  });

  insertMany(headlines);
  return inserted;
}

// Get database file size in bytes
export function getDbSize(): number {
  try {
    const dbPath = getDbPath();
    const stats = statSync(dbPath);
    return stats.size;
  } catch {
    return 0;
  }
}

// Get human-readable size
export function getDbSizeFormatted(): string {
  const bytes = getDbSize();
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Prune old entries and manage size
export function pruneIfNeeded(config: StorageConfig): { deleted: number; vacuumed: boolean } {
  const db = getDb();
  let deleted = 0;
  let vacuumed = false;

  // Always delete entries older than maxAgeDays
  const maxAgeSeconds = config.maxAgeDays * 24 * 60 * 60;
  const cutoffTime = Math.floor(Date.now() / 1000) - maxAgeSeconds;

  const deleteOld = db.prepare(`DELETE FROM headlines WHERE published_at < ?`);
  const oldResult = deleteOld.run(cutoffTime);
  deleted += oldResult.changes;

  if (oldResult.changes > 0) {
    console.log(`Pruned ${oldResult.changes} headlines older than ${config.maxAgeDays} days`);
  }

  // Check size and prune if needed
  const currentSize = getDbSize();
  const pruneThreshold = config.maxSizeBytes * config.pruneAt;

  if (currentSize > pruneThreshold) {
    const targetSize = config.maxSizeBytes * config.targetAfterPrune;
    console.log(`DB size ${getDbSizeFormatted()} exceeds ${(config.pruneAt * 100).toFixed(0)}% threshold, pruning...`);

    // Delete oldest entries until we're under target
    while (getDbSize() > targetSize) {
      // Delete oldest 1000 entries at a time
      const deleteOldest = db.prepare(`
        DELETE FROM headlines
        WHERE id IN (
          SELECT id FROM headlines
          ORDER BY published_at ASC
          LIMIT 1000
        )
      `);
      const result = deleteOldest.run();
      deleted += result.changes;

      if (result.changes === 0) break; // No more to delete
    }

    // Run VACUUM to reclaim space
    db.run("VACUUM");
    vacuumed = true;

    console.log(`Pruned ${deleted} headlines, new size: ${getDbSizeFormatted()}`);
  }

  return { deleted, vacuumed };
}

// Query headlines by relevance tag
export function queryByTag(tag: string, limit: number = 20): HeadlineRow[] {
  const db = getDb();
  const query = db.prepare(`
    SELECT * FROM headlines
    WHERE relevance_tags LIKE ?
    ORDER BY published_at DESC
    LIMIT ?
  `);
  return query.all(`%"${tag}"%`, limit) as HeadlineRow[];
}

// Query recent headlines
export function queryRecent(hours: number = 24, limit: number = 50): HeadlineRow[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 60 * 60;
  const query = db.prepare(`
    SELECT * FROM headlines
    WHERE published_at > ?
    ORDER BY published_at DESC
    LIMIT ?
  `);
  return query.all(cutoff, limit) as HeadlineRow[];
}

// Get headline count
export function getHeadlineCount(): number {
  const db = getDb();
  const result = db.prepare("SELECT COUNT(*) as count FROM headlines").get() as { count: number };
  return result.count;
}

// Close database connection
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Rotate log file if too large
export function rotateLogIfNeeded(maxLogSizeBytes: number): boolean {
  const logPath = getLogPath();

  if (!existsSync(logPath)) {
    return false;
  }

  try {
    const stats = statSync(logPath);

    if (stats.size > maxLogSizeBytes) {
      const backupPath = `${logPath}.old`;

      // Remove old backup if exists
      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }

      // Rotate: current -> .old, then truncate current
      renameSync(logPath, backupPath);

      console.log(`Rotated log file (was ${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      return true;
    }
  } catch (error) {
    console.warn(`Error rotating log: ${error}`);
  }

  return false;
}

// Get total storage size (db + logs)
export function getTotalStorageSize(): number {
  let total = getDbSize();
  const logPath = getLogPath();
  const backupLogPath = `${logPath}.old`;

  try {
    if (existsSync(logPath)) {
      total += statSync(logPath).size;
    }
    if (existsSync(backupLogPath)) {
      total += statSync(backupLogPath).size;
    }
  } catch {
    // Ignore errors
  }

  return total;
}

// Get formatted total storage size
export function getTotalStorageSizeFormatted(): string {
  const bytes = getTotalStorageSize();
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
