// Configuration types
export interface DaemonConfig {
  intervalMinutes: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface StorageConfig {
  maxSizeBytes: number;
  maxAgeDays: number;
  pruneAt: number;
  targetAfterPrune: number;
  maxLogSizeBytes: number;
}

export interface FeedSource {
  name: string;
  url: string;
  priority: 1 | 2;
}

export interface FeedCategory {
  enabled: boolean;
  sources: FeedSource[];
}

export interface KeywordPattern {
  match: string;
  tag: string;
}

export interface KeywordsConfig {
  autoTag: boolean;
  patterns: KeywordPattern[];
}

export interface Config {
  daemon: DaemonConfig;
  storage: StorageConfig;
  feeds: Record<string, FeedCategory>;
  keywords: KeywordsConfig;
}

// Headline types
export interface RawHeadline {
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  categories: string[];
  publishedAt: number;
}

export interface TaggedHeadline extends RawHeadline {
  relevanceTags: string[];
  fetchedAt: number;
}

// Database row type
export interface HeadlineRow {
  id: number;
  source: string;
  source_url: string;
  title: string;
  summary: string;
  categories: string;
  published_at: number;
  fetched_at: number;
  relevance_tags: string;
}
