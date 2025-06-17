import { flags as Flag, Prisma, FlagStatus, HumanVerdict } from '../../generated/prisma/client'; // Added FlagStatus, HumanVerdict
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Internal helper function to update the has_active_flags status of a scan job.
 * Counts non-closed flags associated with the job and updates the scan_jobs record.
 * @param scanJobId The ID of the scan job to update.
 */
const _updateScanJobActiveFlagStatus = async (scanJobId: string | null): Promise<void> => {
    if (!scanJobId) {
        console.warn('Attempted to update active flag status for null scanJobId.');
        return;
    }

    try {
        console.log(`Updating has_active_flags for scan job ${scanJobId}...`);
        const activeFlagsCount = await prisma.flags.count({
            where: {
                content_items: {
                    scan_job_id: scanJobId,
                },
                NOT: {
                    status: FlagStatus.CLOSED,
                },
            },
        });

        const hasActiveFlags = activeFlagsCount > 0;
        console.log(`  Found ${activeFlagsCount} active flags. Setting has_active_flags to ${hasActiveFlags}.`);

        await prisma.scan_jobs.update({
            where: { id: scanJobId },
            data: { has_active_flags: hasActiveFlags },
        });
        console.log(`  Successfully updated has_active_flags for scan job ${scanJobId}.`);
    } catch (error: any) {
        console.error(`  Error updating has_active_flags for scan job ${scanJobId}: ${error.message}`);
        // Decide if this error should be re-thrown or just logged
    }
};

/**
 * Creates a new flag in the database.
 * @param data - The data for the new flag. Requires contentItemId, ruleId, rule_type, ai_confidence, status.
 *               Optional fields like reviewerId, imageReferenceId can be included for connections.
 * @returns The newly created flag.
 */
export const createFlag = async (
    // Note: Prisma doesn't directly model the polymorphic rule relation, so we handle rule_id and rule_type manually.
    // The input type omits the 'rules' relation field which is no longer directly applicable.
    data: Omit<Prisma.flagsCreateInput, 'content_items' | 'users' | 'content_images'> & {
        contentItemId: string;
        ruleId: string; // ID of either a product_rule or channel_rule
        // rule_type: 'product' | 'channel'; // This is now a required field in the input data
        reviewerId?: string;
        imageReferenceId?: string;
    }
): Promise<Flag> => {
    const { contentItemId, ruleId, reviewerId, imageReferenceId, ...flagData } = data;

    // Basic validation - include rule_type check
    if (!contentItemId || !ruleId || !flagData.rule_type || flagData.ai_confidence === undefined || !flagData.status) {
        throw new Error("Missing required fields for flag creation (contentItemId, ruleId, rule_type, ai_confidence, status).");
    }
    if (flagData.rule_type !== 'product' && flagData.rule_type !== 'channel') {
         throw new Error("Invalid rule_type. Must be 'product' or 'channel'.");
    }


    // Prepare connections based on provided IDs
    // We store rule_id and rule_type directly. No direct Prisma relation for the rule itself.
    const createData: Prisma.flagsCreateInput = {
        ...flagData, // Includes rule_id and rule_type from the input
        content_items: { connect: { id: contentItemId } }, // Required connection
        // Optional connections handled below
    };

    if (reviewerId) {
        createData.users = { connect: { id: reviewerId } };
    }
    if (imageReferenceId) {
        createData.content_images = { connect: { id: imageReferenceId } };
    }

    // Step 1: Create the flag and assign the result to newFlag
    const newFlag = await prisma.flags.create({
        data: createData,
        include: { content_items: { select: { scan_job_id: true } } } // Include scan_job_id for the update logic
    });

    // Step 2: After creating the flag, update the scan job's active flag status if the new flag is not closed
    if (newFlag.status !== FlagStatus.CLOSED && newFlag.content_items?.scan_job_id) {
        // Use await here to ensure the update completes before returning,
        // although it could potentially be run in the background without await if preferred.
        await _updateScanJobActiveFlagStatus(newFlag.content_items.scan_job_id);
    }

    // Step 3: Return the created flag
    return newFlag;
};

/**
 * Retrieves a single flag by its unique ID.
 * Includes related content_items (with publisher and scan_job names), products (name), and users (name).
 * @param id - The UUID of the flag to retrieve.
 * @returns The flag object or null if not found.
 */
