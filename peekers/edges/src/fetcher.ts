import type { GammaMarket } from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com";

// Fetch market data from Gamma API
export async function fetchMarket(slug: string): Promise<GammaMarket | null> {
  try {
    const response = await fetch(`${GAMMA_API}/markets?slug=${slug}`, {
      headers: { "User-Agent": "PolymarketEdgesBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const markets = await response.json();
    if (!Array.isArray(markets) || markets.length === 0) return null;

    return markets[0] as GammaMarket;
  } catch (error) {
    console.warn(`Error fetching market ${slug}: ${error}`);
    return null;
  }
}

// Fetch multiple markets by slug
export async function fetchMarkets(slugs: string[]): Promise<Map<string, GammaMarket>> {
  const results = new Map<string, GammaMarket>();

  // Batch into groups of 10 for parallel fetching
  const batchSize = 10;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const promises = batch.map(slug => fetchMarket(slug));
    const batchResults = await Promise.allSettled(promises);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[index], result.value);
      }
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < slugs.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// Parse price from Gamma API format
export function parsePrice(outcomePrices: string | null): number | null {
  if (!outcomePrices) return null;
  try {
    const prices = JSON.parse(outcomePrices);
    if (Array.isArray(prices) && prices.length >= 1) {
      return parseFloat(prices[0]);
    }
  } catch {
    // ignore
  }
  return null;
}

// Parse end date from Gamma API format
export function parseEndDate(endDate: string | null): number | null {
  if (!endDate) return null;
  try {
    return Math.floor(new Date(endDate).getTime() / 1000);
  } catch {
    return null;
  }
}

// Extract market data for storage
export function extractMarketData(market: GammaMarket): {
  yes_price: number | null;
  volume: number | null;
  liquidity: number | null;
  end_date: number | null;
} {
  return {
    yes_price: parsePrice(market.outcomePrices),
    volume: market.volumeNum || (market.volume ? parseFloat(market.volume) : null),
    liquidity: market.liquidityNum || (market.liquidity ? parseFloat(market.liquidity) : null),
    end_date: parseEndDate(market.endDate),
  };
}

// Check if market is resolved (closed)
export function isResolved(market: GammaMarket): boolean {
  return market.closed === true;
}
