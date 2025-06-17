import { content_items, products } from '../../generated/prisma/client';
import * as aiCallWrapperService from './aiCallWrapperService';
import prisma from '../utils/prismaClient'; // For direct product fetching if needed
// import { downloadFileFromGCSAsBuffer } from './gcsService'; // No longer needed, using GCS URIs
import { Part } from '@google-cloud/vertexai';
// import { safeStringify, error, info, debug, warn } from '../utils/logUtil'; // Replaced by jobFileLogger
import { createJobLogger } from '../utils/jobFileLogger'; // Import the job file logger
import { safeStringify } from '../utils/logUtil'; // Keep safeStringify if needed

// const SERVICE_NAME = 'FlagExtractionService'; // No longer needed with jobLogger

export interface ExtractedMention {
  productId: string; // DB ID of the product
  mentionType: string; // e.g., "CARD_NAME", "ANNUAL_FEE", "MARKETING_BULLET_TRAVEL", "WELCOME_OFFER_POINTS"
  contextText: string; // Exact snippet, AI will be asked to prefix with source (e.g., "Image 2 Visual: ...", "Audio: ...")
  sourceLocation: "TITLE" | "DESCRIPTION_CAPTION" | "TRANSCRIPT" | "VIDEO_AUDIO" | "VIDEO_VISUAL" | "IMAGE_VISUAL" | "UNKNOWN";
  sourceContentImageId?: string; // DB ID of the content_image if mention is from a specific image/video frame
  timestampStartMs?: number;
  timestampEndMs?: number;
  associationReasoning?: string; // Optional: AI's reasoning for non-obvious associations
  surroundingContext?: string; // Exact snippet + ~5 tokens before and after
  visualLocation?: "upper-left" | "upper-center" | "upper-right" | "center-left" | "center" | "center-right" | "lower-left" | "lower-center" | "lower-right" | "full-frame" | "top-full" | "middle-full" | "bottom-full" | "unknown"; // For IMAGE/VIDEO mentions
  confidence: number; // Mandatory confidence score from extractor
}

// Placeholder for the actual AI model name for the extractor
const EXTRACTOR_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

/**
 * Prepares product information for inclusion in the AI prompt.
 */
const prepareProductInfoForPrompt = (productsToScanFor: products[]): string => {
  if (!productsToScanFor || productsToScanFor.length === 0) {
    return "No specific products provided for scanning.\n";
  }
  return productsToScanFor.map(product => {
    let productDetails = `Product Name: ${product.name}\n`;
    productDetails += `Product ID: ${product.id}\n`; // For our reference, AI uses name
    if (product.fee !== null && product.fee !== undefined) {
      productDetails += `Annual Fee: $${product.fee}\n`;
    }
    if (product.marketing_bullets && Array.isArray(product.marketing_bullets) && product.marketing_bullets.length > 0) {
      // Assuming marketing_bullets is an array of strings
      const bullets = product.marketing_bullets as unknown as string[];
      productDetails += `Marketing Bullets: ${JSON.stringify(bullets)}\n`;
    }
    return productDetails;
  }).join('---\n');
};

/**
 * Constructs the prompt for the flag extraction AI.
 */
