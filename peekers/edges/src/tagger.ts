// Default keyword patterns for auto-tagging markets
const defaultPatterns: { match: RegExp; tag: string }[] = [
  { match: /\biran\b|tehran|khamenei|iranian/i, tag: "iran" },
  { match: /\btrump\b|white house|oval office|maga/i, tag: "trump" },
  { match: /\bopenai\b|gpt|chatgpt|altman/i, tag: "openai" },
  { match: /\banthropic\b|claude/i, tag: "anthropic" },
  { match: /\bgoogle\b|gemini|deepmind/i, tag: "google" },
  { match: /\bbitcoin\b|btc|crypto|ethereum|eth\b/i, tag: "crypto" },
  { match: /\bukraine\b|zelensky|kyiv|kiev/i, tag: "ukraine" },
  { match: /\brussia\b|putin|kremlin|moscow/i, tag: "russia" },
  { match: /\bchina\b|beijing|xi jinping|ccp/i, tag: "china" },
  { match: /\bisrael\b|netanyahu|gaza|hamas/i, tag: "israel" },
  { match: /\bfed\b|federal reserve|interest rate|powell/i, tag: "fed" },
  { match: /\belon\b|musk|tesla|spacex|doge\b/i, tag: "musk" },
  { match: /\bnba\b|basketball|finals/i, tag: "nba" },
  { match: /\bnfl\b|super bowl|football/i, tag: "nfl" },
  { match: /\bpremier league\b|epl|arsenal|chelsea|liverpool|manchester/i, tag: "epl" },
  { match: /\bla liga\b|barcelona|real madrid/i, tag: "laliga" },
  { match: /\bworld cup\b|fifa/i, tag: "worldcup" },
  { match: /\bolympics\b|olympic/i, tag: "olympics" },
  { match: /\bai\b|artificial intelligence|agi\b/i, tag: "ai" },
  { match: /\bimpeach/i, tag: "impeachment" },
  { match: /\bpardon\b|clemency/i, tag: "pardon" },
  { match: /\btariff/i, tag: "tariffs" },
  { match: /\bceasefire\b/i, tag: "ceasefire" },
  { match: /\bstrike\b|military|attack/i, tag: "military" },
];

// Extract tags from market question
export function extractTags(question: string): string[] {
  const tags = new Set<string>();

  for (const pattern of defaultPatterns) {
    if (pattern.match.test(question)) {
      tags.add(pattern.tag);
    }
  }

  return Array.from(tags);
}

// Merge existing tags with new ones
export function mergeTags(existing: string[], newTags: string[]): string[] {
  const merged = new Set([...existing, ...newTags]);
  return Array.from(merged);
}

// Check if two markets share tags
export function getSharedTags(tags1: string[], tags2: string[]): string[] {
  return tags1.filter(t => tags2.includes(t));
}
