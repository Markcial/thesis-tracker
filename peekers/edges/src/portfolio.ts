import type { PortfolioPosition } from "./types";

const DATA_API = "https://data-api.polymarket.com";

// Fetch positions for a wallet
export async function fetchPortfolioPositions(wallet: string): Promise<PortfolioPosition[]> {
  if (!wallet) return [];

  try {
    const response = await fetch(`${DATA_API}/positions?user=${wallet}`, {
      headers: { "User-Agent": "PolymarketEdgesBot/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch portfolio: ${response.status}`);
      return [];
    }

    const positions = await response.json();
    if (!Array.isArray(positions)) return [];

    // Filter for active positions with value
    return positions
      .filter((p: any) => p.currentValue > 0.5) // At least $0.50 value
      .map((p: any) => ({
        slug: extractSlugFromTitle(p.title),
        question: p.title,
        outcome: p.outcome?.toLowerCase() === "yes" ? "yes" : "no",
        size: p.size || 0,
        currentPrice: p.curPrice || 0,
      }));
  } catch (error) {
    console.warn(`Error fetching portfolio: ${error}`);
    return [];
  }
}

// Extract slug from market title (best effort)
// The Data API returns title, not slug, so we need to derive it
function extractSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

// Fetch slug by searching Gamma API for question match
export async function findSlugByQuestion(question: string): Promise<string | null> {
  try {
    // Search for market by question text
    const searchTerm = encodeURIComponent(question.slice(0, 50));
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?closed=false&limit=10`,
      {
        headers: { "User-Agent": "PolymarketEdgesBot/1.0" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return null;

    const markets = await response.json();
    if (!Array.isArray(markets)) return null;

    // Find best match
    const normalizedQuestion = question.toLowerCase();
    for (const market of markets) {
      if (market.question?.toLowerCase().includes(normalizedQuestion.slice(0, 30))) {
        return market.slug;
      }
    }

    return null;
  } catch {
    return null;
  }
}
