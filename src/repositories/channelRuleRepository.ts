import { channel_rules as ChannelRule, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new channel rule in the database, linked to an advertiser.
 * @param data - The data for the new rule. Requires advertiserId (for connection), name, description, rule_type, and version.
 * @returns The newly created channel rule.
 */
export const createChannelRule = async (data: Omit<Prisma.channel_rulesCreateInput, 'advertisers'> & { advertiserId: string }): Promise<ChannelRule> => {
    const { advertiserId, ...ruleData } = data;
    if (!advertiserId || !ruleData.name || !ruleData.description || !ruleData.rule_type || !ruleData.version) {
        throw new Error("Missing required fields for channel rule creation (advertiserId, name, description, rule_type, version).");
    }
    return prisma.channel_rules.create({
        data: {
            ...ruleData,
            advertisers: { // Use the relation field name
                connect: { id: advertiserId } // Connect to existing advertiser
            }
        },
    });
};

/**
 * Retrieves a single channel rule by its unique ID.
 * @param id - The UUID of the rule to retrieve.
 * @returns The rule object or null if not found.
 */
export const getChannelRuleById = async (id: string): Promise<ChannelRule | null> => {
    return prisma.channel_rules.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves all channel rules belonging to a specific advertiser.
 * TODO: Add pagination and filtering by type/version.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of channel rule objects for the given advertiser.
 */
export const getChannelRulesByAdvertiserId = async (advertiserId: string): Promise<ChannelRule[]> => {
    return prisma.channel_rules.findMany({
        where: { advertiser_id: advertiserId }, // Filter by foreign key
    });
};

/**
 * Updates an existing channel rule.
 * @param id - The UUID of the rule to update.
 * @param data - An object containing the fields to update.
 * @returns The updated rule object.
 */
export const updateChannelRule = async (id: string, data: Prisma.channel_rulesUpdateInput): Promise<ChannelRule> => {
    return prisma.channel_rules.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a channel rule by its unique ID.
 * @param id - The UUID of the rule to delete.
 * @returns The deleted rule object.
 */
export const deleteChannelRule = async (id: string): Promise<ChannelRule> => {
    // Note: Deleting a rule might cascade based on schema definitions (e.g., delete related flags, feedback examples).
    return prisma.channel_rules.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all channel rules belonging to a specific organization by joining through advertisers.
 * @param organizationId - The UUID of the organization.
 * @returns An array of channel rule objects for the given organization.
 */
export const getChannelRulesByOrganizationId = async (organizationId: string): Promise<ChannelRule[]> => {
    return prisma.channel_rules.findMany({
        where: {
            // Filter channel rules where the related advertiser's organization_id matches
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
