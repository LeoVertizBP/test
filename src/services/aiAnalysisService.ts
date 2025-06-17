// Consolidate imports and add missing types
import {
    GoogleGenerativeAI,
    SchemaType,
    FunctionDeclaration,
    GenerateContentRequest,
    Content,
    FunctionResponsePart,
    FunctionCall
} from "@google/generative-ai";
// Import from vertexai for compatibility with wrapper service
import {
    HarmCategory,
    HarmBlockThreshold,
    SafetySetting,
    Part
} from "@google-cloud/vertexai";
import dotenv from 'dotenv';
import prisma from '../utils/prismaClient';
import { content_items, products, product_rules, channel_rules, flags, content_images, advertisers, FlagStatus, HumanVerdict, ResolutionMethod } from '../../generated/prisma/client';
import { downloadFileFromGCSAsBuffer, getGcsUriFromHttpsUrl } from './gcsService';
import { findRelevantExamples, RelevantExample } from './aiLibrarianService';
import * as aiCallWrapperService from './aiCallWrapperService';
import { v4 as uuidv4 } from 'uuid';
import { aiThrottler } from '../utils/aiThrottler';
import { debug, info, warn, error } from '../utils/logUtil';

// Load environment variables from .env file
dotenv.config();

// Initialize client - it will automatically use GOOGLE_APPLICATION_CREDENTIALS
// Pass empty string "" to satisfy constructor expectation (string) while potentially allowing ADC fallback
const genAI = new GoogleGenerativeAI("");
// Use 1.5 Pro for analysis model as well, as Flash function calling can be less reliable
// Note: This service is the older sequential one. Model change to flash was done in parallel service.
const analysisModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const videoModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Standardized to gemini-2.0-flash

// --- Tool Definition for AI Librarian ---
export const GetRelevantExamplesTool: FunctionDeclaration = {
    name: "get_relevant_examples",
    description: "Fetches relevant, human-reviewed past examples for a specific compliance rule to provide context for the current analysis. Call this if you are uncertain about the analysis, lack confidence, or believe examples would clarify the rule's application in the current context.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            ruleId: { type: SchemaType.STRING, description: "The ID of the compliance rule you need examples for." },
            ruleVersion: { type: SchemaType.STRING, description: "The version string of the rule being applied." },
            currentContextSnippet: { type: SchemaType.STRING, description: "A brief snippet (e.g., 1-2 sentences) of the specific text or description of the image/video content currently being analyzed for this rule." }
        },
        required: ["ruleId", "ruleVersion", "currentContextSnippet"]
    }
};

// Define types for clarity
export interface ApplicableRule {
  id: string;
  name: string;
  description: string;
  manual_text?: string | null;
  rule_type: 'product' | 'channel';
  bypass_threshold?: number | null;
  version: string;
  applicable_channel?: string[];
}

interface AIFlagOutput {
  rule_id?: string;
  product_id?: string | null;
  context?: string;
  content_source?: string;
  transcript_start_ms?: number | null;
  transcript_end_ms?: number | null;
  ai_ruling?: string | null;
  ai_confidence_reasoning?: string | null;
  confidence_score?: number;
  evaluation?: string;
  image_index?: number | null;
  video_reference_id?: string | null;
  rule_applicability?: 'applicable' | 'not_applicable' | null; // Added field
}

