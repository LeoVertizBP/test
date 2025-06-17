// Consolidate imports and add missing types
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    Part,
    SchemaType, // Correct enum for schema types
    FunctionDeclaration,
    GenerateContentResult, // Correct type for the result object
    GenerateContentRequest,
    Content,
    FunctionResponsePart,
    FunctionCall,
} from "@google/generative-ai";
import dotenv from 'dotenv';
import prisma from '../utils/prismaClient';
// Correctly import types AND enums using the names defined in the schema
import { content_items, products, product_rules, channel_rules, flags, content_images, advertisers, FlagStatus, HumanVerdict, ResolutionMethod } from '../../generated/prisma'; // Added advertisers
import { downloadFileFromGCSAsBuffer, getGcsUriFromHttpsUrl } from './gcsService';
import { findRelevantExamples, RelevantExample } from './aiLibrarianService'; // This will be refactored later
import * as aiCallWrapperService from './aiCallWrapperService'; // Import the wrapper service
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

// Load environment variables from .env file
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in the environment variables.");
}

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(apiKey);
// Use 1.5 Pro for analysis model as well, as Flash function calling can be less reliable
const analysisModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const videoModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Keep Pro for video

// --- Tool Definition for AI Librarian ---
export const GetRelevantExamplesTool: FunctionDeclaration = { // <-- EXPORT ADDED
    name: "get_relevant_examples",
    description: "Fetches relevant, human-reviewed past examples for a specific compliance rule to provide context for the current analysis. Call this if you are uncertain about the analysis, lack confidence, or believe examples would clarify the rule's application in the current context.",
    parameters: {
        type: SchemaType.OBJECT, // Using correct SchemaType enum
        properties: {
            ruleId: { type: SchemaType.STRING, description: "The ID of the compliance rule you need examples for." }, // Using correct SchemaType enum
            ruleVersion: { type: SchemaType.STRING, description: "The version string of the rule being applied." }, // Using correct SchemaType enum
            currentContextSnippet: { type: SchemaType.STRING, description: "A brief snippet (e.g., 1-2 sentences) of the specific text or description of the image/video content currently being analyzed for this rule." } // Using correct SchemaType enum
        },
        required: ["ruleId", "ruleVersion", "currentContextSnippet"]
    }
};

// Define types for clarity
export interface ApplicableRule { // <-- EXPORT ADDED
  id: string;
  name: string;
  description: string;
  manual_text?: string | null;
  rule_type: 'product' | 'channel'; // To distinguish rule types
  bypass_threshold?: number | null; // Added bypass threshold
  version: string; // Made version non-optional as it exists in schema
  applicable_channel?: string[]; // Added for channel rules
}

interface AIFlagOutput {
  rule_id?: string; // Make potentially optional during parsing
  product_id?: string | null; // Make optional, as global rules don't have a product context
  context?: string; // Make potentially optional during parsing
  content_source?: string; // Added: TITLE, DESCRIPTION_CAPTION, TRANSCRIPT, IMAGE, VIDEO
  transcript_start_ms?: number | null; // Added: Start time in ms for TRANSCRIPT source
  transcript_end_ms?: number | null; // Added: End time in ms for TRANSCRIPT source
  ai_ruling?: string | null; // Make potentially optional during parsing
  ai_confidence_reasoning?: string | null;
  confidence_score?: number;
  evaluation?: string;
  image_index?: number | null;
  video_reference_id?: string | null;
}

/**
 * Fetches the applicable rules (product and channel) for a given product ID and content platform.
 * Includes advertiser default rules and product-specific overrides.
 * Filters channel rules by platform.
 * @param productId The ID of the product.
 * @param advertiser The Advertiser object (including default rule set IDs).
 * @param contentPlatform The platform of the content being analyzed (e.g., 'Instagram', 'TikTok').
 */
