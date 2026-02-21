import type { RawHeadline, TaggedHeadline, KeywordPattern } from "./types";

// Compile patterns once for efficiency
interface CompiledPattern {
  regex: RegExp;
  tag: string;
}

let compiledPatterns: CompiledPattern[] = [];

export function compilePatterns(patterns: KeywordPattern[]): void {
  compiledPatterns = patterns.map((p) => ({
    regex: new RegExp(p.match, "i"),
    tag: p.tag,
  }));
}

// Tag a single headline
export function tagHeadline(headline: RawHeadline): TaggedHeadline {
  const tags: Set<string> = new Set();
  const searchText = `${headline.title} ${headline.summary || ""}`.toLowerCase();

  for (const pattern of compiledPatterns) {
    if (pattern.regex.test(searchText)) {
      tags.add(pattern.tag);
    }
  }

  return {
    ...headline,
    relevanceTags: Array.from(tags),
    fetchedAt: Math.floor(Date.now() / 1000),
  };
}

// Tag multiple headlines
export function tagHeadlines(headlines: RawHeadline[]): TaggedHeadline[] {
  return headlines.map(tagHeadline);
}

// Check if headline matches any of the given tags
export function matchesTags(headline: TaggedHeadline, tags: string[]): boolean {
  return tags.some((tag) => headline.relevanceTags.includes(tag));
}

// Get all unique tags from headlines
export function getAllTags(headlines: TaggedHeadline[]): string[] {
  const tags = new Set<string>();
  for (const h of headlines) {
    for (const tag of h.relevanceTags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}