export const getFlagById = async (id: string): Promise<Flag | null> => {
    return prisma.flags.findUnique({
        where: { id: id },
        // Include related data needed to find the publisher
        include: {
            content_items: { // Include the related content item
                select: {
                    id: true,
                    url: true,
                    publishers: { // Include the publisher from the content item
                        select: {
                            id: true,
                            name: true // Get the publisher name
                        }
                    }
                }
            },
            products: { // Include the related product (optional)
                select: {
                    id: true,
                    name: true // Get the product name
                }
            },
            users: { // Include the related user (reviewer/assignee, optional)
                select: {
                    id: true,
                    name: true // Get the user name
                }
            }
        }
    });
};

/**
 * Retrieves flags based on specified criteria. Supports optional pagination.
 * Includes related content_items (with publisher and scan_job names), products (name), and users (name).
 * Default sort order is by `created_at` descending.
 * @param where - Prisma WhereInput object for filtering.
 * @param page - Optional page number for pagination (1-indexed). If provided with `pageSize`, paginated results are returned.
 * @param pageSize - Optional page size for pagination. If provided with `page`, paginated results are returned.
 * @returns A Promise that resolves to either:
 *            - An object `{ data: Flag[], totalFlags: number }` if pagination parameters (`page`, `pageSize`) are validly provided.
 *            - An array `Flag[]` of all matching flags if pagination parameters are not provided or invalid.
 */
export const findFlags = async (
    where: Prisma.flagsWhereInput,
    page?: number,
    pageSize?: number
): Promise<{ data: Flag[]; totalFlags: number } | Flag[]> => {
    const includeClause = {
        content_items: {
            select: {
                id: true, // Also include the content_item ID itself
                url: true,
                caption: true,
                title: true,
                transcript: true,
                platform: true,
                content_type: true, // Added content_type
                content_images: {   // Added content_images relation
                    select: {
                        id: true,         // ID of the content_image record
                        image_type: true, // e.g., "image", "video", "screenshot"
                        file_path: true   // Potentially useful for the GCS proxy
                    }
                },
                publishers: { select: { name: true, id: true } }, // Added publisher ID
                scan_jobs: { select: { name: true, id: true } },   // Added scan_job ID
            },
        },
        products: { select: { name: true, id: true } }, // Added product ID
        users: { select: { name: true, id: true } },     // Added user ID (reviewer)
        comments: { // Include comments and their user details
            orderBy: { created_at: 'asc' as Prisma.SortOrder },
            select: {
                id: true,
                flag_id: true,
                user_id: true,
                comment: true,
                created_at: true,
                // updated_at: true, // Prisma select issue, handled in service/adapter
                user: { 
                    select: { 
                        name: true, 
                        role: true, 
                        id: true 
                    } 
                },
            },
        },
    };

    const orderByClause = {
        created_at: 'desc' as Prisma.SortOrder,
    };

    if (page && pageSize && page > 0 && pageSize > 0) {
        // Paginated request
        const skip = (page - 1) * pageSize;
        const [data, totalFlags] = await prisma.$transaction([
            prisma.flags.findMany({
                where,
                include: includeClause,
                orderBy: orderByClause,
                skip,
                take: pageSize,
            }),
            prisma.flags.count({ where }),
        ]);
        return { data, totalFlags };
    } else {
        // Non-paginated request (original behavior)
        const data = await prisma.flags.findMany({
            where,
            include: includeClause,
            orderBy: orderByClause,
        });
        return data; // Returns Flag[]
    }
};

/**
 * Updates an existing flag.
 * @param id - The UUID of the flag to update.
 * @param data - An object containing the fields to update (e.g., status, reviewerId, internal_comments).
 * @returns The updated flag object.
 */
export const updateFlag = async (id: string, data: Prisma.flagsUpdateInput): Promise<Flag> => {
    // Step 1: Perform the update and assign the result
    const updatedFlag = await prisma.flags.update({
        where: { id: id },
        data: data,
        include: { content_items: { select: { scan_job_id: true } } } // Include scan_job_id for the update logic
    });

    // Step 2: If the status was part of the update, trigger the scan job status update
    // Check if 'status' exists in the 'data' object passed to the function
    if (Object.prototype.hasOwnProperty.call(data, 'status') && updatedFlag.content_items?.scan_job_id) {
        await _updateScanJobActiveFlagStatus(updatedFlag.content_items.scan_job_id);
    }

    // Step 3: Return the updated flag
    return updatedFlag;
};

