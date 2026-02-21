// Configuration types
export interface DaemonConfig {
  enabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface StorageConfig {
  maxSizeBytes: number;
  maxWatchedMarkets: number;
  maxPriceHistoryDays: number;
  resolvedRetentionDays: number;
  pruneAt: number;
  targetAfterPrune: number;
  maxLogSizeBytes: number;
}

export interface RefreshTier {
  hours?: number;
  days?: number;
  intervalMinutes: number;
}

export interface RefreshConfig {
  expiringSoon: RefreshTier;
  expiringWeek: RefreshTier;
  longDated: RefreshTier;
}

export interface PortfolioConfig {
  wallet: string;
  syncIntervalMinutes: number;
}

export interface CorrelationConfig {
  portfolioWeight: number;
}

export interface Config {
  daemon: DaemonConfig;
  storage: StorageConfig;
  refresh: RefreshConfig;
  portfolio: PortfolioConfig;
  correlation: CorrelationConfig;
}

// Market types
export interface Market {
  slug: string;
  question: string;
  yes_price: number;
  volume: number;
  liquidity: number;
  end_date: number;
  last_refreshed: number;
  watch_source: "portfolio" | "analyzed" | "manual";
  in_portfolio: boolean;
  portfolio_outcome?: "yes" | "no";
  portfolio_size?: number;
  tags: string[];
  edge_type?: "mispricing" | "lottery" | "none";
  edge_direction?: "yes_underpriced" | "no_underpriced";
  thesis?: string;
  confidence?: "high" | "medium" | "low";
  thesis_updated?: number;
  resolution_criteria?: string;
  resolved: boolean;
  resolved_outcome?: "yes" | "no";
  added_at: number;
}

export interface MarketRow {
  id: number;
  slug: string;
  question: string;
  yes_price: number;
  volume: number;
  liquidity: number;
  end_date: number;
  last_refreshed: number;
  watch_source: string;
  in_portfolio: number;
  portfolio_outcome: string | null;
  portfolio_size: number | null;
  tags: string;
  edge_type: string | null;
  edge_direction: string | null;
  thesis: string | null;
  confidence: string | null;
  thesis_updated: number | null;
  resolution_criteria: string | null;
  resolved: number;
  resolved_outcome: string | null;
  added_at: number;
}

export interface PriceHistoryRow {
  market_slug: string;
  yes_price: number;
  volume: number;
  recorded_at: number;
}

export interface PortfolioPosition {
  slug: string;
  question: string;
  outcome: "yes" | "no";
  size: number;
  currentPrice: number;
}

export interface GammaMarket {
  slug: string;
  question: string;
  outcomePrices: string;
  volume?: string;
  volumeNum?: number;
  liquidity?: string;
  liquidityNum?: number;
  endDate: string;
  description?: string;
  active: boolean;
  closed: boolean;
}

export interface CorrelatedMarket {
  slug: string;
  question: string;
  yes_price: number;
  in_portfolio: boolean;
  edge_type: string | null;
  score: number;
  sharedTags: string[];
}

// Analytical Framework Types

export type Signal = "green" | "yellow" | "red";
export type SourceTier = 1 | 2 | 3 | 4;
export type PositionTaken = "yes" | "no" | "pass";

export interface ContriarianSignals {
  priceExtreme: boolean;
  volumeSpike: boolean;
  newsMismatch: boolean;
  echoChamber: boolean;
}

export interface BiasScores {
  recency: number;
  availability: number;
  anchoring: number;
  confirmation: number;
  favoriteLongshot: number;
  bandwagon: number;
}

export interface ThesisAnalysis {
  marketSlug: string;
  signal: Signal;
  oneLiner: string;

  // Layer 1: Contrarian
  contrarianScore: number;
  contrarianSignals: ContriarianSignals;

  // Layer 2: Source
  sourceTier: SourceTier;
  sourceDescription: string;

  // Layer 3: Biases
  biasScores: BiasScores;
  biasTotal: number;

  // Thesis
  thesisText: string;

  // Position
  positionTaken: PositionTaken;
  positionPrice?: number;
}

export interface ThesisHistoryRow {
  id: number;
  market_slug: string;
  created_at: number;
  signal: string;
  one_liner: string;
  contrarian_score: number;
  contrarian_signals: string;
  source_tier: number;
  source_description: string | null;
  bias_recency: number;
  bias_availability: number;
  bias_anchoring: number;
  bias_confirmation: number;
  bias_favlong: number;
  bias_bandwagon: number;
  bias_total: number;
  thesis_text: string | null;
  position_taken: string | null;
  position_price: number | null;
}
