import * as cheerio from 'cheerio';
import { URL } from 'url'; // Node's built-in URL class

// We'll use Node's built-in fetch API
// import fetch from 'node-fetch'; // Use this if needed

interface QueueItem {
  url: string;
  depth: number;
}

/**
 * Performs a Breadth-First Search (BFS) crawl starting from a given URL
 * to discover pages within the same domain.
 * IMPORTANT: This crawler deliberately ignores robots.txt and exclusion patterns.
 *
 * @param startUrl The initial URL to start crawling from.
 * @param maxPages Optional maximum number of unique pages to discover.
 * @param maxDepth Optional maximum depth of links to follow (0 = start page only).
 * @returns A promise that resolves to an array of unique page URLs found within the domain.
 */
export async function bfsCrawler(
  startUrl: string,
  maxPages?: number,
  maxDepth?: number
): Promise<string[]> {
  const foundUrls = new Set<string>();
  const visitedUrls = new Set<string>();
  const queue: QueueItem[] = [];

  let baseUrl: URL;
  try {
    baseUrl = new URL(startUrl);
    // Normalize start URL (remove hash, trailing slash if desired - though less critical here)
    const normalizedStartUrl = `${baseUrl.origin}${baseUrl.pathname}`;
    queue.push({ url: normalizedStartUrl, depth: 0 });
    visitedUrls.add(normalizedStartUrl);
    foundUrls.add(normalizedStartUrl); // Add the start URL itself
  } catch (error) {
    console.error(`Invalid start URL: ${startUrl}`, error);
    return [];
  }

  const origin = baseUrl.origin; // e.g., "https://www.example.com"

  console.log(`Starting BFS crawl from: ${startUrl}, Origin: ${origin}, Max Pages: ${maxPages ?? 'unlimited'}, Max Depth: ${maxDepth ?? 'unlimited'}`);

  while (queue.length > 0) {
    // Check page limit before processing next item
    if (maxPages !== undefined && foundUrls.size >= maxPages) {
      console.log(`Reached max page limit (${maxPages}). Stopping crawl.`);
      break;
    }

    const currentItem = queue.shift(); // Get the next URL from the front of the queue
    if (!currentItem) continue; // Should not happen, but type guard

    const { url: currentUrl, depth: currentDepth } = currentItem;

    // Check depth limit
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      console.log(`Skipping ${currentUrl} - Reached max depth (${maxDepth})`);
      continue;
    }

    console.log(`Crawling [Depth ${currentDepth}]: ${currentUrl}`);

    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'ComplianceScraper/1.0 (+mailto:travis@10xtravel.com)',
          'Accept': 'text/html', // Prefer HTML content
        },
        redirect: 'follow', // Follow redirects
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${currentUrl}: ${response.status} ${response.statusText}`);
        continue; // Skip this page on error
      }

      // Ensure we are processing HTML content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        console.log(`Skipping non-HTML content at ${currentUrl} (Type: ${contentType})`);
        continue;
      }

      const htmlContent = await response.text();
      const $ = cheerio.load(htmlContent);

      // Find all anchor tags with an href attribute
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          // Resolve the relative URL against the current page's URL
          const absoluteUrl = new URL(href, currentUrl).toString();

          // Basic cleanup: remove URL fragment (#...)
          const urlWithoutFragment = absoluteUrl.split('#')[0];

          // Check if the URL is within the same origin (domain)
          if (urlWithoutFragment.startsWith(origin)) {
            // Check if we haven't visited this URL before
            if (!visitedUrls.has(urlWithoutFragment)) {
              visitedUrls.add(urlWithoutFragment);

              // Check page limit before adding
              if (maxPages === undefined || foundUrls.size < maxPages) {
                 foundUrls.add(urlWithoutFragment);
                 queue.push({ url: urlWithoutFragment, depth: currentDepth + 1 });
                 // console.log(`  Found new URL: ${urlWithoutFragment}`);
              } else {
                 // If we add to queue here, we might exceed maxPages slightly
                 // when processing the queue later. Stopping adding is safer.
                 console.log(`Max page limit (${maxPages}) reached while finding links. Not adding: ${urlWithoutFragment}`);
                 return false; // Stop processing more links on this page if limit hit
              }
            }
          }
        } catch (urlError) {
          // Ignore invalid URLs (e.g., mailto:, javascript:)
          // console.warn(`Ignoring invalid or non-HTTP URL: ${href} on page ${currentUrl}`);
        }
      });

    } catch (fetchError) {
      console.error(`Error fetching or processing ${currentUrl}:`, fetchError);
      // Continue to the next URL in the queue
    }
  } // end while loop

  console.log(`BFS crawl finished. Found ${foundUrls.size} unique URLs within ${origin}.`);
  return Array.from(foundUrls);
}

// Example usage (can be removed or kept for testing)
/*
async function testCrawler() {
  const testUrl = 'https://www.google.com/'; // Replace with a site to test
  const pageLimit = 25;
  const depthLimit = 2;
  try {
    const urls = await bfsCrawler(testUrl, pageLimit, depthLimit);
    console.log(`Found ${urls.length} URLs (Limit: ${pageLimit} pages, ${depthLimit} depth):`);
    urls.forEach(url => console.log(url));
  } catch (error) {
    console.error('Crawler test failed:', error);
  }
}

// testCrawler();
*/
