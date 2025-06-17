import {
    HarmCategory,
    HarmBlockThreshold,
    Part,
    SafetySetting
} from "@google-cloud/vertexai";
import {
    SchemaType,
    FunctionDeclaration,
    GenerateContentRequest
} from "@google/generative-ai";

import dotenv from 'dotenv';
import prisma from '../utils/prismaClient';
import {
    content_items,
    products,
    advertisers,
    content_images,
    FlagStatus,
    ResolutionMethod
} from '../../generated/prisma/client';
import * as aiCallWrapperService from './aiCallWrapperService';
import { v4 as uuidv4 } from 'uuid';
// import { debug, info, warn, error } from '../utils/logUtil'; // Replaced by jobFileLogger
import { createJobLogger } from '../utils/jobFileLogger'; // Import the job file logger

// const MODULE_NAME = 'AiAnalysisParallelService'; // No longer needed with jobLogger

// Import necessary functions from the original aiAnalysisService
import {
    // generateAnalysisPromptGeneric, // No longer needed directly here
    getProductContextRules,
    getAdvertiserGlobalRules,
    ApplicableRule,
    callTextAnalysisModelWithLibrarianTool,
    GetRelevantExamplesTool
} from './aiAnalysisService';
import { extractMentions, ExtractedMention } from './flagExtractionService'; // Added import

// gcsService import might still be needed if we add direct media handling back to evaluator later
// import { downloadFileFromGCSAsBuffer, getGcsUriFromHttpsUrl } from './gcsService';

// Load environment variables from .env file
dotenv.config();

// Define safety settings to use for all AI calls
const defaultSafetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Helper function to safely convert potentially undefined IDs to string or null
 */
const safeId = (id: string | undefined | null): string | null => {
    return id === undefined ? null : id;
};

