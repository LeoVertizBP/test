import { Page } from 'playwright';

/**
 * Scrolls the page to the bottom to ensure all lazy-loaded content is loaded.
 * It repeatedly scrolls down until the scroll height stops changing or a max scroll limit is reached.
 *
 * @param page The Playwright Page object to scroll.
 * @param timeoutMs Milliseconds to wait between scrolls to allow content to load. Default 100ms.
 * @param maxScrolls Maximum number of scroll attempts to prevent infinite loops. Default 50.
 * @param scrollDelayMs Milliseconds to wait after the final scroll stabilizes. Default 500ms.
 */
export async function autoScroll(
    page: Page,
    timeoutMs: number = 100,
    maxScrolls: number = 50,
    scrollDelayMs: number = 500
): Promise<void> {
    await page.evaluate(async ({ timeoutMs, maxScrolls, scrollDelayMs }) => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            let distance = 100; // Scroll distance per step
            let scrolls = 0; // Scroll counter

            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                scrolls++;

                // Stop if scroll height hasn't changed, or max scrolls reached,
                // or scrolled past the document height
                if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
                    clearInterval(timer);
                    // Wait a bit longer after the last scroll to ensure rendering
                    setTimeout(resolve, scrollDelayMs);
                }
            }, timeoutMs);
        });
    }, { timeoutMs, maxScrolls, scrollDelayMs }); // Pass parameters to evaluate
    console.log('Auto-scroll finished.');
}

// Add other page-related utilities here if needed in the future.
