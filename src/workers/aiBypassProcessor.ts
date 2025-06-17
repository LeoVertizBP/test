import { Job } from 'bullmq';
import prisma from '../utils/prismaClient';
import * as organizationService from '../services/organizationService';
import { Prisma } from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; // Ensure Decimal is imported

// Define the expected job data structure
interface AiBypassJobData {
    scan_job_id: string;
}

/**
 * Processes flags for a given scan job based on the organization's AI bypass settings.
 * This worker is triggered after AI analysis for a scan job is complete.
 *
 * @param job - The BullMQ job object containing scan_job_id.
 */
const aiBypassProcessor = async (job: Job<AiBypassJobData, any, string>): Promise<void> => {
    const { scan_job_id } = job.data;
    console.log(`[AIBypassWorker] Starting processing for scan_job_id: ${scan_job_id}`);

    try {
        // 1. Fetch Job & Org details
        const scanJob = await prisma.scan_jobs.findUnique({
            where: { id: scan_job_id },
            select: {
                id: true,
                bypass_ai_processing: true,
                advertisers: { // Corrected: relation is 'advertisers'
                    select: {
                        organization_id: true // To get the organization_id
                    }
                }
            }
        });

        if (!scanJob) {
            console.error(`[AIBypassWorker] Scan job ${scan_job_id} not found.`);
            await job.updateProgress(100);
            return;
        }

        if (scanJob.bypass_ai_processing) {
            console.log(`[AIBypassWorker] AI bypass is explicitly disabled for scan_job_id: ${scan_job_id}. Skipping.`);
            await job.updateProgress(100);
            return;
        }

        const organizationId = scanJob.advertisers?.organization_id; // Corrected: access via 'advertisers'

        if (!organizationId) {
            console.error(`[AIBypassWorker] Organization ID could not be determined for scan_job_id: ${scan_job_id} via advertisers relation. Cannot proceed.`);
            throw new Error(`Organization ID missing for scan job ${scan_job_id}`);
        }

        // 2. Fetch Org Settings
        const orgSettings = await organizationService.getAiBypassSettings(organizationId);

        if (orgSettings.threshold === null || (!orgSettings.autoApproveCompliantEnabled && !orgSettings.autoRemediateViolationEnabled)) {
            console.log(`[AIBypassWorker] AI bypass is not configured or enabled for organization ${organizationId}. Skipping.`);
            await job.updateProgress(100);
            return;
        }
        const thresholdDecimal = new Decimal(orgSettings.threshold / 100);

        // 3. Fetch Settings Log ID (most recent "AI Bypass Settings Updated/Cleared" for the org)
        const latestSettingsLog = await prisma.audit_logs.findFirst({
            where: {
                // Assuming organizationId is stored in details.path = ['organizationId']
                // This might need adjustment based on how organizationId is actually stored in audit_log.details
                // For now, let's assume a direct query on a potential (but non-existent) organization_id field on audit_logs
                // or a JSONB query if details structure is known.
                // The markdown suggests: details: { path: ['organizationId'], equals: organizationId }
                // This requires Prisma JSON filtering capabilities.
                // Let's use a simpler approach if direct org_id isn't on audit_logs,
                // or refine if the JSON structure is confirmed.
                // The `revertLastAiBypassBatch` in `organizationService` uses:
                // details: { path: ['organizationId'], equals: organizationId }
                // So we should try to replicate that if possible, or ensure `organizationId` is a top-level field in `details`.
                // For now, assuming `details` contains `organizationId` as a top-level key for simplicity in this worker.
                // If not, this query needs to be more complex (e.g., using raw query or specific JSON operators).
                // The example in the markdown for `revertLastAiBypassBatch` is:
                // `details: { path: ['organizationId'], equals: organizationId }`
                // Let's assume `details` is a JSON object like `{"organizationId": "..."}`
                 AND: [
                    { details: { path: ['organizationId'], equals: organizationId } },
                    { action: { startsWith: "AI Bypass Settings" } }
                ]
            },
            orderBy: { created_at: 'desc' },
            select: { id: true }
        });

        if (!latestSettingsLog) {
            console.warn(`[AIBypassWorker] No AI Bypass settings audit log found for organization ${organizationId}. Cannot link flag updates.`);
            // Decide if to proceed without linking or fail. For now, proceed with a warning.
        }
        const settingsLogId = latestSettingsLog?.id; // Will be undefined if not found

        // 4. Fetch PENDING Flags for the scan_job_id
        const flagsToProcess = await prisma.flags.findMany({
            where: {
                content_items: { // Filter through the related content_items table
                    scan_job_id: scan_job_id
                },
                status: 'PENDING',
                ai_confidence: { gte: 0 } // Ensures ai_confidence is not null and is a number (assuming scores are non-negative)
            },
            select: {
                id: true,
                ai_confidence: true,
                ai_ruling: true
            }
        });

        if (flagsToProcess.length === 0) {
            console.log(`[AIBypassWorker] No PENDING flags with AI confidence found for scan_job_id: ${scan_job_id}.`);
            await job.updateProgress(100);
            return;
        }

        console.log(`[AIBypassWorker] Found ${flagsToProcess.length} PENDING flags to process for scan_job_id: ${scan_job_id}.`);
        let processedCount = 0;

        // 5. Process Flags
        for (const flag of flagsToProcess) {
            // Ensure ai_confidence is not null and is a Decimal
            if (flag.ai_confidence === null) continue; // Should be caught by query, but double check

            // Compare ai_confidence (Decimal) with thresholdDecimal (Decimal)
            if (flag.ai_confidence.greaterThan(thresholdDecimal)) {
                const aiRuling = flag.ai_ruling?.toLowerCase();
                let updateData: Prisma.flagsUpdateInput | null = null;
                let auditAction: string | null = null;

                if (aiRuling?.includes('compliant') && orgSettings.autoApproveCompliantEnabled) {
                    updateData = {
                        status: 'CLOSED',
                        resolution_method: 'AI_AUTO_CLOSE',
                        // decision_made_at: new Date(), // Optionally set decision time
                        // reviewed_at: new Date(), // Optionally set review time
                    };
                    auditAction = "AI Bypass - Auto Closed";
                } else if (aiRuling?.includes('violation') && orgSettings.autoRemediateViolationEnabled) {
                    updateData = {
                        status: 'REMEDIATING', // Or 'PENDING_REMEDIATION' if that's the correct status
                        resolution_method: 'AI_AUTO_REMEDIATE',
                        // decision_made_at: new Date(), // Optionally set decision time
                    };
                    auditAction = "AI Bypass - Auto Remediate";
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
                                    details: { flag_id: flag.id, scan_job_id: scan_job_id, original_ai_confidence: flag.ai_confidence.toNumber(), original_ai_ruling: flag.ai_ruling },
                                    triggering_event_log_id: settingsLogId, // Link to the settings event
                                    // user_id: null, // System action, no specific user
                                }
                            });
                        });
                        processedCount++;
                        console.log(`[AIBypassWorker] Flag ${flag.id} processed: ${auditAction}`);
                    } catch (e: any) {
                        console.error(`[AIBypassWorker] Error processing flag ${flag.id}: ${e.message}`);
                        await job.log(`Error processing flag ${flag.id}: ${e.message}`);
                        // Continue to next flag
                    }
                }
            }
        }

        console.log(`[AIBypassWorker] Finished processing for scan_job_id: ${scan_job_id}. ${processedCount} flags actioned.`);
        await job.updateProgress(100); // Mark job as complete

    } catch (error: any) {
        console.error(`[AIBypassWorker] Critical error processing scan_job_id ${scan_job_id}: ${error.message}`);
        await job.log(`Critical error: ${error.message}`);
        // Rethrow to let BullMQ handle retry logic based on queue settings
        throw error;
    }
};

// Export the processor function for BullMQ
export default aiBypassProcessor;

// TODO:
// 1. Ensure scan_jobs has organization_id or a reliable way to fetch it.
//    - The current schema for `scan_jobs` shows `advertiser_id String? @db.Uuid`.
//    - `advertisers` has `organization_id String @db.Uuid`.
//    - So, if `scanJob.organization_id` is not direct, it would be `scanJob.advertiser.organization_id`.
//    - This means the initial query for `scanJob` needs to include `advertiser: { select: { organization_id: true } }`.
// 2. Confirm the JSON structure for `audit_logs.details` when settings are updated to ensure
//    `details: { path: ['organizationId'], equals: organizationId }` works as expected for fetching `latestSettingsLog`.
//    The `organizationService.updateAiBypassSettings` logs:
//    `details: { organizationId: organizationId, newThreshold: threshold, ... }`
//    So, `details: { path: ['organizationId'], equals: organizationId }` should work.
// 3. Set up BullMQ queue (`aiBypassQueue`) and register this worker.
// 4. Modify `scanJobService` to add a job to `aiBypassQueue` after AI analysis completes.
