import { organizations as Organization, Prisma, flags as Flag, audit_logs as AuditLog } from '../../generated/prisma/client';
import * as organizationRepository from '../repositories/organizationRepository';
import prisma from '../utils/prismaClient'; // Now needed for audit logs and direct flag updates
import { Decimal } from '@prisma/client/runtime/library';
import { retroactiveBypassQueue, RETROACTIVE_BYPASS_QUEUE_NAME } from '../workers/queueRegistry';

/**
 * Creates a new organization.
 * @param orgData - Data for the new organization (requires 'name').
 * @returns The newly created organization object.
 */
export const createOrganization = async (orgData: Prisma.organizationsCreateInput): Promise<Organization> => {
    // Service layer validation could go here (e.g., check if name is unique)
    // For now, we rely on the repository's basic check and database constraints.
    return organizationRepository.createOrganization(orgData);
};

/**
 * Retrieves a single organization by its ID.
 * @param id - The UUID of the organization.
 * @returns The organization object or null if not found.
 */
export const getOrganizationById = async (id: string): Promise<Organization | null> => {
    return organizationRepository.getOrganizationById(id);
};

/**
 * Retrieves all organizations.
 * @returns An array of all organization objects.
 */
export const getAllOrganizations = async (): Promise<Organization[]> => {
    // Future: Add pagination logic here if needed
    return organizationRepository.getAllOrganizations();
};

/**
 * Updates an existing organization.
 * @param id - The UUID of the organization to update.
 * @param updateData - An object containing the fields to update.
 * @returns The updated organization object.
 */
export const updateOrganization = async (id: string, updateData: Prisma.organizationsUpdateInput): Promise<Organization> => {
    // Service layer validation or logic before update could go here
    return organizationRepository.updateOrganization(id, updateData);
};

/**
 * Deletes an organization by its ID.
 * @param id - The UUID of the organization to delete.
 * @returns The deleted organization object.
 */
export const deleteOrganization = async (id: string): Promise<Organization> => {
    // Service layer logic before deletion could go here
    // (e.g., check if organization has associated users/data and prevent deletion if necessary)
    return organizationRepository.deleteOrganization(id);
};

/**
 * Updates the AI bypass threshold for a specific organization.
 * @param organizationId - The UUID of the organization to update.
 * @param organizationId - The UUID of the organization to update.
 * @param userId - The UUID of the user performing the update (for audit log).
 * @param threshold - The new AI bypass threshold value (0-100) or null to disable.
 * @param autoApproveCompliant - Whether to auto-close compliant flags.
 * @param autoRemediateViolation - Whether to auto-remediate violation flags.
 * @param applyRetroactively - Whether to trigger the retroactive worker.
 * @returns An object containing the updated settings.
 */
