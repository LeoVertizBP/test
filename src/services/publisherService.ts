import { publishers as Publisher, Prisma } from '../../generated/prisma/client';
import * as publisherRepository from '../repositories/publisherRepository';

/**
 * Creates a new publisher, linked to an organization.
 * @param publisherData - Data for the new publisher (requires 'name', 'status', and 'organizationId').
 * @returns The newly created publisher object.
 */
export const createPublisher = async (publisherData: Omit<Prisma.publishersCreateInput, 'organizations'> & { organizationId: string }): Promise<Publisher> => {
    // Service layer validation could go here (e.g., check if organization exists)
    return publisherRepository.createPublisher(publisherData);
};

/**
 * Retrieves a single publisher by its ID.
 * @param id - The UUID of the publisher.
 * @returns The publisher object or null if not found.
 */
export const getPublisherById = async (id: string): Promise<Publisher | null> => {
    return publisherRepository.getPublisherById(id);
};

/**
 * Retrieves all publishers for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of publisher objects.
 */
export const getPublishersByOrganizationId = async (organizationId: string): Promise<Publisher[]> => {
    // Future: Add pagination logic here if needed
    return publisherRepository.getPublishersByOrganizationId(organizationId);
};

/**
 * Retrieves all channels for a specific publisher.
 * @param publisherId - The UUID of the publisher.
 * @returns An array of publisher channel objects.
 */
export const getChannelsByPublisherId = async (publisherId: string): Promise<PublisherChannel[]> => {
    // This assumes PublisherChannel is the correct type from the repository/Prisma
    // We will add the corresponding function to the repository next.
    return publisherRepository.getChannelsByPublisherId(publisherId);
};

/**
 * Updates an existing publisher.
 * @param id - The UUID of the publisher to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated publisher object.
 */
export const updatePublisher = async (id: string, updateData: Prisma.publishersUpdateInput): Promise<Publisher> => {
    // Service layer validation or logic before update could go here
    return publisherRepository.updatePublisher(id, updateData);
};

/**
 * Deletes a publisher by its ID.
 * @param id - The UUID of the publisher to delete.
 * @returns The deleted publisher object.
 */
export const deletePublisher = async (id: string): Promise<Publisher> => {
    // Service layer logic before deletion could go here
    // (e.g., check for associated channels/products and handle dependencies)
    return publisherRepository.deletePublisher(id);
};

/**
 * Creates a new channel for a specific publisher.
 * @param publisherId - The UUID of the publisher.
 * @param channelData - Data for the new channel (requires platform, channel_url, status).
 * @returns The newly created publisher channel object.
 */
export const createChannelForPublisher = async (
    publisherId: string,
    channelData: Omit<Prisma.publisher_channelsCreateInput, 'publishers'> // Exclude direct publisher relation input
): Promise<PublisherChannel> => {
    // Service layer validation could go here (e.g., validate platform, URL format)
    // The repository will handle linking to the publisher.
    return publisherRepository.addChannelToPublisher(publisherId, channelData);
};

// Need to import PublisherChannel if not already implicitly available via Prisma import
import { publisher_channels as PublisherChannel } from '../../generated/prisma/client';
