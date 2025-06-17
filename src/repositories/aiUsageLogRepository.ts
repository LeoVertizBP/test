import prisma from '../utils/prismaClient';
import { Prisma } from '../../generated/prisma/client';

/**
 * Creates a new AI usage log entry.
 *
 * @param data - The data for the new AI usage log entry.
 *               Must include: service_name, action_name, model_name, input_tokens, output_tokens, total_tokens.
 *               Can optionally include: latency_ms, cost, status, error_message, related_context.
 * @returns The created ai_usage_logs record.
 */
export const createAiUsageLog = async (data: Prisma.ai_usage_logsUncheckedCreateInput) => {
  try {
    // --- DEBUGGING RECEIVED DATA ---
    console.log(`[aiUsageLogRepository] Received data for ${data.service_name}/${data.action_name}.`);
    console.log(`[aiUsageLogRepository] DEBUG: Received request_payload (type: ${typeof data.request_payload}, length: ${data.request_payload?.length ?? 'N/A'}): ${data.request_payload?.substring(0, 100) ?? 'null or undefined'}`);
    console.log(`[aiUsageLogRepository] DEBUG: Received response_payload (type: ${typeof data.response_payload}, length: ${data.response_payload?.length ?? 'N/A'}): ${data.response_payload?.substring(0, 100) ?? 'null or undefined'}`);
    // --- END DEBUGGING ---

    const logEntry = await prisma.ai_usage_logs.create({
      data: {
        service_name: data.service_name,
        action_name: data.action_name,
        model_name: data.model_name,
        input_tokens: data.input_tokens,
        output_tokens: data.output_tokens,
        total_tokens: data.total_tokens,
        latency_ms: data.latency_ms,
        cost: data.cost,
        status: data.status ?? 'SUCCESS', // Default to SUCCESS if not provided
        error_message: data.error_message,
        related_context: data.related_context ?? Prisma.JsonNull, // Use Prisma.JsonNull for optional JSON
        request_payload: data.request_payload,   // ADDED
        response_payload: data.response_payload, // ADDED
        correlation_id: data.correlation_id,     // ADDED (will be null if not passed)
        // timestamp is handled by @default(now())
      },
    });
    console.log(`Created AI usage log entry: ${logEntry.id} for ${data.service_name}/${data.action_name}`);
    return logEntry;
  } catch (error) {
    console.error('Error creating AI usage log entry:', error);
    // Decide how to handle logging errors - rethrow, return null, etc.
    // For now, just log and potentially let the caller handle undefined/null return
    // Rethrowing might halt the main process, which might not be desired just for a logging failure.
    // Consider adding more robust error handling/logging later if needed.
    return null;
  }
};

// Potential future functions:
// export const getUsageLogsByService = async (serviceName: string) => { ... };
// export const getTotalTokensForPeriod = async (startDate: Date, endDate: Date) => { ... };