// Keep all the existing rule fetching functions unchanged
export const getProductContextRules = async (productId: string, advertiser: advertisers, contentPlatform: string): Promise<ApplicableRule[]> => {
  // [Existing implementation unchanged]
  console.log(`Fetching product-context rules for product ID: ${productId}, Advertiser: ${advertiser.name}, Platform: ${contentPlatform}`);
  try {
    const rulesMap = new Map<string, ApplicableRule>();

    // 1. Fetch Advertiser Default Rules (Product and Channel)
    const defaultRuleSetIds = [advertiser.default_product_rule_set_id, advertiser.default_channel_rule_set_id].filter(id => id) as string[];
    if (defaultRuleSetIds.length > 0) {
        const defaultSets = await prisma.rule_sets.findMany({
            where: { id: { in: defaultRuleSetIds } },
            include: {
                product_rule_sets: { include: { product_rules: true } },
                channel_rule_sets: { include: { channel_rules: true } },
            }
        });
        defaultSets.forEach(set => {
            set.product_rule_sets.forEach(prs => {
                if (prs.product_rules) {
                    rulesMap.set(prs.product_rules.id, {
                        ...prs.product_rules,
                        bypass_threshold: prs.product_rules.bypass_threshold?.toNumber() ?? null,
                        rule_type: 'product',
                    });
                }
            });
            set.channel_rule_sets.forEach(crs => {
                if (crs.channel_rules) {
                    const ruleApplies = !crs.channel_rules.applicable_channel || crs.channel_rules.applicable_channel.length === 0 || crs.channel_rules.applicable_channel.includes(contentPlatform);
                    if (ruleApplies) {
                        rulesMap.set(crs.channel_rules.id, {
                            ...crs.channel_rules,
                            bypass_threshold: crs.channel_rules.bypass_threshold?.toNumber() ?? null,
                            rule_type: 'channel',
                        });
                    }
                }
            });
        });
    }
    console.log(` -> Found ${rulesMap.size} rules from advertiser defaults.`);

    // 2. Fetch Product-Specific Rule Set Assignments
    const assignments = await prisma.product_rule_set_assignments.findMany({
      where: { product_id: productId },
      include: {
        rule_sets: {
          include: {
            product_rule_sets: { include: { product_rules: true } },
            channel_rule_sets: { include: { channel_rules: true } },
          },
        },
      },
    });

    // Add rules from product-specific sets (these implicitly override defaults if rule ID is the same)
    assignments.forEach(assignment => {
      assignment.rule_sets.product_rule_sets.forEach(prs => {
        if (prs.product_rules) {
          rulesMap.set(prs.product_rules.id, {
            ...prs.product_rules,
            bypass_threshold: prs.product_rules.bypass_threshold?.toNumber() ?? null,
            rule_type: 'product',
          });
        }
      });
      assignment.rule_sets.channel_rule_sets.forEach(crs => {
        if (crs.channel_rules) {
          const ruleApplies = !crs.channel_rules.applicable_channel || crs.channel_rules.applicable_channel.length === 0 || crs.channel_rules.applicable_channel.includes(contentPlatform);
          if (ruleApplies) {
            rulesMap.set(crs.channel_rules.id, {
              ...crs.channel_rules,
              bypass_threshold: crs.channel_rules.bypass_threshold?.toNumber() ?? null,
              rule_type: 'channel',
            });
          } else {
              // If a rule from a default set was added but doesn't apply here, remove it
              if (rulesMap.has(crs.channel_rules.id) && !crs.channel_rules.applicable_channel?.includes(contentPlatform)) {
                  rulesMap.delete(crs.channel_rules.id);
                  console.log(`   -> Removing default channel rule "${crs.channel_rules.name}" as it doesn't apply to platform "${contentPlatform}" in product-specific set.`);
              }
          }
        }
      });
    });
    console.log(` -> Found ${assignments.length} product-specific assignments. Total rules after assignments: ${rulesMap.size}`);


    // 3. Fetch and Apply Product-Specific Overrides
    const productRuleOverrides = await prisma.product_rule_overrides.findMany({
      where: { product_id: productId },
      include: { product_rules: true },
    });
    const channelRuleOverrides = await prisma.product_channel_rule_overrides.findMany({
      where: { product_id: productId },
      include: { channel_rules: true },
    });

    productRuleOverrides.forEach(override => {
      if (override.inclusion_type === 'exclude') {
        rulesMap.delete(override.product_rule_id);
      } else if (override.inclusion_type === 'include' && override.product_rules) {
        rulesMap.set(override.product_rule_id, {
          ...override.product_rules,
           bypass_threshold: override.product_rules.bypass_threshold?.toNumber() ?? null,
          rule_type: 'product',
        });
      }
    });
    channelRuleOverrides.forEach(override => {
      if (override.inclusion_type === 'exclude') {
        rulesMap.delete(override.channel_rule_id);
      } else if (override.inclusion_type === 'include' && override.channel_rules) {
         const ruleApplies = !override.channel_rules.applicable_channel || override.channel_rules.applicable_channel.length === 0 || override.channel_rules.applicable_channel.includes(contentPlatform);
         if (ruleApplies) {
            rulesMap.set(override.channel_rule_id, {
              ...override.channel_rules,
              bypass_threshold: override.channel_rules.bypass_threshold?.toNumber() ?? null,
              rule_type: 'channel',
            });
         } else {
             // Ensure it's removed if it was included by default but excluded by platform here
             rulesMap.delete(override.channel_rule_id);
         }
      }
    });

    const applicableRules = Array.from(rulesMap.values());
    console.log(`Found ${applicableRules.length} applicable product-context rules for product ID: ${productId} on platform ${contentPlatform}`);
    return applicableRules;

  } catch (error: any) {
    console.error(`Error fetching product-context rules for product ${productId}:`, error.message || error);
    return [];
  }
};

