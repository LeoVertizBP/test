import { advertisers as Advertiser, Prisma } from '../../generated/prisma/client';
import * as advertiserRepository from '../repositories/advertiserRepository';
import prisma from '../utils/prismaClient';

/**
 * Creates a new advertiser, linked to an organization.
 * @param advertiserData - Data for the new advertiser (requires 'name' and 'organizationId').
 * @returns The newly created advertiser object.
 */
export const createAdvertiser = async (advertiserData: Omit<Prisma.advertisersCreateInput, 'organizations'> & { organizationId: string }): Promise<Advertiser> => {
    // Service layer validation could go here (e.g., check if organization exists)
    return advertiserRepository.createAdvertiser(advertiserData);
};

/**
 * Retrieves a single advertiser by its ID.
 * @param id - The UUID of the advertiser.
 * @returns The advertiser object or null if not found.
 */
export const getAdvertiserById = async (id: string): Promise<Advertiser | null> => {
    return advertiserRepository.getAdvertiserById(id);
};

/**
 * Retrieves all advertisers for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of advertiser objects.
 */
export const getAdvertisersByOrganizationId = async (organizationId: string): Promise<Advertiser[]> => {
    // Future: Add pagination logic here if needed
    return advertiserRepository.getAdvertisersByOrganizationId(organizationId);
};

/**
 * Updates an existing advertiser.
 * @param id - The UUID of the advertiser to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated advertiser object.
 */
export const updateAdvertiser = async (id: string, updateData: Prisma.advertisersUpdateInput): Promise<Advertiser> => {
    // Service layer validation or logic before update could go here
    return advertiserRepository.updateAdvertiser(id, updateData);
};

/**
 * Deletes an advertiser by its ID.
 * @param id - The UUID of the advertiser to delete.
 * @returns The deleted advertiser object.
 */
export const deleteAdvertiser = async (id: string): Promise<Advertiser> => {
    // Service layer logic before deletion could go here
    // (e.g., check for associated products/rules and handle dependencies)
    return advertiserRepository.deleteAdvertiser(id);
};

/**
 * Retrieves all products associated with a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of product objects.
 */
export const getProductsByAdvertiserId = async (advertiserId: string): Promise<any[]> => { // Using any[] for now, replace with Product type later
    // We will add the corresponding function to the repository next.
    // Need to import Product type if not already available
    return advertiserRepository.getProductsByAdvertiserId(advertiserId);
};
