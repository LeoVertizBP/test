import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as organizationService from '../services/organizationService';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Apply auth middleware to all system settings routes
router.use(authenticateToken);

/**
 * @route   POST /api/system-settings/ai-bypass-threshold
 * @desc    Set the AI bypass settings (threshold, actions, retroactive) for the user's organization
 * @access  Private
 */
router.post('/ai-bypass-threshold', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId; // Get user ID for audit logging

    if (!organizationId || !userId) {
        return res.status(401).json({ message: 'Unauthorized: Organization or User ID not found.' });
    }

    const { threshold, autoApproveCompliant, autoRemediateViolation, applyRetroactively } = req.body;

    // Validate threshold (allow null to disable)
    if (threshold !== null && (typeof threshold !== 'number' || threshold < 0 || threshold > 100)) {
        return res.status(400).json({ message: 'Threshold must be a number between 0 and 100, or null to disable.' });
    }
    // Validate booleans
    if (typeof autoApproveCompliant !== 'boolean' || typeof autoRemediateViolation !== 'boolean' || typeof applyRetroactively !== 'boolean') {
        return res.status(400).json({ message: 'autoApproveCompliant, autoRemediateViolation, and applyRetroactively must be boolean values.' });
    }

    try {
        const result = await organizationService.updateAiBypassSettings(
            organizationId,
            userId, // Pass userId for audit log
            threshold,
            autoApproveCompliant,
            autoRemediateViolation,
            applyRetroactively
        );
        res.json({
            message: 'AI bypass settings updated successfully.',
            settings: result.settings // Return the updated settings object
        });
    } catch (error: any) {
        console.error('Error updating AI bypass settings:', error);
        res.status(500).json({ message: error.message || 'Failed to update AI bypass settings.' });
    }
}));

/**
 * @route   GET /api/system-settings/ai-bypass-settings
 * @desc    Get the current AI bypass settings for the user's organization
 * @access  Private
 */
router.get('/ai-bypass-settings', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized: Organization ID not found.' });
    }

    try {
        const settings = await organizationService.getAiBypassSettings(organizationId);
        res.json(settings);
    } catch (error: any) {
        console.error('Error fetching AI bypass settings:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch AI bypass settings.' });
    }
}));

/**
 * @route   POST /api/system-settings/revert-auto-bypass
 * @desc    Revert the last batch of flags automatically processed by the AI bypass worker
 * @access  Private
 */
router.post('/revert-auto-bypass', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId; // Get user ID for audit logging

    if (!organizationId || !userId) {
        return res.status(401).json({ message: 'Unauthorized: Organization or User ID not found.' });
    }

    try {
        const result = await organizationService.revertLastAiBypassBatch(organizationId, userId);
        res.json({ message: `Successfully reverted ${result.revertedCount} flags to PENDING status.` });
    } catch (error: any) {
        console.error('Error reverting last AI bypass batch:', error);
        res.status(500).json({ message: error.message || 'Failed to revert last AI bypass batch.' });
    }
}));


export default router;
