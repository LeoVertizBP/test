import {
    VertexAI,
    GenerativeModel,
    Part,
    GenerateContentRequest, // Keep this for potential structure similarity, but might need adjustment
    // GenerateContentResult is different in this library, we'll use 'any' or define a custom type
    SafetySetting,
    GenerationConfig,
    HarmCategory,
    HarmBlockThreshold,
} from "@google-cloud/vertexai"; // Use the new library
import * as aiUsageLogRepository from '../repositories/aiUsageLogRepository';
import { Prisma } from '../../generated/prisma/client'; // For Prisma.JsonValue
import { debug, info, warn, error, safeStringify } from '../utils/logUtil';

// Initialize the Vertex AI client
// It will automatically use GOOGLE_APPLICATION_CREDENTIALS environment variable
const vertexAI = new VertexAI({
    project: 'ai-compliance', // Explicitly set project ID
    location: 'us-central1',  // Explicitly set location
});

// Define interfaces based on expected usage, might need refinement
// based on how other services call this wrapper

// Define a type for the thinking configuration based on documentation
interface ThinkingConfig {
    thinkingBudget?: number; // Integer between 0 and 24576
    // Add other potential thinking config fields here if discovered
}

// Extend GenerationConfig to include thinkingConfig
type ExtendedGenerationConfig = GenerationConfig & {
    thinkingConfig?: ThinkingConfig;
};

export interface AiCallParams { // Keep export if other services import this type
  modelName: string; // e.g., "gemini-2.5-flash-preview-04-17" or similar Vertex AI model ID
  generationConfig?: ExtendedGenerationConfig; // Use the extended type
  safetySettings?: SafetySetting[];
  // Expect 'parts' array directly from calling services
  parts: Part[];
  tools?: any; // Keep tools flexible for now
}

export interface LoggingContext {
  serviceName: string;
  actionName: string;
  relatedContext?: Prisma.JsonValue;
}

// Define a structure for the return value for consistency
export interface WrapperResult {
    text: string | null;
    usageMetadata: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    } | null;
    // Include the raw response for debugging or more complex use cases if needed
    rawResponse?: any;
    // Add functionCalls if needed, based on VertexAI response structure
    functionCalls?: any;
}


/**
 * Calls a Google Generative AI model via Vertex AI, automatically logging usage and handling errors.
 *
 * @param params - Parameters for the AI call (modelName, parts, config, etc.).
 * @param context - Context for logging (serviceName, actionName, relatedContext).
 * @returns A simplified result object containing text and usage, or null if a critical error occurred.
 */
