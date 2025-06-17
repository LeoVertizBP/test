import { product_rules as ProductRule, Prisma } from '../../generated/prisma/client';
import * as productRuleRepository from '../repositories/productRuleRepository';
import prisma from '../utils/prismaClient';

/**
 * Creates a new product rule, linked to an advertiser.
 * @param ruleData - Data for the new rule (requires 'name', 'description', 'rule_type', 'version', and 'advertiserId').
 * @returns The newly created product rule object.
 */
export const createProductRule = async (ruleData: Omit<Prisma.product_rulesCreateInput, 'advertisers'> & { advertiserId: string }): Promise<ProductRule> => {
    // Service layer validation could go here (e.g., check if advertiser exists, validate rule_type)
    return productRuleRepository.createProductRule(ruleData);
};

/**
 * Retrieves a single product rule by its ID.
 * @param id - The UUID of the product rule.
 * @returns The product rule object or null if not found.
 */
export const getProductRuleById = async (id: string): Promise<ProductRule | null> => {
    return productRuleRepository.getProductRuleById(id);
};

/**
 * Retrieves all product rules for a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product rule objects.
 */
export const getProductRulesByAdvertiserId = async (advertiserId: string): Promise<ProductRule[]> => {
    // Future: Add pagination/filtering logic here if needed
    return productRuleRepository.getProductRulesByAdvertiserId(advertiserId);
};

/**
 * Updates an existing product rule.
 * @param id - The UUID of the product rule to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated product rule object.
 */
export const updateProductRule = async (id: string, updateData: Prisma.product_rulesUpdateInput): Promise<ProductRule> => {
    // Service layer validation or logic before update could go here
    return productRuleRepository.updateProductRule(id, updateData);
};

/**
 * Deletes a product rule by its ID.
 * @param id - The UUID of the product rule to delete.
 * @returns The deleted product rule object.
 */
export const deleteProductRule = async (id: string): Promise<ProductRule> => {
    // Service layer logic before deletion could go here
    // (e.g., check for associations in rule sets and handle dependencies)
    return productRuleRepository.deleteProductRule(id);
};

/**
 * Retrieves all product rules for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of product rule objects.
 */
export const getProductRulesByOrganizationId = async (organizationId: string): Promise<ProductRule[]> => {
    return productRuleRepository.getProductRulesByOrganizationId(organizationId);
};