// New function to generate a focused evaluation prompt for a single extracted mention
const generateEvaluationPrompt = (
    mention: ExtractedMention,
    rules: ApplicableRule[],
    product: products | null, // Product context for the mention
    contentItemTitle: string | null, // Overall content title for context
    contentItemCaption: string | null // Overall content caption for context
): string => {
    const rulesTable = rules.map(rule =>
        `- "${rule.name}" (ID: ${rule.id}, Type: ${rule.rule_type}): ${rule.description}`
    ).join('\n');

    // Re-use parts of the original prompt's STEP 1 and STEP 2, and confidence guidelines
    const prompt = `
You are an AI assistant evaluating a specific extracted piece of content against compliance rules.

Product Context: ${product ? `"${product.name}" (ID: ${product.id})` : "General Advertiser Context (No specific product)"}
${product && product.marketing_bullets ? `Product Marketing Bullets: ${JSON.stringify(product.marketing_bullets)}` : ''}

Overall Content Context (for reference):
${contentItemTitle ? `Title: ${contentItemTitle}\n` : ''}
${contentItemCaption ? `Caption/Description: ${contentItemCaption}\n` : ''}

Extracted Mention Details:
Mention Type: ${mention.mentionType}
Context Text: "${mention.contextText}"
${mention.surroundingContext ? `Surrounding Context: "${mention.surroundingContext}"\n` : ''} // Display surrounding context
Source Location: ${mention.sourceLocation}
${mention.visualLocation ? `Visual Location: ${mention.visualLocation}\n` : ''} // Display visual location
Extractor Confidence: ${mention.confidence.toFixed(2)}
${mention.associationReasoning ? `Extractor Association Reasoning: ${mention.associationReasoning}\n` : ''} // Display extractor reasoning
${mention.timestampStartMs !== undefined ? `Timestamp Start: ${mention.timestampStartMs}ms\n` : ''}
${mention.timestampEndMs !== undefined ? `Timestamp End: ${mention.timestampEndMs}ms\n` : ''}

────────────────────────────────────────────────────────────
APPLICABLE RULES - YOU MUST ONLY USE THESE EXACT RULE IDs FOR THIS EVALUATION
────────────────────────────────────────────────────────────
${rulesTable}

IMPORTANT: When creating a flag, you MUST use ONLY the exact rule IDs listed above.
DO NOT create your own rule IDs or use descriptive names. Always use the exact ID
string from the database (e.g., "a1b2c3d4-5678-..." NOT "cashback_disclosure").
Creating a flag with an invalid rule ID will cause the flag to be DISCARDED.
────────────────────────────────────────────────────────────

EVALUATION TASK:
Based *only* on the "Extracted Mention Details" provided above and its relationship to the "Product Context", evaluate its compliance against the "APPLICABLE RULES" by following these steps:

STEP 1 — Rule-Mention Matching (Applicability):
*   For each rule listed in "APPLICABLE RULES", determine if the rule's purpose directly relates to the \`mentionType\` provided in the "Extracted Mention Details".
*   **Crucially:** Only proceed to Step 2 (Compliance) for rules that directly match the \`mentionType\`.
    *   Example 1: If \`mentionType\` is 'CARD_NAME', only evaluate rules specifically about card naming or identification.
    *   Example 2: If \`mentionType\` is 'ANNUAL_FEE', only evaluate rules about annual fee disclosure or accuracy.
    *   Example 3: If \`mentionType\` is 'MARKETING_BULLET_TRAVEL', only evaluate rules related to marketing bullets.
*   **If a rule's purpose does NOT directly relate to the \`mentionType\`, consider that rule 'not_applicable' FOR THIS SPECIFIC MENTION and DO NOT generate an output block for it.**

STEP 2 — Compliance (Only for Applicable Rules from Step 1):
*   For rules deemed applicable in Step 1, determine if the "Extracted Mention Details" is 'compliant' or a 'violation'.
*   **Contextual Inference**: If a rule requirement isn't literally met in the "Context Text" but an explicit figure/phrase appears within it that clearly refers to the same product and satisfies the rule's intent, you may treat it as compliant, but adjust confidence and explain.

TOOL — get_relevant_examples
Call if your \`confidence_score < 0.70\` for any evaluation.

Reminder: Only generate a \`--- FLAG_START ---\` block if Step 1 determined the rule was applicable to the \`mentionType\`.
OUTPUT FORMAT (Generate one block **ONLY for each rule deemed applicable in Step 1** based on the mentionType. Do NOT output blocks for non-applicable rules.)
--- FLAG_START ---
rule_id: [EXACT ID SHOWN IN APPLICABLE RULES SECTION ABOVE]
product_id: ${product ? product.id : "N/A"}
rule_applicability: applicable | not_applicable
content_source: ${mention.sourceLocation} # Use the sourceLocation from the mention
ai_ruling: compliant | violation | tentative_violation # tentative_violation if rule_applicability is not_applicable but you want to note something
confidence_score: 0.00-1.00
ai_confidence_reasoning: …
context: "[visualLocation] [surroundingContext or contextText]" (Omit visualLocation prefix if not applicable)
evaluation: … # Your detailed evaluation against the specific rule
${mention.timestampStartMs !== undefined ? `transcript_start_ms: ${mention.timestampStartMs}\n` : ''}
${mention.timestampEndMs !== undefined ? `transcript_end_ms: ${mention.timestampEndMs}\n` : ''}
--- FLAG_END ---

Return **NO_FLAGS** only if *none of the provided rules lead to any output block*.

────────────────────────────────────────────────────────────
CONFIDENCE SCORE CALCULATION:
1. Start with the "Extractor Confidence" provided in the "Extracted Mention Details".
2. Based on your evaluation of the mention against the rule and the clarity of the provided context:
   - If the evidence is very clear and directly supports your ruling, add up to 0.08 (e.g., +0.04 for clear, +0.08 for extremely clear).
   - If the evidence is ambiguous, misleading, or insufficient for a high-confidence ruling, subtract up to 0.08 (e.g., -0.04 for slightly ambiguous, -0.08 for very unclear).
   - If the evidence is adequate but not exceptionally clear or unclear, make no adjustment (+0.00).
3. Ensure the final score is capped between 0.00 and 1.00.
4. Output this final calculated score as the \`confidence_score\` for the flag.
5. Explain your adjustment in the \`ai_confidence_reasoning\` field, including the numeric adjustment made and the reason (e.g., "+0.08: Very clear visual evidence", "-0.08: Highly ambiguous context requires human review", "+0.00: Standard context"). If the extractor provided "Extractor Association Reasoning", include that information as well, prefixed with "Extractor Reasoning:".
`;
    return prompt.trim();
};