export const callGenerativeModelWithLogging = async (
  params: AiCallParams,
  context: LoggingContext
): Promise<WrapperResult | null> => {
  // Destructure params
  // Destructure params, including the potentially nested thinkingConfig
  const { modelName, generationConfig, safetySettings, parts, tools } = params;
  const { serviceName, actionName, relatedContext } = context;

  if (!parts || parts.length === 0) {
    error(serviceName, `${actionName}: Error - Parts array is required and cannot be empty.`);
    return null;
  }

  let model: GenerativeModel;
  try {
    // Get the generative model instance from VertexAI client
    // Pass the potentially extended generationConfig which includes thinkingConfig
    model = vertexAI.getGenerativeModel({
        model: modelName,
        safetySettings: safetySettings,
        generationConfig: generationConfig, // Pass the whole config object
        tools: tools // Pass tools if provided
    });
    // Log if thinking budget is being applied
    if (generationConfig?.thinkingConfig?.thinkingBudget !== undefined) {
        info(serviceName, `${actionName}: Applying thinking budget: ${generationConfig.thinkingConfig.thinkingBudget}`);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(serviceName, `${actionName}: Error initializing model ${modelName}`, err);
    // Log initialization error
    await aiUsageLogRepository.createAiUsageLog({
      service_name: serviceName,
      action_name: actionName,
      model_name: modelName,
      input_tokens: 0, output_tokens: 0, total_tokens: 0, status: 'ERROR',
      error_message: `Model initialization failed: ${errorMessage}`,
      related_context: relatedContext ?? Prisma.JsonNull,
    });
    return null;
  }

  const startTime = Date.now();
  let response: any = null; // Use 'any' for now, refine if specific type is known
  let usageMetadata: any = null; // To store usage metadata from response
  let errorOccurred = false;
  let errorMessage: string | null = null;
  let responseText: string | null = null;
  let functionCalls: any = null; // To store function calls
  let finalCandidate: any = null; // Declare candidate outside try block

  // Construct the request object for the new library
  const request: GenerateContentRequest = {
      // Assuming the calling service correctly formats the 'contents' structure
      // If 'parts' is just the array of parts for a single turn, wrap it
      contents: [{ role: "user", parts: parts }],
      // Tools are passed during model initialization in this library version
  };

  try {
    // --- DEBUG LOG: Log input parts ---
    debug(serviceName, `${actionName}: Input parts being sent to model ${modelName}:`, safeStringify(parts));
    // --- END DEBUG LOG ---
    info(serviceName, `${actionName}: Calling model ${modelName} via Vertex AI...`);
    // Use generateContentStream for potentially long responses / function calling
    const streamResult = await model.generateContentStream(request);

    // Aggregate response from stream
    let aggregatedResponse: any = null;
    for await (const item of streamResult.stream) {
        if (!aggregatedResponse) {
            aggregatedResponse = item;
        } else {
            // Aggregate text
             if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                 if (!aggregatedResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
                     // Initialize if the first part didn't have text
                     if (!aggregatedResponse.candidates) aggregatedResponse.candidates = [{}];
                     if (!aggregatedResponse.candidates[0].content) aggregatedResponse.candidates[0].content = { parts: [{}] };
                     if (!aggregatedResponse.candidates[0].content.parts) aggregatedResponse.candidates[0].content.parts = [{}];
                     if (!aggregatedResponse.candidates[0].content.parts[0]) aggregatedResponse.candidates[0].content.parts[0] = { text: '' };
                 }
                 // Ensure parts array exists before appending text
                 if (!aggregatedResponse.candidates?.[0]?.content?.parts) {
                     if (!aggregatedResponse.candidates) aggregatedResponse.candidates = [{}];
                     if (!aggregatedResponse.candidates[0].content) aggregatedResponse.candidates[0].content = {};
                     aggregatedResponse.candidates[0].content.parts = [];
                 }
                 // Find or create the text part to append to
                 let textPart = aggregatedResponse.candidates[0].content.parts.find((p: Part) => p.text !== undefined);
                 if (!textPart) {
                     textPart = { text: '' };
                     aggregatedResponse.candidates[0].content.parts.push(textPart);
                 }
                 textPart.text += item.candidates[0].content.parts[0].text;
             }
             // Aggregate function calls by adding parts containing function calls
             const functionCallParts = item.candidates?.[0]?.content?.parts?.filter((part: Part) => part.functionCall !== undefined);
             if (functionCallParts && functionCallParts.length > 0) {
                  if (!aggregatedResponse.candidates?.[0]?.content?.parts) {
                     if (!aggregatedResponse.candidates) aggregatedResponse.candidates = [{}];
                     if (!aggregatedResponse.candidates[0].content) aggregatedResponse.candidates[0].content = {};
                     aggregatedResponse.candidates[0].content.parts = [];
                 }
                 aggregatedResponse.candidates[0].content.parts.push(...functionCallParts);
             }
             // Aggregate usage metadata
             if (item.usageMetadata) {
                 aggregatedResponse.usageMetadata = item.usageMetadata;
             }
             // Explicitly capture finishReason and safetyRatings if present in the current chunk
             if (item.candidates?.[0]?.finishReason) {
                 if (!aggregatedResponse.candidates) aggregatedResponse.candidates = [{}];
                 aggregatedResponse.candidates[0].finishReason = item.candidates[0].finishReason;
             }
             if (item.candidates?.[0]?.safetyRatings) {
                 if (!aggregatedResponse.candidates) aggregatedResponse.candidates = [{}];
                 aggregatedResponse.candidates[0].safetyRatings = item.candidates[0].safetyRatings;
             }
        }
    }
    response = aggregatedResponse; // The final aggregated response object

    // Extract key info
    finalCandidate = response?.candidates?.[0]; // Assign to outer scope variable
    const contentParts = finalCandidate?.content?.parts ?? []; // Get parts array safely

    // Find the first part that has text
    responseText = contentParts.find((part: Part) => part.text !== undefined)?.text ?? null;
    // Find parts that contain function calls - Access part.functionCall directly
    const functionCallParts = contentParts.filter((part: Part) => part.functionCall !== undefined);
    functionCalls = functionCallParts.length > 0 ? functionCallParts.map((part: Part) => part.functionCall) : null; // Extract functionCall objects

    // --- DEBUG LOG: Log extracted response text ---
    debug(serviceName, `${actionName}: Extracted responseText from model ${modelName}:`, responseText);
    // --- END DEBUG LOG ---

    usageMetadata = response?.usageMetadata;

    // Handle different finish reasons
    const finishReason = finalCandidate?.finishReason;
    if (finishReason === 'SAFETY') {
         warn(serviceName, `${actionName}: Model call blocked due to safety settings.`);
         errorMessage = `Content blocked due to safety settings (Reason: ${finishReason})`;
         // errorOccurred = true; // Treat blocking as an error? Optional.
    } else if (finishReason === 'RECITATION') {
         warn(serviceName, `${actionName}: Model call blocked due to potential recitation.`);
         errorMessage = `Content blocked due to potential recitation (Reason: ${finishReason})`;
         // errorOccurred = true; // Treat blocking as an error? Optional.
    } else if (finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS' && (!functionCalls || functionCalls.length === 0)) {
        // Log unexpected finish reasons if not STOP, MAX_TOKENS, or a function call
        warn(serviceName, `${actionName}: Model call finished with unexpected reason: ${finishReason}`);
        if (!errorMessage) errorMessage = `Model finished with reason: ${finishReason}`;
    }

    if (functionCalls && functionCalls.length > 0) {
        info(serviceName, `${actionName}: Model returned ${functionCalls.length} function call(s).`);
        responseText = null; // No direct text response when function call is present
    }

    if (!errorOccurred && !errorMessage) {
        info(serviceName, `${actionName}: Model call successful.`);
    }


  } catch (err: unknown) {
    errorOccurred = true;
    if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = String(err.message);
    } else {
        errorMessage = String(err);
    }
    error(serviceName, `${actionName}: Error calling model ${modelName} via Vertex AI`, { error: errorMessage });
    usageMetadata = null; // Reset usage on error
  }

  const endTime = Date.now();
  const latencyMs = endTime - startTime;

  // Prepare payloads for logging
  let requestPayloadStr: string | null = null;
  let responsePayloadStr: string | null = null;
  try {
    // Log the full request object
    requestPayloadStr = safeStringify(request); // Log the full request object
  } catch (e) { error('aiCallWrapperService', `Error serializing request payload`, e); requestPayloadStr = '{"error": "Serialization failed"}'; }
  try {
    // Log the full response object
    responsePayloadStr = safeStringify(response); // Log the full aggregated response object
  } catch (e) { error('aiCallWrapperService', `Error serializing response payload`, e); responsePayloadStr = '{"error": "Serialization failed"}'; }


  // Log usage details
  await aiUsageLogRepository.createAiUsageLog({
    service_name: serviceName,
    action_name: actionName,
    model_name: modelName,
    input_tokens: usageMetadata?.promptTokenCount ?? 0,
    output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
    total_tokens: usageMetadata?.totalTokenCount ?? 0,
    latency_ms: latencyMs,
    status: errorOccurred ? 'ERROR' : (errorMessage ? 'BLOCKED' : 'SUCCESS'), // Refined status
    error_message: errorMessage,
    related_context: relatedContext ?? Prisma.JsonNull,
    request_payload: requestPayloadStr, // Logged simplified request
    response_payload: responsePayloadStr,
  });

  // Return the simplified result
  if (errorOccurred) {
      return null; // Indicate critical failure
  } else {
      return {
          text: responseText,
          usageMetadata: usageMetadata ? { // Map to expected structure
              promptTokenCount: usageMetadata.promptTokenCount,
              candidatesTokenCount: usageMetadata.candidatesTokenCount,
              totalTokenCount: usageMetadata.totalTokenCount,
          } : null,
          rawResponse: response, // Return the raw aggregated response
          functionCalls: functionCalls // Return function calls if present
      };
  }
};
// Removed extra closing brace
