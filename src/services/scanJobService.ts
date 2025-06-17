import { PrismaClient, scan_jobs as ScanJob, publisher_channels as PublisherChannel, Prisma } from '../../generated/prisma/client'; // Added Prisma for JsonNull
/// <reference path="../types/node-srt.d.ts" />
import axios from 'axios'; // Import axios for downloading media
import path from 'path'; // Import path for filename manipulation
import crypto from 'crypto'; // Import crypto for SHA256 hashing
import * as srt from 'node-srt'; // Import SRT parser for transcript processing
import * as publisherChannelRepository from '../repositories/publisherChannelRepository';
import * as scanJobRepository from '../repositories/scanJobRepository';
import { runApifyActor, checkApifyRunStatus, getApifyRunResults, getApifyKeyValueStoreRecordContent } from './apifyService'; // Added getApifyKeyValueStoreRecordContent
import { uploadBufferToGCS } from './gcsService';
import { analyzeContentItemForFlags } from './aiAnalysisService'; // Import the AI analysis function
// import { youtubeCaptionService } from './youtubeCaptionService'; // Removed unused import causing build error
import prisma from '../utils/prismaClient';
import { createJobLogger } from '../utils/jobFileLogger'; // Import the job file logger
import { aiBypassQueue, AI_BYPASS_QUEUE_NAME } from '../workers/queueRegistry'; // Import AI Bypass Queue

/**
 * Retrieves scan jobs based on specified criteria.
 * @param where - Prisma WhereInput object for filtering.
 * @param limit - Optional limit for number of results.
 * @param offset - Optional offset for pagination.
 * @returns An array of matching scan job objects with additional count fields.
 */
export const getScanJobs = async (
    // The 'where' might come from the route with has_active_flags as a simple boolean.
    // The repository now handles the logic for has_active_flags internally.
    where: Prisma.scan_jobsWhereInput | (Prisma.scan_jobsWhereInput & { has_active_flags?: boolean }),
    limit?: number,
    offset?: number
): Promise<(ScanJob & {
    items_count?: number;
    total_flags?: number;
    pending_flags?: number;
    closed_flags?: number;
    assignee_name?: string;
})[]> => {
    console.log('getScanJobs service called with params:', { where, limit, offset });
    // Pass the 'where' clause as is; the repository will handle 'has_active_flags' if present.
    return scanJobRepository.findScanJobs(where as Prisma.scan_jobsWhereInput, limit, offset);
};

/**
 * Initiates a scan job based on selected publishers, platforms, and optional products.
 * Triggers individual Apify runs for each eligible channel matching the criteria.
 * @param publisherIds An array of publisher IDs to include in the scan.
 * @param platformTypes An array of platform types (e.g., 'YouTube Video', 'TikTok') to scan.
 * @param productIds An array of product IDs to focus analysis on (optional).
 * @param jobName A name for the overall scan job (optional).
 * @param jobDescription A description for the overall scan job (optional).
 * @param userId The ID of the user initiating the scan (optional).
 * @param bypassAiProcessing Whether to bypass AI processing for this job (optional, defaults to false).
 * @returns The created master ScanJob record.
 */
