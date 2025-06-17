import { product_rules as ProductRule, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new product rule in the database, linked to an advertiser.
 * @param data - The data for the new rule. Requires advertiserId (for connection), name, description, rule_type, and version.
 * @returns The newly created product rule.
 */
export const createProductRule = async (data: Omit<Prisma.product_rulesCreateInput, 'advertisers'> & { advertiserId: string }): Promise<ProductRule> => {
    const { advertiserId, ...ruleData } = data;
    if (!advertiserId || !ruleData.name || !ruleData.description || !ruleData.rule_type || !ruleData.version) {
        throw new Error("Missing required fields for product rule creation (advertiserId, name, description, rule_type, version).");
    }
    return prisma.product_rules.create({
        data: {
            ...ruleData,
            advertisers: { // Use the relation field name
                connect: { id: advertiserId } // Connect to existing advertiser
            }
        },
    });
};

/**
 * Retrieves a single product rule by its unique ID.
 * @param id - The UUID of the rule to retrieve.
 * @returns The rule object or null if not found.
 */
export const getProductRuleById = async (id: string): Promise<ProductRule | null> => {
    return prisma.product_rules.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all product rules belonging to a specific advertiser.
 * TODO: Add pagination and filtering by type/version.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product rule objects for the given advertiser.
 */
export const getProductRulesByAdvertiserId = async (advertiserId: string): Promise<ProductRule[]> => {
    return prisma.product_rules.findMany({
        where: { advertiser_id: advertiserId }, // Filter by foreign key
    });
};

/**
 * Updates an existing product rule.
 * @param id - The UUID of the rule to update.
 * @param data - An object containing the fields to update.
 * @returns The updated rule object.
 */
export const updateProductRule = async (id: string, data: Prisma.product_rulesUpdateInput): Promise<ProductRule> => {
    return prisma.product_rules.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a product rule by its unique ID.
 * @param id - The UUID of the rule to delete.
 * @returns The deleted rule object.
 */
export const deleteProductRule = async (id: string): Promise<ProductRule> => {
    // Note: Deleting a rule might cascade based on schema definitions (e.g., delete related flags, feedback examples).
    return prisma.product_rules.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all product rules belonging to a specific organization by joining through advertisers.
 * @param organizationId - The UUID of the organization.
 * @returns An array of product rule objects for the given organization.
 */
export const getProductRulesByOrganizationId = async (organizationId: string): Promise<ProductRule[]> => {
    return prisma.product_rules.findMany({
        where: {
            // Filter product rules where the related advertiser's organization_id matches
            advertisers: { // Use the relation name from the schema
                organization_id: organizationId,
            },
        },
        // Optionally include the advertiser details if needed
        // include: { advertisers: true }
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
