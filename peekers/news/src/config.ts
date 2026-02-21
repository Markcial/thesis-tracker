import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import type { Config } from "./types";

// Get the directory where config/db should be stored
function getBaseDir(): string {
  // Check for explicit env var first
  if (process.env.POLYMARKET_NEWS_DIR) {
    return process.env.POLYMARKET_NEWS_DIR;
  }

  // Default to ~/.claude/polymarket-news
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return join(homeDir, ".claude", "polymarket-news");
}

// Default configuration
const defaultConfig: Config = {
  daemon: {
    intervalMinutes: 10,
    logLevel: "info",
  },
  storage: {
    maxSizeBytes: 419430400, // 400MB
    maxAgeDays: 7,
    pruneAt: 0.9,
    targetAfterPrune: 0.8,
    maxLogSizeBytes: 10485760, // 10MB
  },
  feeds: {
    geopolitics: {
      enabled: true,
      sources: [
        { name: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", priority: 1 },
        { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", priority: 1 },
        { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", priority: 2 },
      ],
    },
    tech: {
      enabled: true,
      sources: [
        { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", priority: 1 },
        { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", priority: 2 },
        { name: "TechCrunch", url: "https://techcrunch.com/feed/", priority: 2 },
      ],
    },
    finance: {
      enabled: true,
      sources: [
        { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", priority: 1 },
      ],
    },
    crypto: {
      enabled: true,
      sources: [
        { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", priority: 1 },
        { name: "The Block", url: "https://www.theblock.co/rss.xml", priority: 2 },
      ],
    },
    sports: {
      enabled: false,
      sources: [
        { name: "ESPN", url: "https://www.espn.com/espn/rss/news", priority: 1 },
        { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", priority: 2 },
      ],
    },
  },
  keywords: {
    autoTag: true,
    patterns: [
      { match: "iran|tehran|khamenei|iranian", tag: "iran" },
      { match: "trump|white house|oval office|maga", tag: "trump" },
      { match: "openai|gpt|chatgpt|altman|gpt-5", tag: "openai" },
      { match: "anthropic|claude", tag: "anthropic" },
      { match: "google|gemini|deepmind", tag: "google" },
      { match: "bitcoin|btc|crypto|ethereum|eth", tag: "crypto" },
      { match: "ukraine|zelensky|kyiv|kiev", tag: "ukraine" },
      { match: "russia|putin|kremlin|moscow", tag: "russia" },
      { match: "china|beijing|xi jinping|ccp", tag: "china" },
      { match: "israel|netanyahu|gaza|hamas", tag: "israel" },
      { match: "fed|federal reserve|interest rate|powell", tag: "fed" },
      { match: "elon|musk|tesla|spacex|doge", tag: "musk" },
    ],
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

    // Deep merge with defaults
    const merged: Config = {
      daemon: { ...defaultConfig.daemon, ...userConfig.daemon },
      storage: { ...defaultConfig.storage, ...userConfig.storage },
      feeds: { ...defaultConfig.feeds, ...userConfig.feeds },
      keywords: {
        autoTag: userConfig.keywords?.autoTag ?? defaultConfig.keywords.autoTag,
        patterns: [
          ...defaultConfig.keywords.patterns,
          ...(userConfig.keywords?.patterns || []),
        ],
      },
    };

    console.log(`Loaded config from ${configPath}`);
    return merged;
  } catch (error) {
    console.error(`Error loading config: ${error}`);
    console.log("Using default configuration");
    return defaultConfig;
  }
}

export function getDbPath(): string {
  const baseDir = getBaseDir();
  return join(baseDir, "news.db");
}

export function getLogPath(): string {
  const baseDir = getBaseDir();
  return join(baseDir, "daemon.log");
}

export { getBaseDir };
