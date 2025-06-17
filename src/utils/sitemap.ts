import { parseStringPromise } from 'xml2js';
// We'll use Node's built-in fetch API, available globally in Node 18+
// import fetch from 'node-fetch'; // Use this if on older Node versions or prefer it

// Define interfaces for the expected structure of parsed sitemap XML
// This helps with type safety and code clarity.
interface SitemapUrl {
  loc: string[]; // Array because xml2js parses tags into arrays
  // other tags like lastmod, changefreq, priority could be added if needed
}

interface SitemapIndexEntry {
  loc: string[];
  // lastmod could be added if needed
}

interface ParsedSitemap {
  urlset?: {
    url: SitemapUrl[];
  };
  sitemapindex?: {
    sitemap: SitemapIndexEntry[];
  };
}

/**
 * Fetches and parses a sitemap.xml file or a sitemap index file.
 * Handles nested sitemap indexes recursively.
 *
 * @param sitemapUrl The URL of the sitemap or sitemap index to fetch.
 * @param maxUrls Optional limit for the number of URLs to return (for testing).
 * @param visitedSitemaps Set to track visited sitemap URLs and prevent infinite loops.
 * @returns A promise that resolves to an array of unique page URLs found.
 */
export async function parseSitemap(
  sitemapUrl: string,
  maxUrls?: number,
  visitedSitemaps: Set<string> = new Set()
): Promise<string[]> {
  if (visitedSitemaps.has(sitemapUrl)) {
    console.warn(`Sitemap loop detected or already visited: ${sitemapUrl}`);
    return []; // Avoid infinite loops
  }
  visitedSitemaps.add(sitemapUrl);

  console.log(`Fetching sitemap: ${sitemapUrl}`);
  let urls: string[] = [];

  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        // It's good practice to identify our bot
        'User-Agent': 'ComplianceScraper/1.0 (+mailto:travis@10xtravel.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap ${sitemapUrl}: ${response.statusText}`);
    }

    const xmlContent = await response.text();
    const parsed: ParsedSitemap = await parseStringPromise(xmlContent);

    // Check if it's a sitemap index file
    if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
      console.log(`Detected sitemap index: ${sitemapUrl}`);
      const sitemapEntries = parsed.sitemapindex.sitemap;
      for (const entry of sitemapEntries) {
        if (entry.loc && entry.loc[0]) {
          // Recursively parse nested sitemaps
          const nestedUrls = await parseSitemap(entry.loc[0], maxUrls, visitedSitemaps);
          urls = urls.concat(nestedUrls);
          // Check if we've hit the limit after processing each nested sitemap
          if (maxUrls !== undefined && urls.length >= maxUrls) {
            break; // Stop processing more sitemaps if limit reached
          }
        }
      }
    }
    // Check if it's a regular sitemap file
    else if (parsed.urlset && parsed.urlset.url) {
      console.log(`Processing standard sitemap: ${sitemapUrl}`);
      const urlEntries = parsed.urlset.url;
      for (const entry of urlEntries) {
        if (entry.loc && entry.loc[0]) {
          urls.push(entry.loc[0]);
          // Check if we've hit the limit after adding each URL
          if (maxUrls !== undefined && urls.length >= maxUrls) {
            break; // Stop processing more URLs if limit reached
          }
        }
      }
    } else {
      console.warn(`Unrecognized sitemap format for ${sitemapUrl}`);
    }

  } catch (error) {
    console.error(`Error processing sitemap ${sitemapUrl}:`, error);
    // Decide if we should throw, return empty, or partial results
    // For now, return what we have, but log the error
  }

  // Apply the limit *after* processing everything (or breaking early)
  // Also, ensure uniqueness
  const uniqueUrls = [...new Set(urls)];
  return maxUrls === undefined ? uniqueUrls : uniqueUrls.slice(0, maxUrls);
}

// Example usage (can be removed or kept for testing)
/*
async function testSitemap() {
  // Replace with a real sitemap URL for testing
  const testUrl = 'https://www.example.com/sitemap.xml';
  const limit = 25;
  try {
    const urls = await parseSitemap(testUrl, limit);
    console.log(`Found ${urls.length} URLs (limit ${limit}):`);
    urls.forEach(url => console.log(url));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// testSitemap();
*/