export const initiateScanJob = async (
    publisherIds: string[],
    platformTypes: string[],
    productIds: string[],
    jobName?: string,
    jobDescription?: string,
    userId?: string,
    bypassAiProcessing?: boolean // Added bypassAiProcessing
): Promise<ScanJob> => {
    // console.log(`Initiating scan job for Publishers: [${publisherIds.join(', ')}], Platforms: [${platformTypes.join(', ')}], Products: [${productIds.join(', ')}]`); // Replaced by jobLogger

    // --- Determine Advertiser Context (using first publisher) ---
    // TODO: Enhance this logic - what if publishers belong to different advertisers?
    // For now, assume they belong to the same org/advertiser or handle error.
    let advertiserId: string | null = null;
    if (publisherIds.length > 0) {
        const firstPublisher = await prisma.publishers.findUnique({
            where: { id: publisherIds[0] },
            select: { organization_id: true }
        });

        if (firstPublisher?.organization_id) {
            const organizationId = firstPublisher.organization_id;
            const advertiser = await prisma.advertisers.findFirst({
                where: { organization_id: organizationId },
                select: { id: true }
            });
            if (advertiser) {
                advertiserId = advertiser.id;
                console.log(`Determined advertiser context ID: ${advertiserId} via Organization ID: ${organizationId} from Publisher ${publisherIds[0]}`);
            } else {
                console.warn(`Could not find advertiser linked to organization ID: ${organizationId}`);
            }
        } else {
            console.warn(`Could not determine organization context for Publisher ID: ${publisherIds[0]}`);
        }
    }
    // --- End Determine Advertiser Context ---

    // 1. Create the master ScanJob record
    const scanJobData: Prisma.scan_jobsCreateInput = {
        status: 'INITIALIZING',
        source: 'manual_multi_target', // Updated source name
        advertisers: advertiserId ? { connect: { id: advertiserId } } : undefined, // Corrected field name
        name: jobName || `Manual Scan ${new Date().toISOString()}`,
        description: jobDescription || `Scan for ${publisherIds.length} publishers across ${platformTypes.length} platforms.`,
        creator: userId ? { connect: { id: userId } } : undefined,
        // Link selected publishers directly to the job
        scan_job_publishers: {
            create: publisherIds.map(pubId => ({
                publisher_id: pubId
            }))
        },
        // Link selected products directly to the job
        scan_job_product_focus: {
            create: productIds.map(prodId => ({
                product_id: prodId
            }))
        },
        bypass_ai_processing: bypassAiProcessing ?? false // Add the new field
        // platform_filter is implicitly handled by filtering channels below
    };

    const masterScanJob = await scanJobRepository.createScanJob(scanJobData);
    const jobLogger = createJobLogger(masterScanJob.id);
    jobLogger.info(`Initiating scan job for Publishers: [${publisherIds.join(', ')}], Platforms: [${platformTypes.join(', ')}], Products: [${productIds.join(', ')}]`, { publisherIds, platformTypes, productIds, jobName, userId, bypassAiProcessing });
    jobLogger.info(`Created master ScanJob ${masterScanJob.id} with linked publishers, products, and bypass_ai_processing set to ${masterScanJob.bypass_ai_processing}.`);

    let successfulRuns = 0;
    let failedRuns = 0;

    // 2. Find all eligible channels based on selected publishers and platforms (case-insensitive)
    // TODO: Long-term, standardize platform names in DB and remove insensitive mode.
    const targetChannels = await prisma.publisher_channels.findMany({
        where: {
            publisher_id: { in: publisherIds },
            platform: { 
                in: platformTypes,
                mode: 'insensitive' // Make the database query case-insensitive for platforms
            }, 
            status: 'ACTIVE' // Changed from 'approved' to 'ACTIVE' to match user's data
        },
    });
    jobLogger.info(`Found ${targetChannels.length} eligible channels matching criteria (status: ACTIVE, case-insensitive platform search).`, { targetChannelCount: targetChannels.length });

    // 3. Loop through each eligible channel and attempt to trigger a run
    for (const channel of targetChannels) {
        // 4. Filter: Status check is now done in the query above (status: 'ACTIVE'). Platform check also done.
        // We can remove the redundant status check here.
        // if (channel.status !== 'ACTIVE') { // This check is no longer needed
        //     console.log(`Skipping channel ${channel.id} (${channel.channel_url}): Status is ${channel.status}`);
        //     continue;
        // }

        let apifyActorId: string | null = null;
        let actorInput: any = null;

        // --- Platform-Specific Logic (using case-insensitive comparison) ---
        // Compare the platform value from the DB (e.g., 'TIKTOK') against expected uppercase values.
        const dbPlatformUpper = channel.platform.toUpperCase(); 

        if (dbPlatformUpper === 'INSTAGRAM') {
            // Use the centrally defined Actor ID for Instagram
            apifyActorId = 'apify/instagram-scraper'; // Hardcoded expected Actor ID
            // Removed check against channel.apifyActorId
            actorInput = {
                directUrls: [channel.channel_url],
                resultsType: "posts",
                isUserTaggedFeedURL: false,
                isUserReelFeedURL: false,
                addParentData: false,
                resultsLimit: 50, // Increased limit to 50
            };
            jobLogger.info(`Prepared Instagram input for channel ${channel.id}`, { channelId: channel.id, actorInput });

        } else if (dbPlatformUpper === 'TIKTOK') {
             // Use the centrally defined Actor ID for TikTok
            apifyActorId = 'clockworks/free-tiktok-scraper'; // Hardcoded expected Actor ID
             // Removed check against channel.apifyActorId

            // --- Refined Username Extraction for TikTok ---
            let username: string | null = null;
            try {
                // Use regex to find @username in the path, ignoring query params/fragments
                const url = new URL(channel.channel_url);
                const pathMatch = url.pathname.match(/@([a-zA-Z0-9_.]+)/); // Matches @ followed by valid username characters
                if (pathMatch && pathMatch[1]) {
                    username = pathMatch[1];
                } else {
                     console.warn(`Could not find @username pattern in TikTok URL path: ${url.pathname}. Attempting fallback.`);
                     // Fallback: try splitting path and taking last non-empty part if it looks like a username
                     const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                     const potentialUsername = pathParts.pop();
                     // Basic check if the last part looks like a username (adjust regex if needed)
                     if (potentialUsername && /^[a-zA-Z0-9_.]+$/.test(potentialUsername)) {
                         username = potentialUsername;
                         console.log(`Fallback successful: Extracted "${username}" as potential username.`);
                     } else {
                         console.error(`Fallback failed: Last path part "${potentialUsername}" doesn't look like a valid username.`);
                     }
                }
            } catch (e: unknown) {
                 const errorMessage = e instanceof Error ? e.message : String(e);
                 console.error(`Error parsing TikTok URL (${channel.channel_url}): ${errorMessage}`);
                 username = null; // Ensure username is null on error
            }

            if (!username) {
                 console.error(`Skipping TikTok channel ${channel.id}: Failed to extract username from URL ${channel.channel_url}`);
                 continue; // Skip this channel if username extraction failed
            }
            // --- End Refined Username Extraction ---

            actorInput = {
                profiles: [username],
                resultsPerPage: 50, // Increased limit to 50
                shouldDownloadVideos: true,
                shouldDownloadSlideshowImages: true,
                shouldDownloadSubtitles: false, // As discussed
                // Add other necessary fields based on clockworks/free-tiktok-scraper requirements if any
            };
            jobLogger.info(`Prepared TikTok input for channel ${channel.id} (Username: ${username})`, { channelId: channel.id, username, actorInput });

        } else if (dbPlatformUpper === 'YOUTUBE') { // Check against uppercase 'YOUTUBE'
             // Use hardcoded Actor ID for YouTube Videos
            const expectedActorId = 'streamers/youtube-scraper';
            apifyActorId = expectedActorId; // Assign the expected actor ID

            if (!channel.channel_url) {
                jobLogger.warn(`Skipping YouTube Video channel ${channel.id}: Missing channel_url.`, { channelId: channel.id });
                continue;
            }

            // Ensure URL ends with /videos
            let formattedUrl = channel.channel_url;
            if (formattedUrl.endsWith('/')) {
                formattedUrl = formattedUrl.slice(0, -1); // Remove trailing slash if present
            }
            if (!formattedUrl.endsWith('/videos')) {
                formattedUrl += '/videos';
            }

            actorInput = {
                startUrls: [{ url: formattedUrl, method: 'GET' }],
                downloadSubtitles: true,
                saveSubsToKVS: true, // REVERTED: Save to KVS again
                subtitlesFormat: 'srt',
                subtitlesLanguage: 'en',
                preferAutoGeneratedSubtitles: true,
                maxResults: 50, // Increased limit to 50
                maxResultsShorts: 0, // Exclude shorts for now
                maxResultStreams: 0, // Exclude streams for now
                // Add other relevant parameters based on streamers/youtube-scraper if needed
            };
            jobLogger.info(`Prepared YouTube Video input for channel ${channel.id} (URL: ${formattedUrl})`, { channelId: channel.id, formattedUrl, actorInput });

        } else if (dbPlatformUpper === 'YOUTUBE_SHORTS') { // Handle YouTube Shorts using the regular scraper
            // === Use the regular YouTube scraper as requested ===
            apifyActorId = 'streamers/youtube-scraper';

            if (!channel.channel_url) {
                jobLogger.warn(`Skipping YouTube Shorts channel ${channel.id}: Missing channel_url.`, { channelId: channel.id });
                continue;
            }

            // The regular scraper needs a startUrl, often ending in /shorts
            let formattedUrl = channel.channel_url;
            if (!formattedUrl.endsWith('/shorts')) {
                 if (formattedUrl.endsWith('/')) {
                     formattedUrl = formattedUrl.slice(0, -1);
                 }
                 formattedUrl += '/shorts';
            }

            // === Construct input for streamers/youtube-scraper to get SHORTS ===
            actorInput = {
                startUrls: [{ url: formattedUrl }], // Use startUrls format
                maxResults: 0, // Set maxResults for regular videos to 0
                maxResultsShorts: 50, // Increased limit to 50
                maxResultStreams: 0, // Exclude streams
                downloadSubtitles: true, // Ensure subtitles are requested
                saveSubsToKVS: true,
                subtitlesFormat: 'srt',
                subtitlesLanguage: 'en',
                preferAutoGeneratedSubtitles: true,
            };
            jobLogger.info(`Prepared YouTube Shorts input for channel ${channel.id} using ${apifyActorId} (URL: ${formattedUrl})`, { channelId: channel.id, apifyActorId, formattedUrl, actorInput });

        } else {
            // --- Handle other platforms or skip ---
            jobLogger.warn(`Skipping channel ${channel.id} (${channel.channel_url}): Platform '${channel.platform}' not supported yet.`, { channelId: channel.id, channelUrl: channel.channel_url, platform: channel.platform });
            continue;
        }
        // --- End Platform-Specific Logic ---


        // 6. Trigger the Apify run and record it
        try {
            // Ensure actorId and actorInput are set
            if (!apifyActorId || !actorInput) {
                jobLogger.error(`Actor ID or Input not set for channel ${channel.id}`, new Error(`Actor ID or Input not set for channel ${channel.id}`), { channelId: channel.id });
                // throw new Error(`Actor ID or Input not set for channel ${channel.id}`); // Error will be logged, continue to next channel
                failedRuns++; // Count as failed if we can't even form the actor/input
                continue;
            }
            const apifyRunId = await runApifyActor(apifyActorId, actorInput);
            jobLogger.info(`Successfully started Apify run ${apifyRunId} for channel ${channel.id}`, { apifyRunId, channelId: channel.id });

            // Create the tracking record in scan_job_runs
            await prisma.scan_job_runs.create({
                data: {
                    scan_job_id: masterScanJob.id,
                    publisher_channel_id: channel.id,
                    apify_actor_id: apifyActorId,
                    apify_run_id: apifyRunId,
                    status: 'STARTED', // Initial status from Apify's perspective
                    input_payload: actorInput, // Store input for debugging
                    run_started_at: new Date(), // Record when we triggered it
                }
            });
            jobLogger.info(`Recorded scan_job_run for channel ${channel.id} with Apify run ID ${apifyRunId}`, { channelId: channel.id, apifyRunId });
            successfulRuns++;

        } catch (err) {
            failedRuns++;
            const runError = err instanceof Error ? err : new Error(String(err));
            jobLogger.error(`Failed to start Apify run or record scan_job_run for channel ${channel.id}`, runError, { channelId: channel.id });
            // Optionally create a scan_job_runs record with status 'FAILED_TO_START'
            try {
                 await prisma.scan_job_runs.create({
                    data: {
                        scan_job_id: masterScanJob.id,
                        publisher_channel_id: channel.id,
                        apify_actor_id: apifyActorId,
                        apify_run_id: `failed-${Date.now()}`, // Placeholder unique ID
                        status: 'FAILED_TO_START',
                        input_payload: actorInput,
                        run_started_at: new Date(),
                    }
                });
                 jobLogger.info(`Recorded FAILED_TO_START scan_job_run for channel ${channel.id}`, { channelId: channel.id });
            } catch (dbErr) {
                 const dbError = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
                 jobLogger.error(`Failed to record FAILED_TO_START status for channel ${channel.id}`, dbError, { channelId: channel.id });
            }
            // Continue the loop for other channels
        }
    } // End of loop

    // 7. Update the master ScanJob status after attempting all triggers
    let finalStatus = 'FAILED'; // Default if nothing was triggered
    if (successfulRuns > 0 && failedRuns == 0) {
        finalStatus = 'RUNNING'; // All triggered successfully
    } else if (successfulRuns > 0 && failedRuns > 0) {
        finalStatus = 'PARTIALLY_RUNNING'; // Some succeeded, some failed to start
    } else if (successfulRuns == 0 && failedRuns > 0) {
        finalStatus = 'FAILED'; // All failed to start
    } else if (successfulRuns == 0 && failedRuns == 0) {
        finalStatus = 'COMPLETED_NO_RUNS'; // No eligible channels found or provided
    }

    const updatedMasterScanJob = await scanJobRepository.updateScanJob(masterScanJob.id, {
        status: finalStatus,
        start_time: new Date(), // Mark the overall start time
        // end_time will be set when all runs are monitored and completed
    });
    jobLogger.info(`Updated master ScanJob ${updatedMasterScanJob.id} status to ${finalStatus}. Successful triggers: ${successfulRuns}, Failed triggers: ${failedRuns}`, { finalStatus, successfulRuns, failedRuns });

    return updatedMasterScanJob;
};

/**
 * Checks the status of a specific Apify run associated with a scan_job_run record,
 * updates the record's status, and potentially triggers data processing.
 * @param scanJobRunId The ID of the scan_job_runs record to process.
 * @param scanJobId The ID of the parent master scan_job for logging purposes.
 */
