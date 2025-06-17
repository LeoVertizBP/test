import { channel_rules as ChannelRule, Prisma } from '../../generated/prisma/client';
import * as channelRuleRepository from '../repositories/channelRuleRepository';
import prisma from '../utils/prismaClient';

/**
 * Creates a new channel rule, linked to an advertiser.
 * @param ruleData - Data for the new rule (requires 'name', 'description', 'rule_type', 'version', and 'advertiserId').
 * @returns The newly created channel rule object.
 */
export const createChannelRule = async (ruleData: Omit<Prisma.channel_rulesCreateInput, 'advertisers'> & { advertiserId: string }): Promise<ChannelRule> => {
    // Service layer validation could go here (e.g., check if advertiser exists, validate rule_type)
    return channelRuleRepository.createChannelRule(ruleData);
};

/**
 * Retrieves a single channel rule by its ID.
 * @param id - The UUID of the channel rule.
 * @returns The channel rule object or null if not found.
 */
export const getChannelRuleById = async (id: string): Promise<ChannelRule | null> => {
    return channelRuleRepository.getChannelRuleById(id);
};

/**
 * Retrieves all channel rules for a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of channel rule objects.
 */
export const getChannelRulesByAdvertiserId = async (advertiserId: string): Promise<ChannelRule[]> => {
    // Future: Add pagination/filtering logic here if needed
    return channelRuleRepository.getChannelRulesByAdvertiserId(advertiserId);
};

/**
 * Updates an existing channel rule.
 * @param id - The UUID of the channel rule to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated channel rule object.
 */
export const updateChannelRule = async (id: string, updateData: Prisma.channel_rulesUpdateInput): Promise<ChannelRule> => {
    // Service layer validation or logic before update could go here
    return channelRuleRepository.updateChannelRule(id, updateData);
};

/**
 * Deletes a channel rule by its ID.
 * @param id - The UUID of the channel rule to delete.
 * @returns The deleted channel rule object.
 */
export const deleteChannelRule = async (id: string): Promise<ChannelRule> => {
    // Service layer logic before deletion could go here
    // (e.g., check for associations in rule sets and handle dependencies)
    return channelRuleRepository.deleteChannelRule(id);
};

/**
 * Retrieves all channel rules for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of channel rule objects.
 */
export const getChannelRulesByOrganizationId = async (organizationId: string): Promise<ChannelRule[]> => {
    // We already added the corresponding function to the repository
    return channelRuleRepository.getChannelRulesByOrganizationId(organizationId);
};
