import { rule_sets as RuleSet, Prisma } from '../../generated/prisma/client';
import * as ruleSetRepository from '../repositories/ruleSetRepository';
import prisma from '../utils/prismaClient';

/**
 * Creates a new rule set, linked to an advertiser.
 * @param ruleSetData - Data for the new rule set (requires 'name', 'set_type', and 'advertiser_id').
 * @returns The newly created rule set object.
 */
export const createRuleSet = async (ruleSetData: Omit<Prisma.rule_setsUncheckedCreateInput, 'id' | 'created_at' | 'updated_at'>): Promise<RuleSet> => {
    // Service layer validation could go here (e.g., check if advertiser exists)
    return ruleSetRepository.createRuleSet(ruleSetData);
};

/**
 * Retrieves a single rule set by its ID.
 * @param id - The UUID of the rule set.
 * @returns The rule set object or null if not found.
 */
export const getRuleSetById = async (id: string): Promise<RuleSet | null> => {
    return ruleSetRepository.getRuleSetById(id);
};

/**
 * Retrieves all rule sets for a specific advertiser.
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of rule set objects.
 */
export const getRuleSetsByAdvertiserId = async (advertiserId: string): Promise<RuleSet[]> => {
    // Future: Add pagination/filtering logic here if needed
    return ruleSetRepository.getRuleSetsByAdvertiserId(advertiserId);
};

/**
 * Updates an existing rule set.
 * @param id - The UUID of the rule set to update.
 * @param updateData - An object containing the fields to update (cannot change set_type).
 * @returns The updated rule set object.
 */
export const updateRuleSet = async (id: string, updateData: Omit<Prisma.rule_setsUpdateInput, 'set_type'>): Promise<RuleSet> => {
    // Service layer validation or logic before update could go here
    return ruleSetRepository.updateRuleSet(id, updateData);
};

/**
 * Deletes a rule set by its ID.
 * @param id - The UUID of the rule set to delete.
 * @returns The deleted rule set object.
 */
export const deleteRuleSet = async (id: string): Promise<RuleSet> => {
    // Service layer logic before deletion could go here
    // (e.g., check for assignments and handle dependencies)
    return ruleSetRepository.deleteRuleSet(id);
};

/**
 * Adds a rule to a rule set.
 * @param ruleSetId - The UUID of the rule set.
 * @param ruleId - The UUID of the rule (product or channel) to add.
 * @returns The created mapping entry.
 */
export const addRuleToRuleSet = async (ruleSetId: string, ruleId: string): Promise<Prisma.product_rule_setsGetPayload<{}> | Prisma.channel_rule_setsGetPayload<{}>> => {
    // Additional validation could be added here (e.g., check if rule exists and belongs to the same advertiser)
    return ruleSetRepository.addRuleToRuleSet(ruleSetId, ruleId);
};

/**
 * Removes a rule from a rule set.
 * @param ruleSetId - The UUID of the rule set.
 * @param ruleId - The UUID of the rule (product or channel) to remove.
 * @returns The result of the delete operation.
 */
export const removeRuleFromRuleSet = async (ruleSetId: string, ruleId: string): Promise<Prisma.BatchPayload> => {
    // Additional validation could be added here
    return ruleSetRepository.removeRuleFromRuleSet(ruleSetId, ruleId);
};

/**
 * Retrieves all rule sets for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of rule set objects.
 */
export const getRuleSetsByOrganizationId = async (organizationId: string): Promise<RuleSet[]> => {
    // We will add the corresponding function to the repository next.
    return ruleSetRepository.getRuleSetsByOrganizationId(organizationId);
};