export const processApifyRunCompletion = async (scanJobRunId: string, scanJobId: string): Promise<void> => {
    const jobLogger = createJobLogger(scanJobId);
    jobLogger.info(`[Process Run] Called for scan_job_run ID: ${scanJobRunId}`);

    const scanJobRun = await prisma.scan_job_runs.findUnique({
        where: { id: scanJobRunId },
    });

    if (!scanJobRun) {
        jobLogger.error(`[Process Run] Scan job run with ID ${scanJobRunId} not found in DB.`);
        return;
    }
    jobLogger.info(`[Process Run] Found scan_job_run record.`, { currentDbStatus: scanJobRun.status, apifyRunId: scanJobRun.apify_run_id });

    // Avoid reprocessing runs that are already finished or failed to start
    if (['COMPLETED', 'FAILED', 'PROCESSING_COMPLETE', 'FETCHING_RESULTS', 'FAILED_TO_START'].includes(scanJobRun.status)) {
        jobLogger.info(`Scan job run ${scanJobRunId} (Apify Run ID: ${scanJobRun.apify_run_id}) is already in a final state (${scanJobRun.status}). Skipping.`);
        return;
    }

    if (!scanJobRun.apify_run_id || scanJobRun.apify_run_id.startsWith('failed-')) {
        jobLogger.error(`[Process Run] Invalid Apify Run ID found in DB record for scanJobRunId ${scanJobRunId}.`, { apifyRunId: scanJobRun.apify_run_id });
        // Optionally update status to FAILED here if it's in STARTED
        if (scanJobRun.status === 'STARTED') {
             await prisma.scan_job_runs.update({
                where: { id: scanJobRunId },
                data: { status: 'FAILED', run_finished_at: new Date(), status_details: 'Missing or invalid Apify Run ID' },
            });
        }
        return;
    }

    try {
        jobLogger.info(`[Process Run] Checking Apify status for run: ${scanJobRun.apify_run_id}`);
        const apifyRunDetails = await checkApifyRunStatus(scanJobRun.apify_run_id);
        jobLogger.info(`[Process Run] Apify status check completed. Status from Apify: ${apifyRunDetails?.status}`, { apifyStatus: apifyRunDetails?.status });

        if (!apifyRunDetails) {
            jobLogger.error(`[Process Run] Could not retrieve status details from Apify for run ${scanJobRun.apify_run_id}.`);
             // Consider updating status to an error state or retrying later
             await prisma.scan_job_runs.update({
                where: { id: scanJobRunId },
                data: { status: 'UNKNOWN', status_details: 'Failed to fetch status from Apify' },
            });
            return;
        }

        const apifyStatus = apifyRunDetails.status; // e.g., SUCCEEDED, FAILED, RUNNING, TIMED_OUT, ABORTING, ABORTED
        let newStatus = scanJobRun.status;
        let statusDetails = `Apify status: ${apifyStatus}`;
        let runFinishedAt = scanJobRun.run_finished_at; // Keep existing end time unless updated. Use run_finished_at

        switch (apifyStatus) {
            case 'SUCCEEDED':
                newStatus = 'FETCHING_RESULTS'; // Mark as fetching
                runFinishedAt = apifyRunDetails.finishedAt || new Date();
                jobLogger.info(`Apify run ${scanJobRun.apify_run_id} SUCCEEDED. Attempting to fetch results...`);

                // Update status to FETCHING_RESULTS immediately before attempting fetch
                await prisma.scan_job_runs.update({
                    where: { id: scanJobRunId },
                    data: { status: newStatus, run_finished_at: runFinishedAt },
                });

                jobLogger.info(`[Process Run] Apify run SUCCEEDED. Attempting getApifyRunResults...`);
                try {
                    const results = await getApifyRunResults(scanJobRun.apify_run_id);
                    jobLogger.info(`[Process Run] Successfully fetched ${results?.length ?? 0} items from Apify dataset for run ${scanJobRun.apify_run_id}.`);
                    // jobLogger.info('Sample results:', { sample: results.slice(0, 1) }); // Log only one sample to keep logs smaller

                    // Fetch related publisher channel info needed for content_items
                    const channel = await prisma.publisher_channels.findUnique({
                        where: { id: scanJobRun.publisher_channel_id },
                        include: { publishers: true } // Include publisher to get publisher_id
                    });

                    if (!channel || !channel.publishers) {
                        throw new Error(`Could not find publisher channel or associated publisher for channel ID ${scanJobRun.publisher_channel_id}`);
                    }
                    const publisherId = channel.publisher_id;
                    const platformFromDb = channel.platform; // Get platform from DB channel record
                    const platform = platformFromDb.toLowerCase(); // Convert to lowercase for consistent checking

                    jobLogger.info(`Processing ${results.length} items for channel ${channel.id} (Publisher: ${publisherId}, Platform: ${platformFromDb} -> ${platform})`);

                    let processedCount = 0;
                    let errorCount = 0;

                    // --- Define SRT Helper Functions Here (Moved from 'youtube' block) ---
                    /**
                     * Normalizes SRT timestamps to ensure proper format.
                     * Fixes issues like missing leading zeros (00:01:0,359 -> 00:01:00,359)
                     */
                    function normalizeTimestamp(timestamp: string): string {
                        // Match timestamp parts: hours, minutes, seconds, milliseconds
                        const match = timestamp.match(/(\d{2}):(\d{2}):(\d{1,2}),(\d{3})/);
                        if (!match) return timestamp; // Return original if no match
                        
                        // Extract parts
                        const hours = match[1];
                        const minutes = match[2];
                        const seconds = match[3].padStart(2, '0'); // Ensure seconds has 2 digits
                        const milliseconds = match[4];
                        
                        // Return normalized timestamp
                        return `${hours}:${minutes}:${seconds},${milliseconds}`;
                    }

                    /**
                     * Normalizes a timestamp line (start --> end) to ensure proper format
                     */
                    function normalizeTimestampLine(line: string): string {
                        // Match the two timestamps in the line
                        const match = line.match(/(\d{2}:\d{2}:\d{1,2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{1,2},\d{3})/);
                        if (!match) return line; // Return original if no match
                        
                        // Normalize both timestamps
                        const startTime = normalizeTimestamp(match[1]);
                        const endTime = normalizeTimestamp(match[2]);
                        
                        // Return normalized line
                        return `${startTime} --> ${endTime}`;
                    }

                    /**
                     * Robust SRT pre-processor that handles various formatting issues
                     */
                    function preprocessSrt(rawSrt: string): string {
                        if (!rawSrt) return '';
                        
                        // Remove BOM and normalize line endings
                        let cleaned = rawSrt.replace(/^\uFEFF/, '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                        
                        // Split into lines for processing
                        const lines = cleaned.split('\n');
                        let processed = [];
                        
                        // Process each line
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            
                            // Skip empty lines
                            if (!line) {
                                processed.push('');
                                continue;
                            }
                            
                            // Check if this is a timestamp line
                            if (line.includes('-->')) {
                                // Normalize the timestamp line
                                processed.push(normalizeTimestampLine(line));
                                
                                // Check if the timestamp and text are on the same line
                                const parts = line.split('-->');
                                if (parts.length > 1 && parts[1].trim().length > 10) { // If there's substantial text after the timestamp
                                    // Extract the text part and add it as a separate line
                                    const textPart = parts[1].replace(/^\s*\d{2}:\d{2}:\d{2},\d{3}\s*/, '').trim();
                                    if (textPart) {
                                        processed.push(textPart);
                                    }
                                }
                            } else {
                                processed.push(line);
                            }
                        }
                        
                        // Join lines back together
                        return processed.join('\n');
                    }

                    /**
                     * Enhanced SRT parser that can handle problematic SRT files with overlapping timestamps
                     * and other structural issues. It rebuilds a clean SRT structure from the raw data.
                     */
                    function enhancedSrtParse(srtString: string): Array<{startTime: number, endTime: number, text: string}> {
                        console.log(`    [Parse Debug] Using enhanced SRT parser to rebuild clean structure`);
                        
                        // Step 1: Extract all timestamp-text pairs
                        const segments: Array<{startTime: number, endTime: number, text: string}> = [];
                        const lines = srtString.split('\n');
                        
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            
                            // Look for timestamp lines
                            if (line.includes('-->')) {
                                // Extract timestamps using regex
                                const timestampMatch = line.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
                                
                                if (timestampMatch) {
                                    // Convert timestamp to milliseconds
                                    const startHours = parseInt(timestampMatch[1]);
                                    const startMinutes = parseInt(timestampMatch[2]);
                                    const startSeconds = parseInt(timestampMatch[3]);
                                    const startMs = parseInt(timestampMatch[4]);
                                    const startTime = (startHours * 3600 + startMinutes * 60 + startSeconds) * 1000 + startMs;
                                    
                                    const endHours = parseInt(timestampMatch[5]);
                                    const endMinutes = parseInt(timestampMatch[6]);
                                    const endSeconds = parseInt(timestampMatch[7]);
                                    const endMs = parseInt(timestampMatch[8]);
                                    const endTime = (endHours * 3600 + endMinutes * 60 + endSeconds) * 1000 + endMs;
                                    
                                    // Get the text (next line)
                                    let text = '';
                                    if (i + 1 < lines.length) {
                                        text = lines[i + 1].trim();
                                        i++; // Skip the text line in the next iteration
                                    }
                                    
                                    // Only add entries with valid timestamps and non-empty text
                                    // Filter out segments with just whitespace
                                    if (startTime < endTime && text && text !== ' ') {
                                        segments.push({
                                            startTime,
                                            endTime,
                                            text
                                        });
                                    }
                                }
                            }
                        }
                        
                        // Step 2: Sort segments by start time
                        segments.sort((a, b) => a.startTime - b.startTime);
                        
                        // Step 3: Handle overlapping segments
                        const mergedSegments: Array<{startTime: number, endTime: number, text: string}> = [];
                        
                        if (segments.length > 0) {
                            let currentSegment = segments[0];
                            
                            for (let i = 1; i < segments.length; i++) {
                                const nextSegment = segments[i];
                                
                                // Check if segments overlap
                                if (nextSegment.startTime <= currentSegment.endTime) {
                                    // Merge overlapping segments
                                    // Keep the later end time
                                    currentSegment.endTime = Math.max(currentSegment.endTime, nextSegment.endTime);
                                    // Concatenate text if they're different
                                    if (currentSegment.text !== nextSegment.text) {
                                        currentSegment.text += ' ' + nextSegment.text;
                                    }
                                } else {
                                    // No overlap, add current segment to result and move to next
                                    mergedSegments.push(currentSegment);
                                    currentSegment = nextSegment;
                                }
                            }
                            
                            // Add the last segment
                            mergedSegments.push(currentSegment);
                        }
                        
                        console.log(`    [Parse Debug] Enhanced parser extracted ${segments.length} raw segments, merged into ${mergedSegments.length} clean segments`);
                        
                        return mergedSegments;
                    }
                    
                    /**
                     * Rebuilds a clean SRT string from parsed segments
                     */
                    function rebuildSrtString(segments: Array<{startTime: number, endTime: number, text: string}>): string {
                        let result = '';
                        
                        segments.forEach((segment, index) => {
                            // Add cue number
                            result += (index + 1) + '\n';
                            
                            // Format timestamps
                            const startHours = Math.floor(segment.startTime / 3600000).toString().padStart(2, '0');
                            const startMinutes = Math.floor((segment.startTime % 3600000) / 60000).toString().padStart(2, '0');
                            const startSeconds = Math.floor((segment.startTime % 60000) / 1000).toString().padStart(2, '0');
                            const startMs = (segment.startTime % 1000).toString().padStart(3, '0');
                            
                            const endHours = Math.floor(segment.endTime / 3600000).toString().padStart(2, '0');
                            const endMinutes = Math.floor((segment.endTime % 3600000) / 60000).toString().padStart(2, '0');
                            const endSeconds = Math.floor((segment.endTime % 60000) / 1000).toString().padStart(2, '0');
                            const endMs = (segment.endTime % 1000).toString().padStart(3, '0');
                            
                            result += `${startHours}:${startMinutes}:${startSeconds},${startMs} --> ${endHours}:${endMinutes}:${endSeconds},${endMs}\n`;
                            
                            // Add text
                            result += segment.text + '\n';
                            
                            // Add blank line between entries
                            result += '\n';
                        });
                        
                        return result;
                    }
                    // --- End Define SRT Helper Functions ---

                    // Process each item
                    for (const item of results) {
                        try {
                                // --- ADDED PLATFORM LOG ---
                                jobLogger.info(`  [Item Loop] Processing item URL: ${item.url || 'N/A'}, Platform Check: '${platform}'`, { itemUrl: item.url, platform });
                                // --- END PLATFORM LOG ---

                                // --- Platform-Specific Result Processing ---
                                let contentItemData: any = null;
                                let mediaToProcess: { url: string, type: 'video' | 'image', index?: number }[] = [];

                                // Use the lowercase 'platform' variable for checks
                                if (platform === 'instagram') { 
                                    // Define expected structure for Instagram
                                    interface InstagramResultItem {
                                        caption?: string | null;
                                        url?: string | null;
                                        timestamp?: string | null;
                                        type?: string | null; // 'Image', 'Video', 'Sidecar'
                                        displayUrl?: string | null;
                                        videoUrl?: string | null;
                                        images?: string[] | null; // For Sidecar
                                        [key: string]: any;
                                    }
                                    const typedItem = item as InstagramResultItem;

                                    const caption = typedItem.caption || null;
                                    const itemUrl = typedItem.url || 'N/A';
                                    const timestamp = typedItem.timestamp && typeof typedItem.timestamp === 'string'
                                        ? new Date(typedItem.timestamp)
                                        : new Date();
                                    const contentType = typedItem.type || 'unknown'; // e.g., 'Image', 'Video', 'Sidecar'
                                    const displayUrl = typedItem.displayUrl || null;
                                    const videoUrl = typedItem.videoUrl || null;

                                    contentItemData = {
                                        scan_job_id: scanJobRun.scan_job_id,
                                        publisher_id: publisherId,
                                        publisher_channel_id: channel.id,
                                        platform: platform,
                                        channel_url: channel.channel_url,
                                        url: itemUrl,
                                        caption: caption,
                                        transcript: null, // Instagram scraper doesn't provide transcripts
                                        content_type: contentType,
                                        scan_date: timestamp,
                                        raw_data: item as any,
                                    };

                                    // Prepare media for processing
                                    if (contentType === 'Video' && videoUrl) {
                                        mediaToProcess.push({ url: videoUrl, type: 'video' });
                                    } else if (contentType === 'Image' && displayUrl) {
                                        mediaToProcess.push({ url: displayUrl, type: 'image' });
                                    } else if (contentType === 'Sidecar' && Array.isArray(typedItem.images) && typedItem.images.length > 0) {
                                        typedItem.images.forEach((imgUrl, index) => {
                                            if (typeof imgUrl === 'string') {
                                                mediaToProcess.push({ url: imgUrl, type: 'image', index: index });
                                            }
                                        });
                                    }

                                } else if (platform === 'tiktok') { // Check against lowercase 'tiktok'
                                    // Define expected structure for TikTok
                                    interface TikTokResultItem {
                                        text?: string | null; // Caption
                                        webVideoUrl?: string | null; // Post URL
                                        createTimeISO?: string | null; // Timestamp
                                        isSlideshow?: boolean;
                                        videoMeta?: { downloadAddr?: string | null; subtitleLinks?: any[] }; // Video URL
                                        slideshowImageLinks?: { downloadLink?: string | null }[]; // Slideshow images
                                        [key: string]: any;
                                    }
                                    const typedItem = item as TikTokResultItem;

                                    const caption = typedItem.text || null;
                                    const itemUrl = typedItem.webVideoUrl || 'N/A';
                                    const timestamp = typedItem.createTimeISO && typeof typedItem.createTimeISO === 'string'
                                        ? new Date(typedItem.createTimeISO)
                                        : new Date();
                                    const isSlideshow = typedItem.isSlideshow === true;
                                    const contentType = isSlideshow ? 'TikTok Slideshow' : 'TikTok Video';
                                    const videoDownloadUrl = typedItem.videoMeta?.downloadAddr || null;
                                    const slideshowImages = typedItem.slideshowImageLinks || [];

                                    contentItemData = {
                                        scan_job_id: scanJobRun.scan_job_id,
                                        publisher_id: publisherId,
                                        publisher_channel_id: channel.id,
                                        platform: platform,
                                        channel_url: channel.channel_url,
                                        url: itemUrl,
                                        caption: caption,
                                        transcript: null, // Skipping subtitles for now
                                        content_type: contentType,
                                        scan_date: timestamp,
                                        raw_data: item as any,
                                    };

                                    // Prepare media for processing
                                    if (!isSlideshow && videoDownloadUrl) {
                                        mediaToProcess.push({ url: videoDownloadUrl, type: 'video' });
                                    } else if (isSlideshow && slideshowImages.length > 0) {
                                        slideshowImages.forEach((img, index) => {
                                            if (img.downloadLink && typeof img.downloadLink === 'string') {
                                                mediaToProcess.push({ url: img.downloadLink, type: 'image', index: index });
                                            }
                                        });
                                    }
                                } else if (platform === 'youtube') { // Check against lowercase 'youtube'
                                    // --- ADDED ENTRY LOG ---
                                    jobLogger.info(`[YouTube Proc] Entered processing block for item URL: ${item.url || 'N/A'}`, { itemUrl: item.url });
                                    // --- END ENTRY LOG ---

                                    // Define expected structure for YouTube Video
                                    // Based on example: { title, type, id, url, thumbnailUrl, viewCount, date, text, subtitles: [{ srtUrl, srt, type, language }], ... } // Added srt to example
                                    interface YouTubeSubtitle {
                                        srtUrl?: string | null;
                                        srt?: string | null; // Added optional direct srt content field
                                        type?: string | null;
                                        language?: string | null;
                                    }
                                    interface YouTubeResultItem {
                                        title?: string | null;
                                        url?: string | null;
                                        date?: string | null; // ISO Date string
                                        text?: string | null; // Video description
                                        thumbnailUrl?: string | null;
                                        subtitles?: YouTubeSubtitle[] | null;
                                        [key: string]: any; // Allow other fields
                                    }
                                    const typedItem = item as YouTubeResultItem;
                                    // jobLogger.info('    [Debug] typedItem structure (first 500 chars):', { structure: JSON.stringify(typedItem).substring(0, 500) });

                                    const videoTitle = typedItem.title || null;
                                    const caption = typedItem.text || null;
                                    // jobLogger.info(`    [Caption Debug] Value of caption (from typedItem.text) before saving: "${caption}"`);
                                    const itemUrl = typedItem.url || 'N/A';
                                    const timestamp = typedItem.date && typeof typedItem.date === 'string'
                                        ? new Date(typedItem.date)
                                        : new Date();
                                    const contentType = 'YouTube Video';
                                    const thumbnailUrl = typedItem.thumbnailUrl || null;

                                    let parsedTranscript: { startMs: number; endMs: number; text: string }[] = [];
                                    let rawTranscript: string | null = null;

                                    jobLogger.info(`    [Sub Debug] Processing item URL: ${itemUrl} for YouTube transcript`);

                                    if (typedItem.subtitles && Array.isArray(typedItem.subtitles) && typedItem.subtitles.length > 0) {
                                        jobLogger.info(`    [Sub Debug] Found subtitles array with ${typedItem.subtitles.length} entries`);
                                        const selectedSubtitle = typedItem.subtitles[0];

                                        if (selectedSubtitle && typeof selectedSubtitle.srt === 'string' && selectedSubtitle.srt.trim().length > 0) {
                                            jobLogger.info(`    [Sub Debug] Found direct 'srt' content in subtitle object.`);
                                            rawTranscript = selectedSubtitle.srt;
                                        } else if (selectedSubtitle?.srtUrl) {
                                            jobLogger.info(`    [Sub Debug] No direct 'srt' content. Found subtitle with URL: ${selectedSubtitle.srtUrl}. Fetching...`);
                                            try {
                                                rawTranscript = await getApifyKeyValueStoreRecordContent(selectedSubtitle.srtUrl);
                                                jobLogger.info(`    [Sub Debug] Fetched KVS content for srtUrl ${selectedSubtitle.srtUrl}, length: ${rawTranscript?.length ?? 'null'}`);
                                            } catch (kvsError: any) {
                                                jobLogger.error(`    [Sub Debug] Error fetching KVS content for srtUrl ${selectedSubtitle.srtUrl}`, kvsError);
                                                rawTranscript = null;
                                            }
                                        } else {
                                            jobLogger.warn(`    [Sub Debug] No usable 'srt' content or 'srtUrl' found in the first subtitle object.`);
                                        }

                                        if (rawTranscript) {
                                            jobLogger.info(`    Successfully obtained transcript (length: ${rawTranscript.length})`);
                                            try {
                                                const cleanedTranscript = preprocessSrt(rawTranscript);
                                                // jobLogger.info(`    [Parse Debug] Attempting to parse cleaned SRT (first 200 chars):\n"${cleanedTranscript.substring(0, 200)}..."`);
                                                let srtEntries: srt.SrtEntry[];
                                                try {
                                                    srtEntries = srt.parse(cleanedTranscript);
                                                } catch (standardParseError: unknown) {
                                                    const errMsg = standardParseError instanceof Error ? standardParseError.message : String(standardParseError);
                                                    jobLogger.warn(`    [Parse Debug] Standard SRT parsing failed, using fallback parser. Error: ${errMsg}`);
                                                    const enhancedEntries = enhancedSrtParse(cleanedTranscript);
                                                    // jobLogger.info(`    [Parse Debug] Enhanced parser extracted ${enhancedEntries.length} entries`);
                                                    srtEntries = enhancedEntries.map((entry: {startTime: number, endTime: number, text: string}) => ({
                                                        id: 0, startTime: entry.startTime, endTime: entry.endTime, text: entry.text
                                                    }));
                                                }
                                                parsedTranscript = srtEntries.map(entry => ({
                                                    startMs: entry.startTime, endMs: entry.endTime, text: entry.text
                                                }));
                                                parsedTranscript.forEach(entry => {
                                                    const timestampPattern = /\b\d{2}:\d{2}:\d{1,2},\d{3}\b\s*/g;
                                                    entry.text = entry.text.replace(timestampPattern, '').trim();
                                                });
                                                jobLogger.info(`    Successfully parsed and cleaned ${parsedTranscript.length} transcript segments`);
                                            } catch (parseErr: unknown) {
                                                const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
                                                jobLogger.error(`    Error parsing SRT transcript`, parseError);
                                            }
                                        } else {
                                            jobLogger.warn(`    Failed to obtain transcript content either directly or via URL fetch.`);
                                        }
                                    } else {
                                        jobLogger.info(`    [Sub Debug] No subtitles array found or it's empty for item ${itemUrl}.`);
                                    }

                                    contentItemData = {
                                        scan_job_id: scanJobRun.scan_job_id,
                                        publisher_id: publisherId,
                                        publisher_channel_id: channel.id,
                                        platform: platformFromDb, // Store the original DB platform string
                                        channel_url: channel.channel_url,
                                        url: itemUrl,
                                        title: videoTitle, // Store the video title
                                        caption: caption,
                                        transcript: parsedTranscript.length > 0 ? parsedTranscript : null, // Store parsed transcript as JSON
                                        content_type: contentType,
                                        scan_date: timestamp, // Use video publish date as scan date approximation
                                        raw_data: item as any, // Store the full raw data
                                    };

                                    // Prepare thumbnail for processing
                                    if (thumbnailUrl) {
                                        mediaToProcess.push({ url: thumbnailUrl, type: 'image' });
                                    }
                                // --- UPDATED YOUTUBE_SHORTS PLATFORM HANDLING ---
                                } else if (platform === 'youtube_shorts') {
                                    jobLogger.info(`  [YouTube Shorts Proc] Entered processing block for item URL: ${item.url || 'N/A'}`, { itemUrl: item.url });
                                    interface YouTubeSubtitle { srtUrl?: string | null; srt?: string | null; type?: string | null; language?: string | null; }
                                    interface YouTubeShortResultItem { title?: string | null; url?: string | null; date?: string | null; text?: string | null; thumbnailUrl?: string | null; subtitles?: YouTubeSubtitle[] | null; [key: string]: any; }
                                    const typedItem = item as YouTubeShortResultItem;
                                    // jobLogger.info('    [Shorts Debug] typedItem structure (first 500 chars):', { structure: JSON.stringify(typedItem).substring(0, 500) });

                                    const shortTitle = typedItem.title || null;
                                    const shortDescription = typedItem.text || null;
                                    const itemUrl = typedItem.url || 'N/A';
                                    const timestamp = typedItem.date && typeof typedItem.date === 'string' ? new Date(typedItem.date) : new Date();
                                    const contentType = 'YouTube Short';
                                    const thumbnailUrl = typedItem.thumbnailUrl || null;

                                    let parsedTranscript: { startMs: number; endMs: number; text: string }[] = [];
                                    let rawTranscript: string | null = null;

                                    jobLogger.info(`    [Shorts Sub Debug] Processing item URL: ${itemUrl} for YouTube Shorts transcript`);
                                    if (typedItem.subtitles && Array.isArray(typedItem.subtitles) && typedItem.subtitles.length > 0) {
                                        jobLogger.info(`    [Shorts Sub Debug] Found subtitles array with ${typedItem.subtitles.length} entries`);
                                        const selectedSubtitle = typedItem.subtitles[0];
                                        if (selectedSubtitle && typeof selectedSubtitle.srt === 'string' && selectedSubtitle.srt.trim().length > 0) {
                                            jobLogger.info(`    [Shorts Sub Debug] Found direct 'srt' content.`);
                                            rawTranscript = selectedSubtitle.srt;
                                        } else if (selectedSubtitle?.srtUrl) {
                                            jobLogger.info(`    [Shorts Sub Debug] No direct 'srt'. Found subtitle URL: ${selectedSubtitle.srtUrl}. Fetching...`);
                                            try {
                                                rawTranscript = await getApifyKeyValueStoreRecordContent(selectedSubtitle.srtUrl);
                                                jobLogger.info(`    [Shorts Sub Debug] Fetched KVS content for srtUrl ${selectedSubtitle.srtUrl}, length: ${rawTranscript?.length ?? 'null'}`);
                                            } catch (kvsError: any) {
                                                jobLogger.error(`    [Shorts Sub Debug] Error fetching KVS content for srtUrl ${selectedSubtitle.srtUrl}`, kvsError);
                                                rawTranscript = null;
                                            }
                                        } else {
                                            jobLogger.warn(`    [Shorts Sub Debug] No usable 'srt' content or 'srtUrl' found.`);
                                        }

                                        if (rawTranscript) {
                                            jobLogger.info(`    [Shorts Sub Debug] Obtained transcript (length: ${rawTranscript.length})`);
                                            try {
                                                const cleanedTranscript = preprocessSrt(rawTranscript);
                                                // jobLogger.info(`    [Shorts Parse Debug] Attempting to parse cleaned SRT...`);
                                                let srtEntries: srt.SrtEntry[];
                                                try {
                                                    srtEntries = srt.parse(cleanedTranscript);
                                                } catch (standardParseError: unknown) {
                                                    const errMsg = standardParseError instanceof Error ? standardParseError.message : String(standardParseError);
                                                    jobLogger.warn(`    [Shorts Parse Debug] Standard SRT parsing failed, using fallback. Error: ${errMsg}`);
                                                    const enhancedEntries = enhancedSrtParse(cleanedTranscript);
                                                    // jobLogger.info(`    [Shorts Parse Debug] Enhanced parser extracted ${enhancedEntries.length} entries`);
                                                    srtEntries = enhancedEntries.map((entry: {startTime: number, endTime: number, text: string}) => ({
                                                        id: 0, startTime: entry.startTime, endTime: entry.endTime, text: entry.text
                                                    }));
                                                }
                                                parsedTranscript = srtEntries.map(entry => ({
                                                    startMs: entry.startTime, endMs: entry.endTime, text: entry.text
                                                }));
                                                parsedTranscript.forEach(entry => {
                                                    const timestampPattern = /\b\d{2}:\d{2}:\d{1,2},\d{3}\b\s*/g;
                                                    entry.text = entry.text.replace(timestampPattern, '').trim();
                                                });
                                                jobLogger.info(`    [Shorts Sub Debug] Successfully parsed and cleaned ${parsedTranscript.length} transcript segments`);
                                            } catch (parseErr: unknown) {
                                                const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
                                                jobLogger.error(`    [Shorts Sub Debug] Error parsing SRT transcript`, parseError);
                                            }
                                        } else {
                                            jobLogger.warn(`    [Shorts Sub Debug] Failed to obtain transcript content.`);
                                        }
                                    } else {
                                        jobLogger.info(`    [Shorts Sub Debug] No subtitles array found or it's empty for item ${itemUrl}.`);
                                    }

                                    contentItemData = {
                                        scan_job_id: scanJobRun.scan_job_id,
                                        publisher_id: publisherId,
                                        publisher_channel_id: channel.id,
                                        platform: platformFromDb, // Store the original DB platform string ('YOUTUBE_SHORTS')
                                        channel_url: channel.channel_url,
                                        url: itemUrl,
                                        title: shortTitle,
                                        caption: shortDescription, // Use 'text' field as caption
                                        transcript: parsedTranscript.length > 0 ? parsedTranscript : null, // Store parsed SRT data
                                        content_type: contentType,
                                        scan_date: timestamp, // Use publish date if available
                                        raw_data: item as any,
                                    };

                                    // Prepare thumbnail for processing if available
                                    if (thumbnailUrl) {
                                        mediaToProcess.push({ url: thumbnailUrl, type: 'image' });
                                    }

                                } else {
                                    jobLogger.warn(`Unsupported platform '${platformFromDb}' (normalized to '${platform}') encountered during result processing for item.`, { platformFromDb, platform, item });
                                    errorCount++;
                                    continue; // Skip this item
                                }
                                // --- End Platform-Specific Result Processing ---


                                // Insert into the database
                                const createdContentItem = await prisma.content_items.create({
                                    data: contentItemData,
                                });
                                jobLogger.info(`  Saved content item ${createdContentItem.id} (Platform: ${platform}, URL: ${contentItemData.url})`, { contentItemId: createdContentItem.id, platform, url: contentItemData.url });

                                // --- Process Media (Await completion) ---
                                let allMediaProcessedSuccessfully = true;
                                if (mediaToProcess.length > 0) {
                                    jobLogger.info(`    Processing ${mediaToProcess.length} media item(s) for content item ${createdContentItem.id}`);
                                    const mediaProcessingPromises = mediaToProcess.map(media =>
                                        handleMediaProcessing(media.url, media.type, createdContentItem.id, scanJobRun.scan_job_id, media.index) // Pass scanJobId
                                    );
                                    const mediaResults = await Promise.all(mediaProcessingPromises);
                                    if (mediaResults.some(result => result === null)) {
                                        allMediaProcessedSuccessfully = false;
                                        jobLogger.warn(`    One or more media items failed processing for content item ${createdContentItem.id}. AI analysis might lack full context.`);
                                    }
                                } else {
                                    jobLogger.info(`    No downloadable media found for content item ${createdContentItem.id}`);
                                }
                                // --- End Process Media ---

                                if (allMediaProcessedSuccessfully) {
                                    const scanJobProducts = await prisma.scan_job_product_focus.findMany({
                                        where: { scan_job_id: scanJobRun.scan_job_id },
                                        select: { product_id: true }
                                    });
                                    const productIdsForAnalysis = scanJobProducts.map(p => p.product_id);
                                    jobLogger.info(`[Item Loop] Triggering AI analysis for content item ${createdContentItem.id} with ${productIdsForAnalysis.length} products: ${productIdsForAnalysis.join(', ')}`);
                                    
                                    // Pass scanJobRun.scan_job_id as the scanJobId parameter
                                    analyzeContentItemForFlags(
                                        createdContentItem.id,
                                        scanJobRun.scan_job_id, // This is the master scan_job_id
                                        productIdsForAnalysis,
                                        {}
                                    ).catch(aiErr => {
                                        const aiError = aiErr instanceof Error ? aiErr : new Error(String(aiErr));
                                        jobLogger.error(`Error triggering AI analysis for content item ${createdContentItem.id}`, aiError);
                                    });
                                } else {
                                     jobLogger.warn(`Skipping AI analysis trigger for content item ${createdContentItem.id} due to media processing errors.`);
                                }
                                processedCount++;
                            } catch (itemErr: unknown) {
                                const itemError = itemErr instanceof Error ? itemErr : new Error(String(itemErr));
                                jobLogger.error(`!!! ERROR PROCESSING ITEM (URL: ${item.url || 'N/A'}) !!!`, itemError, { itemData: item });
                                errorCount++;
                            }
                    }

                    // Update final status based on processing outcome
                    if (errorCount === 0) {
                        newStatus = 'COMPLETED'; // Final success status
                        statusDetails = `Successfully fetched and processed ${processedCount} items.`;
                    } else {
                        newStatus = 'PROCESSING_FAILED'; // Partial or total failure during item processing
                        statusDetails = `Fetched ${results.length} items, but failed to process ${errorCount} items. ${processedCount} processed successfully.`;
                    }
                    jobLogger.info(`Marking run ${scanJobRun.apify_run_id} as ${newStatus}.`, { statusDetails });

                    await prisma.scan_job_runs.update({
                        where: { id: scanJobRunId },
                        data: { status: newStatus, status_details: statusDetails },
                    });
                    await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} completion`, e instanceof Error ? e : new Error(String(e))));
                    return;

                } catch (fetchErr: unknown) {
                    const fetchError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
                    jobLogger.error(`[Process Run] Error during getApifyRunResults for run ${scanJobRun.apify_run_id}`, fetchError);
                    newStatus = 'PROCESSING_FAILED';
                    statusDetails = `Failed to fetch results: ${fetchError.message}`;
                    await prisma.scan_job_runs.update({
                        where: { id: scanJobRunId },
                        data: { status: newStatus, status_details: statusDetails },
                    });
                    await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} failure`, e instanceof Error ? e : new Error(String(e))));
                    return;
                }

            case 'FAILED':
            case 'TIMED-OUT':
            case 'ABORTED':
                newStatus = 'FAILED';
                runFinishedAt = apifyRunDetails.finishedAt || new Date();
                statusDetails = `Apify run failed with status: ${apifyStatus}. Actor run ID: ${scanJobRun.apify_run_id}`;
                jobLogger.warn(`Apify run ${scanJobRun.apify_run_id} ${apifyStatus}. Updating status to ${newStatus}.`);
                await prisma.scan_job_runs.update({
                    where: { id: scanJobRunId },
                    data: {
                        status: newStatus,
                        status_details: statusDetails,
                        run_finished_at: runFinishedAt,
                    },
                });
                jobLogger.info(`Updated scan_job_run ${scanJobRunId} status to ${newStatus}.`);
                await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} terminal failure`, e instanceof Error ? e : new Error(String(e))));
                return;

            case 'RUNNING':
            case 'READY':
                jobLogger.info(`Apify run ${scanJobRun.apify_run_id} is still ${apifyStatus}. No status change needed yet.`);
                return;
            default:
                jobLogger.warn(`Apify run ${scanJobRun.apify_run_id} has unexpected status: ${apifyStatus}.`);
                newStatus = 'UNKNOWN';
                statusDetails = `Unexpected Apify status: ${apifyStatus}`;
                await prisma.scan_job_runs.update({
                    where: { id: scanJobRunId },
                    data: {
                        status: newStatus,
                        status_details: statusDetails,
                        run_finished_at: runFinishedAt,
                    },
                });
                jobLogger.info(`Updated scan_job_run ${scanJobRunId} status to ${newStatus}.`);
                await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} unexpected status`, e instanceof Error ? e : new Error(String(e))));
                return;
        }

        // This part is now only reached if the status was updated within the SUCCEEDED case's try/catch
        // or if an error occurred before the switch statement.
        // The updates for FAILED/TIMED-OUT/ABORTED/UNKNOWN/READY/RUNNING are handled within their respective cases.

        // TODO: After updating a run (especially to COMPLETED or PROCESSING_FAILED),
        // check if the parent scan_job is now complete
        // (i.e., all its associated scan_job_runs are in a final state like
        // PROCESSING_COMPLETE or FAILED). If so, update the master scan_job status
        // and end_time.

    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        jobLogger.error(`Error processing completion for scan_job_run ${scanJobRunId} (Apify Run ID: ${scanJobRun.apify_run_id})`, error);
        try {
            await prisma.scan_job_runs.update({
                where: { id: scanJobRunId },
                data: { status: 'PROCESSING_ERROR', status_details: `Error checking status or updating DB: ${error.message}` },
            });
            await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} processing error`, e instanceof Error ? e : new Error(String(e))));
        } catch (dbErr: unknown) {
            const dbError = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
            jobLogger.error(`Failed to update scan_job_run ${scanJobRunId} status to PROCESSING_ERROR`, dbError);
            await checkAndUpdateParentScanJobStatus(scanJobRun.scan_job_id).catch(e => jobLogger.error(`Error checking parent job status after run ${scanJobRunId} DB error`, e instanceof Error ? e : new Error(String(e))));
        }
    }
};

/**
 * Helper function to download media, upload to GCS, and save reference.
 * @param mediaUrl The URL of the media to process.
 * @param expectedType The expected type ('video' or 'image').
 * @param contentItemId The ID of the parent content_items record.
 * @param scanJobId The ID of the master scan job for logging.
 * @param index Optional index for differentiating items within a Sidecar.
 * @returns The ID of the created content_images record, or null if processing failed.
 */
const handleMediaProcessing = async (mediaUrl: string, expectedType: 'video' | 'image', contentItemId: string, scanJobId: string, index?: number): Promise<string | null> => {
    const jobLogger = createJobLogger(scanJobId);
    const logPrefix = index !== undefined ? `    [Image ${index}]` : '   ';
    jobLogger.info(`${logPrefix} Handling media (${expectedType}): ${mediaUrl} for content item ${contentItemId}`);
    try {
        // 1. Download media
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const originalFilename = path.basename(new URL(mediaUrl).pathname);

        // Calculate SHA256 hash
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        // 2. Determine media type and extension
        let mediaType = expectedType; // Start with expected type
        let contentTypeHeader = response.headers['content-type'] || 'application/octet-stream';
        // Refine type based on header if possible
        if (contentTypeHeader.includes('image/')) mediaType = 'image';
        if (contentTypeHeader.includes('video/')) mediaType = 'video';
        const fileExtension = path.extname(originalFilename) || (mediaType === 'image' ? '.jpg' : '.mp4'); // Default extension based on refined type

        // 3. Generate GCS filename
        let fileNameBase = `${mediaType}`;
        if (index !== undefined) {
             fileNameBase += `_${index}`; // Add index for sidecar images, e.g., image_0, image_1
        }
        const destinationFileName = `media/${contentItemId}/${fileNameBase}${fileExtension}`;


        // 4. Upload to GCS
        const gcsUrl = await uploadBufferToGCS(buffer, destinationFileName, contentTypeHeader);
        jobLogger.info(`    Successfully uploaded media to GCS: ${gcsUrl}`);

        // 5. Save reference to content_images table
        const createdMediaRecord = await prisma.content_images.create({
            data: {
                content_item_id: contentItemId,
                image_type: mediaType, // Use refined type
                file_path: gcsUrl,
                file_size: buffer.length,
                sha256: hash, // Store the SHA256 hash
            }
        });
        jobLogger.info(`    Saved media reference ${createdMediaRecord.id} to content_images for content item ${contentItemId}`);
        return createdMediaRecord.id;

    } catch (mediaErr: unknown) {
        const mediaError = mediaErr instanceof Error ? mediaErr : new Error(String(mediaErr));
        jobLogger.error(`${logPrefix} Error handling media (${mediaUrl}) for content item ${contentItemId}.`, mediaError);
        return null;
    }
};


/**
 * Periodically checks for active scan job runs ('STARTED') and processes their completion status.
 */
/**
 * Assigns a user to a scan job.
 * @param scanJobId - The ID of the scan job to update.
 * @param assigneeId - The ID of the user to assign to the scan job.
 * @returns The updated scan job.
 */
export const assignUserToScanJob = async (
    scanJobId: string,
    assigneeId: string
): Promise<ScanJob> => {
    console.log(`[Backend] assignUserToScanJob called with scanJobId=${scanJobId}, assigneeId=${assigneeId}`);
    
    // Verify the user exists and has appropriate role
    const user = await prisma.users.findUnique({
        where: { id: assigneeId },
        select: { id: true, name: true, role: true, publisher_id: true }
    });

    if (!user) {
        console.error(`[Backend] User with ID ${assigneeId} not found.`);
        throw new Error(`User with ID ${assigneeId} not found.`);
    }

    console.log(`[Backend] Found user: ${user.name} (${user.role})`);

    // Check if user has appropriate role (reviewer or manager)
    if (user.role !== 'reviewer' && user.role !== 'manager' && user.role !== 'admin') {
        console.error(`[Backend] User ${user.name} has role '${user.role}' which cannot be assigned to scan jobs.`);
        throw new Error(`User with ID ${assigneeId} has role '${user.role}' which cannot be assigned to scan jobs. Only reviewers, managers, and admins can be assigned.`);
    }

    // Check if user is a publisher (publishers should not be assigned)
    if (user.publisher_id) {
        console.error(`[Backend] User ${user.name} is associated with a publisher and cannot be assigned to scan jobs.`);
        throw new Error(`User with ID ${assigneeId} is associated with a publisher and cannot be assigned to scan jobs.`);
    }

    // Verify the scan job exists
    const scanJob = await prisma.scan_jobs.findUnique({
        where: { id: scanJobId }
    });

    if (!scanJob) {
        console.error(`[Backend] Scan job with ID ${scanJobId} not found.`);
        throw new Error(`Scan job with ID ${scanJobId} not found.`);
    }

    console.log(`[Backend] Found scan job: ${scanJob.name || scanJob.id}`);

    try {
        // Update the scan job with the new assignee
        const updatedJob = await scanJobRepository.updateScanJob(scanJobId, {
            assignee: { connect: { id: assigneeId } }
        });
        
        console.log(`[Backend] Successfully assigned user ${user.name} to scan job ${scanJob.name || scanJob.id}`);
        
        // Update all flags associated with this scan job's content items
        console.log(`[Backend] Updating flags associated with scan job ${scanJobId} to have reviewer_id=${assigneeId}`);
        
        // Find all content items associated with this scan job
        console.log(`[Backend] Querying content_items with scan_job_id=${scanJobId}`);
        const contentItems = await prisma.content_items.findMany({
            where: { scan_job_id: scanJobId },
            select: { id: true }
        });
        
        const contentItemIds = contentItems.map(item => item.id);
        console.log(`[Backend] Found ${contentItemIds.length} content items associated with scan job ${scanJobId}`);
        
        if (contentItemIds.length > 0) {
            // Count total flags associated with these content items
            const totalFlagsCount = await prisma.flags.count({
                where: { content_item_id: { in: contentItemIds } }
            });
            console.log(`[Backend] Found ${totalFlagsCount} total flags associated with these content items`);
            
            // Count flags with no reviewer
            const noReviewerCount = await prisma.flags.count({
                where: { 
                    content_item_id: { in: contentItemIds },
                    reviewer_id: null
                }
            });
            console.log(`[Backend] Of these, ${noReviewerCount} flags have no reviewer assigned`);
            
            // Update ALL flags associated with this scan job
            const updateResult = await prisma.flags.updateMany({
                where: { 
                    content_item_id: { in: contentItemIds }
                    // Removed the reviewer_id: null condition to update all flags
                },
                data: { 
                    reviewer_id: assigneeId,
                    // Update the in_review_at timestamp when assigning a reviewer
                    in_review_at: new Date()
                }
            });
            
            console.log(`[Backend] Updated ${updateResult.count} flags to have reviewer_id=${assigneeId}`);
            
            // Verify the update worked
            const verifyCount = await prisma.flags.count({
                where: {
                    content_item_id: { in: contentItemIds },
                    reviewer_id: assigneeId
                }
            });
            console.log(`[Backend] After update, ${verifyCount} flags now have reviewer_id=${assigneeId}`);
        } else {
            console.log(`[Backend] No content items found for scan job ${scanJobId}, no flags to update`);
        }
        
        // Return the updated job with the assignee_name field
        const enrichedJob = await scanJobRepository.getScanJobById(scanJobId);
        if (!enrichedJob) {
            throw new Error(`Failed to retrieve updated scan job with ID ${scanJobId}`);
        }
        
        return enrichedJob;
    } catch (error) {
        console.error(`[Backend] Error assigning user to scan job:`, error);
        throw error;
    }
};

/**
 * Unassigns a user from a scan job.
 * @param scanJobId - The ID of the scan job to update.
 * @returns The updated scan job.
 */
export const unassignUserFromScanJob = async (
    scanJobId: string
): Promise<ScanJob> => {
    // Update the scan job to remove the assignee
    return scanJobRepository.updateScanJob(scanJobId, {
        assignee: { disconnect: true }
    });
};

/**
 * Diagnoses issues with scan jobs that have no content items.
 * This is a helper function to understand why a scan job might not have any content items.
 * @param scanJobId The ID of the scan job to diagnose.
 */
export const diagnoseScanJobContentItems = async (scanJobId: string): Promise<void> => {
    console.log(`[Diagnostic] Running content item diagnosis for scan job ${scanJobId}`);
    
    try {
        // 1. Check if the scan job exists
        const scanJob = await prisma.scan_jobs.findUnique({
            where: { id: scanJobId },
            include: {
                scan_job_runs: true,
                scan_job_publishers: true,
                scan_job_product_focus: true
            }
        });
        
        if (!scanJob) {
            console.error(`[Diagnostic] Scan job ${scanJobId} not found.`);
            return;
        }
        
        console.log(`[Diagnostic] Found scan job: ${scanJob.name || scanJob.id} (Status: ${scanJob.status})`);
        console.log(`[Diagnostic] Scan job has ${scanJob.scan_job_runs?.length || 0} runs, ${scanJob.scan_job_publishers?.length || 0} publishers, ${scanJob.scan_job_product_focus?.length || 0} products`);
        
        // 2. Check content items directly
        const contentItems = await prisma.content_items.findMany({
            where: { scan_job_id: scanJobId },
            select: { 
                id: true,
                platform: true,
                url: true,
                created_at: true
            }
        });
        
        console.log(`[Diagnostic] Found ${contentItems.length} content items for scan job ${scanJobId}`);
        
        if (contentItems.length > 0) {
            // Sample a few content items
            const sampleSize = Math.min(5, contentItems.length);
            console.log(`[Diagnostic] Sample of ${sampleSize} content items:`);
            for (let i = 0; i < sampleSize; i++) {
                const item = contentItems[i];
                console.log(`[Diagnostic] Content item ${i+1}: ID=${item.id}, Platform=${item.platform}, URL=${item.url}, Created=${item.created_at}`);
            }
            
            // 3. Check flags for these content items
            const contentItemIds = contentItems.map(item => item.id);
            const flagsCount = await prisma.flags.count({
                where: { content_item_id: { in: contentItemIds } }
            });
            
            console.log(`[Diagnostic] Found ${flagsCount} flags for these content items`);
            
            // 4. Check flags with no reviewer
            const noReviewerCount = await prisma.flags.count({
                where: { 
                    content_item_id: { in: contentItemIds },
                    reviewer_id: null
                }
            });
            
            console.log(`[Diagnostic] Of these, ${noReviewerCount} flags have no reviewer assigned`);
            
            // 5. Check if any flags have reviewers
            if (flagsCount > noReviewerCount) {
                const reviewerAssignedFlags = await prisma.flags.findMany({
                    where: {
                        content_item_id: { in: contentItemIds },
                        NOT: { reviewer_id: null }
                    },
                    select: {
                        id: true,
                        reviewer_id: true,
                        content_item_id: true
                    },
                    take: 5 // Sample a few
                });
                
                console.log(`[Diagnostic] Sample of flags with reviewers:`);
                for (const flag of reviewerAssignedFlags) {
                    console.log(`[Diagnostic] Flag ${flag.id} for content item ${flag.content_item_id} has reviewer ${flag.reviewer_id}`);
                }
            }
        } else {
            // 6. If no content items, check scan job runs for clues
            console.log(`[Diagnostic] No content items found. Checking scan job runs for clues...`);
            
            if (scanJob.scan_job_runs && scanJob.scan_job_runs.length > 0) {
                for (const run of scanJob.scan_job_runs) {
                    console.log(`[Diagnostic] Run ${run.id}: Status=${run.status}, Started=${run.run_started_at}, Finished=${run.run_finished_at || 'N/A'}`);
                    console.log(`[Diagnostic] Run details: ${run.status_details || 'No details'}`);
                }
            } else {
                console.log(`[Diagnostic] No scan job runs found. This could indicate the scan job was created but no runs were initiated.`);
            }
        }
        
    } catch (error) {
        console.error(`[Diagnostic] Error diagnosing scan job ${scanJobId}:`, error);
    }
};

export const monitorActiveScanRuns = async (): Promise<void> => {
    // This function runs frequently, so avoid creating job-specific loggers here
    // unless an active run is found. The job-specific logger will be created
    // inside processApifyRunCompletion.
    console.log('Monitoring active scan runs...'); // General log
    try {
        const activeRuns = await prisma.scan_job_runs.findMany({
            where: {
                status: 'STARTED',
            },
            select: {
                id: true,
                scan_job_id: true, // Fetch scan_job_id to pass to processApifyRunCompletion
            },
        });

        if (activeRuns.length === 0) {
            // console.log('No active scan runs found to monitor.'); // Too verbose for frequent runs
            return;
        }

        console.log(`Found ${activeRuns.length} active scan runs to check.`); // General log

        for (const run of activeRuns) {
            // Pass both run.id (scanJobRunId) and run.scan_job_id (master scanJobId)
            processApifyRunCompletion(run.id, run.scan_job_id).catch(error => {
                // If processApifyRunCompletion itself throws an unhandled error before its own logger is set up
                const jobLoggerForError = createJobLogger(run.scan_job_id);
                jobLoggerForError.error(`Unhandled error processing run ${run.id} during monitoring loop`, error instanceof Error ? error : new Error(String(error)));
            });
        }

    } catch (err: unknown) {
        // General error for the monitor itself, not tied to a specific job yet
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error during monitoring active scan runs:', error.message, error);
    }
};

/**
 * Checks if all runs for a given parent scan job are complete and updates the parent job status.
 * @param scanJobId The ID of the parent scan_jobs record.
 */
const checkAndUpdateParentScanJobStatus = async (scanJobId: string): Promise<void> => {
    const jobLogger = createJobLogger(scanJobId);
    jobLogger.info(`Checking parent scan job status for scanJobId: ${scanJobId}`);
    try {
        const parentJob = await prisma.scan_jobs.findUnique({
            where: { id: scanJobId },
            include: { scan_job_runs: true }
        });

        if (!parentJob) {
            jobLogger.error(`Parent scan job ${scanJobId} not found.`);
            return;
        }

        const finalParentStates = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'COMPLETED_NO_RUNS'];
        if (finalParentStates.includes(parentJob.status)) {
            jobLogger.info(`Parent scan job ${scanJobId} is already in a final state (${parentJob.status}). No update needed.`);
            return;
        }

        const runs = parentJob.scan_job_runs;
        if (!runs || runs.length === 0) {
            jobLogger.warn(`No associated runs found for parent scan job ${scanJobId}. Setting status to COMPLETED_NO_RUNS.`);
            await scanJobRepository.updateScanJob(scanJobId, {
                status: 'COMPLETED_NO_RUNS',
                end_time: new Date(),
            });
            return;
        }

        const finalRunStates = ['COMPLETED', 'FAILED', 'PROCESSING_FAILED', 'FAILED_TO_START'];
        const allRunsFinished = runs.every(run => finalRunStates.includes(run.status));

        if (!allRunsFinished) {
            jobLogger.info(`Not all runs for parent scan job ${scanJobId} are finished yet. Status check deferred.`);
            return;
        }

        const hasFailures = runs.some(run => run.status === 'FAILED' || run.status === 'PROCESSING_FAILED' || run.status === 'FAILED_TO_START');
        const finalStatus = hasFailures ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
        const endTime = new Date();

        jobLogger.info(`All runs for parent scan job ${scanJobId} are finished. Updating parent status to ${finalStatus}.`);
        await scanJobRepository.updateScanJob(scanJobId, {
            status: finalStatus,
            end_time: endTime,
        });
        jobLogger.info(`Parent scan job ${scanJobId} status updated successfully.`);

        // After successfully updating the parent job to a completed state,
        // trigger the AI Bypass Processor for this scan job.
        if (finalStatus === 'COMPLETED' || finalStatus === 'COMPLETED_WITH_ERRORS') {
            try {
                await aiBypassQueue.add(
                    `ai-bypass-${scanJobId}-${Date.now()}`, // Job name
                    { scan_job_id: scanJobId }, // Job data
                    { jobId: `ai-bypass-${scanJobId}` } // Optional: custom job ID
                );
                jobLogger.info(`[ScanJobService] Job added to ${AI_BYPASS_QUEUE_NAME} for scanJobId ${scanJobId}`);
            } catch (queueError: any) {
                jobLogger.error(`[ScanJobService] Failed to add job to ${AI_BYPASS_QUEUE_NAME} for scanJobId ${scanJobId}`, queueError);
            }
        }

    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        jobLogger.error(`Error checking/updating parent scan job status for ${scanJobId}`, error);
    }
};
