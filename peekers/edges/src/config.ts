import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Config, RefreshConfig } from "./types";

// Get base directory
function getBaseDir(): string {
  if (process.env.POLYMARKET_EDGES_DIR) {
    return process.env.POLYMARKET_EDGES_DIR;
  }
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return join(homeDir, ".claude", "polymarket-edges");
}

// Default configuration
const defaultConfig: Config = {
  daemon: {
    enabled: true,
    logLevel: "info",
  },
  storage: {
    maxSizeBytes: 52428800, // 50MB
    maxWatchedMarkets: 200,
    maxPriceHistoryDays: 7,
    resolvedRetentionDays: 7,
    pruneAt: 0.9,
    targetAfterPrune: 0.8,
    maxLogSizeBytes: 5242880, // 5MB
  },
  refresh: {
    expiringSoon: { hours: 24, intervalMinutes: 10 },
    expiringWeek: { days: 7, intervalMinutes: 30 },
    longDated: { intervalMinutes: 120 },
  },
  portfolio: {
    wallet: "",
    syncIntervalMinutes: 60,
  },
  correlation: {
    portfolioWeight: 2.0,
  },
};

export function loadConfig(): Config {
  const baseDir = getBaseDir();
  const configPath = join(baseDir, "config.json");

  if (!existsSync(configPath)) {
    console.log(`No config.json found at ${configPath}, using defaults`);
    return defaultConfig;
  }

  try {
    const fileContent = readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(fileContent) as Partial<Config>;

    const merged: Config = {
      daemon: { ...defaultConfig.daemon, ...userConfig.daemon },
      storage: { ...defaultConfig.storage, ...userConfig.storage },
      refresh: { ...defaultConfig.refresh, ...userConfig.refresh },
      portfolio: { ...defaultConfig.portfolio, ...userConfig.portfolio },
      correlation: { ...defaultConfig.correlation, ...userConfig.correlation },
    };

    console.log(`Loaded config from ${configPath}`);
    return merged;
  } catch (error) {
    console.error(`Error loading config: ${error}`);
    return defaultConfig;
  }
}

// Calculate refresh interval based on market expiry
export function getRefreshIntervalMinutes(
  endDate: number,
  config: RefreshConfig
): number {
  const now = Math.floor(Date.now() / 1000);
  const hoursToExpiry = (endDate - now) / 3600;

  if (hoursToExpiry < (config.expiringSoon.hours || 24)) {
    return config.expiringSoon.intervalMinutes;
  }

  const daysToExpiry = hoursToExpiry / 24;
  if (daysToExpiry < (config.expiringWeek.days || 7)) {
    return config.expiringWeek.intervalMinutes;
  }

  return config.longDated.intervalMinutes;
}

// Check if market needs refresh
export function needsRefresh(
  lastRefreshed: number,
  endDate: number,
  config: RefreshConfig
): boolean {
  const intervalMinutes = getRefreshIntervalMinutes(endDate, config);
  const intervalSeconds = intervalMinutes * 60;
  const now = Math.floor(Date.now() / 1000);

  return now - lastRefreshed >= intervalSeconds;
}

export function getDbPath(): string {
  return join(getBaseDir(), "edges.db");
}

export function getLogPath(): string {
  return join(getBaseDir(), "daemon.log");
}

export { getBaseDir };
