import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import asyncHandler from '../utils/asyncHandler';
import { getGcsFileDetailsAndStream } from '../services/gcsService'; // Now correctly imports the actual function

export const streamGcsFile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { contentItemId, mediaId } = req.params;
    
    // UUID validation is done in the route handler.
    console.log(`[ContentProxyController] Attempting to stream file for contentItemId: ${contentItemId}, mediaId: ${mediaId}`);

    // The service function will handle database lookups, GCS streaming,
    // setting headers, and piping the stream to 'res'.
    // Errors thrown by the service will be caught by asyncHandler and passed to 'next'.
    await getGcsFileDetailsAndStream(contentItemId, mediaId, res);
    
    // If getGcsFileDetailsAndStream successfully pipes the response and doesn't throw,
    // the request handling is complete here.
});
