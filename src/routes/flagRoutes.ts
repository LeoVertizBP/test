import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Removed authorizeRoles, added DecodedPayload
import * as flagRepository from '../repositories/flagRepository';
import asyncHandler from '../utils/asyncHandler'; // Utility to handle async errors
import { FlagStatus, HumanVerdict } from '../../generated/prisma/client'; // Import enums, removed UserRole
import { evaluateAndSelectExample } from '../services/aiExampleManagerService'; // Import the manager function
import { Prisma } from '../../generated/prisma/client'; // Import Prisma types for WhereInput
import { validate as uuidValidate } from 'uuid'; // Import UUID validation function
import flagControllerInstance from '../controllers/flagController'; // Import the new controller instance

// Define UserRole constants (replace with a central enum/type if available)
const UserRole = {
    ADMIN: 'ADMIN',
    REVIEWER: 'REVIEWER',
    PUBLISHER: 'PUBLISHER',
    // Add other roles as needed
};

// Basic role authorization middleware (can be moved to authMiddleware.ts later)
const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => { // Added void return type
        if (!req.user || !req.user.role) {
            res.status(403).json({ message: 'Forbidden: Role not found in token.' });
            return; // Explicit return
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
            return; // Explicit return
        }
        next();
    };
};

const router = express.Router();

// GET /api/flags - Retrieve flags with filtering
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Extract filter parameters from query string
    const {
        status,
        scanJobId,
        publisherId,
        productId,
        ruleId,
        aiRuling,
        humanVerdict,
        assigneeId, // Note: assigneeId filtering is not implemented yet
        startDate,
        endDate,
        platform // Changed from channelId to platform
    } = req.query;

    // Construct Prisma WhereInput object based on provided filters
    const where: Prisma.flagsWhereInput = {};

    // --- Direct Flag Filters ---
    if (status && Object.values(FlagStatus).includes(status as FlagStatus)) {
        where.status = status as FlagStatus;
    }
    if (ruleId) {
        if (typeof ruleId !== 'string' || !uuidValidate(ruleId)) {
            return res.status(400).json({ message: `Invalid ruleId format. Must be a valid UUID.` });
        }
        // Assuming ruleId is directly on the flags table
        where.rule_id = ruleId;
    }
    if (aiRuling) {
        where.ai_ruling = aiRuling as string; // Assuming aiRuling is not an ID
    }
    if (humanVerdict && Object.values(HumanVerdict).includes(humanVerdict as HumanVerdict)) {
        where.human_verdict = humanVerdict as HumanVerdict;
    }
    if (productId) {
        if (typeof productId !== 'string' || !uuidValidate(productId)) {
            return res.status(400).json({ message: `Invalid productId format. Must be a valid UUID.` });
        }
        // Filter by related product ID
        where.product_id = productId;
    }
    // TODO: Add filtering for assigneeId (requires joining users table or direct ID)
    if (assigneeId) {
        if (typeof assigneeId !== 'string' || !uuidValidate(assigneeId)) {
            return res.status(400).json({ message: `Invalid assigneeId format. Must be a valid UUID.` });
        }
        // Assuming assigneeId is directly on the flags table or handled via relation
        // where.assignee_id = assigneeId; // Adjust based on schema
    }

    // --- Date Filters ---
    if (startDate) {
        // Ensure where.created_at is an object before adding properties
        if (typeof where.created_at !== 'object' || where.created_at === null) {
            where.created_at = {};
        }
        // Cast to DateTimeFilter to satisfy TypeScript
        (where.created_at as Prisma.DateTimeFilter).gte = new Date(startDate as string);
    }
    if (endDate) {
        // Ensure where.created_at is an object before adding properties
        if (typeof where.created_at !== 'object' || where.created_at === null) {
            where.created_at = {};
        }
        // Add 1 day to endDate to make it inclusive of the selected day
        const inclusiveEndDate = new Date(endDate as string);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
        (where.created_at as Prisma.DateTimeFilter).lt = inclusiveEndDate; // Use 'lt' (less than) the start of the next day
    }

    // --- Related Content Item Filters ---
    // These require filtering on the related content_items table
    const contentItemWhere: Prisma.content_itemsWhereInput = {};
    let hasContentItemFilter = false;

    if (scanJobId) {
        if (typeof scanJobId !== 'string' || !uuidValidate(scanJobId)) {
            return res.status(400).json({ message: `Invalid scanJobId format. Must be a valid UUID.` });
        }
        contentItemWhere.scan_job_id = scanJobId;
        hasContentItemFilter = true;
    }
    if (publisherId) {
        if (typeof publisherId !== 'string' || !uuidValidate(publisherId)) {
            return res.status(400).json({ message: `Invalid publisherId format. Must be a valid UUID.` });
        }
        contentItemWhere.publisher_id = publisherId;
        hasContentItemFilter = true;
    }
    if (platform) {
        // Filter by platform on the content_items table
        // Use case-insensitive matching for flexibility
        contentItemWhere.platform = {
            equals: platform as string,
            mode: 'insensitive'
        };
        hasContentItemFilter = true;
    }

    // If any content item filters exist, add them to the main 'where' clause
    if (hasContentItemFilter) {
        where.content_items = {
            is: contentItemWhere  // Use 'is' for one-to-one relation between flags and content_items
        };
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string, 10) || undefined;
    const pageSize = parseInt(req.query.pageSize as string, 10) || undefined;

    // Fetch flags using the repository function
    const result = await flagRepository.findFlags(where, page, pageSize);

    if (Array.isArray(result)) {
        // Non-paginated result (original behavior)
        res.json(result);
    } else {
        // Paginated result
        const { data, totalFlags } = result;
        const totalPages = pageSize ? Math.ceil(totalFlags / pageSize) : 1;
        res.json({
            data,
            totalFlags,
            currentPage: page || 1,
            pageSize: pageSize || totalFlags, // If pageSize wasn't given but it was paginated, assume all items
            totalPages,
        });
    }
}));


