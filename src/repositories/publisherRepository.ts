import { publishers as Publisher, Prisma } from '../../generated/prisma/client';
import { validate as uuidValidate } from 'uuid'; // Import UUID validation function
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Helper function to validate a UUID
 * @param id - The string to validate as a UUID
 * @returns Boolean indicating if the string is a valid UUID
 */
const isValidUuid = (id: string): boolean => {
  try {
    return uuidValidate(id);
  } catch (error) {
    return false;
  }
};

/**
 * Creates a new publisher in the database, linked to an organization.
 * @param data - The data for the new publisher. Requires organizationId (for connection), name, and status.
 * @returns The newly created publisher.
 */
export const createPublisher = async (data: Omit<Prisma.publishersCreateInput, 'organizations'> & { organizationId: string }): Promise<Publisher> => {
    const { organizationId, ...publisherData } = data;
    if (!organizationId || !publisherData.name || !publisherData.status) {
        throw new Error("Missing required fields for publisher creation (organizationId, name, status).");
    }
    return prisma.publishers.create({
        data: {
            ...publisherData,
            organizations: { // Use the relation field name
                connect: { id: organizationId } // Connect to existing organization
            }
        },
    });
};

/**
 * Adds a new channel to a specific publisher.
 * @param publisherId - The UUID of the publisher to associate the channel with.
 * @param channelData - The data for the new channel (e.g., platform, channel_url, status).
 * @returns The newly created publisher channel.
 */
export const addChannelToPublisher = async (
    publisherId: string,
    channelData: Omit<Prisma.publisher_channelsCreateInput, 'publishers'> // Prisma type for channel creation, excluding publisher relation
): Promise<PublisherChannel> => {
    if (!publisherId || !channelData.platform || !channelData.channel_url || !channelData.status) {
        throw new Error("Missing required fields for channel creation (publisherId, platform, channel_url, status).");
    }

    return prisma.publisher_channels.create({
        data: {
            ...channelData,
            publishers: { // This is the relation field name in Prisma schema
                connect: { id: publisherId } // Connect to the existing publisher
            }
        },
    });
};

/**
 * Retrieves all channels belonging to a specific publisher.
 * @param publisherId - The UUID of the publisher.
 * @returns An array of publisher channel objects for the given publisher.
 */
export const getChannelsByPublisherId = async (publisherId: string): Promise<PublisherChannel[]> => {
    return prisma.publisher_channels.findMany({
        where: { publisher_id: publisherId }, // Filter by the foreign key
    });
};

/**
 * Retrieves a single publisher by its unique ID.
 * @param id - The UUID of the publisher to retrieve.
 * @returns The publisher object or null if not found.
 */
export const getPublisherById = async (id: string): Promise<Publisher | null> => {
    // Validate UUID format before querying the database
    if (!id || !isValidUuid(id)) {
        console.warn(`Invalid publisher ID format: ${id}`);
        return null; // Return null for invalid UUIDs rather than causing a database error
    }
    
    return prisma.publishers.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all publishers belonging to a specific organization.
 * TODO: Add pagination.
 * @param organizationId - The UUID of the organization.
 * @returns An array of publisher objects for the given organization.
 */
export const getPublishersByOrganizationId = async (organizationId: string): Promise<Publisher[]> => {
    // Validate UUID format before querying the database
    if (!organizationId || !isValidUuid(organizationId)) {
        console.warn(`Invalid organization ID format: ${organizationId}`);
        return []; // Return empty array for invalid UUIDs rather than causing a database error
    }
    
    return prisma.publishers.findMany({
        where: { organization_id: organizationId }, // Filter by foreign key
    });
};

/**
 * Updates an existing publisher.
 * @param id - The UUID of the publisher to update.
 * @param data - An object containing the fields to update.
 * @returns The updated publisher object.
 */
export const updatePublisher = async (id: string, data: Prisma.publishersUpdateInput): Promise<Publisher> => {
    return prisma.publishers.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a publisher by its unique ID.
 * @param id - The UUID of the publisher to delete.
 * @returns The deleted publisher object.
 */
export const deletePublisher = async (id: string): Promise<Publisher> => {
    return prisma.publishers.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};

// Import the specific type for PublisherChannel if needed, although PrismaClient often infers it
import { publisher_channels as PublisherChannel } from '../../generated/prisma/client';
