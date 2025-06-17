import { product_rule_set_assignments as ProductRuleSetAssignment, Prisma } from '../../generated/prisma/client'; // Renamed type import
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Assigns a rule set to a product.
 * Creates an entry in the product_rule_set_assignments join table.
 * @param productId - The UUID of the product.
 * @param ruleSetId - The UUID of the rule set to assign.
 * @returns The newly created product_rule_set_assignments link entry.
 */
export const assignRuleSetToProduct = async (productId: string, ruleSetId: string): Promise<ProductRuleSetAssignment> => { // Renamed function and return type
    // Basic validation
    if (!productId || !ruleSetId) {
        throw new Error("Product ID and Rule Set ID are required to assign.");
    }

    // Use upsert to handle potential duplicate assignments gracefully or create if not exists
    return prisma.product_rule_set_assignments.upsert({ // Renamed Prisma model
        where: {
            product_id_rule_set_id: { // Use the @@unique constraint name from the schema
                product_id: productId,
                rule_set_id: ruleSetId,
            }
        },
        update: {}, // No fields to update on conflict
        create: {
            product_id: productId,
            rule_set_id: ruleSetId,
        },
    });
};

/**
 * Unassigns a rule set from a product.
 * Deletes the entry from the product_rule_set_assignments join table.
 * @param productId - The UUID of the product.
 * @param ruleSetId - The UUID of the rule set.
 * @returns The result of the delete operation (count of deleted records).
 */
export const unassignRuleSetFromProduct = async (productId: string, ruleSetId: string): Promise<Prisma.BatchPayload> => { // Renamed function
    // Basic validation
    if (!productId || !ruleSetId) {
        throw new Error("Product ID and Rule Set ID are required to unassign.");
    }

    return prisma.product_rule_set_assignments.deleteMany({ // Renamed Prisma model
        where: {
            product_id: productId,
            rule_set_id: ruleSetId,
        },
    });
};

/**
 * Retrieves all rule sets assigned to a specific product.
 * @param productId - The UUID of the product.
 * @returns An array of rule set objects assigned to the product.
 */
export const getRuleSetsAssignedToProduct = async (productId: string): Promise<Prisma.rule_setsGetPayload<{}>[]> => { // Renamed function
    const assignments = await prisma.product_rule_set_assignments.findMany({ // Renamed Prisma model
        where: { product_id: productId },
        include: { rule_sets: true }, // Include the related rule set data
    });
    // Ensure rule_sets is not null before mapping
    return assignments.map(assignment => assignment.rule_sets).filter(rs => rs !== null) as Prisma.rule_setsGetPayload<{}>[];
};

/**
 * Retrieves all products assigned to a specific rule set.
 * @param ruleSetId - The UUID of the rule set.
 * @returns An array of product objects assigned to the rule set.
 */
export const getProductsAssignedToRuleSet = async (ruleSetId: string): Promise<Prisma.productsGetPayload<{}>[]> => { // Renamed function
    const assignments = await prisma.product_rule_set_assignments.findMany({ // Renamed Prisma model
        where: { rule_set_id: ruleSetId },
        include: { products: true }, // Include the related product data
    });
     // Ensure products is not null before mapping
    return assignments.map(assignment => assignment.products).filter(p => p !== null) as Prisma.productsGetPayload<{}>[];
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
