import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware'; // Assuming this type is defined and includes req.user
import flagService, { FlagNotFoundError, OperationNotPermittedError } from '../services/flagService'; // Import the new service and custom errors

class FlagController {
  public async getFlagById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { flagId } = req.params;
      if (!req.user || !req.user.organizationId) {
        res.status(401).json({ message: 'Authentication required with organization ID.' });
        return;
      }
      const organizationId = req.user.organizationId;

      const flag = await flagService.getFlagDetailsForReviewer(flagId, organizationId);
      res.status(200).json(flag);
    } catch (error: any) {
      console.error(`Error fetching flag ${req.params.flagId}:`, error);
      if (error instanceof FlagNotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof OperationNotPermittedError) {
        res.status(403).json({ message: error.message });
      } else if (error.statusCode) { // Catch other errors from flagService that might have statusCode
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || 'Failed to fetch flag details.' });
      }
    }
  }

  public async addCommentByReviewer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { flagId } = req.params;
      const { comment } = req.body;

      // Ensure req.user and its properties are correctly typed/available via AuthenticatedRequest
      // The exact structure of req.user (e.g., userId, organizationId) needs to match what authMiddleware provides.
      if (!req.user || !req.user.userId || !req.user.organizationId) {
        res.status(401).json({ message: 'Authentication required with user ID and organization ID.' });
        return;
      }
      const userId = req.user.userId;
      const organizationId = req.user.organizationId;

      if (!comment || typeof comment !== 'string' || comment.trim() === '') {
        res.status(400).json({ message: 'Comment text is required.' });
        return;
      }

      const newComment = await flagService.addCommentByReviewer(flagId, userId, organizationId, comment.trim());
      res.status(201).json(newComment);
    } catch (error: any) {
      console.error('Error adding comment by reviewer:', error);
      // Check for custom error types if they have a statusCode property
      if (error.statusCode) {
        res.status(error.statusCode).json({ message: error.message });
      } else if (error.name === 'FlagNotFoundError' || error.name === 'OperationNotPermittedError') {
        // Fallback if statusCode isn't on the error but name matches
        res.status(error.name === 'FlagNotFoundError' ? 404 : 403).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || 'Failed to add comment.' });
      }
    }
  }

  public async deleteComment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { flagId, commentId } = req.params; // flagId might be useful for context or if comment IDs are not globally unique

      if (!req.user || !req.user.userId || !req.user.role) {
        res.status(401).json({ message: 'Authentication required with user ID and role.' });
        return;
      }
      const userId = req.user.userId;
      const userRole = req.user.role;

      // The service method will handle authorization (e.g., admin or comment owner)
      await flagService.deleteComment(commentId, userId, userRole, flagId); 
      
      res.status(204).send(); // No content to send back on successful deletion
    } catch (error: any) {
      console.error(`Error deleting comment ${req.params.commentId} for flag ${req.params.flagId}:`, error);
      if (error instanceof FlagNotFoundError) { // Assuming CommentNotFound might be a specific error, or FlagNotFoundError if comment is tied to flag existence
        res.status(404).json({ message: error.message });
      } else if (error instanceof OperationNotPermittedError) {
        res.status(403).json({ message: error.message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || 'Failed to delete comment.' });
      }
    }
  }

  /**
   * Deletes a flag by ID.
   * Creates an audit log entry with the flag's details before deletion.
   * Only users with ADMIN or REVIEWER roles can delete flags.
   */
  public async deleteFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { flagId } = req.params;

      if (!req.user || !req.user.userId || !req.user.role || !req.user.organizationId) {
        res.status(401).json({ message: 'Authentication required with user ID, role, and organization ID.' });
        return;
      }
      
      const userId = req.user.userId;
      const userRole = req.user.role;
      const organizationId = req.user.organizationId;

      // The service method will handle authorization and audit logging
      await flagService.deleteFlag(flagId, userId, userRole, organizationId);
      
      res.status(204).send(); // No content to send back on successful deletion
    } catch (error: any) {
      console.error(`Error deleting flag ${req.params.flagId}:`, error);
      if (error instanceof FlagNotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof OperationNotPermittedError) {
        res.status(403).json({ message: error.message });
      } else if (error.statusCode) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || 'Failed to delete flag.' });
      }
    }
  }
}

// Export an instance of the controller
export default new FlagController();
