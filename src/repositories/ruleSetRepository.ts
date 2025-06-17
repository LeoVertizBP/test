import { rule_sets as RuleSet, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

// Define possible rule set types
type RuleSetType = 'product' | 'channel';

/**
 * Creates a new rule set in the database, linked to an advertiser.
 * @param data - The data for the new rule set. Requires advertiserId (for connection), name, and set_type. Description and is_default are optional.
 * @param data - The data for the new rule set. Requires advertiserId, name, and set_type. Description and is_default are optional.
 * @returns The newly created rule set.
 */
export const createRuleSet = async (data: Omit<Prisma.rule_setsUncheckedCreateInput, 'id' | 'created_at' | 'updated_at'>): Promise<RuleSet> => {
    // Basic validation - check required fields directly on the input data
    if (!data.advertiser_id || !data.name || !data.set_type) {
        throw new Error("Missing required fields for rule set creation (advertiser_id, name, set_type).");
    }
    // Ensure set_type is valid
    if (data.set_type !== 'product' && data.set_type !== 'channel') {
        throw new Error("Invalid set_type. Must be 'product' or 'channel'.");
    }

    // Pass the data object containing the advertiser_id directly
    return prisma.rule_sets.create({
        data: data // Prisma expects advertiser_id directly here
    });
};

/**
 * Retrieves a single rule set by its unique ID.
 * @param id - The UUID of the rule set to retrieve.
 * @returns The rule set object or null if not found.
 */
export const getRuleSetById = async (id: string): Promise<RuleSet | null> => {
    return prisma.rule_sets.findUnique({
        where: { id: id },
        // Optionally include related rules based on set_type if needed frequently
        // include: { product_rule_sets: { include: { product_rules: true } }, channel_rule_sets: { include: { channel_rules: true } } }
    });
};

/**
 * Retrieves all rule sets belonging to a specific advertiser.
 * TODO: Add pagination and filtering (e.g., set_type, is_default).
 * @param advertiserId - The UUID of the advertiser.
 * @returns An array of rule set objects for the given advertiser.
 */
export const getRuleSetsByAdvertiserId = async (advertiserId: string): Promise<RuleSet[]> => {
    return prisma.rule_sets.findMany({
        where: { advertiser_id: advertiserId }, // Filter by foreign key
    });
};

/**
 * Updates an existing rule set.
 * @param id - The UUID of the rule set to update.
 * @param data - An object containing the fields to update. Cannot change set_type after creation.
 * @returns The updated rule set object.
 */
export const updateRuleSet = async (id: string, data: Omit<Prisma.rule_setsUpdateInput, 'set_type'>): Promise<RuleSet> => {
    // Prevent changing set_type
    if ('set_type' in data) {
        throw new Error("Cannot change the set_type of an existing rule set.");
    }
    return prisma.rule_sets.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a rule set by its unique ID.
 * @param id - The UUID of the rule set to delete.
 * @returns The deleted rule set object.
 */
export const deleteRuleSet = async (id: string): Promise<RuleSet> => {
    // Note: Deleting a rule set will cascade and delete associated rule links.
    return prisma.rule_sets.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all rule sets belonging to a specific organization by joining through advertisers.
 * @param organizationId - The UUID of the organization.
 * @returns An array of rule set objects for the given organization.
 */
export const getRuleSetsByOrganizationId = async (organizationId: string): Promise<RuleSet[]> => {
    return prisma.rule_sets.findMany({
        where: {
            // Filter rule sets where the related advertiser's organization_id matches
            advertisers_rule_sets_advertiser_idToadvertisers: { // Use the relation name from the schema
                organization_id: organizationId,
            },
        },
        // Optionally include the advertiser details if needed
        // include: { advertisers_rule_sets_advertiser_idToadvertisers: true }
    });
};

// --- Functions for managing rules within a rule set ---

/**
 * Adds a rule (product or channel) to a rule set, based on the rule set's type.
 * @param ruleSetId - The UUID of the rule set.
 * @param ruleId - The UUID of the rule (product or channel) to add.
 * @returns The created mapping entry (either product_rule_sets or channel_rule_sets).
 * @throws Error if rule type doesn't match rule set type.
 */
export const addRuleToRuleSet = async (ruleSetId: string, ruleId: string): Promise<Prisma.product_rule_setsGetPayload<{}> | Prisma.channel_rule_setsGetPayload<{}>> => {
    const ruleSet = await getRuleSetById(ruleSetId);
    if (!ruleSet) {
        throw new Error(`Rule set with ID ${ruleSetId} not found.`);
    }

    if (ruleSet.set_type === 'product') {
        // Verify ruleId exists in product_rules (optional, DB constraint handles it)
        return prisma.product_rule_sets.create({
            data: {
                rule_set_id: ruleSetId,
                product_rule_id: ruleId,
            },
        });
    } else if (ruleSet.set_type === 'channel') {
        // Verify ruleId exists in channel_rules (optional)
        return prisma.channel_rule_sets.create({
            data: {
                rule_set_id: ruleSetId,
                channel_rule_id: ruleId,
            },
        });
    } else {
        // Should not happen due to DB constraints, but good practice
        throw new Error(`Unknown rule set type: ${ruleSet.set_type}`);
    }
};

/**
 * Removes a rule (product or channel) from a rule set, based on the rule set's type.
 * @param ruleSetId - The UUID of the rule set.
 * @param ruleId - The UUID of the rule (product or channel) to remove.
 * @returns The result of the delete operation (count of deleted records).
 * @throws Error if rule set not found.
 */
export const removeRuleFromRuleSet = async (ruleSetId: string, ruleId: string): Promise<Prisma.BatchPayload> => {
     const ruleSet = await getRuleSetById(ruleSetId);
    if (!ruleSet) {
        // Or handle silently if preferred
        throw new Error(`Rule set with ID ${ruleSetId} not found.`);
    }

    if (ruleSet.set_type === 'product') {
        return prisma.product_rule_sets.deleteMany({
            where: {
                rule_set_id: ruleSetId,
                product_rule_id: ruleId,
            },
        });
    } else if (ruleSet.set_type === 'channel') {
         return prisma.channel_rule_sets.deleteMany({
            where: {
                rule_set_id: ruleSetId,
                channel_rule_id: ruleId,
            },
        });
    } else {
        throw new Error(`Unknown rule set type: ${ruleSet.set_type}`);
    }
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
