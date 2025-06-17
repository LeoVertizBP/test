import { advertisers as Advertiser, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient';

/**
 * Creates a new advertiser in the database, linked to an organization.
 * @param data - The data for the new advertiser. Requires organizationId and name.
 * @returns The newly created advertiser.
 */
export const createAdvertiser = async (data: Omit<Prisma.advertisersCreateInput, 'organizations'> & { organizationId: string }): Promise<Advertiser> => {
    const { organizationId, ...advertiserData } = data;
    if (!organizationId || !advertiserData.name) {
        throw new Error("Missing required fields for advertiser creation (organizationId, name).");
    }
    return prisma.advertisers.create({
        data: {
            ...advertiserData,
            organizations: { // Use the relation field name
                connect: { id: organizationId } // Connect to existing organization
            }
        },
    });
};

/**
 * Retrieves a single advertiser by its unique ID.
 * @param id - The UUID of the advertiser to retrieve.
 * @returns The advertiser object or null if not found.
 */
export const getAdvertiserById = async (id: string): Promise<Advertiser | null> => {
    return prisma.advertisers.findUnique({
        where: { id: id },
        // Optionally include related data like products or default rule sets
        // include: { products: true, rule_sets_advertisers_default_product_rule_set_idTorule_sets: true, rule_sets_advertisers_default_channel_rule_set_idTorule_sets: true }
    });
};

/**
 * Retrieves all advertisers belonging to a specific organization.
 * TODO: Add pagination.
 * @param organizationId - The UUID of the organization.
 * @returns An array of advertiser objects for the given organization.
 */
export const getAdvertisersByOrganizationId = async (organizationId: string): Promise<Advertiser[]> => {
    return prisma.advertisers.findMany({
        where: { organization_id: organizationId }, // Filter by foreign key
    });
};

/**
 * Updates an existing advertiser.
 * @param id - The UUID of the advertiser to update.
 * @param data - An object containing the fields to update (e.g., name, settings, default rule sets).
 * @returns The updated advertiser object.
 */
export const updateAdvertiser = async (id: string, data: Prisma.advertisersUpdateInput): Promise<Advertiser> => {
    return prisma.advertisers.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes an advertiser by its unique ID.
 * @param id - The UUID of the advertiser to delete.
 * @returns The deleted advertiser object.
 */
export const deleteAdvertiser = async (id: string): Promise<Advertiser> => {
    // Note: Deleting an advertiser will likely cascade and delete related products, rules, etc.
    return prisma.advertisers.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all products associated with a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product objects.
 */
export const getProductsByAdvertiserId = async (advertiserId: string): Promise<Product[]> => {
    return prisma.products.findMany({
        where: { advertiser_id: advertiserId }, // Filter by the foreign key on the products table
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};

// Import the Product type from Prisma Client
import { products as Product } from '../../generated/prisma/client';
