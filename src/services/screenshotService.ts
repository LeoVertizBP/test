import { chromium, Browser, Page } from 'playwright';
import * as logger from '../utils/logUtil'; // Use namespace import

/**
 * Captures a frame from a YouTube video at a specific time using Playwright.
 *
 * @param videoId The 11-character YouTube video ID.
 * @param seconds The time in seconds (float or integer) to capture the frame.
 * @returns A Promise resolving to the PNG image buffer, or null if capture fails.
 */
const MODULE_NAME = 'ScreenshotService';

export async function captureYoutubeFrame(videoId: string, seconds: number): Promise<Buffer | null> {
    let browser: Browser | null = null;
    logger.info(MODULE_NAME, `Attempting to capture frame for video ${videoId} at ${seconds}s`);

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--mute-audio', '--disable-gpu', '--no-sandbox'] // Recommended args for stability
        });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }, // Use a common video resolution
            locale: 'en-US', // Set locale to avoid potential region-specific UI differences
        });
        const page: Page = await context.newPage();

        // Revert to standard watch URL with time parameter
        const timeParam = Math.floor(seconds);
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}&t=${timeParam}s&autoplay=0`;

        logger.info(MODULE_NAME, `Navigating to watch URL: ${watchUrl}`);
        // Wait only for DOM content, not full network idle, to pause faster
        await page.goto(watchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        logger.info(MODULE_NAME, `DOM loaded for ${watchUrl}. Attempting immediate pause.`);

        // --- Attempt to Pause the Video using Keyboard Shortcut IMMEDIATELY ---
        try {
            await page.keyboard.press('k');
            logger.info(MODULE_NAME, `Pressed 'k' key immediately after DOM load.`);
            // Wait a fixed time for rendering after the early pause attempt
            const renderWaitMs = 1500; // Wait 1.5 seconds
            logger.info(MODULE_NAME, `Waiting ${renderWaitMs}ms for frame rendering after early pause attempt...`);
            await page.waitForTimeout(renderWaitMs);
        } catch (e) {
             logger.warn(MODULE_NAME, `Error pressing 'k' key immediately: ${e}. Proceeding to screenshot anyway after fallback wait.`, e);
             await page.waitForTimeout(2000); // Fallback wait if key press fails
        }

        logger.info(MODULE_NAME, `Capturing screenshot for ${videoId}...`);
        const buffer = await page.screenshot({ type: 'png' });
        logger.info(MODULE_NAME, `Screenshot captured successfully for ${videoId}`);

        return buffer;

    } catch (error: any) {
        logger.error(MODULE_NAME, `Error capturing YouTube frame for ${videoId} at ${seconds}s: ${error.message}`, error);
        // Handle specific errors like video unavailable if possible
        if (error.message.includes('video unavailable')) { // Basic check, might need refinement
             // Consider throwing a specific error type here
        }
        return null; // Indicate failure
    } finally {
        if (browser) {
            await browser.close();
            logger.info(MODULE_NAME, `Closed browser for ${videoId}`);
        }
    }
}