export const getProductContextRules = async (productId: string, advertiser: advertisers, contentPlatform: string): Promise<ApplicableRule[]> => { // <-- EXPORT ADDED
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

/**
 * Fetches the applicable global channel rules for a given advertiser ID and content platform.
 * Filters channel rules by platform.
 * @param advertiserId The ID of the advertiser.
 * @param contentPlatform The platform of the content being analyzed (e.g., 'Instagram', 'TikTok').
 */
export const getAdvertiserGlobalRules = async (advertiserId: string, contentPlatform: string): Promise<ApplicableRule[]> => { // <-- EXPORT ADDED
    console.log(`Fetching global rules for Advertiser ID: ${advertiserId}, Platform: ${contentPlatform}`);
    try {
        const advertiser = await prisma.advertisers.findUnique({
            where: { id: advertiserId },
            include: {
                rule_sets_advertisers_global_rule_set_idTorule_sets: { // Use the correct relation name
                    include: {
                        channel_rule_sets: {
                            include: {
                                channel_rules: true // Include the actual rule details
                            }
                        }
                        // We likely don't need product rules in a global set, but could add if needed
                        // product_rule_sets: { include: { product_rules: true } }
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
                const ruleApplies = !crs.channel_rules.applicable_channel || // Rule applies if array is null/undefined (should be [] now)
                                    crs.channel_rules.applicable_channel.length === 0 || // Rule applies if array is empty
                                    crs.channel_rules.applicable_channel.includes(contentPlatform); // Rule applies if platform is in array

                if (ruleApplies) {
                    globalRules.push({
                        ...crs.channel_rules,
                        bypass_threshold: crs.channel_rules.bypass_threshold?.toNumber() ?? null,
                        rule_type: 'channel', // Explicitly set type
                    });
                }
            }
        });

        // Add logic here if global sets could contain product_rules (unlikely based on description)

        console.log(`Found ${globalRules.length} applicable global rules for advertiser ${advertiserId} on platform ${contentPlatform}`);
        return globalRules;

    } catch (error: any) {
        console.error(`Error fetching global rules for advertiser ${advertiserId}:`, error.message || error);
        return [];
    }
};


/**
 * Generates the prompt for the Gemini AI based on the content and applicable rules (generic version).
 * Includes instructions for the Librarian tool.
 * @param rules The list of rules (product or channel) to check against.
 * @param contentItem The content item being analyzed.
 * @param analysisType A string indicating the type of analysis (e.g., "Advertiser Global", "Product Specific").
 * @param product Optional product context for product-specific analysis.
 * @param images Optional array of associated images/videos for context checking.
 */
export const generateAnalysisPromptGeneric = ( // <-- EXPORT ADDED
  rules: ApplicableRule[],
  contentItem: content_items,
  analysisType: string,
  product?: products | null, // Make product optional
  images?: content_images[] | null // Add images array argument
): string => {
  // Check if we have any content to analyze
  const hasTitle = !!contentItem.title;
  const hasCaption = !!contentItem.caption;
  const hasTranscript = !!contentItem.transcript && Array.isArray(contentItem.transcript) && contentItem.transcript.length > 0;
  const hasImages = images && images.length > 0; // Keep this check for context, but don't use it to skip text analysis
  
  // Skip if no TEXT content at all
  if (!hasTitle && !hasCaption && !hasTranscript) {
      // If there are images/videos, we might still proceed with image/video analysis later,
      // but for *this* text prompt generation, there's nothing to include.
      // However, the main function `analyzeContentItemForFlags` handles image/video separately.
      // So, if there's no text, we return an empty string *for the text prompt*.
      console.log(`[generateAnalysisPromptGeneric] No text content (title, caption, transcript) found for content item ${contentItem.id}. Returning empty text prompt.`);
      return '';
  }

  let prompt = `You are an AI assistant analyzing content for compliance with specific rules.
  Analysis Type: ${analysisType}
  `;

  if (product) {
      prompt += `The content is being analyzed in the context of the product: "${product.name}" (ID: ${product.id}).\n`;
      prompt += `Product Marketing Bullets for context: ${JSON.stringify(product.marketing_bullets)}\n`;
  } else {
      prompt += `The content is being analyzed for general advertiser rules, independent of any specific product mention.\n`;
  }

  // Add title if available
  if (hasTitle) {
      prompt += `\n--- TITLE START ---\n${contentItem.title}\n--- TITLE END ---\n`;
  }

  // Add caption/description if available
  if (hasCaption) {
      prompt += `\n--- DESCRIPTION_CAPTION START ---\n${contentItem.caption}\n--- DESCRIPTION_CAPTION END ---\n`;
  }

  // Add transcript if available (now in structured format)
  if (hasTranscript && Array.isArray(contentItem.transcript)) {
      prompt += `\n--- TRANSCRIPT START ---\n`;
      // Use type assertion to tell TypeScript that transcript is an array of segment objects
      (contentItem.transcript as Array<{ startMs: number, endMs: number, text: string }>).forEach(segment => {
          // Format timestamp as MM:SS
          const startSec = Math.floor(segment.startMs / 1000);
          const startMin = Math.floor(startSec / 60);
          const startRemainingSec = startSec % 60;
          const formattedStart = `${startMin.toString().padStart(2, '0')}:${startRemainingSec.toString().padStart(2, '0')}`;
          
          prompt += `[${formattedStart}] ${segment.text}\n`;
      });
      prompt += `--- TRANSCRIPT END ---\n`;
  }

  // If no text content, indicate we're only analyzing images/videos
  if (!hasTitle && !hasCaption && !hasTranscript) {
      prompt += `\nAnalyze the associated image/video content (provided separately).\n`;
  }


  prompt += `\nReview the content against ONLY the following compliance rules. For each rule, determine if the content is compliant or a violation.

  Rules to check:
  `;
  rules.forEach(rule => {
    prompt += `--- Rule Start ---\n`;
    prompt += `Rule ID: ${rule.id}\nRule Version: ${rule.version}\nName: ${rule.name}\nDescription: ${rule.description}\n`;
    if (rule.manual_text) prompt += `Details: ${rule.manual_text}\n`;
    prompt += `--- Rule End ---\n`;
  });

  prompt += `
  TOOL AVAILABLE: You have access to a tool called 'get_relevant_examples'.
  WHEN TO USE: If, for a specific rule, you are uncertain about your analysis, lack confidence, or believe reviewing past human-verified examples for that rule would significantly improve your accuracy or reasoning for this specific content, you MAY call this tool. Provide the rule ID, rule version, and a brief snippet/description of the content you are currently evaluating for that rule.
  Do NOT call the tool if you are confident in your analysis.

  OUTPUT FORMAT: Respond ONLY with potential flags using the following delimited format. Repeat the block for each flag found (even if compliant). If no flags are found for any rule, return "NO_FLAGS".
  --- FLAG_START ---
  rule_id: [The Rule ID found]
product_id: ${product ? product.id : 'N/A'}
content_source: [TITLE, DESCRIPTION_CAPTION, TRANSCRIPT, IMAGE, or VIDEO - where the flag was found]
ai_ruling: [compliant OR violation]
confidence_score: [Confidence score 0.00-1.00]
ai_confidence_reasoning: [Brief explanation for the confidence score level]
context: [For text violations: The exact text snippet that triggered the flag. For image/video violations: Describe the visual/audio element.]
evaluation: [Brief reasoning for the ruling (compliant/violation)]
`;

  // Add transcript timestamp fields only if we're analyzing a transcript
  if (hasTranscript) {
    prompt += `transcript_start_ms: [For TRANSCRIPT source only: Start time in milliseconds, e.g., 15000 for 15 seconds]
transcript_end_ms: [For TRANSCRIPT source only: End time in milliseconds, e.g., 18000 for 18 seconds]
`;
  }

  prompt += `--- FLAG_END ---
  `;
  return prompt;
};

// --- Prompts for Image/Video remain largely the same, but will be called by the new analysis flow ---

/**
 * Generates the prompt for the Gemini AI for VIDEO analysis based on the product and applicable rules.
 * Includes instructions for the Librarian tool.
 */
const generateVideoAnalysisPrompt = (
  rules: ApplicableRule[],
  analysisType: string, // Added analysis type
  product?: products | null, // Make product optional
  video?: content_images // Assuming video info is stored similarly to images
): string => {
  let prompt = `You are an AI assistant analyzing video content for compliance with specific rules.
  Analysis Type: ${analysisType}
  Analyze the provided video content frame by frame.
  `;
  if (product) {
      prompt += `The video is being analyzed in the context of the product: "${product.name}" (ID: ${product.id}).\n`;
      prompt += `Product Marketing Bullets for context: ${JSON.stringify(product.marketing_bullets)}\n`;
  } else {
       prompt += `The video is being analyzed for general advertiser rules, independent of any specific product mention.\n`;
  }

  prompt += `\nReview the video content against ONLY the following compliance rules. Identify specific visual elements, spoken words (if transcribed by the model), or scenes that require review.

  Rules to check:
  `;
  rules.forEach(rule => {
    prompt += `--- Rule Start ---\n`;
    prompt += `Rule ID: ${rule.id}\nRule Version: ${rule.version}\nName: ${rule.name}\nDescription: ${rule.description}\n`;
    if (rule.manual_text) prompt += `Details: ${rule.manual_text}\n`;
    prompt += `--- Rule End ---\n`;
  });

   prompt += `

TOOL AVAILABLE: You have access to a tool called 'get_relevant_examples'.
WHEN TO USE: If, for a specific rule, you are uncertain about your analysis of the video, lack confidence, or believe reviewing past human-verified examples for that rule would significantly improve your accuracy or reasoning for this specific video content, you MAY call this tool. Provide the rule ID, rule version, and a brief description of the video segment or element you are currently evaluating for that rule.
Do NOT call the tool if you are confident in your analysis.

OUTPUT FORMAT: Respond ONLY with potential flags using the following delimited format. Repeat the block for each flag found in the video. If no flags are found, return "NO_FLAGS".
--- FLAG_START ---
rule_id: [The Rule ID found]
product_id: ${product ? product.id : 'N/A'}
content_source: VIDEO
ai_ruling: [compliant OR violation]
confidence_score: [Confidence score 0.00-1.00]
ai_confidence_reasoning: [Brief explanation for the confidence score level]
context: [Description of the relevant visual element, scene, or spoken content requiring review, ideally with approximate timestamp if possible]
evaluation: [Brief reasoning for the ruling (compliant/violation)]
--- FLAG_END ---
`;
  return prompt;
};


/**
 * Generates the prompt for the Gemini AI for IMAGE analysis based on the product and applicable rules.
 * Includes instructions for the Librarian tool.
 */
const generateImageAnalysisPrompt = (
  rules: ApplicableRule[],
  analysisType: string, // Added analysis type
  product?: products | null, // Make product optional
  image?: content_images // Pass image object
): string => {
  let prompt = `You are an AI assistant analyzing an image for compliance with specific rules.
  Analysis Type: ${analysisType}
  Analyze the provided image.
  `;
  if (product) {
      prompt += `The image is being analyzed in the context of the product: "${product.name}" (ID: ${product.id}).\n`;
      prompt += `Product Marketing Bullets for context: ${JSON.stringify(product.marketing_bullets)}\n`;
  } else {
       prompt += `The image is being analyzed for general advertiser rules, independent of any specific product mention.\n`;
  }

  prompt += `\nReview the image against ONLY the following compliance rules. Identify specific visual elements or aspects that require review.

  Rules to check:
  `;
  rules.forEach(rule => {
    prompt += `--- Rule Start ---\n`;
    prompt += `Rule ID: ${rule.id}\nRule Version: ${rule.version}\nName: ${rule.name}\nDescription: ${rule.description}\n`;
    if (rule.manual_text) prompt += `Details: ${rule.manual_text}\n`;
    prompt += `--- Rule End ---\n`;
  });

   prompt += `
  TOOL AVAILABLE: You have access to a tool called 'get_relevant_examples'.
  WHEN TO USE: If, for a specific rule, you are uncertain about your analysis of the image, lack confidence, or believe reviewing past human-verified examples for that rule would significantly improve your accuracy or reasoning for this specific image content, you MAY call this tool. Provide the rule ID, rule version, and a brief description of the image element you are currently evaluating for that rule.
  Do NOT call the tool if you are confident in your analysis.

  OUTPUT FORMAT: Respond ONLY with potential flags using the following delimited format. Repeat the block for each flag found in the image. If no flags are found, return "NO_FLAGS".
  --- FLAG_START ---
  rule_id: [The Rule ID found]
product_id: ${product ? product.id : 'N/A'}
content_source: IMAGE
ai_ruling: [compliant OR violation]
confidence_score: [Confidence score 0.00-1.00]
ai_confidence_reasoning: [Brief explanation for the confidence score level]
context: [Description of the relevant visual element or aspect requiring review]
  evaluation: [Brief reasoning for the ruling (compliant/violation)]
  --- FLAG_END ---
  `;
  return prompt;
};

/**
 * Parses a delimited flag block from AI response. Handles multi-line values.
 */
const parseFlagBlock = (block: string, defaultProductId: string | null = null): Partial<AIFlagOutput> | null => { // Allow optional default product ID
    if (!block || block.trim() === '') return null;

    const flagData: Partial<AIFlagOutput> = { product_id: defaultProductId }; // Use default if provided
    // Use a regex to handle keys and potentially multi-line values more robustly
    const lines = block.trim().split('\n');
    let currentKey: keyof AIFlagOutput | null = null;

    for (const line of lines) {
        const match = line.match(/^([a-zA-Z_]+):\s*(.*)/); // Match "key: value"
        if (match) {
            const key = match[1].trim() as keyof AIFlagOutput;
            const value = match[2].trim();
            currentKey = null; // Reset current key when a new key is found

            switch (key) {
                case 'rule_id': flagData.rule_id = value; break;
                case 'product_id': // Allow AI to override default if it specifies N/A or an ID
                    flagData.product_id = (value.toUpperCase() === 'N/A') ? null : value;
                    break;
                case 'content_source': 
                    // Validate content_source is one of the allowed values
                    const validSources = ['TITLE', 'DESCRIPTION_CAPTION', 'TRANSCRIPT', 'IMAGE', 'VIDEO'];
                    flagData.content_source = validSources.includes(value.toUpperCase()) ? value.toUpperCase() : 'DESCRIPTION_CAPTION';
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
                default: console.warn(`Unknown key found in flag block: ${key}`);
            }
        } else if (currentKey && flagData[currentKey]) {
            // If it's not a key-value line, append to the current multi-line key
            (flagData[currentKey] as string) += '\n' + line.trim(); // Type assertion needed here
        }
    }

    // Trim potential leading/trailing whitespace from multi-line fields after loop
    if (flagData.context) flagData.context = flagData.context.trim();
    if (flagData.evaluation) flagData.evaluation = flagData.evaluation.trim();
    if (flagData.ai_confidence_reasoning) flagData.ai_confidence_reasoning = flagData.ai_confidence_reasoning.trim();

    // If content_source is not provided, try to infer it
    if (!flagData.content_source) {
        // Default to DESCRIPTION_CAPTION if we can't determine
        flagData.content_source = 'DESCRIPTION_CAPTION';
        
        // If transcript timestamps are provided, it's likely a transcript
        if (flagData.transcript_start_ms || flagData.transcript_end_ms) {
            flagData.content_source = 'TRANSCRIPT';
        }
        
        // Try to infer from context if it contains a timestamp pattern like "00:15:30 -->"
        if (flagData.context && /\d{2}:\d{2}:\d{2}.*-->/.test(flagData.context)) {
            flagData.content_source = 'TRANSCRIPT';
            
            // Try to extract timestamp and convert to milliseconds if not already provided
            if (!flagData.transcript_start_ms) {
                const timeMatch = flagData.context.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseInt(timeMatch[3]);
                    flagData.transcript_start_ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
                }
            }
        }
    }

    // Basic validation - product_id is now optional for global rules
    if (flagData.rule_id && flagData.context && flagData.ai_ruling) {
        return flagData;
    } else {
        console.warn("Skipping partially parsed flag block (missing required fields like rule_id, context, ai_ruling):", JSON.stringify(flagData));
        console.warn("Original block was:\n", block);
        return null;
    }
};


/**
 * Handles the interaction loop with the Gemini text analysis model, including function calling for the Librarian.
 * Uses the aiCallWrapperService for making AI calls and logging usage.
 * @param modelName The name of the generative model to use (e.g., "gemini-1.5-pro").
 * @param initialRequest The initial request object for the AI model.
 * @param loggingContext Context for logging (serviceName, actionName, relatedContext).
 * @param correlationId Optional correlation ID to link related log entries.
 */
export const callTextAnalysisModelWithLibrarianTool = async ( // <-- EXPORT ADDED
    modelName: string,
    initialRequest: GenerateContentRequest,
    loggingContext: aiCallWrapperService.LoggingContext, // Use type from wrapper
    correlationId?: string // ADDED correlationId parameter
): Promise<{ responseText: string | null; librarianConsulted: boolean; librarianExamplesProvided: boolean }> => {

    const effectiveCorrelationId = correlationId || uuidv4(); // Generate if not provided
    let history = [...initialRequest.contents]; // Start history with the initial prompt
    let librarianConsulted = false;
    let librarianExamplesProvided = false;
    // let history = [...initialRequest.contents]; // REMOVED DUPLICATE
    // let librarianConsulted = false; // REMOVED DUPLICATE
    // let librarianExamplesProvided = false; // REMOVED DUPLICATE
    let result: GenerateContentResult | null = null; // Wrapper returns null on error

    try {
        // Make the initial call using the wrapper
        console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Making initial AI call...`);
        result = await aiCallWrapperService.callGenerativeModelWithLogging(
            { // AI Call Params
                modelName: modelName,
                prompt: initialRequest.contents.flatMap(c => c.parts), // Extract parts for the prompt
                safetySettings: initialRequest.safetySettings,
                // generationConfig: initialRequest.generationConfig, // Pass if needed
                // tools are handled separately for function calling flow
            },
            { // Logging Context for this specific call
                serviceName: loggingContext.serviceName,
                actionName: `${loggingContext.actionName}_initial`, // Append suffix for clarity
                // Safely merge correlationId into relatedContext
                relatedContext: typeof loggingContext.relatedContext === 'object' && loggingContext.relatedContext !== null
                                ? { ...loggingContext.relatedContext, correlationId: effectiveCorrelationId }
                                : { correlationId: effectiveCorrelationId }
            }
        );
        console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Initial AI call completed.`);

        // Check for function call request safely - ADD NULL CHECK FOR RESULT
        const response = result?.response; // Use optional chaining as result can be null
        const functionCalls = response?.functionCalls; // Use optional chaining

        // Check if functionCalls exists and is an array with elements
        if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
            const functionCall = functionCalls[0]; // Now safe to access index 0
            console.log(`Function calls received: ${functionCalls.length}`); // Debug log
            console.log(`Function call name: ${functionCall.name}`); // Debug log
            if (functionCall.name === 'get_relevant_examples') {
                librarianConsulted = true;
                console.log(`AI requested Librarian tool. Args:`, JSON.stringify(functionCall.args));

                // Safely extract args
                const { ruleId, ruleVersion, currentContextSnippet } = functionCall.args ?? {};

                 if (!ruleId || !ruleVersion || !currentContextSnippet) {
                      console.error("AI Librarian tool call missing required arguments.");
                      // Handle missing args - return initial response text (check if result is null first)
                      return { responseText: result ? (result.response?.text() ?? null) : null, librarianConsulted, librarianExamplesProvided: false };
                 }

                 // Execute the Librarian function
                const examples: RelevantExample[] = await findRelevantExamples(ruleId, ruleVersion, currentContextSnippet);
                librarianExamplesProvided = examples.length > 0;
                console.log(`Librarian provided ${examples.length} examples.`); // Debug log

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
                // Make the follow-up call using the wrapper
                result = await aiCallWrapperService.callGenerativeModelWithLogging(
                    { // AI Call Params
                        modelName: modelName,
                        prompt: followUpRequest.contents.flatMap(c => c.parts), // Pass updated history
                        safetySettings: followUpRequest.safetySettings,
                        // tools: followUpRequest.tools // Pass tools if needed for follow-up
                    },
                    { // Logging Context for this specific call
                        serviceName: loggingContext.serviceName,
                        actionName: `${loggingContext.actionName}_followup`, // Append suffix
                        // Safely merge correlationId into relatedContext
                        relatedContext: typeof loggingContext.relatedContext === 'object' && loggingContext.relatedContext !== null
                                        ? { ...loggingContext.relatedContext, correlationId: effectiveCorrelationId }
                                        : { correlationId: effectiveCorrelationId }
                    }
                );
                console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Second AI call completed.`);

            } else {
                console.warn(`AI requested unknown function: ${functionCall.name}`);
                // If it's an unknown function, we don't proceed with a follow-up call
            }
        }
    } catch (error: any) {
         console.error(`Error during callGenerativeModelWithTool interaction:`, error.message || error);
         // Handle error appropriately, maybe return null responseText
         return { responseText: null, librarianConsulted, librarianExamplesProvided };
    }


    // Process the final response (either from initial call or after function call)
    // ADD NULL CHECK FOR RESULT ITSELF before accessing response
    const finalResponse = result?.response;
    const finalApiResponseText = result ? (finalResponse?.text() ?? null) : null; // Check result before accessing response.text()

    // Token usage is now logged automatically by the wrapper service for each call.
    // We no longer need to log it manually here.
    console.log(`[${loggingContext.serviceName}/${loggingContext.actionName}] Final response processed.`);

    return { responseText: finalApiResponseText, librarianConsulted, librarianExamplesProvided };
};


/**
 * Processes the AI response, parses flags, and saves them to the database.
 * @param aiResponseText The text response from the AI model.
 * @param rules The list of rules that were evaluated.
 * @param contentItemId The ID of the content item analyzed.
 * @param flagSource The source of the flag (e.g., 'ai_text', 'ai_image').
 * @param librarianConsulted Whether the librarian tool was consulted.
 * @param librarianExamplesProvided Whether the librarian provided examples.
 * @param imageOrVideoRefId Optional ID of the specific image/video if applicable.
 * @param defaultProductId Optional product ID for context (used if AI doesn't specify).
 */
export const processAndSaveFlags = async ( // <-- EXPORT ADDED
    aiResponseText: string | null,
    rules: ApplicableRule[],
    contentItemId: string,
    flagSource: 'ai_text' | 'ai_image' | 'ai_video',
    librarianConsulted: boolean,
    librarianExamplesProvided: boolean,
    imageOrVideoRefId: string | null = null,
    defaultProductId: string | null = null // Pass default product ID
): Promise<void> => {
    if (!aiResponseText) {
        console.log(`No AI response text received for ${flagSource} analysis of content item ${contentItemId}. No flags created.`);
        return;
    }

    let potentialFlags: AIFlagOutput[] = [];
    try {
        if (aiResponseText.toUpperCase().trim() !== 'NO_FLAGS') {
            const flagBlocks = aiResponseText.split('--- FLAG_START ---');
            for (const block of flagBlocks) {
                if (!block || block.trim() === '') continue;
                const cleanBlock = block.split('--- FLAG_END ---')[0];
                // Pass defaultProductId to parser
                const parsedFlag = parseFlagBlock(cleanBlock, defaultProductId);
                if (parsedFlag) {
                    potentialFlags.push(parsedFlag as AIFlagOutput);
                }
            }
        }
        console.log(`Parsed ${potentialFlags.length} potential ${flagSource} flags from Gemini response for content item ${contentItemId}.`);

        for (const flagData of potentialFlags) {
            if (!flagData.rule_id) {
                console.warn("Parsed flag data missing rule_id. Skipping flag creation:", JSON.stringify(flagData));
                continue;
            }
            try {
                const rule = rules.find(r => r.id === flagData.rule_id);
                if (!rule) {
                    console.warn(`Rule with ID ${flagData.rule_id} not found in applicable rules for this analysis pass. Skipping flag creation.`);
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
                        console.log(` -> Auto-setting status to REMEDIATING for rule ${flagData.rule_id} (Confidence: ${confidenceScore}, Threshold: ${bypassThreshold})`);
                    } else if (flagData.ai_ruling === 'compliant') {
                        initialStatus = FlagStatus.CLOSED;
                        resolutionMethod = ResolutionMethod.AI_AUTO_CLOSE;
                        autoNote = `Status automatically set to CLOSED by AI (Confidence: ${confidenceScore.toFixed(2)}, Threshold: ${bypassThreshold.toFixed(2)}).`;
                        console.log(` -> Auto-setting status to CLOSED for rule ${flagData.rule_id} (Confidence: ${confidenceScore}, Threshold: ${bypassThreshold})`);
                    }
                }

                // Determine content_source if it's an image or video flag
                if (flagSource === 'ai_image' && (!flagData.content_source || flagData.content_source === 'DESCRIPTION_CAPTION')) {
                    flagData.content_source = 'IMAGE';
                } else if (flagSource === 'ai_video' && (!flagData.content_source || flagData.content_source === 'DESCRIPTION_CAPTION')) {
                    flagData.content_source = 'VIDEO';
                }

                // Ensure content_source is set (default to DESCRIPTION_CAPTION if not specified)
                const contentSource = flagData.content_source || 'DESCRIPTION_CAPTION';

                await prisma.flags.create({
                    data: {
                        content_item_id: contentItemId,
                        rule_id: flagData.rule_id,
                        product_id: flagData.product_id, // Use parsed product_id (could be null for global)
                        content_source: contentSource, // Store the content source
                        transcript_start_ms: flagData.transcript_start_ms, // Store transcript start time if available
                        transcript_end_ms: flagData.transcript_end_ms, // Store transcript end time if available
                        context_text: flagData.context,
                        ai_confidence: confidenceScore,
                        ai_evaluation: flagData.evaluation,
                        ai_ruling: flagData.ai_ruling,
                        ai_confidence_reasoning: flagData.ai_confidence_reasoning,
                        status: initialStatus,
                        resolution_method: resolutionMethod,
                        internal_notes: autoNote,
                        flag_source: flagSource,
                        rule_type: ruleType,
                        rule_version_applied: rule.version,
                        librarian_consulted: librarianConsulted,
                        librarian_examples_provided: librarianExamplesProvided,
                        image_reference_id: imageOrVideoRefId,
                    }
                });
                console.log(`Created ${flagSource} flag for rule ${flagData.rule_id} (Product: ${flagData.product_id ?? 'N/A'}) with status ${initialStatus} and resolution ${resolutionMethod ?? 'Pending'}`);
            } catch (dbError: any) {
                console.error(`Error creating ${flagSource} flag in database for rule ${flagData.rule_id}:`, dbError.message || dbError);
            }
        }
    } catch (error: any) {
        console.error(`Error parsing final delimited Gemini ${flagSource} response for content item ${contentItemId}:`, error.message);
        console.error("Final raw response was:", aiResponseText);
    }
};


/**
 * Analyzes a specific content item against applicable rules.
 * Performs two passes:
 * 1. Advertiser Global Rules (product-agnostic)
 * 2. Product-Specific Rules (including advertiser defaults)
 */
export const analyzeContentItemForFlags = async (contentItemId: string): Promise<void> => {
  const correlationId = uuidv4(); // Generate a unique ID for this entire analysis operation
  console.log(`\n=== Starting AI Analysis for Content Item: ${contentItemId} (Correlation ID: ${correlationId}) ===`);

  const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  try {
    // Fetch content item with necessary relations for both passes
    const contentItem = await prisma.content_items.findUnique({
      where: { id: contentItemId },
      include: {
        scan_jobs: { // Needed to get advertiser_id and linked products
          include: {
            advertisers: true, // Include the advertiser linked to the scan job
            scan_job_product_focus: { include: { products: true } } // Include products linked to the scan job
          }
        },
        content_images: true, // Needed for image/video analysis
        publishers: { // Needed to trace back to advertiser if scan_jobs.advertiser_id is null (fallback)
            select: { organization_id: true }
        }
      }
    });

    if (!contentItem) {
      console.error(`Content item ${contentItemId} not found.`);
      return;
    }

    const contentPlatform = contentItem.platform;
    if (!contentPlatform) {
        console.error(`Content item ${contentItemId} is missing platform information. Skipping AI analysis.`);
        return;
    }

    // --- Determine Advertiser Context ---
    let advertiser: advertisers | null = contentItem.scan_jobs?.advertisers ?? null;
    let advertiserId: string | null = advertiser?.id ?? null;

    // Fallback: If advertiser wasn't linked directly to scan job, try via publisher->organization
    if (!advertiser && contentItem.publishers?.organization_id) {
        console.log(`Scan job ${contentItem.scan_job_id} not directly linked to advertiser. Looking up via organization ${contentItem.publishers.organization_id}...`);
        advertiser = await prisma.advertisers.findFirst({
            where: { organization_id: contentItem.publishers.organization_id },
        });
        advertiserId = advertiser?.id ?? null;
    }

    if (!advertiser || !advertiserId) {
        console.error(`Could not determine advertiser context for content item ${contentItemId}. Skipping all AI analysis.`);
        return;
    }
    console.log(`Advertiser Context: ${advertiser.name} (ID: ${advertiserId})`);

    // --- Pass 1: Advertiser Global Rules ---
    console.log(`--- Pass 1: Analyzing for Advertiser Global Rules (${advertiser.name}) ---`);
    const globalRules = await getAdvertiserGlobalRules(advertiserId, contentPlatform);

    if (globalRules.length > 0) {
    // Text Analysis (Global)
    const globalTextPrompt = generateAnalysisPromptGeneric(globalRules, contentItem, "Advertiser Global", null, contentItem.content_images); // Pass images
    if (globalTextPrompt) {
        console.log(`Starting global text analysis...`);
            const initialTextRequest: GenerateContentRequest = {
                contents: [{ role: "user", parts: [{ text: globalTextPrompt }] }],
                tools: [{ functionDeclarations: [GetRelevantExamplesTool] }],
                safetySettings
            };
            // Call the refactored function using the wrapper
            const { responseText, librarianConsulted, librarianExamplesProvided } = await callTextAnalysisModelWithLibrarianTool(
                "gemini-1.5-pro", // Specify model name
                initialTextRequest,
                { // Provide logging context
                    serviceName: "AiAnalysisService",
                    actionName: "analyzeGlobalText",
                    relatedContext: { contentItemId: contentItemId, analysisType: "Advertiser Global" }
                },
                correlationId // Pass the generated correlationId
            );
            await processAndSaveFlags(responseText, globalRules, contentItemId, 'ai_text', librarianConsulted, librarianExamplesProvided, null, null); // No product ID default
        } else {
             console.log(`No text content for global analysis.`);
        }

            // Image Analysis (Global) - Only for non-YouTube platforms
        if (contentPlatform !== 'YouTube Video') {
            const imagesToAnalyze = contentItem.content_images?.filter(ci => ci.image_type !== 'video') ?? [];
            if (imagesToAnalyze.length > 0) {
                console.log(`Starting global image analysis for ${imagesToAnalyze.length} image(s)...`);
                for (const image of imagesToAnalyze) {
                    // ... (Existing image download/prep logic) ...
                    let imageBuffer: Buffer;
                    let imageBase64: string;
                    let imageMimeType: string | null = null;
                    let gcsPath = '';
                     try {
                        try { const url = new URL(image.file_path); gcsPath = url.pathname.substring(url.pathname.indexOf('/', 1) + 1); } catch (urlError) { gcsPath = image.file_path.startsWith('/') ? image.file_path.substring(1) : image.file_path; console.warn(`Could not parse URL, assuming file_path is GCS path: ${gcsPath}`); }
                        if (!gcsPath) { console.error(`Could not extract valid GCS path from image.file_path: ${image.file_path}`); continue; }
                        const extension = gcsPath.split('.').pop()?.toLowerCase();
                        if (extension === 'jpg' || extension === 'jpeg') imageMimeType = 'image/jpeg'; else if (extension === 'png') imageMimeType = 'image/png'; else if (extension === 'webp') imageMimeType = 'image/webp'; else { console.warn(`Unsupported image extension ".${extension}" for image ${image.id}. Skipping analysis.`); continue; }
                        imageBuffer = await downloadFileFromGCSAsBuffer(gcsPath); imageBase64 = imageBuffer.toString('base64');
                    } catch (downloadError: any) { console.error(`Error downloading image ${image.file_path} (ID: ${image.id}) from GCS:`, downloadError.message || downloadError); continue; }

                    const imagePrompt = generateImageAnalysisPrompt(globalRules, "Advertiser Global", null, image); // No product context
                    const imagePart: Part = { inlineData: { mimeType: imageMimeType, data: imageBase64 } };
                    const textPart: Part = { text: imagePrompt };
                    // Use wrapper for image analysis
                    const result = await aiCallWrapperService.callGenerativeModelWithLogging(
                        { // AI Call Params
                            modelName: "gemini-1.5-pro", // Assuming pro for vision too, adjust if needed
                            prompt: [textPart, imagePart], // Pass parts array
                            safetySettings: safetySettings,
                        },
                        { // Logging Context
                            serviceName: "AiAnalysisService",
                            actionName: "analyzeGlobalImage",
                            // Include correlationId in related context for image/video logs too
                            relatedContext: { contentItemId: contentItemId, imageId: image.id, analysisType: "Advertiser Global", correlationId: correlationId }
                        }
                    );
                    const imageAiResponseText = result?.response?.text() ?? null;
                    // Token usage is logged by the wrapper, no need for manual logging here
                    await processAndSaveFlags(imageAiResponseText, globalRules, contentItemId, 'ai_image', false, false, image.id, null); // No product ID default, no function calling yet for images
                    // Note: Error handling for the AI call itself is now within the wrapper
                }
            }

            // Video Analysis (Global) - Only for non-YouTube platforms
            const videoRecords = contentItem.content_images?.filter(ci => ci.image_type === 'video') ?? [];
             if (videoRecords.length > 0) {
                console.log(`Starting global video analysis for ${videoRecords.length} video(s)...`);
                for (const video of videoRecords) {
                     // ... (Existing video download/prep logic) ...
                     let videoBuffer: Buffer; let videoBase64: string; let videoMimeType: string | null = null; let gcsPath = '';
                     try {
                        try { const url = new URL(video.file_path); gcsPath = url.pathname.substring(url.pathname.indexOf('/', 1) + 1); } catch (urlError) { gcsPath = video.file_path.startsWith('/') ? video.file_path.substring(1) : video.file_path; console.warn(`Could not parse URL, assuming file_path is GCS path: ${gcsPath}`); }
                        if (!gcsPath) { throw new Error(`Could not extract valid GCS path from video.file_path: ${video.file_path}`); }
                        const extension = gcsPath.split('.').pop()?.toLowerCase(); if (extension === 'mp4') videoMimeType = 'video/mp4'; else if (extension === 'mov') videoMimeType = 'video/quicktime'; else if (extension === 'avi') videoMimeType = 'video/x-msvideo'; else { console.warn(`Unsupported video extension ".${extension}" for video ${video.id}. Attempting generic video/mp4.`); videoMimeType = 'video/mp4'; }
                        videoBuffer = await downloadFileFromGCSAsBuffer(gcsPath); videoBase64 = videoBuffer.toString('base64');
                    } catch (prepError: any) { console.error(`Error preparing video ${video.id} for global analysis (download/encode):`, prepError.message || prepError); continue; }
                    if (!videoBase64 || !videoMimeType) { console.error(`Missing video data or MIME type for video ${video.id}. Skipping AI call.`); continue; }

                    const videoPrompt = generateVideoAnalysisPrompt(globalRules, "Advertiser Global", null, video); // No product context
                    const videoPart: Part = { inlineData: { mimeType: videoMimeType, data: videoBase64 } };
                    const textPart: Part = { text: videoPrompt };
                     // Use wrapper for video analysis
                     const result = await aiCallWrapperService.callGenerativeModelWithLogging(
                        { // AI Call Params
                            modelName: "gemini-1.5-pro", // videoModel name
                            prompt: [textPart, videoPart], // Pass parts array
                            safetySettings: safetySettings,
                        },
                        { // Logging Context
                            serviceName: "AiAnalysisService",
                            actionName: "analyzeGlobalVideo",
                            relatedContext: { contentItemId: contentItemId, videoId: video.id, analysisType: "Advertiser Global", correlationId: correlationId }
                        }
                    );
                    const videoAiResponseText = result?.response?.text() ?? null;
                     // Token usage is logged by the wrapper
                    await processAndSaveFlags(videoAiResponseText, globalRules, contentItemId, 'ai_video', false, false, video.id, null); // No product ID default, no function calling yet for video
                     // Note: Error handling for the AI call itself is now within the wrapper
                }
            }
        } else {
            console.log(`Skipping global image and video analysis for YouTube Video content as per configuration.`);
        }

    } else {
        console.log(`No applicable global rules found for advertiser ${advertiserId} on platform ${contentPlatform}. Skipping Pass 1.`);
    }
    console.log(`--- Finished Pass 1: Advertiser Global Rules ---`);


    // --- Pass 2: Product-Specific Rules ---
    const productsToAnalyze = contentItem.scan_jobs?.scan_job_product_focus.map(focus => focus.products) ?? [];
    if (productsToAnalyze.length === 0) {
      console.log(`No specific products linked to scan job for content item ${contentItemId}. Skipping Pass 2.`);
    } else {
        console.log(`--- Pass 2: Analyzing for Product-Specific Rules ---`);
        for (const product of productsToAnalyze) {
            console.log(`-- Analyzing for Product: ${product.name} (ID: ${product.id}) --`);
            const productContextRules = await getProductContextRules(product.id, advertiser, contentPlatform); // Pass advertiser object
            if (productContextRules.length === 0) {
                console.log(`No applicable product-context rules found for product ${product.name} on platform ${contentPlatform}. Skipping.`);
                continue;
            }

            // Text Analysis (Product Specific)
            const productTextPrompt = generateAnalysisPromptGeneric(productContextRules, contentItem, "Product Specific", product, contentItem.content_images); // Pass images
            if (productTextPrompt) {
                console.log(`Starting product-specific text analysis for ${product.name}...`);
                 const initialTextRequest: GenerateContentRequest = {
                    contents: [{ role: "user", parts: [{ text: productTextPrompt }] }],
                    tools: [{ functionDeclarations: [GetRelevantExamplesTool] }],
                    safetySettings
                };
                 // Call the refactored function using the wrapper
                const { responseText, librarianConsulted, librarianExamplesProvided } = await callTextAnalysisModelWithLibrarianTool(
                    "gemini-1.5-pro", // Specify model name
                    initialTextRequest,
                    { // Provide logging context
                        serviceName: "AiAnalysisService",
                        actionName: "analyzeProductText",
                        relatedContext: { contentItemId: contentItemId, productId: product.id, analysisType: "Product Specific" }
                    },
                    correlationId // Pass the generated correlationId
                );
                await processAndSaveFlags(responseText, productContextRules, contentItemId, 'ai_text', librarianConsulted, librarianExamplesProvided, null, product.id); // Pass product ID
            } else {
                 console.log(`No text content for product-specific analysis.`);
            }

            // Image and Video Analysis (Product Specific) - Only for non-YouTube platforms
            if (contentPlatform !== 'YouTube Video') {
                // Image Analysis (Product Specific)
                const imagesToAnalyze = contentItem.content_images?.filter(ci => ci.image_type !== 'video') ?? [];
                if (imagesToAnalyze.length > 0) {
                    console.log(`Starting product-specific image analysis for ${imagesToAnalyze.length} image(s)...`);
                    for (const image of imagesToAnalyze) {
                        // ... (Existing image download/prep logic) ...
                         let imageBuffer: Buffer; let imageBase64: string; let imageMimeType: string | null = null; let gcsPath = '';
                         try {
                            try { const url = new URL(image.file_path); gcsPath = url.pathname.substring(url.pathname.indexOf('/', 1) + 1); } catch (urlError) { gcsPath = image.file_path.startsWith('/') ? image.file_path.substring(1) : image.file_path; console.warn(`Could not parse URL, assuming file_path is GCS path: ${gcsPath}`); }
                            if (!gcsPath) { console.error(`Could not extract valid GCS path from image.file_path: ${image.file_path}`); continue; }
                            const extension = gcsPath.split('.').pop()?.toLowerCase(); if (extension === 'jpg' || extension === 'jpeg') imageMimeType = 'image/jpeg'; else if (extension === 'png') imageMimeType = 'image/png'; else if (extension === 'webp') imageMimeType = 'image/webp'; else { console.warn(`Unsupported image extension ".${extension}" for image ${image.id}. Skipping analysis.`); continue; }
                            imageBuffer = await downloadFileFromGCSAsBuffer(gcsPath); imageBase64 = imageBuffer.toString('base64');
                        } catch (downloadError: any) { console.error(`Error downloading image ${image.file_path} (ID: ${image.id}) from GCS:`, downloadError.message || downloadError); continue; }

                        const imagePrompt = generateImageAnalysisPrompt(productContextRules, "Product Specific", product, image);
                        const imagePart: Part = { inlineData: { mimeType: imageMimeType, data: imageBase64 } };
                        const textPart: Part = { text: imagePrompt };
                        // Use wrapper for image analysis
                        const result = await aiCallWrapperService.callGenerativeModelWithLogging(
                            { // AI Call Params
                                modelName: "gemini-1.5-pro", // analysisModel name
                                prompt: [textPart, imagePart],
                                safetySettings: safetySettings,
                            },
                            { // Logging Context
                                serviceName: "AiAnalysisService",
                                actionName: "analyzeProductImage",
                                relatedContext: { contentItemId: contentItemId, productId: product.id, imageId: image.id, analysisType: "Product Specific", correlationId: correlationId }
                            }
                        );
                        const imageAiResponseText = result?.response?.text() ?? null;
                        // Token usage logged by wrapper
                        await processAndSaveFlags(imageAiResponseText, productContextRules, contentItemId, 'ai_image', false, false, image.id, product.id); // Pass product ID
                    }
                }

                // Video Analysis (Product Specific)
                const videoRecords = contentItem.content_images?.filter(ci => ci.image_type === 'video') ?? [];
                if (videoRecords.length > 0) {
                    console.log(`Starting product-specific video analysis for ${videoRecords.length} video(s)...`);
                    for (const video of videoRecords) {
                        // ... (Existing video download/prep logic) ...
                        let videoBuffer: Buffer; let videoBase64: string; let videoMimeType: string | null = null; let gcsPath = '';
                        try {
                            try { const url = new URL(video.file_path); gcsPath = url.pathname.substring(url.pathname.indexOf('/', 1) + 1); } catch (urlError) { gcsPath = video.file_path.startsWith('/') ? video.file_path.substring(1) : video.file_path; console.warn(`Could not parse URL, assuming file_path is GCS path: ${gcsPath}`); }
                            if (!gcsPath) { throw new Error(`Could not extract valid GCS path from video.file_path: ${video.file_path}`); }
                            const extension = gcsPath.split('.').pop()?.toLowerCase(); if (extension === 'mp4') videoMimeType = 'video/mp4'; else if (extension === 'mov') videoMimeType = 'video/quicktime'; else if (extension === 'avi') videoMimeType = 'video/x-msvideo'; else { console.warn(`Unsupported video extension ".${extension}" for video ${video.id}. Attempting generic video/mp4.`); videoMimeType = 'video/mp4'; }
                            videoBuffer = await downloadFileFromGCSAsBuffer(gcsPath); videoBase64 = videoBuffer.toString('base64');
                        } catch (prepError: any) { console.error(`Error preparing video ${video.id} for product analysis (download/encode):`, prepError.message || prepError); continue; }
                        if (!videoBase64 || !videoMimeType) { console.error(`Missing video data or MIME type for video ${video.id}. Skipping AI call.`); continue; }

                        const videoPrompt = generateVideoAnalysisPrompt(productContextRules, "Product Specific", product, video);
                        const videoPart: Part = { inlineData: { mimeType: videoMimeType, data: videoBase64 } };
                        const textPart: Part = { text: videoPrompt };
                        // Use wrapper for video analysis
                        const result = await aiCallWrapperService.callGenerativeModelWithLogging(
                            { // AI Call Params
                                modelName: "gemini-1.5-pro", // videoModel name
                                prompt: [textPart, videoPart],
                                safetySettings: safetySettings,
                            },
                            { // Logging Context
                                serviceName: "AiAnalysisService",
                                actionName: "analyzeProductVideo",
                                relatedContext: { contentItemId: contentItemId, productId: product.id, videoId: video.id, analysisType: "Product Specific", correlationId: correlationId }
                            }
                        );
                        const videoAiResponseText = result?.response?.text() ?? null;
                        // Token usage logged by wrapper
                        await processAndSaveFlags(videoAiResponseText, productContextRules, contentItemId, 'ai_video', false, false, video.id, product.id); // Pass product ID
                    }
                }
            } else {
                console.log(`Skipping product-specific image and video analysis for YouTube Video content as per configuration.`);
            }
            console.log(`-- Finished analysis for Product: ${product.name} --`);
        } // End product loop
        console.log(`--- Finished Pass 2: Product-Specific Rules ---`);
    }

    console.log(`=== Finished AI Analysis for Content Item: ${contentItemId} ===`);

  } catch (error: any) {
    console.error(`Unexpected error during AI analysis for content item ${contentItemId}:`, error.message || error);
  }
};
