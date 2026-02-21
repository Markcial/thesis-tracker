import { XMLParser } from "fast-xml-parser";
import type { FeedSource, FeedCategory, RawHeadline } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// Parse RSS date to Unix timestamp
function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  try {
    const date = new Date(dateStr);
    return Math.floor(date.getTime() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

// Extract text content, handling CDATA
function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (content?.["#text"]) return content["#text"];
  if (content?.["__cdata"]) return content["__cdata"];
  return String(content || "");
}

// Strip HTML tags from text
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

// Fetch and parse a single RSS feed
async function fetchFeed(source: FeedSource, category: string): Promise<RawHeadline[]> {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "PolymarketNewsBot/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);

    // Handle both RSS 2.0 and Atom formats
    let items: any[] = [];

    // RSS 2.0 format
    if (parsed.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item];
    }
    // Atom format
    else if (parsed.feed?.entry) {
      items = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry];
    }
    // RDF format (older RSS)
    else if (parsed["rdf:RDF"]?.item) {
      items = Array.isArray(parsed["rdf:RDF"].item)
        ? parsed["rdf:RDF"].item
        : [parsed["rdf:RDF"].item];
    }

    const headlines: RawHeadline[] = items.map((item: any) => {
      // Get title
      const title = extractText(item.title) || "Untitled";

      // Get link/URL
      let sourceUrl = "";
      if (item.link) {
        sourceUrl = typeof item.link === "string"
          ? item.link
          : item.link["@_href"] || item.link["#text"] || "";
      }

      // Get summary/description
      let summary = "";
      if (item.description) {
        summary = stripHtml(extractText(item.description));
      } else if (item.summary) {
        summary = stripHtml(extractText(item.summary));
      } else if (item.content) {
        summary = stripHtml(extractText(item.content)).slice(0, 500);
      }

      // Get published date
      const pubDate = item.pubDate || item.published || item["dc:date"] || item.date;
      const publishedAt = parseDate(pubDate);

      // Get categories
      let categories: string[] = [category];
      if (item.category) {
        const cats = Array.isArray(item.category) ? item.category : [item.category];
        for (const cat of cats) {
          const catText = extractText(cat);
          if (catText && !categories.includes(catText.toLowerCase())) {
            categories.push(catText.toLowerCase());
          }
        }
      }

      return {
        source: source.name,
        sourceUrl,
        title: stripHtml(title),
        summary: summary.slice(0, 1000), // Limit summary length
        categories,
        publishedAt,
      };
    });

    return headlines;
  } catch (error) {
    console.warn(`Error fetching ${source.name}: ${error}`);
    return [];
  }
}

// Fetch all feeds from all enabled categories
export async function fetchAllFeeds(
  feeds: Record<string, FeedCategory>
): Promise<RawHeadline[]> {
  const allHeadlines: RawHeadline[] = [];
  const fetchPromises: Promise<RawHeadline[]>[] = [];

  for (const [category, config] of Object.entries(feeds)) {
    if (!config.enabled) continue;

    // Sort by priority (1 first)
    const sortedSources = [...config.sources].sort((a, b) => a.priority - b.priority);

    for (const source of sortedSources) {
      fetchPromises.push(fetchFeed(source, category));
    }
  }

  // Fetch all in parallel
  const results = await Promise.allSettled(fetchPromises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      allHeadlines.push(...result.value);
    }
  }

  // Deduplicate by title (some feeds may have overlapping stories)
  const seen = new Set<string>();
  const unique = allHeadlines.filter((h) => {
    const key = h.title.toLowerCase().slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

// Get enabled source count
export function getEnabledSourceCount(feeds: Record<string, FeedCategory>): number {
  let count = 0;
  for (const config of Object.values(feeds)) {
    if (config.enabled) {
      count += config.sources.length;
    }
  }
  return count;
}
