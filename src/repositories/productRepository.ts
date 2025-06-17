import { products as Product, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient';

/**
 * Creates a new product in the database, linked to an advertiser.
 * @param data - The data for the new product. Requires advertiserId, name. Can include ruleIds and ruleSetIds.
 * @returns The newly created product.
 */
export const createProduct = async (
    data: Omit<Prisma.productsCreateInput, 'advertisers' | 'product_rule_set_assignments' | 'product_rule_overrides'> & {
        advertiserId: string;
        ruleIds?: string[];
        ruleSetIds?: string[];
    }
): Promise<Product> => {
    const { advertiserId, ruleIds, ruleSetIds, ...productData } = data;
    if (!advertiserId || !productData.name) {
        throw new Error("Missing required fields for product creation (advertiserId, name).");
    }

    const createPayload: Prisma.productsCreateInput = {
        ...productData,
        advertisers: {
            connect: { id: advertiserId }
        }
    };

    if (ruleSetIds && ruleSetIds.length > 0) {
        createPayload.product_rule_set_assignments = {
            create: ruleSetIds.map(id => ({
                rule_sets: { connect: { id: id } } // Connects via the 'rule_sets' field in product_rule_set_assignments
            }))
        };
    }

    if (ruleIds && ruleIds.length > 0) {
        createPayload.product_rule_overrides = {
            create: ruleIds.map(id => ({
                product_rules: { connect: { id: id } },
                inclusion_type: "INCLUDE" // Default inclusion type
            }))
        };
    }

    return prisma.products.create({
        data: createPayload,
    });
};

/**
 * Retrieves a single product by its unique ID.
 * @param id - The UUID of the product to retrieve.
 * @returns The product object or null if not found.
 */
export const getProductById = async (id: string): Promise<Product | null> => {
    return prisma.products.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all products belonging to a specific advertiser.
 * TODO: Add pagination.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product objects for the given advertiser.
 */
export const getProductsByAdvertiserId = async (advertiserId: string): Promise<Product[]> => { // Renamed function and param
    return prisma.products.findMany({
        where: { advertiser_id: advertiserId }, // Filter by foreign key
    });
};

/**
 * Updates an existing product.
 * @param id - The UUID of the product to update.
 * @param data - An object containing the fields to update.
 * @returns The updated product object.
 */
export const updateProduct = async (id: string, data: Prisma.productsUpdateInput): Promise<Product> => {
    return prisma.products.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a product by its unique ID.
 * @param id - The UUID of the product to delete.
 * @returns The deleted product object.
 */
export const deleteProduct = async (id: string): Promise<Product> => {
    return prisma.products.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all products belonging to a specific organization by joining through advertisers.
 * @param organizationId - The UUID of the organization.
 * @returns An array of product objects for the given organization.
 */
export const getProductsByOrganizationId = async (organizationId: string): Promise<Product[]> => {
    return prisma.products.findMany({
        where: {
            // Filter products where the related advertiser's organization_id matches
            advertisers: {
                organization_id: organizationId,
            },
        },
        // Optionally include the advertiser details if needed by the frontend
        // include: { advertisers: true }
    });
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
