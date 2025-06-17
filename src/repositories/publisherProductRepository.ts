import { publisher_products as PublisherProduct, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Links a publisher to a product.
 * Creates an entry in the publisher_products join table.
 * @param publisherId - The UUID of the publisher.
 * @param productId - The UUID of the product.
 * @returns The newly created publisher_products link entry.
 */
export const linkPublisherToProduct = async (publisherId: string, productId: string): Promise<PublisherProduct> => {
    // Basic validation
    if (!publisherId || !productId) {
        throw new Error("Publisher ID and Product ID are required to link.");
    }

    // Use upsert to handle potential duplicate links gracefully or create if not exists
    return prisma.publisher_products.upsert({
        where: {
            publisher_id_product_id: { // Use the @@unique constraint name from the schema
                publisher_id: publisherId,
                product_id: productId,
            }
        },
        update: {}, // No fields to update on conflict, just ensure it exists
        create: {
            publisher_id: publisherId,
            product_id: productId,
            // Prisma automatically connects via IDs here for join tables in create/upsert
        },
    });
};

/**
 * Unlinks a publisher from a product.
 * Deletes the entry from the publisher_products join table.
 * @param publisherId - The UUID of the publisher.
 * @param productId - The UUID of the product.
 * @returns The result of the delete operation (count of deleted records).
 */
export const unlinkPublisherFromProduct = async (publisherId: string, productId: string): Promise<Prisma.BatchPayload> => {
    // Basic validation
    if (!publisherId || !productId) {
        throw new Error("Publisher ID and Product ID are required to unlink.");
    }

    return prisma.publisher_products.deleteMany({
        where: {
            publisher_id: publisherId,
            product_id: productId,
        },
    });
};

/**
 * Retrieves all products linked to a specific publisher.
 * @param publisherId - The UUID of the publisher.
 * @returns An array of product objects linked to the publisher.
 */
export const getProductsByPublisherId = async (publisherId: string): Promise<Prisma.productsGetPayload<{}>[]> => {
    const links = await prisma.publisher_products.findMany({
        where: { publisher_id: publisherId },
        include: { products: true }, // Include the related product data
    });
    return links.map(link => link.products);
};

/**
 * Retrieves all publishers linked to a specific product.
 * @param productId - The UUID of the product.
 * @returns An array of publisher objects linked to the product.
 */
export const getPublishersByProductId = async (productId: string): Promise<Prisma.publishersGetPayload<{}>[]> => {
    const links = await prisma.publisher_products.findMany({
        where: { product_id: productId },
        include: { publishers: true }, // Include the related publisher data
    });
    return links.map(link => link.publishers);
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
