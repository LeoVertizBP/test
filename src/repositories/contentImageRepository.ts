import { content_images as ContentImage, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new content image record in the database.
 * @param data - The data for the new image record. Requires contentItemId (for connection), image_type, file_path, file_size. Width/height are optional.
 * @returns The newly created content image record.
 */
export const createContentImage = async (
    data: Omit<Prisma.content_imagesCreateInput, 'content_items'> & {
        contentItemId: string;
    }
): Promise<ContentImage> => {
    const { contentItemId, ...imageData } = data;

    // Basic validation
    if (!contentItemId || !imageData.image_type || !imageData.file_path || imageData.file_size === undefined) {
        throw new Error("Missing required fields for content image creation (contentItemId, image_type, file_path, file_size).");
    }

    // Prisma expects BigInts as number or bigint, ensure file_size is compatible
    const fileSize = typeof imageData.file_size === 'bigint' ? imageData.file_size : BigInt(imageData.file_size);


    return prisma.content_images.create({
        data: {
            ...imageData,
            file_size: fileSize, // Ensure it's a BigInt
            content_items: { connect: { id: contentItemId } }, // Required connection
        },
    });
};

/**
 * Retrieves a single content image record by its unique ID.
 * @param id - The UUID of the image record to retrieve.
 * @returns The image record object or null if not found.
 */
export const getContentImageById = async (id: string): Promise<ContentImage | null> => {
    return prisma.content_images.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all image records belonging to a specific content item.
 * @param contentItemId - The UUID of the content item.
 * @returns An array of image record objects for the given content item.
 */
export const getContentImagesByContentItemId = async (contentItemId: string): Promise<ContentImage[]> => {
    return prisma.content_images.findMany({
        where: { content_item_id: contentItemId }, // Filter by foreign key
    });
};

/**
 * Updates an existing content image record.
 * @param id - The UUID of the image record to update.
 * @param data - An object containing the fields to update (e.g., file_path if moved).
 * @returns The updated image record object.
 */
export const updateContentImage = async (id: string, data: Prisma.content_imagesUpdateInput): Promise<ContentImage> => {
    // Handle potential BigInt conversion for file_size if it's being updated
    if (data.file_size !== undefined && data.file_size !== null) {
        // Check if it's an update operation object (like { set: ... })
        if (typeof data.file_size === 'object' && 'set' in data.file_size && data.file_size.set !== undefined && data.file_size.set !== null) {
            // Ensure the value within 'set' is a BigInt
            data.file_size.set = typeof data.file_size.set === 'bigint' ? data.file_size.set : BigInt(data.file_size.set);
        } else if (typeof data.file_size !== 'object') {
            // Handle direct value assignment (number or bigint)
            data.file_size = typeof data.file_size === 'bigint' ? data.file_size : BigInt(data.file_size);
        }
        // Note: Increment/decrement operations should already use BigInts if provided.
    }

    return prisma.content_images.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a content image record by its unique ID.
 * Consider implications for associated flags or feedback examples if deleting image records.
 * @param id - The UUID of the image record to delete.
 * @returns The deleted image record object.
 */
export const deleteContentImage = async (id: string): Promise<ContentImage> => {
    return prisma.content_images.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