// NOTE: generateImageAnalysisPrompt and generateVideoAnalysisPrompt (previously defined here) are removed as they are no longer used.

/**
 * Fix for TypeScript errors: Returns a strongly typed ID value that is either string or null (never undefined)
 */
const ensureIdType = (id: string | undefined | null): string | null => {
    return id === undefined ? null : id;
};

/**
 * Same as above but with explicit type casting for when TypeScript is being more strict
 */
const safeIdStrict = (id: string | undefined | null): string | null => {
    return id === undefined ? null : (id as string);
};

/**
 * Helper function for strongly typing IDs in object properties for TypeScript
 */
const fixIdTypeIssues = (item: any, idProperty: string = 'id'): string | null => {
    if (!item) return null;
    const id = item[idProperty];
    return id === undefined ? null : id;
};

/**
 * Parses a delimited flag block from AI response and extracts flag details.
 */
const parseFlagBlock = (block: string, defaultProductId: string | undefined | null = null): any | null => {
    if (!block || block.trim() === '') return null;

    const flagData: any = { product_id: defaultProductId }; // Use default if provided

    // Use a regex to handle keys and potentially multi-line values more robustly
    const lines = block.trim().split('\n');
    let currentKey: string | null = null;

    for (const line of lines) {
        const match = line.match(/^([a-zA-Z_]+):\s*(.*)/); // Match "key: value"
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            currentKey = null; // Reset current key when a new key is found

            switch (key) {
                case 'rule_id': flagData.rule_id = value; break;
                case 'product_id':
                    flagData.product_id = (value.toUpperCase() === 'N/A') ? null : value;
                    break;
                case 'content_source':
                    // Use the source provided by the evaluation prompt output
                    flagData.content_source = value;
                    break;
                case 'transcript_start_ms':
                    const startMs = parseInt(value);
                    if (!isNaN(startMs)) flagData.transcript_start_ms = startMs;
                    break;
                case 'transcript_end_ms':
                    const endMs = parseInt(value);
                    if (!isNaN(endMs)) flagData.transcript_end_ms = endMs;
                    break;
                case 'ai_ruling': flagData.ai_ruling = value.toLowerCase() === 'compliant' ? 'compliant' : 'violation'; break;
                case 'confidence_score':
                    const score = parseFloat(value);
                    if (!isNaN(score)) flagData.confidence_score = parseFloat(score.toFixed(2));
                    break;
                case 'ai_confidence_reasoning': flagData.ai_confidence_reasoning = value; currentKey = key; break; // Allow multi-line
                case 'context': flagData.context = value; currentKey = key; break; // Allow multi-line
                case 'evaluation': flagData.evaluation = value; currentKey = key; break; // Allow multi-line
                case 'rule_applicability':
                    // Parse but don't use this field - store it for potential future use
                    // We keep this because the AI generates it but we don't need it for now
                    flagData.rule_applicability = value;
                    break;
                default: console.warn(`Unknown key found in flag block: ${key}`);
            }
        } else if (currentKey && flagData[currentKey]) {
            // If it's not a key-value line, append to the current multi-line key
            flagData[currentKey] += '\n' + line.trim();
        }
    }

    // Trim potential leading/trailing whitespace from multi-line fields after loop
    if (flagData.context) flagData.context = flagData.context.trim();
    if (flagData.evaluation) flagData.evaluation = flagData.evaluation.trim();
    if (flagData.ai_confidence_reasoning) flagData.ai_confidence_reasoning = flagData.ai_confidence_reasoning.trim();

    // Basic validation
    if (flagData.rule_id && flagData.context && flagData.ai_ruling) {
        // Add validation for content_source based on ExtractedMention sourceLocation types
        const validSources = ["TITLE", "DESCRIPTION_CAPTION", "TRANSCRIPT", "VIDEO_AUDIO", "VIDEO_VISUAL", "IMAGE_VISUAL", "UNKNOWN"];
        if (!flagData.content_source || !validSources.includes(flagData.content_source)) {
             console.warn(`Parsed flag block has invalid or missing content_source: ${flagData.content_source}. Defaulting might occur later.`);
             // Keep the potentially invalid source for now, let processAndSaveFlags handle default if needed
        }
        return flagData;
    } else {
        console.warn("Skipping partially parsed flag block (missing required fields like rule_id, context, or ai_ruling):", JSON.stringify(flagData));
        return null;
    }
};

