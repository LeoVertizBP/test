import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware'; // Import AuthenticatedRequest
import PublisherFlagService, { AuthorizationError, NotFoundError, InvalidStateError } from '../services/publisherFlagService'; // Import service and errors
import { FlagStatus } from '@prisma/client'; // Import FlagStatus enum for validation
import { validate as uuidValidate } from 'uuid'; // Import UUID validation function

// Define interfaces for the transformed data structure
interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string;
}

interface TransformedFlag {
  id: string;
  description: string; // This will be the flag's context_text
  status: string;
  created_at: string;
  rule_name: string; // Name of the rule
  rule_violation_text: string; // Detailed text of the rule violation
  content_url: string;
  publisher_name: string;
  product_name: string; // Added product name
  screenshot_url?: string;
  // comments: FlagComment[]; // Comments removed from summary transform
}

class PublisherFlagController {
  constructor() {
    // Bind the methods to ensure 'this' context is preserved when used as callbacks
    this.getFlagsForPublisher = this.getFlagsForPublisher.bind(this);
    this.addCommentToFlag = this.addCommentToFlag.bind(this);
    this.updateFlagStatus = this.updateFlagStatus.bind(this);
  }

  /**
   * Transforms database flag objects into the format expected by the frontend
   * @param flags Raw flag objects from the database with nested relations
   * @returns Transformed flags in the format expected by the frontend
   */
  private transformFlagsForFrontend(flags: any[]): TransformedFlag[] {
    return flags.map(flag => {
      // Extract content item data
      const contentItem = flag.content_items || {};
      
      // Comments are no longer processed here for the list view

      // Create the transformed flag object
      return {
        id: flag.id,
        description: flag.description, // Comes from service (flag.context_text)
        status: flag.status,
        created_at: flag.created_at,
        rule_name: flag.rule_name, // Comes from service
        rule_violation_text: flag.rule_violation_text, // Comes from service
        content_url: contentItem.url || 'Unknown URL',
        publisher_name: contentItem.publishers?.name || 'Unknown Publisher',
        product_name: flag.product_name || 'N/A', // Comes from service
        screenshot_url: flag.image_url || flag.screenshot_url, // Use screenshot_url if available from service
        // comments: transformedComments, // Comments removed
      };
    });
  }

  /**
   * Handles fetching flags assigned to the logged-in publisher.
   * Expects status filter(s) in query parameters (e.g., ?status=REMEDIATING).
   * @param req Authenticated Express request object
   * @param res Express response object
   */
  async getFlagsForPublisher(req: AuthenticatedRequest, res: Response): Promise<void> {
    const publisherId = req.user?.publisherId; // Get publisherId from authenticated user token
    const statusQuery = req.query.status as string | string[]; // Get status from query params

    console.log("Debug - Publisher ID:", publisherId, "Type:", typeof publisherId);

    if (!publisherId) {
      res.status(403).json({ message: 'Forbidden: Publisher ID not found in token.' });
      return;
    }

    // Log detailed information about the publisher ID for debugging
    console.log("Publisher ID details:", {
      value: publisherId,
      type: typeof publisherId,
      length: publisherId.length,
      isUUID: uuidValidate(publisherId),
      matches: publisherId.match(/^[0-9a-f-]+$/i) ? true : false,
      characters: Array.from(String(publisherId)).map(c => `${c}(${c.charCodeAt(0)})`).join(',')
    });

    // Try to clean up the publisher ID
    let cleanPublisherId = publisherId;
    
    // If it's not a valid UUID, try some cleaning operations
    if (!uuidValidate(cleanPublisherId)) {
      // Trim whitespace
      cleanPublisherId = cleanPublisherId.trim();
      
      // Replace any non-hex characters with nothing
      cleanPublisherId = cleanPublisherId.replace(/[^0-9a-f-]/gi, '');
      
      // Ensure proper UUID format if possible
      if (cleanPublisherId.length >= 32) {
        // Try to format as UUID if we have enough characters
        const parts = [
          cleanPublisherId.slice(0, 8),
          cleanPublisherId.slice(8, 12),
          cleanPublisherId.slice(12, 16),
          cleanPublisherId.slice(16, 20),
          cleanPublisherId.slice(20, 32)
        ];
        cleanPublisherId = parts.join('-');
      }
      
      console.log("Attempted to clean publisher ID:", {
        original: publisherId,
        cleaned: cleanPublisherId,
        nowValid: uuidValidate(cleanPublisherId)
      });
      
      // If still not valid after cleaning, provide a friendly error message
      if (!uuidValidate(cleanPublisherId)) {
        console.error("Publisher ID is not a valid UUID format and couldn't be cleaned:", publisherId);
        res.status(400).json({ 
          message: 'Invalid publisher ID format in token.',
          details: 'The publisher ID in your authentication token is not in a valid UUID format.'
        });
        return;
      }
    }

    // Basic validation for status query param (can be enhanced)
    const allowedStatuses = ['REMEDIATING', 'PENDING', 'IN_REVIEW', 'REMEDIATION_COMPLETE', 'CLOSED']; // Add other relevant statuses if needed
    let statuses: string[] = [];
    if (statusQuery) {
      statuses = Array.isArray(statusQuery) ? statusQuery : [statusQuery];
      if (!statuses.every(s => allowedStatuses.includes(s.toUpperCase()))) {
          res.status(400).json({ message: 'Invalid status value provided.' });
          return;
      }
      statuses = statuses.map(s => s.toUpperCase()); // Ensure uppercase for consistency
    } else {
      // Default to fetching flags needing remediation if no status specified
      statuses = ['REMEDIATING'];
    }


    try {
      console.log(`Fetching flags for publisher ${cleanPublisherId} with status(es): ${statuses.join(', ')}`);
      // Ensure statuses are valid FlagStatus enum values before passing to service
      const validStatuses = statuses as FlagStatus[];
      
      // Use the cleaned publisher ID
      const dbFlags = await PublisherFlagService.getFlags(cleanPublisherId, validStatuses);
      console.log(`PublisherFlagService: Found ${dbFlags.length} flags for publisher ${cleanPublisherId}`);
      
      // Transform flags to match the expected frontend format
      const transformedFlags = this.transformFlagsForFrontend(dbFlags);
      
      res.status(200).json(transformedFlags);

    } catch (error) {
      // Handle potential errors (though getFlags might not throw custom ones unless extended)
      console.error(`Error fetching flags for publisher ${publisherId}:`, error);
      res.status(500).json({ message: 'Internal server error while fetching flags' });
    }
  }

