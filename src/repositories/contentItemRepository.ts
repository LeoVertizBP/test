import { content_items as ContentItem, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new content item in the database.
 * @param data - The data for the new content item. Requires scanJobId, publisherId, publisherChannelId, platform, channel_url, url, content_type, scan_date.
 * @returns The newly created content item.
 */
export const createContentItem = async (
    data: Omit<Prisma.content_itemsCreateInput, 'scan_jobs' | 'publishers' | 'publisher_channels'> & { // Updated relation names
        scanJobId: string;
        publisherId: string; // Renamed parameter
        publisherChannelId: string; // Renamed parameter
    }
): Promise<ContentItem> => {
    const { scanJobId, publisherId, publisherChannelId, ...itemData } = data; // Renamed variables

    // Basic validation
    if (!scanJobId || !publisherId || !publisherChannelId || !itemData.platform || !itemData.channel_url || !itemData.url || !itemData.content_type || !itemData.scan_date) {
        throw new Error("Missing required fields for content item creation (scanJobId, publisherId, publisherChannelId, platform, channel_url, url, content_type, scan_date)."); // Updated error message
    }

    return prisma.content_items.create({
        data: {
            ...itemData,
            scan_jobs: { connect: { id: scanJobId } },
            publishers: { connect: { id: publisherId } }, // Updated relation name and variable
            publisher_channels: { connect: { id: publisherChannelId } }, // Updated relation name and variable
        },
    });
};

/**
 * Retrieves a single content item by its unique ID.
 * @param id - The UUID of the content item to retrieve.
 * @returns The content item object or null if not found.
 */
export const getContentItemById = async (id: string): Promise<ContentItem | null> => {
    return prisma.content_items.findUnique({
        where: { id: id },
        // Optionally include related data like flags or images
        // include: { flags: true, content_images: true }
    });
};

/**
 * Retrieves content items based on specified criteria (e.g., by scan job, publisher, channel).
 * TODO: Add pagination and more filtering options.
 * @param where - Prisma WhereInput object for filtering.
 * @returns An array of matching content item objects.
 */
export const findContentItems = async (where: Prisma.content_itemsWhereInput): Promise<ContentItem[]> => {
    return prisma.content_items.findMany({
        where: where,
        // Consider ordering by scan_date or created_at
        // orderBy: { scan_date: 'desc' }
    });
};

/**
 * Updates an existing content item.
 * @param id - The UUID of the content item to update.
 * @param data - An object containing the fields to update.
 * @returns The updated content item object.
 */
export const updateContentItem = async (id: string, data: Prisma.content_itemsUpdateInput): Promise<ContentItem> => {
    return prisma.content_items.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a content item by its unique ID.
 * @param id - The UUID of the content item to delete.
 * @returns The deleted content item object.
 */
export const deleteContentItem = async (id: string): Promise<ContentItem> => {
    // Note: Deleting a content item might cascade based on schema (e.g., delete related flags, images).
    return prisma.content_items.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
