import { Job } from 'bullmq';
import prisma from '../utils/prismaClient';
import * as organizationService from '../services/organizationService';
import { Prisma } from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Define the expected job data structure
interface RetroactiveBypassJobData {
    organizationId: string;
    settingsLogId: string; // The audit log ID of the settings change that triggered this
}

/**
 * Processes existing PENDING flags for a given organization based on its current AI bypass settings.
 * This worker is triggered manually when settings are saved with "Apply Retroactively".
 *
 * @param job - The BullMQ job object containing organizationId and settingsLogId.
 */
const retroactiveBypassProcessor = async (job: Job<RetroactiveBypassJobData, any, string>): Promise<void> => {
    const { organizationId, settingsLogId } = job.data;
    console.log(`[RetroactiveBypassWorker] Starting retroactive processing for organizationId: ${organizationId}, triggered by settingsLogId: ${settingsLogId}`);

    try {
        // 1. Fetch Org Settings (these are the settings that were just saved and triggered this job)
        const orgSettings = await organizationService.getAiBypassSettings(organizationId);

        if (orgSettings.threshold === null || (!orgSettings.autoApproveCompliantEnabled && !orgSettings.autoRemediateViolationEnabled)) {
            console.log(`[RetroactiveBypassWorker] AI bypass is not configured or enabled for organization ${organizationId}. Skipping retroactive processing.`);
            await job.updateProgress(100);
            return;
        }
        const thresholdDecimal = new Decimal(orgSettings.threshold / 100);

        // 2. Fetch PENDING Flags for the entire organization
        // Query based on: flags -> content_items -> publishers -> organization_id
        const flagsToProcess = await prisma.flags.findMany({
            where: {
                status: 'PENDING',
                ai_confidence: { gte: 0 }, // Ensures ai_confidence is not null and is a number
                content_items: { // Navigate through relations
                    publishers: { // Corrected: relation is 'publishers'
                        organization_id: organizationId
                    }
                }
            },
            select: {
                id: true,
                ai_confidence: true,
                ai_ruling: true,
                content_items: { // Select scan_job_id via content_items
                    select: {
                        scan_job_id: true
                    }
                }
            }
        });

        if (flagsToProcess.length === 0) {
            console.log(`[RetroactiveBypassWorker] No PENDING flags with AI confidence found for organization ${organizationId}.`);
            await job.updateProgress(100);
            return;
        }

        console.log(`[RetroactiveBypassWorker] Found ${flagsToProcess.length} PENDING flags to process for organization ${organizationId}.`);
        let processedCount = 0;

        // 3. Process Flags
        for (const flag of flagsToProcess) {
            if (flag.ai_confidence === null) continue;

            if (flag.ai_confidence.greaterThan(thresholdDecimal)) {
                const aiRuling = flag.ai_ruling?.toLowerCase();
                let updateData: Prisma.flagsUpdateInput | null = null;
                let auditAction: string | null = null;

                if (aiRuling?.includes('compliant') && orgSettings.autoApproveCompliantEnabled) {
                    updateData = {
                        status: 'CLOSED',
                        resolution_method: 'AI_AUTO_CLOSE',
                    };
                    auditAction = "AI Bypass - Auto Closed (Retroactive)";
                } else if (aiRuling?.includes('violation') && orgSettings.autoRemediateViolationEnabled) {
                    updateData = {
                        status: 'REMEDIATING',
                        resolution_method: 'AI_AUTO_REMEDIATE',
                    };
                    auditAction = "AI Bypass - Auto Remediate (Retroactive)";
                }

                if (updateData && auditAction) {
                    try {
                        await prisma.$transaction(async (tx) => {
                            await tx.flags.update({
                                where: { id: flag.id },
                                data: updateData!
                            });
                            await tx.audit_logs.create({
                                data: {
                                    action: auditAction!,
                                    details: {
                                        flag_id: flag.id,
                                        scan_job_id: flag.content_items?.scan_job_id, // Access via content_items
                                        original_ai_confidence: flag.ai_confidence!.toNumber(),
                                        original_ai_ruling: flag.ai_ruling
                                    },
                                    triggering_event_log_id: settingsLogId, // Link to the settings event
                                    // user_id: null, // System action
                                }
                            });
                        });
                        processedCount++;
                        console.log(`[RetroactiveBypassWorker] Flag ${flag.id} processed: ${auditAction}`);
                    } catch (e: any) {
                        console.error(`[RetroactiveBypassWorker] Error processing flag ${flag.id}: ${e.message}`);
                        await job.log(`Error processing flag ${flag.id}: ${e.message}`);
                        // Continue to next flag
                    }
                }
            }
        }

        console.log(`[RetroactiveBypassWorker] Finished retroactive processing for organization ${organizationId}. ${processedCount} flags actioned.`);
        await job.updateProgress(100); // Mark job as complete

    } catch (error: any) {
        console.error(`[RetroactiveBypassWorker] Critical error during retroactive processing for organization ${organizationId}: ${error.message}`);
        await job.log(`Critical error: ${error.message}`);
        throw error; // Rethrow to let BullMQ handle retry logic
    }
};

// Export the processor function for BullMQ
export default retroactiveBypassProcessor;

// TODO:
// 1. Set up BullMQ queue (`retroactiveBypassQueue`) and register this worker.
// 2. Ensure the `organizationService.updateAiBypassSettings` function correctly adds a job
//    to this queue when `applyRetroactively` is true (the TODO for this is already in organizationService.ts).
