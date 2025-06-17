import prisma from '../utils/prismaClient';
import { flags, FlagStatus, HumanVerdict, Prisma } from '../../generated/prisma/client'; // Correct import path
import { GoogleGenerativeAI } from "@google/generative-ai";
// Import these from vertexai to match the wrapper service
import { HarmCategory, HarmBlockThreshold, SafetySetting } from "@google-cloud/vertexai";
import dotenv from 'dotenv';
import * as aiCallWrapperService from './aiCallWrapperService';

// Load environment variables (needed for Gemini API Key)
dotenv.config();

// Initialize Gemini Client - it will automatically use GOOGLE_APPLICATION_CREDENTIALS
// Pass empty string "" to satisfy constructor expectation (string) while potentially allowing ADC fallback
const genAI = new GoogleGenerativeAI("");
// Note: Ensure the service account has permissions for this model if different from analysis models.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Standardized to gemini-2.0-flash

// Use the Vertex AI safety settings which match the wrapper service's expected types
const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Evaluates a closed flag to determine if it should be marked as a learning example
 * and generates a reason using AI.
 *
 * Trigger this function AFTER a flag's status is set to CLOSED and human_verdict is populated.
 *
 * @param flagId The ID of the flag to evaluate.
 */
export const evaluateAndSelectExample = async (flagId: string): Promise<void> => {
    console.log(`AI Example Manager: Evaluating flag ${flagId} for learning example potential.`);

    try {
        const flag = await prisma.flags.findUnique({
            where: { id: flagId },
            // Include related data needed for evaluation
            include: {
                // Potentially include rule details if needed for prompts
                // products: { select: { name: true } }, // Example
            }
        });

        // Basic checks: Ensure flag exists and has a human verdict
        if (!flag) {
            console.error(`AI Example Manager: Flag ${flagId} not found.`);
            return;
        }
        if (flag.status !== FlagStatus.CLOSED || !flag.human_verdict) {
            console.warn(`AI Example Manager: Flag ${flagId} is not CLOSED or lacks a human verdict. Skipping evaluation.`);
            // Optionally reset example fields if status changed from CLOSED
            // await prisma.flags.update({ where: { id: flagId }, data: { is_learning_example: false, example_selection_reason: null } });
            return;
        }

        // --- AI Call 1: Should this be an example? ---
        let isGoodExample = false;
        try {
            const prompt1 = `Analyze the following compliance flag review:
            Rule ID: ${flag.rule_id}
            Rule Type: ${flag.rule_type}
            Rule Version Applied: ${flag.rule_version_applied ?? 'N/A'}
            Content Context: "${flag.context_text?.substring(0, 500) ?? 'N/A'}"
            Initial AI Ruling: ${flag.ai_ruling ?? 'N/A'} (Confidence: ${flag.ai_confidence ?? 'N/A'})
            Initial AI Reasoning: ${flag.ai_evaluation ?? 'N/A'}
            Human Verdict: ${flag.human_verdict}
            Human Reasoning/Notes: ${flag.human_verdict_reasoning ?? flag.internal_notes ?? 'N/A'}

            Based on the comparison between the initial AI analysis and the final human verdict, would saving this case be a valuable learning example for future AI analysis of this specific rule?
            Consider if it corrects a significant AI error, clarifies ambiguity, reinforces a correct but low-confidence decision, or represents a nuanced edge case.
            Respond only YES or NO.`;

            console.log(`AI Example Manager: Asking Gemini if flag ${flagId} is a good example...`);
            // Use wrapper for AI call 1 with correct parameters
            const result1 = await aiCallWrapperService.callGenerativeModelWithLogging(
                { // AI Call Params
                    modelName: "gemini-1.5-flash", // Use flash model
                    parts: [{ text: prompt1 }], // Correct parts structure
                    safetySettings: safetySettings,
                },
                { // Logging Context
                    serviceName: "AiExampleManagerService",
                    actionName: "checkIfGoodExample",
                    relatedContext: { flagId: flagId, ruleId: flag.rule_id }
                }
            );
            // Fixed access pattern to match WrapperResult
            const responseText = result1?.text?.trim()?.toUpperCase() ?? 'NO'; // Default to NO on error/null response
            console.log(`AI Example Manager: Gemini response (is example?): ${responseText}`);
            isGoodExample = responseText === 'YES';

        } catch (error: any) {
            console.error(`AI Example Manager: Error during AI Call 1 (is example?) for flag ${flagId}:`, error.message || error);
            // Decide how to handle errors - maybe skip marking as example?
            return; // Exit if we can't determine if it's a good example
        }

        // --- AI Call 2: Why is it a good example? (Only if AI Call 1 was YES) ---
        let selectionReason: string | null = null;
        if (isGoodExample) {
            try {
                const prompt2 = `Analyze the following compliance flag review:
                Rule ID: ${flag.rule_id}
                Rule Type: ${flag.rule_type}
                Rule Version Applied: ${flag.rule_version_applied ?? 'N/A'}
                Content Context: "${flag.context_text?.substring(0, 500) ?? 'N/A'}"
                Initial AI Ruling: ${flag.ai_ruling ?? 'N/A'} (Confidence: ${flag.ai_confidence ?? 'N/A'})
                Initial AI Reasoning: ${flag.ai_evaluation ?? 'N/A'}
                Human Verdict: ${flag.human_verdict}
                Human Reasoning/Notes: ${flag.human_verdict_reasoning ?? flag.internal_notes ?? 'N/A'}

                Explain concisely, in one or two sentences, *why* this specific case (comparing the AI analysis to the human verdict) is a useful learning example for future AI analysis of rule ${flag.rule_id}. Focus on the core learning point or the reason for the discrepancy/confirmation.`;

                console.log(`AI Example Manager: Asking Gemini for selection reason for flag ${flagId}...`);
                // Use wrapper for AI call 2 with correct parameters
                const result2 = await aiCallWrapperService.callGenerativeModelWithLogging(
                    { // AI Call Params
                        modelName: "gemini-1.5-flash", // Use flash model
                        parts: [{ text: prompt2 }], // Correct parts structure
                        safetySettings: safetySettings,
                    },
                    { // Logging Context
                        serviceName: "AiExampleManagerService",
                        actionName: "generateSelectionReason",
                        relatedContext: { flagId: flagId, ruleId: flag.rule_id }
                    }
                );
                // Fixed access pattern to match WrapperResult
                selectionReason = result2?.text?.trim() ?? null;
                console.log(`AI Example Manager: Gemini generated reason: ${selectionReason}`);

            } catch (error: any) {
                console.error(`AI Example Manager: Error during AI Call 2 (selection reason) for flag ${flagId}:`, error.message || error);
                // If reason generation fails, maybe still mark as example but with a generic reason?
                selectionReason = "AI evaluation indicated potential value, but reason generation failed.";
            }
        }

        // --- Update Database ---
        console.log(`AI Example Manager: Updating flag ${flagId} - is_learning_example: ${isGoodExample}, reason: ${selectionReason ? selectionReason.substring(0,100)+'...' : 'N/A'}`);
        await prisma.flags.update({
            where: { id: flagId },
            data: {
                is_learning_example: isGoodExample,
                example_selection_reason: selectionReason,
                // updated_at will be handled by Prisma's @updatedAt
            },
        });
        console.log(`AI Example Manager: Successfully updated flag ${flagId}.`);

    } catch (error: any) {
        console.error(`AI Example Manager: Failed to evaluate flag ${flagId}:`, error.message || error);
    }
};