/**
 * Updates the review status and related fields of a flag.
 * Handles setting appropriate timestamps based on status transitions.
 * @param flagId - The ID of the flag to update.
 * @param reviewerId - The ID of the user performing the review.
 * @param updateData - Object containing the updates (status, human_verdict, notes).
 * @returns The updated flag object.
 */
export const updateFlagReviewStatus = async (
    flagId: string,
    reviewerId: string,
    updateData: {
        status: FlagStatus;
        human_verdict?: HumanVerdict | null;
        human_verdict_reasoning?: string | null;
        ai_feedback_notes?: string | null;
        internal_notes?: string | null;
    }
): Promise<Flag> => {
    const now = new Date();

    // Fetch the current flag to check its current status
    const currentFlag = await prisma.flags.findUnique({ where: { id: flagId } });
    if (!currentFlag) {
        throw new Error(`Flag with ID ${flagId} not found.`);
    }
    const currentStatus = currentFlag.status;
    const newStatus = updateData.status;

    // Prepare the data payload for Prisma update
    const dataToUpdate: Prisma.flagsUpdateInput = {
        status: newStatus,
        human_verdict: updateData.human_verdict,
        human_verdict_reasoning: updateData.human_verdict_reasoning,
        ai_feedback_notes: updateData.ai_feedback_notes,
        internal_notes: updateData.internal_notes,
        users: { connect: { id: reviewerId } }, // Connect the reviewer via the 'users' relation
        reviewed_at: now, // Always update the last reviewed timestamp
    };

    // Set specific timestamps based on status transitions
    if (currentStatus === FlagStatus.PENDING && newStatus === FlagStatus.IN_REVIEW) {
        dataToUpdate.in_review_at = now;
    }
    if (currentStatus === FlagStatus.IN_REVIEW && (newStatus === FlagStatus.REMEDIATING || newStatus === FlagStatus.CLOSED)) {
        dataToUpdate.decision_made_at = now;
        // Ensure in_review_at is set if somehow missed (shouldn't happen in normal flow)
        if (!currentFlag.in_review_at) {
            dataToUpdate.in_review_at = now;
        }
        
        // If transitioning to REMEDIATING status, set remediation_start_time if it's not already set
        if (newStatus === FlagStatus.REMEDIATING && !currentFlag.remediation_start_time) {
            dataToUpdate.remediation_start_time = now;
        }
    }
    // Also handle transition from PENDING directly to REMEDIATING (if that's allowed in the workflow)
    if (currentStatus === FlagStatus.PENDING && newStatus === FlagStatus.REMEDIATING && !currentFlag.remediation_start_time) {
        dataToUpdate.remediation_start_time = now;
    }
    if (currentStatus === FlagStatus.REMEDIATING && newStatus === FlagStatus.CLOSED) {
        dataToUpdate.remediation_completed_at = now;
         // Ensure previous timestamps are set if somehow missed
         if (!currentFlag.in_review_at) dataToUpdate.in_review_at = now;
         if (!currentFlag.decision_made_at) dataToUpdate.decision_made_at = now;
    }

    // Step 1: Perform the update and assign the result
    const updatedFlag = await prisma.flags.update({
        where: { id: flagId },
        data: dataToUpdate,
        include: { content_items: { select: { scan_job_id: true } } } // Include scan_job_id for the update logic
    });

    // Step 2: After updating the flag, update the scan job's active flag status
    if (updatedFlag.content_items?.scan_job_id) {
        await _updateScanJobActiveFlagStatus(updatedFlag.content_items.scan_job_id);
    }

    // Step 3: Return the updated flag
    return updatedFlag;
};


/**
 * Deletes a flag by its unique ID.
 * @param id - The UUID of the flag to delete.
 * @returns The deleted flag object.
 */
export const deleteFlag = async (id: string): Promise<Flag> => {
    // Step 1: Get the flag details BEFORE deleting to find the scanJobId
    const flagToDelete = await prisma.flags.findUnique({
        where: { id: id },
        include: { content_items: { select: { scan_job_id: true } } }
    });

    if (!flagToDelete) {
        throw new Error(`Flag with ID ${id} not found for deletion.`);
    }
    const scanJobId = flagToDelete.content_items?.scan_job_id;

    // Step 2: Delete the flag
    const deletedFlag = await prisma.flags.delete({
        where: { id: id },
    });

    // Step 3: Update the scan job status AFTER deletion
    if (scanJobId) {
        await _updateScanJobActiveFlagStatus(scanJobId);
    }

    return deletedFlag;
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