  /**
   * Handles adding a comment to a specific flag by the logged-in publisher.
   * Expects 'comment' in the request body.
   * @param req Authenticated Express request object
   * @param res Express response object
   */
  async addCommentToFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { flagId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.userId; // Get userId from authenticated user token
    const publisherId = req.user?.publisherId; // Get publisherId for authorization check

    if (!publisherId || !userId) {
      res.status(403).json({ message: 'Forbidden: User or Publisher ID not found in token.' });
      return;
    }
    if (!comment) {
      res.status(400).json({ message: 'Comment text is required.' });
      return;
    }
    if (!flagId) {
        res.status(400).json({ message: 'Flag ID is required.' });
        return;
    }

    try {
      console.log(`User ${userId} (Publisher ${publisherId}) adding comment to flag ${flagId}`);
      const newComment = await PublisherFlagService.addComment(userId, publisherId, flagId, comment);
      res.status(201).json(newComment); // Return the created comment

    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ message: error.message });
      } else {
        console.error(`Error adding comment to flag ${flagId} by user ${userId}:`, error);
        res.status(500).json({ message: 'Internal server error while adding comment' });
      }
    }
  }

  /**
   * Handles updating the status of a specific flag by the logged-in publisher.
   * Expects 'status' in the request body (e.g., REMEDIATION_COMPLETE).
   * @param req Authenticated Express request object
   * @param res Express response object
   */
  async updateFlagStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { flagId } = req.params;
    const { status } = req.body; // e.g., { status: 'REMEDIATION_COMPLETE' }
    const userId = req.user?.userId; // For logging/auditing
    const publisherId = req.user?.publisherId; // For authorization

    if (!publisherId || !userId) {
      res.status(403).json({ message: 'Forbidden: User or Publisher ID not found in token.' });
      return;
    }
    if (!status) {
      res.status(400).json({ message: 'New status is required.' });
      return;
    }
     if (!flagId) {
        res.status(400).json({ message: 'Flag ID is required.' });
        return;
    }

    // Basic validation for allowed status transitions by publisher
    const allowedTargetStatus = 'REMEDIATION_COMPLETE'; // Publisher can only mark as complete
    if (status.toUpperCase() !== allowedTargetStatus) {
        res.status(400).json({ message: `Invalid target status. Publisher can only set status to ${allowedTargetStatus}.` });
        return;
    }

    try {
      console.log(`User ${userId} (Publisher ${publisherId}) updating flag ${flagId} status to ${status}`);
      // Ensure status is a valid FlagStatus enum value before passing
      const targetStatus = status.toUpperCase() as FlagStatus;
      const updatedFlag = await PublisherFlagService.updateStatus(userId, publisherId, flagId, targetStatus);
      res.status(200).json(updatedFlag); // Return the updated flag

    } catch (error) {
       if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof InvalidStateError) {
        res.status(400).json({ message: error.message }); // Or 409 Conflict
      } else {
        console.error(`Error updating status for flag ${flagId} by user ${userId}:`, error);
        res.status(500).json({ message: 'Internal server error while updating flag status' });
      }
    }
  }
}

// Export a singleton instance
export default new PublisherFlagController();