export const getAdvertiserGlobalRules = async (advertiserId: string, contentPlatform: string): Promise<ApplicableRule[]> => {
    // [Existing implementation unchanged]
    console.log(`Fetching global rules for Advertiser ID: ${advertiserId}, Platform: ${contentPlatform}`);
    try {
        const advertiser = await prisma.advertisers.findUnique({
            where: { id: advertiserId },
            include: {
                rule_sets_advertisers_global_rule_set_idTorule_sets: {
                    include: {
                        channel_rule_sets: {
                            include: {
                                channel_rules: true
                            }
                        }
                    }
                }
            }
        });

        if (!advertiser?.rule_sets_advertisers_global_rule_set_idTorule_sets) {
            console.log(`No global rule set found for advertiser ${advertiserId}.`);
            return [];
        }

        const globalRuleSet = advertiser.rule_sets_advertisers_global_rule_set_idTorule_sets;
        const globalRules: ApplicableRule[] = [];

        globalRuleSet.channel_rule_sets.forEach(crs => {
            if (crs.channel_rules) {
                // Filter channel rules based on platform
                const ruleApplies = !crs.channel_rules.applicable_channel ||
                                    crs.channel_rules.applicable_channel.length === 0 ||
                                    crs.channel_rules.applicable_channel.includes(contentPlatform);

                if (ruleApplies) {
                    globalRules.push({
                        ...crs.channel_rules,
                        bypass_threshold: crs.channel_rules.bypass_threshold?.toNumber() ?? null,
                        rule_type: 'channel',
                    });
                }
            }
        });

        console.log(`Found ${globalRules.length} applicable global rules for advertiser ${advertiserId} on platform ${contentPlatform}`);
        return globalRules;

    } catch (error: any) {
        console.error(`Error fetching global rules for advertiser ${advertiserId}:`, error.message || error);
        return [];
    }
};

// Keep prompt generation functions unchanged 
export const generateAnalysisPromptGeneric = (
  rules: ApplicableRule[],
  contentItem: content_items,
  analysisType: string,
  product?: products | null,
  // images parameter is kept in signature for compatibility, but not used in the new prompt logic
  images?: content_images[] | null
): string => {
  // Determine if title, caption, transcript exist
  const hasTitle = !!contentItem.title;
  const hasCaption = !!contentItem.caption;
  // Assuming transcript is structured data; format appropriately for the prompt
  // Using JSON.stringify as a placeholder; adjust if transcript format is different (e.g., array of strings)
  const transcriptText = contentItem.transcript ? JSON.stringify(contentItem.transcript, null, 2) : '';
  const hasTranscript = !!transcriptText && transcriptText !== '""' && transcriptText !== '[]'; // Check for non-empty transcript

  // Generate a list of applicable rules to include in the prompt
  const rulesTable = rules.map(rule => 
    `- "${rule.name}" (ID: ${rule.id}, Type: ${rule.rule_type}): ${rule.description}`
  ).join('\n');

  // Construct the prompt using the user's provided text, escaping internal backticks and dollar signs correctly
  const prompt = `You are an AI assistant analyzing content for compliance with specific rules.
Analysis Type: ${analysisType}

${product ? `This analysis is in the context of the product: "${product.name}" (ID: ${product.id}).\\nProduct Marketing Bullets: ${JSON.stringify(product.marketing_bullets)}\\n` : `This analysis is for general advertiser rules.\\n`}

${hasTitle ? `\\n--- TITLE START ---\\n${contentItem.title}\\n--- TITLE END ---\`` : ''}
${hasCaption ? `\\n--- DESCRIPTION_CAPTION START ---\\n${contentItem.caption}\\n--- DESCRIPTION_CAPTION END ---\`` : ''}
${hasTranscript ? `\\n--- TRANSCRIPT START ---\\n${transcriptText}\\n--- TRANSCRIPT END ---\`` : ''}