const constructExtractorPrompt = (
  productInfoString: string,
  contentTitle: string | null,
  contentCaption: string | null,
  contentTranscript: string | null, // Stringified JSON or plain text
  mediaType: 'video' | 'single_image' | 'multiple_images' | 'text_only',
  numImages?: number
): string => {
  let mediaInstructions = '';
  if (mediaType === 'video') {
    mediaInstructions = "You will be given a video file (for audio and visual analysis) and its caption/title.";
  } else if (mediaType === 'single_image') {
    mediaInstructions = "You will be given a single image and its caption/title.";
  } else if (mediaType === 'multiple_images' && numImages) {
    mediaInstructions = `You will be given ${numImages} images from a single post (Image 1, Image 2, ..., Image ${numImages}) and an overall caption/title. Analyze all provided images and the caption.`;
  } else { // text_only
    mediaInstructions = "You will be analyzing text content (title, description, transcript).";
  }

  // Core prompt structure
  // This is a simplified initial version. We will iterate and refine this.
  const prompt = `
You are an AI assistant specialized in identifying and extracting mentions of financial products and their features from provided content.
Your goal is to build a list of all potential mentions. You do NOT evaluate compliance.

Provided Product Information:
────────────────────────
${productInfoString}
────────────────────────

Content to Analyze:
${mediaInstructions}
${contentTitle ? `Title: ${contentTitle}\n` : ''}
${contentCaption ? `Caption/Description: ${contentCaption}\n` : ''}
${contentTranscript ? `Transcript: ${contentTranscript}\n` : ''}
(Note: If video or image(s) are provided as input parts, analyze them directly for visual and audio cues.)

Extraction Task:
1.  For each product listed in "Provided Product Information", meticulously scan all aspects of the "Content to Analyze" (text, and if applicable, video audio/visuals, image visuals).
2.  Identify and extract mentions of:
    a.  Product Names: Full names (e.g., "Chase Sapphire Preferred") or common, unambiguous abbreviations (e.g., "CSP"). If an ambiguous partial name is used (e.g., "Chase Sapphire"), extract it only if the surrounding context strongly suggests the specific product. Do NOT extract generic terms like "credit card" unless directly tied to a target product in the immediate phrase.
    b.  Annual Fees: Extract a monetary figure when the surrounding words, grammar, or discourse frame that amount as a recurring cost the card-holder pays each year (e.g., "annual fee," "costs $95 every year," "you'll pay $450 per year"). Do not treat statement credits, cash-back offers, or other benefits as annual fees.
    c.  Marketing Bullet Points: If you see phrases that directly correspond to or are very close variations of the "Marketing Bullets" for a product, extract them.
3.  Contextual Association:
    *   If multiple products are discussed, try to associate fees and bullets with the most recently mentioned product unless context clearly indicates otherwise.
    *   If you make an association that isn't immediately obvious (e.g., a feature linked to a product mentioned much earlier), briefly explain your reasoning in an "associationReasoning" field for that mention.
4.  Source Attribution:
    *   For each extracted mention, the "contextText" should be the exact sentence or phrase.
    *   IMPORTANT: Prefix the "contextText" with its specific source. Examples:
        *   "Title: [extracted text from title]"
        *   "Caption: [extracted text from caption/description]"
        *   "Transcript: [extracted text from transcript at HH:MM:SS (if possible)]"
        *   "Audio: [spoken words from video audio]"
        *   "Video Visual: [description of visual element or text overlay in video]"
        *   "Image 1 Visual: [description of visual element or text in Image 1]"
        *   "Image 2 Visual: [description of visual element or text in Image 2]" (and so on for multiple images)
    *   The "sourceLocation" field should be one of: TITLE, DESCRIPTION_CAPTION, TRANSCRIPT, VIDEO_AUDIO, VIDEO_VISUAL, IMAGE_VISUAL.
5.  Surrounding Context: For each extracted mention from text sources (Title, Caption, Transcript), also provide a "surroundingContext" field. This field should contain the original "contextText" (the exact snippet) plus up to 5 tokens (words or significant punctuation) immediately before and up to 5 tokens immediately after the "contextText". If the "contextText" is at the very beginning or end of the source, include tokens only from the available side.
6.  Visual Location (for IMAGE or VIDEO mentions ONLY):
    *   If a mention is derived from an image or video visual, determine its general location.
    *   Imagine a 3x3 grid overlaid on the visual:
          upper-left   | upper-center   | upper-right
          -------------------------------------------
          center-left  | center         | center-right
          -------------------------------------------
          lower-left   | lower-center   | lower-right
    *   If the element fits mostly inside one cell, return that cell name (“upper-right”, “center-left”, etc.).
    *   If the element spans the full **width** of the frame but is confined to one horizontal band, return:
          "top-full"    (upper third)
          "middle-full" (middle third)
          "bottom-full" (lower third)
    *   If the element spans more than approximately 60% of the frame's width or height, use "full-frame".
    *   If the location is genuinely unclear or cannot be determined, use "unknown".
    *   Return this as a "visualLocation" field. Do NOT output numeric coordinates.
7.  Confidence Scoring Guidelines:
    *   **CRITICAL CALIBRATION GOAL:** Your primary objective is to calibrate confidence scores such that the **average confidence for a typical set of validly extracted mentions (including reasonably inferred card names and features) falls within the 0.60-0.75 range.** Scores above 0.80 should be infrequent and reserved for cases with exceptionally strong, unambiguous evidence. If you find your scores consistently averaging higher, you MUST adjust your internal calibration to be more conservative.
    *   Assign a "confidence" score (0.00 - 1.00, two decimal places) to every extracted mention.
    *   Apply the following rubric with a strong bias towards conservative scoring.

    Confidence Bands:

    *   **0.90-1.00 (Exceptional & Irrefutable - RARE):**
        *   General Criteria: Exact full product name AND exact feature wording (verbatim, no paraphrasing) are perfectly and prominently presented together in the same sentence or visual frame. AND this direct connection is unequivocally confirmed by at least two *distinct, high-quality, and unambiguous* modalities. AND there are absolutely no other conflicting product cues or ambiguities anywhere in the content item.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   The exact, full, official product name as provided in "Product Information" is mentioned, with no missing words or alterations.
            *   If only the card name is extracted (no associated feature in this specific mention object), it must be exceptionally clear, prominent, and without any ambiguity or nearby competing card names to reach this band.
        *   **Mandatory Justification:** If assigning a score in this band, you MUST provide a detailed explanation in 'associationReasoning' justifying this exceptional level of certainty (e.g., "Exact name and fee visually clear on screen + exact audio match"; "Exact full card name visually prominent, no other cards mentioned").

    *   **0.75-0.89 (High & Strong Inference - USE SPARINGLY):**
        *   General Criteria: Exact product name (not an abbreviation) AND exact or extremely close feature wording, both clearly presented in at least one high-quality modality. OR, an exact feature is mentioned, and the specific product (exact name) is unequivocally and immediately implied by multiple, very strong, direct contextual cues in the same sentence/frame.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   The product name is an almost exact match to the official name, with only a *very minor, single-character typo or a single transcribed letter error* that does not create ambiguity with another known product (e.g., "Chase Sapphir Preferred" instead of "Chase Sapphire Preferred").
            *   **Missing words from the official name (e.g., "Chase Sapphire Preferred" instead of "Chase Sapphire Preferred Card") do NOT qualify for this band and should be scored lower (typically in the 0.60-0.75 range if the partial name remains unambiguous for a specific product).**
        *   Constraint: If feature wording is paraphrased even slightly, or if the product name has more than a trivial typo (for CARD_NAME mentions), the score should generally not exceed 0.85 within this band and likely falls into the 'Standard' range or lower.

    *   **0.60-0.75 (Standard & Good Inference - **EXPECTED TARGET RANGE FOR MOST VALID MENTIONS**):**
        *   General Criteria: A clear association between a product and a feature is made, requiring a reasonable level of inference. This is the expected range for the majority of valid extractions.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   A commonly known, unambiguous, and clearly accepted abbreviation for a specific product is used (e.g., "CSP" for "Chase Sapphire Preferred Card", "Ink Preferred" for "Chase Ink Business Preferred Credit Card").
            *   The product name is mentioned with minor official parts missing but remains unambiguous for a specific product (e.g., "Chase Sapphire Preferred" when the official name is "Chase Sapphire Preferred® Card" - missing "Card" and ® is acceptable here).
        *   Feature Inference Cap: If the association requires inferring semantic equivalence between the mentioned text and a listed product feature (e.g., "3x on dining" is inferred to mean "3x on purchases made at restaurants"), the confidence score for this mention **MUST NOT EXCEED 0.70.**
        *   Abbreviation + Paraphrase Cap: If an abbreviated product name is used AND the feature is paraphrased, the score **MUST NOT EXCEED 0.65.**

    *   **0.45-0.59 (Fair & Plausible Inference - BELOW STANDARD TARGET):**
        *   General Criteria: Feature association is plausible but requires more significant inference or relies on weaker, less direct, or more distant contextual cues than the 'Standard' range.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   The product name mention is potentially ambiguous due to other card names mentioned in close proximity (e.g., within 1-2 sentences or a few seconds, making attribution to *this specific product* less certain).
            *   Card names mentioned primarily or only within hashtags (e.g., #ChaseSapphirePreferred).
            *   Partial names that are somewhat ambiguous but context leans towards a specific product (e.g., "Chase Ink" when multiple "Ink" cards exist but context provides some hint, though not definitive).

    *   **0.30-0.44 (Low & Speculative):**
        *   General Criteria: A potential link exists but is based on weak, tenuous, or ambiguous cues. The association requires considerable inferential leaps.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   The card name mentioned is highly uncertain or very partial, making it difficult to map to a specific product from the list.
            *   Two or more different product abbreviations (for different specific products) are used in very close proximity, creating confusion.
            *   Highly ambiguous partial names (e.g., "Sapphire card" without further context to differentiate Preferred/Reserve from your product list).

    *   **< 0.30 (Very Low & Highly Uncertain - BUT STILL EXTRACT IF FAINTEST POSSIBILITY):**
        *   General Criteria: Highly speculative or a mere guess.
        *   **For \`mentionType: "CARD_NAME"\`:**
            *   Extremely ambiguous partial names where the specific card is very unclear from the provided product list and context (e.g., "Chase Sapphire Card" or "Chase Sapphire" when both Preferred and Reserve are target products and context offers no disambiguation).
            *   Generic references that *might* hint at a product family but not a specific card from your list (e.g., "the Ink Card" when multiple Chase Ink cards are target products and no context specifies which).
            *   Use this for the "faintest possibilities" you want to capture.

    Additional Notes on Reasoning:
    *   Provide \`associationReasoning\` if:
        *   Confidence is below 0.60.
        *   Confidence is 0.90 or above (mandatory justification).
        *   An explicit cap or specific condition mentioned in the rubric was applied (e.g., 0.70 for semantic equivalence, specific scoring for abbreviations or typos).
        *   The reasoning for the association isn't immediately obvious from the contextText and mentionType.
    *   Round confidence to two decimal places.

Internal Reasoning Steps (Do NOT include this in the final JSON output):
1. Identify all product mentions (names, abbreviations) and their locations (source, timestamp if applicable).
2. For each product mention, scan the surrounding context (text, audio, visuals) for potential features (matching annual fee, phrases related to marketing bullets).
3. Link identified features to the most likely product based on proximity and context. Explicitly note any ambiguities or reasoning for non-obvious links using "associationReasoning".
4. Consolidate the findings and format them strictly according to the JSON output specification below.

Output Format:
Return your findings as a JSON array of objects. Each object represents a single extracted mention and must follow this structure:
[
  {
    "productId": "string (the Product ID from 'Provided Product Information')",
    "mentionType": "string (e.g., 'CARD_NAME', 'ANNUAL_FEE', 'MARKETING_BULLET_DINING_REWARDS')",
    "contextText": "string (exact snippet, prefixed with source as described above)",
    "surroundingContext": "string (optional, the contextText plus ~5 tokens before and after - for text sources)",
    "sourceLocation": "string (TITLE, DESCRIPTION_CAPTION, TRANSCRIPT, VIDEO_AUDIO, VIDEO_VISUAL, IMAGE_VISUAL)",
    "confidence": 0.00,
    "timestampStartMs": "number (optional, if from TRANSCRIPT or VIDEO_AUDIO with timing)",
    "timestampEndMs": "number (optional, if from TRANSCRIPT or VIDEO_AUDIO with timing)",
    "associationReasoning": "string (optional, explanation for non-obvious associations)",
    "visualLocation": "string (optional, e.g., 'upper-right', 'center', 'full-frame', 'unknown' - only for IMAGE/VIDEO mentions)"
  }
  // ... more mention objects if found ...
]

Example Output Structure:
[
  {
    "productId": "d2fd493a-0626-412f-a30e-c7555eca2a97",
    "mentionType": "CARD_NAME",
    "contextText": "Video Visual: Chase Sapphire Reserve card shown",
    "sourceLocation": "VIDEO_VISUAL",
    "confidence": 0.85,
    "visualLocation": "center"
  },
  {
    "productId": "1cc7a4f0-c519-46ba-8845-98ec66349a0f",
    "mentionType": "MARKETING_BULLET_TRAVEL",
    "contextText": "Transcript: you get 5x points on travel purchased through Chase Ultimate Rewards",
    "surroundingContext": "Ultimate Rewards® . Plus, you get 5x points on travel purchased through Chase Ultimate Rewards® , excluding hotel purchases",
    "sourceLocation": "TRANSCRIPT",
    "confidence": 0.92,
    "timestampStartMs": 35200,
    "timestampEndMs": 38100
  }
]

Important Output Rules:
1. If optional fields like \`surroundingContext\`, \`timestampStartMs\`, \`timestampEndMs\`, \`associationReasoning\`, or \`visualLocation\` are not applicable for a specific mention, **OMIT the field entirely** from the JSON object for that mention. Do not include the key with a null or empty value.
2. If no mentions are found for any products, return an empty JSON array \`[]\`.
3. CRITICAL: Your *entire* response MUST consist ONLY of the JSON array, starting with \`[\` and ending with \`]\`. Do not include *any* introductory text, explanations, apologies, or summaries before or after the JSON array. Ensure all strings within the JSON are properly escaped and terminated. Double-check the structure for validity (e.g., matching brackets, correct commas) before concluding your response.
  `;
  return prompt.trim();
};


