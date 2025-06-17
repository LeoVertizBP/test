import { publisher_channels as PublisherChannel, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new publisher channel in the database.
 * @param data - The data for the new channel. Requires publisherId (for connection), platform, channel_url, and status.
 * @returns The newly created publisher channel.
 */
export const createPublisherChannel = async (
    data: Omit<Prisma.publisher_channelsCreateInput, 'publishers'> & {
        publisherId: string;
    }
): Promise<PublisherChannel> => {
    const { publisherId, ...channelData } = data;

    // Basic validation
    if (!publisherId || !channelData.platform || !channelData.channel_url || !channelData.status) {
        throw new Error("Missing required fields for publisher channel creation (publisherId, platform, channel_url, status).");
    }

    return prisma.publisher_channels.create({
        data: {
            ...channelData,
            publishers: { connect: { id: publisherId } }, // Required connection
        },
    });
};

/**
 * Retrieves a single publisher channel by its unique ID.
 * @param id - The UUID of the channel to retrieve.
 * @returns The channel object or null if not found.
 */
export const getPublisherChannelById = async (id: string): Promise<PublisherChannel | null> => {
    return prisma.publisher_channels.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all channels belonging to a specific publisher.
 * TODO: Add pagination and filtering by platform/status.
 * @param publisherId - The UUID of the publisher.
 * @returns An array of channel objects for the given publisher.
 */
export const getPublisherChannelsByPublisherId = async (publisherId: string): Promise<PublisherChannel[]> => {
    return prisma.publisher_channels.findMany({
        where: { publisher_id: publisherId }, // Filter by foreign key
    });
};

/**
 * Updates an existing publisher channel.
 * @param id - The UUID of the channel to update.
 * @param data - An object containing the fields to update (e.g., status, channel_url, last_scanned).
 * @returns The updated channel object.
 */
export const updatePublisherChannel = async (id: string, data: Prisma.publisher_channelsUpdateInput): Promise<PublisherChannel> => {
    return prisma.publisher_channels.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a publisher channel by its unique ID.
 * @param id - The UUID of the channel to delete.
 * @returns The deleted channel object.
 */
export const deletePublisherChannel = async (id: string): Promise<PublisherChannel> => {
    // Note: Deleting a channel might cascade based on schema (e.g., delete related content_items).
    return prisma.publisher_channels.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
