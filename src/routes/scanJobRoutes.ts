import express, { Request, Response, Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware'; // Assuming middleware exports AuthenticatedRequest type
import * as scanJobService from '../services/scanJobService';
import asyncHandler from '../utils/asyncHandler'; // Utility to handle async errors
import prisma from '../utils/prismaClient'; // Import the Prisma client instance
import { Prisma } from '../../generated/prisma/client'; // Import Prisma namespace for types

const router: Router = express.Router();

/**
 * @route POST /scan-jobs/start-channel-scan
 * @description Starts a new scan job for a specific publisher channel.
 * @access Private (Requires authentication)
 * @body { publisherChannelId: string, bypassAiProcessing?: boolean }
 */
router.post('/start-channel-scan', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { publisherChannelId, bypassAiProcessing } = req.body; // Added bypassAiProcessing
    const userId = req.user?.userId; // Corrected: Extract user ID from req.user (as defined in middleware)

    if (!publisherChannelId) {
        return res.status(400).json({ message: 'Missing required field: publisherChannelId' });
    }

    // This endpoint starts a scan for a SINGLE channel, adapting to the new multi-target service function.
    try {
        // 1. Fetch the channel details to get publisherId and platformType
        const channel = await prisma.publisher_channels.findUnique({
            where: { id: publisherChannelId },
            select: { publisher_id: true, platform: true }
        });

        if (!channel) {
            return res.status(404).json({ message: `Publisher channel with ID ${publisherChannelId} not found.` });
        }

        // 2. Call the updated service function with arrays for the single target
        const scanJob = await scanJobService.initiateScanJob(
            [channel.publisher_id], // Pass publisherId as an array
            [channel.platform],     // Pass platform as an array
            [],                     // Pass empty array for productIds
            undefined,              // Default jobName
            undefined,              // Default jobDescription
            userId,
            bypassAiProcessing      // Pass bypassAiProcessing
        );

        res.status(201).json(scanJob); // 201 Created
    } catch (error: any) {
        // Catch errors thrown by the service (e.g., channel not found, Apify error)
        console.error(`Error in POST /scan-jobs/start-channel-scan for channel ${publisherChannelId}:`, error);
        // Send specific error messages back if they are user-friendly, otherwise generic error
        const errorMessage = error.message || 'An unexpected error occurred while starting the scan job.';
        const statusCode = error.message.includes('not found') || error.message.includes('No Apify Actor ID configured') ? 404 : 500;
        res.status(statusCode).json({ message: errorMessage });
    }
}));


/**
 * @route POST /scan-jobs/start-multi-target-scan
 * @description Starts a new scan job targeting multiple publishers, platforms, and optionally products.
 * @access Private (Requires authentication)
 * @body { publisherIds: string[], platformTypes: string[], productIds?: string[], jobName?: string, jobDescription?: string, bypassAiProcessing?: boolean }
 */
router.post('/start-multi-target-scan', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { publisherIds, platformTypes, productIds = [], jobName, jobDescription, bypassAiProcessing } = req.body; // Added bypassAiProcessing
    const userId = req.user?.userId;

    // Basic validation
    if (!publisherIds || !Array.isArray(publisherIds) || publisherIds.length === 0) {
        return res.status(400).json({ message: 'Missing or invalid required field: publisherIds (must be a non-empty array)' });
    }
    if (!platformTypes || !Array.isArray(platformTypes) || platformTypes.length === 0) {
        return res.status(400).json({ message: 'Missing or invalid required field: platformTypes (must be a non-empty array)' });
    }
    if (!Array.isArray(productIds)) {
         return res.status(400).json({ message: 'Invalid field: productIds (must be an array)' });
    }

    try {
        // Call the updated service function with the new parameters
        const scanJob = await scanJobService.initiateScanJob(
            publisherIds,
            platformTypes,
            productIds,
            jobName,
            jobDescription,
            userId,
            bypassAiProcessing // Pass bypassAiProcessing
        );
        res.status(201).json(scanJob); // 201 Created
    } catch (error: any) {
        console.error(`Error in POST /scan-jobs/start-multi-target-scan:`, error);
        const errorMessage = error.message || 'An unexpected error occurred while starting the multi-target scan job.';
        // Use a generic 500 error unless a specific known error occurs (like invalid IDs, though service should handle that)
        res.status(500).json({ message: errorMessage });
    }
}));


/**
 * @route GET /scan-jobs
 * @description Retrieves a list of scan jobs, potentially filtered.
 * @access Private (Requires authentication)
 * @query { status?: string, publisherId?: string, limit?: number, offset?: number, activeFlagsOnly?: boolean }
 */
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, publisherId, limit, offset, activeFlagsOnly } = req.query;
    const userId = req.user?.userId; // Or organizationId depending on auth needs

    console.log('GET /scan-jobs received with query params:', req.query);

    // TODO: Add authorization checks if needed (e.g., only show jobs for user's org)

    // Construct Prisma WhereInput object based on provided filters
    const where: Prisma.scan_jobsWhereInput = {};
    if (status) {
        where.status = status as string; // Add validation if status is an enum
    }
    
    // Filtering by publisherId - connect through scan_job_publishers relation
    if (publisherId) {
        where.scan_job_publishers = {
            some: { publisher_id: publisherId as string }
        };
    }
    
    if (activeFlagsOnly === 'true') {
        where.has_active_flags = true; // Filter by the new flag
    }

    // Parse limit and offset to numbers if provided
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    const offsetNum = offset ? parseInt(offset as string, 10) : undefined;

    try {
        console.log('Calling scanJobService.getScanJobs with:', { where, limitNum, offsetNum });
        const scanJobs = await scanJobService.getScanJobs(where, limitNum, offsetNum);
        console.log(`Retrieved ${scanJobs.length} scan jobs`);
        
        // Return the enriched scan jobs with counts
        res.status(200).json(scanJobs);
    } catch (error: any) {
        console.error(`Error in GET /scan-jobs:`, error);
        res.status(500).json({ message: 'Failed to retrieve scan jobs.' });
    }
}));


/**
 * @route PUT /scan-jobs/:id/assign
 * @description Assigns a user to a scan job
 * @access Private (Requires authentication)
 * @param id The ID of the scan job to update
 * @body { assigneeId: string } The ID of the user to assign to the scan job
 */
router.put('/:id/assign', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { assigneeId } = req.body;

    if (!assigneeId) {
        return res.status(400).json({ message: 'Missing required field: assigneeId' });
    }

    try {
        const updatedScanJob = await scanJobService.assignUserToScanJob(id, assigneeId);
        res.status(200).json(updatedScanJob);
    } catch (error: any) {
        console.error(`Error in PUT /scan-jobs/${id}/assign:`, error);
        const statusCode = error.message.includes('not found') ? 404 : 400;
        res.status(statusCode).json({ message: error.message });
    }
}));

/**
 * @route PUT /scan-jobs/:id/unassign
 * @description Unassigns a user from a scan job
 * @access Private (Requires authentication)
 * @param id The ID of the scan job to update
 */
router.put('/:id/unassign', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const updatedScanJob = await scanJobService.unassignUserFromScanJob(id);
        res.status(200).json(updatedScanJob);
    } catch (error: any) {
        console.error(`Error in PUT /scan-jobs/${id}/unassign:`, error);
        const statusCode = error.message.includes('not found') ? 404 : 400;
        res.status(statusCode).json({ message: error.message });
    }
}));

// Add other scan job related routes here (e.g., get status, list jobs)

export default router;