export const updateAiBypassSettings = async (
    organizationId: string,
    userId: string,
    threshold: number | null,
    autoApproveCompliant: boolean,
    autoRemediateViolation: boolean,
    applyRetroactively: boolean
): Promise<{ settings: any }> => { // Define a more specific return type if needed
    // Validate threshold (already done in route, but good practice)
    if (threshold !== null && (typeof threshold !== 'number' || threshold < 0 || threshold > 100)) {
        throw new Error('Threshold must be a number between 0 and 100, or null.');
    }

    // Convert threshold to Decimal or null
    const dbThreshold = threshold === null ? null : new Decimal(threshold / 100);

    // If threshold is null, disable actions regardless of input
    const finalAutoApprove = threshold !== null ? autoApproveCompliant : false;
    const finalAutoRemediate = threshold !== null ? autoRemediateViolation : false;

    const updateData: Prisma.organizationsUpdateInput = {
        auto_approval_threshold: dbThreshold,
        auto_approve_compliant_enabled: finalAutoApprove,
        auto_remediate_violation_enabled: finalAutoRemediate,
    };

    // Use a transaction to ensure atomicity of org update and audit log
    const result = await prisma.$transaction(async (tx) => {
        const updatedOrganization = await organizationRepository.updateOrganization(organizationId, updateData, tx);

        const auditAction = threshold === null ? "AI Bypass Settings Cleared" : "AI Bypass Settings Updated";
        const auditDetails = {
            organizationId: organizationId,
            newThreshold: threshold, // Store original 0-100 value or null
            newAutoApproveCompliant: finalAutoApprove,
            newAutoRemediateViolation: finalAutoRemediate,
            applyRetroactively: applyRetroactively // Log if retroactive was requested
        };

        const auditLog = await tx.audit_logs.create({
            data: {
                action: auditAction,
                details: auditDetails,
                user_id: userId,
            }
        });

        // Trigger retroactive worker if requested and settings are enabled
        if (applyRetroactively && dbThreshold !== null && (finalAutoApprove || finalAutoRemediate)) {
            const settingsLogId = auditLog.id;
            // Add job to the retroactiveBypassQueue
            await retroactiveBypassQueue.add(
                `retroactive-bypass-${organizationId}-${Date.now()}`, // Job name/ID
                { organizationId, settingsLogId }, // Job data
                { jobId: `retroactive-${organizationId}-${settingsLogId}` } // Optional: custom job ID for idempotency/tracking
            );
            console.log(`[OrganizationService] Job added to ${RETROACTIVE_BYPASS_QUEUE_NAME} for organization ${organizationId}, settingsLogId ${settingsLogId}`);
        }

        return { updatedOrganization, settingsLogId: auditLog.id };
    });


    // Return the relevant settings in the desired format
    const returnSettings = {
        threshold: result.updatedOrganization.auto_approval_threshold ? parseFloat(result.updatedOrganization.auto_approval_threshold.toString()) * 100 : null,
        autoApproveCompliantEnabled: result.updatedOrganization.auto_approve_compliant_enabled ?? false,
        autoRemediateViolationEnabled: result.updatedOrganization.auto_remediate_violation_enabled ?? false,
    };

    return { settings: returnSettings };
};


/**
 * Retrieves the current AI bypass settings for an organization.
 * @param organizationId - The UUID of the organization.
 * @returns An object containing the current settings.
 */
export const getAiBypassSettings = async (organizationId: string): Promise<{
    threshold: number | null;
    autoApproveCompliantEnabled: boolean;
    autoRemediateViolationEnabled: boolean;
}> => {
    // Construct the options object to satisfy TypeScript's expectation for the second parameter
    // of the generic getOrganizationById repository function.
    const repoOptions: Prisma.organizationsFindUniqueArgs = {
        where: { id: organizationId }, // Satisfy the 'where' requirement for the type
        select: {
            auto_approval_threshold: true,
            auto_approve_compliant_enabled: true,
            auto_remediate_violation_enabled: true,
        }
    };
    
    // The repository function getOrganizationById(id, options) will internally use its 'id' parameter
    // for its primary 'where' clause, and spread 'options'.
    // This call should now satisfy the type checker.
    const organization = await organizationRepository.getOrganizationById(organizationId, repoOptions);

    if (!organization) {
        throw new Error('Organization not found.');
    }

    // Accessing properties directly should be safe if the select is effective and types are up-to-date.
    const threshold = organization.auto_approval_threshold
        ? parseFloat(organization.auto_approval_threshold.toString()) * 100
        : null;

    return {
        threshold: threshold,
        autoApproveCompliantEnabled: organization.auto_approve_compliant_enabled ?? false, // These should exist due to select
        autoRemediateViolationEnabled: organization.auto_remediate_violation_enabled ?? false, // These should exist due to select
    };
};


/**
 * Reverts the last batch of flags automatically processed by the AI bypass worker
 * based on the most recent settings change event for the organization.
 * @param organizationId - The UUID of the organization.
 * @param userId - The UUID of the user performing the revert (for audit log).
 * @returns An object containing the count of reverted flags.
 */
