import { scan_job_channels as ScanJobChannel, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Links a scan job to a specific channel (platform/URL).
 * Creates an entry in the scan_job_channels table.
 * @param data - The data for the link. Requires scanJobId, platform, channel_url. publisherId is optional.
 * @returns The newly created scan_job_channels link entry.
 */
export const linkScanJobToChannel = async (
    data: Omit<Prisma.scan_job_channelsCreateInput, 'scan_jobs' | 'publishers'> & {
        scanJobId: string;
        publisherId?: string; // Optional publisher link (renamed from affiliateId)
    }
): Promise<ScanJobChannel> => {
    const { scanJobId, publisherId, ...channelLinkData } = data;

    // Basic validation
    if (!scanJobId || !channelLinkData.platform || !channelLinkData.channel_url) {
        throw new Error("Scan Job ID, Platform, and Channel URL are required to link.");
    }

    // Prepare connections
    const connections: Prisma.scan_job_channelsCreateInput = {
        ...channelLinkData,
        scan_jobs: { connect: { id: scanJobId } }, // Required connection
    };
    if (publisherId) {
        connections.publishers = { connect: { id: publisherId } }; // Optional connection (renamed from affiliates)
    }

    // Cannot easily use upsert here as there's no simple unique constraint defined in the base schema for platform+url+job_id
    // We'll rely on application logic to prevent duplicates if necessary, or add a unique constraint later.
    return prisma.scan_job_channels.create({
        data: connections,
    });
};

/**
 * Unlinks a scan job from a specific channel instance (identified by its primary key).
 * @param id - The UUID of the scan_job_channels entry to delete.
 * @returns The deleted scan_job_channels object.
 */
export const unlinkScanJobChannelById = async (id: string): Promise<ScanJobChannel> => {
    return prisma.scan_job_channels.delete({
        where: { id: id },
    });
};

/**
 * Unlinks all channel links for a specific scan job.
 * @param scanJobId - The UUID of the scan job.
 * @returns The result of the delete operation (count of deleted records).
 */
export const unlinkAllChannelsFromScanJob = async (scanJobId: string): Promise<Prisma.BatchPayload> => {
    return prisma.scan_job_channels.deleteMany({
        where: { scan_job_id: scanJobId },
    });
};


/**
 * Retrieves all channel links for a specific scan job.
 * @param scanJobId - The UUID of the scan job.
 * @returns An array of scan_job_channels objects linked to the scan job.
 */
export const getChannelLinksByScanJobId = async (scanJobId: string): Promise<ScanJobChannel[]> => {
    return prisma.scan_job_channels.findMany({
        where: { scan_job_id: scanJobId },
        // Optionally include publisher data if needed
        // include: { publishers: true } // Renamed from affiliates
    });
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