export const extractMentions = async (
  contentItem: content_items & { content_images: { id: string, file_path: string, image_type: string }[] },
  productsToScanFor: products[],
  scanJobId: string // Added scanJobId parameter
): Promise<ExtractedMention[]> => {
  const jobLogger = createJobLogger(scanJobId); // Initialize logger
  const loggingContext = { // Keep for passing context to wrapper if needed, but use jobLogger for direct logging
    serviceName: 'FlagExtractionService',
    actionName: 'extractMentions',
    relatedContext: { contentItemId: contentItem.id, scanJobId: scanJobId } // Use passed scanJobId
  };
  jobLogger.info(`Extractor: Starting flag extraction for content item: ${contentItem.id}`, { contentItemId: contentItem.id, productsToScanFor: productsToScanFor.map(p => p.id) });

  const productInfoString = prepareProductInfoForPrompt(productsToScanFor);
  const aiParts: Part[] = [];

  let mediaType: 'video' | 'single_image' | 'multiple_images' | 'text_only' = 'text_only';
  let numImagesForPrompt = 0;

  const videos = contentItem.content_images.filter(img => img.image_type === 'video');
  const images = contentItem.content_images.filter(img => img.image_type !== 'video'); // Treat other types as images for now

  // Determine media type and prepare AI parts
  if (videos.length > 0) {
    mediaType = 'video';
    const video = videos[0]; // Assuming one primary video for now
    jobLogger.info(`Extractor: Video found: ${video.file_path}. Preparing for multimodal processing.`, { videoPath: video.file_path });
    try {
      let videoGcsObjectPath = '';
      const gcsBucketName = process.env.GCS_BUCKET_NAME;

      if (video.file_path.startsWith('gs://')) {
        const pathWithoutGsPrefix = video.file_path.substring(5); // Remove 'gs://'
        if (gcsBucketName && pathWithoutGsPrefix.startsWith(gcsBucketName + '/')) {
          videoGcsObjectPath = pathWithoutGsPrefix.substring(gcsBucketName.length + 1);
        } else {
          // Path doesn't start with expected bucket name, or bucket name unknown
          // This case might indicate an issue or a different bucket is being used.
          // For now, assume it's just the object path after gs://
          videoGcsObjectPath = pathWithoutGsPrefix;
          jobLogger.warn(`Extractor: GS URI ${video.file_path} does not seem to contain the configured bucket name ${gcsBucketName}. Using path as is after gs://.`, { videoPath: video.file_path, bucketName: gcsBucketName });
        }
      } else { // HTTPS URL
        const url = new URL(video.file_path);
        const fullPathFromUrl = url.pathname.substring(1); // Remove leading '/'
        if (gcsBucketName && fullPathFromUrl.startsWith(gcsBucketName + '/')) {
          videoGcsObjectPath = fullPathFromUrl.substring(gcsBucketName.length + 1);
        } else {
          // This is the problematic case from the logs.
          // If GCS_BUCKET_NAME is correct, this means the URL's first path segment IS the bucket.
          // So, we need to strip the first segment if it matches the bucket name.
          // If GCS_BUCKET_NAME is not set, this will fail.
          const pathSegments = fullPathFromUrl.split('/');
          if (pathSegments.length > 1 && pathSegments[0] === gcsBucketName) {
             videoGcsObjectPath = pathSegments.slice(1).join('/');
          } else if (pathSegments.length > 0 && !gcsBucketName) {
             // If GCS_BUCKET_NAME is not in env, assume first segment is bucket and rest is object path
             // This is a guess, but better than duplicating.
             jobLogger.warn(`Extractor: GCS_BUCKET_NAME not in env. Assuming first path segment of ${fullPathFromUrl} is bucket.`, { fullPathFromUrl });
             videoGcsObjectPath = pathSegments.slice(1).join('/');
          }
          else {
            // Fallback: if the URL doesn't start with the configured bucket name,
            // or GCS_BUCKET_NAME is not set, we might have an issue.
            // The original error was duplication, so the most direct fix is to ensure we strip the bucket if it's there.
            // The error was `aethereal-compliance-ai-images/aethereal-compliance-ai-images/media/...`
            // and `video.file_path` was `https://.../aethereal-compliance-ai-images/media/...`
            // so `fullPathFromUrl` was `aethereal-compliance-ai-images/media/...`
            // We need to get `media/...`
            if (gcsBucketName && fullPathFromUrl.startsWith(gcsBucketName + '/')) {
               videoGcsObjectPath = fullPathFromUrl.substring(gcsBucketName.length + 1);
            } else {
               // If it doesn't start with the bucket name, it implies the path is already relative
               // or it's a different bucket. Given the error, it's likely the former part of a duplication.
               // Let's assume for now the path from URL is "bucket/object" and we need "object"
               const segments = fullPathFromUrl.split('/');
               if (segments.length > 1) {
                   videoGcsObjectPath = segments.slice(1).join('/');
               } else {
                   videoGcsObjectPath = fullPathFromUrl; // Or handle as error
                   jobLogger.warn(`Extractor: Could not reliably strip bucket from HTTPS URL path: ${fullPathFromUrl}`, { fullPathFromUrl });
               }
            }
          }
        }
      }

      if (!videoGcsObjectPath) {
        jobLogger.error(`Extractor: Could not determine GCS object path from ${video.file_path} with bucket ${gcsBucketName}. Skipping video part.`, new Error(`Could not determine GCS object path`), { videoPath: video.file_path, bucketName: gcsBucketName });
        // throw new Error(`Could not determine GCS object path from ${video.file_path} with bucket ${gcsBucketName}`); // Let execution continue without video
      } else if (!gcsBucketName) {
        jobLogger.error(`Extractor: GCS_BUCKET_NAME is not set. Cannot construct GCS URI for video ${video.file_path}. Skipping video part.`, { videoPath: video.file_path });
      } else {
        const gcsUri = `gs://${gcsBucketName}/${videoGcsObjectPath}`;
        const videoExtension = videoGcsObjectPath.split('.').pop()?.toLowerCase() || '';
        let mimeType = 'video/mp4'; // Default
        if (videoExtension === 'mov') mimeType = 'video/quicktime';
        else if (videoExtension === 'avi') mimeType = 'video/x-msvideo';
        else if (videoExtension === 'webm') mimeType = 'video/webm';
        // Add more video mime types if needed
        aiParts.push({ fileData: { mimeType, fileUri: gcsUri } });
        jobLogger.info(`Extractor: Added video GCS URI ${gcsUri} to AI parts.`, { gcsUri, mimeType });
      }
    } catch (e: any) {
      jobLogger.error(`Extractor: Failed to process video ${video.file_path}`, e instanceof Error ? e : new Error(String(e)), { videoPath: video.file_path });
    }
  } else if (images.length > 0) {
    if (images.length === 1) {
      mediaType = 'single_image';
      numImagesForPrompt = 1;
      const image = images[0];
      jobLogger.info(`Extractor: Single image found: ${image.file_path}. Preparing for multimodal processing.`, { imagePath: image.file_path });
      try {
        let imageGcsObjectPath = '';
        const gcsBucketName = process.env.GCS_BUCKET_NAME;

        if (image.file_path.startsWith('gs://')) {
          const pathWithoutGsPrefix = image.file_path.substring(5);
          if (gcsBucketName && pathWithoutGsPrefix.startsWith(gcsBucketName + '/')) {
            imageGcsObjectPath = pathWithoutGsPrefix.substring(gcsBucketName.length + 1);
          } else {
            imageGcsObjectPath = pathWithoutGsPrefix;
            jobLogger.warn(`Extractor: GS URI ${image.file_path} does not seem to contain the configured bucket name ${gcsBucketName}. Using path as is after gs://.`, { imagePath: image.file_path, bucketName: gcsBucketName });
          }
        } else { // HTTPS URL
          const url = new URL(image.file_path);
          const fullPathFromUrl = url.pathname.substring(1);
          if (gcsBucketName && fullPathFromUrl.startsWith(gcsBucketName + '/')) {
            imageGcsObjectPath = fullPathFromUrl.substring(gcsBucketName.length + 1);
          } else {
            const segments = fullPathFromUrl.split('/');
            if (segments.length > 1) {
                imageGcsObjectPath = segments.slice(1).join('/');
            } else {
                imageGcsObjectPath = fullPathFromUrl;
                jobLogger.warn(`Extractor: Could not reliably strip bucket from HTTPS URL path for image: ${fullPathFromUrl}`, { fullPathFromUrl });
            }
          }
        }

        if (!imageGcsObjectPath) {
          jobLogger.error(`Extractor: Could not determine GCS object path from ${image.file_path} with bucket ${gcsBucketName}. Skipping image part.`, new Error(`Could not determine GCS object path`), { imagePath: image.file_path, bucketName: gcsBucketName });
          // throw new Error(`Could not determine GCS object path from ${image.file_path} with bucket ${gcsBucketName}`);
        } else if (!gcsBucketName) {
          jobLogger.error(`Extractor: GCS_BUCKET_NAME is not set. Cannot construct GCS URI for image ${image.file_path}. Skipping image part.`, { imagePath: image.file_path });
        } else {
          const gcsUri = `gs://${gcsBucketName}/${imageGcsObjectPath}`;
          const imageExtension = imageGcsObjectPath.split('.').pop()?.toLowerCase() || '';
          let mimeType = 'image/jpeg'; // Default
          if (imageExtension === 'png') mimeType = 'image/png';
          else if (imageExtension === 'webp') mimeType = 'image/webp';
          else if (imageExtension === 'gif') mimeType = 'image/gif';
          // Add more mime types if needed: heic, heif, bmp, ico
          aiParts.push({ fileData: { mimeType, fileUri: gcsUri } });
          jobLogger.info(`Extractor: Added single image GCS URI ${gcsUri} to AI parts.`, { gcsUri, mimeType });
        }
      } catch (e: any) {
        jobLogger.error(`Extractor: Failed to process single image ${image.file_path}`, e instanceof Error ? e : new Error(String(e)), { imagePath: image.file_path });
      }
    } else { // Multiple images
      mediaType = 'multiple_images';
      numImagesForPrompt = images.length;
      jobLogger.info(`Extractor: ${images.length} images found. Preparing for multimodal processing.`, { imageCount: images.length });
      for (const image of images) {
        try {
          let imageGcsObjectPath = '';
          const gcsBucketName = process.env.GCS_BUCKET_NAME;

          if (image.file_path.startsWith('gs://')) {
            const pathWithoutGsPrefix = image.file_path.substring(5);
            if (gcsBucketName && pathWithoutGsPrefix.startsWith(gcsBucketName + '/')) {
              imageGcsObjectPath = pathWithoutGsPrefix.substring(gcsBucketName.length + 1);
            } else {
              imageGcsObjectPath = pathWithoutGsPrefix;
              jobLogger.warn(`Extractor: GS URI ${image.file_path} does not seem to contain the configured bucket name ${gcsBucketName}. Using path as is after gs://.`, { imagePath: image.file_path, bucketName: gcsBucketName });
            }
          } else { // HTTPS URL
            const url = new URL(image.file_path);
            const fullPathFromUrl = url.pathname.substring(1);
            if (gcsBucketName && fullPathFromUrl.startsWith(gcsBucketName + '/')) {
              imageGcsObjectPath = fullPathFromUrl.substring(gcsBucketName.length + 1);
            } else {
                const segments = fullPathFromUrl.split('/');
                if (segments.length > 1) {
                    imageGcsObjectPath = segments.slice(1).join('/');
                } else {
                    imageGcsObjectPath = fullPathFromUrl;
                    jobLogger.warn(`Extractor: Could not reliably strip bucket from HTTPS URL path for image: ${fullPathFromUrl}`, { fullPathFromUrl });
                }
            }
          }

          if (!imageGcsObjectPath) {
            jobLogger.error(`Extractor: Could not determine GCS object path from ${image.file_path} with bucket ${gcsBucketName}. Skipping image part.`, new Error(`Could not determine GCS object path`), { imagePath: image.file_path, bucketName: gcsBucketName });
            // throw new Error(`Could not determine GCS object path from ${image.file_path} with bucket ${gcsBucketName}`);
          } else if (!gcsBucketName) {
            jobLogger.error(`Extractor: GCS_BUCKET_NAME is not set. Cannot construct GCS URI for image ${image.file_path} in multi-image call. Skipping image part.`, { imagePath: image.file_path });
          } else {
            const gcsUri = `gs://${gcsBucketName}/${imageGcsObjectPath}`;
            const imageExtension = imageGcsObjectPath.split('.').pop()?.toLowerCase() || '';
            let mimeType = 'image/jpeg'; // Default
            if (imageExtension === 'png') mimeType = 'image/png';
            else if (imageExtension === 'webp') mimeType = 'image/webp';
            else if (imageExtension === 'gif') mimeType = 'image/gif';
            aiParts.push({ fileData: { mimeType, fileUri: gcsUri } });
            jobLogger.info(`Extractor: Added image GCS URI ${gcsUri} to AI parts for multi-image call.`, { gcsUri, mimeType });
          }
        } catch (e: any) {
          jobLogger.error(`Extractor: Failed to process image ${image.file_path} for multi-image call`, e instanceof Error ? e : new Error(String(e)), { imagePath: image.file_path });
        }
      }
    }
  }
  
  // Stringify transcript: Assuming transcript is JSON. Adjust if it's plain text or other structure.
  const transcriptString = contentItem.transcript ? safeStringify(contentItem.transcript) : null;

  const prompt = constructExtractorPrompt(
    productInfoString,
    contentItem.title,
    contentItem.caption,
    transcriptString,
    mediaType,
    numImagesForPrompt
  );
  aiParts.push({ text: prompt });

  // jobLogger.info(`Extractor: Generated extractor prompt for AI`, { prompt }); // Prompt can be very large, log selectively if needed

  try {
    jobLogger.info(`Extractor: Making AI call with ${aiParts.length} parts (1 text, ${aiParts.length - 1} media).`);
    const aiCallParams: aiCallWrapperService.AiCallParams = {
      modelName: EXTRACTOR_MODEL_NAME,
      parts: aiParts,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192, // Set max output tokens
        thinkingConfig: {
            thinkingBudget: 24576 // Set max thinking budget
        }
       },
      // safetySettings: defaultSafetySettings (if defined and exported from wrapper or globally)
    };

    // Pass loggingContext to the wrapper for its internal logging if needed
    const result = await aiCallWrapperService.callGenerativeModelWithLogging(aiCallParams, loggingContext);

    if (result && result.text) {
      // jobLogger.info(`Extractor: Raw AI response received`, { responseText: result.text }); // Can be large
      try {
        let jsonText = result.text.trim();
        // Clean potential markdown code fences
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.substring(7); // Remove ```json\n
        }
        if (jsonText.endsWith('```')) {
          jsonText = jsonText.substring(0, jsonText.length - 3);
        }
        jsonText = jsonText.trim();

        const extractedMentions: ExtractedMention[] = JSON.parse(jsonText);

        // Post-processing: Map "Image X" references to sourceContentImageId
        if (mediaType === 'multiple_images' || mediaType === 'single_image') {
          extractedMentions.forEach(mention => {
            const contextPrefixMatch = mention.contextText.match(/^(Image\s*(\d+)\s*Visual):\s*/i);
            if (contextPrefixMatch) {
              const imageNumber = parseInt(contextPrefixMatch[2], 10);
              if (imageNumber > 0 && imageNumber <= images.length) {
                mention.sourceContentImageId = images[imageNumber - 1].id;
                // Optionally, clean the prefix from contextText if desired, or keep for clarity
                // mention.contextText = mention.contextText.replace(contextPrefixMatch[0], ''); 
              }
            }
          });
        }
        jobLogger.info(`Extractor: Successfully parsed and extracted ${extractedMentions.length} mentions (${contentItem.platform}) for URL: ${contentItem.url}`, { mentionCount: extractedMentions.length, platform: contentItem.platform, url: contentItem.url });
        return extractedMentions;
      } catch (parseErr: any) {
        const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        jobLogger.error(`Extractor: Failed to parse AI response JSON`, parseError, { responseText: result.text });
        return [];
      }
    } else {
      jobLogger.warn('Extractor: AI call did not return text or result was null.');
      return [];
    }
  } catch (aiErr: any) {
    const aiError = aiErr instanceof Error ? aiErr : new Error(String(aiErr));
    jobLogger.error(`Extractor: Error during AI call or processing`, aiError);
    return [];
  }
};
