import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Assuming DecodedPayload is exported
import * as logger from '../utils/logUtil';

const MODULE_NAME = 'MediaAccessController';

// JWT secret should be the same as used in authMiddleware
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = '5m'; // Short-lived token, e.g., 5 minutes

if (!JWT_SECRET) {
  logger.error(MODULE_NAME, "FATAL ERROR: JWT_SECRET is not defined in environment variables for MediaAccessController.");
  // Consider a more graceful shutdown or error handling if this module is critical at startup
  // For now, logging an error. The main authMiddleware already exits process if JWT_SECRET is missing.
}

export const generateMediaAccessUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { contentItemId, mediaId } = req.params;
  const user = req.user as DecodedPayload; // Type assertion, as authenticateToken middleware should populate this

  if (!user || !user.userId) {
    logger.warn(MODULE_NAME, 'User not found on request or userId missing in token payload.', { pathParams: req.params });
    res.status(401).json({ message: 'Unauthorized: User information missing.' });
    return;
  }

  if (!contentItemId || !mediaId) {
    logger.warn(MODULE_NAME, 'Missing contentItemId or mediaId in request params.', { contentItemId, mediaId });
    res.status(400).json({ message: 'Bad Request: contentItemId and mediaId are required.' });
    return;
  }

  // Basic UUID validation (can be enhanced or moved to a validation middleware)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(contentItemId) || !uuidRegex.test(mediaId)) {
      logger.warn(MODULE_NAME, 'Invalid UUID format for contentItemId or mediaId.', { contentItemId, mediaId });
      res.status(400).json({ message: 'Invalid format for contentItemId or mediaId. Must be valid UUIDs.' });
      return;
  }
  
  logger.info(MODULE_NAME, `Generating media access URL for user: ${user.userId}, contentItem: ${contentItemId}, media: ${mediaId}`);

  try {
    // TODO: Optional but Recommended: Add an authorization check here
    // e.g., verify that user.userId has permission to access this specific contentItemId/mediaId
    // This might involve a database lookup. For now, we assume if they passed initial auth, they can request.

    if (!JWT_SECRET) {
      // This check is redundant if authMiddleware already handles it, but good for safety within this module
      logger.error(MODULE_NAME, 'JWT_SECRET is not available to sign the access token.');
      res.status(500).json({ message: 'Internal Server Error: Configuration error.' });
      return;
    }

    const tokenPayload = {
      userId: user.userId,
      contentItemId: contentItemId,
      mediaId: mediaId,
      // 'iss', 'aud' could also be added for more specificity
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    const mediaAccessUrl = `/api/v1/content-proxy/${contentItemId}/${mediaId}?access_token=${accessToken}`;
    
    logger.info(MODULE_NAME, `Successfully generated media access URL for user: ${user.userId}`);
    res.status(200).json({ mediaAccessUrl });

  } catch (error) {
    logger.error(MODULE_NAME, `Error generating media access URL for user: ${user.userId}`, error);
    // Pass error to the centralized error handler
    next(error);
  }
};