/**
 * Processes the AI response, parses flags, and saves them to the database.
 *
 * Note: This function only accepts strings or nulls for imageOrVideoRefId
 * (undefineds are automatically converted to null)
 */
const processAndSaveFlags = async (
    aiResponseText: string | null,
    contentItemId: string,
    mention: ExtractedMention, // Pass the full mention object
    rules: ApplicableRule[], // Keep only one rules parameter
    librarianConsulted: boolean,
    librarianExamplesProvided: boolean,
    scanJobId: string // Added scanJobId for logging
): Promise<{flags: number, violations: number}> => {
    const jobLogger = createJobLogger(scanJobId); // Initialize logger for this function
    // Default product ID from mention, image ref ID from mention
    const defaultProductId = mention.productId;
    const imageOrVideoRefId = mention.sourceContentImageId; // Still string | undefined
    const mentionSourceLocation = mention.sourceLocation;

    // Determine the primary flag source type based on the mention's source location
    let primaryFlagSource: 'ai_text' | 'ai_image' | 'ai_video' = 'ai_text';
    if (mentionSourceLocation === 'IMAGE_VISUAL') {
        primaryFlagSource = 'ai_image';
    } else if (mentionSourceLocation === 'VIDEO_AUDIO' || mentionSourceLocation === 'VIDEO_VISUAL') {
        primaryFlagSource = 'ai_video';
    }

    // Explicitly handle undefined -> null conversion for Prisma compatibility
    const safeImageOrVideoRefId: string | null = imageOrVideoRefId === undefined ? null : imageOrVideoRefId;

    if (!aiResponseText) {
        jobLogger.warn(`No AI response text received for ${primaryFlagSource} evaluation of content item ${contentItemId}. No flags created.`, { contentItemId, primaryFlagSource, mentionType: mention.mentionType });
        return { flags: 0, violations: 0 };
    }

    let potentialFlags: any[] = [];
    let flagCount = 0;
    let violationCount = 0;

    try {
        if (aiResponseText && aiResponseText.toUpperCase().trim() !== 'NO_FLAGS') { // Check aiResponseText is not null
            const flagBlocks = aiResponseText.split('--- FLAG_START ---');
            for (const block of flagBlocks) {
                if (!block || block.trim() === '') continue;
                const cleanBlock = block.split('--- FLAG_END ---')[0];
                // Pass defaultProductId to parser
                const parsedFlag = parseFlagBlock(cleanBlock, defaultProductId);
                if (parsedFlag) {
                    potentialFlags.push(parsedFlag);
                }
            }
        }
        jobLogger.info(`Parsed ${potentialFlags.length} potential ${primaryFlagSource} flags from AI evaluation response for content item ${contentItemId}.`, { potentialFlagCount: potentialFlags.length, contentItemId, primaryFlagSource, mentionType: mention.mentionType });

        flagCount = potentialFlags.length;

        for (const flagData of potentialFlags) {
            if (!flagData.rule_id) {
                jobLogger.warn("Parsed flag data missing rule_id. Skipping flag creation.", { flagData });
                continue;
            }

            try {
                const rule = rules.find(r => r.id === flagData.rule_id);
                if (!rule) {
                    jobLogger.warn(`Rule with ID ${flagData.rule_id} not found in applicable rules for this analysis pass. Skipping flag creation.`, { ruleId: flagData.rule_id });
                    continue;
                }

                const ruleType = rule.rule_type;
                const bypassThreshold = rule.bypass_threshold;
                const confidenceScore = flagData.confidence_score ?? 0;

                let initialStatus: FlagStatus = FlagStatus.PENDING;
                let resolutionMethod: ResolutionMethod | null = null;
                let autoNote: string | null = null;
                const isThresholdValid = bypassThreshold !== null && bypassThreshold !== undefined && bypassThreshold >= 0 && bypassThreshold <= 1;

                if (isThresholdValid && confidenceScore >= bypassThreshold) {
                    if (flagData.ai_ruling === 'violation') {
                        initialStatus = FlagStatus.REMEDIATING;
                        resolutionMethod = ResolutionMethod.AI_AUTO_REMEDIATE;
                        autoNote = `Status automatically set to REMEDIATING by AI (Confidence: ${confidenceScore.toFixed(2)}, Threshold: ${bypassThreshold.toFixed(2)}).`;
                        violationCount++;
                        jobLogger.info(` -> Auto-setting status to REMEDIATING for rule ${flagData.rule_id}`, { ruleId: flagData.rule_id, confidenceScore, bypassThreshold });
                    } else if (flagData.ai_ruling === 'compliant') {
                        initialStatus = FlagStatus.CLOSED;
                        resolutionMethod = ResolutionMethod.AI_AUTO_CLOSE;
                        autoNote = `Status automatically set to CLOSED by AI (Confidence: ${confidenceScore.toFixed(2)}, Threshold: ${bypassThreshold.toFixed(2)}).`;
                        jobLogger.info(` -> Auto-setting status to CLOSED for rule ${flagData.rule_id}`, { ruleId: flagData.rule_id, confidenceScore, bypassThreshold });
                    }
                } else if (flagData.ai_ruling === 'violation') {
                    violationCount++; // Still count violation even if below threshold for auto-action
                }

                // Use the content_source parsed from the AI evaluation response
                const contentSource = flagData.content_source || mentionSourceLocation; // Fallback to mention source if AI didn't provide

                await prisma.flags.create({
                    data: {
                        content_item_id: contentItemId,
                        rule_id: flagData.rule_id,
                        product_id: flagData.product_id, // Use parsed product_id (could be null for global)
                        content_source: contentSource, // Store the content source from evaluation
                        transcript_start_ms: flagData.transcript_start_ms, // Store transcript start time if available
                        transcript_end_ms: flagData.transcript_end_ms, // Store transcript end time if available
                        context_text: flagData.context, // Store context (now surroundingContext) from evaluation
                        visual_location: mention.visualLocation ?? null, // Store visual location from mention, default to null if undefined
                        ai_confidence: confidenceScore,
                        ai_evaluation: flagData.evaluation,
                        ai_ruling: flagData.ai_ruling,
                        ai_confidence_reasoning: flagData.ai_confidence_reasoning,
                        status: initialStatus,
                        resolution_method: resolutionMethod,
                        internal_notes: autoNote,
                        flag_source: primaryFlagSource, // Store primary source type
                        rule_type: ruleType,
                        rule_version_applied: rule.version,
                        librarian_consulted: librarianConsulted,
                        librarian_examples_provided: librarianExamplesProvided,
                        image_reference_id: safeImageOrVideoRefId,
                    }
                });
                jobLogger.info(`Created ${primaryFlagSource} flag for rule ${flagData.rule_id} (Product: ${flagData.product_id ?? 'N/A'}) with status ${initialStatus} and resolution ${resolutionMethod ?? 'Pending'}`, { ruleId: flagData.rule_id, productId: flagData.product_id, status: initialStatus, resolution: resolutionMethod });
            } catch (dbErr: any) {
                const dbError = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
                jobLogger.error(`Error creating ${primaryFlagSource} flag in database for rule ${flagData.rule_id}`, dbError, { ruleId: flagData.rule_id });
            }
        }
    } catch (parseErr: any) {
        const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        jobLogger.error(`Error parsing final AI ${primaryFlagSource} evaluation response for content item ${contentItemId}`, parseError, { rawResponse: aiResponseText });
    }

    return { flags: flagCount, violations: violationCount };
};

