import prisma from '../utils/prismaClient';
import { flags, HumanVerdict, Prisma } from '../../generated/prisma/client'; // Correct import path
// Import HarmCategory and HarmBlockThreshold from vertexai to match the wrapper service
import { HarmCategory, HarmBlockThreshold, SafetySetting } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import * as aiCallWrapperService from './aiCallWrapperService';

// Load environment variables
dotenv.config();

// Initialize Gemini Client - it will automatically use GOOGLE_APPLICATION_CREDENTIALS
// Pass empty string "" to satisfy constructor expectation (string) while potentially allowing ADC fallback
const genAI = new GoogleGenerativeAI("");
// Use a model suitable for ranking/comparison tasks. Flash might be sufficient.
// Note: Ensure the service account has permissions for this model if different from analysis models.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Use the Vertex AI safety settings which match the wrapper service's expected types
const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// Define a type for the examples returned by the Librarian
export interface RelevantExample {
    flagId: string;
    contextText: string | null;
    humanVerdict: HumanVerdict | null;
    selectionReason: string | null;
    // Add other fields if needed for the analysis prompt later
}

/**
 * Finds relevant learning examples for a given rule and context using AI ranking.
 *
 * @param ruleId The ID of the rule being analyzed.
 * @param ruleVersion The version of the rule being analyzed.
 * @param currentContextSnippet A snippet of the content currently being analyzed.
 * @param candidateLimit The maximum number of candidate examples to fetch initially.
 * @param returnLimit The maximum number of top relevant examples to return.
 * @returns A promise resolving to an array of the most relevant examples.
 */
export const findRelevantExamples = async (
    ruleId: string,
    ruleVersion: string,
    currentContextSnippet: string,
    candidateLimit: number = 20, // Fetch more candidates than needed
    returnLimit: number = 5      // Return the top N
): Promise<RelevantExample[]> => {
    if (!model) {
        console.warn("AI Librarian: Gemini model not initialized (API key missing?). Cannot find relevant examples.");
        return [];
    }
    console.log(`AI Librarian: Searching for relevant examples for rule ${ruleId} (v${ruleVersion}) based on context: "${currentContextSnippet.substring(0, 100)}..."`);

    try {
        // 1. Fetch Candidate Examples from DB
        const candidateFlags = await prisma.flags.findMany({
            where: {
                rule_id: ruleId,
                rule_version_applied: ruleVersion,
                is_learning_example: true,
                human_verdict: { not: null }, // Ensure it has been reviewed
            },
            orderBy: {
                reviewed_at: 'desc', // Get most recent reviews first
            },
            take: candidateLimit,
            select: { // Select only fields needed for ranking and final return
                id: true,
                context_text: true,
                human_verdict: true,
                example_selection_reason: true,
                // Add ai_ruling, ai_evaluation if needed for ranking prompt
            }
        });

        if (candidateFlags.length === 0) {
            console.log(`AI Librarian: No candidate examples found for rule ${ruleId} (v${ruleVersion}).`);
            return [];
        }

        console.log(`AI Librarian: Found ${candidateFlags.length} candidate examples. Asking AI to rank relevance...`);

        // 2. AI Call for Relevance Ranking
        let rankedFlagIds: string[] = [];
        try {
            // Prepare candidate list for the prompt
            const candidateListText = candidateFlags.map((flag, index) =>
                `Example ${index + 1} (ID: ${flag.id}):
                Context: "${flag.context_text?.substring(0, 300) ?? 'N/A'}"
                Human Verdict: ${flag.human_verdict}
                Reason Selected: ${flag.example_selection_reason ?? 'N/A'}`
            ).join('\n---\n');

            const prompt = `I am analyzing new content for compliance rule ID ${ruleId} (version ${ruleVersion}).
            The context of the new content is: "${currentContextSnippet}"

            Below are some past learning examples that were selected for this rule. Please evaluate how relevant each example is for providing helpful context or guidance for analyzing the *new* content snippet provided above. Consider the similarity of the situation described in the context and the reason the example was originally selected.

            Learning Examples:
            ${candidateListText}

            Based on relevance to the *new* content context, list the IDs of the top ${returnLimit} most relevant examples from the list above. Order them from most relevant to least relevant. Respond ONLY with the comma-separated list of IDs (e.g., id1,id2,id3). If none are particularly relevant, respond with NONE.`;

            // Use the wrapper service to make the call
            const result = await aiCallWrapperService.callGenerativeModelWithLogging(
                { // AI Call Params
                    modelName: "gemini-1.5-flash", // Use flash model for ranking
                    parts: [{ text: prompt }], // Correct parts structure
                    safetySettings: safetySettings,
                },
                { // Logging Context
                    serviceName: "AiLibrarianService",
                    actionName: "rankRelevantExamples",
                    relatedContext: { ruleId: ruleId, ruleVersion: ruleVersion, candidateCount: candidateFlags.length } // Add relevant context
                }
            );

            // Updated to match WrapperResult structure
            const responseText = result?.text?.trim() ?? '';
            console.log(`AI Librarian: Gemini ranking response: ${responseText}`);

            if (responseText.toUpperCase() !== 'NONE' && responseText !== '') {
                rankedFlagIds = responseText.split(',').map(id => id.trim()).filter(id => id); // Split, trim, remove empty strings
            }

        } catch (error: any) {
            console.error(`AI Librarian: Error during AI relevance ranking for rule ${ruleId}:`, error.message || error);
            // Fallback: If ranking fails, maybe return the most recent ones? Or empty?
            console.warn(`AI Librarian: Ranking failed. Returning empty list.`);
            return [];
        }

        // 3. Fetch Full Details for Ranked Examples
        if (rankedFlagIds.length > 0) {
            console.log(`AI Librarian: Fetching details for top ${rankedFlagIds.length} ranked examples.`);
            // Fetch the flags again using the ranked IDs to ensure order and get all needed fields
            const rankedFlags = await prisma.flags.findMany({
                where: {
                    id: { in: rankedFlagIds }
                },
                select: {
                    id: true,
                    context_text: true,
                    human_verdict: true,
                    example_selection_reason: true,
                    // Select other fields needed for the final analysis prompt
                }
            });

            // Sort the results according to the ranked IDs order
            // Fixed type guard to use correct Prisma type
            const sortedRankedFlags = rankedFlagIds
                .map(id => rankedFlags.find(flag => flag.id === id))
                .filter((flag): flag is typeof rankedFlags[number] => flag !== undefined); // Correct type guard

            // Map to the return type
            const relevantExamples: RelevantExample[] = sortedRankedFlags.map(flag => ({
                flagId: flag.id,
                contextText: flag.context_text,
                humanVerdict: flag.human_verdict,
                selectionReason: flag.example_selection_reason,
            }));

            console.log(`AI Librarian: Returning ${relevantExamples.length} relevant examples.`);
            return relevantExamples;

        } else {
            console.log(`AI Librarian: AI indicated no examples were relevant or ranking failed.`);
            return [];
        }

    } catch (error: any) {
        console.error(`AI Librarian: Failed to find relevant examples for rule ${ruleId}:`, error.message || error);
        return [];
    }
};