────────────────────────────────────────────────────────────
APPLICABLE RULES - YOU MUST ONLY USE THESE EXACT RULE IDs
────────────────────────────────────────────────────────────
${rulesTable}

IMPORTANT: When creating flags, you MUST use ONLY the exact rule IDs listed above. 
DO NOT create your own rule IDs or use descriptive names. Always use the exact ID
string from the database (e.g., "a1b2c3d4-5678-..." NOT "cashback_disclosure").
Creating a flag with an invalid rule ID will cause the flag to be DISCARDED.
────────────────────────────────────────────────────────────

PRODUCT–FEATURE MAPPING (perform before STEP 1)
────────────────────────────────────────────────────────────
1  Detect every product mention (full names, abbreviations, issuer-logo / card-art cues).

2  Harvest candidate features within ±5 sentences (text) or ±30 s (transcript):
   • any phrase with a numeric value (points, ×, %, $) **and**
     at least one token from the product's marketing bullets  
     (e.g. "33x dining" matches bullet "3× dining")  
   • phrases with known category words (dining, shipping, travel credit, etc.)  
   • issuer logo / card-art cues

3  Assign each feature to **one** product using this fuzzy scoring grid:  
     +2 full product name (partial, case-insensitive OK)  
     +2 short name / abbreviation (e.g. "Ink Preferred", "CSP")  
     +1 ≥ 1 bullet-token overlap  
     +1 numeric value matches bullet within ±1 step (for multipliers)  
     +1 issuer logo / card-art cue  
     −2 contradicts a known bullet (e.g. fee $0 vs required $95)

   • If both products score ≥ 4 pts → keep both.  
   • Else, if one leads by ≥ 3 pts → keep both, but cap the lower-score
     product's confidence ≤ 0.55 and note "lower-score product, possible mismatch".  
   • Otherwise keep both as normal.

4  Any feature still unclear → mark **ambiguous**; any rule that relies on an
   ambiguous feature must set \`confidence_score ≤ 0.60\` and add
   "Ambiguous feature mapping" in \`ai_confidence_reasoning\`.

Store this mapping internally—**do not output it**.
────────────────────────────────────────────────────────────

STEP 1 — Applicability  
• Apply each rule to features mapped to its product.  
• **Product-distance guard**: if a nearer cue belongs to another product
  (within ±1 sentence / ±5 s), set \`rule_applicability: not_applicable\`.  
• **Mixed-card sentence penalty**: if two card names occur in the same
  sentence / ±5 s, keep the rule applicable but subtract 0.15 (floor 0.50)
  from \`confidence_score\` and record "mixed-card sentence → −0.15".

STEP 2 — Compliance  
**Contextual Inference**  
• If a requirement is not literal but an explicit figure/phrase appears
  within ±2 sentences / ±10 s and clearly refers to the same product,
  treat as compliant, subtract 0.05–0.10 confidence, and explain.

TOOL — get_relevant_examples  
Call if \`confidence_score < 0.70\` **or** multiple products share the window.

OUTPUT FORMAT (one block **for every applicable rule**, compliant or violation)
--- FLAG_START ---
rule_id: [EXACT ID SHOWN IN APPLICABLE RULES SECTION ABOVE]
product_id: ${product ? product.id : "N/A"}
rule_applicability: applicable | not_applicable
content_source: TITLE | DESCRIPTION_CAPTION | TRANSCRIPT
ai_ruling: compliant | violation | tentative_violation
confidence_score: 0.00-1.00
ai_confidence_reasoning: …
context: …
evaluation: …
transcript_start_ms: …   # if TRANSCRIPT
transcript_end_ms: …
--- FLAG_END ---

Return **NO_FLAGS** only when *no rules are applicable at all*.

────────────────────────────────────────────────────────────
CONFIDENCE-SCORE GUIDELINES

| Score | Label          | Guidance                                    |
|-------|----------------|---------------------------------------------|
| 1.00  | ABSOLUTE-LOCK  | Reviewer could not rationally overturn.     |
| 0.90-0.99 | Certain    | Direct, unambiguous evidence.               |
| 0.70-0.89 | Likely     | Strong signal; minor doubt.                 |
| 0.50-0.69 | Lean       | Mixed cues.                                 |
| 0.30-0.49 | Doubtful   | Weak/conflicting cues.                      |
| 0.00-0.29 | Clear-OK   | Evident compliance / rule not triggered.    |

Baselines → Certain 0.93, Likely 0.80, Lean 0.60, Doubtful 0.40, Clear-OK 0.15.  
Adjust ±0.02-0.04 per extra/missing clue; show the math in \`ai_confidence_reasoning\`.  
Use at least three distinct numbers inside each band per 100 flags.`;

  return prompt;
};

