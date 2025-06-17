import { Worker, Job, Queue } from 'bullmq';
import * as http from 'http';
import Redis from 'ioredis';
import { chromium, Browser, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { parseSitemap } from '../utils/sitemap';
import { bfsCrawler } from '../utils/bfsCrawler';
import { autoScroll } from '../utils/pageUtils';
import { attemptLogin } from '../utils/login';
import { processImagesFromPage } from '../utils/imageDownloader';
import dotenv from 'dotenv';
import path from 'path';
import prisma from '../utils/prismaClient';
import { uploadBufferToGCS } from '../services/gcsService';
import { calculateSha256 } from '../utils/hashUtil';
import { info, error, warn } from '../utils/logUtil';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CAPTURE_QUEUE_NAME = 'capture';
const EVALUATE_QUEUE_NAME = 'evaluate';
const GCS_HTML_PREFIX = 'html/';
const GCS_SCREENSHOT_PREFIX = 'screenshots/';
const WEBSITE_PLATFORM = 'website';
const DEFAULT_IMAGE_MAX_BYTES = parseInt(process.env.IMAGE_MAX_BYTES_DEFAULT || '5242880', 10); // 5MB default

export interface CaptureJobData {
    publisherId: string;
    scanJobId: string;
    maxPages?: number;
}

// Configuration for website crawling
interface CrawlConfig {
    sitemapUrl?: string;
    includeDomains: string[];
    excludePatterns: string[];
    maxPages?: number;
    maxDepth?: number;
    imageMaxBytes?: number;
    loginSecretId?: string;
    heroImageSelector?: string; // New: Selector for hero image(s)
    articleContentSelector?: string; // New: Selector for article content container
}

const redisUrl = process.env.REDIS_URL;
const gcsBucketName = process.env.GCS_BUCKET_NAME;
const userAgent = process.env.USER_AGENT || 'CreditComplianceCrawler/1.0';
const MODULE_NAME = 'CaptureWorker';

// --- Core Processing Logic (Exported for Testing) ---

// Added evalQueue parameter
export async function processCaptureJob(job: Job<CaptureJobData>, evalQueue: Queue) {
    const { publisherId, scanJobId, maxPages } = job.data;
    const jobIdForLog = job?.id ?? `direct-call-${uuidv4().substring(0, 8)}`;
    info(MODULE_NAME, `Processing job ${jobIdForLog} for Publisher: ${publisherId}, ScanJob: ${scanJobId}, MaxPages: ${maxPages ?? 'unlimited'}`);

    // Check for required env vars within the job processing context if needed
    if (!gcsBucketName) {
        // This check might be redundant if startWorker already checked, but good for direct calls
        error(MODULE_NAME, `Job ${jobIdForLog}: GCS_BUCKET_NAME environment variable is not set.`);
        throw new Error('GCS_BUCKET_NAME environment variable is not set.');
    }

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        // --- Pre-requisite DB Lookups ---
        info(MODULE_NAME, `Looking up Publisher Channel for Publisher ID: ${publisherId} and Platform: ${WEBSITE_PLATFORM}`);
        const publisherChannel = await prisma.publisher_channels.findFirst({
            where: {
                publisher_id: publisherId,
                platform: WEBSITE_PLATFORM,
            },
        });

        if (!publisherChannel) {
            throw new Error(`Could not find active '${WEBSITE_PLATFORM}' Publisher Channel for Publisher ID: ${publisherId}`);
        }
        const publisherChannelId = publisherChannel.id;
        info(MODULE_NAME, `Found Publisher Channel ID: ${publisherChannelId}`);
        info(MODULE_NAME, `Using provided Scan Job ID: ${scanJobId}`);

        if (!publisherChannel.channel_url) {
             throw new Error(`Publisher Channel ${publisherChannelId} for Publisher ${publisherId} is missing a channel_url.`);
        }
        const baseUrl = publisherChannel.channel_url;

        // --- Get Channel Configuration (if available) ---
        let crawlConfig: CrawlConfig;
        const channelConfig = await prisma.publisher_channel_configs.findUnique({
            where: { publisher_channel_id: publisherChannelId }
        });

        if (channelConfig) {
            info(MODULE_NAME, `Found configuration for Publisher Channel: ${publisherChannelId}`);
            crawlConfig = {
                sitemapUrl: channelConfig.sitemapUrl || undefined,
                includeDomains: channelConfig.includeDomains || [],
                excludePatterns: channelConfig.excludePatterns || [],
                maxPages: channelConfig.maxPages || maxPages,
                maxDepth: channelConfig.maxDepth ?? undefined,
                imageMaxBytes: channelConfig.imageMaxBytes || DEFAULT_IMAGE_MAX_BYTES,
                loginSecretId: channelConfig.loginSecretId ?? undefined,
                heroImageSelector: channelConfig.heroImageSelector ?? undefined, // Read new field
                articleContentSelector: channelConfig.articleContentSelector ?? undefined // Read new field
            };
        } else {
            // Default configuration if no specific config exists
            info(MODULE_NAME, `No configuration found for Publisher Channel: ${publisherChannelId}, using defaults`);
            crawlConfig = {
                sitemapUrl: new URL('/sitemap.xml', baseUrl).toString(),
                includeDomains: [new URL(baseUrl).hostname],
                excludePatterns: [],
                maxPages: maxPages,
                maxDepth: 3,
                imageMaxBytes: DEFAULT_IMAGE_MAX_BYTES,
                heroImageSelector: undefined, // Default to undefined
                articleContentSelector: undefined // Default to undefined
            };
        }

        info(MODULE_NAME, `Publisher Channel URL (Base for crawl): ${baseUrl}`);
        info(MODULE_NAME, `Crawl configuration: ${JSON.stringify(crawlConfig)}`);

        // --- URL Discovery ---
        info(MODULE_NAME, `Starting URL discovery for ${baseUrl} (Max pages: ${crawlConfig.maxPages ?? 'unlimited'})`);
        let sitemapUrls: string[] = [];
        
        if (crawlConfig.sitemapUrl) {
            try {
                sitemapUrls = await parseSitemap(crawlConfig.sitemapUrl, crawlConfig.maxPages);
                info(MODULE_NAME, `Found ${sitemapUrls.length} URLs via sitemap.`);
            } catch (sitemapError: any) {
                warn(MODULE_NAME, `Could not fetch or parse sitemap ${crawlConfig.sitemapUrl}: ${sitemapError.message}. Proceeding with crawl only.`);
            }
        } else {
            info(MODULE_NAME, 'No sitemap URL provided, skipping sitemap parsing.');
        }

        // Get URLs via BFS crawler, respecting domain and pattern filters
        const crawledUrls = await bfsCrawler(baseUrl, crawlConfig.maxPages, crawlConfig.maxDepth);
        info(MODULE_NAME, `Found ${crawledUrls.length} URLs via BFS crawl.`);

        // Filter and combine URLs
        const allUrls = [...new Set([...sitemapUrls, ...crawledUrls])];
        
        // Apply domain and pattern filtering
        const filteredUrls = allUrls.filter(url => {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname;
                
                // Check if domain is in includeDomains
                const isDomainIncluded = crawlConfig.includeDomains.length === 0 || 
                    crawlConfig.includeDomains.some(include => 
                        domain === include || domain.endsWith(`.${include}`)
                    );
                
                if (!isDomainIncluded) return false;
                
                // Check if URL matches any excludePattern
                const isExcluded = crawlConfig.excludePatterns.some(pattern => {
                    // Simple wildcard pattern matching logic
                    if (pattern.startsWith('*')) {
                        return url.endsWith(pattern.substring(1));
                    } else if (pattern.endsWith('*')) {
                        return url.startsWith(pattern.substring(0, pattern.length - 1));
                    } else {
                        return url.includes(pattern);
                    }
                });
                
                return !isExcluded;
            } catch (err) {
                warn(MODULE_NAME, `Invalid URL: ${url}, skipping`, err);
                return false;
            }
        });

        const finalUrls = crawlConfig.maxPages ? filteredUrls.slice(0, crawlConfig.maxPages) : filteredUrls;
        info(MODULE_NAME, `Total unique URLs to process: ${finalUrls.length}`);

        if (finalUrls.length === 0) {
            info(MODULE_NAME, `No URLs found for publisher ${publisherId}. Job ${jobIdForLog} completing.`);
            return { processedCount: 0, errorCount: 0 };
        }

        // --- Playwright Setup ---
        info(MODULE_NAME, `Launching browser for job ${jobIdForLog}`);
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext({ userAgent });

        // --- Login if credentials are provided ---
        if (crawlConfig.loginSecretId) {
            info(MODULE_NAME, `Login credentials provided, attempting login`);
            try {
                // TODO: Implement login logic using loginSecretId
                // For now, just log that we would attempt login
                info(MODULE_NAME, `Would attempt login with secret ID: ${crawlConfig.loginSecretId}`);
            } catch (loginError: any) {
                warn(MODULE_NAME, `Login failed: ${loginError.message}. Continuing without login.`);
            }
        } else {
            info(MODULE_NAME, 'No login credentials provided, skipping login.');
        }

        // --- Process Each URL ---
        let processedCount = 0;
        let errorCount = 0;
        let imageCount = 0;
        const results = [];

        for (const currentUrl of finalUrls) {
            let currentPage: Page | null = null;
            try {
                info(MODULE_NAME, `Processing URL (${processedCount + errorCount + 1}/${finalUrls.length}): ${currentUrl}`);
                currentPage = await context.newPage();

                info(MODULE_NAME, `Navigating to ${currentUrl}`);
                await currentPage.goto(currentUrl, { waitUntil: 'networkidle', timeout: 60000 });

                info(MODULE_NAME, `Auto-scrolling page: ${currentUrl}`);
                await autoScroll(currentPage);

                const htmlContent = await currentPage.content();
                const screenshotBuffer = await currentPage.screenshot({ fullPage: true, type: 'png' });
                info(MODULE_NAME, `Content captured for: ${currentUrl}`);

                const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
                const htmlSha256 = calculateSha256(htmlBuffer);
                const screenshotSha256 = calculateSha256(screenshotBuffer);

                const fileUuid = uuidv4();
                const htmlFileName = `${fileUuid}.html`;
                const screenshotFileName = `${fileUuid}.png`;
                const htmlGcsPath = `${GCS_HTML_PREFIX}${htmlFileName}`;
                const screenshotGcsPath = `${GCS_SCREENSHOT_PREFIX}${screenshotFileName}`;

                await uploadBufferToGCS(htmlBuffer, htmlGcsPath, gcsBucketName!);
                await uploadBufferToGCS(screenshotBuffer, screenshotGcsPath, gcsBucketName!);
                info(MODULE_NAME, `Uploaded files to GCS for: ${currentUrl}`);

                const pageTitle = await currentPage.title() || '';
                const contentItem = await prisma.content_items.create({
                    data: {
                        scan_job_id: scanJobId,
                        publisher_id: publisherId,
                        publisher_channel_id: publisherChannelId,
                        platform: WEBSITE_PLATFORM,
                        channel_url: publisherChannel.channel_url || baseUrl,
                        url: currentUrl,
                        content_type: 'webpage',
                        scan_date: new Date(),
                        title: pageTitle,
                    },
                });

                await prisma.content_files.createMany({
                    data: [
                        { contentItemId: contentItem.id, version: 1, state: 'captured', fileType: 'html', filePath: htmlGcsPath, sha256: htmlSha256 },
                        { contentItemId: contentItem.id, version: 1, state: 'captured', fileType: 'screenshot', filePath: screenshotGcsPath, sha256: screenshotSha256 },
                    ],
                });
                info(MODULE_NAME, `Database records created for: ${currentUrl} (ContentItem ID: ${contentItem.id})`);

                // --- Process Images ---
                info(MODULE_NAME, `Processing images for ${currentUrl}`);
                try {
                    const pageImageCount = await processImagesFromPage(
                        currentPage,
                        contentItem.id,
                        baseUrl,
                        crawlConfig.includeDomains,
                        gcsBucketName!,
                        crawlConfig.imageMaxBytes,
                        crawlConfig.heroImageSelector, // Pass selector
                        crawlConfig.articleContentSelector // Pass selector
                    );
                    imageCount += pageImageCount;
                    info(MODULE_NAME, `Processed ${pageImageCount} images for ${currentUrl} (Total images: ${imageCount})`);
                } catch (imageError: any) {
                    error(MODULE_NAME, `Error processing images for ${currentUrl}: ${imageError.message}`, imageError);
                    // Continue with the page processing even if image processing fails
                }

                // Enqueue for Evaluation
                await evalQueue.add('evaluateContentItem', { contentItemId: contentItem.id });
                info(MODULE_NAME, `Enqueued ContentItem ${contentItem.id} for evaluation.`);

                results.push({ 
                    url: currentUrl, 
                    contentItemId: contentItem.id, 
                    status: 'success',
                    imageCount: imageCount
                });
                processedCount++;

            } catch (pageError: any) {
                error(MODULE_NAME, `Error processing URL ${currentUrl}: ${pageError.message}`, pageError);
                errorCount++;
                results.push({ url: currentUrl, status: 'error', message: pageError.message });
            } finally {
                await currentPage?.close();
            }
        } // End URL loop

        info(MODULE_NAME, `Finished processing job ${jobIdForLog}. Success: ${processedCount}, Errors: ${errorCount}, Images: ${imageCount}`);
        return { processedCount, errorCount, imageCount, results };

    } catch (err: any) {
        error(MODULE_NAME, `FATAL Error processing job ${jobIdForLog} for Publisher ${publisherId}: ${err.message}`, err);
        throw err;
    } finally {
        if (browser) {
            try {
                await browser.close();
                info(MODULE_NAME, `Browser closed for job ${jobIdForLog}`);
            } catch (closeErr) {
                error(MODULE_NAME, `Error closing browser for job ${jobIdForLog}: ${closeErr}`);
            }
        }
    }
} // End of processCaptureJob function


