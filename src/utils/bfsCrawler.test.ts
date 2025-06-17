import { bfsCrawler } from './bfsCrawler'; // Adjust path if necessary

// Mock the global fetch function
global.fetch = jest.fn();

// Helper to create a mock fetch response for HTML content
const createHtmlFetchResponse = (ok: boolean, html: string, status: number = 200, statusText: string = 'OK', contentType: string = 'text/html') => ({
  ok,
  text: () => Promise.resolve(html),
  headers: {
    get: (headerName: string) => {
      if (headerName.toLowerCase() === 'content-type') {
        return contentType;
      }
      return null;
    },
  },
  status,
  statusText,
});

// Sample HTML data for testing
const sampleIndexHtml = `
<html><body>
  <h1>Homepage</h1>
  <a href="/page1">Page 1</a>
  <a href="https://example.com/page2">Page 2 (Absolute)</a>
  <a href="https://external.com/other">External Link</a>
  <a href="/page1#section">Page 1 with fragment</a>
  <a href="mailto:test@example.com">Mail Link</a>
  <a href="/page3">Page 3</a>
</body></html>`;

const samplePage1Html = `
<html><body>
  <h2>Page 1</h2>
  <a href="/">Homepage</a>
  <a href="../page2">Page 2 (Relative)</a> <!-- Resolves to example.com/page2 -->
</body></html>`;

const samplePage2Html = `
<html><body>
  <h3>Page 3</h3>
  <a href="page4.html">Page 4 (Relative)</a> <!-- Resolves to example.com/page4.html -->
</body></html>`;

const samplePage3Html = `
<html><body><h4>Page 3</h4><a href="/deep_page">Deep Page</a></body></html>`;

const samplePage4Html = `
<html><body><h5>Page 4</h5></body></html>`; // No links

const sampleDeepPageHtml = `
<html><body><h6>Deep Page</h6><a href="/final_page">Final Page</a></body></html>`;

const sampleFinalPageHtml = `
<html><body><p>Final</p></body></html>`;


