import { products as Product, Prisma } from '../../generated/prisma/client';
import * as productRepository from '../repositories/productRepository';
import prisma from '../utils/prismaClient';

/**
 * Creates a new product, linked to an advertiser.
 * @param productData - Data for the new product. Requires 'name' and 'advertiserId'. Can include 'ruleIds' and 'ruleSetIds'.
 * @returns The newly created product object.
 */
export const createProduct = async (
    productData: Omit<Prisma.productsCreateInput, 'advertisers' | 'product_rule_set_assignments' | 'product_rule_overrides'> & {
        advertiserId: string;
        ruleIds?: string[];
        ruleSetIds?: string[];
    }
): Promise<Product> => {
    // Service layer validation could go here (e.g., check if advertiser exists, validate ruleIds/ruleSetIds)
    return productRepository.createProduct(productData); // Pass the whole data object
};

/**
 * Retrieves a single product by its ID.
 * @param id - The UUID of the product.
 * @returns The product object or null if not found.
 */
export const getProductById = async (id: string): Promise<Product | null> => {
    return productRepository.getProductById(id);
};

/**
 * Retrieves all products for a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product objects.
 */
export const getProductsByAdvertiserId = async (advertiserId: string): Promise<Product[]> => {
    // Future: Add pagination logic here if needed
    return productRepository.getProductsByAdvertiserId(advertiserId);
};

/**
 * Updates an existing product.
 * @param id - The UUID of the product to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated product object.
 */
export const updateProduct = async (id: string, updateData: Prisma.productsUpdateInput): Promise<Product> => {
    // Service layer validation or logic before update could go here
    return productRepository.updateProduct(id, updateData);
};

/**
 * Deletes a product by its ID.
 * @param id - The UUID of the product to delete.
 * @returns The deleted product object.
 */
export const deleteProduct = async (id: string): Promise<Product> => {
    // Service layer logic before deletion could go here
    // (e.g., check for associated rules/scans and handle dependencies)
    return productRepository.deleteProduct(id);
};

/**
 * Retrieves all products for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of product objects.
 */
export const getProductsByOrganizationId = async (organizationId: string): Promise<Product[]> => {
    // We will add the corresponding function to the repository next.
    return productRepository.getProductsByOrganizationId(organizationId);
};