// --- Worker Initialization and Start ---

async function startWorker() {
    info(MODULE_NAME, 'Starting Capture Worker...');

    // Check required environment variables
    if (!redisUrl) {
        error(MODULE_NAME, 'FATAL: REDIS_URL environment variable is not set.');
        process.exit(1);
    }
    if (!gcsBucketName) {
        error(MODULE_NAME, 'FATAL: GCS_BUCKET_NAME environment variable is not set.');
        process.exit(1);
    }

    // Create Redis connection
    const redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    redisConnection.on('error', (err) => {
        error(MODULE_NAME, 'Redis connection error in Worker:', err);
        // Don't exit, BullMQ might handle reconnection
    });

    info(MODULE_NAME, `Worker connecting to Redis at ${redisUrl}`);

    // Create Evaluate Queue instance locally within startWorker
    const evaluateQueueInstance = new Queue(EVALUATE_QUEUE_NAME, { connection: redisConnection });
    info(MODULE_NAME, `Evaluate queue instance created for queue: ${EVALUATE_QUEUE_NAME}`);


    // Create the main Capture Worker instance
    const worker = new Worker<CaptureJobData>(
        CAPTURE_QUEUE_NAME,
        async (job) => { // Wrap the call to processCaptureJob
            // Pass the created evaluateQueueInstance to the job processor
            // Use non-null assertion '!' as we know it's defined here.
            return processCaptureJob(job, evaluateQueueInstance!);
        },
        { connection: redisConnection, concurrency: 2 }
    );

    // --- Worker Event Listeners ---
    worker.on('completed', (job: Job, result: any) => {
        info(MODULE_NAME, `Job ${job?.id ?? 'unknown'} completed successfully. Result: ${JSON.stringify(result)}`);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
        if (job) {
            error(MODULE_NAME, `Job ${job?.id ?? 'unknown'} failed with error: ${err.message}`, err);
        } else {
            error(MODULE_NAME, `A job failed with error: ${err.message}`, err);
        }
    });

    info(MODULE_NAME, `Capture worker started. Listening for jobs on queue "${CAPTURE_QUEUE_NAME}"...`);

    // ---- ADD HEALTH CHECK SERVER ----
    const healthCheckPort = process.env.PORT || 8080; // Cloud Run injects PORT

    const healthServer = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      if (req.url === '/healthz' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    healthServer.listen(healthCheckPort, () => {
      info(MODULE_NAME, `Health check server listening on port ${healthCheckPort} for ${MODULE_NAME}`);
    });
    // ---- END HEALTH CHECK SERVER ----

    // --- Graceful Shutdown ---
    const shutdown = async () => {
        info(MODULE_NAME, 'Shutting down worker and Redis connection...');
        await worker.close();
        await redisConnection.quit();
        info(MODULE_NAME, 'Worker and Redis connection closed. Exiting.');
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// --- Script Execution ---
// Only call startWorker if this script is run directly
if (require.main === module) {
    startWorker().catch(err => {
        error(MODULE_NAME, 'Failed to start worker:', err);
        process.exit(1);
    });
}
