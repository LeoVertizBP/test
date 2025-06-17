import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import asyncHandler from '../utils/asyncHandler';
import { generateMediaAccessUrl } from '../controllers/mediaAccessController';
import * as logger from '../utils/logUtil';

const router = express.Router();
const MODULE_NAME = 'MediaAccessRoutes';

// Route: GET /:contentItemId/:mediaId
// This route is protected by the standard Bearer token authentication.
// It generates a short-lived tokenized URL for accessing media via the contentProxy.
router.get(
  '/:contentItemId/:mediaId',
  authenticateToken, // Protect this endpoint with standard Bearer token auth
  asyncHandler(async (req: AuthenticatedRequest, res, next) => {
    // The generateMediaAccessUrl controller function will handle logic and response.
    // It expects req.user to be populated by authenticateToken.
    logger.debug(MODULE_NAME, `Received request to generate media access URL for contentItemId: ${req.params.contentItemId}, mediaId: ${req.params.mediaId}`);
    await generateMediaAccessUrl(req, res, next);
  })
);

export default router;
