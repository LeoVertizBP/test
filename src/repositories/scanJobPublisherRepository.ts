import { scan_job_publishers as ScanJobPublisher, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Links a scan job to a specific publisher.
 * Creates an entry in the scan_job_publishers join table.
 * @param scanJobId - The UUID of the scan job.
 * @param publisherId - The UUID of the publisher to include in the scan.
 * @returns The newly created scan_job_publishers link entry.
 */
export const linkScanJobToPublisher = async (scanJobId: string, publisherId: string): Promise<ScanJobPublisher> => {
    // Basic validation
    if (!scanJobId || !publisherId) {
        throw new Error("Scan Job ID and Publisher ID are required to link.");
    }

    // Use upsert to handle potential duplicate links gracefully or create if not exists
    return prisma.scan_job_publishers.upsert({
        where: {
            scan_job_id_publisher_id: { // Use the @@unique constraint name from the schema
                scan_job_id: scanJobId,
                publisher_id: publisherId,
            }
        },
        update: {}, // No fields to update on conflict
        create: {
            scan_job_id: scanJobId,
            publisher_id: publisherId,
        },
    });
};

/**
 * Unlinks a scan job from a publisher.
 * Deletes the entry from the scan_job_publishers join table.
 * @param scanJobId - The UUID of the scan job.
 * @param publisherId - The UUID of the publisher.
 * @returns The result of the delete operation (count of deleted records).
 */
export const unlinkScanJobFromPublisher = async (scanJobId: string, publisherId: string): Promise<Prisma.BatchPayload> => {
    // Basic validation
    if (!scanJobId || !publisherId) {
        throw new Error("Scan Job ID and Publisher ID are required to unlink.");
    }

    return prisma.scan_job_publishers.deleteMany({
        where: {
            scan_job_id: scanJobId,
            publisher_id: publisherId,
        },
    });
};

/**
 * Retrieves all publishers linked to a specific scan job.
 * @param scanJobId - The UUID of the scan job.
 * @returns An array of publisher objects linked to the scan job.
 */
export const getPublishersByScanJobId = async (scanJobId: string): Promise<Prisma.publishersGetPayload<{}>[]> => {
    const links = await prisma.scan_job_publishers.findMany({
        where: { scan_job_id: scanJobId },
        include: { publishers: true }, // Include the related publisher data
    });
    return links.map(link => link.publishers);
};

/**
 * Retrieves all scan jobs linked to a specific publisher.
 * @param publisherId - The UUID of the publisher.
 * @returns An array of scan job objects linked to the publisher.
 */
export const getScanJobsByPublisherId = async (publisherId: string): Promise<Prisma.scan_jobsGetPayload<{}>[]> => {
    const links = await prisma.scan_job_publishers.findMany({
        where: { publisher_id: publisherId },
        include: { scan_jobs: true }, // Include the related scan job data
    });
    return links.map(link => link.scan_jobs);
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