export const revertLastAiBypassBatch = async (organizationId: string, userId: string): Promise<{ revertedCount: number }> => {

    // 1. Find the most recent "AI Bypass Settings Updated/Cleared" audit log for this org
    // The 'details' field is JSON, so we need to cast it for path-based querying if not using Prisma's JSON operators directly.
    // However, Prisma's JSON filtering should work as { path: ['key'], equals: 'value' }
    const latestSettingsLog = await prisma.audit_logs.findFirst({
        where: {
            action: { startsWith: "AI Bypass Settings" },
            details: {
                path: ['organizationId'], // Path to the key within the JSON details
                equals: organizationId    // Value to match
            }
        },
        orderBy: { created_at: 'desc' },
        select: { id: true }
    });

    if (!latestSettingsLog) {
        // No settings change found, nothing to revert based on
        return { revertedCount: 0 };
    }
    const latestSettingsLogId = latestSettingsLog.id;

    // 2. Find all "AI Bypass - Auto Closed/Remediate" audit logs linked to that settings event
    const flagUpdateLogs = await prisma.audit_logs.findMany({
        where: {
            triggering_event_log_id: latestSettingsLogId,
            action: { in: [
                "AI Bypass - Auto Closed", 
                "AI Bypass - Auto Remediate",
                "AI Bypass - Auto Closed (Retroactive)",
                "AI Bypass - Auto Remediate (Retroactive)"
            ]}
        },
        select: { details: true } // Select details which should contain flag_id
    });

    if (flagUpdateLogs.length === 0) {
        // No flags were processed by the last settings change
        return { revertedCount: 0 };
    }

    // 3. Extract unique flag IDs from the details JSON
    const flagIdsToPotentiallyRevert: string[] = [
        ...new Set(
            flagUpdateLogs
                .map(log => (log.details as Prisma.JsonObject)?.flag_id as string)
                .filter(id => typeof id === 'string') // Filter out any invalid entries
        )
    ];

    if (flagIdsToPotentiallyRevert.length === 0) {
        return { revertedCount: 0 };
    }

    // 4. Fetch the current state of these flags to ensure they were indeed auto-processed
    const flagsToRevert = await prisma.flags.findMany({
        where: {
            id: { in: flagIdsToPotentiallyRevert },
            // Only revert flags that are currently in an auto-processed state
            resolution_method: { in: ['AI_AUTO_CLOSE', 'AI_AUTO_REMEDIATE'] }
        },
        select: { id: true } // Only need IDs for the update
    });

    const finalFlagIdsToRevert = flagsToRevert.map(f => f.id);

    if (finalFlagIdsToRevert.length === 0) {
        // None of the flags linked to the event are currently in a revertible state
        return { revertedCount: 0 };
    }

    // 5. Perform updates and logging in a transaction
    const revertedCount = await prisma.$transaction(async (tx) => {
        // Update flags back to PENDING
        const updateResult = await tx.flags.updateMany({
            where: {
                id: { in: finalFlagIdsToRevert }
            },
            data: {
                status: 'PENDING',
                resolution_method: null, // Clear resolution method
                // Optionally clear other fields like reviewed_at, decision_made_at if they were set by auto-process
                reviewed_at: null,
                decision_made_at: null,
            }
        });

        // Create audit logs for each reverted flag
        const revertAuditLogs = finalFlagIdsToRevert.map(flagId => ({
            action: "AI Bypass Reverted",
            user_id: userId,
            details: {
                "flag_id": flagId,
                "reverted_from_setting_event": latestSettingsLogId
            },
            // Link this revert action back to the original settings event that triggered the auto-processing
            triggering_event_log_id: latestSettingsLogId
        }));

        await tx.audit_logs.createMany({
            data: revertAuditLogs
        });

        return updateResult.count; // Return the number of flags updated
    });

    return { revertedCount };
};