// Input validation middleware (basic example, could use a library like Joi or Zod)
const validateFlagUpdate = (req: Request, res: Response, next: NextFunction) => {
    const { status, human_verdict } = req.body;

    // Validate Status
    if (!status || !Object.values(FlagStatus).includes(status as FlagStatus)) {
        res.status(400).json({ message: `Invalid status value. Must be one of: ${Object.values(FlagStatus).join(', ')}` });
        return; // Explicitly return after sending response
    }

    // Validate Human Verdict (if provided)
    if (human_verdict !== undefined && human_verdict !== null && !Object.values(HumanVerdict).includes(human_verdict as HumanVerdict)) {
        res.status(400).json({ message: `Invalid human_verdict value. Must be one of: ${Object.values(HumanVerdict).join(', ')} or null` });
        return; // Explicitly return after sending response
    }

    // Add more validation for notes fields if needed (e.g., length checks)

    next(); // Proceed if validation passes
};

// GET /api/flags/:flagId - Retrieve a specific flag by ID
router.get('/:flagId', authenticateToken, asyncHandler(flagControllerInstance.getFlagById));

// PATCH /api/flags/:flagId - Update flag review status
router.patch('/:flagId', authenticateToken, validateFlagUpdate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const flagId = req.params.flagId;
    const reviewerId = req.user?.userId; // Get user ID from authenticated request

    if (!reviewerId) {
        // This should technically not happen if authenticateToken works correctly
        return res.status(401).json({ message: 'Authentication error: User ID not found.' });
    }

    const {
        status,
        human_verdict,
        human_verdict_reasoning,
        ai_feedback_notes,
        internal_notes
    } = req.body;

    // Prepare the update data object matching the repository function's expectation
    const updateData = {
        status: status as FlagStatus, // Cast to enum type after validation
        human_verdict: human_verdict as HumanVerdict | null | undefined, // Cast after validation
        human_verdict_reasoning: human_verdict_reasoning,
        ai_feedback_notes: ai_feedback_notes,
        internal_notes: internal_notes,
    };

    try {
        const updatedFlag = await flagRepository.updateFlagReviewStatus(flagId, reviewerId, updateData);

        // After successful update, check if the status was set to CLOSED
        if (status === FlagStatus.CLOSED) {
            console.log(`Flag ${flagId} closed, triggering AI example evaluation.`);
            // Trigger evaluation asynchronously (don't wait for it to complete)
            evaluateAndSelectExample(flagId).catch(err => {
                // Log errors from the async evaluation, but don't fail the API response
                console.error(`Error during background AI example evaluation for flag ${flagId}:`, err);
            });
        }

        res.json(updatedFlag);
    } catch (error: any) {
         // Handle specific errors like 'Flag not found'
         if (error.message?.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }
        // Log unexpected errors for debugging
        console.error(`Error updating flag ${flagId}:`, error);
        // Re-throw other errors to be caught by the global error handler via asyncHandler
        throw error;
    }
}));

// POST /api/flags/:flagId/comments - Add a comment to a flag by a reviewer/admin
router.post(
    '/:flagId/comments',
    authenticateToken,
    authorizeRoles(UserRole.REVIEWER, UserRole.ADMIN, UserRole.PUBLISHER), // Ensure UserRole is correctly imported and used by authorizeRoles
    asyncHandler(flagControllerInstance.addCommentByReviewer)
);

// DELETE /api/flags/:flagId/comments/:commentId - Delete a comment
router.delete(
    '/:flagId/comments/:commentId',
    authenticateToken,
    authorizeRoles(UserRole.ADMIN, UserRole.REVIEWER), // Admins or Reviewers (service will check ownership for reviewers)
    asyncHandler(flagControllerInstance.deleteComment)
);

// DELETE /api/flags/:flagId - Delete a flag
router.delete(
    '/:flagId',
    authenticateToken,
    authorizeRoles(UserRole.ADMIN, UserRole.REVIEWER), // Only Admins or Reviewers can delete flags
    asyncHandler(flagControllerInstance.deleteFlag)
);

export default router;
