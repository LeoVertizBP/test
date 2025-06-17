import { scan_jobs as ScanJob, Prisma, FlagStatus } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new scan job in the database.
 * @param data - The data for the new scan job. Requires status and source. Name, description, createdById, etc., are optional.
 * @returns The newly created scan job.
 */
export const createScanJob = async (
    data: Omit<Prisma.scan_jobsCreateInput, 'creator'> & { createdById?: string }
): Promise<ScanJob> => {
    const { createdById, ...jobData } = data;

    // Basic validation
    if (!jobData.status || !jobData.source) {
        throw new Error("Missing required fields for scan job creation (status, source).");
    }

    // Prepare connections
    const connections: Prisma.scan_jobsCreateInput = { ...jobData };
    if (createdById) {
        connections.creator = { connect: { id: createdById } };
    }

    return prisma.scan_jobs.create({
        data: connections,
    });
};

/**
 * Retrieves a single scan job by its unique ID.
 * @param id - The UUID of the scan job to retrieve.
 * @returns The scan job object or null if not found.
 */
export const getScanJobById = async (id: string): Promise<(ScanJob & { assignee_name?: string }) | null> => {
    const scanJob = await prisma.scan_jobs.findUnique({
        where: { id: id },
        include: {
            assignee: true,
            // Optionally include other related data
            // scan_job_publishers: true, 
            // scan_job_channels: true, 
            // scan_job_product_focus: true
        }
    });

    if (!scanJob) {
        return null;
    }

    // Add assignee_name field if assignee exists
    const assigneeName = scanJob.assignee ? scanJob.assignee.name : undefined;
    
    return {
        ...scanJob,
        assignee_name: assigneeName
    };
};

/**
 * Retrieves scan jobs based on specified criteria (e.g., by status, source, creator).
 * Includes counts for items, total flags, pending flags, and closed flags.
 * @param where - Prisma WhereInput object for filtering.
 * @param limit - Optional limit for number of results.
 * @param offset - Optional offset for pagination.
 * @returns An array of matching scan job objects with additional count fields.
 */
export const findScanJobs = async (
    where: Prisma.scan_jobsWhereInput, // Keep original type, handle has_active_flags internally
    limit?: number,
    offset?: number
): Promise<(ScanJob & {
    items_count?: number;
    total_flags?: number;
    pending_flags?: number;
    closed_flags?: number;
    assignee_name?: string;
})[]> => {
    console.log('Finding scan jobs with where:', JSON.stringify(where));

    // Construct the final Prisma where clause, starting with a copy
    const prismaWhere: Prisma.scan_jobsWhereInput = { ...where };

    // Handle the has_active_flags filter if it's passed (e.g., from the route/service)
    // We access it as 'any' because it's not strictly part of the base scan_jobsWhereInput for this specific logic,
    // but rather a signal for us to modify the query.
    if ((where as any).has_active_flags === true) {
        // Remove our custom indicator from the prismaWhere object so it doesn't conflict with Prisma's own fields
        delete (prismaWhere as any).has_active_flags;

        const activeFlagsCondition: Prisma.scan_jobsWhereInput = {
            content_items: {
                some: {
                    flags: {
                        some: {
                            status: {
                                not: FlagStatus.CLOSED // Use the imported Enum
                            }
                        }
                    }
                }
            }
        };

        // Safely add the activeFlagsCondition to the AND array
        if (prismaWhere.AND) {
            if (Array.isArray(prismaWhere.AND)) {
                prismaWhere.AND.push(activeFlagsCondition);
            } else {
                // If AND is a single object, convert to array
                prismaWhere.AND = [prismaWhere.AND, activeFlagsCondition];
            }
        } else {
            prismaWhere.AND = [activeFlagsCondition];
        }
    }
    
    // First, get the basic scan job records with assignee information
    const scanJobs = await prisma.scan_jobs.findMany({
        where: prismaWhere, // Use the potentially modified prismaWhere
        orderBy: { created_at: 'desc' },
        ...(limit !== undefined ? { take: limit } : {}),
        ...(offset !== undefined ? { skip: offset } : {}),
        include: {
            creator: true,
            assignee: true
        }
    });
    
    // For each scan job, get the counts
    const enrichedJobs = await Promise.all(scanJobs.map(async (job) => {
        try {
            // Count content items for this scan job
            const itemsCount = await prisma.content_items.count({
                where: { scan_job_id: job.id }
            });
            
            // Get flag counts with different statuses
            // We need to join with content_items to get flags for this scan job
            const totalFlags = await prisma.flags.count({
                where: {
                    content_items: {
                        scan_job_id: job.id
                    }
                }
            });
            
            const pendingFlags = await prisma.flags.count({
                where: {
                    content_items: {
                        scan_job_id: job.id
                    },
                    status: { in: ['PENDING', 'IN_REVIEW'] }
                }
            });
            
            const closedFlags = await prisma.flags.count({
                where: {
                    content_items: {
                        scan_job_id: job.id
                    },
                    status: { in: ['CLOSED', 'REMEDIATION_COMPLETE'] }
                }
            });
            
            // Get assignee name if available
            const assigneeName = job.assignee ? job.assignee.name : undefined;
            
            console.log(`Enriched job ${job.id} with counts:`, {
                items_count: itemsCount,
                total_flags: totalFlags,
                pending_flags: pendingFlags,
                closed_flags: closedFlags,
                assignee_name: assigneeName
            });
            
            // Return the job with added count fields and assignee name
            return {
                ...job,
                items_count: itemsCount,
                total_flags: totalFlags,
                pending_flags: pendingFlags,
                closed_flags: closedFlags,
                assignee_name: assigneeName
            };
        } catch (error) {
            console.error(`Error enriching scan job ${job.id} with counts:`, error);
            // Return the original job if there was an error
            return job;
        }
    }));
    
    return enrichedJobs;
};

/**
 * Updates an existing scan job.
 * Commonly used to update status, start_time, end_time.
 * @param id - The UUID of the scan job to update.
 * @param data - An object containing the fields to update.
 * @returns The updated scan job object.
 */
export const updateScanJob = async (id: string, data: Prisma.scan_jobsUpdateInput): Promise<ScanJob> => {
    return prisma.scan_jobs.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a scan job by its unique ID.
 * Use with caution, as this might orphan related data or break history depending on cascade rules.
 * Consider soft-delete (e.g., setting a status to 'deleted') instead.
 * @param id - The UUID of the scan job to delete.
 * @returns The deleted scan job object.
 */
export const deleteScanJob = async (id: string): Promise<ScanJob> => {
    // Note: Deleting a scan job might cascade based on schema (e.g., delete related content_items, job targets).
    return prisma.scan_jobs.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
