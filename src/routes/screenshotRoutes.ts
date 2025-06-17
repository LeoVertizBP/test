import express, { Response, NextFunction } from 'express'; // Removed Request import, using AuthenticatedRequest instead
import asyncHandler from 'express-async-handler';
import { content_items as ContentItem } from '../../generated/prisma'; // Adjust path if needed
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware'; // Correct import name and type
import { screenshotRateLimiter } from '../middleware/rateLimiter';
import * as screenshotService from '../services/screenshotService';
import * as gcsService from '../services/gcsService';
import * as hashUtil from '../utils/hashUtil';
import * as logger from '../utils/logUtil';
import dotenv from 'dotenv';
import prisma from '../utils/prismaClient'; // Import shared prisma client

dotenv.config();

const router = express.Router();
const MODULE_NAME = 'ScreenshotRoutes';

// Environment variables for configuration
const CACHE_WINDOW_SEC = parseInt(process.env.CACHE_WINDOW_SEC || '5', 10);

interface ScreenshotRequestBody {
    videoId: string;
    seconds: number;
    flagId: string;
}

// POST /api/screenshots
router.post(
    '/',
    authenticateToken, // Use correct middleware name
    screenshotRateLimiter, // Then apply rate limiting
    asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Use AuthenticatedRequest type
        const { videoId, seconds, flagId } = req.body as ScreenshotRequestBody;
        const organizationId = req.user?.organizationId; // Access user via the typed request

        // --- Input Validation ---
        if (!videoId || typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            res.status(400).json({ error: 'Invalid or missing videoId (must be 11 chars)' });
            return;
        }
        if (seconds === undefined || typeof seconds !== 'number' || seconds < 0) {
            res.status(400).json({ error: 'Invalid or missing seconds (must be a non-negative number)' });
            return;
        }
        if (!flagId || typeof flagId !== 'string') { // Add UUID validation if needed
            res.status(400).json({ error: 'Invalid or missing flagId' });
            return;
        }
        if (!organizationId) {
             logger.error(MODULE_NAME, 'Organization ID not found on authenticated user.', { userId: req.user?.id });
             res.status(401).json({ error: 'User organization not found.' });
             return;
        }

        logger.info(MODULE_NAME, `Received screenshot request for flag ${flagId}, video ${videoId} at ${seconds}s`);

        // --- Calculate GCS Path (using cache window) ---
        const timeSuffix = Math.floor(seconds / CACHE_WINDOW_SEC) * CACHE_WINDOW_SEC;
        const destinationFileName = `frames/${organizationId}/${videoId}_${timeSuffix}.png`;

        try {
            // --- Check GCS Cache ---
            const exists = await gcsService.checkFileExists(destinationFileName);

            if (exists) {
                logger.info(MODULE_NAME, `Cache hit for ${destinationFileName}. Linking existing image.`);
                // Find the existing content_images record by path
                const existingImage = await prisma.content_images.findFirst({
                    where: { file_path: destinationFileName },
                    select: { id: true }
                });

                if (existingImage) {
                    // Link this image to the flag
                    await prisma.flags.update({
                        where: { id: flagId },
                        data: { image_reference_id: existingImage.id }
                    });
                    logger.info(MODULE_NAME, `Successfully linked existing image ${existingImage.id} to flag ${flagId}`);
                    const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destinationFileName}`;
                    res.status(200).json({ screenshotUrl: publicUrl, cached: true });
                    return;
                } else {
                    // This case is unlikely if checkFileExists is true, but handle defensively
                    logger.warn(MODULE_NAME, `File exists in GCS (${destinationFileName}) but no corresponding DB record found. Proceeding to capture.`);
                }
            }

            // --- Cache Miss: Capture Screenshot ---
            logger.info(MODULE_NAME, `Cache miss for ${destinationFileName}. Capturing new screenshot.`);
            const imageBuffer = await screenshotService.captureYoutubeFrame(videoId, seconds);

            if (!imageBuffer) {
                logger.error(MODULE_NAME, `Failed to capture screenshot for video ${videoId}`);
                // Consider more specific errors based on captureYoutubeFrame's potential throws
                res.status(500).json({ error: 'Failed to capture screenshot. Video might be unavailable or an error occurred.' });
                return;
            }

            // --- Process and Upload ---
            const sha256 = hashUtil.calculateSha256(imageBuffer);
            const capturedAt = new Date();
            const customMetadata = {
                sha256: sha256,
                captured_at: capturedAt.toISOString(),
                source_flag_id: flagId // Add flag ID for traceability
            };

            const publicUrl = await gcsService.uploadBufferToGCS(
                imageBuffer,
                destinationFileName,
                'image/png',
                customMetadata
                // cacheControl can use default from gcsService
            );

            // --- Update Database ---
            // 1. Find the content_item_id associated with the flag
            const flag = await prisma.flags.findUnique({
                where: { id: flagId },
                select: { content_item_id: true }
            });

            if (!flag) {
                // Should not happen if flagId is valid, but handle defensively
                logger.error(MODULE_NAME, `Flag not found for ID: ${flagId} after capturing screenshot.`);
                res.status(404).json({ error: 'Flag not found after capture.' });
                return;
            }

            // 2. Create new content_images record
            const newImage = await prisma.content_images.create({
                data: {
                    content_item_id: flag.content_item_id,
                    image_type: 'screenshot', // Specific type for screenshots
                    file_path: destinationFileName,
                    file_size: imageBuffer.length,
                    sha256: sha256,
                    captured_at: capturedAt,
                    // width/height could be added if needed, potentially from Playwright
                }
            });

            // 3. Link the new image to the flag
            await prisma.flags.update({
                where: { id: flagId },
                data: { image_reference_id: newImage.id }
            });

            logger.info(MODULE_NAME, `Successfully captured, uploaded (${destinationFileName}), and linked new image ${newImage.id} to flag ${flagId}`);
            res.status(200).json({ screenshotUrl: publicUrl, cached: false });
            // No return needed here as it's the end of the successful path

        } catch (error: any) {
            logger.error(MODULE_NAME, `Error processing screenshot request for flag ${flagId}: ${error.message}`, error);
            next(error); // Pass to global error handler
        }
    })
);

export default router;
