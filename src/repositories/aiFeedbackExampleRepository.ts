import { ai_feedback_examples as AiFeedbackExample, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Creates a new AI feedback example in the database.
 * @param data - The data for the new example. Requires ruleId, rule_type, content_snippet, ai_verdict, human_verdict, confidence_score, is_correct.
 *               Optional fields like content_item_id, reviewer_id, image_reference_id can be included for connections.
 * @returns The newly created AI feedback example.
 */
export const createAiFeedbackExample = async (
    // Note: Prisma doesn't directly model the polymorphic rule relation, so we handle rule_id and rule_type manually.
    data: Omit<Prisma.ai_feedback_examplesCreateInput, 'content_items' | 'content_images' | 'users'> & {
        ruleId: string; // ID of either a product_rule or channel_rule
        // rule_type: 'product' | 'channel'; // This is now a required field in the input data
        contentItemId?: string;
        imageReferenceId?: string;
        reviewerId?: string;
    }
): Promise<AiFeedbackExample> => {
    const { ruleId, contentItemId, imageReferenceId, reviewerId, ...exampleData } = data;

    // Basic validation - include rule_type check
    if (!ruleId || !exampleData.rule_type || !exampleData.content_snippet || typeof exampleData.ai_verdict !== 'boolean' || typeof exampleData.human_verdict !== 'boolean' || exampleData.confidence_score === undefined || typeof exampleData.is_correct !== 'boolean') {
        throw new Error("Missing required fields for AI feedback example creation (ruleId, rule_type, content_snippet, ai_verdict, human_verdict, confidence_score, is_correct).");
    }
     if (exampleData.rule_type !== 'product' && exampleData.rule_type !== 'channel') {
         throw new Error("Invalid rule_type. Must be 'product' or 'channel'.");
    }

    // Prepare connections based on provided IDs
    // We store rule_id and rule_type directly. No direct Prisma relation for the rule itself.
    const createData: Prisma.ai_feedback_examplesCreateInput = {
        ...exampleData, // Includes rule_id and rule_type from the input
        // Optional connections handled below
    };

    if (contentItemId) {
        createData.content_items = { connect: { id: contentItemId } };
    }
    if (imageReferenceId) {
        createData.content_images = { connect: { id: imageReferenceId } };
    }
    if (reviewerId) {
        createData.users = { connect: { id: reviewerId } };
    }

    return prisma.ai_feedback_examples.create({
        data: createData, // Now includes optional connections if IDs were provided
    });
};

/**
 * Retrieves a single AI feedback example by its unique ID.
 * @param id - The UUID of the example to retrieve.
 * @returns The example object or null if not found.
 */
export const getAiFeedbackExampleById = async (id: string): Promise<AiFeedbackExample | null> => {
    return prisma.ai_feedback_examples.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves AI feedback examples based on specified criteria (e.g., by rule, correctness).
 * TODO: Add pagination and more filtering options.
 * @param where - Prisma WhereInput object for filtering.
 * @returns An array of matching AI feedback example objects.
 */
export const findAiFeedbackExamples = async (where: Prisma.ai_feedback_examplesWhereInput): Promise<AiFeedbackExample[]> => {
    return prisma.ai_feedback_examples.findMany({
        where: where,
    });
};

/**
 * Updates an existing AI feedback example.
 * @param id - The UUID of the example to update.
 * @param data - An object containing the fields to update.
 * @returns The updated example object.
 */
export const updateAiFeedbackExample = async (id: string, data: Prisma.ai_feedback_examplesUpdateInput): Promise<AiFeedbackExample> => {
    return prisma.ai_feedback_examples.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes an AI feedback example by its unique ID.
 * @param id - The UUID of the example to delete.
 * @returns The deleted example object.
 */
export const deleteAiFeedbackExample = async (id: string): Promise<AiFeedbackExample> => {
    return prisma.ai_feedback_examples.delete({
        where: { id: id },
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
