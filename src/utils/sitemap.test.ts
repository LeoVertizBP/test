import { parseSitemap } from './sitemap'; // Adjust path if necessary

// Mock the global fetch function
global.fetch = jest.fn();

// Helper to create a mock fetch response
const createFetchResponse = (ok: boolean, text: () => Promise<string>, status: number = 200, statusText: string = 'OK') => ({
  ok,
  text,
  status,
  statusText,
});

// Sample XML data for testing
const sampleStandardSitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

const sampleSitemapIndexXML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
   <sitemap>
      <loc>https://example.com/sitemap1.xml</loc>
      <lastmod>2024-01-01</lastmod>
   </sitemap>
   <sitemap>
      <loc>https://example.com/sitemap2.xml</loc>
   </sitemap>
</sitemapindex>`;

const sampleNestedSitemap1XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/nested1</loc>
  </url>
</urlset>`;

const sampleNestedSitemap2XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/nested2</loc>
  </url>
  <url>
    <loc>https://example.com/page1</loc> <!-- Duplicate URL -->
  </url>
</urlset>`;


describe('sitemap utility', () => {
  // Clear mocks before each test
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    // We might need to mock console methods if we want to assert on logs
    // jest.spyOn(console, 'log').mockImplementation(() => {});
    // jest.spyOn(console, 'warn').mockImplementation(() => {});
    // jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console mocks if they were created
    // jest.restoreAllMocks();
  });

  describe('parseSitemap', () => {
    it('should parse a standard sitemap and return URLs', async () => {
      const sitemapUrl = 'https://example.com/sitemap.xml';
      (fetch as jest.Mock).mockResolvedValueOnce(
        createFetchResponse(true, () => Promise.resolve(sampleStandardSitemapXML))
      );

      const urls = await parseSitemap(sitemapUrl);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(sitemapUrl, expect.any(Object)); // Check URL and options presence
      expect(urls).toEqual(['https://example.com/page1', 'https://example.com/page2']);
    });

    it('should parse a sitemap index and recursively fetch nested sitemaps', async () => {
      const indexUrl = 'https://example.com/sitemap_index.xml';
      const nestedUrl1 = 'https://example.com/sitemap1.xml';
      const nestedUrl2 = 'https://example.com/sitemap2.xml';

      // Mock response for the index file
      (fetch as jest.Mock).mockResolvedValueOnce(
        createFetchResponse(true, () => Promise.resolve(sampleSitemapIndexXML))
      );
      // Mock responses for the nested sitemaps
      (fetch as jest.Mock).mockResolvedValueOnce(
        createFetchResponse(true, () => Promise.resolve(sampleNestedSitemap1XML))
      );
      (fetch as jest.Mock).mockResolvedValueOnce(
        createFetchResponse(true, () => Promise.resolve(sampleNestedSitemap2XML))
      );

      const urls = await parseSitemap(indexUrl);

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith(indexUrl, expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(nestedUrl1, expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(nestedUrl2, expect.any(Object));
      // Check for unique URLs from all nested sitemaps
      expect(urls).toEqual(expect.arrayContaining(['https://example.com/nested1', 'https://example.com/nested2', 'https://example.com/page1']));
      expect(urls.length).toBe(3); // Ensure uniqueness removed the duplicate 'page1'
    });

    it('should respect the maxUrls limit for a standard sitemap', async () => {
        const sitemapUrl = 'https://example.com/sitemap.xml';
        (fetch as jest.Mock).mockResolvedValueOnce(
          createFetchResponse(true, () => Promise.resolve(sampleStandardSitemapXML))
        );

        const maxUrls = 1;
        const urls = await parseSitemap(sitemapUrl, maxUrls);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urls).toEqual(['https://example.com/page1']);
        expect(urls.length).toBe(maxUrls);
      });

      it('should respect the maxUrls limit across nested sitemaps', async () => {
        const indexUrl = 'https://example.com/sitemap_index.xml';
        const nestedUrl1 = 'https://example.com/sitemap1.xml'; // Contains 1 URL
        const nestedUrl2 = 'https://example.com/sitemap2.xml'; // Contains 2 URLs

        (fetch as jest.Mock).mockResolvedValueOnce(createFetchResponse(true, () => Promise.resolve(sampleSitemapIndexXML)));
        (fetch as jest.Mock).mockResolvedValueOnce(createFetchResponse(true, () => Promise.resolve(sampleNestedSitemap1XML)));
        (fetch as jest.Mock).mockResolvedValueOnce(createFetchResponse(true, () => Promise.resolve(sampleNestedSitemap2XML))); // This might not be fetched if limit is hit

        const maxUrls = 2;
        const urls = await parseSitemap(indexUrl, maxUrls);

        // Depending on implementation, fetch might be called 2 or 3 times.
        // If it stops fetching *after* hitting the limit, it will be 3.
        // If it stops processing index entries *before* fetching, it might be 2.
        // Current implementation checks limit *after* processing each nested sitemap.
        expect(fetch).toHaveBeenCalledTimes(3); // Fetches index, then sitemap1, then sitemap2
        expect(urls).toEqual(['https://example.com/nested1', 'https://example.com/nested2']); // Gets 1 from sitemap1, then 1 from sitemap2 to hit limit
        expect(urls.length).toBe(maxUrls);
      });

      it('should handle fetch errors gracefully', async () => {
        const sitemapUrl = 'https://example.com/sitemap_error.xml';
        const error = new Error('Network Error');
        (fetch as jest.Mock).mockRejectedValueOnce(error);
        // Optional: Mock console.error to check if it's called
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});


        const urls = await parseSitemap(sitemapUrl);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urls).toEqual([]); // Should return empty array on fetch error
        expect(errorSpy).toHaveBeenCalledWith(`Error processing sitemap ${sitemapUrl}:`, error);

        errorSpy.mockRestore(); // Clean up spy
      });

      it('should handle non-OK fetch responses gracefully', async () => {
        const sitemapUrl = 'https://example.com/sitemap_404.xml';
        (fetch as jest.Mock).mockResolvedValueOnce(
          createFetchResponse(false, () => Promise.resolve('Not Found'), 404, 'Not Found')
        );
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const urls = await parseSitemap(sitemapUrl);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urls).toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error processing sitemap ${sitemapUrl}`), expect.any(Error));

        errorSpy.mockRestore();
      });

      it('should handle XML parsing errors gracefully', async () => {
        const sitemapUrl = 'https://example.com/sitemap_invalid.xml';
        const invalidXml = '<urlset><url><loc>https://example.com/page1</loc></url>'; // Malformed XML
        (fetch as jest.Mock).mockResolvedValueOnce(
          createFetchResponse(true, () => Promise.resolve(invalidXml))
        );
        // We expect parseStringPromise to throw an error here.
        // No need to mock xml2js for this specific case if parseStringPromise naturally throws on bad XML.
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const urls = await parseSitemap(sitemapUrl);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urls).toEqual([]); // Should return empty on parsing error
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error processing sitemap ${sitemapUrl}`), expect.any(Error));

        errorSpy.mockRestore();
      });

      it('should prevent infinite loops using visitedSitemaps', async () => {
        const indexUrl = 'https://example.com/sitemap_loop.xml';
        const loopingIndexXML = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
           <sitemap><loc>${indexUrl}</loc></sitemap> <!-- Points to itself -->
        </sitemapindex>`;

        (fetch as jest.Mock).mockResolvedValueOnce(
          createFetchResponse(true, () => Promise.resolve(loopingIndexXML))
        );
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const urls = await parseSitemap(indexUrl);

        expect(fetch).toHaveBeenCalledTimes(1); // Should only fetch the first time
        expect(urls).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(`Sitemap loop detected or already visited: ${indexUrl}`);

        warnSpy.mockRestore();
      });

      it('should handle unrecognized sitemap formats gracefully', async () => {
        const sitemapUrl = 'https://example.com/sitemap_unknown.xml';
        const unknownXml = `<?xml version="1.0" encoding="UTF-8"?><root><data>value</data></root>`;
        (fetch as jest.Mock).mockResolvedValueOnce(
          createFetchResponse(true, () => Promise.resolve(unknownXml))
        );
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const urls = await parseSitemap(sitemapUrl);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urls).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(`Unrecognized sitemap format for ${sitemapUrl}`);

        warnSpy.mockRestore();
      });
  });
});
