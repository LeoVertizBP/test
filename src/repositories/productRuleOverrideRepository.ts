import { product_rule_overrides as ProductRuleOverride, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

type InclusionType = 'include' | 'exclude';

/**
 * Creates or updates a product-specific override for a product rule.
 * @param productId - The UUID of the product.
 * @param productRuleId - The UUID of the product rule to override.
 * @param inclusionType - Whether to 'include' or 'exclude' the rule for this product.
 * @returns The created or updated product_rule_overrides entry.
 */
export const setProductRuleOverride = async (productId: string, productRuleId: string, inclusionType: InclusionType): Promise<ProductRuleOverride> => {
    if (!productId || !productRuleId || !inclusionType) {
        throw new Error("Product ID, Product Rule ID, and Inclusion Type are required.");
    }
    if (inclusionType !== 'include' && inclusionType !== 'exclude') {
        throw new Error("Invalid inclusionType. Must be 'include' or 'exclude'.");
    }

    // Use upsert to handle existing overrides or create new ones
    return prisma.product_rule_overrides.upsert({
        where: {
            product_id_product_rule_id: { // Use the @@unique constraint name
                product_id: productId,
                product_rule_id: productRuleId,
            }
        },
        update: {
            inclusion_type: inclusionType,
        },
        create: {
            product_id: productId,
            product_rule_id: productRuleId,
            inclusion_type: inclusionType,
        },
    });
};

/**
 * Removes a product-specific override for a product rule.
 * The rule will revert to its default inherited behavior for the product.
 * @param productId - The UUID of the product.
 * @param productRuleId - The UUID of the product rule.
 * @returns The result of the delete operation.
 */
export const removeProductRuleOverride = async (productId: string, productRuleId: string): Promise<Prisma.BatchPayload> => {
    if (!productId || !productRuleId) {
        throw new Error("Product ID and Product Rule ID are required to remove an override.");
    }

    return prisma.product_rule_overrides.deleteMany({
        where: {
            product_id: productId,
            product_rule_id: productRuleId,
        },
    });
};

/**
 * Retrieves all product rule overrides for a specific product.
 * @param productId - The UUID of the product.
 * @returns An array of override objects for the product.
 */
export const getOverridesForProduct = async (productId: string): Promise<ProductRuleOverride[]> => {
    return prisma.product_rule_overrides.findMany({
        where: { product_id: productId },
        include: { product_rules: true } // Optionally include the rule details
    });
};

/**
 * Retrieves all products that have an override for a specific product rule.
 * @param productRuleId - The UUID of the product rule.
 * @returns An array of product objects with overrides for the rule.
 */
export const getProductsWithOverrideForRule = async (productRuleId: string): Promise<Prisma.productsGetPayload<{ include: { product_rule_overrides: true } }>[]> => {
     const overrides = await prisma.product_rule_overrides.findMany({
        where: { product_rule_id: productRuleId },
        include: { products: true } // Include the related product data
    });
     // Ensure products is not null before mapping
    return overrides.map(override => override.products).filter(p => p !== null) as Prisma.productsGetPayload<{ include: { product_rule_overrides: true } }>[];
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