// Function to convert generative AI parts to Vertex AI parts
const convertToVertexAIParts = (parts: any[]): Part[] => {
    // Create a new array of Vertex AI Part objects
    return parts.map(part => {
        // If the part has text, return a text part
        if (part.text !== undefined) {
            return { text: part.text } as Part;
        }
        // If it has a function call, we need to handle it differently
        // Since function calls are handled specifically, we'll use a simple text part as placeholder
        return { text: "Function call placeholder" } as Part;
    });
};

// Updated model interaction function to work with the wrapper service
export const callTextAnalysisModelWithLibrarianTool = async (
    modelName: string,
    initialRequest: GenerateContentRequest,
    loggingContext: aiCallWrapperService.LoggingContext,
    correlationId?: string,
    generationConfig?: aiCallWrapperService.AiCallParams['generationConfig'] // Added generationConfig
): Promise<{ responseText: string | null; librarianConsulted: boolean; librarianExamplesProvided: boolean }> => {
    // Implementation updated to work with wrapper service
    const effectiveCorrelationId = correlationId || uuidv4();
    let history = [...initialRequest.contents];
    let librarianConsulted = false;
    let librarianExamplesProvided = false;

    try {
        // Make the initial call using the wrapper
        console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Making initial AI call...`);
        
        // Convert parts to Vertex AI format
        const vertexParts = convertToVertexAIParts(initialRequest.contents.flatMap(c => c.parts));
        
        // Build appropriate parameter structure for the wrapper service
        const initialCallParams: aiCallWrapperService.AiCallParams = {
            modelName: modelName,
            parts: vertexParts,
            safetySettings: initialRequest.safetySettings as SafetySetting[],
            tools: initialRequest.tools,
            generationConfig: generationConfig // Pass generationConfig
        };
        
        const result = await aiCallWrapperService.callGenerativeModelWithLogging(
            initialCallParams,
            {
                serviceName: loggingContext.serviceName,
                actionName: `${loggingContext.actionName}_initial`,
                relatedContext: typeof loggingContext.relatedContext === 'object' && loggingContext.relatedContext !== null
                                ? { ...loggingContext.relatedContext, correlationId: effectiveCorrelationId }
                                : { correlationId: effectiveCorrelationId }
            }
        );
        
        console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Initial AI call completed.`);

        // Check for function calls in the WrapperResult structure
        const functionCalls = result?.functionCalls;

        // Check if functionCalls exists and is an array with elements
        if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
            const functionCall = functionCalls[0];
            console.log(`Function calls received: ${functionCalls.length}`);
            console.log(`Function call name: ${functionCall.name}`);
            
            if (functionCall.name === 'get_relevant_examples') {
                librarianConsulted = true;
                console.log(`AI requested Librarian tool. Args:`, JSON.stringify(functionCall.args));

                // Safely extract args
                const { ruleId, ruleVersion, currentContextSnippet } = functionCall.args ?? {};

                if (!ruleId || !ruleVersion || !currentContextSnippet) {
                    console.error("AI Librarian tool call missing required arguments.");
                    return { 
                        responseText: result?.text ?? null, 
                        librarianConsulted, 
                        librarianExamplesProvided: false 
                    };
                }

                // Execute the Librarian function
                const examples: RelevantExample[] = await findRelevantExamples(ruleId, ruleVersion, currentContextSnippet);
                librarianExamplesProvided = examples.length > 0;
                console.log(`Librarian provided ${examples.length} examples.`);

                // Prepare examples for the AI response
                const exampleText = examples.length > 0
                    ? examples.map((ex, i) =>
                        `Example ${i + 1}:\nContext: ${ex.contextText}\nHuman Verdict: ${ex.humanVerdict}\nSelection Reason: ${ex.selectionReason}\n---`
                      ).join('\n')
                    : "No relevant examples found by the Librarian.";

                // Send the examples back to the AI
                const functionResponsePart: FunctionResponsePart = {
                    functionResponse: {
                        name: 'get_relevant_examples',
                        response: { examples: exampleText },
                    },
                };

                // Add the model's call and our response to history
                // Ensure parts are correctly structured
                history.push({ role: 'model', parts: [{ functionCall }] });
                history.push({ role: 'function', parts: [functionResponsePart] });

                // Build the request for the second call, including history
                const followUpRequest: GenerateContentRequest = {
                    contents: history,
                    tools: initialRequest.tools,
                    safetySettings: initialRequest.safetySettings
                };

                console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Sending Librarian results back to AI...`);
                
                // Convert parts to Vertex AI format for the follow-up call
                const followUpVertexParts = convertToVertexAIParts(followUpRequest.contents.flatMap(c => c.parts));
                
                // Make the follow-up call using the wrapper with the correct parameter structure
                const followUpCallParams: aiCallWrapperService.AiCallParams = {
                    modelName: modelName,
                    parts: followUpVertexParts,
                    safetySettings: followUpRequest.safetySettings as SafetySetting[],
                    tools: followUpRequest.tools,
                    generationConfig: generationConfig // Pass generationConfig
                };
                
                const followUpResult = await aiCallWrapperService.callGenerativeModelWithLogging(
                    followUpCallParams,
                    {
                        serviceName: loggingContext.serviceName,
                        actionName: `${loggingContext.actionName}_followup`,
                        relatedContext: typeof loggingContext.relatedContext === 'object' && loggingContext.relatedContext !== null
                                        ? { ...loggingContext.relatedContext, correlationId: effectiveCorrelationId }
                                        : { correlationId: effectiveCorrelationId }
                    }
                );
                
                console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Second AI call completed.`);
                
                // Return the response text from the follow-up call
                return { 
                    responseText: followUpResult?.text ?? null,
                    librarianConsulted,
                    librarianExamplesProvided
                };
            } else {
                console.warn(`AI requested unknown function: ${functionCall.name}`);
                // If it's an unknown function, return the initial result
                return { 
                    responseText: result?.text ?? null,
                    librarianConsulted,
                    librarianExamplesProvided
                };
            }
        }

        // If no function calls, return the initial result
        return { 
            responseText: result?.text ?? null,
            librarianConsulted,
            librarianExamplesProvided
        };
    } catch (error: any) {
        console.error(`Error during AI model interaction:`, error.message || error);
        return { responseText: null, librarianConsulted, librarianExamplesProvided };
    }
};

// Export the main entry point to forward to the parallel implementation
export const analyzeContentItemForFlags = async (
    contentItemId: string,
    scanJobId: string,
    productIds: string[] = [],
    options: any = {}
): Promise<{
    flagCount: number;
    violationCount: number;
    productAnalysisCount?: number;
    globalAnalysisPerformed?: boolean;
}> => {
    console.log(`Starting analysis for content item ${contentItemId} - Using parallel implementation`);
    
    // Forward to the parallel implementation with all parameters
    try {
        // Import and call the parallel implementation with the correct parameter signature
        const { analyzeContentItemForFlags: analyzeParallel } = await import('./aiAnalysisServiceParallel');
        return analyzeParallel(contentItemId, scanJobId, productIds, options);
    } catch (error: any) {
        console.error(`Error forwarding to parallel implementation:`, error.message || error);
        throw error;
    }
};
