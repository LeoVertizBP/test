import express, { Response, NextFunction, Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import DecodedPayload
import asyncHandler from '../utils/asyncHandler';
import { streamGcsFile } from '../controllers/contentProxyController';
import * as logger from '../utils/logUtil';

const router = express.Router();
const MODULE_NAME = 'ContentProxyRoutes';

// JWT secret should be the same as used elsewhere
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error(MODULE_NAME, "FATAL ERROR: JWT_SECRET is not defined. This route cannot function securely.");
  // This won't stop the app here, but requests will fail.
  // The main authMiddleware already exits process if JWT_SECRET is missing for its operations.
}

// Custom middleware to authenticate media access token from query parameter
const authenticateMediaAccessToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const accessToken = req.query.access_token as string;

  if (!accessToken) {
    logger.warn(MODULE_NAME, 'Access token missing from query parameters.');
    res.status(401).json({ message: 'Unauthorized: Access token required.' });
    return;
  }

  if (!JWT_SECRET) {
    // Should have been caught at module load, but as a runtime check:
    logger.error(MODULE_NAME, 'JWT_SECRET is not available for token verification.');
    res.status(500).json({ message: 'Internal Server Error: Configuration error.' });
    return;
  }
  
  jwt.verify(accessToken, JWT_SECRET, (err, decoded) => {
    if (err) {
      logger.warn(MODULE_NAME, 'Invalid or expired access token.', { error: err.message });
      res.status(403).json({ message: 'Forbidden: Invalid or expired access token.' });
      return;
    }

    const decodedPayload = decoded as DecodedPayload; // Type assertion

    // Security Check: Ensure token is for the requested resource
    const { contentItemId: pathContentItemId, mediaId: pathMediaId } = req.params;
    if (decodedPayload.contentItemId !== pathContentItemId || decodedPayload.mediaId !== pathMediaId) {
      logger.error(MODULE_NAME, 'Token-resource mismatch.', {
        tokenContentItem: decodedPayload.contentItemId,
        pathContentItem: pathContentItemId,
        tokenMedia: decodedPayload.mediaId,
        pathMedia: pathMediaId,
      });
      res.status(403).json({ message: 'Forbidden: Token not valid for this resource.' });
      return;
    }
    
    // Attach user information from the temporary token if needed by downstream (though streamGcsFile might not need it)
    // For consistency, we can populate req.user, but ensure it's clear this is from a temporary access token.
    req.user = { 
        userId: decodedPayload.userId,
        // Add other fields from DecodedPayload if they exist in the temp token and are needed
        // For now, keeping it minimal as the primary purpose is access grant, not full user context.
        email: '', // Placeholder, not typically in temp media token
        role: '',   // Placeholder
        organizationId: '', // Placeholder
     } as DecodedPayload;


    logger.debug(MODULE_NAME, `Media access token validated for user: ${decodedPayload.userId}, contentItem: ${pathContentItemId}, media: ${pathMediaId}`);
    next();
  });
};


// Base path for this router will be /api/v1/content-proxy (defined in app.ts)
// Route: GET /:contentItemId/:mediaId
router.get(
  '/:contentItemId/:mediaId',
  authenticateMediaAccessToken, // Use the new custom middleware
  asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { contentItemId, mediaId } = req.params;

    // Basic UUID validation (can be kept or moved to a global validation middleware)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(contentItemId)) {
      logger.warn(MODULE_NAME, `Invalid contentItemId format: ${contentItemId}`);
      return res.status(400).json({ message: 'Invalid contentItemId format. Must be a valid UUID.' });
    }
    if (!uuidRegex.test(mediaId)) {
      logger.warn(MODULE_NAME, `Invalid mediaId format: ${mediaId}`);
      return res.status(400).json({ message: 'Invalid mediaId format. Must be a valid UUID.' });
    }
    
    logger.debug(MODULE_NAME, `Forwarding to streamGcsFile for contentItem: ${contentItemId}, media: ${mediaId}`);
    // Delegate to the controller function
    await streamGcsFile(req, res, next);
  })
);

export default router;