/**
 * Analyzes a content item for flags in parallel using the new two-stage approach.
 */
export const analyzeContentItemForFlags = async (
    contentItemId: string,
    scanJobId: string,
    productIds: string[] = [],
    options: {
        modelName?: string; // Model for the EVALUATION step
        concurrencyLimit?: number;
        includeGlobalRules?: boolean;
    } = {}
): Promise<{
    flagCount: number;
    violationCount: number;
    productAnalysisCount: number;
    globalAnalysisPerformed: boolean;
}> => {
    const jobLogger = createJobLogger(scanJobId); // Initialize logger for the main function
    jobLogger.info(`Starting parallel analysis (V2 - Extractor/Evaluator) for content item ${contentItemId}`, { contentItemId, productIds, options });

    // Default values
    const concurrencyLimit = options.concurrencyLimit || 3;
    const evaluationModelName = options.modelName || 'gemini-2.5-flash-preview-04-17'; // Updated model
    const includeGlobalRules = options.includeGlobalRules !== false;

    // Define generationConfig for the evaluator
    const generationConfig = {
        temperature: 0, // Default temperature
        maxOutputTokens: 8192, // Default max output tokens
        thinkingConfig: {
            thinkingBudget: 24576 // Matching extractor's thinking budget
        }
    };

    // Track metrics
    let totalFlagCount = 0;
    let totalViolationCount = 0;
    let productAnalysisCount = 0;
    let globalAnalysisPerformed = false;

    // Fetch content item with all related data needed for analysis
    const contentItem = await prisma.content_items.findUnique({
        where: { id: contentItemId },
        include: {
            scan_jobs: { // Fetch scan_job to ensure scanJobId consistency if needed, though passed as param
                include: {
                    advertisers: true,
                }
            },
            content_images: true,
            publishers: {
                select: { organization_id: true }
            }
        }
    });

    if (!contentItem) {
        jobLogger.error(`Content item ${contentItemId} not found.`);
        return { flagCount: 0, violationCount: 0, productAnalysisCount: 0, globalAnalysisPerformed: false };
    }
    // Verify passed scanJobId matches the one linked to the content item if available
    if (contentItem.scan_job_id && contentItem.scan_job_id !== scanJobId) {
        jobLogger.warn(`Passed scanJobId ${scanJobId} does not match contentItem's linked scan_job_id ${contentItem.scan_job_id}. Using passed ID for logging.`);
        // Potentially throw error or handle discrepancy if critical
    }

    const contentPlatform = contentItem.platform || '';

    // Determine Advertiser Context
    let advertiser: advertisers | null = contentItem.scan_jobs?.advertisers ?? null;
    let advertiserId: string | null = advertiser?.id ?? null;

    // Fallback: If advertiser wasn't linked directly to scan job, try via publisher->organization
    if (!advertiser && contentItem.publishers?.organization_id) {
        jobLogger.info(`Advertiser not directly linked to scan job ${scanJobId}. Looking up via organization ${contentItem.publishers.organization_id}...`);
        advertiser = await prisma.advertisers.findFirst({
            where: { organization_id: contentItem.publishers.organization_id },
        });
        advertiserId = advertiser?.id ?? null;
        jobLogger.info(`Found advertiser ${advertiserId} via organization.`);
    }

    if (!advertiser || !advertiserId) {
        jobLogger.error(`Could not determine advertiser context for content item ${contentItemId}. Skipping all AI analysis.`);
        return { flagCount: 0, violationCount: 0, productAnalysisCount: 0, globalAnalysisPerformed: false };
    }

    const correlationId = uuidv4(); // Generate a unique correlation ID for all analysis in this batch

    // --- Step 1: Call FlagExtractionService ---
    let allExtractedMentions: ExtractedMention[] = [];
    // Determine which products to actually scan for based on job focus AND global flag
    const productIdsToScan = productIds; // Use the list passed in, assuming it's pre-filtered by job focus
    if (productIdsToScan.length > 0 || includeGlobalRules) {
        const productsToScanFor = await prisma.products.findMany({
            where: { id: { in: productIdsToScan } }
        });

        // Ensure content_images is correctly typed and included for the extractor
        const contentItemWithImages = contentItem as typeof contentItem & { content_images: { id: string, file_path: string, image_type: string }[] };

        try {
            // Pass scanJobId to extractMentions for its internal logging
            allExtractedMentions = await extractMentions(contentItemWithImages, productsToScanFor, scanJobId);
            jobLogger.info(`Extractor found ${allExtractedMentions.length} potential mentions for content item ${contentItemId}.`);
        } catch (extractionErr: any) {
            const extractionError = extractionErr instanceof Error ? extractionErr : new Error(String(extractionErr));
            jobLogger.error(`Flag extraction failed for content item ${contentItemId}`, extractionError);
            return { flagCount: 0, violationCount: 0, productAnalysisCount: 0, globalAnalysisPerformed: false };
        }
    }
    // --- End Step 1 ---

    // --- Step 2: Create and Run Evaluation Tasks ---
    const analysisTasks: (() => Promise<{flags: number, violations: number}>)[] = [];

    // Add global rules evaluation task
    if (includeGlobalRules && advertiserId) {
        const globalMentions = allExtractedMentions.filter(mention => !mention.productId);

        analysisTasks.push(async () => {
            jobLogger.info(`Starting global evaluation task for content item ${contentItemId}`);
            const globalRules = await getAdvertiserGlobalRules(advertiserId!, contentPlatform);

            if (globalRules.length === 0 && globalMentions.length > 0) {
                jobLogger.info(`No applicable global rules found, skipping evaluation of ${globalMentions.length} extracted global mentions.`);
            }
            if (globalRules.length === 0 || globalMentions.length === 0) {
                if (globalMentions.length === 0) jobLogger.info(`No global mentions extracted. Skipping global rule evaluation.`);
                globalAnalysisPerformed = true;
                return { flags: 0, violations: 0 };
            }

            let taskFlags = 0;
            let taskViolations = 0;

            jobLogger.info(`Evaluating ${globalMentions.length} global mentions against ${globalRules.length} rules.`);
            for (const mention of globalMentions) {
                jobLogger.info(`  -> Evaluating global mention (Type: ${mention.mentionType})`, { mentionContext: mention.contextText });
                const evaluationPrompt = generateEvaluationPrompt(
                    mention, globalRules, null, contentItem.title, contentItem.caption
                );

                if (evaluationPrompt) {
                    // debug(MODULE_NAME, `Global evaluation prompt for mention type ${mention.mentionType}: \n${evaluationPrompt}`);
                    const initialTextRequest: GenerateContentRequest = {
                        contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
                        tools: [{ functionDeclarations: [GetRelevantExamplesTool] }],
                        safetySettings: defaultSafetySettings as any
                    };

                    try {
                        const { responseText, librarianConsulted, librarianExamplesProvided } = await callTextAnalysisModelWithLibrarianTool(
                            evaluationModelName,
                            initialTextRequest,
                            {
                                serviceName: "AiAnalysisParallelService",
                                actionName: "evaluateGlobalMention",
                                relatedContext: { contentItemId, analysisType: "Advertiser Global", mentionType: mention.mentionType, mentionContext: mention.contextText, sourceLocation: mention.sourceLocation, sourceImageId: mention.sourceContentImageId }
                            },
                            correlationId,
                            generationConfig
                        );

                        // Pass scanJobId to processAndSaveFlags
                        const evalResults = await processAndSaveFlags(
                            (responseText ?? null),
                            contentItemId,
                            mention,
                            globalRules,
                            librarianConsulted,
                            librarianExamplesProvided,
                            scanJobId // Pass scanJobId
                        );
                        taskFlags += evalResults.flags;
                        taskViolations += evalResults.violations;
                    } catch (evalErr: any) {
                        const evalError = evalErr instanceof Error ? evalErr : new Error(String(evalErr));
                        jobLogger.error(`Error evaluating global mention (Type: ${mention.mentionType})`, evalError, { mentionContext: mention.contextText });
                    }
                }
            }
            jobLogger.info(`Global evaluation task completed with ${taskFlags} flags and ${taskViolations} violations`);
            globalAnalysisPerformed = true;
            return { flags: taskFlags, violations: taskViolations };
        });
    }

    // Add product-specific evaluation tasks
    const productsAnalyzed = new Set<string>(); // Keep track to increment productAnalysisCount correctly
    for (const productId of productIdsToScan) {
         const productSpecificMentions = allExtractedMentions.filter(mention => mention.productId === productId);

         // Fetch product details once per product
         const product = await prisma.products.findUnique({ where: { id: productId } });
         if (!product) {
             jobLogger.error(`Product ${productId} not found during evaluation setup. Skipping analysis for this product.`);
             continue;
         }
         productsAnalyzed.add(productId);

         analysisTasks.push(async () => {
            jobLogger.info(`Starting product evaluation task for content item ${contentItemId}, product ${product.name} (${productId})`);
            const productRules = await getProductContextRules(productId, advertiser!, contentPlatform);

            if (productRules.length === 0 && productSpecificMentions.length > 0) {
                 jobLogger.info(`No applicable rules found for product ${product.name}, skipping evaluation of ${productSpecificMentions.length} extracted mentions.`);
            }
             if (productRules.length === 0 || productSpecificMentions.length === 0) {
                 if (productSpecificMentions.length === 0) jobLogger.info(`No mentions extracted for product ${product.name}. Skipping evaluation.`);
                 return { flags: 0, violations: 0 };
             }

            let taskFlags = 0;
            let taskViolations = 0;

            jobLogger.info(`Evaluating ${productSpecificMentions.length} mentions for product ${product.name} against ${productRules.length} rules.`);
            for (const mention of productSpecificMentions) {
                 jobLogger.info(`  -> Evaluating product mention (Product: ${product.name}, Type: ${mention.mentionType})`, { mentionContext: mention.contextText });
                 const evaluationPrompt = generateEvaluationPrompt(
                     mention, productRules, product, contentItem.title, contentItem.caption
                 );

                 if (evaluationPrompt) {
                     // debug(MODULE_NAME, `Product evaluation prompt for ${product.name}, mention type ${mention.mentionType}: \n${evaluationPrompt}`);
                     const initialTextRequest: GenerateContentRequest = {
                         contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
                         tools: [{ functionDeclarations: [GetRelevantExamplesTool] }],
                         safetySettings: defaultSafetySettings as any
                     };

                     try {
                         const { responseText, librarianConsulted, librarianExamplesProvided } = await callTextAnalysisModelWithLibrarianTool(
                             evaluationModelName,
                             initialTextRequest,
                             {
                                 serviceName: "AiAnalysisParallelService",
                                 actionName: "evaluateProductMention",
                                 relatedContext: { contentItemId, productId, analysisType: "Product Specific", mentionType: mention.mentionType, mentionContext: mention.contextText, sourceLocation: mention.sourceLocation, sourceImageId: mention.sourceContentImageId }
                             },
                             correlationId,
                            generationConfig
                        );

                        // Pass scanJobId to processAndSaveFlags
                        const evalResults = await processAndSaveFlags(
                            (responseText ?? null),
                            contentItemId,
                            mention,
                            productRules,
                            librarianConsulted,
                            librarianExamplesProvided,
                            scanJobId // Pass scanJobId
                        );
                        taskFlags += evalResults.flags;
                        taskViolations += evalResults.violations;
                     } catch (evalErr: any) {
                         const evalError = evalErr instanceof Error ? evalErr : new Error(String(evalErr));
                         jobLogger.error(`Error evaluating product mention (Product: ${product.name}, Type: ${mention.mentionType})`, evalError, { mentionContext: mention.contextText });
                     }
                 }
            }
            jobLogger.info(`Product evaluation task for ${product.name} (${productId}) completed with ${taskFlags} flags and ${taskViolations} violations`);
            return { flags: taskFlags, violations: taskViolations };
        });
    }

    // Execute evaluation tasks with controlled concurrency
    for (let i = 0; i < analysisTasks.length; i += concurrencyLimit) {
        const batch = analysisTasks.slice(i, i + concurrencyLimit);
        const results = await Promise.all(batch.map(task => task()));

        // Aggregate results from batch
        results.forEach(result => {
            totalFlagCount += result.flags;
            totalViolationCount += result.violations;
        });
    }

    productAnalysisCount = productsAnalyzed.size;

    jobLogger.info(`All evaluations completed for content item ${contentItemId}`);
    jobLogger.info(`Total flags created: ${totalFlagCount}, Violations: ${totalViolationCount}`);
    jobLogger.info(`Product analyses performed: ${productAnalysisCount}, Global analysis performed: ${globalAnalysisPerformed}`);

    return {
        flagCount: totalFlagCount,
        violationCount: totalViolationCount,
        productAnalysisCount,
        globalAnalysisPerformed
    };
};

/**
 * In a full implementation, these would be the key components:
 *
 * 1. Fetch content item with related data (images, transcripts, etc.)
 * 2. Fetch applicable rules (global rules and product-specific rules)
 * 3. Create analysis tasks for each rule set:
 *    - Global rules analysis
 *    - Product-specific rules analysis for each product
 * 4. Execute these tasks with controlled concurrency
 * 5. Process AI responses to identify flags
 * 6. Save flags to database
 *
 * Each of these steps would have proper error handling, logging, and optimizations.
 *
 * The parallel approach dramatically improves performance by:
 * - Analyzing multiple products simultaneously
 * - Controlling concurrency to avoid rate limits
 * - Efficiently processing batch results
 */