describe('bfsCrawler utility', () => {
  beforeEach(() => {
    // Reset mocks and spies before each test
    (fetch as jest.Mock).mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should crawl pages within the same origin and return unique URLs', async () => {
    const startUrl = 'https://example.com/';

    (fetch as jest.Mock).mockImplementation(async (url: string) => {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      if (url === startUrl || path === '/') {
        return createHtmlFetchResponse(true, sampleIndexHtml);
      } else if (path === '/page1') {
        return createHtmlFetchResponse(true, samplePage1Html);
      } else if (path === '/page2') {
        return createHtmlFetchResponse(true, samplePage2Html);
      } else if (path === '/page3') {
        return createHtmlFetchResponse(true, samplePage3Html);
      } else if (path === '/page4.html') {
         return createHtmlFetchResponse(true, samplePage4Html);
      } else if (path === '/deep_page') {
        return createHtmlFetchResponse(true, sampleDeepPageHtml); // Included for depth test later
      } else if (path === '/final_page') {
        return createHtmlFetchResponse(true, sampleFinalPageHtml); // Included for depth test later
      }
      return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
    });

    const urls = await bfsCrawler(startUrl);

    // Expected URLs based on HTML samples within origin
    const expectedUrls = [
      'https://example.com/',
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
      'https://example.com/page4.html',
      'https://example.com/deep_page', // Found from page3
      'https://example.com/final_page' // Found from deep_page
    ];

    expect(urls).toEqual(expect.arrayContaining(expectedUrls));
    expect(urls.length).toBe(expectedUrls.length); // Ensure no duplicates or extras
    expect(fetch).toHaveBeenCalledTimes(expectedUrls.length); // Should fetch each unique page once
  });

  it('should respect maxPages limit', async () => {
    const startUrl = 'https://example.com/';
    const maxPages = 3;

     // Same mock implementation as above
     (fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        if (url === startUrl || path === '/') return createHtmlFetchResponse(true, sampleIndexHtml);
        if (path === '/page1') return createHtmlFetchResponse(true, samplePage1Html);
        if (path === '/page2') return createHtmlFetchResponse(true, samplePage2Html);
        if (path === '/page3') return createHtmlFetchResponse(true, samplePage3Html); // Might not be fetched
        return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
      });

    const urls = await bfsCrawler(startUrl, maxPages);

    expect(urls.length).toBe(maxPages);
    // The exact URLs depend on BFS order, but should include startUrl and 2 others from index.html
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/page1');
    expect(urls).toContain('https://example.com/page2');
    // Fetch might be called more than maxPages times initially, but the result set is limited
    // It fetches startUrl, finds 3 links (/page1, /page2, /page3), adds them to foundUrls. Limit hit.
    // It should only fetch the start URL.
    expect(fetch).toHaveBeenCalledTimes(1); // Only fetches startUrl
  });

  it('should respect maxDepth limit', async () => {
    const startUrl = 'https://example.com/';
    const maxDepth = 1; // Start page (depth 0) + links found on it (depth 1)

    // Same mock implementation as above
    (fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        if (url === startUrl || path === '/') return createHtmlFetchResponse(true, sampleIndexHtml); // Depth 0
        if (path === '/page1') return createHtmlFetchResponse(true, samplePage1Html); // Depth 1
        if (path === '/page2') return createHtmlFetchResponse(true, samplePage2Html); // Depth 1
        if (path === '/page3') return createHtmlFetchResponse(true, samplePage3Html); // Depth 1
        // Links found on depth 1 pages (like /page4.html or /deep_page) should not be crawled
        return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
      });

    const urls = await bfsCrawler(startUrl, undefined, maxDepth);

    // Should find start URL and links directly on it
    const expectedUrls = [
        'https://example.com/',
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
    ];
    expect(urls).toEqual(expect.arrayContaining(expectedUrls));
    expect(urls.length).toBe(expectedUrls.length);
    // Should only fetch depth 0 (startUrl). Links found are depth 1, exceeding maxDepth for fetching.
    expect(fetch).toHaveBeenCalledTimes(1); // Only fetches startUrl
  });

  it('should handle fetch errors for a page and continue', async () => {
    const startUrl = 'https://example.com/';
    (fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === startUrl) {
        return createHtmlFetchResponse(true, sampleIndexHtml); // Contains /page1, /page2, /page3
      } else if (url === 'https://example.com/page1') {
        return createHtmlFetchResponse(false, 'Server Error', 500, 'Server Error'); // Error fetching page1
      } else if (url === 'https://example.com/page2') {
        return createHtmlFetchResponse(true, samplePage2Html); // Contains /page4.html
      } else if (url === 'https://example.com/page3') {
         return createHtmlFetchResponse(true, samplePage3Html); // Contains /deep_page
      } else if (url === 'https://example.com/page4.html') {
         return createHtmlFetchResponse(true, samplePage4Html);
      } else if (url === 'https://example.com/deep_page') {
         return createHtmlFetchResponse(true, sampleDeepPageHtml);
      }
      return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
    });

    const urls = await bfsCrawler(startUrl);

    // Should contain all discoverable URLs, even if fetching one failed.
    // The crawler finds /page1 but fails to fetch it, so it won't find links *from* page1.
    const expectedUrls = [
        'https://example.com/',
        'https://example.com/page1', // Discovered from index
        'https://example.com/page2', // Discovered from index
        'https://example.com/page3', // Discovered from index
        'https://example.com/page4.html', // Discovered from page2
        'https://example.com/deep_page', // Discovered from page3
        'https://example.com/final_page' // Discovered from deep_page (fetch mock needs to handle this)
    ];
    // Adjusting expectation based on provided mock - final_page won't be fetched unless added to mock
    const expectedUrlsBasedOnMock = [
        'https://example.com/',
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4.html', // Discovered from page2
        'https://example.com/deep_page', // Discovered from page3
        // final_page is NOT discovered because the mock for deep_page doesn't include it here.
    ];
    // Let's update the mock to include final_page discovery
    (fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (url === startUrl) return createHtmlFetchResponse(true, sampleIndexHtml);
        if (url === 'https://example.com/page1') return createHtmlFetchResponse(false, 'Server Error', 500, 'Server Error');
        if (url === 'https://example.com/page2') return createHtmlFetchResponse(true, samplePage2Html);
        if (url === 'https://example.com/page3') return createHtmlFetchResponse(true, samplePage3Html);
        if (url === 'https://example.com/page4.html') return createHtmlFetchResponse(true, samplePage4Html);
        if (url === 'https://example.com/deep_page') return createHtmlFetchResponse(true, sampleDeepPageHtml); // Contains /final_page
        if (url === 'https://example.com/final_page') return createHtmlFetchResponse(true, sampleFinalPageHtml); // Final page fetch
        return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
      });
    // The initial call to bfsCrawler above will now use this updated mock
    // const urls = await bfsCrawler(startUrl); // REMOVE THIS REDECLARATION

    const finalExpectedUrls = [
        'https://example.com/',
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4.html',
        'https://example.com/deep_page',
        'https://example.com/final_page', // Now expected
    ];

    expect(urls).toEqual(expect.arrayContaining(finalExpectedUrls));
    expect(urls.length).toBe(finalExpectedUrls.length); // Should be 7
    // We still expect the warning about the failed fetch
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch https://example.com/page1: 500 Server Error'));
  });

  it('should skip non-HTML content', async () => {
    const startUrl = 'https://example.com/';
     // REMOVE THIS INCOMPLETE MOCK - the comprehensive one below should be used.
     /* (fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === startUrl) {
        // Link to a PDF and a valid page
        return createHtmlFetchResponse(true, '<html><body><a href="/document.pdf">PDF</a><a href="/page1">Page 1</a></body></html>');
      } else if (url === 'https://example.com/document.pdf') {
        // Return non-html content type
        return createHtmlFetchResponse(true, 'PDF Content', 200, 'OK', 'application/pdf');
      } else if (url === 'https://example.com/page1') {
        return createHtmlFetchResponse(true, samplePage1Html);
      }
      return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
    }); */

    // Define the comprehensive mock *before* calling the crawler for this test
    (fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === startUrl) return createHtmlFetchResponse(true, '<html><body><a href="/document.pdf">PDF</a><a href="/page1">Page 1</a></body></html>');
      if (url === 'https://example.com/document.pdf') return createHtmlFetchResponse(true, 'PDF Content', 200, 'OK', 'application/pdf');
      if (url === 'https://example.com/page1') return createHtmlFetchResponse(true, samplePage1Html); // Contains / and ../page2 -> /page2
      if (url === 'https://example.com/page2') return createHtmlFetchResponse(true, samplePage2Html); // Contains page4.html
      if (url === 'https://example.com/page4.html') return createHtmlFetchResponse(true, samplePage4Html);
      return createHtmlFetchResponse(false, 'Not Found', 404, 'Not Found');
    });

    const urls = await bfsCrawler(startUrl); // Now uses the mock above

    // Original expectedUrls array is not needed here anymore
    // const expectedUrls = [
    //     'https://example.com/',
     // The crawler discovers /document.pdf and /page1 from the start page.
     // It fetches /document.pdf (sees non-HTML, skips crawling from it).
     // It fetches /page1, discovers /page2.
     // It fetches /page2, discovers /page4.html.
     // It fetches /page4.html.
     const finalExpectedUrls = [
        'https://example.com/',
        'https://example.com/document.pdf', // Discovered
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page4.html', // Now discovered from page2
     ];


    expect(urls).toEqual(expect.arrayContaining(finalExpectedUrls));
    expect(urls.length).toBe(finalExpectedUrls.length);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping non-HTML content at https://example.com/document.pdf'));
    // Fetched: /, document.pdf (skipped), page1, page2, page4.html
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('should return empty array for invalid start URL', async () => {
    const invalidStartUrl = 'invalid-url';
    // Call the function and store the result in a new variable or directly assert
    const resultUrls = await bfsCrawler(invalidStartUrl);
    expect(resultUrls).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    // Check console.error call more robustly
    expect(console.error).toHaveBeenCalledTimes(1);
    const errorArgs = (console.error as jest.Mock).mock.calls[0];
    expect(errorArgs[0]).toBe(`Invalid start URL: ${invalidStartUrl}`); // Check message string
    expect(errorArgs[1].name).toBe('TypeError'); // Check error name property instead
  });

});
